"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRecepciones, Recepcion } from "@/hooks/use-recepciones"
import { Plus, Search, RefreshCw, FileText, Calendar, Trash2, FileSpreadsheet, X, Eye, Pencil, MoreHorizontal, Loader2, AlertCircle, Upload } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"

// --- Smart Iframe Component with Retry Logic ---
interface SmartIframeProps {
    src: string;
    title: string;
}

function SmartIframe({ src, title }: SmartIframeProps) {
    const [key, setKey] = useState(0); // Force re-render
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleLoad = () => {
        setIsLoading(false);
        setError(null);
        setRetryCount(0);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        setError(null);
        setKey(prev => prev + 1); // Remount iframe
        setRetryCount(prev => prev + 1);
    }, []);

    // Watchdog for timeout (Gateway Timeout usually takes 30-60s, but we can be proactive)
    useEffect(() => {
        if (!isLoading) return;

        // Exponential backoff for auto-retry
        // 1st retry: 20s (given backend speed)
        // 2nd retry: 40s
        // 3rd retry: 80s
        const timeoutMs = 20000 * Math.pow(2, retryCount); 
        
        timeoutRef.current = setTimeout(() => {
            if (retryCount < 2) {
                toast.loading(`El servidor tarda en responder. Reintentando... (Intento ${retryCount + 1}/3)`);
                setTimeout(() => {
                    toast.dismiss();
                    handleRetry();
                }, 1500);
            } else {
                setError(`El servicio no responde después de varios intentos (${timeoutMs/1000}s).`);
                setIsLoading(false);
            }
        }, timeoutMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [isLoading, retryCount, handleRetry]);

    // STABILIZE URL: Only change when retryCount changes
    const currentSrc = useMemo(() => {
        const url = new URL(src);
        url.searchParams.set('retry', retryCount.toString());
        url.searchParams.set('t', Date.now().toString()); // Still reload on AUTHENTIC retry
        return url.toString();
    }, [src, retryCount]);

    return (
        <div className="w-full h-full relative bg-gray-50">
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 backdrop-blur-sm transition-all duration-300">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                        {retryCount > 0 && (
                            <div className="absolute top-0 right-0 -mr-2 -mt-2 h-5 w-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-bounce">
                                {retryCount}
                            </div>
                        )}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground animate-pulse text-center">
                        Conectando con el módulo... <br/>
                        <span className="text-xs opacity-75">Esto puede tardar unos segundos si el sistema está "frío".</span>
                    </p>
                </div>
            )}
            
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <AlertCircle className="h-10 w-10 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Conexión Interrumpida</h3>
                    <p className="text-sm text-gray-500 max-w-xs mb-8 leading-relaxed">
                        {error} <br/>
                        Es posible que el servicio esté reiniciándose o experimentando alta carga.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Recargar Página
                        </Button>
                        <Button onClick={handleRetry} className="gap-2 shadow-md hover:shadow-lg transition-all">
                            <RefreshCw className="h-4 w-4" />
                            Reintentar Conexión
                        </Button>
                    </div>
                </div>
            )}

            <iframe
                key={key}
                src={currentSrc}
                className={`w-full h-full border-none transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                title={title}
                onLoad={handleLoad}
                onError={() => setError("Error al cargar el marco de contenido.")}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="eager"
            />
        </div>
    );
}

export function RecepcionModule() {
    const { recepciones, loading, fetchRecepciones, deleteRecepcion } = useRecepciones()
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [token, setToken] = useState<string | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importedData, setImportedData] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { user } = useAuth()

    const syncIframeToken = async (): Promise<string | null> => {
        const { data: { session } } = await supabase.auth.getSession()
        const freshToken = session?.access_token ?? null
        setToken(freshToken)
        return freshToken
    }

    // Initial fetch|
    useEffect(() => {
        fetchRecepciones()

        // Get session token to pass to iframe
        syncIframeToken()
    }, [fetchRecepciones])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                setEditId(null)
                fetchRecepciones()
            }
            // Auto-refresh: iframe requests a fresh token before expiry
            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                syncIframeToken().then((freshToken) => {
                    if (freshToken && event.source) {
                        (event.source as Window).postMessage(
                            { type: 'TOKEN_REFRESH', token: freshToken },
                            '*'
                        )
                    }
                })
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [fetchRecepciones])

    // Sync imported data to Iframe when it opens
    useEffect(() => {
        if (isModalOpen && importedData && !editId) {
            const sendData = () => {
                const iframes = document.getElementsByTagName('iframe');
                for (let i = 0; i < iframes.length; i++) {
                    const iframe = iframes[i];
                    // Match by title or src
                    if (iframe.title === 'Nueva Recepción') {
                        console.log('[RecepcionModule] Syncing imported data to iframe...');
                        iframe.contentWindow?.postMessage({
                            type: 'IMPORT_DATA',
                            data: importedData
                        }, '*');
                    }
                }
            };
            
            // Wait for iframe content to be ready
            const timer = setTimeout(sendData, 3000); 
            return () => clearTimeout(timer);
        }
    }, [isModalOpen, importedData, editId])

    // Refresh when modal closes
    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            if (editId) {
                // Editing → show confirmation before discarding
                setShowExitConfirm(true)
                return
            }
            // Creating new → close directly
            setIsModalOpen(false)
            fetchRecepciones()
            return
        }
        setIsModalOpen(open)
    }

    const confirmCloseModal = () => {
        setShowExitConfirm(false)
        setIsModalOpen(false)
        setEditId(null)
        fetchRecepciones()
    }

    const handleEdit = async (recepcion: Recepcion) => {
        await syncIframeToken()
        setEditId(recepcion.id)
        setIsDetailOpen(false)
        setIsModalOpen(true)
    }

    const handleCreate = async () => {
        await syncIframeToken()
        setEditId(null)
        setImportedData(null)
        setIsModalOpen(true)
    }

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xlsm')) {
            toast.error("Solo se permiten archivos Excel (.xlsx, .xlsm)")
            return
        }

        setIsImporting(true)
        const loadingToast = toast.loading("Procesando Excel...")
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

        try {
            const formData = new FormData()
            formData.append('file', file)
            
            const response = await authFetch(`${API_URL}/api/recepcion/importar-excel`, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || "Error al procesar el Excel")
            }

            const data = await response.json()
            toast.dismiss(loadingToast)
            toast.success(`Excel importado: ${data.muestras?.length || 0} muestras detectadas`)
            
            // Set data and open modal
            setImportedData(data)
            await syncIframeToken()
            setEditId(null)
            setIsModalOpen(true)
        } catch (error: any) {
            toast.dismiss(loadingToast)
            toast.error(error.message)
        } finally {
            setIsImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    // Filter Logic
    const filteredData = recepciones.filter(item =>
        item.numero_ot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.numero_recepcion?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleDelete = async (id: number) => {
        const success = await deleteRecepcion(id)
        if (success) {
            toast.success("Recepción eliminada correctamente")
            if (selectedRecepcion?.id === id) {
                setIsDetailOpen(false)
            }
        } else {
            toast.error("Error al eliminar recepción")
        }
    }

    const handleDownloadExcel = async (id: number) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
        try {
            const response = await authFetch(`${API_URL}/api/recepcion/${id}/excel`)
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                
                // Try to get filename from headers
                const contentDisposition = response.headers.get('Content-Disposition')
                let filename = `Recepcion-${id}.xlsx`
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?([^"]+)"?/)
                    if (match && match[1]) filename = match[1]
                }
                
                a.download = filename
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
            } else {
                toast.error("Error al descargar el archivo")
            }
        } catch (error) {
            console.error("Download error:", error)
            toast.error("Error de conexión al descargar")
        }
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "-"
        const parts = dateStr.split('/')
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0')
            const month = parts[1].padStart(2, '0')
            const year = parts[2]
            return `${day}/${month}/${year}`
        }
        return dateStr
    }

    const openDetail = (recepcion: Recepcion) => {
        setSelectedRecepcion(recepcion)
        setIsDetailOpen(true)
    }

    return (
        <div className="h-full min-h-0 flex flex-col gap-6 p-4 md:p-6 overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Recepciones</h1>
                    <p className="text-muted-foreground">Gestiona los registros de ingreso y órdenes de trabajo</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xlsm"
                        onChange={handleImportExcel}
                        className="hidden"
                    />
                    <Button variant="outline" size="icon" onClick={() => fetchRecepciones()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button 
                        onClick={() => fileInputRef.current?.click()} 
                        disabled={isImporting}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Importar Recepción
                    </Button>
                    <Button onClick={handleCreate} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nueva Recepción
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por OT, Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Content (Table) */}
            <div className="rounded-md border bg-card flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Recepción</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Proyecto</TableHead>
                            <TableHead className="text-center">Muestras</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && recepciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Cargando datos...
                                </TableCell>
                            </TableRow>
                        ) : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No se encontraron resultados
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(item)}>
                                    <TableCell className="font-bold text-primary">{item.numero_recepcion}</TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.cliente}>
                                        {item.cliente}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.proyecto}>
                                        {item.proyecto}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">
                                            {Array.isArray(item.muestras) ? item.muestras.length : 0}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openDetail(item)}>
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                                <Pencil className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. Esto eliminará permanentemente la recepción
                                                            <span className="font-bold text-foreground"> {item.numero_recepcion} </span>
                                                            y la orden de trabajo asociada.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                            Eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal with Iframe for Creation */}
            <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background [&>button]:hidden">
                    <DialogHeader className="hidden">
                        <DialogTitle>{editId ? 'Editar Recepción' : 'Nueva Recepción'}</DialogTitle>
                        <DialogDescription>{editId ? 'Formulario de edición de recepción' : 'Formulario de creación de nueva recepción'}</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <SmartIframe
                            src={editId
                                ? `${process.env.NEXT_PUBLIC_RECEPCION_FRONTEND_URL || "http://127.0.0.1:5173"}/migration/recepciones/${editId}/editar?token=${token || ''}`
                                : `${process.env.NEXT_PUBLIC_RECEPCION_FRONTEND_URL || "http://127.0.0.1:5173"}/migration/nueva-recepcion?token=${token || ''}`
                            }
                            title={editId ? 'Editar Recepción' : 'Nueva Recepción'}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Unsaved changes confirmation */}
            <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Los datos ingresados no se han guardado. Si sales ahora, se perderán los cambios.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Seguir editando</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCloseModal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Salir sin guardar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Detail Sheet/Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" />
                            Detalle de Recepción {selectedRecepcion?.numero_recepcion}
                        </DialogTitle>
                        <DialogDescription>
                            Información completa de la orden de trabajo {selectedRecepcion?.numero_ot}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecepcion && (
                        <div className="flex-1 min-h-0 overflow-auto">
                            <div className="p-6 space-y-6">
                                {/* Section 1: Project & Client */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente / Solicitante</p>
                                        <p className="font-semibold text-lg">{selectedRecepcion.solicitante || selectedRecepcion.cliente}</p>
                                        {selectedRecepcion.domicilio_legal && <p className="text-sm text-muted-foreground">{selectedRecepcion.domicilio_legal}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</p>
                                        <p className="font-semibold text-lg">{selectedRecepcion.proyecto}</p>
                                        {selectedRecepcion.ubicacion && <p className="text-sm text-muted-foreground">{selectedRecepcion.ubicacion}</p>}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contacto</p>
                                        <p className="text-sm font-medium">{selectedRecepcion.persona_contacto || "-"}</p>
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                            {selectedRecepcion.email && selectedRecepcion.email.split(/[\s,;]+/).filter(Boolean).map((e, i) => (
                                                <p key={i}>{e}</p>
                                            ))}
                                            {selectedRecepcion.telefono && <p>Tel: {selectedRecepcion.telefono}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fechas</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Recepción:</span> <span className="font-medium">{formatDate(selectedRecepcion.fecha_recepcion)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Conclusión Est.:</span> <span className="font-medium">{formatDate(selectedRecepcion.fecha_estimada_culminacion)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Logistics */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Emisión de Formatos</p>
                                        <div className="flex gap-2 mt-1">
                                            {selectedRecepcion.emision_fisica && <Badge variant="outline">Físico</Badge>}
                                            {selectedRecepcion.emision_digital && <Badge variant="default">Digital</Badge>}
                                            {!selectedRecepcion.emision_fisica && !selectedRecepcion.emision_digital && <span className="text-muted-foreground">-</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entregado Por</p>
                                        <p className="font-medium">{selectedRecepcion.entregado_por || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recibido Por</p>
                                        <p className="font-medium">{selectedRecepcion.recibido_por || "-"}</p>
                                    </div>
                                </div>

                                {/* Section 3: Samples Table */}
                                <div>
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">
                                            {Array.isArray(selectedRecepcion.muestras) ? selectedRecepcion.muestras.length : 0}
                                        </span>
                                        Muestras Registradas
                                    </h3>
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table className="min-w-[900px]">
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 text-xs hover:bg-muted/50">
                                                    <TableHead className="w-[50px] text-center font-bold">Nº</TableHead>
                                                    <TableHead className="font-bold">Código LEM</TableHead>
                                                    <TableHead className="font-bold">Codigo</TableHead>
                                                    <TableHead className="font-bold">Estructura</TableHead>
                                                    <TableHead className="text-center font-bold">F&apos;c</TableHead>
                                                    <TableHead className="font-bold">Fecha Moldeo</TableHead>
                                                    <TableHead className="font-bold">Hora</TableHead>
                                                    <TableHead className="text-center font-bold">Edad</TableHead>
                                                    <TableHead className="font-bold">Fecha Rotura</TableHead>
                                                    <TableHead className="text-center font-bold">Densidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="text-xs">
                                                {Array.isArray(selectedRecepcion.muestras) && selectedRecepcion.muestras.map((m: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="text-center font-medium bg-muted/20">{m.item_numero}</TableCell>
                                                        <TableCell className="font-mono text-primary">{m.codigo_muestra_lem || "-"}</TableCell>
                                                        <TableCell className="whitespace-pre-wrap max-w-[180px]">{m.identificacion_muestra || "-"}</TableCell>
                                                        <TableCell className="whitespace-pre-wrap max-w-[180px]">{m.estructura || "-"}</TableCell>
                                                        <TableCell className="text-center font-bold">{m.fc_kg_cm2 || "-"}</TableCell>
                                                        <TableCell>{formatDate(m.fecha_moldeo)}</TableCell>
                                                        <TableCell>{m.hora_moldeo || "-"}</TableCell>
                                                        <TableCell className="text-center font-semibold">{m.edad}</TableCell>
                                                        <TableCell>{formatDate(m.fecha_rotura)}</TableCell>
                                                        <TableCell className="text-center">
                                                            {m.requiere_densidad ? <Badge variant="outline" className="h-5 px-1">SI</Badge> : <span className="text-muted-foreground opacity-50">NO</span>}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!Array.isArray(selectedRecepcion.muestras) || selectedRecepcion.muestras.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                                            No hay muestras registradas en esta recepción.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="p-6 border-t shrink-0 bg-muted/5 gap-2 sm:gap-0">
                        <div className="flex-1 text-xs text-muted-foreground flex items-center">
                            ID Referencia: {selectedRecepcion?.id}
                        </div>
                        <Button variant="outline" onClick={() => selectedRecepcion && handleEdit(selectedRecepcion)} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Editar
                        </Button>
                        <Button variant="outline" onClick={() => selectedRecepcion && handleDownloadExcel(selectedRecepcion.id)} className="gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Descargar Excel
                        </Button>
                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
