"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus, RefreshCw, Loader2, AlertCircle, Search, CalendarDays, Download, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
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


function lotColorClasses(lote: string) {
  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-violet-50 text-violet-700 border-violet-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
  ]
  const idx = Math.abs((lote || "HHTA").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0))
  return colors[idx % colors.length]
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

  const onReload = async () => {
    setRefreshing(true)
    await fetchRows()
    setRefreshing(false)
    toast.success("Listado actualizado")
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white border-b border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Control Huanta Probetas</h1>
          <p className="text-sm text-slate-500 mt-1">
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
          <HuantaBatchModal onCreated={fetchRows} />
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex items-center gap-3 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, lote, elemento..." className="pl-9 h-9" />
            </div>
          </div>
          <div className="overflow-x-auto">
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
                <TableHeader className="bg-[#f4f4f5]">
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
                    <TableHead className="w-36 text-center font-bold">Lote interno</TableHead>
                    <TableHead className="w-28 text-center font-bold">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id} className={row.item % 2 === 0 ? "bg-slate-50/40 hover:bg-slate-50/60" : "bg-white hover:bg-slate-50/60"}>
                      <TableCell className="font-bold text-center text-slate-500">{row.item}</TableCell>
                      <TableCell className="font-mono text-center font-bold text-slate-700">{row.codigo_probeta}</TableCell>
                      <TableCell className="text-center text-xs font-semibold font-mono text-slate-500">{row.sigla}</TableCell>
                      <TableCell className="font-medium text-slate-700">{row.elemento}</TableCell>
                      <TableCell className="text-slate-600 text-xs">{row.detalle_elemento}</TableCell>
                      <TableCell className="text-center font-semibold text-indigo-600">{row.f_c}</TableCell>
                      <TableCell className="text-center text-xs text-slate-600">{row.fecha_moldeo}</TableCell>
                      <TableCell className="text-center font-semibold text-xs text-slate-700">{row.edad}d</TableCell>
                      <TableCell className="text-center text-xs text-slate-600">{row.fecha_rotura}</TableCell>
                      <TableCell className="font-mono text-[11px] text-slate-500">{row.codigo_muestra_lem}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`px-2 py-0.5 text-[10px] font-semibold border ${lotColorClasses(row.codigo_lote_interno)}`}>
                          {row.codigo_lote_interno || "SIN LOTE"}
                        </Badge>
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
        </div>
      </div>
    </div>
  )
}
