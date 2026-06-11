"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wifi,
} from "lucide-react"
import { toast } from "sonner"

import { authFetch } from "@/lib/api-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ElementoValue = "-" | "PEQUEÑA" | "GRANDE" | "DIAMANTINA" | "CUBO Y VIGA"
type StatusEnsayoValue = "-" | "ENSAYADO" | "PENDIENTE" | "FALTA" | "ANULADO"
type StatusEntregaValue = "-" | "ENTREGADO" | "INFORME LISTO"

interface ProbetaRow {
  muestra_id: number
  item_numero: number
  recepcion_id: number
  numero_recepcion: string
  numero_ot: string
  cliente: string
  proyecto?: string
  codigo_muestra_lem?: string
  identificacion_muestra?: string
  elemento?: string
  fecha_rotura?: string
  densidad?: string
  fc_kg_cm2: number
  status_ensayo?: string
  status_entrega?: string
  fecha_entrega?: string
}

interface RecepcionOption {
  id: number
  numero_recepcion: string
  numero_ot?: string
  cliente?: string
  proyecto?: string
}

interface ApiListResponse {
  items: ProbetaRow[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

interface ControlProbetasModuleProps {
  user: any
  onNavigateModule: (module: any, recordId: number | null) => void
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

const ELEMENTO_OPTIONS: ElementoValue[] = ["-", "PEQUEÑA", "GRANDE", "DIAMANTINA", "CUBO Y VIGA"]
const STATUS_ENSAYO_OPTIONS: StatusEnsayoValue[] = ["-", "ENSAYADO", "PENDIENTE", "FALTA", "ANULADO"]
const STATUS_ENTREGA_OPTIONS: StatusEntregaValue[] = ["-", "ENTREGADO", "INFORME LISTO"]

const statusBadgeClass = (value?: string) => {
  switch ((value || "-").toUpperCase()) {
    case "ENSAYADO":
      return "border-emerald-200 bg-emerald-50 text-emerald-700"
    case "PENDIENTE":
      return "border-amber-200 bg-amber-50 text-amber-700"
    case "FALTA":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "ANULADO":
      return "border-zinc-200 bg-zinc-100 text-zinc-600"
    case "INFORME LISTO":
      return "border-sky-200 bg-sky-50 text-sky-700"
    case "ENTREGADO":
      return "border-violet-200 bg-violet-50 text-violet-700"
    default:
      return "border-slate-200 bg-slate-50 text-slate-600"
  }
}

const formatDate = (value?: string | null) => {
  if (!value || value === "-") return ""
  const clean = value.split("T")[0].replace(/\//g, "-")
  const parts = clean.split("-")
  if (parts.length !== 3) return value
  if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`
  return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`
}

const parseDateInput = (value: string) => {
  const clean = value.trim()
  if (!clean) return ""
  const parts = clean.split(/[\/\-]/).filter(Boolean)
  if (parts.length !== 3) return ""
  const [d, m, y] = parts
  const year = y.length === 2 ? `20${y}` : y
  return `${year}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`
}

const buildGhostRow = () => ({
  recepcion_id: null as number | null,
  numero_recepcion: "",
  numero_ot: "",
  cliente: "",
  proyecto: "",
  codigo_muestra_lem: "",
  identificacion_muestra: "",
  elemento: "-" as ElementoValue,
  fecha_rotura: "",
  densidad: "",
  fc_kg_cm2: 280,
  status_ensayo: "-" as StatusEnsayoValue,
  status_entrega: "-" as StatusEntregaValue,
  fecha_entrega: "",
})

export function ControlProbetasModule({ user: _user }: ControlProbetasModuleProps) {
  void _user
  const [items, setItems] = useState<ProbetaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [savingGhost, setSavingGhost] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [recepcionQuery, setRecepcionQuery] = useState("")
  const [recepcionOptions, setRecepcionOptions] = useState<RecepcionOption[]>([])
  const [recepcionLoading, setRecepcionLoading] = useState(false)
  const [ghostRow, setGhostRow] = useState(buildGhostRow())
  const ghostCodeRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350)
    return () => clearTimeout(t)
  }, [searchTerm])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      })
      if (debouncedSearch) params.set("search", debouncedSearch)
      const res = await authFetch(`${API_URL}/api/control-probetas/?${params.toString()}`)
      if (!res.ok) throw new Error("No se pudo cargar el listado")
      const data = (await res.json()) as ApiListResponse
      setItems(data.items || [])
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || "Error al cargar las probetas")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, page, pageSize])

  const fetchRecepciones = useCallback(async (query: string) => {
    if (!query.trim()) {
      setRecepcionOptions([])
      return
    }
    setRecepcionLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/recepcion/paginated?q=${encodeURIComponent(query.trim())}&page_size=8`)
      if (!res.ok) throw new Error("No se pudo buscar recepciones")
      const data = await res.json()
      setRecepcionOptions((data.items || []) as RecepcionOption[])
    } catch (error) {
      console.error(error)
    } finally {
      setRecepcionLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  useEffect(() => {
    const t = setTimeout(() => void fetchRecepciones(recepcionQuery), 300)
    return () => clearTimeout(t)
  }, [recepcionQuery, fetchRecepciones])

  const reloadAll = useCallback(() => {
    void fetchItems()
  }, [fetchItems])

  const updateRow = async (muestraId: number, payload: Record<string, unknown>) => {
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/${muestraId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).detail || "No se pudo actualizar")
      const updated = await res.json()
      setItems((prev) => prev.map((row) => (row.muestra_id === muestraId ? updated : row)))
      toast.success("Registro guardado")
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || "Error al guardar")
      void fetchItems()
    }
  }

  const deleteRow = async (muestraId: number) => {
    if (!confirm("¿Eliminar esta probeta?")) return
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/${muestraId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("No se pudo eliminar")
      toast.success("Probeta eliminada")
      void fetchItems()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || "Error al eliminar")
    }
  }

  const submitGhost = async () => {
    if (!ghostRow.recepcion_id) {
      toast.error("Selecciona una recepción primero")
      return
    }
    if (!ghostRow.identificacion_muestra.trim()) {
      toast.error("Ingresa un código de probeta")
      return
    }
    if (savingGhost) return

    setSavingGhost(true)
    try {
      const res = await authFetch(`${API_URL}/api/control-probetas/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ghostRow),
      })
      if (!res.ok) throw new Error((await res.json()).detail || "No se pudo registrar")
      toast.success("Probeta registrada")
      setGhostRow((prev) => ({
        ...buildGhostRow(),
        recepcion_id: prev.recepcion_id,
        numero_recepcion: prev.numero_recepcion,
        numero_ot: prev.numero_ot,
        cliente: prev.cliente,
        proyecto: prev.proyecto,
        elemento: prev.elemento,
        fc_kg_cm2: prev.fc_kg_cm2,
      }))
      setRecepcionQuery("")
      requestAnimationFrame(() => ghostCodeRef.current?.focus())
      void fetchItems()
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || "Error al registrar")
    } finally {
      setSavingGhost(false)
    }
  }

  const filteredInfo = useMemo(() => {
    return `${total} registros`
  }, [total])

  const resumen = useMemo(() => {
    return items.reduce(
      (acc, row) => {
        const ensayo = (row.status_ensayo || "-").toUpperCase()
        const entrega = (row.status_entrega || "-").toUpperCase()
        if (ensayo === "ENSAYADO") acc.ensayado += 1
        if (ensayo === "PENDIENTE") acc.pendiente += 1
        if (ensayo === "FALTA") acc.falta += 1
        if (entrega === "ENTREGADO") acc.entregado += 1
        if (entrega === "INFORME LISTO") acc.informeListo += 1
        return acc
      },
      { ensayado: 0, pendiente: 0, falta: 0, entregado: 0, informeListo: 0 }
    )
  }, [items])

  const resumenCards = [
    { label: "ENSAYADOS", value: resumen.ensayado, tone: "emerald" },
    { label: "PENDIENTES", value: resumen.pendiente, tone: "amber" },
    { label: "FALTAS", value: resumen.falta, tone: "rose" },
    { label: "ENTREGADOS", value: resumen.entregado, tone: "violet" },
    { label: "INFORME LISTO", value: resumen.informeListo, tone: "sky" },
  ] as const

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-[#f8fafc] p-6 font-sans">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Control de Probetas</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Trazabilidad de recepciones, roturas, ensayo y entrega de informe.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={reloadAll}
            disabled={loading}
            className="h-9 border-slate-200 bg-white text-xs"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <Wifi className="h-4 w-4" />
            EN LÍNEA
          </div>
        </div>
      </div>

      <Card className="overflow-visible border-slate-200 bg-white shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Buscar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Recepción, OT, cliente, probeta..."
                  className="h-9 border-slate-200 bg-white pl-9 text-xs"
                />
              </div>
            </div>

            <div className="w-40 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filas</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 border-slate-200 bg-white text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <Calendar className="h-4 w-4" />
              {filteredInfo}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {resumenCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</div>
            <div className={`mt-1 text-xl font-black ${
              card.tone === "emerald"
                ? "text-emerald-600"
                : card.tone === "amber"
                  ? "text-amber-600"
                  : card.tone === "rose"
                    ? "text-rose-600"
                    : card.tone === "violet"
                      ? "text-violet-600"
                      : "text-sky-600"
            }`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1600px] w-full table-fixed border-collapse text-left">
          <thead className="sticky top-0 z-20 bg-[#f4f4f5] shadow-[0_1px_0_0_#e4e4e7]">
            <tr className="text-[10px] font-bold uppercase tracking-wider text-zinc-700">
              <th className="sticky left-0 z-30 w-14 border-r border-zinc-200 bg-[#f4f4f5] p-2 text-center">ITEM</th>
              <th className="sticky left-14 z-30 w-36 border-r border-zinc-200 bg-[#f4f4f5] p-2 shadow-[inset_-1px_0_0_0_#d4d4d8]">RECEPCIÓN</th>
              <th className="sticky left-[200px] z-30 w-44 border-r border-zinc-200 bg-[#f4f4f5] p-2 shadow-[inset_-1px_0_0_0_#d4d4d8]">CÓDIGO PROBETA</th>
              <th className="sticky left-[376px] z-30 w-64 border-r border-zinc-200 bg-[#f4f4f5] p-2 shadow-[inset_-1px_0_0_0_#d4d4d8,4px_0_5px_-2px_rgba(0,0,0,0.15)]">CLIENTE</th>
              <th className="w-40 border-r border-zinc-200 bg-[#f4f4f5] p-2">ELEMENTO</th>
              <th className="w-32 border-r border-zinc-200 bg-[#f4f4f5] p-2 text-center">FECHA ROTURA</th>
              <th className="w-28 border-r border-zinc-200 bg-[#f4f4f5] p-2 text-center">DENSIDAD (G)</th>
              <th className="w-28 border-r border-zinc-200 bg-[#f4f4f5] p-2 text-center">F'C KG/CM</th>
              <th className="w-44 border-r border-zinc-200 bg-[#f4f4f5] p-2">STATUS ENSAYADO</th>
              <th className="w-44 border-r border-zinc-200 bg-[#f4f4f5] p-2">STATUS ENTREGA INFORME</th>
              <th className="w-36 border-r border-zinc-200 bg-[#f4f4f5] p-2 text-center">FECHA ENTREGA INFORME</th>
              <th className="w-24 bg-[#f4f4f5] p-2 text-center"></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-xs">
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-20 text-center text-slate-400">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-slate-500" />
                  Cargando probetas...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-20 text-center italic text-slate-400">
                  No hay probetas para mostrar.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.muestra_id} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-white p-2 text-center font-semibold text-slate-700">
                    {item.item_numero}
                  </td>
                  <td className="sticky left-14 z-10 border-r border-slate-200 bg-white p-1 shadow-[inset_-1px_0_0_0_#e2e8f0]">
                    <div className="truncate font-semibold text-slate-800">{item.numero_recepcion}</div>
                    <div className="truncate text-[10px] text-slate-400">{item.numero_ot}</div>
                  </td>
                  <td className="sticky left-[200px] z-10 border-r border-slate-200 bg-white p-1 font-mono text-[11px] font-semibold text-slate-800 shadow-[inset_-1px_0_0_0_#e2e8f0]">
                    {item.identificacion_muestra || item.codigo_muestra_lem || "-"}
                  </td>
                  <td className="sticky left-[376px] z-10 border-r border-slate-200 bg-white p-1 font-semibold text-slate-800 shadow-[inset_-1px_0_0_0_#e2e8f0,4px_0_5px_-2px_rgba(0,0,0,0.12)]">{item.cliente}</td>
                  <td className="border-r border-slate-200 p-1">
                    <Select
                      value={(item.elemento as ElementoValue) || "-"}
                      onValueChange={(value) => updateRow(item.muestra_id, { elemento: value })}
                    >
                      <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ELEMENTO_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border-r border-slate-200 p-1 text-center">
                    <Input
                      defaultValue={formatDate(item.fecha_rotura)}
                      placeholder="dd/mm/aa"
                      className="h-8 border-0 bg-transparent text-center font-mono text-xs shadow-none focus:ring-1"
                      onBlur={(e) => {
                        const parsed = e.target.value ? parseDateInput(e.target.value) : ""
                        if (!parsed && e.target.value.trim()) {
                          toast.error("Fecha inválida. Usa dd/mm/aa.")
                          e.target.value = formatDate(item.fecha_rotura)
                          return
                        }
                        void updateRow(item.muestra_id, { fecha_rotura: parsed || "" })
                      }}
                    />
                  </td>
                  <td className="border-r border-slate-200 p-1 text-center">
                    <Input
                      defaultValue={item.densidad || ""}
                      className="h-8 border-0 bg-transparent text-center text-xs shadow-none focus:ring-1"
                      onBlur={(e) => void updateRow(item.muestra_id, { densidad: e.target.value || "-" })}
                    />
                  </td>
                  <td className="border-r border-slate-200 p-1 text-center">
                    <Input
                      type="number"
                      defaultValue={item.fc_kg_cm2}
                      className="h-8 border-0 bg-transparent text-center text-xs shadow-none focus:ring-1"
                      onBlur={(e) => void updateRow(item.muestra_id, { fc_kg_cm2: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="border-r border-slate-200 p-1">
                    <Select
                      value={(item.status_ensayo as StatusEnsayoValue) || "-"}
                      onValueChange={(value) => updateRow(item.muestra_id, { status_ensayo: value })}
                    >
                      <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
                        <SelectValue>
                          <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(item.status_ensayo)}`}>
                            {item.status_ensayo || "-"}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ENSAYO_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border-r border-slate-200 p-1">
                    <Select
                      value={(item.status_entrega as StatusEntregaValue) || "-"}
                      onValueChange={(value) => updateRow(item.muestra_id, { status_entrega: value })}
                    >
                      <SelectTrigger className="h-8 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
                        <SelectValue>
                          <Badge variant="outline" className={`px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(item.status_entrega)}`}>
                            {item.status_entrega || "-"}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_ENTREGA_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border-r border-slate-200 p-1 text-center">
                    <Input
                      defaultValue={formatDate(item.fecha_entrega)}
                      placeholder="dd/mm/aa"
                      className="h-8 border-0 bg-transparent text-center font-mono text-xs shadow-none focus:ring-1"
                      onBlur={(e) => {
                        const parsed = e.target.value ? parseDateInput(e.target.value) : ""
                        if (!parsed && e.target.value.trim()) {
                          toast.error("Fecha inválida. Usa dd/mm/aa.")
                          e.target.value = formatDate(item.fecha_entrega)
                          return
                        }
                        void updateRow(item.muestra_id, { fecha_entrega: parsed || "" })
                      }}
                    />
                  </td>
                  <td className="p-1 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-700"
                    onClick={() => deleteRow(item.muestra_id)}
                  >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}

            <tr className="border-t-2 border-slate-200 bg-zinc-50">
              <td className="sticky left-0 z-10 border-r border-slate-200 bg-zinc-50 p-2 text-center">
                <button
                  type="button"
                  onClick={submitGhost}
                  disabled={savingGhost}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
                  title="Agregar fila"
                >
                  {savingGhost ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </button>
              </td>

              <td className="border-r border-slate-200 p-1">
                <div className="relative overflow-visible">
                  <Input
                    value={recepcionQuery}
                    onChange={(e) => {
                      setRecepcionQuery(e.target.value)
                      setGhostRow((prev) => ({ ...prev, recepcion_id: null, numero_recepcion: "", numero_ot: "", cliente: "", proyecto: "" }))
                    }}
                    placeholder="Buscar recepción..."
                    className="h-8 border border-zinc-200 bg-white text-xs"
                  />
                  {recepcionQuery.trim() && (recepcionLoading || recepcionOptions.length > 0) && (
                    <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg">
                      {recepcionLoading ? (
                        <div className="p-3 text-xs text-slate-500">Buscando...</div>
                      ) : (
                        recepcionOptions.map((rec) => (
                          <button
                            key={rec.id}
                            type="button"
                            className="block w-full border-b border-zinc-100 px-3 py-2 text-left text-xs hover:bg-blue-50"
                            onMouseDown={() => {
                              setGhostRow((prev) => ({
                                ...prev,
                                recepcion_id: rec.id,
                                numero_recepcion: rec.numero_recepcion,
                                numero_ot: rec.numero_ot || "",
                                cliente: rec.cliente || "",
                                proyecto: rec.proyecto || "",
                              }))
                              setRecepcionQuery(rec.numero_recepcion)
                              setRecepcionOptions([])
                            }}
                          >
                            <div className="font-semibold text-slate-800">{rec.numero_recepcion}</div>
                            <div className="text-[10px] text-slate-500">
                              {rec.numero_ot || "-"} · {rec.cliente || "Sin cliente"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </td>

              <td className="border-r border-slate-200 p-1">
                <Input
                  ref={ghostCodeRef}
                  value={ghostRow.identificacion_muestra}
                  onChange={(e) => setGhostRow((prev) => ({ ...prev, identificacion_muestra: e.target.value }))}
                  placeholder="001-CO-26"
                  className="h-8 border border-zinc-200 bg-white text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void submitGhost()
                    }
                  }}
                />
              </td>

              <td className="border-r border-slate-200 p-1">
                <div className="truncate text-xs font-semibold text-slate-500" title={ghostRow.cliente}>
                  {ghostRow.cliente || "Se completa con la recepción"}
                </div>
              </td>

              <td className="border-r border-slate-200 p-1">
                <Select
                  value={ghostRow.elemento as ElementoValue}
                  onValueChange={(value) => setGhostRow((prev) => ({ ...prev, elemento: value as ElementoValue }))}
                >
                  <SelectTrigger className="h-8 border border-zinc-200 bg-white text-xs">
                    <SelectValue placeholder="Elemento" />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEMENTO_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>

              <td className="border-r border-slate-200 p-1 text-center">
                <Input
                  value={ghostRow.fecha_rotura}
                  onChange={(e) => setGhostRow((prev) => ({ ...prev, fecha_rotura: parseDateInput(e.target.value) || e.target.value }))}
                  placeholder="dd/mm/aa"
                  className="h-8 border border-zinc-200 bg-white text-center font-mono text-xs"
                  onBlur={(e) => setGhostRow((prev) => ({ ...prev, fecha_rotura: parseDateInput(e.target.value) || "" }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void submitGhost()
                    }
                  }}
                />
              </td>

              <td className="border-r border-slate-200 p-1 text-center">
                <Input
                  value={ghostRow.densidad}
                  onChange={(e) => setGhostRow((prev) => ({ ...prev, densidad: e.target.value }))}
                  placeholder="-"
                  className="h-8 border border-zinc-200 bg-white text-center text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void submitGhost()
                    }
                  }}
                />
              </td>

              <td className="border-r border-slate-200 p-1 text-center">
                <Input
                  type="number"
                  value={ghostRow.fc_kg_cm2}
                  onChange={(e) => setGhostRow((prev) => ({ ...prev, fc_kg_cm2: Number(e.target.value) }))}
                  className="h-8 border border-zinc-200 bg-white text-center text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void submitGhost()
                    }
                  }}
                />
              </td>

              <td className="border-r border-slate-200 p-1">
                <Select
                  value={ghostRow.status_ensayo as StatusEnsayoValue}
                  onValueChange={(value) => setGhostRow((prev) => ({ ...prev, status_ensayo: value as StatusEnsayoValue }))}
                >
                  <SelectTrigger className="h-8 border border-zinc-200 bg-white text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ENSAYO_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>

              <td className="border-r border-slate-200 p-1">
                <Select
                  value={ghostRow.status_entrega as StatusEntregaValue}
                  onValueChange={(value) => setGhostRow((prev) => ({ ...prev, status_entrega: value as StatusEntregaValue }))}
                >
                  <SelectTrigger className="h-8 border border-zinc-200 bg-white text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_ENTREGA_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>

              <td className="border-r border-slate-200 p-1 text-center">
                <Input
                  value={ghostRow.fecha_entrega}
                  onChange={(e) => setGhostRow((prev) => ({ ...prev, fecha_entrega: parseDateInput(e.target.value) || e.target.value }))}
                  placeholder="dd/mm/aa"
                  className="h-8 border border-zinc-200 bg-white text-center font-mono text-xs"
                  onBlur={(e) => setGhostRow((prev) => ({ ...prev, fecha_entrega: parseDateInput(e.target.value) || "" }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      void submitGhost()
                    }
                  }}
                />
              </td>

              <td className="p-1 text-center">
                <Badge variant="outline" className="border-dashed bg-transparent px-2 py-1 text-[10px] text-slate-500">
                  Ghost row
                </Badge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">
            Mostrando {(page - 1) * pageSize + 1} a {Math.min(page * pageSize, total)} de {total} registros
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
              Página {page} / {totalPages}
            </div>
            <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
