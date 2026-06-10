"use client"

import { useCallback, useEffect, useState } from "react"
import {
  RefreshCw,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Droplets,
  Eye,
  Play,
  FilterX,
  Layers,
  Scale,
  ChevronLeft,
  ChevronRight,
  Loader2
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ProbetaListItem {
  muestra_id: number
  item_numero: number
  codigo_muestra?: string
  codigo_muestra_lem?: string
  identificacion_muestra?: string
  estructura?: string
  fc_kg_cm2: number
  fecha_moldeo?: string
  edad: number
  fecha_rotura?: string
  requiere_densidad: boolean
  
  // Recepcion Info
  recepcion_id: number
  numero_recepcion: string
  numero_ot: string
  cliente: string
  proyecto: string
  
  // Compression Info (if exists)
  compresion_id?: number | null
  fecha_ensayo?: string | null
  carga_maxima?: number | null
  tipo_fractura?: string | null
  
  // Calculated Status: "curado", "pendiente", "ensayado", "vencido"
  estado_probeta: "curado" | "pendiente" | "ensayado" | "vencido"
}

interface ProbetasKpis {
  total: number
  curado: number
  pendiente: number
  ensayado: number
  vencido: number
}

interface ControlProbetasModuleProps {
  user: any
  onNavigateModule: (module: any, recordId: number | null) => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function ControlProbetasModule({ onNavigateModule }: ControlProbetasModuleProps) {
  const [loading, setLoading] = useState(false)
  const [kpisLoading, setKpisLoading] = useState(false)
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [fechaInicio, setFechaInicio] = useState("")
  const [fechaFin, setFechaFin] = useState("")
  
  // Data States
  const [items, setItems] = useState<ProbetaListItem[]>([])
  const [kpis, setKpis] = useState<ProbetasKpis>({
    total: 0,
    curado: 0,
    pendiente: 0,
    ensayado: 0,
    vencido: 0
  })
  
  // Pagination States
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1) // Reset page on search
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, fechaInicio, fechaFin, pageSize])

  const fetchKpis = useCallback(async () => {
    setKpisLoading(true)
    try {
      const queryParams = new URLSearchParams()
      if (debouncedSearch.trim()) queryParams.set("search", debouncedSearch.trim())
      if (fechaInicio) queryParams.set("fecha_inicio", fechaInicio)
      if (fechaFin) queryParams.set("fecha_fin", fechaFin)

      const response = await authFetch(`${API_URL}/api/control-probetas/kpis?${queryParams.toString()}`)
      if (!response.ok) throw new Error("No se pudieron cargar los KPIs")
      const data = await response.json()
      setKpis(data)
    } catch (error) {
      console.error("Error fetching KPIs:", error)
      toast.error("Error al obtener métricas resumidas")
    } finally {
      setKpisLoading(false)
    }
  }, [debouncedSearch, fechaInicio, fechaFin])

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString()
      })
      if (debouncedSearch.trim()) queryParams.set("search", debouncedSearch.trim())
      if (statusFilter !== "ALL") queryParams.set("estado", statusFilter.toLowerCase())
      if (fechaInicio) queryParams.set("fecha_inicio", fechaInicio)
      if (fechaFin) queryParams.set("fecha_fin", fechaFin)

      const response = await authFetch(`${API_URL}/api/control-probetas?${queryParams.toString()}`)
      if (!response.ok) throw new Error("No se pudieron cargar los especímenes")
      const data = await response.json()
      setItems(data.items)
      setTotalItems(data.total)
      setTotalPages(data.total_pages)
    } catch (error) {
      console.error("Error fetching items:", error)
      toast.error("Error al obtener la lista de probetas")
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, debouncedSearch, statusFilter, fechaInicio, fechaFin])

  // Combined reload trigger
  const handleReload = useCallback(() => {
    void fetchKpis()
    void fetchItems()
  }, [fetchKpis, fetchItems])

  // Auto load data on filters/pagination change
  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  // Load KPIs whenever search or dates change (independent of pagination and status filters)
  useEffect(() => {
    void fetchKpis()
  }, [fetchKpis])

  const clearFilters = () => {
    setSearchTerm("")
    setDebouncedSearch("")
    setStatusFilter("ALL")
    setFechaInicio("")
    setFechaFin("")
    setPage(1)
    toast.success("Filtros limpiados")
  }

  const handleAction = (item: ProbetaListItem) => {
    if (item.estado_probeta === "ensayado" && item.compresion_id) {
      // If crushed, redirect to that specific test details
      onNavigateModule("compresion", item.compresion_id)
      toast.success(`Redirigiendo al ensayo #${item.compresion_id}`)
    } else {
      // If not crushed, redirect to compression module
      // If compression test is not created yet (compresion_id is null), pass null to allow operator to open it
      onNavigateModule("compresion", item.compresion_id || null)
      if (!item.compresion_id) {
        toast.info("Redirigiendo a Formato de Probetas. Busca la recepción para registrar la rotura.")
      } else {
        toast.success(`Redirigiendo al ensayo #${item.compresion_id}`)
      }
    }
  }

  // Format Helper for dates (standardizes display)
  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "-"
    // Standardize hyphens to slashes
    return dateStr.replace(/-/g, "/")
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 px-4 md:px-0">
      
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50">
            Control de Probetas
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">
            Seguimiento de roturas de concreto, edades de curado y planificación de ensayos de compresión.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReload}
            disabled={loading || kpisLoading}
            className="border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(loading || kpisLoading) ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        
        {/* Total Specimens */}
        <Card className="border-slate-200/80 bg-white/70 dark:bg-zinc-900/70 dark:border-zinc-800/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">Total</span>
              <span className="text-2xl font-black text-slate-900 dark:text-zinc-50">
                {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : kpis.total}
              </span>
            </div>
            <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl">
              <Layers className="h-5 w-5 text-slate-500 dark:text-zinc-400" />
            </div>
          </CardContent>
        </Card>

        {/* Curing Status */}
        <Card className="border-slate-200/80 bg-white/70 dark:bg-zinc-900/70 dark:border-zinc-800/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-sky-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">En Curado</span>
              <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
                {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-sky-400" /> : kpis.curado}
              </span>
            </div>
            <div className="p-2.5 bg-sky-50 dark:bg-sky-950/20 rounded-xl">
              <Droplets className="h-5 w-5 text-sky-500 dark:text-sky-400" />
            </div>
          </CardContent>
        </Card>

        {/* Due Today (Pending) */}
        <Card className="border-slate-200/80 bg-white/70 dark:bg-zinc-900/70 dark:border-zinc-800/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-amber-500 relative overflow-hidden">
          {kpis.pendiente > 0 && (
            <div className="absolute top-0 right-0 h-2 w-2 m-2 bg-amber-500 rounded-full animate-ping" />
          )}
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">Toca Hoy</span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-amber-400" /> : kpis.pendiente}
              </span>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl">
              <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        {/* Overdue (Vencido) */}
        <Card className="border-slate-200/80 bg-white/70 dark:bg-zinc-900/70 dark:border-zinc-800/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-rose-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">Vencidas</span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> : kpis.vencido}
              </span>
            </div>
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
              <Clock className="h-5 w-5 text-rose-500 dark:text-rose-400" />
            </div>
          </CardContent>
        </Card>

        {/* Crushed (Ensayado) */}
        <Card className="border-slate-200/80 bg-white/70 dark:bg-zinc-900/70 dark:border-zinc-800/80 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-md border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">Ensayadas</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-emerald-400" /> : kpis.ensayado}
              </span>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Dashboard */}
      <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm overflow-visible">
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
            
            {/* Search Input */}
            <div className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Buscar probeta</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cliente, OT, Recepción, Identificación..."
                  className="pl-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
              </div>
            </div>

            {/* Status Selector */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Estado</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  <SelectItem value="CURADO">En Curado</SelectItem>
                  <SelectItem value="PENDIENTE">Toca Hoy</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                  <SelectItem value="ENSAYADO">Ensayado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Start */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Rotura Desde
              </span>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 scheme-light"
              />
            </div>

            {/* Date Range End */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Rotura Hasta
              </span>
              <Input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 scheme-light"
              />
            </div>
          </div>

          {/* Action Row */}
          {(searchTerm || statusFilter !== "ALL" || fechaInicio || fechaFin) && (
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <FilterX className="mr-2 h-4 w-4" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
              <TableRow className="border-slate-200 dark:border-zinc-800">
                <TableHead className="w-[120px] font-bold text-slate-700 dark:text-zinc-300">OT / Recepción</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-300">Cliente / Proyecto</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-300">Muestra / Identificación</TableHead>
                <TableHead className="font-bold text-slate-700 dark:text-zinc-300">Estructura</TableHead>
                <TableHead className="text-center font-bold text-slate-700 dark:text-zinc-300 w-[100px]">Detalle</TableHead>
                <TableHead className="text-center font-bold text-slate-700 dark:text-zinc-300 w-[110px]">Moldeo</TableHead>
                <TableHead className="text-center font-bold text-slate-700 dark:text-zinc-300 w-[110px]">Programado</TableHead>
                <TableHead className="text-center font-bold text-slate-700 dark:text-zinc-300 w-[120px]">Estado</TableHead>
                <TableHead className="text-right font-bold text-slate-700 dark:text-zinc-300 w-[140px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse border-slate-100 dark:border-zinc-800">
                    <TableCell colSpan={9} className="py-8 text-center text-slate-400 dark:text-zinc-600">
                      Cargando registros...
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-16 text-center text-slate-400 dark:text-zinc-500 italic">
                    No se encontraron probetas programadas con los criterios de búsqueda actuales.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => {
                  const statusColors = {
                    curado: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/20 dark:text-sky-400 dark:border-sky-900/30",
                    pendiente: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 animate-pulse font-bold",
                    vencido: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 font-semibold",
                    ensayado: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
                  }
                  
                  const statusLabels = {
                    curado: "En Curado",
                    pendiente: "Toca Hoy",
                    vencido: "Vencido",
                    ensayado: "Ensayado",
                  }

                  const estColor = statusColors[item.estado_probeta] || "bg-slate-50 text-slate-700"
                  const estLabel = statusLabels[item.estado_probeta] || item.estado_probeta

                  return (
                    <TableRow key={item.muestra_id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/20 transition-colors border-slate-100 dark:border-zinc-800/80 group">
                      
                      {/* OT / Recepcion */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-zinc-200 leading-tight">
                            {item.numero_ot}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                            {item.numero_recepcion}
                          </span>
                        </div>
                      </TableCell>

                      {/* Cliente / Proyecto */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col max-w-[240px]">
                          <span className="text-xs font-semibold text-slate-800 dark:text-zinc-300 truncate">
                            {item.cliente}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                            {item.proyecto}
                          </span>
                        </div>
                      </TableCell>

                      {/* Muestra / Identificacion */}
                      <TableCell className="align-middle">
                        <div className="flex flex-col max-w-[200px]">
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-300">
                            {item.identificacion_muestra || `Muestra #${item.item_numero}`}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                            LEM: {item.codigo_muestra_lem || item.codigo_muestra || "-"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Estructura */}
                      <TableCell className="align-middle text-xs text-slate-600 dark:text-zinc-400 truncate max-w-[120px]">
                        {item.estructura || "-"}
                      </TableCell>

                      {/* Age & f'c */}
                      <TableCell className="align-middle text-center">
                        <div className="flex flex-col items-center gap-1 justify-center">
                          <div className="flex gap-1 items-center">
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                              {item.edad}d
                            </Badge>
                            {item.requiere_densidad && (
                              <Badge variant="outline" className="px-1 py-0 text-[10px] font-semibold border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                                <Scale className="h-2.5 w-2.5" />
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-semibold whitespace-nowrap">
                            f'c {item.fc_kg_cm2}
                          </span>
                        </div>
                      </TableCell>

                      {/* Fecha Moldeo */}
                      <TableCell className="align-middle text-center text-xs text-slate-600 dark:text-zinc-400 font-mono">
                        {formatDateDisplay(item.fecha_moldeo)}
                      </TableCell>

                      {/* Fecha Rotura */}
                      <TableCell className="align-middle text-center text-xs text-slate-600 dark:text-zinc-400 font-mono font-bold">
                        {formatDateDisplay(item.fecha_rotura)}
                      </TableCell>

                      {/* Estado Badge */}
                      <TableCell className="align-middle text-center">
                        <Badge variant="outline" className={`px-2 py-0.5 rounded-full text-xs border ${estColor} mx-auto block w-fit`}>
                          {estLabel}
                        </Badge>
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="align-middle text-right">
                        {item.estado_probeta === "ensayado" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-slate-200 dark:border-zinc-800 text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-zinc-100 dark:hover:bg-zinc-800"
                            onClick={() => handleAction(item)}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Ver Ensayo
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8 bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold shadow-sm hover:shadow transition-all"
                            onClick={() => handleAction(item)}
                          >
                            <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                            Rotura
                          </Button>
                        )}
                      </TableCell>

                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Section */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 dark:text-zinc-400">
              Mostrando probetas <span className="font-bold text-slate-800 dark:text-zinc-200">{(page - 1) * pageSize + 1}</span> a <span className="font-bold text-slate-800 dark:text-zinc-200">{Math.min(page * pageSize, totalItems)}</span> de <span className="font-bold text-slate-800 dark:text-zinc-200">{totalItems}</span> registros.
            </div>

            <div className="flex items-center gap-4">
              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-zinc-500">Filas:</span>
                <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(Number(val))}>
                  <SelectTrigger className="h-8 w-[70px] bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Prev / Next Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-lg border-slate-200 dark:border-zinc-800"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <span className="text-xs font-semibold px-2">
                  Pág. {page} de {totalPages}
                </span>

                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-lg border-slate-200 dark:border-zinc-800"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

    </div>
  )
}
