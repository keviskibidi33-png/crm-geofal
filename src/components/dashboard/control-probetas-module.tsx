"use client"

import { useState, useRef, useEffect, useMemo, useCallback, memo } from "react"
import {
  BarChart3, Clock, AlertTriangle, CheckCircle2, Search, Plus, RefreshCw,
  ChevronLeft, ChevronRight, Loader2, Database, ExternalLink, X, Activity,
  FileSpreadsheet,
} from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useControlProbetas, ProbetaRow, Receipt,
  ELEMENTOS, POZAS, STATUS_ENTREGA, formatDateDisplay, parseDateInput,
} from "@/hooks/use-control-probetas"

const STATUS_DENSIDAD = ["SI", "NO"] as const
type DensidadValue = "SI" | "NO"
import { DialogFullscreen, DialogFullscreenContent } from "@/components/ui/dialog-fullscreen"

function SuggestionInput({
  value,
  onChange,
  options,
  placeholder = "",
  className = "",
  displayClassName = "",
}: {
  value: string
  onChange: (v: string) => void
  options: readonly string[] | string[]
  placeholder?: string
  className?: string
  displayClassName?: string
}) {
  const [localValue, setLocalValue] = useState(value || "")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalValue(value || "")
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredOptions = useMemo(() => {
    const term = (localValue || "").trim().toLowerCase()
    if (!term) return options
    return options.filter(o => o.toLowerCase().includes(term))
  }, [localValue, options])

  const handleCommit = (val: string) => {
    let finalVal = val.trim()
    if (filteredOptions.length > 0) {
      const exact = options.find(o => o.toLowerCase() === finalVal.toLowerCase())
      if (exact) {
        finalVal = exact
      } else {
        finalVal = filteredOptions[0]
      }
    } else {
      finalVal = "-"
    }

    if (finalVal !== value) {
      onChange(finalVal)
    }
    setLocalValue(finalVal)
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            if (localValue === "-") setLocalValue("")
          }}
          className={`w-full min-h-8 px-2 text-center text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 rounded-md ${displayClassName}`}
          title="Click para editar"
        >
          <span className="inline-block max-w-full truncate align-middle">{localValue || placeholder || "-"}</span>
        </button>
      ) : (
        <Input
          autoFocus
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => {
            if (localValue === "-") {
              setLocalValue("")
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              const finalVal = localValue.trim() || "-"
              handleCommit(finalVal)
              setOpen(false)
            }, 180)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCommit(localValue)
              setOpen(false)
              e.currentTarget.blur()
            }
            if (e.key === "Escape") {
              setLocalValue(value || "-")
              setOpen(false)
            }
          }}
          placeholder={placeholder}
          className={`h-8 text-center rounded-lg border-slate-200 bg-white text-xs ${className}`}
        />
      )}
      {open && filteredOptions.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className="block w-full px-2 py-1.5 text-center text-[10px] hover:bg-blue-50 text-slate-700 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                setLocalValue(opt)
                handleCommit(opt)
                setOpen(false)
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// toInputDateFormat removed because it is unused

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
      <span className="block w-full text-center wrap-break-word leading-tight">{String(value ?? "") || placeholder}</span>
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
        className="mx-auto max-w-[160px] text-[11px] font-semibold text-slate-700 leading-tight wrap-break-word"
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
  user?: any
  onNavigateModule?: (module: any, recordId: number | null) => void
}

export function ControlProbetasModule({}: ControlProbetasModuleProps) {
  const store = useControlProbetas()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const [pendingImport, setPendingImport] = useState<ProbetaRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [previewPoza, setPreviewPoza] = useState("1")
  const [previewElemento, setPreviewElemento] = useState<string>("-")

  const handleRequestImport = useCallback((imported: ProbetaRow[]) => {
    setPendingImport(imported)
  }, [])

  const handleApplyPozaToAll = () => {
    if (!pendingImport) return
    setPendingImport(pendingImport.map(p => ({ ...p, poza: previewPoza })))
  }

  const handleApplyElementoToAll = () => {
    if (!pendingImport) return
    setPendingImport(pendingImport.map(p => ({ ...p, elemento: previewElemento })))
  }

  const handleConfirmImport = async () => {
    if (!pendingImport) return
    setImporting(true)
    try {
      for (const probeta of pendingImport) {
        await store.updateRow(probeta.muestra_id, {
          elemento: probeta.elemento || "-",
          poza: probeta.poza || "-",
          densidad: probeta.densidad || "NO",
          fc_kg_cm2: probeta.fc_kg_cm2,
          status_entrega: probeta.status_entrega || "-",
        })
      }
      toast.success("Importación completada correctamente")
      setPendingImport(null)
    } catch (e: any) {
      toast.error("Error durante la importación: " + (e?.message || String(e)))
    } finally {
      setImporting(false)
    }
  }

  const handleCancelImport = () => {
    setPendingImport(null)
  }

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }, [])

  const handleToggleSelectAll = useCallback((ids: number[]) => {
    setSelectedIds(ids)
  }, [])

  const handleRefreshAll = () => {
    store.fetchItems()
    store.fetchKpis()
    store.fetchRecentItems()
  }

  const handlePreviewUpdate = useCallback((id: number, payload: Record<string, unknown>) => {
    setPendingImport((prev) => {
      if (!prev) return prev
      return prev.map((row) => {
        if (row.muestra_id !== id) return row
        const nextRow = { ...row, ...payload }
        const statusEntrega = String(nextRow.status_entrega || "-").toUpperCase()
        if (statusEntrega === "ENTREGADO" || statusEntrega === "INFORME") {
          nextRow.fecha_entrega = new Date().toISOString().slice(0, 10)
        }
        return nextRow
      })
    })
  }, [])

  // Clear selection on filter/page changes
  useEffect(() => {
    setSelectedIds([])
  }, [store.search, store.fechaInicio, store.fechaFin, store.estadoProbeta, store.page])

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
          <DialogTitleBar />
          <div className="flex-1 min-h-0 flex flex-col gap-2 p-1 overflow-hidden">
            <FilterBar
              search={store.search} onSearchChange={store.setSearch}
              fechaInicio={store.fechaInicio} onFechaInicioChange={store.setFechaInicio}
              fechaFin={store.fechaFin} onFechaFinChange={store.setFechaFin}
              estadoProbeta={store.estadoProbeta} onEstadoProbetaChange={store.setEstadoProbeta}
              onExport={() => void store.exportToExcel(selectedIds)}
              onRefresh={handleRefreshAll}
              selectedCount={selectedIds.length}
              searchRecepciones={store.searchRecepciones}
              fetchByRecepcion={store.fetchByRecepcion}
              onRequestImport={handleRequestImport}
            />
            <DataTable
              items={store.items} loading={store.loading}
              onUpdateRow={store.updateRow}
              pageSize={store.pageSize} onPageSizeChange={(v) => { store.setPageSize(v); store.setPage(1) }}
              total={store.total} page={store.page} totalPages={store.totalPages}
              onPrev={() => store.setPage(p => Math.max(1, p - 1))}
              onNext={() => store.setPage(p => Math.min(store.totalPages, p + 1))}
              sortColumn={store.sortColumn} sortDirection={store.sortDirection}
              onSort={(col) => { store.setSort(col); store.setPage(1) }}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              pendingImport={pendingImport}
              importing={importing}
              previewPoza={previewPoza}
              setPreviewPoza={setPreviewPoza}
              previewElemento={previewElemento}
              setPreviewElemento={setPreviewElemento}
              handleApplyPozaToAll={handleApplyPozaToAll}
              handleApplyElementoToAll={handleApplyElementoToAll}
              handleConfirmImport={handleConfirmImport}
              handleCancelImport={handleCancelImport}
              onPreviewUpdate={handlePreviewUpdate}
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
    { label: "EN CURADO", value: kpis.curado, icon: Clock, color: "blue" },
    { label: "PENDIENTES HOY", value: kpis.pendiente, icon: AlertTriangle, color: "amber" },
    { label: "ENSAYADOS", value: kpis.ensayado, icon: CheckCircle2, color: "emerald" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <div className="mt-1 shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs uppercase">
                    {item.numero_recepcion ? item.numero_recepcion.slice(-2) : "--"}
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
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

function DialogTitleBar() {
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
  fechaInicio: string; onFechaInicioChange: (v: string) => void
  fechaFin: string; onFechaFinChange: (v: string) => void
  estadoProbeta: string; onEstadoProbetaChange: (v: string) => void
  onExport: () => void
  onRefresh: () => void
  selectedCount: number
  searchRecepciones: (q: string) => Promise<Receipt[]>
  fetchByRecepcion: (recepcionId: number) => Promise<ProbetaRow[]>
  onRequestImport: (items: ProbetaRow[]) => void
}

function FilterBar({
  search, onSearchChange,
  fechaInicio, onFechaInicioChange,
  fechaFin, onFechaFinChange,
  estadoProbeta, onEstadoProbetaChange,
  onExport, onRefresh, selectedCount,
  searchRecepciones, fetchByRecepcion, onRequestImport
}: FilterBarProps) {
  const [recepcionQuery, setRecepcionQuery] = useState("")
  const [recepcionOpts, setRecepcionOpts] = useState<Receipt[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
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

  const handleSelectRecepcion = async (rec: Receipt) => {
    setRecepcionQuery("")
    setShowDropdown(false)
    const existingProbetas = await fetchByRecepcion(rec.id)
    if (existingProbetas.length > 0) {
      // Default fosa/poza to "1" on import as standard
      onRequestImport(existingProbetas.map((p) => ({ ...p, poza: "1" })))
    } else {
      toast.error("La recepción no contiene probetas para importar")
    }
  }

  // Usar searching para silenciar advertencia de ESLint
  if (searching) {
    // No-op para mantener ESLint contento
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible flex-none">
      <div className="flex flex-col xl:flex-row xl:items-center gap-5 p-4">
        {/* Search */}
        <div className="flex-1 xl:max-w-[210px] relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl border-slate-200"
            placeholder="Buscar por recepción..."
          />
        </div>

        {/* Importador de Recepciones */}
        <div className="flex-1 xl:max-w-[260px] relative" ref={dropdownRef}>
          <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={recepcionQuery}
            onChange={(e) => setRecepcionQuery(e.target.value)}
            onFocus={() => setShowDropdown(recepcionOpts.length > 0)}
            className="pl-9 h-9 text-xs rounded-xl bg-blue-50/20 focus:bg-white border border-blue-100 placeholder:text-blue-500/60 font-semibold"
            placeholder="Importar Recepción..."
          />
          {showDropdown && recepcionOpts.length > 0 && (
            <div className="absolute left-0 z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {recepcionOpts.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => void handleSelectRecepcion(rec)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                >
                  {rec.numero_recepcion} - {rec.cliente}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date Filters & State */}
        <div className="flex flex-wrap items-center gap-3 xl:gap-4">
          {/* Fecha Rotura */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 min-w-fit">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Rotura:</span>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => onFechaInicioChange(e.target.value)}
              className="text-xs bg-transparent border-none focus:outline-none text-slate-700 font-semibold w-[112px]"
              title="Fecha de Rotura"
            />
            {fechaInicio && (
              <button onClick={() => onFechaInicioChange("")} className="text-[10px] text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>

          {/* Fecha Entrega */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl bg-slate-50/50 min-w-fit">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Entrega:</span>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => onFechaFinChange(e.target.value)}
              className="text-xs bg-transparent border-none focus:outline-none text-slate-700 font-semibold w-[112px]"
              title="Fecha de Entrega"
            />
            {fechaFin && (
              <button onClick={() => onFechaFinChange("")} className="text-[10px] text-slate-400 hover:text-slate-600">✕</button>
            )}
          </div>

          {/* Estado Select */}
          <div className="w-[150px] min-w-[150px]">
            <Select value={estadoProbeta || "todos"} onValueChange={(v) => onEstadoProbetaChange(v === "todos" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white">
                <SelectValue placeholder="Filtrar por Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los Estados</SelectItem>
                <SelectItem value="curado">En Curado</SelectItem>
                <SelectItem value="pendiente">Pendiente (Hoy)</SelectItem>
                <SelectItem value="vencido">Vencido (Ayer o antes)</SelectItem>
                <SelectItem value="ensayado">Ensayado</SelectItem>
                <SelectItem value="faltas">Faltas (Overdue)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Button */}
          <Button
            onClick={onExport}
            className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 px-4 shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {selectedCount > 0 ? `Exportar (${selectedCount})` : "Exportar"}
          </Button>

          <Button
            onClick={onRefresh}
            variant="outline"
            className="h-9 rounded-xl border-slate-200 bg-white text-slate-700 font-bold text-xs flex items-center gap-2 px-4 shadow-sm active:scale-95 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════ DATA TABLE ═══════════════════════════ */

const TH = "px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-center border-r border-slate-200 last:border-r-0"
const TD = "px-2 py-1 text-center border-r border-slate-100 last:border-r-0"

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
        <span className={`text-[10px] leading-none ${active ? "text-blue-600" : "text-zinc-400"}`}>
          {active ? (sortDirection === "asc" ? "▲" : "▼") : "▽"}
        </span>
      </div>
    </th>
  )
}

interface DataTableProps {
  items: ProbetaRow[]; loading: boolean
  onUpdateRow: (id: number, payload: Record<string, unknown>) => Promise<void>
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
  selectedIds: number[]
  onToggleSelect: (id: number) => void
  onToggleSelectAll: (ids: number[]) => void
  pendingImport: ProbetaRow[] | null
  importing: boolean
  previewPoza: string
  setPreviewPoza: (v: string) => void
  previewElemento: string
  setPreviewElemento: (v: string) => void
  handleApplyPozaToAll: () => void
  handleApplyElementoToAll: () => void
  handleConfirmImport: () => void
  handleCancelImport: () => void
  onPreviewUpdate: (id: number, payload: Record<string, unknown>) => void
}

function DataTable({
  items, loading, onUpdateRow,
  pageSize, onPageSizeChange, total, page, totalPages, onPrev, onNext,
  sortColumn, sortDirection, onSort,
  selectedIds, onToggleSelect, onToggleSelectAll,
  pendingImport, importing,
  previewPoza, setPreviewPoza,
  previewElemento, setPreviewElemento,
  handleApplyPozaToAll, handleApplyElementoToAll,
  handleConfirmImport, handleCancelImport,
  onPreviewUpdate
}: DataTableProps) {

  const [visibleCount, setVisibleCount] = useState(100)

  const allDisplayItems = pendingImport || items

  // const totalProbetas = items.length
  const uniqueRecepciones = useMemo(() => {
    return new Set(items.map(x => x.numero_recepcion).filter(Boolean)).size
  }, [items])
  const ensayadas = useMemo(() => {
    return items.filter(x => (x.status_ensayo || "").toString().toUpperCase() === "ENSAYADO").length
  }, [items])
  const pendientes = useMemo(() => {
    return items.filter(x => {
      const status = (x.status_ensayo || "").toString().toUpperCase()
      return status === "PENDIENTE" || status === "FALTA" || !status
    }).length
  }, [items])
  const faltantes = useMemo(() => {
    return items.filter(x => (x.status_ensayo || "").toString().toUpperCase() === "FALTA").length
  }, [items])

  useEffect(() => {
    setVisibleCount(100)
  }, [page, pageSize, items.length])

  const displayItems = useMemo(() => {
    return allDisplayItems.slice(0, visibleCount)
  }, [allDisplayItems, visibleCount])

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    if (target.scrollHeight - target.scrollTop <= target.clientHeight * 1.5) {
      setVisibleCount(prev => Math.min(prev + 100, allDisplayItems.length))
    }
  }

  return (
    <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col">
      {pendingImport && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-amber-800">
              Vista previa: {pendingImport.length} probetas a importar
            </span>
            <div className="flex items-center gap-2">
              <Select value={previewPoza} onValueChange={setPreviewPoza}>
                <SelectTrigger className="h-7 w-28 text-[10px] rounded-lg border-amber-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POZAS.filter((v) => v !== "-").map((poza) => (
                    <SelectItem key={poza} value={poza}>{poza}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleApplyPozaToAll} className="h-7 text-[10px] rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100">
                Aplicar poza a todas
              </Button>
            </div>
            
            <div className="flex items-center gap-2 border-l border-amber-300 pl-3">
              <Select value={previewElemento} onValueChange={setPreviewElemento}>
                <SelectTrigger className="h-7 w-28 text-[10px] rounded-lg border-amber-300 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ELEMENTOS.map((elem) => (
                    <SelectItem key={elem} value={elem}>{elem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleApplyElementoToAll} className="h-7 text-[10px] rounded-lg border-amber-300 text-amber-700 hover:bg-amber-100">
                Aplicar elemento a todas
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
      <div className="flex-1 min-h-0 overflow-auto" onScroll={handleScroll}>
        <table className="min-w-[1100px] w-full text-sm border-collapse">
          <thead className="bg-zinc-200 text-zinc-950 font-black border-b-2 border-slate-300 sticky top-0 z-10">
            <tr>
              <th className={`${TH} w-8`}>
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                  checked={items.length > 0 && selectedIds.length === items.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onToggleSelectAll(items.map(it => it.muestra_id))
                    } else {
                      onToggleSelectAll([])
                    }
                  }}
                  disabled={!!pendingImport}
                />
              </th>
              <th className={`${TH} w-8 text-zinc-950 font-black`}>#</th>
              <SortTh label="RECEPCIÓN" column="numero_recepcion" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-28" />
              <SortTh label="CÓDIGO LEM" column="codigo_muestra_lem" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[88px]" />
              <SortTh label="CLIENTE" column="cliente" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[136px]" />
              <SortTh label="ELEMENTO" column="elemento" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[72px]" />
              <SortTh label="F. ROTURA" column="fecha_rotura" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-20" />
              <SortTh label="DENSIDAD" column="densidad" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-12" />
              <SortTh label="EDAD" column="edad" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-10" />
              <SortTh label="F'C" column="fc_kg_cm2" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-16" />
              <SortTh label="POZA" column="poza" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[72px]" />
              <SortTh label="STATUS ENSAYO" column="status_ensayo" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-[84px]" />
              <SortTh label="STATUS ENTREGA" column="status_entrega" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-20" />
              <SortTh label="F. ENTREGA" column="fecha_entrega" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-20" />
              <SortTh label="ESTADO" column="estado_probeta" sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} className="w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && displayItems.length === 0 ? (
              <tr>
                  <td colSpan={15} className="py-20 text-center border-r-0">
                  <Loader2 className="mx-auto mb-3 h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-sm text-slate-500 font-medium">Cargando probetas...</p>
                </td>
              </tr>
            ) : displayItems.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-20 text-center border-r-0">
                  <Database className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm text-slate-500 font-medium">No hay probetas para mostrar</p>
                  <p className="text-xs text-slate-400 mt-1">Importa una recepción usando el selector en la barra superior</p>
                </td>
              </tr>
            ) : (
              displayItems.map((it, idx) => (
                <DataRow
                  key={it.muestra_id}
                  item={it}
                  rowNumber={rowOffset + idx + 1}
                  onUpdate={pendingImport ? async (id, p) => { onPreviewUpdate(id, p) } : onUpdateRow}
                  isPreview={!!pendingImport}
                  bgClass={rowBackgrounds[it.muestra_id]}
                  isSelected={selectedIds.includes(it.muestra_id)}
                  onToggleSelect={onToggleSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* STICKY FOOTER / PAGINADO */}
      <div className="flex-none flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Filas por página:</span>
          <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange(Number(val))}>
            <SelectTrigger className="w-24 h-8 text-xs rounded-xl border-slate-200 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[100, 1000, 2000, 4000].map(v => (
                <SelectItem key={v} value={String(v)}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-slate-400 ml-2 flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Total: {total} registros</span>
        </div>

        {/* Resumen de Estadísticas */}
        <div className="hidden lg:flex items-center gap-6 text-[11px] font-bold text-slate-500 bg-slate-50 px-5 py-1.5 rounded-xl border border-slate-200">
          <span>Recepciones: <strong className="text-slate-800">{uniqueRecepciones}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Ensayadas: <strong className="text-emerald-600">{ensayadas}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Pendientes: <strong className="text-amber-600">{pendientes}</strong></span>
          <span className="text-slate-300">|</span>
          <span>Faltantes: <strong className="text-rose-600">{faltantes}</strong></span>
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



/* ═══════════════════════════ DATA ROW ═══════════════════════════ */

/* ═══════════════════════════ DATA ROW ═══════════════════════════ */

interface DataRowProps {
  item: ProbetaRow
  rowNumber: number
  onUpdate: (id: number, payload: Record<string, unknown>) => Promise<void>
  isPreview?: boolean
  bgClass?: string
  isSelected: boolean
  onToggleSelect: (id: number) => void
}

const DataRow = memo(function DataRow({ item, rowNumber, onUpdate, isPreview, bgClass, isSelected, onToggleSelect }: DataRowProps) {
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
    <tr className={`transition-colors group ${isPreview ? "bg-amber-50/40 hover:bg-amber-50/70" : `${bgClass || "bg-white"} hover:bg-slate-100/60`} ${isSelected ? "bg-blue-50/80 hover:bg-blue-50" : ""}`}>
      {/* Checkbox cell */}
      <td className={TD}>
        <input
          type="checkbox"
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
          checked={isSelected}
          onChange={() => onToggleSelect(item.muestra_id)}
          disabled={isPreview}
        />
      </td>
      {/* # — global row number */}
      <td className={`${TD} font-black text-slate-500 text-[9px]`}>{rowNumber}</td>
      {/* RECEPCIÓN */}
      <td className={TD}>
        <div className="font-bold text-slate-800 text-[11px] leading-tight">{item.numero_recepcion}</div>
        <div className="text-[8px] text-slate-400 font-medium">{item.numero_ot}</div>
      </td>
      {/* CÓDIGO LEM (from recepcion) */}
      <td className={`${TD} font-mono text-[11px] font-bold text-slate-700`}>{item.codigo_muestra_lem || "—"}</td>
      {/* CLIENTE */}
      <td className={TD}>
        <ClientValue value={item.cliente} />
      </td>
      {/* ELEMENTO */}
      <td className={TD}>
        <SuggestionInput
          value={item.elemento || "-"}
          onChange={(v) => void onUpdate(item.muestra_id, { elemento: v })}
          options={ELEMENTOS}
          placeholder="Elemento"
          className="h-7 text-[9px] px-1 font-semibold"
        />
      </td>
      {/* F. ROTURA */}
      <td className={TD}>
        <InlineEditableText
          value={formatDateDisplay(item.fecha_rotura)}
          onCommit={(next) => void onUpdate(item.muestra_id, { fecha_rotura: parseDateInput(next) || "" })}
          className="font-mono text-[11px]"
          placeholder="—"
        />
      </td>
      {/* DENSIDAD — read-only badge */}
      <td className={TD}>
        <span className={`inline-flex items-center justify-center w-full h-7 text-[9px] font-bold rounded-lg border uppercase tracking-wider ${densidadColors[currentDensidad] || "bg-slate-50 text-slate-500 border-slate-200"}`}>
          {currentDensidad}
        </span>
      </td>
      {/* EDAD */}
      <td className={TD}>
        <InlineEditableText
          value={item.edad ?? ""}
          onCommit={(next) => void onUpdate(item.muestra_id, { edad: Number(next) || item.edad })}
          className="font-semibold text-slate-700 text-[10px]"
          placeholder="—"
        />
      </td>
      {/* F'C (read-only) */}
      <td className={`${TD} font-mono text-[11px] font-bold text-slate-700`}>{item.fc_kg_cm2}</td>
      {/* POZA */}
      <td className={TD}>
        <SuggestionInput
          value={item.poza || "-"}
          onChange={(v) => void onUpdate(item.muestra_id, { poza: v })}
          options={POZAS}
          placeholder="Poza"
        />
      </td>
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
          <SelectTrigger className="w-full h-8 text-xs rounded-lg border border-slate-300 shadow-sm bg-white justify-center mx-auto *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-center [&>[data-slot=select-value]_*]:justify-center">
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
        <SuggestionInput
          value={item.status_entrega || "-"}
          options={STATUS_ENTREGA}
          placeholder="Estado"
          className="h-7 text-[9px] px-1 font-semibold"
          onChange={(v) => {
            const payload: Record<string, any> = { status_entrega: v }
            if (v === "ENTREGADO" || v === "INFORME") {
              const today = new Date()
              const yyyy = today.getFullYear()
              const mm = String(today.getMonth() + 1).padStart(2, '0')
              const dd = String(today.getDate()).padStart(2, '0')
              payload.fecha_entrega = `${yyyy}-${mm}-${dd}`
            }
            void onUpdate(item.muestra_id, payload)
          }}
        />
      </td>
      {/* F. ENTREGA */}
      <td className={TD}>
        <InlineEditableText
          value={formatDateDisplay(item.fecha_entrega)}
          onCommit={(next) => void onUpdate(item.muestra_id, { fecha_entrega: parseDateInput(next) || "" })}
          className="font-mono text-[11px]"
          placeholder="—"
        />
      </td>
      {/* ESTADO preview */}
      <td className={`${TD} border-r-0`}>
        <span className={`inline-flex items-center px-1.5 py-0.5 text-[8px] font-bold rounded border uppercase tracking-wider ${statusColors[item.estado_probeta] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
          {item.estado_probeta}
        </span>
      </td>
    </tr>
  )
})
