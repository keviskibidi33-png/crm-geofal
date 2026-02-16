"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Plus, Search, FileText, Trash2, Eye, FileSpreadsheet, Clock, ChevronLeft, Building2, MapPin, User, Mail, Phone, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useVerificaciones, VerificacionMuestra } from "@/hooks/use-verificaciones"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { supabase } from "@/lib/supabaseClient"
export function VerificacionMuestrasModule() {
    const { verificaciones, loading, fetchVerificaciones, fetchVerificacion, deleteVerificacion } = useVerificaciones()
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [iframePath, setIframePath] = useState("/nuevo") // Default route for iframe
    const [refreshKey, setRefreshKey] = useState(0)
    const [selectedVerificacion, setSelectedVerificacion] = useState<VerificacionMuestra | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [token, setToken] = useState<string | null>(null)

    const FRONTEND_URL = process.env.NEXT_PUBLIC_VERIFICACION_FRONTEND_URL || "http://127.0.0.1:5174"

    useEffect(() => {
        fetchVerificaciones()

        // Get session token to pass to iframe
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) setToken(session.access_token)
        }
        getSession()
    }, [fetchVerificaciones])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                fetchVerificaciones()
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [fetchVerificaciones])

    const handleOpenModal = (path: string) => {
        setIframePath(path)
        setRefreshKey(prev => prev + 1)
        setIsModalOpen(true)
    }

    const openDetail = async (id: number) => {
        setIsDetailLoading(true)
        setIsDetailOpen(true)
        const data = await fetchVerificacion(id)
        if (data) {
            setSelectedVerificacion(data)
        } else {
            setIsDetailOpen(false)
        }
        setIsDetailLoading(false)
    }

    const handleDelete = async (id: number) => {
        const success = await deleteVerificacion(id)
        if (success) {
            toast.success("Verificación eliminada correctamente")
        }
    }

    const handleDownloadExcel = (id: number) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
        window.open(`${API_URL}/api/verificacion/${id}/exportar`, '_blank')
    }

    const filteredData = verificaciones.filter(item =>
        item.numero_verificacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.cliente && item.cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.codigo_documento.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Verificación Muestras</h1>
                    <p className="text-muted-foreground">Gestión y control de verificaciones de muestras</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => fetchVerificaciones()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={() => handleOpenModal("/nuevo")} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nueva Verificación
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por N° Verificación, Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Native Table */}
            <div className="rounded-md border bg-card flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° Verificación</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Verificado Por</TableHead>
                            <TableHead>Fecha Verificación</TableHead>
                            <TableHead className="text-center">Muestras</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && verificaciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Cargando datos...</TableCell>
                            </TableRow>
                        ) : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No se encontraron resultados</TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(item.id)}>
                                    <TableCell className="font-medium">{item.numero_verificacion}</TableCell>
                                    <TableCell>{item.cliente || "-"}</TableCell>
                                    <TableCell>{item.verificado_por || "-"}</TableCell>
                                    <TableCell>{item.fecha_verificacion || "-"}</TableCell>
                                    <TableCell className="text-center">{item.muestras_verificadas?.length || 0}</TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end items-center gap-2">
                                            {/* Download Excel */}
                                            <Button variant="ghost" size="icon" title="Descargar Excel" onClick={() => handleDownloadExcel(item.id)}>
                                                <FileText className="h-4 w-4 text-green-600" />
                                            </Button>

                                            {/* View Details (Native Dialog) */}
                                            <Button variant="ghost" size="icon" title="Ver Detalles" onClick={() => openDetail(item.id)}>
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </Button>

                                            {/* Edit (Iframe Modal) */}
                                            <Button variant="ghost" size="icon" title="Editar" onClick={() => handleOpenModal(`/editar/${item.id}`)}>
                                                <RefreshCw className="h-4 w-4 text-blue-600" />
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
                                                            Eliminará la verificación {item.numero_verificacion}. Esta acción no se puede deshacer.
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
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background">
                    <DialogHeader className="hidden">
                        <DialogTitle>Módulo Verificación</DialogTitle>
                        <DialogDescription>Crea o edita verificaciones</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <iframe
                            key={refreshKey}
                            src={`${FRONTEND_URL}${iframePath}${iframePath.includes('?') ? '&' : '?'}token=${token || ''}`}
                            className="w-full h-full border-none"
                            title="Verificación Muestras Iframe"
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Native Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" />
                            Detalle de Verificación {selectedVerificacion?.numero_verificacion}
                        </DialogTitle>
                        <DialogDescription>
                            Información completa de la verificación realizada por {selectedVerificacion?.verificado_por}
                        </DialogDescription>
                    </DialogHeader>

                    {isDetailLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : selectedVerificacion && (
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-6 space-y-6">
                                {/* Section 1: General Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</p>
                                        <p className="font-semibold text-lg">{selectedVerificacion.cliente || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">N° Verificación</p>
                                        <p className="font-semibold text-lg">{selectedVerificacion.numero_verificacion}</p>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documento de Referencia</p>
                                        <p className="text-sm font-medium">{selectedVerificacion.codigo_documento} (v{selectedVerificacion.version})</p>
                                        <p className="text-xs text-muted-foreground">Fecha Doc: {selectedVerificacion.fecha_documento} • Pág: {selectedVerificacion.pagina}</p>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha & Responsable</p>
                                        <div className="flex flex-col text-sm">
                                            <span className="font-medium text-foreground">{selectedVerificacion.fecha_verificacion}</span>
                                            <span className="text-muted-foreground">Verificado por: {selectedVerificacion.verificado_por}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Samples Table */}
                                <div>
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">
                                            {selectedVerificacion.muestras_verificadas?.length || 0}
                                        </span>
                                        Muestras Verificadas
                                    </h3>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 text-xs hover:bg-muted/50">
                                                    <TableHead className="w-[50px] text-center font-bold">Itm</TableHead>
                                                    <TableHead className="font-bold">Cód. LEM</TableHead>
                                                    <TableHead className="font-bold">Tipo</TableHead>
                                                    <TableHead className="text-center font-bold">Ø1 (mm)</TableHead>
                                                    <TableHead className="text-center font-bold">Ø2 (mm)</TableHead>
                                                    <TableHead className="text-center font-bold">Tol (%)</TableHead>
                                                    <TableHead className="text-center font-bold">Cumple</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="text-xs">
                                                {selectedVerificacion.muestras_verificadas?.map((m: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="text-center font-medium bg-muted/20">{m.item_numero}</TableCell>
                                                        <TableCell className="font-mono text-primary">{m.codigo_lem || "-"}</TableCell>
                                                        <TableCell className="uppercase">{m.tipo_testigo}</TableCell>
                                                        <TableCell className="text-center">{m.diametro_1_mm}</TableCell>
                                                        <TableCell className="text-center">{m.diametro_2_mm}</TableCell>
                                                        <TableCell className="text-center">{m.tolerancia_porcentaje}%</TableCell>
                                                        <TableCell className="text-center">
                                                            {m.cumple_tolerancia ?
                                                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">SI</Badge> :
                                                                <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5">NO</Badge>
                                                            }
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!selectedVerificacion.muestras_verificadas || selectedVerificacion.muestras_verificadas.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                                            No hay muestras registradas en esta verificación.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter className="p-6 border-t shrink-0 bg-muted/5 gap-2 sm:gap-0">
                        <div className="flex-1 text-xs text-muted-foreground flex items-center">
                            ID Referencia: {selectedVerificacion?.id}
                        </div>
                        <Button variant="outline" onClick={() => selectedVerificacion && handleDownloadExcel(selectedVerificacion.id)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                            Descargar Excel
                        </Button>
                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
