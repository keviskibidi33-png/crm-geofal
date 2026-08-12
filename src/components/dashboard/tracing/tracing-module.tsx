"use client"

import { useState, useEffect, useMemo } from "react"
import { useTracing } from "@/hooks/use-tracing"
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
    History,
    X,
    ChevronLeft,
    Sparkles
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

type FilterTab = "all" | "recepcion" | "verificacion" | "compresion"

export function TracingModule() {
    const { user } = useAuth()
    const { tracingData: rawTracingData, tracingList: rawTracingList, loading, loadingList, fetchTracing, fetchTracingList, deleteTracing } = useTracing()
    const tracingData = rawTracingData as any
    const tracingList = (rawTracingList || []) as any[]
    
    // State
    const [searchTerm, setSearchTerm] = useState("")
    const [activeTab, setActiveTab] = useState<FilterTab>("all")
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Modals state
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

    useEffect(() => {
        fetchTracingList()
    }, [fetchTracingList])

    // Reset pagination when search or tab changes
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, activeTab])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchTerm.trim()) {
            fetchTracing(searchTerm.trim())
            setIsDetailOpen(true)
        }
    }

    const handleClearSearch = () => {
        setSearchTerm("")
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
            toast.success("Registro de trazabilidad eliminado")
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

    // Counts by tab
    const tabCounts = useMemo(() => {
        const total = tracingList.length
        const recepcion = tracingList.filter(i => i.recepcion_completada).length
        const verificacion = tracingList.filter(i => i.verificacion_completada).length
        const compresion = tracingList.filter(i => i.ensayo_compresion_completado).length
        return { total, recepcion, verificacion, compresion }
    }, [tracingList])

    // Filtered list by Search and Tabs
    const filteredList = useMemo(() => {
        return tracingList.filter(item => {
            const query = searchTerm.toLowerCase().trim()
            const matchesSearch = !query || 
                item.numero_recepcion.toLowerCase().includes(query) ||
                (item.cliente && item.cliente.toLowerCase().includes(query)) ||
                (item.proyecto && item.proyecto.toLowerCase().includes(query))

            if (!matchesSearch) return false

            if (activeTab === "recepcion") return item.recepcion_completada
            if (activeTab === "verificacion") return item.verificacion_completada
            if (activeTab === "compresion") return item.ensayo_compresion_completado

            return true
        })
    }, [tracingList, searchTerm, activeTab])

    // Pagination calculations
    const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1
    const paginatedList = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage
        return filteredList.slice(start, start + itemsPerPage)
    }, [filteredList, currentPage, itemsPerPage])

    const isSystemAdmin = user?.role === 'admin' || user?.role === 'superadmin'

    // Compute progress percentage for tracing detail
    const detailProgress = useMemo(() => {
        if (!tracingData) return 0
        let steps = 0
        if (tracingData.recepcion) steps += 1
        if (tracingData.verificacion) steps += 1
        if (tracingData.ensayo_compresion || (tracingData.ensayos && tracingData.ensayos.length > 0)) steps += 1
        return Math.round((steps / 3) * 100)
    }, [tracingData])

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-10">
            {/* Header GitHub Primer Style */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 dark:bg-slate-950 text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="space-y-1.5 relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <History className="h-5 w-5" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                            Trazabilidad Integral de Muestras
                            <Badge variant="outline" className="bg-blue-500/10 border-blue-400/30 text-blue-300 text-[10px] font-semibold">
                                <Sparkles className="w-3 h-3 mr-1 text-blue-400 inline" />
                                En Tiempo Real
                            </Badge>
                        </h1>
                    </div>
                    <p className="text-xs text-slate-300/80 max-w-2xl font-normal leading-relaxed">
                        Control continuo del ciclo de laboratorio: recepción de muestras, verificación dimensional y ensayos mecánicos de compresión.
                    </p>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por N° Recepción, Cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-8 bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-800 text-xs h-9 rounded-xl focus:ring-1 focus:ring-blue-500"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <Button type="submit" size="sm" disabled={loading} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold h-9 px-4 rounded-xl text-xs shadow-md border border-blue-500/30">
                            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
                        </Button>
                    </form>
                    
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => fetchTracingList()} 
                        disabled={loadingList} 
                        className="h-9 w-9 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 rounded-xl"
                        title="Recargar lista"
                    >
                        <RefreshCw className={cn("h-4 w-4", loadingList && "animate-spin text-blue-400")} />
                    </Button>
                </div>
            </div>

            {/* List Table Card */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs rounded-2xl overflow-hidden">
                {/* Header & Filter Tabs (GitHub Style) */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <LayoutList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Historial de Trazabilidad
                        </h2>
                        <Badge variant="secondary" className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] px-2 py-0.5">
                            {filteredList.length}
                        </Badge>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={cn(
                                "px-3 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5",
                                activeTab === "all"
                                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            Todos
                            <span className="text-[10px] opacity-75 font-mono">({tabCounts.total})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("recepcion")}
                            className={cn(
                                "px-3 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5",
                                activeTab === "recepcion"
                                    ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs font-semibold"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Recepcionados
                            <span className="text-[10px] opacity-75 font-mono">({tabCounts.recepcion})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("verificacion")}
                            className={cn(
                                "px-3 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5",
                                activeTab === "verificacion"
                                    ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs font-semibold"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Verificados
                            <span className="text-[10px] opacity-75 font-mono">({tabCounts.verificacion})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("compresion")}
                            className={cn(
                                "px-3 py-1 rounded-lg font-medium transition-all text-xs flex items-center gap-1.5",
                                activeTab === "compresion"
                                    ? "bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-xs font-semibold"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Ensayados
                            <span className="text-[10px] opacity-75 font-mono">({tabCounts.compresion})</span>
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-100/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800">
                                <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">N° Recepción</TableHead>
                                <TableHead className="font-semibold text-xs text-slate-700 dark:text-slate-300">Cliente / Proyecto</TableHead>
                                <TableHead className="font-semibold text-xs text-center text-slate-700 dark:text-slate-300">Recepción</TableHead>
                                <TableHead className="font-semibold text-xs text-center text-slate-700 dark:text-slate-300">Verificación</TableHead>
                                <TableHead className="font-semibold text-xs text-center text-slate-700 dark:text-slate-300">Compresión</TableHead>
                                <TableHead className="font-semibold text-xs text-right text-slate-700 dark:text-slate-300">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingList ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-16">
                                        <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Cargando registros de trazabilidad...</p>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-16">
                                        <AlertCircle className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sin registros de trazabilidad</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                                            {searchTerm || activeTab !== "all" 
                                                ? "No se encontraron coincidencias para los filtros o búsqueda especificados." 
                                                : "No hay recepciones registradas en el sistema actualmente."}
                                        </p>
                                        {(searchTerm || activeTab !== "all") && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { setSearchTerm(""); setActiveTab("all"); }}
                                                className="mt-3 text-xs rounded-xl border-slate-300 dark:border-slate-700"
                                            >
                                                Limpiar Filtros
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedList.map((row) => (
                                    <TableRow
                                        key={row.numero_recepcion}
                                        onClick={() => handleSelectFromList(row.numero_recepcion)}
                                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border-slate-100 dark:border-slate-800/80"
                                    >
                                        <TableCell className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                                            {row.numero_recepcion}
                                        </TableCell>
                                        <TableCell className="text-xs">
                                             <div className="font-medium text-slate-900 dark:text-slate-100 truncate max-w-64">
                                                 {row.cliente || "Sin cliente"}
                                             </div>
                                             <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-64">
                                                 {row.proyecto || "Sin proyecto"}
                                             </div>
                                         </TableCell>
                                        <TableCell className="text-center">
                                            {row.recepcion_completada ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-semibold rounded-full px-2.5 py-0.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                                                    Registrado
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 text-[10px] font-normal rounded-full px-2.5 py-0.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-1.5 inline-block" />
                                                    Pendiente
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.verificacion_completada ? (
                                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-semibold rounded-full px-2.5 py-0.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                                                    Verificado
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 text-[10px] font-normal rounded-full px-2.5 py-0.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-1.5 inline-block" />
                                                    Pendiente
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {row.ensayo_compresion_completado ? (
                                                <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 text-[10px] font-semibold rounded-full px-2.5 py-0.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 inline-block" />
                                                    Ensayado ({row.muestras_ensayadas_count || 0})
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 text-[10px] font-normal rounded-full px-2.5 py-0.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-1.5 inline-block" />
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
                                                    className="h-8 w-8 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                                    title="Ver Trazabilidad"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {isSystemAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => handleDeleteClick(e, row.numero_recepcion)}
                                                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
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

                {/* Footer Pagination (GitHub Style) */}
                {filteredList.length > 0 && (
                    <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <div>
                            Mostrando <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredList.length)}</span> - <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredList.length)}</span> de <span className="font-semibold text-slate-800 dark:text-slate-200">{filteredList.length}</span> registros
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                className="h-8 text-xs rounded-xl px-3 border-slate-200 dark:border-slate-800"
                            >
                                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                                Anterior
                            </Button>
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-1">
                                {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="h-8 text-xs rounded-xl px-3 border-slate-200 dark:border-slate-800"
                            >
                                Siguiente
                                <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Modal Detail (Adaptive Theme) */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl">
                    <DialogHeader className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                                <History className="h-5 w-5 text-blue-500" />
                                Trazabilidad N° {tracingData?.recepcion?.numero_recepcion || searchTerm}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {tracingData?.recepcion?.cliente || "Cliente"} — {tracingData?.recepcion?.proyecto || "Proyecto"}
                            </DialogDescription>
                        </div>

                        {tracingData && (
                            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-mono text-xs">
                                Progreso: {detailProgress}%
                            </Badge>
                        )}
                    </DialogHeader>

                    {loading ? (
                        <div className="py-20 text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
                            <p className="text-xs text-slate-500 dark:text-slate-400">Consultando el flujo de trazabilidad...</p>
                        </div>
                    ) : tracingData ? (
                        <div className="p-6 space-y-6">
                            {/* Step Progress Line */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    <span>Etapas del Proceso</span>
                                    <span>{detailProgress}% Completado</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                        className={cn(
                                            "h-full transition-all duration-500 rounded-full",
                                            detailProgress === 100 ? "bg-emerald-500" : detailProgress > 33 ? "bg-blue-500" : "bg-amber-500"
                                        )}
                                        style={{ width: `${detailProgress}%` }}
                                    />
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card
                                    onClick={() => tracingData.recepcion?.id && handleOpenRecepcionDetail(tracingData.recepcion.id)}
                                    className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 p-4 cursor-pointer hover:border-blue-500/60 dark:hover:border-blue-500/60 transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Etapa 1: Recepción</span>
                                        <FileText className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white truncate">
                                        {tracingData.recepcion?.numero_recepcion || "-"}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Muestras: <span className="font-semibold text-slate-800 dark:text-slate-200">{tracingData.recepcion?.muestras_count || 0}</span>
                                    </p>
                                </Card>

                                <Card className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Etapa 2: Verificación</span>
                                        <FlaskConical className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white">
                                        {tracingData.verificacion ? "Verificado" : "Pendiente"}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {tracingData.verificacion?.fecha_verificacion ? `Fecha: ${tracingData.verificacion.fecha_verificacion}` : "Sin verificar"}
                                    </p>
                                </Card>

                                <Card className="bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/60 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Etapa 3: Compresión</span>
                                        <Zap className="h-4 w-4 text-amber-500" />
                                    </div>
                                    <div className="text-base font-bold text-slate-900 dark:text-white">
                                        {tracingData.ensayo_compresion || (tracingData.ensayos && tracingData.ensayos.length > 0) ? "Ensayos Realizados" : "Sin Ensayos"}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {tracingData.ensayos?.length || 0} ensayos registrados
                                    </p>
                                </Card>
                            </div>

                            {/* Ensayos List if available */}
                            {tracingData.ensayos && tracingData.ensayos.length > 0 && (
                                <div className="space-y-3 pt-2">
                                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-500" />
                                        Ensayos de Compresión ({tracingData.ensayos.length})
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {tracingData.ensayos.map((ensayo: any) => (
                                            <div
                                                key={ensayo.id}
                                                onClick={() => handleOpenEnsayoDetail(ensayo.id)}
                                                className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-xl p-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-blue-500/50 transition-all flex justify-between items-center group"
                                            >
                                                <div>
                                                    <div className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                                                        Ensayo N° {ensayo.id}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Fecha: {ensayo.fecha_ensayo || "N/A"}
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="ghost" className="text-xs text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform">
                                                    Ver Detalle <ChevronRight className="h-4 w-4 ml-1" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-slate-500 dark:text-slate-400 text-xs">
                            No se encontró información para el número ingresado.
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal Detail Ensayo (Adaptive Theme) */}
            <Dialog open={isEnsayoDetailOpen} onOpenChange={setIsEnsayoDetailOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl">
                    <DialogHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <DialogTitle className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                    Detalle de Ensayo de Compresión N° {selectedEnsayoId}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                                    Valores de rotura y resistencia de probetas de concreto
                                </DialogDescription>
                            </div>
                            {selectedEnsayoId && (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleOpenCustomReportModal}
                                        className="bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs h-8 rounded-xl"
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                                        Seleccionar Probetas
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleDownloadReport(selectedEnsayoId)}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 rounded-xl"
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
                            <p className="text-xs text-slate-500 dark:text-slate-400">Cargando datos del ensayo...</p>
                        </div>
                    ) : selectedEnsayo ? (
                        <div className="space-y-4 pt-2">
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Realizado Por:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEnsayo.realizado_por || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Revisado Por:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEnsayo.revisado_por || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Aprobado Por:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEnsayo.aprobado_por || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Fecha Ensayo:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedEnsayo.fecha_ensayo || "-"}</span>
                                </div>
                            </div>

                            {/* Table Items */}
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-100 dark:bg-slate-800/80">
                                        <TableRow>
                                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Cód. LEM</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Muestra</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">f'c (kg/cm²)</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Edad (Días)</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 text-right">Carga (kN)</TableHead>
                                            <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 text-right">Resistencia %</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(selectedEnsayo.items || []).map((item: any) => (
                                            <TableRow key={item.id} className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                                <TableCell className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{item.codigo_lem || "-"}</TableCell>
                                                <TableCell className="text-xs text-slate-800 dark:text-slate-200">{item.identificacion_muestra || "-"}</TableCell>
                                                <TableCell className="text-xs text-center font-bold">{item.fc_kg_cm2 || "-"}</TableCell>
                                                <TableCell className="text-xs text-center">{item.edad_dias || "-"}</TableCell>
                                                <TableCell className="text-xs text-right font-mono">{item.carga_maxima ? item.carga_maxima.toFixed(2) : "-"}</TableCell>
                                                <TableCell className="text-xs text-right font-bold text-emerald-600 dark:text-emerald-400">{item.porcentaje_resistencia ? `${item.porcentaje_resistencia.toFixed(1)}%` : "-"}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Modal Detail Recepcion (Adaptive Theme) */}
            <Dialog open={isRecepcionDetailOpen} onOpenChange={setIsRecepcionDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl">
                    <DialogHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
                        <DialogTitle className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            Detalle de Recepción N° {selectedRecepcion?.numero_recepcion || ""}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                            Registro de ingreso de muestras al laboratorio
                        </DialogDescription>
                    </DialogHeader>

                    {loadingRecepcion ? (
                        <div className="py-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500 mx-auto mb-2" />
                            <p className="text-xs text-slate-500 dark:text-slate-400">Cargando datos de recepción...</p>
                        </div>
                    ) : selectedRecepcion ? (
                        <div className="space-y-4 pt-2">
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700/50 text-xs">
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Cliente:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRecepcion.cliente || "-"}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Proyecto:</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRecepcion.proyecto || "-"}</span>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* Modal Custom Report (Adaptive Theme) */}
            <Dialog open={isCustomReportOpen} onOpenChange={setIsCustomReportOpen}>
                <DialogContent className="max-w-3xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl p-0 overflow-hidden shadow-2xl">
                    <DialogHeader className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                        <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            Generar Informe Personalizado
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                            Selecciona hasta 6 probetas de concreto para incluir en el informe de compresión.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-6 space-y-4">
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10">
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
                                            <TableCell colSpan={11} className="text-center py-8 text-xs text-slate-400">
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
                                                        "cursor-pointer transition-colors border-slate-100 dark:border-slate-800",
                                                        isSelected ? "bg-blue-50/80 dark:bg-blue-950/40 font-medium" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
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
                                                            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-400 text-center">{m.item_numero || idx + 1}</TableCell>
                                                    <TableCell className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                        {m.codigo_muestra_lem || m.codigo_muestra || m.codigo_lem || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                        {m.codigo_muestra || m.identificacion_muestra || '-'}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs max-w-36 truncate" title={m.estructura}>
                                                        {m.estructura || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-black text-slate-800 dark:text-slate-200 text-center">{m.fc_kg_cm2 || '210'}</TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-600 dark:text-slate-400 text-center">{m.fecha_moldeo}</TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-600 dark:text-slate-400 text-center">{m.fecha_rotura || '-'}</TableCell>
                                                    <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">
                                                        {m.diametro_1 !== null && m.diametro_1 !== undefined ? m.diametro_1.toFixed(2).replace('.', ',') : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center">
                                                        {m.carga_maxima !== null && m.carga_maxima !== undefined ? m.carga_maxima.toFixed(2).replace('.', ',') : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        {isReported ? (
                                                            <Badge variant="outline" className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                                                                Descargado
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[9px] font-black uppercase text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
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

                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-2.5 shrink-0">
                        <Button variant="outline" onClick={() => setIsCustomReportOpen(false)} className="font-bold text-slate-700 dark:text-slate-300 h-9 text-xs rounded-xl px-5 border-slate-300 dark:border-slate-700">
                            Cancelar
                        </Button>
                        <Button 
                            variant="default"
                            disabled={generatingCustomReport || selectedProbetasIds.length === 0}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 px-6 h-9 text-xs rounded-xl shadow-md"
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

            {/* Confirm Dialog */}
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
