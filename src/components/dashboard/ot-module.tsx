"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog } from "@/components/ui/dialog"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { DataTablePagination } from "@/components/ui/data-table-pagination"
import { ModernConfirmDialog } from "./modern-confirm-dialog"
import { OTForm, type OTData } from "./ot-native/OTForm"
import { OTDetailDialog } from "./ot-native/OTDetailDialog"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function OTModule() {
  const [data, setData] = useState<OTData[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState("")
  const [estadoFilter, setEstadoFilter] = useState("TODOS")

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingOt, setEditingOt] = useState<OTData | null>(null)

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [viewingOt, setViewingOt] = useState<OTData | null>(null)

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingOt, setDeletingOt] = useState<OTData | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const fetchOts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })
      if (search.trim()) params.append("search", search.trim())
      if (estadoFilter !== "TODOS") params.append("estado", estadoFilter)

      const res = await authFetch(`${API_URL}/api/ot?${params.toString()}`)
      if (!res.ok) throw new Error("No se pudieron cargar las Órdenes de Trabajo")

      const json = await res.json()
      setData(json.items || [])
      setTotal(json.total || 0)
    } catch (err: any) {
      toast.error(err.message || "Error de conexión al cargar OTs")
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, estadoFilter])

  useEffect(() => {
    fetchOts()
  }, [fetchOts])

  const handleCreateNew = () => {
    setEditingOt(null)
    setIsFormOpen(true)
  }

  const handleEdit = (ot: OTData) => {
    setEditingOt(ot)
    setIsFormOpen(true)
  }

  const handleView = (ot: OTData) => {
    setViewingOt(ot)
    setIsDetailOpen(true)
  }

  const handleDeleteClick = (ot: OTData) => {
    setDeletingOt(ot)
    setIsDeleteOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deletingOt?.id) return
    setDeleteLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/ot/${deletingOt.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Error al eliminar la Orden de Trabajo")

      toast.success(`Orden de Trabajo ${deletingOt.numero_ot} eliminada`)
      setIsDeleteOpen(false)
      setDeletingOt(null)
      fetchOts()
    } catch (err: any) {
      toast.error(err.message || "No se pudo eliminar la OT")
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDownloadExcel = async (ot: OTData) => {
    if (!ot.id) return
    setDownloadingId(ot.id)
    try {
      const res = await fetch(`${API_URL}/api/ot/${ot.id}/excel`)
      if (!res.ok) throw new Error("Error al exportar Excel")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `OT-${(ot.numero_ot || "001").replace("/", "-")}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      toast.success("Excel de OT generado correctamente")
    } catch (err: any) {
      toast.error(err.message || "No se pudo descargar el Excel")
    } finally {
      setDownloadingId(null)
    }
  }

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case "COMPLETADO":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 font-semibold">COMPLETADO</Badge>
      case "EN PROCESO":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-semibold">EN PROCESO</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 font-semibold">PENDIENTE</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* HEADER PRINCIPAL Y METRICAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="h-7 w-7 text-amber-600" />
            Órdenes de Trabajo (OT)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestión, registro y seguimiento de Órdenes de Trabajo de Laboratorio (F-LEM-P-02.01).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOts}
            disabled={loading}
            className="gap-2 text-slate-700 bg-white shadow-sm hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
          <Button
            onClick={handleCreateNew}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-md gap-2"
          >
            <Plus className="h-4 w-4" />
            Nueva OT
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-slate-200/80 shadow-sm bg-gradient-to-br from-amber-50/50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Total OTs Registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{total}</div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm bg-gradient-to-br from-blue-50/50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
              En Proceso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {data.filter((d) => d.estado === "EN PROCESO").length}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {data.filter((d) => d.estado === "COMPLETADO").length}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-sm bg-gradient-to-br from-slate-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {data.filter((d) => d.estado === "PENDIENTE" || !d.estado).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS Y BUSCADOR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por N° OT, Recepción, Muestra..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <span className="text-xs font-medium text-slate-500">Estado:</span>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="TODOS">Todos</option>
            <option value="PENDIENTE">Pendientes</option>
            <option value="EN PROCESO">En Proceso</option>
            <option value="COMPLETADO">Completados</option>
          </select>
        </div>
      </div>

      {/* TABLA DE ORDENES DE TRABAJO */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="border-b border-slate-200">
                <TableHead className="w-[140px] font-bold text-slate-700">N° OT</TableHead>
                <TableHead className="w-[120px] font-bold text-slate-700">N° RECEPCIÓN</TableHead>
                <TableHead className="w-[130px] font-bold text-slate-700">FECHA RECEPCIÓN</TableHead>
                <TableHead className="w-[100px] font-bold text-slate-700 text-center">PLAZO</TableHead>
                <TableHead className="font-bold text-slate-700">ENSAYOS / MUESTRAS</TableHead>
                <TableHead className="w-[160px] font-bold text-slate-700">TÉCNICO DESIGNADO</TableHead>
                <TableHead className="w-[120px] font-bold text-slate-700 text-center">ESTADO</TableHead>
                <TableHead className="w-[160px] font-bold text-slate-700 text-right pr-6">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
                      Cargando Órdenes de Trabajo...
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <AlertCircle className="h-8 w-8 text-slate-300" />
                      <p className="font-medium text-slate-600">No se encontraron Órdenes de Trabajo.</p>
                      <p className="text-xs">Haz clic en "+ Nueva OT" para registrar una primera orden.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((ot) => (
                  <TableRow key={ot.id} className="hover:bg-amber-50/20 transition-colors">
                    <TableCell className="font-mono font-bold text-amber-900 text-xs">
                      {ot.numero_ot}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">
                      {ot.numero_recepcion || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {ot.fecha_recepcion || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-center font-bold text-slate-800">
                      {ot.plazo_entrega_dias ? `${ot.plazo_entrega_dias} d` : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="bg-slate-100 text-slate-700 text-[10px]">
                          {ot.items?.length || 0} ítems
                        </Badge>
                        <span className="truncate max-w-[280px] text-slate-600 italic">
                          {ot.items && ot.items.length > 0
                            ? ot.items.map((i) => i.descripcion).filter(Boolean).join(", ")
                            : "Sin descripción"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700 font-medium">
                      {ot.ot_designada_a || "-"}
                    </TableCell>
                    <TableCell className="text-center">{renderStatusBadge(ot.estado)}</TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(ot)}
                          title="Ver detalle OT"
                          className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(ot)}
                          title="Editar OT"
                          className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownloadExcel(ot)}
                          disabled={downloadingId === ot.id}
                          title="Exportar a Excel"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                        >
                          {downloadingId === ot.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(ot)}
                          title="Eliminar OT"
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* PAGINACION */}
        {!loading && total > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50">
            <DataTablePagination
              pageIndex={page - 1}
              pageSize={limit}
              pageCount={Math.ceil(total / limit)}
              totalRows={total}
              onPageChange={(p) => setPage(p + 1)}
              onPageSizeChange={(s) => {
                setLimit(s)
                setPage(1)
              }}
            />
          </div>
        )}
      </div>

      {/* DIALOG FORMULARIO (CREAR/EDITAR) */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        {isFormOpen && (
          <OTForm
            initialData={editingOt}
            onSuccess={() => {
              setIsFormOpen(false)
              fetchOts()
            }}
            onCancel={() => setIsFormOpen(false)}
          />
        )}
      </Dialog>

      {/* DIALOG VISTA DETALLE */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        {isDetailOpen && viewingOt && (
          <OTDetailDialog ot={viewingOt} onClose={() => setIsDetailOpen(false)} />
        )}
      </Dialog>

      {/* CONFIRMACION ELIMINACION */}
      <ModernConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="¿Eliminar Orden de Trabajo?"
        description={`¿Estás seguro de que deseas eliminar permanentemente la Orden de Trabajo ${deletingOt?.numero_ot}? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar OT"
        cancelText="Cancelar"
        variant="danger"
        isLoading={deleteLoading}
      />
    </div>
  )
}
