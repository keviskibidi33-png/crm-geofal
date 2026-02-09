"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Plus, Search, FileText, Trash2, Eye, FileSpreadsheet, Pencil, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"

interface EnsayoCompresion {
    id: number
    numero_ot: string
    numero_recepcion: string
    recepcion_id?: number
    estado: string
    fecha_creacion: string
    items_count?: number
}

export function CompresionModule() {
    const [ensayos, setEnsayos] = useState<EnsayoCompresion[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [iframePath, setIframePath] = useState("/compresion")
    const [refreshKey, setRefreshKey] = useState(0)
    const [token, setToken] = useState<string | null>(null)
    const [selectedRecepcion, setSelectedRecepcion] = useState<any>(null)
    const [loadingRecepcion, setLoadingRecepcion] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const FRONTEND_URL = process.env.NEXT_PUBLIC_COMPRESION_FRONTEND_URL || "http://127.0.0.1:5175"
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

    // Fetch ensayos from API
    const fetchEnsayos = async () => {
        setLoading(true)
        try {
            const response = await fetch(`${API_URL}/api/compresion/`)
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
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) setToken(session.access_token)
        }
        getSession()
    }, [])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                fetchEnsayos() // Refresh list after modal closes
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [])

    const handleOpenModal = (path: string) => {
        setIframePath(path)
        setRefreshKey(prev => prev + 1)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: number) => {
        try {
            const response = await fetch(`${API_URL}/api/compresion/${id}`, {
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

    const handleDownloadExcel = (id: number) => {
        window.open(`${API_URL}/api/compresion/${id}/excel`, '_blank')
    }

    const handleViewDetails = async (id: number) => {
        setLoadingRecepcion(true)
        setIsDetailOpen(true)
        try {
            const response = await fetch(`${API_URL}/api/recepcion/${id}`)
            if (response.ok) {
                const data = await response.json()
                setSelectedRecepcion(data)
            } else {
                toast.error("No se pudo cargar el detalle de la recepción")
            }
        } catch (error) {
            toast.error("Error al cargar detalles")
        } finally {
            setLoadingRecepcion(false)
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
        <div className="h-full flex flex-col space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Ensayos de Compresión</h1>
                    <p className="text-muted-foreground">Gestión y control de ensayos de compresión de muestras</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchEnsayos} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={() => handleOpenModal("/compresion")} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo Ensayo
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
                                <TableRow key={item.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium">{item.numero_ot}</TableCell>
                                    <TableCell>{item.numero_recepcion}</TableCell>
                                    <TableCell>{getEstadoBadge(item.estado)}</TableCell>
                                    <TableCell>{item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString('es-PE') : '-'}</TableCell>
                                    <TableCell className="text-right">
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
                                                onClick={() => item.recepcion_id && handleViewDetails(item.recepcion_id)}
                                                disabled={!item.recepcion_id}
                                            >
                                                <Eye className={`h-4 w-4 ${item.recepcion_id ? 'text-slate-600' : 'text-slate-300'}`} />
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
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background">
                    <DialogHeader className="hidden">
                        <DialogTitle>Módulo Compresión</DialogTitle>
                        <DialogDescription>Crea o edita ensayos de compresión</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <iframe
                            key={refreshKey}
                            src={`${FRONTEND_URL}${iframePath}${iframePath.includes('?') ? '&' : '?'}token=${token || ''}`}
                            className="w-full h-full border-none"
                            title="Compresión Iframe"
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reception Detail Modal */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col p-6 bg-background rounded-xl shadow-2xl border">
                    <DialogHeader className="mb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <FileText className="h-6 w-6 text-indigo-600" />
                                    Detalle de Recepción
                                </DialogTitle>
                                <DialogDescription className="text-slate-500 mt-1">
                                    Información completa de la recepción {selectedRecepcion?.numero_recepcion}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {loadingRecepcion ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
                            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Cargando datos de la recepción...</p>
                        </div>
                    ) : selectedRecepcion ? (
                        <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                            {/* Project Info Card */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                        Información del Cliente
                                    </h4>
                                    <div className="space-y-2.5">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Cliente</p>
                                            <p className="text-sm font-semibold text-slate-800">{selectedRecepcion.cliente || 'No especificado'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Proyecto</p>
                                            <p className="text-sm font-semibold text-slate-800">{selectedRecepcion.proyecto || 'No especificado'}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">OT</p>
                                                <p className="text-sm font-semibold text-indigo-600 font-mono">{selectedRecepcion.numero_ot}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Fecha Recepción</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedRecepcion.fecha_recepcion}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                        <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                        Ubicación y Contacto
                                    </h4>
                                    <div className="space-y-2.5">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Ubicación</p>
                                            <p className="text-sm font-semibold text-slate-800">{selectedRecepcion.ubicacion || 'No especificada'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Solicitante</p>
                                            <p className="text-sm font-semibold text-slate-800">{selectedRecepcion.solicitante || 'No especificado'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Observaciones</p>
                                            <p className="text-xs text-slate-600 italic line-clamp-2">{selectedRecepcion.observaciones || 'Sin observaciones'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Samples Table Section */}
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                        Muestras de Concreto ({selectedRecepcion.muestras?.length || 0})
                                    </h4>
                                    <Badge variant="outline" className="bg-white text-[9px] font-black">{selectedRecepcion.estado}</Badge>
                                </div>
                                <div className="overflow-x-auto">
                                    <Table className="min-w-full">
                                        <TableHeader className="bg-slate-50/50">
                                            <TableRow>
                                                <TableHead className="text-[9px] font-black uppercase h-8">Item</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase h-8">Cód. LEM</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase h-8">F. Rotura</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase h-8">Resistencia</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase h-8">Identificación</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase h-8">Estructura</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedRecepcion.muestras?.map((m: any) => (
                                                <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors h-10">
                                                    <TableCell className="text-xs font-bold text-center py-2">{m.item_numero}</TableCell>
                                                    <TableCell className="text-[11px] font-mono text-indigo-700 py-2">{m.codigo_muestra_lem}</TableCell>
                                                    <TableCell className="text-xs font-semibold py-2">{m.fecha_rotura}</TableCell>
                                                    <TableCell className="text-xs font-bold text-green-700 py-2">{m.fc_kg_cm2} kg/cm²</TableCell>
                                                    <TableCell className="text-xs text-slate-600 py-2">{m.identificacion_muestra}</TableCell>
                                                    <TableCell className="text-xs text-slate-600 py-2">{m.estructura}</TableCell>
                                                </TableRow>
                                            ))}
                                            {(!selectedRecepcion.muestras || selectedRecepcion.muestras.length === 0) && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-16 text-center text-xs text-slate-400 italic">No hay muestras registradas</TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-slate-400 italic">No se encontraron datos para esta recepción.</p>
                        </div>
                    )}

                    <DialogFooter className="mt-6 border-t pt-4">
                        <Button variant="outline" onClick={() => setIsDetailOpen(false)} className="px-8 font-bold text-slate-700">
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
