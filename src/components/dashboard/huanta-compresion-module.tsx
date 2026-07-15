"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, Plus, ArrowRight, Download, Pencil, ExternalLink, Database, Clock3, AlertTriangle, CheckCircle2, BarChart3, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DialogFullscreen, DialogFullscreenContent } from "@/components/ui/dialog-fullscreen"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authFetch } from "@/lib/api-auth"

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

type CompRow = {
  id: number
  probeta_id: number
  codigo_probeta: string
  codigo_lote_interno: string
  codigo_muestra_lem: string
  fecha_rotura: string
  diam_1?: string | null
  diam_2?: string | null
  long_1?: string | null
  long_2?: string | null
  long_3?: string | null
  carga_maxima?: number | null
  tipo_fractura?: string | null
  estado: string
  observaciones?: string | null
}

export function HuantaCompresionModule() {
  const [rows, setRows] = useState<CompRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<CompRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)


  const getLoteBgClass = useCallback((lote: string) => {
    const colors = [
      "bg-blue-50/20 hover:bg-blue-50/40",
      "bg-emerald-50/20 hover:bg-emerald-50/40",
      "bg-violet-50/20 hover:bg-violet-50/40",
      "bg-amber-50/20 hover:bg-amber-50/40",
      "bg-rose-50/20 hover:bg-rose-50/40",
      "bg-cyan-50/20 hover:bg-cyan-50/40",
    ]
    const val = lote || "DEFAULT"
    const hash = val.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
    return colors[Math.abs(hash) % colors.length]
  }, [])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/huanta-compresion`)
      if (!res.ok) throw new Error("No se pudo cargar compresión Huanta")
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err?.message || "Error cargando compresión Huanta")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchRows() }, [fetchRows])

  const syncFromProbetas = async () => {
    setRefreshing(true)
    try {
      const res = await authFetch(`${API_URL}/api/huanta-compresion/sync-from-probetas`, { method: "POST" })
      if (!res.ok) throw new Error("No se pudo sincronizar")
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      toast.success("Compresión sincronizada desde probetas")
    } catch (err: any) {
      toast.error(err?.message || "Error sincronizando")
    } finally {
      setRefreshing(false)
    }
  }

  const handleExportExcel = async () => {
    setExporting(true)
    const toastId = toast.loading("Generando Excel...")
    try {
      const res = await authFetch(`${API_URL}/api/huanta-compresion/export`)
      if (!res.ok) throw new Error("Error al exportar")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "COMPRESION_HUANTA.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Excel descargado correctamente", { id: toastId })
    } catch (err: any) {
      toast.error(err?.message || "Error al descargar Excel", { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  const handleEditClick = (row: CompRow) => {
    setEditingRow({ ...row })
    setIsEditOpen(true)
  }

  const handleSave = async () => {
    if (!editingRow) return
    setSaving(true)
    try {
      const payload = {
        diam_1: editingRow.diam_1?.trim() || null,
        diam_2: editingRow.diam_2?.trim() || null,
        long_1: editingRow.long_1?.trim() || null,
        long_2: editingRow.long_2?.trim() || null,
        long_3: editingRow.long_3?.trim() || null,
        carga_maxima: editingRow.carga_maxima !== undefined && editingRow.carga_maxima !== null ? Number(editingRow.carga_maxima) : null,
        tipo_fractura: editingRow.tipo_fractura?.trim() || null,
        estado: editingRow.estado || "PENDIENTE",
        observaciones: editingRow.observaciones?.trim() || null,
      }

      const res = await authFetch(`${API_URL}/api/huanta-compresion/${editingRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("No se pudo guardar la compresión")
      toast.success("Registro técnico de compresión guardado")
      setIsEditOpen(false)
      void fetchRows()
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.codigo_probeta, r.codigo_lote_interno, r.codigo_muestra_lem, r.estado]
        .some((v) => (v || "").toLowerCase().includes(q))
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize, totalPages])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, isOpen])

  const dashboard = useMemo(() => {
    const ensayados = rows.filter((r) => r.estado === "ENSAYADO").length
    const curado = rows.filter((r) => r.estado === "PENDIENTE").length
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "/")
    const pendientesHoy = rows.filter((r) => r.estado === "PENDIENTE" && r.fecha_rotura === todayStr).length
    const ultimos = [...rows]
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 5)
    return { total: rows.length, ensayados, curado, pendientesHoy, ultimos }
  }, [rows])

  return (
    <div className="h-full flex flex-col bg-slate-50/50 p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Compresión Huanta</h1>
          <p className="text-slate-500 font-medium mt-1">Gestión técnica de rotura y edición por doble click con lotes Huanta.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={handleExportExcel} disabled={exporting || loading}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={syncFromProbetas} disabled={refreshing}>
            <ArrowRight className="h-4 w-4 mr-2" />
            Sincronizar
          </Button>
          <Button variant="outline" onClick={fetchRows} disabled={loading || refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xl">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase">Matriz técnica Huanta</h3>
              <p className="text-slate-500 text-xs font-medium mt-1">Acceso directo a la tabla de compresión, sincronización y edición</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-3 px-5 py-3 bg-[#0070F3] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 active:scale-95"
          >
            <ExternalLink className="h-5 w-5" strokeWidth={3} />
            ABRIR TABLA DE CONTROL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En Curado</p>
            <p className="text-3xl font-black mt-1 tabular-nums text-blue-600">{dashboard.curado}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Clock3 className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendientes Hoy</p>
            <p className="text-3xl font-black mt-1 tabular-nums text-amber-600">{dashboard.pendientesHoy}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ensayados</p>
            <p className="text-3xl font-black mt-1 tabular-nums text-emerald-600">{dashboard.ensayados}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/30">
          <h3 className="font-black text-slate-900 uppercase flex items-center gap-2">
            <Clock3 className="h-4 w-4" />
            Últimos registros
          </h3>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-3 py-1">Últimos 5</span>
        </div>
        <div className="divide-y divide-slate-100">
          {dashboard.ultimos.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400 text-sm">No hay registros para mostrar</div>
          ) : dashboard.ultimos.map((row) => (
            <div key={row.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate">{row.codigo_probeta} <span className="text-slate-400 font-normal">|</span> {row.codigo_lote_interno || "SIN LOTE"}</div>
                <div className="text-sm text-slate-500 truncate">
                  LEM: <span className="font-semibold text-slate-700">{row.codigo_muestra_lem || "-"}</span> · Rotura: <span className="font-semibold text-slate-700">{row.fecha_rotura || "-"}</span>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                row.estado === "ENSAYADO"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {row.estado}
              </span>
            </div>
          ))}
        </div>
      </div>

      <DialogFullscreen open={isOpen} onOpenChange={setIsOpen}>
        <DialogFullscreenContent
          style={{ backgroundColor: '#fff' }}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => setIsOpen(false)}
        >
          {/* Title Bar */}
          <div className="flex-none flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Tabla de control — Compresión Huanta</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">EN LÍNEA</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsOpen(false)} className="rounded-xl">
                Cerrar
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="p-4 border-b bg-slate-50/30 flex items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input className="pl-9 h-9" placeholder="Buscar por probeta, lote o estado..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>

              <div className="overflow-x-auto flex-1 min-h-0">
                {loading && rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm font-medium">Cargando compresión Huanta...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Plus className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm font-medium">No hay ítems de compresión Huanta</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-[#f4f4f5] sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="font-bold">Probeta</TableHead>
                        <TableHead className="font-bold">Código Muestra LEM</TableHead>
                        <TableHead className="font-bold">Rotura</TableHead>
                        <TableHead className="font-bold">Diám 1</TableHead>
                        <TableHead className="font-bold">Diám 2</TableHead>
                        <TableHead className="font-bold">Long 1</TableHead>
                        <TableHead className="font-bold">Long 2</TableHead>
                        <TableHead className="font-bold">Long 3</TableHead>
                        <TableHead className="font-bold">Carga máx.</TableHead>
                        <TableHead className="font-bold">Fractura</TableHead>
                        <TableHead className="font-bold">Estado</TableHead>
                        <TableHead className="w-[100px] text-center font-bold">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((row) => (
                        <TableRow key={row.id} className={`${getLoteBgClass(row.codigo_lote_interno)} transition-colors`}>
                          <TableCell className="font-mono text-center font-semibold text-slate-900">{row.codigo_probeta}</TableCell>
                          <TableCell className="font-mono text-xs">{row.codigo_muestra_lem}</TableCell>
                          <TableCell className="text-center text-xs text-slate-600">{row.fecha_rotura}</TableCell>
                          <TableCell className="text-center text-xs">{row.diam_1 || "-"}</TableCell>
                          <TableCell className="text-center text-xs">{row.diam_2 || "-"}</TableCell>
                          <TableCell className="text-center text-xs">{row.long_1 || "-"}</TableCell>
                          <TableCell className="text-center text-xs">{row.long_2 || "-"}</TableCell>
                          <TableCell className="text-center text-xs">{row.long_3 || "-"}</TableCell>
                          <TableCell className="text-center font-semibold text-xs text-indigo-600">{row.carga_maxima ?? "-"}</TableCell>
                          <TableCell className="text-center text-xs">{row.tipo_fractura || "-"}</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              row.estado === "ENSAYADO" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-150"
                            }`}>{row.estado}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => handleEditClick(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex-none flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Filas por página:</span>
                  <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                    <SelectTrigger className="w-24 h-8 text-xs rounded-xl border-slate-200 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[100, 1000, 2000, 4000].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-slate-400 ml-2 flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5" /> Total: {filtered.length} registros
                  </span>
                </div>

                {/* Resumen de Estadísticas */}
                <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold text-slate-500 bg-slate-50 px-5 py-1.5 rounded-xl border border-slate-200">
                  <span>Lotes: <strong className="text-slate-800">{new Set(rows.map(r => r.codigo_lote_interno).filter(Boolean)).size}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Ensayadas: <strong className="text-emerald-600">{dashboard.ensayados}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Pendientes: <strong className="text-amber-600">{dashboard.curado}</strong></span>
                  <span className="text-slate-300">|</span>
                  <span>Hoy: <strong className="text-blue-600">{dashboard.pendientesHoy}</strong></span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-500 font-medium">Página {page} de {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-slate-200" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-slate-200" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogFullscreenContent>
      </DialogFullscreen>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-5xl w-[96vw] h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Registrar Rotura — Probeta {editingRow?.codigo_probeta}</DialogTitle>
            <DialogDescription className="sr-only">Formulario para registrar datos técnicos de rotura</DialogDescription>
          </DialogHeader>

          {editingRow && (
            <div className="space-y-4 py-2 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div>
                  <Label className="text-xs">Diámetro 1 (mm)</Label>
                  <Input value={editingRow.diam_1 || ""} onChange={(e) => setEditingRow({ ...editingRow, diam_1: e.target.value, estado: "PENDIENTE" })} placeholder="150.3" />
                </div>
                <div>
                  <Label className="text-xs">Diámetro 2 (mm)</Label>
                  <Input value={editingRow.diam_2 || ""} onChange={(e) => setEditingRow({ ...editingRow, diam_2: e.target.value, estado: "PENDIENTE" })} placeholder="150.6" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Longitud 1 (mm)</Label>
                  <Input value={editingRow.long_1 || ""} onChange={(e) => setEditingRow({ ...editingRow, long_1: e.target.value, estado: "PENDIENTE" })} placeholder="300.2" />
                </div>
                <div>
                  <Label className="text-xs">Longitud 2 (mm)</Label>
                  <Input value={editingRow.long_2 || ""} onChange={(e) => setEditingRow({ ...editingRow, long_2: e.target.value, estado: "PENDIENTE" })} placeholder="300.6" />
                </div>
                <div>
                  <Label className="text-xs">Longitud 3 (mm)</Label>
                  <Input value={editingRow.long_3 || ""} onChange={(e) => setEditingRow({ ...editingRow, long_3: e.target.value, estado: "PENDIENTE" })} placeholder="300.2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div>
                  <Label className="text-xs">Carga Máxima (kN)</Label>
                  <Input type="number" step="any" value={editingRow.carga_maxima ?? ""} onChange={(e) => setEditingRow({ ...editingRow, carga_maxima: e.target.value !== "" ? Number(e.target.value) : null, estado: "PENDIENTE" })} placeholder="392.4" />
                </div>
                <div>
                  <Label className="text-xs">Tipo Fractura (1-6)</Label>
                  <Input value={editingRow.tipo_fractura || ""} onChange={(e) => setEditingRow({ ...editingRow, tipo_fractura: e.target.value, estado: "PENDIENTE" })} placeholder="2" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <Label className="text-xs">Estado</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" value={editingRow.estado} onChange={(e) => setEditingRow({ ...editingRow, estado: e.target.value })}>
                    <option value="PENDIENTE">PENDIENTE</option>
                    <option value="ENSAYADO">ENSAYADO</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Observaciones</Label>
                  <Input value={editingRow.observaciones || ""} onChange={(e) => setEditingRow({ ...editingRow, observaciones: e.target.value })} placeholder="Ninguna" />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar datos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
