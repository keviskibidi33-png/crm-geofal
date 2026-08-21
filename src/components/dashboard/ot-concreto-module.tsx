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
  AlertCircle,
  TestTube,
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
import { formatOtDisplay } from "@/lib/utils"
import { OTForm, type OTData } from "./ot-native/OTForm"
import { OTDetailDialog } from "./ot-native/OTDetailDialog"

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

interface OTConcretoModuleProps {
  initialPrefillRecepcion?: string | null
  onClearPrefill?: () => void
}

export function OTConcretoModule({ initialPrefillRecepcion, onClearPrefill }: OTConcretoModuleProps = {}) {
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
  const [targetPrefillRecepcion, setTargetPrefillRecepcion] = useState<string | null>(initialPrefillRecepcion || null)

  useEffect(() => {
    if (initialPrefillRecepcion) {
      const checkAndOpen = async () => {
        setLoading(true)
        try {
          const res = await authFetch(`${API_URL}/api/ot?tipo=CONCRETO&search=${encodeURIComponent(initialPrefillRecepcion.trim())}`)
          if (res.ok) {
            const json = await res.json()
            const items: OTData[] = json.items || []
            const cleanTarget = initialPrefillRecepcion.trim().toLowerCase()
            const existing = items.find(
              (o) =>
                (o.numero_recepcion && o.numero_recepcion.trim().toLowerCase() === cleanTarget) ||
                (o.numero_ot && o.numero_ot.trim().toLowerCase() === cleanTarget)
            )

            if (existing && existing.id) {
              const detailRes = await authFetch(`${API_URL}/api/ot/${existing.id}`)
              if (detailRes.ok) {
                const fullOt = await detailRes.json()
                setEditingOt(fullOt)
                setTargetPrefillRecepcion(null)
                setIsFormOpen(true)
                toast.info(`Abriendo Orden de Trabajo existente: ${fullOt.numero_ot}`)
                onClearPrefill?.()
                return
              }
            }
          }
        } catch {
          // fallback a nueva OT
        } finally {
          setLoading(false)
        }

        // Si no existe, abrir en modo Nueva OT con prefill automático
        setEditingOt(null)
        setTargetPrefillRecepcion(initialPrefillRecepcion)
        setIsFormOpen(true)
        onClearPrefill?.()
      }

      checkAndOpen()
    }
  }, [initialPrefillRecepcion])

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [viewingOt, setViewingOt] = useState<OTData | null>(null)

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deletingOt, setDeletingOt] = useState<OTData | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  // Protección de cambios no guardados
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [isDiscardOpen, setIsDiscardOpen] = useState(false)

  const fetchOts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        tipo: "CONCRETO",
      })
      if (search.trim()) params.append("search", search.trim())
      if (estadoFilter !== "TODOS") params.append("estado", estadoFilter)

      const res = await authFetch(`${API_URL}/api/ot?${params.toString()}`)
      if (!res.ok) throw new Error("No se pudieron cargar las Órdenes de Trabajo de Concreto")

      const json = await res.json()
      setData(json.items || [])
      setTotal(json.total || 0)
    } catch (err: any) {
      toast.error(err.message || "Error de conexión al cargar OTs de Concreto")
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, estadoFilter])

  useEffect(() => {
    fetchOts()
  }, [fetchOts])

  const handleCreateNew = () => {
    setEditingOt(null)
    setIsFormDirty(false)
    setIsFormOpen(true)
  }

  const handleEdit = async (ot: OTData) => {
    // Forzar recarga del OT completo desde la API para asegurar
    // que todos los campos (cliente, proyecto, items) estén populados
    try {
      const res = await authFetch(`${API_URL}/api/ot/${ot.id}`)
      if (res.ok) {
        const fullOt = await res.json()
        setEditingOt(fullOt)
      } else {
        setEditingOt(ot)
      }
    } catch {
      setEditingOt(ot)
    }
    setIsFormOpen(true)
  }

  /**
   * Intercepta el cierre del Dialog de edición.
   * Si hay cambios sin guardar, muestra confirmación antes de cerrar.
   */
  const handleFormOpenChange = (open: boolean) => {
    if (!open && isFormDirty) {
      // Hay cambios — pedir confirmación en lugar de cerrar directamente
      setIsDiscardOpen(true)
      return
    }
    setIsFormOpen(open)
    if (!open) {
      setIsFormDirty(false)
      setEditingOt(null)
    }
  }

  const handleDiscardConfirm = () => {
    setIsDiscardOpen(false)
    setIsFormDirty(false)
    setIsFormOpen(false)
    setEditingOt(null)
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
      const res = await authFetch(`${API_URL}/api/ot/${ot.id}/excel?tipo=CONCRETO`)
      if (!res.ok) throw new Error("Error al exportar Excel de OT Concreto")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const safeNumero = (ot.numero_ot || String(ot.id || "001")).replace(/[\/\\]/g, "-").replace(/^OT-?/i, "").trim()
      a.download = `OT-${safeNumero}-Geofal - LEM.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      toast.success("Excel de OT Concreto generado correctamente")
    } catch (err: any) {
      toast.error(err.message || "No se pudo descargar el Excel")
    } finally {
      setDownloadingId(null)
    }
  }

  const getStatusBadge = (estado: string) => {
    switch (estado?.toUpperCase()) {
      case "EMITIDO":
      case "DESCARGADO":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">EMITIDO</Badge>
      case "COMPLETADO":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Completado</Badge>
      case "EN PROCESO":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">En Proceso</Badge>
      case "PENDIENTE":
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pendiente</Badge>
      case "ANULADO":
        return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200">Anulado</Badge>
      default:
        return <Badge variant="outline">{estado || "Pendiente"}</Badge>
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <TestTube className="h-6 w-6 text-primary" />
              Órdenes de Trabajo - Concreto (OT)
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
              F-LEM-P-02.02
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Gestión y emisión oficial de Órdenes de Trabajo especializadas para cilindros y probetas de concreto.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOts()}
            disabled={loading}
            className="h-9 gap-2 shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-primary" : ""}`} />
            <span className="hidden sm:inline">Recargar</span>
          </Button>

          <Button
            onClick={handleCreateNew}
            size="sm"
            className="h-9 gap-2 shadow-2xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva OT Concreto</span>
          </Button>
        </div>
      </div>

      {/* Tarjeta con Filtros y Tabla */}
      <Card className="shadow-xs border-border/80">
        <CardHeader className="p-4 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Buscador */}
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por N° OT, Recepción, Cliente, Proyecto..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>

            {/* Filtros de Estado */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {["TODOS", "PENDIENTE", "EN PROCESO", "EMITIDO", "COMPLETADO"].map((st) => (
                <Button
                  key={st}
                  variant={estadoFilter === st ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setEstadoFilter(st)
                    setPage(1)
                  }}
                  className="h-8 text-xs font-medium cursor-pointer"
                >
                  {st}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs uppercase font-bold text-muted-foreground tracking-wider">
                  <TableHead className="w-30">N° OT</TableHead>
                  <TableHead className="w-30">N° Recepción</TableHead>
                  <TableHead className="min-w-50">Cliente</TableHead>
                  <TableHead className="min-w-60">Proyecto</TableHead>
                  <TableHead className="w-30">F. Recepción</TableHead>
                  <TableHead className="w-25 text-center">Probetas</TableHead>
                  <TableHead className="w-27.5 text-center">Estado</TableHead>
                  <TableHead className="w-35 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span>Cargando Órdenes de Trabajo de Concreto...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-48 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
                        <p className="font-semibold">No se encontraron Órdenes de Trabajo de Concreto</p>
                        <p className="text-xs text-muted-foreground">
                          {search || estadoFilter !== "TODOS"
                            ? "Prueba cambiando los filtros de búsqueda."
                            : "Crea una nueva OT o sincroniza desde Recepción de Probetas."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((ot) => (
                    <TableRow key={ot.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-mono font-bold text-primary">
                        {formatOtDisplay(ot.numero_ot)}
                      </TableCell>
                      <TableCell className="font-mono font-semibold text-slate-700">
                        {ot.numero_recepcion ?? "—"}
                      </TableCell>
                      <TableCell className="font-medium max-w-55 truncate" title={ot.cliente ?? undefined}>
                        {ot.cliente ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-62.5 truncate" title={ot.proyecto ?? undefined}>
                        {ot.proyecto ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ot.fecha_recepcion ?? "—"}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        <Badge variant="secondary" className="px-2 py-0.5 text-[11px]">
                          {Array.isArray(ot.items) ? ot.items.length : 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(ot.estado || "PENDIENTE")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 hover:text-slate-900 cursor-pointer"
                            onClick={() => handleView(ot)}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                            onClick={() => handleDownloadExcel(ot)}
                            disabled={downloadingId === ot.id}
                            title="Descargar OT Concreto (Excel F-LEM-P-02.02)"
                          >
                            {downloadingId === ot.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                            onClick={() => handleEdit(ot)}
                            title="Editar OT"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                            onClick={() => handleDeleteClick(ot)}
                            title="Eliminar OT"
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

          {/* Paginación */}
          <div className="p-4 border-t bg-muted/10">
            <DataTablePagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={limit}
              totalItems={total}
              onPageChange={(p: number) => setPage(p)}
              onPageSizeChange={(l: number) => {
                setLimit(l)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modal de Creación / Edición */}
      {/* key fuerza remount completo del formulario cuando cambia la OT editada,
          evitando que useState conserve valores de la sesión anterior */}
      <Dialog open={isFormOpen} onOpenChange={handleFormOpenChange}>
        <OTForm
          key={`${editingOt?.id ?? "new"}-${targetPrefillRecepcion ?? ""}`}
          initialData={editingOt}
          initialNumeroRecepcion={targetPrefillRecepcion}
          tipo="CONCRETO"
          onDirtyChange={setIsFormDirty}
          onSuccess={() => {
            setIsFormDirty(false)
            setIsFormOpen(false)
            setEditingOt(null)
            setTargetPrefillRecepcion(null)
            fetchOts()
          }}
          onCancel={() => {
            setTargetPrefillRecepcion(null)
            handleFormOpenChange(false)
          }}
        />
      </Dialog>

      {/* Modal de Detalle */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        {viewingOt && (
          <OTDetailDialog
            ot={viewingOt}
            onClose={() => setIsDetailOpen(false)}
          />
        )}
      </Dialog>

      {/* Confirmación de Descarte de Cambios */}
      <ModernConfirmDialog
        open={isDiscardOpen}
        onOpenChange={setIsDiscardOpen}
        title="¿Descartar cambios no guardados?"
        description="Tienes cambios sin guardar en esta Orden de Trabajo. Si sales ahora, se perderán todos los datos modificados."
        onConfirm={handleDiscardConfirm}
        confirmText="Descartar cambios"
        cancelText="Seguir editando"
        variant="warning"
      />

      {/* Confirmación de Eliminación */}
      <ModernConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="¿Eliminar Orden de Trabajo de Concreto?"
        description={`Esta acción eliminará de forma permanente la OT ${deletingOt?.numero_ot || ""}.`}
        onConfirm={handleConfirmDelete}
        confirmText="Eliminar OT"
        variant="destructive"
      />
    </div>
  )
}
