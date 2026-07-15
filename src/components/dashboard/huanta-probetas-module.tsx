"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, RefreshCw, Loader2, AlertCircle, Search, CalendarDays, Download, Sparkles, ExternalLink, Database, Clock3, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DialogFullscreen, DialogFullscreenContent } from "@/components/ui/dialog-fullscreen"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  f_c: string
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
  f_c: "210",
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

function generateLemCode(row: DraftRow) {
  const sigla = (row.sigla || "HHTA").trim()
  const elem = (row.elemento || "").trim()
  const det = (row.detalle_elemento || "").trim()
  const fc = (row.f_c || "").trim()
  const numPart = row.codigo_probeta.replace(/\D/g, "") || "0"
  return `${sigla}-${elem}-${det}-${fc}-${numPart}`
}


function InlineEditableText({
  value,
  onCommit,
  className = "",
  placeholder = "—",
  type = "text",
}: {
  value?: string | number | null
  onCommit: (next: string) => void
  className?: string
  placeholder?: string
  type?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ""))

  useEffect(() => {
    if (!editing) setDraft(String(value ?? ""))
  }, [value, editing])

  if (editing) {
    return (
      <Input
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          onCommit(draft.trim())
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === "Escape") {
            setDraft(String(value ?? ""))
            setEditing(false)
          }
        }}
        className={`h-8 text-center font-mono text-xs rounded-lg border border-slate-300 shadow-sm bg-white ${className}`}
      />
    )
  }

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      className={`min-h-8 flex items-center justify-center cursor-text select-none rounded-md px-1 ${className}`}
      title="Doble click para editar"
    >
      <span className="block w-full text-center wrap-break-word leading-tight">{String(value ?? "") || placeholder}</span>
    </div>
  )
}

function getLoteBgClass(lote: string) {
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
}

function HuantaBatchModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loteInterno, setLoteInterno] = useState("")
  const [rows, setRows] = useState<DraftRow[]>(Array.from({ length: 6 }, (_, i) => emptyRow(i + 1)))
  const [previewQuery, setPreviewQuery] = useState("")

  useEffect(() => {
    if (!open) return
    setLoteInterno("")
    setRows(Array.from({ length: 6 }, (_, i) => emptyRow(i + 1)))
  }, [open])

  const updateRow = useCallback((index: number, patch: Partial<DraftRow>) => {
    setRows(prev => prev.map((row, idx) => {
      if (idx !== index) return row
      const next = { ...row, ...patch }
      if (patch.fecha_moldeo !== undefined || patch.edad !== undefined) {
        next.fecha_rotura = addDays(next.fecha_moldeo || "", Number(next.edad || 0))
      }

      // Auto-generate LEM code if user hasn't manually edited it, or if it matches the previous auto-generated code
      const prevAuto = generateLemCode(row)
      if (!row.codigo_muestra_lem || row.codigo_muestra_lem === prevAuto) {
        next.codigo_muestra_lem = generateLemCode(next)
      }

      return next
    }))
  }, [])

  const handleAutoFillFromFirstRow = () => {
    const firstRow = rows[0]
    if (!firstRow) return

    const probetaMatch = firstRow.codigo_probeta.match(/^(\d+)(.*)$/)

    setRows(prev => prev.map((row, idx) => {
      if (idx === 0) return row

      let newCodigo = row.codigo_probeta
      if (probetaMatch) {
        const baseNum = parseInt(probetaMatch[1], 10)
        const suffix = probetaMatch[2] || ""
        const nextNum = baseNum + idx
        const padLength = probetaMatch[1].length
        const nextNumStr = String(nextNum).padStart(padLength, '0')
        newCodigo = `${nextNumStr}${suffix}`
      }

      const defaultEdad = idx < 3 ? 7 : 28

      const updated = {
        ...row,
        elemento: row.elemento === emptyRow(idx + 1).elemento ? firstRow.elemento : row.elemento,
        detalle_elemento: row.detalle_elemento || firstRow.detalle_elemento,
        f_c: row.f_c === "210" ? firstRow.f_c : row.f_c,
        fecha_moldeo: row.fecha_moldeo || firstRow.fecha_moldeo,
        edad: row.edad === 7 ? defaultEdad : row.edad,
        codigo_probeta: row.codigo_probeta || newCodigo,
      }

      updated.fecha_rotura = addDays(updated.fecha_moldeo, updated.edad)
      updated.codigo_muestra_lem = generateLemCode(updated)
      return updated
    }))
    toast.info("Valores auto-completados a partir de Fila 1 (edad: 3 de 7d, 3 de 28d)")
  }

  const handleSubmit = async () => {
    if (!loteInterno.trim()) {
      toast.error("El código del lote interno es requerido.")
      return
    }

    const payload = rows.map((row, idx) => {
      const activeElemento = row.elemento?.trim() || "MURO PERIMETRAL"
      const activeDetalle = row.detalle_elemento?.trim() || "-"
      const activeFc = row.f_c?.trim() || "-"
      const activeCodigoProbeta = row.codigo_probeta?.trim() || `${idx + 1}-CO`
      
      const defaultLem = `HHTA-${activeElemento}-${activeDetalle}-${activeFc}-${activeCodigoProbeta.replace(/\D/g, "")}`
      
      return {
        item: idx + 1,
        codigo_probeta: activeCodigoProbeta,
        sigla: "HHTA",
        elemento: activeElemento,
        detalle_elemento: activeDetalle,
        f_c: activeFc,
        fecha_moldeo: row.fecha_moldeo,
        edad: Number(row.edad) || 0,
        fecha_rotura: addDays(row.fecha_moldeo, Number(row.edad) || 0),
        codigo_muestra_lem: row.codigo_muestra_lem?.trim() || defaultLem,
        codigo_lote_interno: loteInterno.trim(),
      }
    })

    if (payload.some(p => !p.fecha_moldeo || !p.codigo_probeta)) {
      toast.error("Completa fecha de moldeo y código de probeta en las 6 filas.")
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
        <Button className="gap-2 bg-primary hover:bg-primary/95 text-white">
          <Plus className="h-4 w-4" />
          Agregar lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[96vw] w-[1400px] h-[92vh] overflow-hidden flex flex-col bg-slate-50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Control Huanta Probetas — Lote de 6</DialogTitle>
          <DialogDescription className="sr-only">Formulario para registro de lote de 6 probetas Huanta</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border">
            <div>
              <Label className="text-xs font-bold text-slate-700">Código Lote Interno *</Label>
              <Input
                value={loteInterno}
                onChange={(e) => setLoteInterno(e.target.value)}
                placeholder="Ej. HTA-2026-07-001"
                className="mt-1 h-9 bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700">Buscar elemento sugerido</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input className="pl-9 h-9 bg-white" value={previewQuery} onChange={(e) => setPreviewQuery(e.target.value)} placeholder="Escribe para sugerir..." />
              </div>
            </div>
            <div className="text-xs text-slate-500 flex items-end pb-2 md:col-span-2">
              <div className="flex flex-col gap-1 w-full">
                <span className="font-semibold">Sugeridos:</span>
                <span className="truncate">{filteredElementos.length > 0 ? filteredElementos.slice(0, 5).join(", ") : "Sin sugerencias"}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center px-1">
            <h3 className="text-sm font-semibold text-slate-700">Muestras del lote</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFillFromFirstRow}
              className="gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-completar desde Fila 1
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
            <Table>
              <TableHeader className="bg-[#f4f4f5]">
                <TableRow>
                  <TableHead className="w-14 text-center">Item</TableHead>
                  <TableHead className="w-32">Código probeta</TableHead>
                  <TableHead className="w-20 text-center">Sigla</TableHead>
                  <TableHead className="min-w-[200px]">Elemento</TableHead>
                  <TableHead className="min-w-[200px]">Detalle elemento</TableHead>
                  <TableHead className="w-24">F'c (kg/cm2)</TableHead>
                  <TableHead className="w-40">Fecha moldeo</TableHead>
                  <TableHead className="w-24">Edad (días)</TableHead>
                  <TableHead className="w-32 text-center">Fecha rotura</TableHead>
                  <TableHead className="min-w-[260px]">Código Muestra LEM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.item} className={row.item % 2 === 0 ? "bg-slate-50/40 hover:bg-slate-50/60" : "bg-white hover:bg-slate-50/60"}>
                    <TableCell className="font-bold text-center text-slate-500">{row.item}</TableCell>
                    <TableCell>
                      <Input
                        value={row.codigo_probeta}
                        onChange={(e) => updateRow(index, { codigo_probeta: e.target.value })}
                        placeholder="Ej. 456-CO"
                        className="h-8 text-xs font-semibold"
                      />
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-slate-600 text-xs">{row.sigla}</TableCell>
                    <TableCell>
                      <Input
                        value={row.elemento}
                        list="huanta-elementos"
                        onChange={(e) => updateRow(index, { elemento: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.detalle_elemento}
                        onChange={(e) => updateRow(index, { detalle_elemento: e.target.value })}
                        placeholder="Ej. (EJE-D-N @ 09'-10')"
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.f_c}
                        onChange={(e) => updateRow(index, { f_c: e.target.value })}
                        className="h-8 text-xs text-center"
                        placeholder="210"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={formatDateInput(row.fecha_moldeo)}
                        onChange={(e) => updateRow(index, { fecha_moldeo: e.target.value })}
                        className="h-8 text-xs p-1 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={row.edad}
                        onChange={(e) => updateRow(index, { edad: Number(e.target.value) })}
                        className="h-8 text-xs text-center"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {addDays(row.fecha_moldeo, Number(row.edad)) || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.codigo_muestra_lem}
                        onChange={(e) => updateRow(index, { codigo_muestra_lem: e.target.value })}
                        placeholder="Auto-generado..."
                        className="h-8 text-xs font-mono"
                      />
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

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="outline" onClick={() => setOpen(false)} className="h-9 text-xs">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving} className="h-9 text-xs gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
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
  const [isOpen, setIsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)

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
      [r.codigo_probeta, r.elemento, r.detalle_elemento, r.f_c, r.codigo_muestra_lem, r.codigo_lote_interno, String(r.item)]
        .some((v) => (v || "").toLowerCase().includes(q))
    )
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = useMemo(() => {
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize, totalPages])

  const dashboard = useMemo(() => {
    const ensayados = rows.filter((r) => r.estado === "ENSAYADO").length
    const curado = rows.filter((r) => r.estado !== "ENSAYADO").length
    const todayStr = new Date().toISOString().slice(0, 10)
    const pendientesHoy = rows.filter(
      (r) => r.estado !== "ENSAYADO" && r.fecha_rotura === todayStr
    ).length
    const ultimos = [...rows]
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .slice(0, 5)
    return { ensayados, curado, pendientesHoy, ultimos }
  }, [rows])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, isOpen])

  const onReload = async () => {
    setRefreshing(true)
    await fetchRows()
    setRefreshing(false)
    toast.success("Listado actualizado")
  }

  const handleInlineSave = async (rowId: number, field: string, newValue: string) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row) return
    const originalValue = String((row as any)[field] || "")
    if (newValue === originalValue) return

    const patch: Record<string, any> = { [field]: newValue }

    if (field === "fecha_moldeo" || field === "edad") {
      const moldeo = field === "fecha_moldeo" ? newValue : row.fecha_moldeo
      const edad = field === "edad" ? Number(newValue) : row.edad
      patch.fecha_rotura = addDays(moldeo, Number(edad || 0))
    }

    if (["sigla", "elemento", "detalle_elemento", "f_c", "codigo_probeta"].includes(field)) {
      const updated = { ...row, ...patch }
      const prevAuto = generateLemCode(row as any)
      if (!row.codigo_muestra_lem || row.codigo_muestra_lem === prevAuto) {
        patch.codigo_muestra_lem = generateLemCode(updated as any)
      }
    }

    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, ...patch } : r))

    try {
      const res = await authFetch(`${API_URL}/api/huanta-probetas/${rowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error("No se pudo guardar")
      toast.success("Guardado")
      void fetchRows()
    } catch {
      toast.error("Error al guardar, revirtiendo...")
      void fetchRows()
    }
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50 p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Control Huanta Probetas</h1>
          <p className="text-slate-500 font-medium mt-1">
            Alta directa por lotes de 6 probetas con código interno de lote global, incrementador y fecha de rotura automática.
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={handleExportExcel} disabled={loading || refreshing || exporting} className="h-9 text-xs">
            <Download className="h-4 w-4 mr-2 text-slate-500" />
            Exportar Excel
          </Button>
          <Button variant="outline" onClick={onReload} disabled={loading || refreshing} className="h-9 text-xs">
            <RefreshCw className={`h-4 w-4 mr-2 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
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
              <p className="text-slate-500 text-xs font-medium mt-1">Acceso directo a la tabla, registro por lote y edición rápida</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-3 px-5 py-3 bg-[#0070F3] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              <ExternalLink className="h-5 w-5" strokeWidth={3} />
              ABRIR TABLA DE CONTROL
            </button>
          </div>
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
          onInteractOutside={(e: any) => e.preventDefault()}
          onEscapeKeyDown={() => setIsOpen(false)}
        >
          {/* Title Bar */}
          <div className="flex-none flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Tabla de control — Huanta Probetas</h2>
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
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, lote, elemento..." className="pl-9 h-9" />
                </div>
                <HuantaBatchModal onCreated={fetchRows} />
              </div>
              <div className="overflow-x-auto flex-1 min-h-0">
                {loading && rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary" />
                    <p className="text-sm font-medium">Cargando probetas Huanta...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                    <p className="text-sm font-medium">No hay probetas Huanta registradas</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-[#f4f4f5] sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="w-14 text-center font-bold">Item</TableHead>
                        <TableHead className="w-32 text-center font-bold">Código probeta</TableHead>
                        <TableHead className="w-20 text-center font-bold">Sigla</TableHead>
                        <TableHead className="min-w-[180px] font-bold">Elemento</TableHead>
                        <TableHead className="min-w-[180px] font-bold">Detalle</TableHead>
                        <TableHead className="w-24 text-center font-bold">F'c (kg/cm2)</TableHead>
                        <TableHead className="w-32 text-center font-bold">Moldeo</TableHead>
                        <TableHead className="w-20 text-center font-bold">Edad</TableHead>
                        <TableHead className="w-32 text-center font-bold">Rotura</TableHead>
                        <TableHead className="min-w-[240px] font-bold">Código Muestra LEM</TableHead>
                        <TableHead className="w-28 text-center font-bold">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((row, idx) => (
                        <TableRow key={row.id} className={`${getLoteBgClass(row.codigo_lote_interno)} transition-colors`}>
                          <TableCell className="font-bold text-center text-slate-500">{(page - 1) * pageSize + idx + 1}</TableCell>
                          <TableCell className="font-mono text-center font-bold text-slate-700">{row.codigo_probeta}</TableCell>
                          <TableCell className="text-center text-xs font-semibold font-mono text-slate-500">{row.sigla}</TableCell>
                          <TableCell className="font-medium text-slate-700">
                            <InlineEditableText value={row.elemento} onCommit={(v) => handleInlineSave(row.id, "elemento", v)} />
                          </TableCell>
                          <TableCell className="text-slate-600 text-xs">
                            <InlineEditableText value={row.detalle_elemento} onCommit={(v) => handleInlineSave(row.id, "detalle_elemento", v)} placeholder="-" />
                          </TableCell>
                          <TableCell className="text-center font-semibold text-indigo-600">
                            <InlineEditableText value={row.f_c} onCommit={(v) => handleInlineSave(row.id, "f_c", v)} />
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600">
                            <InlineEditableText value={row.fecha_moldeo} onCommit={(v) => handleInlineSave(row.id, "fecha_moldeo", v)} type="date" />
                          </TableCell>
                          <TableCell className="text-center font-semibold text-xs text-slate-700">
                            <InlineEditableText value={`${row.edad}d`} onCommit={(v) => handleInlineSave(row.id, "edad", v.replace("d", ""))} />
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-600">{row.fecha_rotura}</TableCell>
                          <TableCell className="font-mono text-[11px] text-slate-500">
                            <InlineEditableText value={row.codigo_muestra_lem} onCommit={(v) => handleInlineSave(row.id, "codigo_muestra_lem", v)} placeholder="-" />
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              row.estado === "ENSAYADO"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {row.estado}
                            </span>
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
    </div>
  )
}
