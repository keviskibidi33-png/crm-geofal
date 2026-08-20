"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRecepciones, Recepcion } from "@/hooks/use-recepciones"
import { Plus, Search, RefreshCw, Trash2, FileSpreadsheet, Eye, Pencil, Loader2, Upload, ChevronLeft, ChevronRight, Building2, Mountain, Gem, Boxes, Droplets, Sparkles, Check, Mail, FileText, MoreHorizontal, Download } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"

import { authFetch } from "@/lib/api-auth"
import { formatOtDisplay } from "@/lib/utils"
import { OrdenForm } from "./recepcion-native/OrdenForm"
import { OrdenDetail } from "./recepcion-native/OrdenDetail"
import { RecepcionEmailModal } from "./recepcion-native/RecepcionEmailModal"
import { OTForm, type OTData } from "./ot-native/OTForm"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface RecepcionModuleProps {
    focusRecepcionId?: number | null
    onFocusHandled?: () => void
    scope?: "concreto" | "lima" | "all"
    onNavigateToOTConcreto?: (numRecepcion: string) => void
}

export function RecepcionModule({ focusRecepcionId, onFocusHandled, scope = "all", onNavigateToOTConcreto }: RecepcionModuleProps) {
    const { recepciones, loading, pagination, fetchRecepciones, refreshRecepciones, getRecepcionById, deleteRecepcion } = useRecepciones()
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
    const initialSelectedTipo = scope === "concreto" ? "CONCRETO" : scope === "lima" ? "LIMA_ALL" : "ALL"
    const [selectedTipo, setSelectedTipo] = useState<string>(initialSelectedTipo)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
    const [selectedEmailRecepcion, setSelectedEmailRecepcion] = useState<Recepcion | null>(null)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [isImportTypeModalOpen, setIsImportTypeModalOpen] = useState(false)
    const [selectedImportTipo, setSelectedImportTipo] = useState<string>("AUTO")
    const [importedData, setImportedData] = useState<any>(null)
    const [isOTModalOpen, setIsOTModalOpen] = useState(false)
    const [selectedOTData, setSelectedOTData] = useState<OTData | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Recepcion | null>(null)
    const [downloadingOtId, setDownloadingOtId] = useState<number | string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const lastFocusedRecepcionIdRef = useRef<number | null>(null)
    const { user } = useAuth()
    const canWrite = user?.role === "admin" || user?.permissions?.recepcion?.write === true || user?.permissions?.recepcion_lima?.write === true
    const canDelete = user?.role === "admin" || user?.permissions?.recepcion?.delete === true || user?.permissions?.recepcion_lima?.delete === true

    const allowedTipos = scope === "concreto" 
        ? ["CONCRETO"] 
        : scope === "lima" 
            ? ["SUELO_AGREGADO", "ROCA", "ALBANILERIA", "AGUA"] 
            : undefined
    const defaultTipo = scope === "concreto" ? "CONCRETO" : "SUELO_AGREGADO"

    // Sincronizar selectedTipo cuando cambia el scope
    useEffect(() => {
        const nextTipo = scope === "concreto" ? "CONCRETO" : scope === "lima" ? "LIMA_ALL" : "ALL"
        setSelectedTipo(nextTipo)
        setCurrentPage(1)
        setSearchTerm("")
        setDebouncedSearchTerm("")
    }, [scope])

    const refreshCurrentPage = useCallback(() => {
        void fetchRecepciones({
            page: currentPage,
            pageSize,
            search: debouncedSearchTerm,
            tipo_recepcion: selectedTipo,
        })
    }, [currentPage, debouncedSearchTerm, fetchRecepciones, pageSize, selectedTipo])

    // Debounce search to avoid request spam and reset to first page.
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1)
            setDebouncedSearchTerm(searchTerm.trim())
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Real server-side pagination + search + tipo_recepcion filter.
    useEffect(() => {
        void fetchRecepciones({
            page: currentPage,
            pageSize,
            search: debouncedSearchTerm,
            tipo_recepcion: selectedTipo,
        })
    }, [currentPage, debouncedSearchTerm, fetchRecepciones, pageSize, selectedTipo])

    // Refresh when modal closes
    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            if (editId) {
                setShowExitConfirm(true)
            } else {
                setIsModalOpen(false)
                setEditId(null)
                setImportedData(null)
            }
        } else {
            setIsModalOpen(true)
        }
    }

    const confirmCloseModal = () => {
        setShowExitConfirm(false)
        setIsModalOpen(false)
        setEditId(null)
        setImportedData(null)
    }

    const handleCreateNew = () => {
        setEditId(null)
        setImportedData(null)
        setIsModalOpen(true)
    }

    const handleEdit = (recepcion: Recepcion) => {
        setIsDetailOpen(false)
        setImportedData(null)
        setEditId(recepcion.id)
        setIsModalOpen(true)
    }

    const handleViewDetail = async (id: number) => {
        setIsDetailLoading(true)
        setIsDetailOpen(true)
        try {
            const data = await getRecepcionById(id)
            setSelectedRecepcion(data)
        } catch {
            toast.error("No se pudo cargar el detalle de la recepción")
            setIsDetailOpen(false)
        } finally {
            setIsDetailLoading(false)
        }
    }

    useEffect(() => {
        if (!focusRecepcionId) return
        if (lastFocusedRecepcionIdRef.current === focusRecepcionId) return

        lastFocusedRecepcionIdRef.current = focusRecepcionId
        void handleViewDetail(focusRecepcionId)

        if (onFocusHandled) {
            onFocusHandled()
        }
    }, [focusRecepcionId, onFocusHandled])

    const handleDelete = async (id: number) => {
        try {
            await deleteRecepcion(id)
            toast.success("Recepción eliminada correctamente")
            refreshCurrentPage()
        } catch {
            toast.error("Error al eliminar la recepción")
        }
    }

    const handleDownloadExcel = async (item: Recepcion) => {
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const response = await authFetch(`${API_URL}/api/recepcion/${item.id}/excel`, {
                headers: {
                    Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                },
            })

            if (!response.ok) throw new Error("Error al descargar Excel")

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url

            const disposition = response.headers.get("Content-Disposition")
            let filename = `REC N-${item.numero_recepcion || item.numero_ot || item.id} ${item.cliente || ""}.xlsx`.trim()
            if (disposition) {
                const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
                if (match && match[1]) {
                    filename = match[1].replace(/['"]/g, "")
                }
            }
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast.success("Excel descargado correctamente")
        } catch {
            toast.error("No se pudo descargar el archivo Excel")
        }
    }

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsImporting(true)
        const formData = new FormData()
        formData.append("file", file)

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const response = await authFetch(`${API_URL}/api/recepcion/import-excel`, {
                method: "POST",
                body: formData,
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => null)
                throw new Error(errData?.detail || "Error al procesar el archivo Excel")
            }

            const resData = await response.json()
            // Backend returns parsed data directly at root level (not wrapped in { data: ... })
            const payloadData = (resData && typeof resData === 'object' && !Array.isArray(resData))
                ? resData
                : {}
            if (selectedImportTipo && selectedImportTipo !== "AUTO") {
                payloadData.tipo_recepcion = selectedImportTipo
            }
            toast.success("Excel leído correctamente. Revisa los datos en el formulario.")

            setImportedData(payloadData)
            setEditId(null)
            setIsModalOpen(true)
        } catch (err: any) {
            console.error("Import error:", err)
            toast.error(err.message || "No se pudo importar la recepción desde Excel")
        } finally {
            setIsImporting(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ""
            }
        }
    }

    const handleOpenOT = async (numeroRecepcion: string, numeroOt?: string) => {
        if (!numeroRecepcion) {
            toast.warning("La recepción no tiene un número asignado.")
            return
        }
        setSelectedOTRecepcionNum(numeroRecepcion)
        setSelectedOTData(null)
        setIsOTModalOpen(true)

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const numParam = numeroOt || numeroRecepcion
            const res = await authFetch(`${API_URL}/api/ot?search=${encodeURIComponent(numParam)}&limit=10`)
            if (res.ok) {
                const data = await res.json()
                const cleanRec = numeroRecepcion.trim()
                const found = data.items?.find((ot: any) => 
                    (ot.numero_recepcion && ot.numero_recepcion.trim() === cleanRec) ||
                    (numeroOt && ot.numero_ot && ot.numero_ot.trim() === numeroOt.trim())
                )
                if (found) {
                    setSelectedOTData(found)
                }
            }
        } catch {
            // El formulario se precargará automáticamente con prefill
        }
    }

    const handleDownloadOtExcel = async (item: Recepcion) => {
        try {
            setDownloadingOtId(item.id)
            toast.loading(`Generando Excel de Orden de Trabajo...`)
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

            let otId = item.ot_id
            if (!otId) {
                const numParam = item.numero_ot || item.numero_recepcion
                const searchRes = await authFetch(`${API_URL}/api/ot?search=${encodeURIComponent(numParam)}&limit=5`)
                if (searchRes.ok) {
                    const searchJson = await searchRes.json()
                    const found = searchJson.items?.find((o: any) => 
                        (item.numero_recepcion && o.numero_recepcion?.trim() === item.numero_recepcion.trim()) ||
                        (item.numero_ot && o.numero_ot?.trim() === item.numero_ot.trim())
                    )
                    if (found) otId = found.id
                }
            }

            if (!otId) {
                toast.dismiss()
                toast.warning("No se encontró la Orden de Trabajo asociada para descargar.")
                return
            }

            const isConcreto = (item.tipo_recepcion || "").toUpperCase() === "CONCRETO"
            const queryUrl = isConcreto ? `${API_URL}/api/ot/${otId}/excel?tipo=CONCRETO` : `${API_URL}/api/ot/${otId}/excel`
            const res = await authFetch(queryUrl)
            if (!res.ok) throw new Error("Error al generar el Excel de la Orden de Trabajo")

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            const cleanOtNum = (item.numero_ot || item.numero_recepcion || "OT").replace("/", "-")
            a.download = `OT-${cleanOtNum}.xlsx`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            a.remove()

            toast.dismiss()
            toast.success("Excel de Orden de Trabajo descargado correctamente")
        } catch (err: any) {
            toast.dismiss()
            toast.error(err.message || "No se pudo descargar el Excel de la OT")
        } finally {
            setDownloadingOtId(null)
        }
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "-"
        try {
            const d = new Date(dateStr)
            if (isNaN(d.getTime())) return dateStr
            return d.toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            })
        } catch {
            return dateStr
        }
    }

    const safeTotalPages = Math.max(1, Number(pagination.totalPages || 1))
    const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages)
    const showingFrom = pagination.total === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1
    const showingTo = pagination.total === 0 ? 0 : Math.min(safeCurrentPage * pageSize, pagination.total)

    const getTipoBadge = (tipo?: string) => {
        switch (tipo) {
            case "ROCA":
                return <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold text-[10px]">ROCA (F-LEM-P-01.04)</Badge>
            case "ALBANILERIA":
                return <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px]">ALBAÑILERÍA (F-LEM-P-01.05)</Badge>
            case "AGUA":
                return <Badge className="bg-cyan-100 text-cyan-800 border-cyan-300 font-bold text-[10px]">AGUA (F-LEM-P-01.06)</Badge>
            case "SUELO_AGREGADO":
                return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">SUELO Y AG. (F-LEM-P-01.13)</Badge>
            case "CONCRETO":
            default:
                return <Badge className="bg-blue-100 text-blue-800 border-blue-300 font-bold text-[10px]">CONCRETO (F-LEM-P-01.02)</Badge>
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header section */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground uppercase tracking-tight flex items-center gap-2">
                        {scope === "concreto" 
                            ? "Recepción de Probetas" 
                            : scope === "lima" 
                                ? "Recepción Lab. Lima" 
                                : "Recepciones Generales"}
                    </h1>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                        {scope === "concreto" 
                            ? "Gestión de recepciones de probetas de concreto (F-LEM-P-01.02)" 
                            : scope === "lima" 
                                ? "Gestión de recepciones de suelos, agregados, rocas, albañilería y agua" 
                                : "Gestión unificada de recepciones de laboratorio (Concreto, Roca, Albañilería, Agua, Suelo/Agregado)"}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshCurrentPage}
                        disabled={loading}
                        className="gap-2 text-xs font-bold"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        Recargar
                    </Button>

                    {canWrite && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportExcel}
                                accept=".xlsx, .xls"
                                className="hidden"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsImportTypeModalOpen(true)}
                                disabled={isImporting}
                                className="gap-2 text-xs font-bold border-green-600/30 text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20"
                            >
                                {isImporting ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                                ) : (
                                    <Upload className="h-4 w-4 text-green-600" />
                                )}
                                Importar Excel
                            </Button>
                            <Button onClick={handleCreateNew} size="sm" className="gap-2 text-xs font-bold">
                                <Plus className="h-4 w-4" />
                                {scope === "concreto" ? "Nueva Recepción Probetas" : "Nueva Recepción"}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-card p-4 rounded-xl border">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, proyecto, RUC, Nº Recepción, OT..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 text-xs"
                    />
                </div>

                {/* Dropdown de tipo de recepción en la lista */}
                {scope !== "concreto" && (
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">Tipo:</span>
                        <select
                            value={selectedTipo}
                            onChange={(e) => {
                                setSelectedTipo(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="h-9 rounded-md border bg-background px-3 text-xs font-bold uppercase text-foreground focus:outline-none cursor-pointer"
                        >
                            {scope === "lima" ? (
                                <>
                                    <option value="LIMA_ALL">Todos los formatos de Lima</option>
                                    <option value="SUELO_AGREGADO">Suelo y Agregados (F-LEM-P-01.13)</option>
                                    <option value="ROCA">Roca (F-LEM-P-01.04)</option>
                                    <option value="ALBANILERIA">Albañilería (F-LEM-P-01.05)</option>
                                    <option value="AGUA">Agua (F-LEM-P-01.06)</option>
                                </>
                            ) : (
                                <>
                                    <option value="ALL">Todos los formatos</option>
                                    <option value="CONCRETO">Concreto (F-LEM-P-01.02)</option>
                                    <option value="ROCA">Roca (F-LEM-P-01.04)</option>
                                    <option value="ALBANILERIA">Albañilería (F-LEM-P-01.05)</option>
                                    <option value="AGUA">Agua (F-LEM-P-01.06)</option>
                                    <option value="SUELO_AGREGADO">Suelo y Agregados (F-LEM-P-01.13)</option>
                                </>
                            )}
                        </select>
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="rounded-xl border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 text-xs font-bold uppercase tracking-wider">
                            <TableHead className="w-27.5">Nº Recepción</TableHead>
                            <TableHead className="w-27.5">Nº OT</TableHead>
                            {scope !== "concreto" && (
                                <TableHead className="w-35">Tipo Formato</TableHead>
                            )}
                            <TableHead>Cliente</TableHead>
                            <TableHead>Proyecto</TableHead>
                            <TableHead className="w-27.5">F. Recepción</TableHead>
                            <TableHead className="w-22.5 text-center">Muestras</TableHead>
                            <TableHead className="w-25 text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={scope === "concreto" ? 7 : 8} className="text-center py-12">
                                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <p className="font-bold">Cargando recepciones...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : recepciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={scope === "concreto" ? 7 : 8} className="text-center py-12 text-muted-foreground">
                                    <p className="font-bold">No se encontraron recepciones</p>
                                    <p className="text-[11px] mt-1">Prueba con otros términos de búsqueda o añade una nueva recepción.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            recepciones.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell className="font-bold font-mono text-primary">
                                        {item.numero_recepcion || "-"}
                                    </TableCell>
                                    <TableCell className="font-bold font-mono">
                                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                                            <span>{formatOtDisplay(item.numero_ot)}</span>
                                            
                                            {/* Botón de Check / Abrir OT */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleOpenOT(item.numero_recepcion, item.numero_ot)
                                                }}
                                                title={
                                                    item.ot_emitida || item.ot_exists
                                                        ? `OT emitida: ${formatOtDisplay(item.numero_ot)} (Clic para ver/editar)`
                                                        : "OT pendiente (Clic para abrir modal y generar OT)"
                                                }
                                                className={`inline-flex items-center justify-center h-5 w-5 rounded transition-all cursor-pointer border ${
                                                    item.ot_emitida || item.ot_exists
                                                        ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25 hover:scale-110"
                                                        : "bg-slate-100 text-slate-500 border-slate-300 hover:bg-amber-100 hover:text-amber-700 hover:border-amber-400 hover:scale-110 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-amber-950/60 dark:hover:text-amber-400"
                                                }`}
                                            >
                                                {item.ot_emitida || item.ot_exists ? (
                                                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                                ) : (
                                                    <span className="text-[11px] font-bold leading-none select-none">-</span>
                                                )}
                                            </button>

                                            {/* Icono de descarga directa de la OT */}
                                            {item.ot_emitida || item.ot_exists ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDownloadOtExcel(item)
                                                    }}
                                                    disabled={downloadingOtId === item.id}
                                                    title={`Descargar Excel de Orden de Trabajo (${formatOtDisplay(item.numero_ot)})`}
                                                    className="inline-flex items-center justify-center h-5 w-5 rounded transition-all cursor-pointer border border-sky-300/60 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:scale-110 hover:border-sky-400 dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-900/60"
                                                >
                                                    {downloadingOtId === item.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Download className="h-3 w-3 stroke-[2.5]" />
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center justify-center h-5 w-5 text-slate-400 select-none text-xs font-bold" title="Sin OT creada">
                                                    -
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    {scope !== "concreto" && (
                                        <TableCell>
                                            {getTipoBadge(item.tipo_recepcion)}
                                        </TableCell>
                                    )}
                                    <TableCell className="font-medium max-w-50 truncate" title={item.cliente}>
                                        {item.cliente || "-"}
                                    </TableCell>
                                    <TableCell className="max-w-62.5 truncate text-muted-foreground" title={item.proyecto}>
                                        {item.proyecto || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {formatDate(item.fecha_recepcion)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className="font-bold">
                                            {item.muestras_count ?? (Array.isArray(item.muestras) ? item.muestras.length : 0)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {canWrite && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(item)}
                                                    title="Editar Recepción"
                                                    className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDownloadExcel(item)}
                                                title="Descargar Excel"
                                                className="h-8 w-8 text-muted-foreground hover:text-green-600 cursor-pointer"
                                            >
                                                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                                            </Button>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Más opciones"
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuItem
                                                        onClick={() => handleViewDetail(item.id)}
                                                        className="cursor-pointer gap-2"
                                                    >
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                        <span>Ver Detalle</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setSelectedEmailRecepcion(item)
                                                            setIsEmailModalOpen(true)
                                                        }}
                                                        className="cursor-pointer gap-2"
                                                    >
                                                        <Mail className="h-4 w-4 text-blue-600" />
                                                        <span>Enviar Correo</span>
                                                    </DropdownMenuItem>
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => setDeleteTarget(item)}
                                                                className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span>Eliminar</span>
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Server-side pagination */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-md border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                    Mostrando {showingFrom} a {showingTo} de {pagination.total} registros
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground">
                        Filas:
                    </label>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            const nextSize = Number(e.target.value)
                            setPageSize(nextSize)
                            setCurrentPage(1)
                        }}
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        disabled={loading}
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={loading || safeCurrentPage <= 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-30 text-center text-xs font-medium">
                        Página {safeCurrentPage} / {safeTotalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={loading || safeCurrentPage >= safeTotalPages}
                        onClick={() => setCurrentPage(prev => Math.min(safeTotalPages, prev + 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Modal for Creation/Edit (100% Native) */}
            <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden flex flex-col bg-background [&>button]:hidden">
                    <DialogTitle className="sr-only">
                        {editId ? "Editar Recepción" : "Nueva Recepción"}
                    </DialogTitle>
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                        <OrdenForm
                            mode={editId ? "edit" : "create"}
                            editId={editId ?? undefined}
                            importedData={importedData}
                            defaultTipo={defaultTipo}
                            allowedTipos={allowedTipos}
                            onClose={(reason) => {
                                if (reason === 'created') toast.success('¡Recepción creada exitosamente!')
                                else if (reason === 'updated') toast.success('¡Recepción actualizada exitosamente!')
                                setIsModalOpen(false)
                                setEditId(null)
                                setImportedData(null)
                                refreshCurrentPage()
                            }}
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

            {/* Detail Dialog (100% Native) */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden [&>button]:hidden">
                    <DialogTitle className="sr-only">
                        Detalle de Recepción
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Vista detallada nativa de la recepción.
                    </DialogDescription>
                    {selectedRecepcion?.id && (
                        <OrdenDetail
                            recepcionId={selectedRecepcion.id}
                            onEdit={() => selectedRecepcion && handleEdit(selectedRecepcion)}
                            onClose={() => setIsDetailOpen(false)}
                            onOpenOT={(numRec, numOt) => handleOpenOT(numRec, numOt)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal para Crear / Editar Orden de Trabajo (OT) */}
            <Dialog open={isOTModalOpen} onOpenChange={setIsOTModalOpen}>
                <OTForm
                    initialData={selectedOTData}
                    initialNumeroRecepcion={selectedOTRecepcionNum}
                    tipo={scope === "concreto" ? "CONCRETO" : scope === "lima" ? "MUESTRAS" : "AUTO"}
                    onSuccess={() => {
                        setIsOTModalOpen(false)
                        setSelectedOTData(null)
                        setSelectedOTRecepcionNum(null)
                        refreshCurrentPage()
                    }}
                    onCancel={() => {
                        setIsOTModalOpen(false)
                        setSelectedOTData(null)
                        setSelectedOTRecepcionNum(null)
                    }}
                />
            </Dialog>

            {/* Modal para Selección del Tipo de Recepción a Importar */}
            <Dialog open={isImportTypeModalOpen} onOpenChange={setIsImportTypeModalOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base font-bold">
                            <Upload className="h-5 w-5 text-green-600" />
                            {scope === "concreto" ? "Importar Recepción de Probetas" : "Importar Recepción desde Excel"}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Selecciona la categoría del tipo de recepción a importar para procesar el formato adecuado o usa Auto-detectar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-2">
                        {[
                            {
                                id: "AUTO",
                                label: "Auto-detectar",
                                desc: "Detección automática por formato de plantilla",
                                icon: Sparkles,
                                color: "text-indigo-600 bg-indigo-50 border-indigo-200",
                            },
                            {
                                id: "CONCRETO",
                                label: "Concreto / Probetas",
                                desc: "Probetas, cilindros y prismas (F-LEM-P-01.02)",
                                icon: Building2,
                                color: "text-blue-600 bg-blue-50 border-blue-200",
                            },
                            {
                                id: "SUELO_AGREGADO",
                                label: "Suelo y Agregados",
                                desc: "Suelos, agregados y densidades (F-LEM-P-01.13)",
                                icon: Mountain,
                                color: "text-amber-600 bg-amber-50 border-amber-200",
                            },
                            {
                                id: "ROCA",
                                label: "Roca / Núcleos",
                                desc: "Testigos y especímenes de roca (F-LEM-P-01.04)",
                                icon: Gem,
                                color: "text-slate-700 bg-slate-100 border-slate-300",
                            },
                            {
                                id: "ALBANILERIA",
                                label: "Albañilería",
                                desc: "Ladrillos, bloques y muretes (F-LEM-P-01.05)",
                                icon: Boxes,
                                color: "text-rose-600 bg-rose-50 border-rose-200",
                            },
                            {
                                id: "AGUA",
                                label: "Agua",
                                desc: "Muestras de agua para ensayo (F-LEM-P-01.06)",
                                icon: Droplets,
                                color: "text-cyan-600 bg-cyan-50 border-cyan-200",
                            },
                        ]
                        .filter((item) => item.id === "AUTO" || !allowedTipos || allowedTipos.includes(item.id))
                        .map((item) => {
                            const IconComponent = item.icon
                            const isSelected = selectedImportTipo === item.id
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedImportTipo(item.id)}
                                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex items-start gap-3 relative ${
                                        isSelected
                                            ? "border-primary bg-primary/5 shadow-sm"
                                            : "border-border hover:border-primary/50 hover:bg-accent/50"
                                    }`}
                                >
                                    <div className={`p-2 rounded-md ${item.color} shrink-0`}>
                                        <IconComponent className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="text-xs font-bold leading-none text-foreground">{item.label}</div>
                                        <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{item.desc}</div>
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                            <Check className="h-2.5 w-2.5" />
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => setIsImportTypeModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white font-bold"
                            onClick={() => {
                                setIsImportTypeModalOpen(false)
                                setTimeout(() => {
                                    fileInputRef.current?.click()
                                }, 100)
                            }}
                        >
                            <Upload className="h-4 w-4" />
                            Seleccionar Archivo Excel...
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Envío de Notificación por Correo (Outlook) */}
            <RecepcionEmailModal
                open={isEmailModalOpen}
                onOpenChange={setIsEmailModalOpen}
                recepcion={selectedEmailRecepcion}
            />

            {/* Diálogo de Confirmación de Eliminación Global */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar Recepción?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente la recepción
                            <span className="font-bold text-foreground"> {deleteTarget?.numero_recepcion} </span>
                            y la orden de trabajo asociada.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteTarget) {
                                    handleDelete(deleteTarget.id)
                                    setDeleteTarget(null)
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
