"use client"

import { useState, useRef, useEffect } from "react"
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
  ELEMENTOS, STATUS_ENSAYO, STATUS_ENTREGA, formatDateDisplay, parseDateInput,
} from "@/hooks/use-control-probetas"
import { DialogFullscreen, DialogFullscreenContent } from "@/components/ui/dialog-fullscreen"

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
          <div className="flex-1 min-h-0 flex flex-col gap-4 p-4 overflow-hidden">
            <FilterBar
              search={store.search} onSearchChange={store.setSearch}
              pageSize={store.pageSize} onPageSizeChange={(v) => { store.setPageSize(v); store.setPage(1) }}
              total={store.total} page={store.page} totalPages={store.totalPages}
              onPrev={() => store.setPage(p => Math.max(1, p - 1))}
              onNext={() => store.setPage(p => Math.min(store.totalPages, p + 1))}
            />
            <DataTable
              items={store.items} loading={store.loading}
              onUpdateRow={store.updateRow} onCreateRow={store.createRow}
              searchRecepciones={store.searchRecepciones}
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
        <h2 className="font-bold text-zinc-900 text-xs uppercase tracking-widest">Control Probetas - Matriz de Datos</h2>
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
  pageSize: number; onPageSizeChange: (v: number) => void
  total: number; page: number; totalPages: number
  onPrev: () => void; onNext: () => void
}

function FilterBar({ search, onSearchChange, pageSize, onPageSizeChange, total, page, totalPages, onPrev, onNext }: FilterBarProps) {
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
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-10 w-[100px] text-sm rounded-xl border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            <Calendar className="h-4 w-4" />
            {total} registros
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={onPrev} disabled={page <= 1} className="rounded-xl border-slate-200 h-9 w-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-bold text-slate-700 min-w-[80px] text-center">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="icon" onClick={onNext} disabled={page >= totalPages} className="rounded-xl border-slate-200 h-9 w-9">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════ DATA TABLE ═══════════════════════════ */

interface DataTableProps {
  items: ProbetaRow[]; loading: boolean
  onUpdateRow: (id: number, payload: Record<string, unknown>) => Promise<void>
  onCreateRow: (payload: Record<string, unknown>) => Promise<void>
  searchRecepciones: (q: string) => Promise<Receipt[]>
}

function DataTable({ items, loading, onUpdateRow, onCreateRow, searchRecepciones }: DataTableProps) {
  return (
    <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="h-full overflow-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-300 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-14 text-center">ITEM</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-40">RECEPCIÓN</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-44">CÓDIGO</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-52">CLIENTE</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-36">ELEMENTO</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-32 text-center">F. ROTURA</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-28 text-center">DENSIDAD</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-28 text-center">F'C</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-36">STATUS ENSAYO</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-36">STATUS ENTREGA</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-32 text-center">F. ENTREGA</th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-wider w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <GhostRow onCreateRow={onCreateRow} searchRecepciones={searchRecepciones} />
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-20 text-center">
                  <Loader2 className="mx-auto mb-3 h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">Cargando probetas...</p>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-20 text-center">
                  <Database className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm text-slate-500 font-medium">No hay probetas para mostrar</p>
                  <p className="text-xs text-slate-400 mt-1">Crea una nueva usando el formulario superior</p>
                </td>
              </tr>
            ) : (
              items.map((it) => <DataRow key={it.muestra_id} item={it} onUpdate={onUpdateRow} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════ GHOST ROW ═══════════════════════════ */

interface GhostRowProps {
  onCreateRow: (payload: Record<string, unknown>) => Promise<void>
  searchRecepciones: (q: string) => Promise<Receipt[]>
}

function GhostRow({ onCreateRow, searchRecepciones }: GhostRowProps) {
  const [saving, setSaving] = useState(false)
  const [recepcionQuery, setRecepcionQuery] = useState("")
  const [recepcionOpts, setRecepcionOpts] = useState<Receipt[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [ghost, setGhost] = useState({
    recepcion_id: null as number | null,
    numero_recepcion: "",
    numero_ot: "",
    cliente: "",
    identificacion_muestra: "",
    elemento: "-" as ElementoValue,
    fecha_rotura: "",
    densidad: "",
    fc_kg_cm2: 280,
    status_ensayo: "-" as StatusEnsayoValue,
    status_entrega: "-" as StatusEntregaValue,
    fecha_entrega: "",
  })
  const codeRef = useRef<HTMLInputElement>(null)
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSave = async () => {
    if (!ghost.recepcion_id || !ghost.identificacion_muestra.trim()) return
    setSaving(true)
    await onCreateRow(ghost)
    setGhost(g => ({ ...g, identificacion_muestra: "", fecha_rotura: "", densidad: "", fecha_entrega: "" }))
    setRecepcionQuery("")
    requestAnimationFrame(() => codeRef.current?.focus())
    setSaving(false)
  }

  return (
    <tr className="bg-slate-50/80 border-b-2 border-slate-200">
      <td className="px-4 py-2 text-center">
        <button
          type="button" onClick={handleSave} disabled={saving}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0070F3] text-white hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="relative" ref={dropdownRef}>
          <Input
            value={recepcionQuery}
            onChange={(e) => {
              setRecepcionQuery(e.target.value)
              setGhost(g => ({ ...g, recepcion_id: null, numero_recepcion: "", numero_ot: "", cliente: "" }))
            }}
            onFocus={() => recepcionOpts.length > 0 && setShowDropdown(true)}
            className="h-9 text-xs rounded-lg border-slate-200"
            placeholder="Buscar recepción..."
          />
          {showDropdown && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl">
              {searching ? (
                <div className="p-3 text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" /> Buscando...
                </div>
              ) : (
                recepcionOpts.map((rec) => (
                  <button
                    key={rec.id} type="button"
                    className="block w-full px-3 py-2.5 text-left text-xs hover:bg-blue-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setGhost(g => ({ ...g, recepcion_id: rec.id, numero_recepcion: rec.numero_recepcion, numero_ot: rec.numero_ot || "", cliente: rec.cliente || "" }))
                      setRecepcionQuery(rec.numero_recepcion)
                      setShowDropdown(false)
                    }}
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
      <td className="px-3 py-2">
        <Input
          ref={codeRef} value={ghost.identificacion_muestra}
          onChange={(e) => setGhost(g => ({ ...g, identificacion_muestra: e.target.value }))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSave() } }}
          className="h-9 text-xs font-mono rounded-lg border-slate-200"
          placeholder="001-CO-26"
        />
      </td>
      <td className="px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">{ghost.cliente || "—"}</span>
      </td>
      <td className="px-3 py-2">
        <Select value={ghost.elemento} onValueChange={(v) => setGhost(g => ({ ...g, elemento: v as ElementoValue }))}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{ELEMENTOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input
          value={ghost.fecha_rotura}
          onChange={(e) => setGhost(g => ({ ...g, fecha_rotura: e.target.value }))}
          onBlur={(e) => setGhost(g => ({ ...g, fecha_rotura: parseDateInput(e.target.value) }))}
          className="h-9 text-center font-mono text-xs rounded-lg border-slate-200"
          placeholder="DD/MM/AA"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={ghost.densidad}
          onChange={(e) => setGhost(g => ({ ...g, densidad: e.target.value }))}
          className="h-9 text-center text-xs rounded-lg border-slate-200"
          placeholder="2.400"
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number" value={ghost.fc_kg_cm2}
          onChange={(e) => setGhost(g => ({ ...g, fc_kg_cm2: Number(e.target.value) || 0 }))}
          className="h-9 text-center text-xs rounded-lg border-slate-200"
        />
      </td>
      <td className="px-3 py-2">
        <Select value={ghost.status_ensayo} onValueChange={(v) => setGhost(g => ({ ...g, status_ensayo: v as StatusEnsayoValue }))}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_ENSAYO.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select value={ghost.status_entrega} onValueChange={(v) => setGhost(g => ({ ...g, status_entrega: v as StatusEntregaValue }))}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_ENTREGA.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input
          value={ghost.fecha_entrega}
          onChange={(e) => setGhost(g => ({ ...g, fecha_entrega: e.target.value }))}
          onBlur={(e) => setGhost(g => ({ ...g, fecha_entrega: parseDateInput(e.target.value) }))}
          className="h-9 text-center font-mono text-xs rounded-lg border-slate-200"
          placeholder="DD/MM/AA"
        />
      </td>
      <td className="px-3 py-2"></td>
    </tr>
  )
}

/* ═══════════════════════════ DATA ROW ═══════════════════════════ */

interface DataRowProps {
  item: ProbetaRow
  onUpdate: (id: number, payload: Record<string, unknown>) => Promise<void>
}

function DataRow({ item, onUpdate }: DataRowProps) {
  const statusColors: Record<string, string> = {
    ensayado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pendiente: "bg-amber-50 text-amber-700 border-amber-200",
    vencido: "bg-red-50 text-red-700 border-red-200",
    curado: "bg-blue-50 text-blue-700 border-blue-200",
  }

  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-6 py-4 text-center font-bold text-slate-700">{item.item_numero}</td>
      <td className="px-6 py-4">
        <div className="font-bold text-slate-800">{item.numero_recepcion}</div>
        <div className="text-[10px] text-slate-400 font-medium">{item.numero_ot}</div>
      </td>
      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">{item.identificacion_muestra || "—"}</td>
      <td className="px-6 py-4">
        <span className="text-xs font-semibold text-slate-700 truncate block max-w-[200px]" title={item.cliente}>{item.cliente}</span>
      </td>
      <td className="px-4 py-3">
        <Select value={(item.elemento as ElementoValue) || "-"} onValueChange={(v) => void onUpdate(item.muestra_id, { elemento: v })}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{ELEMENTOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <Input
          defaultValue={formatDateDisplay(item.fecha_rotura)}
          className="h-9 text-center font-mono text-xs rounded-lg border-slate-200"
          onBlur={(e) => void onUpdate(item.muestra_id, { fecha_rotura: parseDateInput(e.target.value) || "" })}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          defaultValue={item.densidad || ""}
          className="h-9 text-center text-xs rounded-lg border-slate-200"
          onBlur={(e) => void onUpdate(item.muestra_id, { densidad: e.target.value || "-" })}
        />
      </td>
      <td className="px-4 py-3">
        <Input
          type="number" defaultValue={item.fc_kg_cm2}
          className="h-9 text-center text-xs rounded-lg border-slate-200"
          onBlur={(e) => void onUpdate(item.muestra_id, { fc_kg_cm2: Number(e.target.value) || 0 })}
        />
      </td>
      <td className="px-4 py-3">
        <Select value={(item.status_ensayo as StatusEnsayoValue) || "-"} onValueChange={(v) => void onUpdate(item.muestra_id, { status_ensayo: v })}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_ENSAYO.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <Select value={(item.status_entrega as StatusEntregaValue) || "-"} onValueChange={(v) => void onUpdate(item.muestra_id, { status_entrega: v })}>
          <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200"><SelectValue /></SelectTrigger>
          <SelectContent>{STATUS_ENTREGA.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3">
        <Input
          defaultValue={formatDateDisplay(item.fecha_entrega)}
          className="h-9 text-center font-mono text-xs rounded-lg border-slate-200"
          onBlur={(e) => void onUpdate(item.muestra_id, { fecha_entrega: parseDateInput(e.target.value) || "" })}
        />
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-lg border uppercase tracking-wider ${statusColors[item.estado_probeta] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
          {item.estado_probeta}
        </span>
      </td>
    </tr>
  )
}
