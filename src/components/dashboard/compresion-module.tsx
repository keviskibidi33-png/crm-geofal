"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { RefreshCw, Plus, Search, FileText, Trash2, Eye, FileSpreadsheet, Pencil, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import { ScrollArea } from "@/components/ui/scroll-area"

interface EnsayoCompresion {
    id: number
    numero_ot: string
    numero_recepcion: string
    recepcion_id?: number
    estado: string
    fecha_creacion: string
    items_count?: number
}

// --- Smart Iframe Component with Retry Logic ---
interface SmartIframeProps {
    src: string;
    title: string;
}

function SmartIframe({ src, title }: SmartIframeProps) {
    const [key, setKey] = useState(0);
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
        setKey(prev => prev + 1);
        setRetryCount(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!isLoading) return;

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

    const currentSrc = useMemo(() => {
        const url = new URL(src);
        url.searchParams.set('retry', retryCount.toString());
        url.searchParams.set('t', Date.now().toString());
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

export function CompresionModule() {
    const [ensayos, setEnsayos] = useState<EnsayoCompresion[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [iframePath, setIframePath] = useState("/compresion")
    const [token, setToken] = useState<string | null>(null)
    const [selectedEnsayo, setSelectedEnsayo] = useState<any>(null)
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const FRONTEND_URL = process.env.NEXT_PUBLIC_COMPRESION_FRONTEND_URL || "http://127.0.0.1:5175"
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

    const syncIframeToken = async (): Promise<string | null> => {
        const { data: { session } } = await supabase.auth.getSession()
        const freshToken = session?.access_token ?? null
        setToken(freshToken)
        return freshToken
    }

    // Fetch ensayos from API
    const fetchEnsayos = async () => {
        setLoading(true)
        try {
            const response = await authFetch(`${API_URL}/api/compresion/`)
            if (response.ok) {
                const data = await response.json()
                setEnsayos(data)
            }
        } catch (error) {
            console.error("Error fetching ensayos:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEnsayos()

        // Get session token to pass to iframe
        syncIframeToken()
    }, [])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                fetchEnsayos() // Refresh list after modal closes
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
    }, [])

    const handleOpenModal = async (path: string) => {
        await syncIframeToken()
        setIframePath(path)
        setIsModalOpen(true)
    }

    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            if (iframePath.includes('id=')) {
                // Editing → show confirmation before discarding
                setShowExitConfirm(true)
                return
            }
            // Creating new → close directly
            setIsModalOpen(false)
            fetchEnsayos()
            return
        }
        setIsModalOpen(open)
    }

    const confirmCloseModal = () => {
        setShowExitConfirm(false)
        setIsModalOpen(false)
        fetchEnsayos()
    }

    const handleDelete = async (id: number) => {
        try {
            const response = await authFetch(`${API_URL}/api/compresion/${id}`, {
                method: 'DELETE'
            })
            if (response.ok) {
                toast.success("Ensayo eliminado correctamente")
                fetchEnsayos()
            } else {
                toast.error("Error al eliminar el ensayo")
            }
        } catch (error) {
            toast.error("Error de conexión")
        }
    }

    const handleDownloadExcel = async (id: number) => {
        try {
            const response = await authFetch(`${API_URL}/api/compresion/${id}/excel`)
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                
                // Try to get filename from headers
                const contentDisposition = response.headers.get('Content-Disposition')
                let filename = `Compresion-${id}.xlsx`
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

    const handleViewDetails = async (item: EnsayoCompresion) => {
        setSelectedEnsayo(item)
        setIsDetailOpen(true)
        setLoadingEnsayo(true)
        try {
            const response = await authFetch(`${API_URL}/api/compresion/${item.id}`)
            if (response.ok) {
                const data = await response.json()
                setSelectedEnsayo(data)
            }
        } catch (error) {
            // Keep showing basic list data
        } finally {
            setLoadingEnsayo(false)
        }
    }

    const filteredData = ensayos.filter(item =>
        item.numero_ot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.numero_recepcion?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const getEstadoBadge = (estado: string) => {
        switch (estado?.toUpperCase()) {
            case 'COMPLETADO':
                return <Badge className="bg-green-100 text-green-700 border-green-200">Completado</Badge>
            case 'EN_PROCESO':
                return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">En Proceso</Badge>
            default:
                return <Badge variant="outline">Pendiente</Badge>
        }
    }

    return (
        <div className="h-full min-h-0 flex flex-col gap-6 p-4 md:p-6 overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Formatos de Ensayo</h1>
                    <p className="text-muted-foreground">Gestión y control de formatos de ensayo de compresión de muestras</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchEnsayos} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={() => handleOpenModal("/compresion")} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo Formato
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por N° OT, Recepción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-card flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° OT</TableHead>
                            <TableHead>N° Recepción</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha Creación</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && ensayos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">Cargando datos...</TableCell>
                            </TableRow>
                        ) : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    {ensayos.length === 0 ? "No hay ensayos registrados. Crea uno nuevo." : "No se encontraron resultados"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(item)}>
                                    <TableCell className="font-medium">{item.numero_ot}</TableCell>
                                    <TableCell>{item.numero_recepcion}</TableCell>
                                    <TableCell>{getEstadoBadge(item.estado)}</TableCell>
                                    <TableCell>{item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString('es-PE') : '-'}</TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end items-center gap-2">
                                            {/* Download Excel */}
                                            <Button variant="ghost" size="icon" title="Descargar Excel" onClick={() => handleDownloadExcel(item.id)}>
                                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                            </Button>

                                            {/* Detail */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Ver Detalle"
                                                onClick={() => handleViewDetails(item)}
                                            >
                                                <Eye className="h-4 w-4 text-slate-600" />
                                            </Button>

                                            {/* Edit */}
                                            <Button variant="ghost" size="icon" title="Editar" onClick={() => handleOpenModal(`/compresion?id=${item.id}`)}>
                                                <Pencil className="h-4 w-4 text-blue-600" />
                                            </Button>

                                            {/* Delete */}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Eliminará el ensayo OT {item.numero_ot}. Esta acción no se puede deshacer.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive hover:bg-destructive/90">
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

            {/* Modal Iframe for Creation/Editing */}
            <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background [&>button]:hidden">
                    <DialogHeader className="hidden">
                        <DialogTitle>Módulo Formato</DialogTitle>
                        <DialogDescription>Crea o edita formatos de ensayo</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <SmartIframe
                            src={`${FRONTEND_URL}${iframePath}${iframePath.includes('?') ? '&' : '?'}token=${token || ''}`}
                            title="Compresión Iframe"
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

            {/* Reception Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" />
                            Detalle de Formato de Ensayo
                        </DialogTitle>
                        <DialogDescription>
                            Información completa del formato OT {selectedEnsayo?.numero_ot}
                        </DialogDescription>
                    </DialogHeader>

                    {loadingEnsayo ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
                            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Cargando datos del ensayo...</p>
                        </div>
                    ) : selectedEnsayo ? (
                        <div className="flex-1 min-h-0 overflow-auto">
                            <div className="p-6 space-y-6">
                                {/* Ensayo Info Card */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                            Cabecera del Ensayo
                                        </h4>
                                        <div className="space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Número OT</p>
                                                    <p className="text-sm font-semibold text-indigo-600 font-mono">{selectedEnsayo.numero_ot}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Número Recepción</p>
                                                    <p className="text-sm font-semibold text-slate-800">{selectedEnsayo.numero_recepcion}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Equipo Utilizado</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedEnsayo.codigo_equipo || 'No especificado'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                            Notas y Adicionales
                                        </h4>
                                        <div className="space-y-2.5">
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Otros Detalles</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedEnsayo.otros || 'Sin detalles'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Nota</p>
                                                <p className="text-xs text-slate-600 italic line-clamp-2">{selectedEnsayo.nota || 'Sin observaciones'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table Section */}
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                            Resultados de Compresión ({selectedEnsayo.items?.length || 0})
                                        </h4>
                                        <Badge variant="outline" className="bg-white text-[9px] font-black">{selectedEnsayo.estado}</Badge>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[1200px]">
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Item</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Cód. LEM</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">F. Programado</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">F. Ensayo</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Hora</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Carga Máx (kN)</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Fractura</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Defectos</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Realizado</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Revisado</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">F. Revisión</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Aprobado</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">F. Aprobación</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedEnsayo.items?.map((m: any) => (
                                                    <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors h-10">
                                                        <TableCell className="text-xs font-bold text-center py-2">{m.item}</TableCell>
                                                        <TableCell className="text-[11px] font-mono text-indigo-700 py-2">{m.codigo_lem || '-'}</TableCell>
                                                        <TableCell className="text-xs py-2">
                                                            {m.fecha_ensayo_programado ? new Date(m.fecha_ensayo_programado).toLocaleDateString('es-PE') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-semibold py-2">
                                                            {m.fecha_ensayo ? new Date(m.fecha_ensayo).toLocaleDateString('es-PE') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs py-2">{m.hora_ensayo || '-'}</TableCell>
                                                        <TableCell className="text-xs font-bold text-green-700 py-2">{m.carga_maxima != null ? `${m.carga_maxima} kN` : '-'}</TableCell>
                                                        <TableCell className="text-xs text-slate-600 py-2">{m.tipo_fractura || '-'}</TableCell>
                                                        <TableCell className="text-xs text-slate-500 py-2">{m.defectos || '-'}</TableCell>
                                                        <TableCell className="text-[10px] text-slate-500 py-2">{m.realizado || '-'}</TableCell>
                                                        <TableCell className="text-[10px] text-slate-500 py-2">{m.revisado || '-'}</TableCell>
                                                        <TableCell className="text-xs py-2">
                                                            {m.fecha_revision ? new Date(m.fecha_revision).toLocaleDateString('es-PE') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-[10px] text-slate-500 py-2">{m.aprobado || '-'}</TableCell>
                                                        <TableCell className="text-xs py-2">
                                                            {m.fecha_aprobacion ? new Date(m.fecha_aprobacion).toLocaleDateString('es-PE') : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!selectedEnsayo.items || selectedEnsayo.items.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={13} className="h-16 text-center text-xs text-slate-400 italic">No hay resultados registrados</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-slate-400 italic">No se encontraron datos para este ensayo.</p>
                        </div>
                    )}

                    <DialogFooter className="p-6 border-t shrink-0 bg-muted/5 gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="px-8 font-bold text-slate-700">
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
