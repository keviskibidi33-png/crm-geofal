"use client"

import { useState, useEffect, useRef } from "react"
import { useTracing } from "@/hooks/use-tracing"
import { useReactToPrint } from "react-to-print"
import { ModernConfirmDialog } from "../modern-confirm-dialog"
import {
    Search,
    AlertCircle,
    FileText,
    FlaskConical,
    Zap,
    LayoutList,
    RefreshCw,
    Eye,
    ChevronRight,
    Download,
    Loader2,
    FileSpreadsheet,
    Trash2,
    History
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/api-auth"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"

export function TracingModule() {
    const { user } = useAuth()
    const { tracingData: rawTracingData, tracingList: rawTracingList, loading, loadingList, fetchTracing, fetchTracingList, deleteTracing } = useTracing()
    const tracingData = rawTracingData as any
    const tracingList = (rawTracingList || []) as any[]
    const [searchTerm, setSearchTerm] = useState("")
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [deleteTargetNumero, setDeleteTargetNumero] = useState<string | null>(null)
    const [deleteConfirmInput, setDeleteConfirmInput] = useState("")
    const [isEnsayoDetailOpen, setIsEnsayoDetailOpen] = useState(false)
    const [selectedEnsayo, setSelectedEnsayo] = useState<any>(null)
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [selectedEnsayoId, setSelectedEnsayoId] = useState<number | null>(null)

    const [isRecepcionDetailOpen, setIsRecepcionDetailOpen] = useState(false)
    const [selectedRecepcion, setSelectedRecepcion] = useState<any>(null)
    const [loadingRecepcion, setLoadingRecepcion] = useState(false)

    const [isCustomReportOpen, setIsCustomReportOpen] = useState(false)
    const [selectedProbetasIds, setSelectedProbetasIds] = useState<number[]>([])
    const [generatingCustomReport, setGeneratingCustomReport] = useState(false)

    const printRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchTracingList()
    }, [fetchTracingList])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchTerm.trim()) {
            fetchTracing(searchTerm.trim())
            setIsDetailOpen(true)
        }
    }

    const handleSelectFromList = (numero: string) => {
        setSearchTerm(numero)
        fetchTracing(numero)
        setIsDetailOpen(true)
    }

    const handleDeleteClick = (e: React.MouseEvent, numero: string) => {
        e.stopPropagation()
        setDeleteTargetNumero(numero)
        setDeleteConfirmInput("")
        setIsDeleteConfirmOpen(true)
    }

    const handleDeleteTracing = async () => {
        if (!deleteTargetNumero) return
        const success = await deleteTracing(deleteTargetNumero)
        if (success) {
            setIsDeleteConfirmOpen(false)
            setDeleteTargetNumero(null)
            if (tracingData?.recepcion?.numero_recepcion === deleteTargetNumero) {
                setIsDetailOpen(false)
            }
        }
    }

    const handleOpenEnsayoDetail = async (ensayoId: number) => {
        setSelectedEnsayoId(ensayoId)
        setLoadingEnsayo(true)
        setIsEnsayoDetailOpen(true)
        setSelectedEnsayo(null)

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
            const res = await authFetch(`${API_URL}/api/compresion/ensayos/${ensayoId}`)
            if (!res.ok) {
                throw new Error("No se pudo obtener la información del ensayo.")
            }
            const data = await res.json()
            setSelectedEnsayo(data)
        } catch (err: any) {
            toast.error("Error al cargar ensayo", {
                description: err.message || "No se pudo conectar con el servidor.",
            })
            setIsEnsayoDetailOpen(false)
        } finally {
            setLoadingEnsayo(false)
        }
    }

    const handleOpenRecepcionDetail = async (recepcionId: string) => {
        setLoadingRecepcion(true)
        setIsRecepcionDetailOpen(true)
        setSelectedRecepcion(null)

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
            const res = await authFetch(`${API_URL}/api/recepcion/${recepcionId}`)
            if (!res.ok) {
                throw new Error("No se pudo obtener la información de la recepción.")
            }
            const data = await res.json()
            setSelectedRecepcion(data)
        } catch (err: any) {
            toast.error("Error al cargar recepción", {
                description: err.message || "No se pudo conectar con el servidor.",
            })
            setIsRecepcionDetailOpen(false)
        } finally {
            setLoadingRecepcion(false)
        }
    }

    const handleOpenVerificDetail = async (verificId: string) => {
        setLoadingVerific(true)
        setIsVerificDetailOpen(true)
        setSelectedVerific(null)

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
            const res = await authFetch(`${API_URL}/api/verificacion-muestras/${verificId}`)
            if (!res.ok) {
                throw new Error("No se pudo obtener la información de la verificación.")
            }
            const data = await res.json()
            setSelectedVerific(data)
        } catch (err: any) {
            toast.error("Error al cargar verificación", {
                description: err.message || "No se pudo conectar con el servidor.",
            })
            setIsVerificDetailOpen(false)
        } finally {
            setLoadingVerific(false)
        }
    }

    const handleDownloadReport = async (ensayoId: number) => {
        try {
            const toastId = toast.loading("Generando informe Excel...")
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
            const response = await authFetch(`${API_URL}/api/compresion/ensayos/${ensayoId}/excel`)
            if (!response.ok) throw new Error('Error al generar Excel del servidor')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            
            const contentDisposition = response.headers.get('content-disposition')
            let fileName = `Informe_Compresion_${ensayoId}.xlsx`
            if (contentDisposition && contentDisposition.includes('filename=')) {
                fileName = contentDisposition.split('filename=')[1].replace(/["']/g, '')
            }

            a.download = fileName
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast.dismiss(toastId)
            toast.success("Informe descargado con éxito")
        } catch (error: any) {
            toast.error("Error al descargar informe", { description: error.message })
        }
    }

    const handleOpenCustomReportModal = () => {
        setSelectedProbetasIds([])
        setIsCustomReportOpen(true)
    }

    const handleDownloadCustomReport = async () => {
        if (selectedProbetasIds.length === 0) {
            toast.warning("Selecciona probetas", { description: "Debes seleccionar al menos 1 probeta para generar el informe." })
            return
        }

        if (!selectedEnsayoId) return

        setGeneratingCustomReport(true)
        try {
            const toastId = toast.loading(`Generando informe con ${selectedProbetasIds.length} probetas...`)
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
            
            const response = await authFetch(`${API_URL}/api/compresion/ensayos/${selectedEnsayoId}/excel-custom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ muestra_ids: selectedProbetasIds })
            })

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}))
                throw new Error(errJson.detail || 'Error al generar informe personalizado')
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url

            const contentDisposition = response.headers.get('content-disposition')
            let fileName = `Informe_Compresion_Seleccion_${selectedEnsayoId}.xlsx`
            if (contentDisposition && contentDisposition.includes('filename=')) {
                fileName = contentDisposition.split('filename=')[1].replace(/["']/g, '')
            }

            a.download = fileName
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            
            toast.dismiss(toastId)
            toast.success("Informe descargado con éxito")
            setIsCustomReportOpen(false)
            
            if (selectedEnsayoId) {
                handleOpenEnsayoDetail(selectedEnsayoId)
            }
        } catch (error: any) {
            toast.error("Error al generar informe", { description: error.message })
        } finally {
            setGeneratingCustomReport(false)
        }
    }

    const filteredList = tracingList.filter(item =>
        item.numero_recepcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.proyecto.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const isSystemAdmin = user?.role === 'admin' || user?.role === 'superadmin'

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl border border-blue-800/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-1 relative z-10">
                    <div className="flex items-center gap-2">
                        <History className="h-6 w-6 text-blue-400" />
                        <h1 className="text-2xl font-black tracking-tight">Trazabilidad Integral de Muestras</h1>
                    </div>
                    <p className="text-xs text-blue-200/80 max-w-2xl font-normal">
                        Monitoreo en tiempo real del ciclo de vida de recepción, verificación dimensional, ensayos mecánicos y emisión de informes.
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por N° Recepción..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-blue-200/60 focus:bg-white/20 text-xs h-10 rounded-xl"
                            />
                        </div>
                        <Button type="submit" size="sm" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-10 px-4 rounded-xl text-xs shadow-md">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
                        </Button>
                    </form>
                    <Button variant="outline" size="icon" onClick={() => fetchTracingList()} disabled={loadingList} className="h-10 w-10 bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl">
                        <RefreshCw className={cn("h-4 w-4", loadingList && "animate-spin")} />
                    </Button>
                </div>
            </div>

            {/* List Table */}
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <LayoutList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Historial de Trazabilidad ({filteredList.length})
                        </h2>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/80 dark:bg-slate-900/80">
                                <TableHead className="font-bold text-xs">N° Recepción</TableHead>
                                <TableHead className="font-bold text-xs">Cliente / Proyecto</TableHead>
                                <TableHead className="font-bold text-xs text-center">Recepción</TableHead>
                                <TableHead className="font-bold text-xs text-center">Verificación</TableHead>
                                <TableHead className="font-bold text-xs text-center">Compresión</TableHead>
                                <TableHead className="font-bold text-xs text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingList ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500">Cargando registros...</p>
                                    </TableCell>
                                </TableRow>
                            ) : filteredList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12">
                                        <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-slate-700">Sin registros de trazabilidad</p>
                                        <p className="text-xs text-slate-500">No se encontraron recepciones en la base de datos.</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredList.map((row) => (
                                    <TableRow
                                        key={row.numero_recepcion}
                                        onClick={() => handleSelectFromList(row.numero_recepcion)}
                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                    >
                                        <TableCell className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                            {row.numero_recepcion}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                             <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-60">
                                                 {row.cliente || "Sin cliente"}
                                             </div>
                                             <div className="text-[10px] text-slate-500 truncate max-w-60">
                                                 {row.proyecto || "Sin proyecto"}
                                             </div>
                                         </TableCell>
                                        <TableCell className="text-center">
                                            {row.recepcion_completada ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px] font-bold">
                                                    Registrado
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 text-[10px]">
                                                    Pendiente
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.verificacion_completada ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px] font-bold">
                                                    Verificado
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 text-[10px]">
                                                    Pendiente
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.ensayo_compresion_completado ? (
                                                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-[10px] font-bold">
                                                    Ensayado ({row.muestras_ensayadas_count})
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 text-[10px]">
                                                    Pendiente
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSelectFromList(row.numero_recepcion)}
                                                    className="h-8 w-8 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                    title="Ver Trazabilidad"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {isSystemAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => handleDeleteClick(e, row.numero_recepcion)}
                                                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                        title="Eliminar Trazabilidad"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Modal Detail */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-slate-900 border-slate-800 text-white">
                    <DialogHeader className="p-6 border-b border-slate-800 bg-slate-950/60 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <History className="h-5 w-5 text-blue-400" />
                                Trazabilidad N° {tracingData?.recepcion?.numero_recepcion || searchTerm}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400 mt-1">
                                {tracingData?.recepcion?.cliente || "Cliente"} — {tracingData?.recepcion?.proyecto || "Proyecto"}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    {loading ? (
                        <div className="py-20 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                            <p className="text-xs text-slate-400">Consultando flujo de datos...</p>
                        </div>
                    ) : tracingData ? (
                        <div className="p-6 space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card
                                    onClick={() => tracingData.recepcion?.id && handleOpenRecepcionDetail(tracingData.recepcion.id)}
                                    className="bg-slate-800/60 border-slate-700/60 text-white p-4 cursor-pointer hover:border-blue-500/60 hover:bg-slate-800 transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Etapa 1: Recepción</span>
                                        <FileText className="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div className="text-base font-bold truncate">{tracingData.recepcion?.numero_recepcion || "-"}</div>
                                    <p className="text-xs text-slate-400 mt-1">Muestras: {tracingData.recepcion?.muestras_count || 0}</p>
                                </Card>

                                <Card
                                    onClick={() => tracingData.verificacion?.id && handleOpenVerificDetail(tracingData.verificacion.id)}
                                    className="bg-slate-800/60 border-slate-700/60 text-white p-4 cursor-pointer hover:border-emerald-500/60 hover:bg-slate-800 transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Etapa 2: Verificación</span>
                                        <FlaskConical className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div className="text-base font-bold">
                                        {tracingData.verificacion ? "Verificado" : "Pendiente"}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {tracingData.verificacion?.fecha_verificacion ? `Fecha: ${tracingData.verificacion.fecha_verificacion}` : "Sin verificar"}
                                    </p>
                                </Card>

                                <Card className="bg-slate-800/60 border-slate-700/60 text-white p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Etapa 3: Compresión</span>
                                        <Zap className="h-4 w-4 text-amber-400" />
                                    </div>
                                    <div className="text-base font-bold">
                                        {tracingData.ensayo_compresion ? "Ensayos Realizados" : "Sin Ensayos"}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {tracingData.ensayo_compresion?.items?.length || 0} roturas registradas
                                    </p>
                                </Card>
                            </div>

                            {/* Ensayos List if available */}
                            {tracingData.ensayos && tracingData.ensayos.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-400" />
                                        Ensayos de Compresión ({tracingData.ensayos.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {tracingData.ensayos.map((ensayo: any) => (
                                            <div
                                                key={ensayo.id}
                                                onClick={() => handleOpenEnsayoDetail(ensayo.id)}
                                                className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 cursor-pointer hover:bg-slate-800 hover:border-blue-500/50 transition-all flex justify-between items-center"
                                            >
                                                <div>
                                                    <div className="font-mono font-bold text-sm text-blue-400">
                                                        Ensayo N° {ensayo.id}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        Fecha: {ensayo.fecha_ensayo || "N/A"}
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="ghost" className="text-xs text-blue-400 hover:text-white">
                                                    Ver Detalle <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-slate-400 text-xs">
                            No se encontró información para el número ingresado.
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal Detail Ensayo */}
            <Dialog open={isEnsayoDetailOpen} onOpenChange={setIsEnsayoDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-800 text-white rounded-2xl">
                    <DialogHeader className="border-b border-slate-800 pb-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <DialogTitle className="text-lg font-bold text-blue-400">
                                    Detalle de Ensayo de Compresión N° {selectedEnsayoId}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-400">
                                    Valores de rotura y resistencia probetas de concreto
                                </DialogDescription>
                            </div>
                            {selectedEnsayoId && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleOpenCustomReportModal}
                                        className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 text-xs h-8"
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                                        Seleccionar Probetas
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleDownloadReport(selectedEnsayoId)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                                    >
                                        <Download className="h-3.5 w-3.5 mr-1" />
                                        Descargar Completo
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    {loadingEnsayo ? (
                        <div className="py-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">Cargando datos del ensayo...</p>
                        </div>
                    ) : selectedEnsayo ? (
                        <div className="space-y-4 pt-2">
                            <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-indigo-500/10 p-4 rounded-xl border border-blue-500/20 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase">Realizado Por:</span>
                                    <span className="font-bold">{selectedEnsayo.realizado_por || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase">Revisado Por:</span>
                                    <span className="font-bold">{selectedEnsayo.revisado_por || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase">Aprobado Por:</span>
                                    <span className="font-bold">{selectedEnsayo.aprobado_por || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase">Fecha Ensayo:</span>
                                    <span className="font-bold">{selectedEnsayo.fecha_ensayo || "-"}</span>
                                </div>
                            </div>

                            {/* Table Items */}
                            <div className="border border-slate-800 rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-800/80">
                                        <TableRow>
                                            <TableHead className="text-xs font-bold text-slate-300">Cód. LEM</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-300">Muestra</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-300 text-center">f'c (kg/cm²)</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-300 text-center">Edad (Días)</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-300 text-right">Carga (kN)</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-300 text-right">Resistencia %</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(selectedEnsayo.items || []).map((item: any) => (
                                            <TableRow key={item.id} className="border-slate-800 hover:bg-slate-800/40">
                                                <TableCell className="font-mono text-xs font-bold text-blue-400">{item.codigo_lem || "-"}</TableCell>
                                                <TableCell className="text-xs text-slate-200">{item.identificacion_muestra || "-"}</TableCell>
                                                <TableCell className="text-xs text-center font-bold">{item.fc_kg_cm2 || "-"}</TableCell>
                                                <TableCell className="text-xs text-center">{item.edad_dias || "-"}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{item.carga_maxima ? item.carga_maxima.toFixed(2) : "-"}</TableCell>
                                                <TableCell className="text-xs text-right font-bold text-emerald-400">{item.porcentaje_resistencia ? `${item.porcentaje_resistencia.toFixed(1)}%` : "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Modal Detail Recepcion */}
            <Dialog open={isRecepcionDetailOpen} onOpenChange={setIsRecepcionDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-800 text-white rounded-2xl">
                    <DialogHeader className="border-b border-slate-800 pb-4">
                        <DialogTitle className="text-lg font-bold text-blue-400">
                            Detalle de Recepción N° {selectedRecepcion?.numero_recepcion || ""}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-400">
                            Registro de ingreso de muestras al laboratorio
                        </DialogDescription>
                    </DialogHeader>

                    {loadingRecepcion ? (
                        <div className="py-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                            <p className="text-xs text-slate-400">Cargando datos de recepción...</p>
                        </div>
                    ) : selectedRecepcion ? (
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase">Cliente:</span>
                                    <span className="font-bold">{selectedRecepcion.cliente || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block text-[10px] uppercase">Proyecto:</span>
                                    <span className="font-bold">{selectedRecepcion.proyecto || "-"}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Modal Custom Report */}
            <Dialog open={isCustomReportOpen} onOpenChange={setIsCustomReportOpen}>
                <DialogContent className="max-w-2xl bg-white border-slate-200 text-slate-900 rounded-2xl p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                        <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                            Generar Informe Personalizado
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Selecciona hasta 6 probetas de concreto para incluir en el informe de compresión.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow>
                                        <TableHead className="w-10 text-center font-bold">Sel.</TableHead>
                                        <TableHead className="w-10 text-center font-bold text-xs">#</TableHead>
                                        <TableHead className="text-xs font-bold">Cód. LEM</TableHead>
                                        <TableHead className="text-xs font-bold">Identificación</TableHead>
                                        <TableHead className="text-xs font-bold">Estructura</TableHead>
                                        <TableHead className="text-xs font-bold text-center">f'c</TableHead>
                                        <TableHead className="text-xs font-bold text-center">Moldeo</TableHead>
                                        <TableHead className="text-xs font-bold text-center">Rotura</TableHead>
                                        <TableHead className="text-xs font-bold text-center">Ø (cm)</TableHead>
                                        <TableHead className="text-xs font-bold text-center">Carga (kN)</TableHead>
                                        <TableHead className="text-xs font-bold text-center">Estado</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedEnsayo?.items?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={11} className="text-center py-6 text-xs text-slate-400">
                                                No hay probetas disponibles en este ensayo.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        selectedEnsayo?.items?.map((m: any, idx: number) => {
                                            const isSelected = selectedProbetasIds.includes(m.id);
                                            const isReported = Boolean(m.informe_generado);
                                            return (
                                                <TableRow 
                                                    key={m.id} 
                                                    className={cn(
                                                        "cursor-pointer transition-colors",
                                                        isSelected ? "bg-blue-50/80 font-medium" : "hover:bg-slate-50"
                                                    )}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedProbetasIds(prev => prev.filter(id => id !== m.id));
                                                        } else {
                                                            if (selectedProbetasIds.length >= 6) {
                                                                 toast.warning("Límite máximo", { description: "Solo puedes agregar un máximo de 6 probetas por informe." });
                                                                 return;
                                                            }
                                                            setSelectedProbetasIds(prev => [...prev, m.id]);
                                                        }
                                                    }}
                                                >
                                                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input 
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    if (selectedProbetasIds.length >= 6) {
                                                                        toast.warning("Límite máximo", { description: "Solo puedes agregar un máximo de 6 probetas por informe." });
                                                                        return;
                                                                    }
                                                                    setSelectedProbetasIds(prev => [...prev, m.id]);
                                                                } else {
                                                                    setSelectedProbetasIds(prev => prev.filter(id => id !== m.id));
                                                                }
                                                            }}
                                                            className="rounded border-slate-300 text-green-600 focus:ring-green-500 h-4 w-4"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-400 text-center">{m.item_numero || idx + 1}</TableCell>
                                                    <TableCell className="text-xs font-bold text-[#0070F3]">
                                                        {m.codigo_muestra_lem || m.codigo_muestra || m.codigo_lem || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-semibold text-slate-700">
                                                        {m.codigo_muestra || m.identificacion_muestra || '-'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs max-w-37.5 truncate" title={m.estructura}>
                                                        {m.estructura || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-slate-800 text-center">{m.fc_kg_cm2 || '210'}</TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-600 text-center">{m.fecha_moldeo}</TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-600 text-center">{m.fecha_rotura || '-'}</TableCell>
                                                    <TableCell className="text-xs font-medium text-slate-700 text-center">
                                                        {m.diametro_1 !== null && m.diametro_1 !== undefined ? m.diametro_1.toFixed(2).replace('.', ',') : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium text-slate-700 text-center">
                                                        {m.carga_maxima !== null && m.carga_maxima !== undefined ? m.carga_maxima.toFixed(2).replace('.', ',') : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isReported ? (
                                                            <Badge variant="outline" className="text-[9px] font-black uppercase text-green-700 bg-green-100 border-none px-2 py-0.5">
                                                                Descargado
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 border-none px-2 py-0.5">
                                                                Pendiente
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div className="p-4 border-t bg-slate-50 flex justify-end gap-2.5 shrink-0">
                        <Button variant="outline" onClick={() => setIsCustomReportOpen(false)} className="font-bold text-slate-700 h-9 text-xs rounded-xl px-5">
                            Cancelar
                        </Button>
                        <Button 
                            variant="default"
                            disabled={generatingCustomReport || selectedProbetasIds.length === 0}
                            className="bg-[#0070F3] hover:bg-[#005bc5] text-white font-bold gap-2 px-6 h-9 text-xs rounded-xl shadow-md shadow-blue-500/10"
                            onClick={handleDownloadCustomReport}
                        >
                            {generatingCustomReport ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Generando informe...
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5" />
                                    Descargar Excel ({selectedProbetasIds.length})
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ModernConfirmDialog
                open={isDeleteConfirmOpen}
                onOpenChange={setIsDeleteConfirmOpen}
                onConfirm={handleDeleteTracing}
                title="Eliminar Registro de Trazabilidad"
                description={`¿Estás seguro de que deseas eliminar el registro ${deleteTargetNumero}? Esta acción es permanente y no se puede deshacer.`}
                confirmText="Eliminar permanentemente"
                showInput={true}
                expectedValue="ELIMINAR"
                inputValue={deleteConfirmInput}
                onInputChange={setDeleteConfirmInput}
                inputPlaceholder="Escribe ELIMINAR para confirmar"
            />
        </div>
    )
}
