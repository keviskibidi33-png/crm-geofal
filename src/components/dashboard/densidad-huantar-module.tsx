"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus, Loader2, AlertCircle, RefreshCw, Search, Pencil, Trash2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModernConfirmDialog } from "./modern-confirm-dialog"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { authFetch } from "@/lib/api-auth"
import DensidadHuantarForm from "./densidad-huantar-native/DensidadHuantarForm"

interface DensidadHuantarEnsayoSummary {
    id: number
    numero_ensayo?: string | null
    numero_ot?: string | null
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function DensidadHuantarModule() {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [ensayos, setEnsayos] = useState<DensidadHuantarEnsayoSummary[]>([])
    const [loading, setLoading] = useState(false)
    const [refreshingTable, setRefreshingTable] = useState(false)
    const [deletingEnsayoId, setDeletingEnsayoId] = useState<number | null>(null)
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(null)
    const [search, setSearch] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 50

    useEffect(() => {
        if (isFormOpen) {
            document.body.classList.add("overflow-hidden")
        } else {
            document.body.classList.remove("overflow-hidden")
        }
        return () => {
            document.body.classList.remove("overflow-hidden")
        }
    }, [isFormOpen])

    const fetchEnsayos = useCallback(async (): Promise<boolean> => {
        setLoading(true)
        try {
            const res = await authFetch(`${API_URL}/api/densidad-huantar/?_ts=${Date.now()}`, {
                cache: "no-store",
            })
            if (!res.ok) {
                toast.error("Error al cargar listado de densidad huantar")
                return false
            }
            const data: DensidadHuantarEnsayoSummary[] = await res.json()
            setEnsayos(data)
            return true
        } catch (err) {
            console.error('Error fetching densidad huantar ensayos', err)
            return false
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchEnsayos()
    }, [fetchEnsayos])

    // Auto-open if a draft is detected in localStorage
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const keys = Object.keys(localStorage)
            const draftKey = keys.find(k => k.startsWith("densidad_huantar_draft_v1:"))
            if (draftKey) {
                const idPart = draftKey.split(":")[1]
                if (idPart === "new") {
                    setEditingEnsayoId(null)
                } else {
                    const parsedId = Number(idPart)
                    if (!isNaN(parsedId)) {
                        setEditingEnsayoId(parsedId)
                    } else {
                        setEditingEnsayoId(null)
                    }
                }
                setIsFormOpen(true)
                toast.info("Se detectaron cambios pendientes de una sesión anterior.")
            }
        } catch (e) {
            console.error("Error reading drafts from localStorage", e)
        }
    }, [])


    const handleManualReload = async () => {
        setRefreshingTable(true)
        const success = await fetchEnsayos()
        setRefreshingTable(false)
        if (success) {
            toast.success("Listado actualizado.")
        }
    }

    const handleDeleteClick = (id: number) => {
        setDeletingEnsayoId(id)
        setIsDeleteConfirmOpen(true)
    }

    const confirmDelete = async () => {
        if (!deletingEnsayoId) return
        try {
            const res = await authFetch(`${API_URL}/api/densidad-huantar/${deletingEnsayoId}`, {
                method: "DELETE"
            })
            if (!res.ok) {
                const txt = await res.text()
                throw new Error(txt || "Error al eliminar")
            }
            toast.success("Ensayo eliminado con éxito.")
            void fetchEnsayos()
        } catch (err: any) {
            toast.error(err.message || "Error al eliminar el ensayo.")
        } finally {
            setIsDeleteConfirmOpen(false)
            setDeletingEnsayoId(null)
        }
    }

    const handleDownloadExcel = async (id: number, sampleCode: string | null | undefined) => {
        const loadingToast = toast.loading("Preparando descarga...")
        try {
            // Fetch the details first to get the payload, then request download
            const resDetails = await authFetch(`${API_URL}/api/densidad-huantar/${id}`)
            if (!resDetails.ok) throw new Error("No se pudo cargar el detalle del ensayo")
            const details = await resDetails.json()
            
            const payload = details.payload
            if (!payload) throw new Error("No hay payload para exportar")

            const resExcel = await authFetch(`${API_URL}/api/densidad-huantar/excel?download=true&ensayo_id=${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            if (!resExcel.ok) throw new Error("Error al generar el archivo Excel")
            
            const blob = await resExcel.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `INF-SU-DEN-HUANTAR_${sampleCode || "MUESTRA"}.xlsx`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
            toast.success("Excel descargado correctamente", { id: loadingToast })
        } catch (err: any) {
            toast.error(err.message || "Error al descargar el archivo", { id: loadingToast })
        }
    }

    const filteredEnsayos = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return ensayos
        return ensayos.filter(e => 
            (e.numero_ensayo || '').toLowerCase().includes(query) ||
            (e.numero_ot || '').toLowerCase().includes(query) ||
            (e.muestra || '').toLowerCase().includes(query) ||
            (e.cliente || '').toLowerCase().includes(query)
        )
    }, [ensayos, search])

    const totalPages = Math.ceil(filteredEnsayos.length / itemsPerPage)
    const paginatedEnsayos = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage
        return filteredEnsayos.slice(startIndex, startIndex + itemsPerPage)
    }, [filteredEnsayos, currentPage])

    return (
        <div className="h-full flex flex-col bg-slate-50/50">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white border-b border-slate-100">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Densidad Huantar</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Control y registro del ensayo de Densidad in-situ mediante Cono de Arena.
                    </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button 
                        variant="outline" 
                        size="icon"
                        onClick={handleManualReload}
                        disabled={loading || refreshingTable}
                        className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm"
                    >
                        <RefreshCw className={`h-4 w-4 ${refreshingTable ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button 
                        onClick={() => {
                            setEditingEnsayoId(null)
                            setIsFormOpen(true)
                        }}
                        className="w-full md:w-auto gap-2 text-white font-medium shadow-sm"
                        style={{ backgroundColor: 'lab(48.477% -35.0644 -41.4319)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88' }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Ensayo
                    </Button>
                </div>
            </div>

            {/* List and search section */}
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
                    {/* Search bar */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar por muestra, OT o cliente..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value)
                                    setCurrentPage(1)
                                }}
                                className="pl-9 bg-white border-slate-200 focus-visible:ring-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-x-auto">
                        {loading && ensayos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <Loader2 className="h-8 w-8 animate-spin mb-3" style={{ color: 'lab(48.477% -35.0644 -41.4319)' }} />
                                <p className="text-sm font-medium">Cargando ensayos...</p>
                            </div>
                        ) : paginatedEnsayos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                                <p className="text-sm font-medium">No se encontraron registros</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                                    <TableRow>
                                        <TableHead className="w-[180px] font-semibold text-slate-700">N° Ensayo</TableHead>
                                        <TableHead className="font-semibold text-slate-700">OT</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Código Muestra</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Cliente</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Fecha de Ensayo</TableHead>
                                        <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                                        <TableHead className="w-[140px] text-right font-semibold text-slate-700">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedEnsayos.map((row) => (
                                        <TableRow key={row.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-medium text-slate-900">{row.numero_ensayo}</TableCell>
                                            <TableCell className="text-slate-600">{row.numero_ot}</TableCell>
                                            <TableCell className="text-slate-600 font-medium">{row.muestra}</TableCell>
                                            <TableCell className="text-slate-600 max-w-[200px] truncate">{row.cliente}</TableCell>
                                            <TableCell className="text-slate-500">{row.fecha_documento}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                    row.estado === "COMPLETO" 
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                                        : "bg-amber-50 text-amber-700 border border-amber-100"
                                                }`}>
                                                    {row.estado}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        onClick={() => {
                                                            setEditingEnsayoId(row.id)
                                                            setIsFormOpen(true)
                                                        }}
                                                        className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        onClick={() => void handleDownloadExcel(row.id, row.muestra)}
                                                        className="h-8 w-8 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon"
                                                        onClick={() => handleDeleteClick(row.id)}
                                                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50/20 flex justify-between items-center">
                            <span className="text-xs text-slate-500">
                                Mostrando {paginatedEnsayos.length} de {filteredEnsayos.length} registros
                            </span>
                            <div className="flex gap-1">
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    Anterior
                                </Button>
                                <span className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                                    {currentPage} / {totalPages}
                                </span>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Native form overlay */}
            {isFormOpen && (
                <div data-form-overlay className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto animate-in fade-in duration-200">
                    <DensidadHuantarForm
                        ensayoId={editingEnsayoId ?? undefined}
                        onClose={() => {
                            setIsFormOpen(false)
                            void fetchEnsayos()
                        }}
                        onSaveSuccess={() => {
                            setIsFormOpen(false)
                            void fetchEnsayos()
                        }}
                    />
                </div>
            )}

            {/* Delete confirm dialog */}
            <ModernConfirmDialog
                open={isDeleteConfirmOpen}
                onOpenChange={setIsDeleteConfirmOpen}
                onConfirm={confirmDelete}
                title="Eliminar Ensayo"
                description="¿Estás seguro de que deseas eliminar este ensayo de Densidad Huantar? Esta acción moverá el archivo Excel a la papelera y cambiará su estado a eliminado."
                confirmText="Sí, eliminar"
            />
        </div>
    )
}
