"use client"

import { useState, useEffect, useRef, useCallback, startTransition } from "react"
import { Search, Users, FolderKanban, FileText, TestTube, ClipboardList, Beaker, Shield, Activity, Settings, FlaskConical, TrendingUp, BarChart3, Calendar, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { type ModuleType, type User } from "@/hooks/use-auth"
import { canAccessDashboardModule, isAdminDashboardRole, isComercialDashboardRole } from "@/lib/control-module-access"
import { authFetch } from "@/lib/api-auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

interface CommandItem {
  id: string
  type: "module" | "cliente" | "proyecto" | "cotizacion" | "recepcion"
  title: string
  subtitle?: string
  module: ModuleType
  recordId?: number
}

const ALL_MODULES: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: "tracing", label: "Seguimiento", icon: Activity },
  { id: "ingenieria_archivos", label: "Control Informes", icon: FileText },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban },
  { id: "cotizadora", label: "Cotizadora", icon: FileText },
  { id: "recepcion", label: "Recepción Probetas", icon: TestTube },
  { id: "verificacion_muestras", label: "Verificación Probetas", icon: ClipboardList },
  { id: "compresion", label: "F. Probetas", icon: Beaker },
  { id: "control_probetas", label: "Control Probetas", icon: Calendar },
  { id: "huanta_probetas", label: "Laboratorio Huanta", icon: Beaker },
  { id: "humedad", label: "Humedad Suelo", icon: Beaker },
  { id: "cont_humedad", label: "Humedad AG", icon: Beaker },
  { id: "cbr", label: "CBR", icon: Beaker },
  { id: "proctor", label: "Proctor", icon: Beaker },
  { id: "llp", label: "Limite", icon: Beaker },
  { id: "gran_suelo", label: "Gran Suelo", icon: Beaker },
  { id: "gran_agregado", label: "Gran Agregado", icon: Beaker },
  { id: "cont_mat_organica", label: "M. Organica", icon: Beaker },
  { id: "terrones_fino_grueso", label: "Terrones", icon: Beaker },
  { id: "azul_metileno", label: "Azul Metileno", icon: Beaker },
  { id: "part_livianas", label: "Part. Livianas", icon: Beaker },
  { id: "imp_organicas", label: "Imp. Organicas", icon: Beaker },
  { id: "sul_magnesio", label: "Sulf. Magnesio", icon: Beaker },
  { id: "angularidad", label: "Angularidad", icon: Beaker },
  { id: "abra", label: "Abrasión Mayores", icon: Beaker },
  { id: "abrass", label: "Abrasión Menores", icon: Beaker },
  { id: "peso_unitario", label: "Peso Unitario", icon: Beaker },
  { id: "tamiz", label: "Malla 200", icon: Beaker },
  { id: "planas", label: "Planas", icon: Beaker },
  { id: "caras", label: "Caras", icon: Beaker },
  { id: "equi_arena", label: "E.Arena", icon: Beaker },
  { id: "ge_fino", label: "GE Fino", icon: Beaker },
  { id: "ge_grueso", label: "GE Grueso", icon: Beaker },
  { id: "cd", label: "Corte", icon: Beaker },
  { id: "ph", label: "PH Suelo", icon: Beaker },
  { id: "cloro_soluble", label: "Cloruro Suelo", icon: Beaker },
  { id: "sales_solubles", label: "Sales Suelo", icon: Beaker },
  { id: "sulfatos_solubles", label: "Sulfato Suelo", icon: Beaker },
  { id: "compresion_no_confinada", label: "C. No Confinada", icon: Beaker },
  { id: "laboratorio", label: "Control Laboratorio", icon: Activity },
  { id: "comercial", label: "Control Comercial", icon: ClipboardList },
  { id: "administracion", label: "Control Administración", icon: Shield },
  { id: "usuarios", label: "Usuarios", icon: Shield },
  { id: "permisos", label: "Permisos", icon: Shield },
  { id: "auditoria", label: "Auditoría", icon: Activity },
  { id: "configuracion", label: "Configuración", icon: Settings },
]

const KPI_MODULES: { id: ModuleType; label: string; icon: React.ElementType }[] = [
  { id: "estadistica_laboratorio", label: "Estadistica Laboratorio", icon: FlaskConical },
  { id: "estadistica_comercial", label: "Estadistica Comercial", icon: TrendingUp },
  { id: "estadistica_gerencia", label: "Estadistica Administracion", icon: BarChart3 },
]

const FREQ_KEY = "crm-module-frequency"

function getFrequency(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(FREQ_KEY) || "{}")
  } catch {
    return {}
  }
}

function getModuleIcon(id: ModuleType) {
  const found = [...ALL_MODULES, ...KPI_MODULES].find((m) => m.id === id)
  if (found) {
    const Icon = found.icon
    return <Icon className="h-4 w-4" />
  }
  return <Beaker className="h-4 w-4" />
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  setActiveModule: (module: ModuleType) => void
  user: User
}

export function CommandPalette({ open, onOpenChange, setActiveModule, user }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CommandItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearchingRecords, setIsSearchingRecords] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)

  const canSearchRecords = isAdminDashboardRole(user.role) || isComercialDashboardRole(user.role)

  const getAccessibleModules = useCallback(() => {
    const role = user.role?.toLowerCase() || ""
    const isAdmin = role === "admin" || role === "admin_general"

    const all = [...ALL_MODULES, ...KPI_MODULES]
    if (isAdmin) return all

    return all.filter((m) => {
      if (m.id === "permisos") return false
      return canAccessDashboardModule(m.id, user.role, user.permissions, user.email)
    })
  }, [user])

  const getRecentModules = useCallback(() => {
    const freq = getFrequency()
    const accessible = getAccessibleModules()
    const scored = accessible
      .map((m) => ({ ...m, score: freq[m.id] || 0 }))
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    return scored
  }, [getAccessibleModules])

  const searchModules = useCallback((q: string) => {
    const accessible = getAccessibleModules()
    const lower = q.toLowerCase()
    return accessible
      .filter((m) => m.label.toLowerCase().includes(lower) || m.id.toLowerCase().includes(lower))
      .slice(0, 8)
      .map((m) => ({
        id: `module-${m.id}`,
        type: "module" as const,
        title: m.label,
        module: m.id,
      }))
  }, [getAccessibleModules])

  const fetchRecords = useCallback(async (q: string, signal: AbortSignal): Promise<CommandItem[]> => {
    if (!canSearchRecords) return []
    if (q.trim().length < 2) return []
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: "5" })
      const response = await authFetch(`${API_URL}/dashboard/search?${params.toString()}`, { method: "GET", signal })
      if (!response.ok) return []
      const payload = await response.json()
      const data: { id: string; type: "cliente" | "proyecto" | "cotizacion"; title: string; subtitle: string }[] = Array.isArray(payload?.data) ? payload.data : []
      return data.map((r) => ({
        id: `record-${r.type}-${r.id}`,
        type: r.type,
        title: r.title,
        subtitle: r.subtitle,
        module: r.type === "cliente" ? "clientes" : r.type === "proyecto" ? "proyectos" : "cotizadora",
      }))
    } catch {
      return []
    }
  }, [canSearchRecords])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setSelectedIndex(0)
      return
    }
    setSelectedIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    if (!open) return

    const trimmed = query.trim()

    if (!trimmed) {
      const recent = getRecentModules()
      setResults(recent.map((m) => ({
        id: `module-${m.id}`,
        type: "module" as const,
        title: m.label,
        subtitle: `Usado ${m.score} veces`,
        module: m.id,
      })))
      setSelectedIndex(0)
      return
    }

    searchAbortRef.current?.abort()
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      searchAbortRef.current = controller

      const modules = searchModules(trimmed)
      setIsSearchingRecords(true)
      const records = await fetchRecords(trimmed, controller.signal)
      setIsSearchingRecords(false)

      startTransition(() => {
        setResults([...modules, ...records])
        setSelectedIndex(0)
      })
    }, 200)
  }, [query, open, getRecentModules, searchModules, fetchRecords])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault()
        handleSelect(results[selectedIndex])
      } else if (e.key === "Escape") {
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, results, selectedIndex])

  const handleSelect = (item: CommandItem) => {
    onOpenChange(false)
    setQuery("")
    setResults([])
    setActiveModule(item.module)
  }

  const renderGroupLabel = (type: string) => {
    switch (type) {
      case "module": return "Módulos"
      case "cliente": return "Clientes"
      case "proyecto": return "Proyectos"
      case "cotizacion": return "Cotizaciones"
      case "recepcion": return "Recepciones"
      default: return "Resultados"
    }
  }

  const getItemIcon = (item: CommandItem) => {
    if (item.type === "module") return getModuleIcon(item.module)
    switch (item.type) {
      case "cliente": return <Users className="h-4 w-4 text-blue-500" />
      case "proyecto": return <FolderKanban className="h-4 w-4 text-green-500" />
      case "cotizacion": return <FileText className="h-4 w-4 text-orange-500" />
      case "recepcion": return <TestTube className="h-4 w-4 text-purple-500" />
      default: return <Search className="h-4 w-4" />
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh]">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl bg-popover border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ease-out"
      >
        <style>{`
          .command-palette-results::-webkit-scrollbar { width: 8px; }
          .command-palette-results::-webkit-scrollbar-track { background: hsl(var(--muted)); border-radius: 4px; }
          .command-palette-results::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.4); border-radius: 4px; }
          .command-palette-results::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.6); }
        `}</style>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            placeholder={canSearchRecords ? "Buscar módulos, clientes, proyectos..." : "Buscar módulos..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-none bg-transparent px-0 py-0 h-auto shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 text-sm"
          />
          {isSearchingRecords && query.trim().length >= 2 && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
            ESC
          </kbd>
        </div>

        <div className="max-h-[500px] overflow-y-auto command-palette-results">
          {results.length === 0 && query.trim().length >= 2 && !isSearchingRecords && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Sin resultados para &quot;{query}&quot;</p>
            </div>
          )}

          {results.length === 0 && !query.trim() && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">Empieza a escribir para buscar</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Usa <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↑</kbd> <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↓</kbd> para navegar y <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↵</kbd> para seleccionar
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="p-1">
              {results.map((item, index) => {
                const showGroup = index === 0 || results[index - 1].type !== item.type
                const isSelected = index === selectedIndex
                return (
                  <div key={item.id}>
                    {showGroup && (
                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {renderGroupLabel(item.type)}
                      </div>
                    )}
                    <button
                      type="button"
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 ${
                        isSelected
                          ? "bg-accent text-accent-foreground scale-[1.02]"
                          : "text-foreground hover:bg-accent/50"
                      }`}
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => handleSelect(item)}
                    >
                      <span className="shrink-0">{getItemIcon(item)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        {item.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                        )}
                      </div>
                      {item.type !== "module" && (
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">
                          {renderGroupLabel(item.type)}
                        </span>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
