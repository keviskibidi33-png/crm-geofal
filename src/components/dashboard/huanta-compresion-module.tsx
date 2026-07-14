"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, Plus, ArrowRight, Download, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<CompRow | null>(null)
  const [saving, setSaving] = useState(false)

  const lotColorClasses = useCallback((lote: string) => {
    let acc = 0
    for (const ch of lote || "") acc = (acc + ch.charCodeAt(0)) % 4
    return [
      "bg-blue-50 text-blue-800 border-blue-100",
      "bg-emerald-50 text-emerald-800 border-emerald-100",
      "bg-amber-50 text-amber-800 border-amber-100",
      "bg-violet-50 text-violet-800 border-violet-100",
    ][acc]
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
        estado: editingRow.estado || "ENSAYADO",
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

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Compresión Huanta</h1>
          <p className="text-sm text-slate-500 mt-1">Panel técnico de rotura alimentado desde las probetas Huanta por lote.</p>
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

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50/30 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Buscar por probeta, lote o estado..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="overflow-x-auto">
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
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead>Probeta</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>LEM</TableHead>
                    <TableHead>Rotura</TableHead>
                    <TableHead>Diám 1</TableHead>
                    <TableHead>Diám 2</TableHead>
                    <TableHead>Long 1</TableHead>
                    <TableHead>Long 2</TableHead>
                    <TableHead>Long 3</TableHead>
                    <TableHead>Carga máx.</TableHead>
                    <TableHead>Fractura</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[100px] text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row, idx) => (
                    <TableRow key={row.id} className={idx % 2 === 0 ? "bg-slate-50/40" : "bg-white"}>
                      <TableCell className="font-mono text-center font-semibold text-slate-900">{row.codigo_probeta}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border ${lotColorClasses(row.codigo_lote_interno)}`}>
                          {row.codigo_lote_interno}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.codigo_muestra_lem}</TableCell>
                      <TableCell className="text-center">{row.fecha_rotura}</TableCell>
                      <TableCell className="text-center">{row.diam_1 || "-"}</TableCell>
                      <TableCell className="text-center">{row.diam_2 || "-"}</TableCell>
                      <TableCell className="text-center">{row.long_1 || "-"}</TableCell>
                      <TableCell className="text-center">{row.long_2 || "-"}</TableCell>
                      <TableCell className="text-center">{row.long_3 || "-"}</TableCell>
                      <TableCell className="text-center font-semibold">{row.carga_maxima ?? "-"}</TableCell>
                      <TableCell className="text-center">{row.tipo_fractura || "-"}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.estado === "ENSAYADO" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-600"
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
        </div>
      </div>

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
                  <Input value={editingRow.diam_1 || ""} onChange={(e) => setEditingRow({ ...editingRow, diam_1: e.target.value })} placeholder="150.3" />
                </div>
                <div>
                  <Label className="text-xs">Diámetro 2 (mm)</Label>
                  <Input value={editingRow.diam_2 || ""} onChange={(e) => setEditingRow({ ...editingRow, diam_2: e.target.value })} placeholder="150.6" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Longitud 1 (mm)</Label>
                  <Input value={editingRow.long_1 || ""} onChange={(e) => setEditingRow({ ...editingRow, long_1: e.target.value })} placeholder="300.2" />
                </div>
                <div>
                  <Label className="text-xs">Longitud 2 (mm)</Label>
                  <Input value={editingRow.long_2 || ""} onChange={(e) => setEditingRow({ ...editingRow, long_2: e.target.value })} placeholder="300.6" />
                </div>
                <div>
                  <Label className="text-xs">Longitud 3 (mm)</Label>
                  <Input value={editingRow.long_3 || ""} onChange={(e) => setEditingRow({ ...editingRow, long_3: e.target.value })} placeholder="300.2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 shrink-0">
                <div>
                  <Label className="text-xs">Carga Máxima (kN)</Label>
                  <Input type="number" step="any" value={editingRow.carga_maxima ?? ""} onChange={(e) => setEditingRow({ ...editingRow, carga_maxima: e.target.value !== "" ? Number(e.target.value) : null })} placeholder="392.4" />
                </div>
                <div>
                  <Label className="text-xs">Tipo Fractura (1-6)</Label>
                  <Input value={editingRow.tipo_fractura || ""} onChange={(e) => setEditingRow({ ...editingRow, tipo_fractura: e.target.value })} placeholder="2" />
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
