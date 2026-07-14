"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, RefreshCw, Loader2, AlertCircle, Search, CalendarDays, Download } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { authFetch } from "@/lib/api-auth"

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

const DEFAULT_ELEMENTOS = [
  "MURO PERIMETRAL",
  "LOSA PAVIMENTACION TRAMO I Y II",
  "LOSAS",
  "VIGA",
  "COLUMNA",
  "VEREDA",
  "PISO",
  "PANEL",
]

type HuantaProbetaRow = {
  id: number
  item: number
  codigo_probeta: string
  sigla: string
  elemento: string
  detalle_elemento: string
  fecha_moldeo: string
  edad: number
  fecha_rotura: string
  codigo_muestra_lem: string
  estado: string
  codigo_lote_interno: string
}

type DraftRow = Omit<HuantaProbetaRow, "id" | "fecha_rotura" | "estado"> & {
  fecha_rotura?: string
}

const emptyRow = (item: number): DraftRow => ({
  item,
  codigo_probeta: "",
  sigla: "HHTA",
  elemento: DEFAULT_ELEMENTOS[0],
  detalle_elemento: "",
  fecha_moldeo: "",
  edad: 7,
  codigo_muestra_lem: "",
  codigo_lote_interno: "",
})

function formatDateInput(value: string) {
  if (!value) return ""
  return value.slice(0, 10)
}

function addDays(dateValue: string, days: number) {
  const raw = formatDateInput(dateValue)
  if (!raw) return ""
  const base = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(base.getTime())) return ""
  base.setDate(base.getDate() + (Number(days) || 0))
  return base.toISOString().slice(0, 10)
}

function HuantaBatchModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<DraftRow[]>(Array.from({ length: 6 }, (_, i) => emptyRow(i + 1)))
  const [previewQuery, setPreviewQuery] = useState("")

  useEffect(() => {
    if (!open) return
    setRows(Array.from({ length: 6 }, (_, i) => emptyRow(i + 1)))
  }, [open])

  const updateRow = useCallback((index: number, patch: Partial<DraftRow>) => {
    setRows(prev => prev.map((row, idx) => {
      if (idx !== index) return row
      const next = { ...row, ...patch }
      if (patch.fecha_moldeo !== undefined || patch.edad !== undefined) {
        next.fecha_rotura = addDays(next.fecha_moldeo || "", Number(next.edad || 0))
      }
      return next
    }))
  }, [])

  const handleSubmit = async () => {
    const payload = rows.map((row, idx) => ({
      item: idx + 1,
      sigla: "HHTA",
      elemento: row.elemento?.trim() || "MURO PERIMETRAL",
      detalle_elemento: row.detalle_elemento?.trim() || "",
      fecha_moldeo: row.fecha_moldeo,
      edad: Number(row.edad) || 0,
      fecha_rotura: addDays(row.fecha_moldeo, Number(row.edad) || 0),
      codigo_muestra_lem: row.codigo_muestra_lem?.trim() || "",
      codigo_lote_interno: row.codigo_lote_interno?.trim() || "",
    }))

    if (payload.some(p => !p.fecha_moldeo || !p.codigo_lote_interno)) {
      toast.error("Completa fecha de moldeo y código interno del lote en las 6 filas.")
      return
    }

    setSaving(true)
    try {
      const res = await authFetch(`${API_URL}/api/huanta-probetas/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      })
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(detail || "No se pudo guardar el lote")
      }
      toast.success("Lote Huanta creado correctamente")
      setOpen(false)
      onCreated()
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar lote")
    } finally {
      setSaving(false)
    }
  }

  const filteredElementos = useMemo(() => {
    const q = previewQuery.trim().toLowerCase()
    return DEFAULT_ELEMENTOS.filter((x) => x.toLowerCase().includes(q))
  }, [previewQuery])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[96vw] w-[1400px] h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Control Huanta Probetas — Lote de 6</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border">
            <div>
              <Label className="text-xs">Buscar elemento sugerido</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-9" value={previewQuery} onChange={(e) => setPreviewQuery(e.target.value)} placeholder="Escribe para sugerir..." />
              </div>
            </div>
            <div className="md:col-span-2 text-xs text-slate-500 flex items-end">
              {filteredElementos.length > 0 ? `Sugerencias: ${filteredElementos.slice(0, 6).join(", ")}` : "Sin sugerencias"}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="w-16">Item</TableHead>
                  <TableHead className="w-28">Sigla</TableHead>
                  <TableHead className="w-36">Código probeta</TableHead>
                  <TableHead className="min-w-[220px]">Elemento</TableHead>
                  <TableHead className="min-w-[220px]">Detalle elemento</TableHead>
                  <TableHead className="w-40">Fecha moldeo</TableHead>
                  <TableHead className="w-28">Edad</TableHead>
                  <TableHead className="w-40">Fecha rotura</TableHead>
                  <TableHead className="min-w-[220px]">Código Muestra LEM</TableHead>
                  <TableHead className="w-40">Código lote interno</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.item}>
                    <TableCell className="font-semibold text-center">{row.item}</TableCell>
                    <TableCell className="text-center font-mono">{row.sigla}</TableCell>
                    <TableCell className="text-center text-slate-500">{row.codigo_probeta || "—"}</TableCell>
                    <TableCell>
                      <Input value={row.elemento} list="huanta-elementos" onChange={(e) => updateRow(index, { elemento: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input value={row.detalle_elemento} onChange={(e) => updateRow(index, { detalle_elemento: e.target.value })} placeholder="EJE-D-N @ 09'-10'" />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={formatDateInput(row.fecha_moldeo)}
                        onChange={(e) => updateRow(index, { fecha_moldeo: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.edad}
                        onChange={(e) => updateRow(index, { edad: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {addDays(row.fecha_moldeo, Number(row.edad)) || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input value={row.codigo_muestra_lem} onChange={(e) => updateRow(index, { codigo_muestra_lem: e.target.value })} placeholder="HHTA-..." />
                    </TableCell>
                    <TableCell>
                      <Input value={row.codigo_lote_interno} onChange={(e) => updateRow(index, { codigo_lote_interno: e.target.value })} placeholder="HTA-2026-07-001" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <datalist id="huanta-elementos">
            {DEFAULT_ELEMENTOS.map((el) => <option key={el} value={el} />)}
          </datalist>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Guardar lote
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function HuantaProbetasModule() {
  const [rows, setRows] = useState<HuantaProbetaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState("")

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/huanta-probetas?ts=${Date.now()}`)
      if (!res.ok) throw new Error("No se pudieron cargar los lotes")
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err?.message || "Error cargando Huanta")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchRows() }, [fetchRows])

  const handleExportExcel = async () => {
    setExporting(true)
    const toastId = toast.loading("Generando Excel...")
    try {
      const res = await authFetch(`${API_URL}/api/huanta-probetas/export`)
      if (!res.ok) throw new Error("Error al exportar las probetas")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "CONTROL_PROBETAS_HUANTA.xlsx"
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.codigo_probeta, r.elemento, r.detalle_elemento, r.codigo_muestra_lem, r.codigo_lote_interno, String(r.item)]
        .some((v) => (v || "").toLowerCase().includes(q))
    )
  }, [rows, search])

  const onReload = async () => {
    setRefreshing(true)
    await fetchRows()
    setRefreshing(false)
    toast.success("Listado actualizado")
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control Huanta Probetas</h1>
          <p className="text-sm text-slate-500 mt-1">
            Alta directa por lotes de 6 probetas, con código interno y fecha de rotura automática.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={handleExportExcel} disabled={loading || refreshing || exporting}>
            <Download className="h-4 w-4 mr-2" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={onReload} disabled={loading || refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Recargar
          </Button>
          <HuantaBatchModal onCreated={fetchRows} />
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center gap-3 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, lote, elemento..." className="pl-9" />
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading && rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm font-medium">Cargando probetas Huanta...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium">No hay probetas Huanta registradas</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Código probeta</TableHead>
                    <TableHead>Sigla</TableHead>
                    <TableHead>Elemento</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Moldeo</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Rotura</TableHead>
                    <TableHead>Código Muestra LEM</TableHead>
                    <TableHead>Lote interno</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-semibold text-center">{row.item}</TableCell>
                      <TableCell className="font-mono text-center">{row.codigo_probeta}</TableCell>
                      <TableCell className="text-center">{row.sigla}</TableCell>
                      <TableCell>{row.elemento}</TableCell>
                      <TableCell>{row.detalle_elemento}</TableCell>
                      <TableCell className="text-center">{row.fecha_moldeo}</TableCell>
                      <TableCell className="text-center">{row.edad}</TableCell>
                      <TableCell className="text-center">{row.fecha_rotura}</TableCell>
                      <TableCell className="font-mono text-xs">{row.codigo_muestra_lem}</TableCell>
                      <TableCell className="font-mono text-xs">{row.codigo_lote_interno}</TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{row.estado}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
