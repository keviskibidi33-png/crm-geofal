"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import {
  BarChart3, Clock, AlertTriangle, CheckCircle2, Search, Plus, RefreshCw,
  ChevronLeft, ChevronRight, Loader2, Calendar, Database, ExternalLink, X, Activity,
} from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useControlProbetas, ProbetaRow, Receipt, ElementoValue, StatusEnsayoValue, StatusEntregaValue,
  ELEMENTOS, FOSAS, STATUS_ENSAYO, STATUS_ENTREGA, formatDateDisplay, parseDateInput,
} from "@/hooks/use-control-probetas"

const STATUS_DENSIDAD = ["SI", "NO"] as const
type DensidadValue = "SI" | "NO"
import { DialogFullscreen, DialogFullscreenContent } from "@/components/ui/dialog-fullscreen"

function toInputDateFormat(dateStr?: string | null): string {
  if (!dateStr || dateStr === "-") return ""
  const clean = dateStr.split("T")[0].replace(/\//g, "-")
  const parts = clean.split("-")
  if (parts.length === 3) {
    const [a, b, c] = parts
    if (a.length === 4) return `${a}-${b.padStart(2, "0")}-${c.padStart(2, "0")}`
    if (c.length === 4) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`
  }
  return ""
}

function InlineEditableText({
  value,
  onCommit,
  className = "",
  placeholder = "—",
}: {
  value?: string | number | null
  onCommit: (next: string) => void
  className?: string
  placeholder?: string
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
      <span className="block w-full text-center break-words leading-tight">{String(value ?? "") || placeholder}</span>
    </div>
  )
}

function ClientValue({ value }: { value?: string | null }) {
  const text = value?.trim() || "—"
  const isLong = text.length > 36

  if (text === "—") {
    return <span className="block text-center text-slate-400">{text}</span>
  }

  if (isLong) {
    return (
      <div
        className="mx-auto max-w-[160px] text-[11px] font-semibold text-slate-700 leading-tight break-words"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        title={text}
      >
        {text}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[160px] truncate text-[11px] font-semibold text-slate-700 leading-tight" title={text}>
      {text}
    </div>
  )
}

interface ControlProbetasModuleProps {
  user: any
  onNavigateModule: (module: any, recordId: number | null) => void
}

export function ControlProbetasModule({ user, onNavigateModule }: ControlProbetasModuleProps) {
  const store = useControlProbetas()
  const [isOpen, setIsOpen] = useState(false)

  const handleRefreshAll = () => {
    store.fetchItems()
    store.fetchKpis()
    store.fetchRecentItems()
  }

  return (
    <div className="min-h-full bg-[#F8FAFC] p-8 space-y-8 font-sans antialiased">
      {/* ─────────────── DASHBOARD ─────────────── */}
      <Header loading={store.loading} onRefresh={handleRefreshAll} />
      <QuickAccessCard onOpen={() => setIsOpen(true)} />
      <KPICards kpis={store.kpis} loading={store.loading} />
      <RecentPreview items={store.recentItems} loading={store.loading} />

      {/* ─────────────── DIALOG FULLSCREEN ─────────────── */}
      <DialogFullscreen open={isOpen} onOpenChange={setIsOpen}>
        <DialogFullscreenContent
          style={{ backgroundColor: '#fff' }}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={() => setIsOpen(false)}
        >
          <DialogTitleBar onClose={() => setIsOpen(false)} />
          <div className="flex-1 min-h-0 flex flex-col gap-2 p-1 overflow-hidden">
            <FilterBar
              search={store.search} onSearchChange={store.setSearch}
              total={store.total}
            />
          <DataTable
              items={store.items} loading={store.loading}
              onUpdateRow={store.updateRow} onCreateRow={store.createRow}
              searchRecepciones={store.searchRecepciones}
              fetchByRecepcion={store.fetchByRecepcion}
              pageSize={store.pageSize} onPageSizeChange={(v) => { store.setPageSize(v); store.setPage(1) }}
              total={store.total} page={store.page} totalPages={store.totalPages}
              onPrev={() => store.setPage(p => Math.max(1, p - 1))}
              onNext={() => store.setPage(p => Math.min(store.totalPages, p + 1))}
              sortColumn={store.sortColumn} sortDirection={store.sortDirection}
              onSort={(col) => { store.setSort(col); store.setPage(1) }}
            />
          </div>
        </DialogFullscreenContent>
      </DialogFullscreen>
    </div>
  )
}

/* ═══════════════════════════ HEADER ═══════════════════════════ */

function Header({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Control de Probetas</h1>
        <p className="text-slate-500 font-medium mt-1">Gestión técnica y trazabilidad de probetas de concreto</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">EN LÍNEA</span>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} className="rounded-xl border-slate-200">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </div>
  )
}

/* ═══════════════════════════ QUICK ACCESS CARD ═══════════════════════════ */

function QuickAccessCard({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xl">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 uppercase">Matriz Técnica de Probetas</h3>
            <p className="text-slate-500 text-xs font-medium mt-1">Acceso directo al control, registro y trazabilidad de probetas de concreto</p>
          </div>
        </div>
        <button
          onClick={onOpen}
          className="flex items-center gap-3 px-5 py-3 bg-[#0070F3] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 active:scale-95"
        >
          <ExternalLink className="h-5 w-5" strokeWidth={3} />
          ABRIR TABLA DE CONTROL
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════ KPI CARDS ═══════════════════════════ */

function KPICards({ kpis, loading }: { kpis: any; loading: boolean }) {
  const cards = [
    { label: "TOTAL PROBETAS", value: kpis.total, icon: Database, color: "slate" },
    { label: "EN CURADO", value: kpis.curado, icon: Clock, color: "blue" },
    { label: "PENDIENTES HOY", value: kpis.pendiente, icon: AlertTriangle, color: "amber" },
    { label: "ENSAYADOS", value: kpis.ensayado, icon: CheckCircle2, color: "emerald" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
              {loading ? (
                <div className="mt-2 h-8 w-16 bg-slate-100 rounded-lg animate-pulse" />
              ) : (
                <p className={`text-2xl font-black mt-1 tabular-nums text-${card.color}-600`}>{card.value}</p>
              )}
            </div>
            <div className={`h-12 w-12 rounded-full bg-${card.color}-50 border border-${card.color}-100 flex items-center justify-center text-${card.color}-600`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════ RECENT PREVIEW ═══════════════════════════ */

function RecentPreview({ items, loading }: { items: ProbetaRow[]; loading: boolean }) {
  const statusColors: Record<string, string> = {
    ensayado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pendiente: "bg-amber-50 text-amber-700 border-amber-200",
    vencido: "bg-red-50 text-red-700 border-red-200",
    curado: "bg-blue-50 text-blue-700 border-blue-200",
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-500" />
          Últimos Registros
        </h3>
        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
          Últimos 5
        </span>
      </div>
      <div className="p-0">
        {loading && items.length === 0 ? (
          <div className="divide-y divide-slate-100">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-4">
                <div className="h-8 w-8 bg-slate-100 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-slate-50 rounded animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-slate-100 rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <Database className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs text-slate-500 font-medium">No hay registros recientes</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.muestra_id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="mt-1 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs uppercase">
                    {item.numero_recepcion ? item.numero_recepcion.slice(-2) : "--"}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{item.numero_recepcion}</span>
                      <span className="text-[10px] text-slate-400 font-medium">|</span>
                      <span className="text-xs text-slate-600 font-semibold truncate block max-w-full" title={item.cliente}>
                        {item.cliente || "Sin cliente"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Código: <span className="font-bold text-slate-700">{item.identificacion_muestra || "-"}</span></span>
                      <span>F'C: <span className="font-bold text-slate-700">{item.fc_kg_cm2}</span></span>
                      <span>Elemento: <span className="font-bold text-slate-700">{item.elemento || "-"}</span></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${statusColors[item.estado_probeta] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
                    {item.estado_probeta}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════ DIALOG TITLE BAR ═══════════════════════════ */

function DialogTitleBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-none flex items-center justify-between px-6 py-2 bg-white border-b border-zinc-200">
      <div className="flex items-center gap-3">
        <Activity className="w-4 h-4 text-emerald-600" />
        <DialogPrimitive.Title asChild>
          <h2 className="font-bold text-zinc-900 text-xs uppercase tracking-widest">Control Probetas - Matriz de Datos</h2>
        </DialogPrimitive.Title>
        <DialogPrimitive.Description asChild>
          <span className="sr-only">Matriz de datos de control de probetas de concreto</span>
        </DialogPrimitive.Description>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">Online</span>
        </div>
        <DialogPrimitive.Close asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-500">
            <X className="h-4 w-4" />
          </Button>
        </DialogPrimitive.Close>
      </div>
    </div>
  )
}

/* ═══════════════════════════ FILTER BAR ═══════════════════════════ */

interface FilterBarProps {
  search: string; onSearchChange: (v: string) => void
  total: number
}

function FilterBar({ search, onSearchChange, total }: FilterBarProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-none">
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-4">
        <div className="flex-1 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10 text-sm rounded-xl border-slate-200"
            placeholder="Buscar por recepción, cliente, código..."
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            <Calendar className="h-4 w-4" />
            {total} registros
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════ DATA TABLE ═══════════════════════════ */

const TH = "px-2 py-2 text-[9px] font-black uppercase tracking-wider text-center border-r border-slate-200 last:border-r-0"
const TD = "px-2 py-1.5 text-center border-r border-slate-100 last:border-r-0"

function SortTh({ label, column, sortColumn, sortDirection, onSort, className = "" }: {
  label: string; column: string; sortColumn: string | null; sortDirection: "asc" | "desc"
  onSort: (column: string) => void; className?: string
}) {
  const active = sortColumn === column
  return (
    <th
      className={`${TH} ${className} text-zinc-950 font-black cursor-pointer select-none hover:bg-zinc-300 transition-colors`}
      onClick={() => onSort(column)}
    >
      <div className="flex items-center justify-center gap-1">
        <span>{label}</span>
        <span className={`text-[8px] leading-none ${active ? "text-blue-600" : "text-zinc-400"}`}>
          {active ? (sortDirection === "asc" ? "▲" : "▼") : "▽"}
        </span>
      </div>
    </th>
  )
}

interface DataTableProps {
  items: ProbetaRow[]; loading: boolean
  onUpdateRow: (id: number, payload: Record<string, unknown>) => Promise<void>
  onCreateRow: (payload: Record<string, unknown>) => Promise<void>
  searchRecepciones: (q: string) => Promise<Receipt[]>
  fetchByRecepcion: (recepcionId: number) => Promise<ProbetaRow[]>
  pageSize: number
  onPageSizeChange: (v: number) => void
  total: number
  page: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
  sortColumn: string | null
  sortDirection: "asc" | "desc"
  onSort: (column: string) => void
}

function DataTable({
  items, loading, onUpdateRow, onCreateRow, searchRecepciones, fetchByRecepcion,
  pageSize, onPageSizeChange, total, page, totalPages, onPrev, onNext,
  sortColumn, sortDirection, onSort
}: DataTableProps) {
  const [pendingImport, setPendingImport] = useState<ProbetaRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [previewFosa, setPreviewFosa] = useState("FOSA 1")

  const handleRequestImport = (imported: ProbetaRow[]) => {
    setPendingImport(imported)
  }

  const handleApplyFosaToAll = () => {
    if (!pendingImport) return
    setPendingImport(pendingImport.map(p => ({ ...p, fosa: previewFosa })))
  }

  const handleConfirmImport = async () => {
    if (!pendingImport) return
    setImporting(true)
    for (const probeta of pendingImport) {
      await onUpdateRow(probeta.muestra_id, {
        elemento: probeta.elemento || "-",
        fosa: probeta.fosa || "-",
        densidad: probeta.densidad || "NO",
        fc_kg_cm2: probeta.fc_kg_cm2,
        status_entrega: probeta.status_entrega || "-",
      })
    }
    setPendingImport(null)
    setImporting(false)
  }

  const handleCancelImport = () => {
    setPendingImport(null)
  }

  const displayItems = pendingImport || items

  const rowBackgrounds = useMemo(() => {
    const mapping: Record<string, string> = {}
    let lastRecepcion = ""
    let isBlue = false
    for (const it of displayItems) {
      const rec = it.numero_recepcion || ""
      if (rec !== lastRecepcion) {
        isBlue = !isBlue
        lastRecepcion = rec
      }
      mapping[it.muestra_id] = isBlue ? "bg-[#f0f7ff]" : "bg-white"
    }
    return mapping
  }, [displayItems])

  // Global row offset for the # column
  const rowOffset = (page - 1) * pageSize

  return (
    <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      {pendingImport && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-amber-800">
              Vista previa: {pendingImport.length} probetas a importar
            </span>
            <div className="flex items-center gap-2">
              <Select value={previewFosa} onValueChange={setPreviewFosa}>
                <SelectTrigger className="h-7 w-28 text-[10px] rounded-lg border-amber-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOSAS.filter((v) => v !== "-").map((fosa) => (
                    <SelectItem key={fosa} value={fosa}>{fosa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleApplyFosaToAll} className="h-7 text-[10px] rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100">
                Aplicar fosa a todas
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelImport} className="h-7 text-[10px] rounded-lg border-slate-200">
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirmImport} disabled={importing} className="h-7 text-[10px] rounded-lg bg-emerald-600 hover:bg-emerald-700">
              {importing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Aprobar importación
            </Button>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="min-w-[1100px] w-full text-sm border-collapse">
          <thead className="bg-zinc-200 text-zinc-950 font-black border-b-2 border-slate-300 sticky top-0 z-10">
            <tr>
              <th className={`${TH} w-8 text-zinc-950 font-black`}>#</th>
              <SortTh label="RECEPCIÓN" column="numero_recepcion" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-28" />
              <SortTh label="CÓDIGO LEM" column="codigo_muestra_lem" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[88px]" />
              <SortTh label="CLIENTE" column="cliente" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[136px]" />
              <SortTh label="ELEMENTO" column="elemento" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[72px]" />
              <SortTh label="F. ROTURA" column="fecha_rotura" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-20" />
              <SortTh label="DENSIDAD" column="densidad" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-16" />
              <SortTh label="EDAD" column="edad" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-20" />
              <SortTh label="FOSA" column="fosa" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[72px]" />
              <SortTh label="F'C" column="fc_kg_cm2" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-16" />
              <SortTh label="STATUS ENSAYO" column="status_ensayo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[84px]" />
              <SortTh label="STATUS ENTREGA" column="status_entrega" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-20" />
              <SortTh label="F. ENTREGA" column="fecha_entrega" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-20" />
              <SortTh label="ESTADO" column="estado_probeta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && displayItems.length === 0 ? (
              <tr>
                  <td colSpan={14} className="py-20 text-center border-r-0">
                  <Loader2 className="mx-auto mb-3 h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">Cargando probetas...</p>
                </td>
              </tr>
            ) : displayItems.length === 0 ? (
              <>
                <tr>
                  <td colSpan={14} className="py-20 text-center border-r-0">
                    <Database className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="text-sm text-slate-500 font-medium">No hay probetas para mostrar</p>
                    <p className="text-xs text-slate-400 mt-1">Importa una recepción usando el formulario inferior</p>
                  </td>
                </tr>
                {!pendingImport && <GhostRow onCreateRow={onCreateRow} searchRecepciones={searchRecepciones} fetchByRecepcion={fetchByRecepcion} onRequestImport={handleRequestImport} />}
              </>
            ) : (
              <>
                {displayItems.map((it, idx) => (
                  <DataRow
                    key={it.muestra_id}
                    item={it}
                    rowNumber={rowOffset + idx + 1}
                    onUpdate={onUpdateRow}
                    isPreview={!!pendingImport}
                    bgClass={rowBackgrounds[it.muestra_id]}
                  />
                ))}
                {!pendingImport && <GhostRow onCreateRow={onCreateRow} searchRecepciones={searchRecepciones} fetchByRecepcion={fetchByRecepcion} onRequestImport={handleRequestImport} />}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* STICKY FOOTER / PAGINADO */}
      <div className="flex-none flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filas por página:</span>
          <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange(Number(val))}>
            <SelectTrigger className="w-16 h-8 text-xs rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[100, 1000, 2000, 4000].map(v => (
                <SelectItem key={v} value={String(v)}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-400 ml-2">Total: {total} registros</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 font-medium">Página {page} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-slate-200" onClick={onPrev} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl border-slate-200" onClick={onNext} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════ GHOST ROW ═══════════════════════════ */

interface GhostRowProps {
  onCreateRow: (payload: Record<string, unknown>) => Promise<void>
  searchRecepciones: (q: string) => Promise<Receipt[]>
  fetchByRecepcion: (recepcionId: number) => Promise<ProbetaRow[]>
  onRequestImport: (items: ProbetaRow[]) => void
}

function GhostRow({ onCreateRow, searchRecepciones, fetchByRecepcion, onRequestImport }: GhostRowProps) {
  const [recepcionQuery, setRecepcionQuery] = useState("")
  const [selectedFosa, setSelectedFosa] = useState("FOSA 1")
  const [recepcionOpts, setRecepcionOpts] = useState<Receipt[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!recepcionQuery.trim()) { setRecepcionOpts([]); return }
      setSearching(true)
      const results = await searchRecepciones(recepcionQuery)
      setRecepcionOpts(results)
      setShowDropdown(results.length > 0)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [recepcionQuery, searchRecepciones])

  const checkPosition = () => {
    if (dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setOpenUpward(spaceBelow < 220)
    }
  }

  useEffect(() => {
    if (showDropdown) {
      checkPosition()
      window.addEventListener("scroll", checkPosition, true)
      window.addEventListener("resize", checkPosition)
    }
    return () => {
      window.removeEventListener("scroll", checkPosition, true)
      window.removeEventListener("resize", checkPosition)
    }
  }, [showDropdown])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectRecepcion = async (rec: Receipt) => {
    setRecepcionQuery(rec.numero_recepcion)
    setShowDropdown(false)
    const existingProbetas = await fetchByRecepcion(rec.id)
    if (existingProbetas.length > 0) {
      onRequestImport(existingProbetas.map((p) => ({ ...p, fosa: selectedFosa })))
    }
    setRecepcionQuery("")
  }

  return (
    <tr className="bg-slate-50/80 border-b-2 border-slate-200">
      {/* # col — no action */}
      <td className={TD}></td>
      {/* RECEPCIÓN: autocomplete search to import */}
      <td className={TD} colSpan={3}>
        <div className="relative" ref={dropdownRef}>
        <Input
          value={recepcionQuery}
            onChange={(e) => { setRecepcionQuery(e.target.value) }}
            onFocus={() => { if (recepcionOpts.length > 0) setShowDropdown(true) }}
            className="h-8 text-xs text-center rounded-lg border-slate-200"
            placeholder="Buscar recepción para importar..."
          />
          <div className="mt-2">
            <Select value={selectedFosa} onValueChange={setSelectedFosa}>
              <SelectTrigger className="h-8 text-xs rounded-lg border-slate-200">
                <SelectValue placeholder="Fosa" />
              </SelectTrigger>
              <SelectContent>
                {FOSAS.filter((v) => v !== "-").map((fosa) => (
                  <SelectItem key={fosa} value={fosa}>{fosa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showDropdown && (
            <div className={`absolute left-0 z-50 w-full rounded-xl border border-slate-200 bg-white shadow-xl ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
              {searching ? (
                <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                </div>
              ) : (
                recepcionOpts.map((rec) => (
                  <button
                    key={rec.id} type="button"
                    className="block w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    onMouseDown={(e) => { e.preventDefault(); void handleSelectRecepcion(rec) }}
                  >
                    <div className="font-bold text-slate-800">{rec.numero_recepcion}</div>
                    <div className="text-[10px] text-slate-500">{rec.numero_ot || "-"} · {rec.cliente || "Sin cliente"}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </td>
      {/* ELEMENTO */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* F. ROTURA */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* DENSIDAD */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* EDAD */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* FOSA */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* F'C */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* STATUS ENSAYO */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* STATUS ENTREGA */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* F. ENTREGA */}
      <td className={TD}><span className="text-[11px] text-slate-400">—</span></td>
      {/* ESTADO preview */}
      <td className={`${TD} border-r-0`}><span className="text-[11px] text-slate-400">—</span></td>
    </tr>
  )
}

/* ═══════════════════════════ DATA ROW ═══════════════════════════ */

/* ═══════════════════════════ DATA ROW ═══════════════════════════ */

interface DataRowProps {
  item: ProbetaRow
  rowNumber: number
  onUpdate: (id: number, payload: Record<string, unknown>) => Promise<void>
  isPreview?: boolean
  bgClass?: string
}

function DataRow({ item, rowNumber, onUpdate, isPreview, bgClass }: DataRowProps) {
  const statusColors: Record<string, string> = {
    ensayado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pendiente: "bg-amber-50 text-amber-700 border-amber-200",
    vencido: "bg-red-50 text-red-700 border-red-200",
    curado: "bg-blue-50 text-blue-700 border-blue-200",
  }

  const densidadColors: Record<string, string> = {
    SI: "bg-emerald-50 text-emerald-700 border-emerald-200",
    NO: "bg-slate-50 text-slate-500 border-slate-200",
  }

  const currentDensidad = (item.densidad === "SI" ? "SI" : "NO") as DensidadValue

  return (
    <tr className={`transition-colors group ${isPreview ? "bg-amber-50/40 hover:bg-amber-50/70" : `${bgClass || "bg-white"} hover:bg-slate-100/60`}`}>
      {/* # — global row number */}
      <td className={`${TD} font-black text-slate-500 text-[10px]`}>{rowNumber}</td>
      {/* RECEPCIÓN */}
      <td className={TD}>
        <div className="font-bold text-slate-800 text-xs">{item.numero_recepcion}</div>
        <div className="text-[9px] text-slate-400 font-medium">{item.numero_ot}</div>
      </td>
      {/* CÓDIGO LEM (from recepcion) */}
      <td className={`${TD} font-mono text-xs font-bold text-slate-700`}>{item.codigo_muestra_lem || "—"}</td>
      {/* CLIENTE */}
      <td className={TD}>
        <ClientValue value={item.cliente} />
      </td>
      {/* ELEMENTO */}
      <td className={TD}>
        <Select value={(item.elemento as ElementoValue) || "-"} onValueChange={(v) => void onUpdate(item.muestra_id, { elemento: v })}>
          <SelectTrigger className="w-full h-8 text-xs rounded-lg border border-slate-300 shadow-sm bg-white justify-center mx-auto [&>[data-slot=select-value]]:flex-1 [&>[data-slot=select-value]]:justify-center [&>[data-slot=select-value]_*]:justify-center"><SelectValue /></SelectTrigger>
          <SelectContent>{ELEMENTOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      {/* F. ROTURA */}
      <td className={TD}>
        <InlineEditableText
          value={formatDateDisplay(item.fecha_rotura)}
          onCommit={(next) => void onUpdate(item.muestra_id, { fecha_rotura: parseDateInput(next) || "" })}
          className="font-mono text-xs"
          placeholder="—"
        />
      </td>
      {/* DENSIDAD — read-only badge */}
      <td className={TD}>
        <span className={`inline-flex items-center justify-center w-full h-8 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${densidadColors[currentDensidad] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
          {currentDensidad}
        </span>
      </td>
      {/* EDAD */}
      <td className={TD}>
        <InlineEditableText
          value={item.edad ?? ""}
          onCommit={(next) => void onUpdate(item.muestra_id, { edad: Number(next) || item.edad })}
          className="font-semibold text-slate-700 text-[11px]"
          placeholder="—"
        />
      </td>
      {/* FOSA */}
      <td className={TD}>
        <Select value={item.fosa || "-"} onValueChange={(v) => void onUpdate(item.muestra_id, { fosa: v })}>
          <SelectTrigger className="w-full h-8 text-xs rounded-lg border border-slate-300 shadow-sm bg-white justify-center mx-auto [&>[data-slot=select-value]]:flex-1 [&>[data-slot=select-value]]:justify-center [&>[data-slot=select-value]_*]:justify-center"><SelectValue /></SelectTrigger>
          <SelectContent>{FOSAS.filter((o) => o !== "-").map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      {/* F'C (read-only) */}
      <td className={`${TD} font-mono text-xs font-bold text-slate-700`}>{item.fc_kg_cm2}</td>
      {/* STATUS ENSAYO */}
      <td className={TD}>
        {(() => {
          const statusEnsayoReal = ((item.status_ensayo || "PENDIENTE").toString().trim().toUpperCase() || "PENDIENTE") as "PENDIENTE" | "FALTA" | "ENSAYADO" | "ANULADO"
          const statusEnsayoDisplay = statusEnsayoReal === "ANULADO" ? "ANULADO" : statusEnsayoReal
          const statusEnsayoItems = statusEnsayoReal === "ANULADO" ? ["ANULADO"] : [statusEnsayoDisplay, "ANULADO"]
          return (
        <Select
              value={statusEnsayoDisplay}
          onValueChange={(v) => {
            if (v === "ANULADO") {
              void onUpdate(item.muestra_id, { status_ensayo: "ANULADO", status_entrega: "ANULADAS" })
            }
          }}
        >
          <SelectTrigger className="w-full h-8 text-xs rounded-lg border border-slate-300 shadow-sm bg-white justify-center mx-auto [&>[data-slot=select-value]]:flex-1 [&>[data-slot=select-value]]:justify-center [&>[data-slot=select-value]_*]:justify-center">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusEnsayoItems.map((status) => (
              <SelectItem key={status} value={status} disabled={status !== "ANULADO"}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          )
        })()}
      </td>
      {/* STATUS ENTREGA */}
      <td className={TD}>
        <Select
          value={(item.status_ensayo === "ANULADO" ? "ANULADAS" : item.status_ensayo === "ENSAYADO" ? "ROTAS" : (item.status_entrega as StatusEntregaValue) || "-")}
          onValueChange={(v) => {
            const payload: Record<string, any> = { status_entrega: v }
            if ((v === "ENTREGADO" || v === "INFORME LISTO") && (!item.fecha_entrega || item.fecha_entrega === "-")) {
              const today = new Date()
              const yyyy = today.getFullYear()
              const mm = String(today.getMonth() + 1).padStart(2, '0')
              const dd = String(today.getDate()).padStart(2, '0')
              payload.fecha_entrega = `${yyyy}/${mm}/${dd}`
            }
            void onUpdate(item.muestra_id, payload)
          }}
        >
          <SelectTrigger className="w-full h-8 text-xs rounded-lg border border-slate-300 shadow-sm bg-white justify-center mx-auto [&>[data-slot=select-value]]:flex-1 [&>[data-slot=select-value]]:justify-center [&>[data-slot=select-value]_*]:justify-center"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_ENTREGA.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      {/* F. ENTREGA */}
      <td className={TD}>
        <InlineEditableText
          value={formatDateDisplay(item.fecha_entrega)}
          onCommit={(next) => void onUpdate(item.muestra_id, { fecha_entrega: parseDateInput(next) || "" })}
          className="font-mono text-xs"
          placeholder="—"
        />
      </td>
      {/* ESTADO preview */}
      <td className={`${TD} border-r-0`}>
        <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded border uppercase tracking-wider ${statusColors[item.estado_probeta] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
          {item.estado_probeta}
        </span>
      </td>
    </tr>
  )
}
