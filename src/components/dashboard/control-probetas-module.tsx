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
  Loader2,
  ExternalLink,
  Plus,
  Trash2,
  X,
  Database
} from "lucide-react"
import { toast } from "sonner"

import { authFetch } from "@/lib/api-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  DialogFullscreen as FullDialog,
  DialogFullscreenContent as FullDialogContent
} from "@/components/ui/dialog-fullscreen"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"

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

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

// Format Helper for dates (standardizes display)
const formatDateDisplay = (dateStr?: string) => {
  if (!dateStr) return "-"
  return dateStr.replace(/-/g, "/")
}

// Subcomponent: VincularMuestrasModal
interface VincularMuestrasModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  apiUrl: string
}

function VincularMuestrasModal({ isOpen, onClose, onSave, apiUrl }: VincularMuestrasModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [receptions, setReceptions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedReception, setSelectedReception] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [samples, setSamples] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Search receptions when debounced search term changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setReceptions([])
      return
    }
    let active = true
    const searchReceptions = async () => {
      try {
        setLoading(true)
        const res = await authFetch(`${apiUrl}/api/recepcion/paginated?q=${encodeURIComponent(debouncedSearch)}&page_size=5`)
        if (!res.ok) throw new Error("Search failed")
        const data = await res.json()
        if (active) {
          setReceptions(data.items || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (active) setLoading(false)
      }
    }
    void searchReceptions()
    return () => {
      active = false
    }
  }, [debouncedSearch, apiUrl])

  const handleSelectReception = async (rec: any) => {
    setSelectedReception(rec)
    setReceptions([])
    setSearchTerm("")
    
    try {
      setLoadingDetail(true)
      const res = await authFetch(`${apiUrl}/api/recepcion/${rec.id}`)
      if (!res.ok) throw new Error("Failed to load details")
      const data = await res.json()
      setSamples(data.muestras || [])
    } catch (err) {
      console.error(err)
      toast.error("Error al cargar las muestras de la recepción")
    } finally {
      setLoadingDetail(false)
    }
  }

  const calculateRoturaDate = (moldeoStr: string, edadDays: number) => {
    if (!moldeoStr) return ""
    try {
      const cleanDate = moldeoStr.replace(/\//g, "-")
      const d = new Date(cleanDate)
      if (isNaN(d.getTime())) return ""
      d.setDate(d.getDate() + edadDays)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, "0")
      const day = String(d.getDate()).padStart(2, "0")
      return `${y}/${m}/${day}`
    } catch {
      return ""
    }
  }

  const handleSampleChange = (index: number, field: string, value: any) => {
    const updated = [...samples]
    updated[index] = {
      ...updated[index],
      [field]: value
    }

    if (field === "fecha_moldeo" || field === "edad") {
      const moldeo = field === "fecha_moldeo" ? value : updated[index].fecha_moldeo
      const edad = field === "edad" ? Number(value) : updated[index].edad
      updated[index].fecha_rotura = calculateRoturaDate(moldeo, edad)
    }

    setSamples(updated)
  }

  const handleAddSample = () => {
    const nextItem = samples.length + 1
    const defaultDate = selectedReception?.fecha_recepcion 
      ? selectedReception.fecha_recepcion.replace(/-/g, "/") 
      : new Date().toISOString().split("T")[0].replace(/-/g, "/")
    const defaultEdad = 28
    const defaultRotura = calculateRoturaDate(defaultDate, defaultEdad)

    setSamples([
      ...samples,
      {
        item_numero: nextItem,
        codigo_muestra: "",
        codigo_muestra_lem: "",
        identificacion_muestra: `Muestra ${nextItem}`,
        estructura: "",
        fc_kg_cm2: 280,
        fecha_moldeo: defaultDate,
        hora_moldeo: "09:00",
        edad: defaultEdad,
        fecha_rotura: defaultRotura,
        requiere_densidad: false
      }
    ])
  }

  const handleDeleteSample = (index: number) => {
    const filtered = samples.filter((_, idx) => idx !== index)
    const remapped = filtered.map((item, idx) => ({
      ...item,
      item_numero: idx + 1
    }))
    setSamples(remapped)
  }

  const handleSave = async () => {
    if (!selectedReception) return

    for (let i = 0; i < samples.length; i++) {
      if (!samples[i].identificacion_muestra.trim()) {
        toast.error(`La Muestra #${i + 1} debe tener una identificación válida.`)
        return
      }
    }

    try {
      setIsSaving(true)
      const response = await authFetch(`${apiUrl}/api/recepcion/${selectedReception.id}`, {
        method: "PUT",
        body: JSON.stringify({
          muestras: samples
        })
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || "Error al actualizar las muestras")
      }

      toast.success("Muestras guardadas y sincronizadas exitosamente.")
      onSave()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Error al guardar muestras")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden bg-white dark:bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-50">
            Registrar / Vincular Muestras a Recepción
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
            Selecciona una recepción para registrar y configurar especímenes de probetas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4 overflow-visible">
          
          {/* SEARCH TABLE (When no reception is selected) */}
          {!selectedReception && (
            <div className="space-y-3">
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                <Table className="min-w-full border-collapse">
                  <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
                    <TableRow className="border-b border-slate-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-slate-500">
                      <TableHead className="w-[180px] p-2.5 font-bold">OT / Recepción</TableHead>
                      <TableHead className="p-2.5 font-bold">Cliente</TableHead>
                      <TableHead className="p-2.5 font-bold">Proyecto</TableHead>
                      <TableHead className="w-[100px] p-2.5 text-right font-bold"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    
                    {/* Inline Search Bar Row */}
                    <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-b border-slate-200 dark:border-zinc-800">
                      <TableCell colSpan={4} className="p-3">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            autoComplete="off"
                            data-lpignore="true"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar recepción por OT, correlativo o cliente..."
                            className="pl-9 h-10 w-full bg-white dark:bg-zinc-950 border-slate-250 dark:border-zinc-800 text-sm focus-visible:ring-1"
                          />
                          {loading && (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Results / Candidates (Ghost Rows) */}
                    {receptions.length > 0 ? (
                      receptions.map((rec) => (
                        <TableRow
                          key={rec.id}
                          onClick={() => handleSelectReception(rec)}
                          className="cursor-pointer bg-slate-50/10 hover:bg-slate-100/50 dark:hover:bg-zinc-850/50 transition-colors border-b border-slate-100 dark:border-zinc-800 group"
                        >
                          <TableCell className="p-3">
                            <div className="flex flex-col">
                              <Badge className="bg-slate-150 dark:bg-zinc-850 text-slate-800 dark:text-zinc-200 font-bold w-fit text-[10px] py-0.5">
                                OT: {rec.numero_ot}
                              </Badge>
                              <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                REC: {rec.numero_recepcion}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="p-3 text-xs font-semibold text-slate-700 dark:text-zinc-350 max-w-[200px] truncate">
                            {rec.cliente}
                          </TableCell>
                          <TableCell className="p-3 text-[11px] text-slate-500 dark:text-zinc-400 max-w-[250px] truncate">
                            {rec.proyecto}
                          </TableCell>
                          <TableCell className="p-3 text-right">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg px-3"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectReception(rec)
                              }}
                            >
                              Seleccionar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={4} className="p-8 text-center text-xs text-slate-400 italic">
                          {debouncedSearch.trim() 
                            ? "No se encontraron recepciones con los criterios de búsqueda." 
                            : "Escribe en el buscador de arriba para cargar recepciones..."
                          }
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Selected Reception Info Summary */}
          {selectedReception && (
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 dark:border-blue-900/20 dark:bg-blue-950/10 space-y-2">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wider">
                  Recepción Seleccionada
                </h4>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] font-bold text-blue-800 border-blue-200 hover:bg-blue-100"
                    onClick={() => {
                      setSelectedReception(null)
                      setSamples([])
                    }}
                  >
                    Cambiar Recepción
                  </Button>
                  <Badge className="bg-blue-600 text-white font-bold">
                    OT: {selectedReception.numero_ot}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-slate-650 dark:text-zinc-300">
                <div>
                  <span className="font-semibold text-slate-500">Nº Recepción:</span> {selectedReception.numero_recepcion}
                </div>
                <div className="md:col-span-2">
                  <span className="font-semibold text-slate-500">Cliente:</span> {selectedReception.cliente}
                </div>
                <div className="md:col-span-3">
                  <span className="font-semibold text-slate-500">Proyecto:</span> {selectedReception.proyecto}
                </div>
              </div>
            </div>
          )}

          {/* Specimens edit section */}
          {selectedReception && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Muestras en esta Recepción ({samples.length})
                </h4>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddSample}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1 rounded-lg"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar Muestra
                </Button>
              </div>

              {loadingDetail ? (
                <div className="py-12 flex items-center justify-center text-slate-400 text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando muestras de la recepción...
                </div>
              ) : samples.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic border border-dashed rounded-xl">
                  No hay muestras registradas en esta recepción. Presiona "Agregar Muestra" para registrar.
                </div>
              ) : (
                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-slate-500">
                        <th className="p-2.5 text-center w-10">Item</th>
                        <th className="p-2.5 w-[140px]">Cod. LEM</th>
                        <th className="p-2.5">Identificación</th>
                        <th className="p-2.5 w-[140px]">Estructura</th>
                        <th className="p-2.5 w-16 text-center">f'c</th>
                        <th className="p-2.5 w-32 text-center">Moldeo</th>
                        <th className="p-2.5 w-14 text-center">Edad</th>
                        <th className="p-2.5 w-32 text-center">Rotura</th>
                        <th className="p-2.5 w-12 text-center">Dens.</th>
                        <th className="p-2.5 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                      {samples.map((sample, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/10">
                          <td className="p-2 text-center font-bold text-slate-400">{sample.item_numero}</td>
                          <td className="p-2">
                            <Input
                              value={sample.codigo_muestra_lem || ""}
                              onChange={(e) => handleSampleChange(idx, "codigo_muestra_lem", e.target.value)}
                              placeholder="Ej. 1024"
                              className="h-8 text-xs py-1 px-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={sample.identificacion_muestra || ""}
                              onChange={(e) => handleSampleChange(idx, "identificacion_muestra", e.target.value)}
                              placeholder="Identificación muestra..."
                              className="h-8 text-xs py-1 px-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={sample.estructura || ""}
                              onChange={(e) => handleSampleChange(idx, "estructura", e.target.value)}
                              placeholder="Estructura..."
                              className="h-8 text-xs py-1 px-2 border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={sample.fc_kg_cm2 ?? 280}
                              onChange={(e) => handleSampleChange(idx, "fc_kg_cm2", Number(e.target.value))}
                              className="h-8 text-xs py-1 px-1.5 text-center border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="text"
                              value={sample.fecha_moldeo || ""}
                              onChange={(e) => handleSampleChange(idx, "fecha_moldeo", e.target.value)}
                              placeholder="YYYY/MM/DD"
                              className="h-8 text-xs py-1 px-2 text-center border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              value={sample.edad ?? 28}
                              onChange={(e) => handleSampleChange(idx, "edad", Number(e.target.value))}
                              className="h-8 text-xs py-1 px-1 text-center border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="text"
                              value={sample.fecha_rotura || ""}
                              onChange={(e) => handleSampleChange(idx, "fecha_rotura", e.target.value)}
                              placeholder="YYYY/MM/DD"
                              className="h-8 text-xs py-1 px-2 text-center border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 font-mono"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <Checkbox
                              checked={sample.requiere_densidad ?? false}
                              onCheckedChange={(val) => handleSampleChange(idx, "requiere_densidad", !!val)}
                              className="mx-auto"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSample(idx)}
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 dark:border-zinc-800 pt-4 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-slate-200 dark:border-zinc-800"
          >
            Cancelar
          </Button>
          {selectedReception && (
            <Button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="bg-blue-650 hover:bg-blue-700 text-white font-bold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Main Component
export function ControlProbetasModule({ user, onNavigateModule }: ControlProbetasModuleProps) {
  const [loading, setLoading] = useState(false)
  const [kpisLoading, setKpisLoading] = useState(false)
  
  // Dialog visibility states
  const [isTableOpen, setIsTableOpen] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  
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

  const canWrite = user?.role === "admin" || user?.role === "admin_general"

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

      const response = await authFetch(`${API_URL}/api/control-probetas/?${queryParams.toString()}`)
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

  // Load KPIs whenever search or dates change
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
      onNavigateModule("compresion", item.compresion_id)
      toast.success(`Redirigiendo al ensayo #${item.compresion_id}`)
    } else {
      onNavigateModule("compresion", item.compresion_id || null)
      if (!item.compresion_id) {
        toast.info("Redirigiendo a Formato de Probetas. Busca la recepción para registrar la rotura.")
      } else {
        toast.success(`Redirigiendo al ensayo #${item.compresion_id}`)
      }
    }
  }

  // Filter critical upcoming breaks for landing page preview
  const criticalItems = items.filter(
    (item) => item.estado_probeta === "pendiente" || item.estado_probeta === "vencido"
  ).slice(0, 5)

  // Fallback preview items if no critical breaks exist
  const previewList = criticalItems.length > 0 ? criticalItems : items.slice(0, 5)

  return (
    <div className="min-h-full bg-[#F8FAFC] p-8 space-y-8 font-sans antialiased animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
            Control de Probetas
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Seguimiento de roturas de concreto, edades de curado y planificación de ensayos de compresión
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReload}
            disabled={loading || kpisLoading}
            className="border-slate-250 bg-white hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(loading || kpisLoading) ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </div>

      {/* Quick Access Block */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-black text-xl">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 uppercase">Matriz Técnica de Probetas</h3>
              <p className="text-slate-500 text-xs font-medium mt-1">
                Acceso directo al registro de muestras, estados de curado y planificación de roturas en prensa
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsTableOpen(true)}
            className="flex items-center gap-3 px-5 py-3 bg-[#0070F3] text-white rounded-xl font-bold hover:bg-blue-600 transition-all shadow-md shadow-blue-500/20 active:scale-95 text-sm uppercase tracking-wider"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={3} />
            ABRIR TABLA DE CONTROL
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
        
        {/* Total Specimens */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL PROBETAS</p>
            <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
              {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" /> : kpis.total}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Curing Status */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 border-l-sky-500 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EN CURADO</p>
            <p className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1 tabular-nums">
              {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-sky-400" /> : kpis.curado}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-500">
            <Droplets className="h-5 w-5" />
          </div>
        </div>

        {/* Due Today (Pending) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 border-l-amber-500 flex items-center justify-between relative overflow-hidden">
          {kpis.pendiente > 0 && (
            <div className="absolute top-0 right-0 h-2 w-2 m-2 bg-amber-500 rounded-full animate-ping" />
          )}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOCA HOY</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
              {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-amber-400" /> : kpis.pendiente}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-550">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Overdue (Vencido) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 border-l-rose-500 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VENCIDAS</p>
            <p className="text-2xl font-black text-rose-650 mt-1 tabular-nums">
              {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-rose-400" /> : kpis.vencido}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Crushed (Ensayado) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ENSAYADAS</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              {kpisLoading ? <Loader2 className="h-5 w-5 animate-spin text-emerald-400" /> : kpis.ensayado}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-650">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Landing Preview Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            {criticalItems.length > 0 
              ? "Especímenes Críticos que Requieren Rotura Hoy / Vencidos" 
              : "Últimas Probetas Registradas en el Sistema"
            }
          </h3>
          <span className="text-[10px] bg-slate-100 text-slate-650 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            Vista Previa (5 Filas)
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-100">
                <TableHead className="w-[120px] font-bold text-slate-600">OT / Recepción</TableHead>
                <TableHead className="font-bold text-slate-600">Cliente / Proyecto</TableHead>
                <TableHead className="font-bold text-slate-600">Muestra / Identificación</TableHead>
                <TableHead className="text-center font-bold text-slate-600 w-[100px]">Detalle</TableHead>
                <TableHead className="text-center font-bold text-slate-600 w-[110px]">Programado</TableHead>
                <TableHead className="text-center font-bold text-slate-600 w-[120px]">Estado</TableHead>
                <TableHead className="text-right font-bold text-slate-600 w-[140px]">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-400">
                    Cargando vista previa...
                  </TableCell>
                </TableRow>
              ) : previewList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-slate-400 italic">
                    Sin probetas registradas actualmente en el sistema.
                  </TableCell>
                </TableRow>
              ) : (
                previewList.map((item) => {
                  const statusColors = {
                    curado: "bg-sky-50 text-sky-700 border-sky-200",
                    pendiente: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse font-bold",
                    vencido: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
                    ensayado: "bg-emerald-50 text-emerald-700 border-emerald-200",
                  }
                  
                  const statusLabels = {
                    curado: "En Curado",
                    pendiente: "Toca Hoy",
                    vencido: "Vencido",
                    ensayado: "Ensayado",
                  }

                  const estColor = statusColors[item.estado_probeta] || "bg-slate-50 text-slate-750"
                  const estLabel = statusLabels[item.estado_probeta] || item.estado_probeta

                  return (
                    <TableRow key={item.muestra_id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                      
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 leading-tight">{item.numero_ot}</span>
                          <span className="text-[10px] font-mono text-slate-400">{item.numero_recepcion}</span>
                        </div>
                      </TableCell>

                      <TableCell className="align-middle">
                        <div className="flex flex-col max-w-[240px]">
                          <span className="text-xs font-semibold text-slate-800 truncate">{item.cliente}</span>
                          <span className="text-[10px] text-slate-400 truncate">{item.proyecto}</span>
                        </div>
                      </TableCell>

                      <TableCell className="align-middle">
                        <div className="flex flex-col max-w-[200px]">
                          <span className="text-xs font-bold text-slate-850">
                            {item.identificacion_muestra || `Muestra #${item.item_numero}`}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            LEM: {item.codigo_muestra_lem || item.codigo_muestra || "-"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="align-middle text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                            {item.edad}d
                          </Badge>
                          <span className="text-[9px] text-slate-400 font-semibold">f'c {item.fc_kg_cm2}</span>
                        </div>
                      </TableCell>

                      <TableCell className="align-middle text-center text-xs text-slate-600 font-mono font-bold">
                        {formatDateDisplay(item.fecha_rotura)}
                      </TableCell>

                      <TableCell className="align-middle text-center">
                        <Badge variant="outline" className={`px-2 py-0.5 rounded-full text-[10px] border ${estColor} mx-auto block w-fit`}>
                          {estLabel}
                        </Badge>
                      </TableCell>

                      <TableCell className="align-middle text-right">
                        {item.estado_probeta === "ensayado" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-slate-200 text-slate-600 hover:text-slate-900"
                            onClick={() => handleAction(item)}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Ver Ensayo
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition-all"
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
      </div>

      {/* Fullscreen Table Modal */}
      <FullDialog open={isTableOpen} onOpenChange={setIsTableOpen}>
        <FullDialogContent style={{ backgroundColor: "#fff" }} onInteractOutside={(e) => e.preventDefault()}>
          
          {/* Header toolbar */}
          <div className="flex-none flex items-center justify-between px-6 py-3 bg-white border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <Layers className="w-5 h-5 text-blue-600" />
              <DialogTitle className="font-black text-zinc-900 text-sm uppercase tracking-wider">
                Matriz de Control de Probetas de Concreto
              </DialogTitle>
            </div>
            
            <div className="flex items-center gap-3">
              {canWrite && (
                <Button
                  size="sm"
                  onClick={() => setIsManualModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1 text-xs px-3 py-1.5 rounded-lg shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Vincular / Registrar Muestras
                </Button>
              )}
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-red-50 hover:text-red-500 rounded-lg">
                  <X className="w-4 h-4" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Dialog Body */}
          <div className="flex-1 min-h-0 relative bg-zinc-50 overflow-y-auto p-6 space-y-6">
            
            {/* Filter Card */}
            <Card className="border-slate-200 bg-white shadow-sm overflow-visible">
              <CardContent className="p-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 items-end">
                  
                  {/* Search Input */}
                  <div className="space-y-1.5 lg:col-span-2">
                    <span className="text-xs font-bold text-slate-600">Buscar probeta</span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Cliente, OT, Recepción, Identificación..."
                        className="pl-9 bg-white border-slate-200"
                      />
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">Estado</span>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="bg-white border-slate-200">
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
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Rotura Desde
                    </span>
                    <Input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="bg-white border-slate-200 text-slate-800 scheme-light"
                    />
                  </div>

                  {/* Date Range End */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Rotura Hasta
                    </span>
                    <Input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="bg-white border-slate-200 text-slate-800 scheme-light"
                    />
                  </div>
                </div>

                {/* Clear Filters Action */}
                {(searchTerm || statusFilter !== "ALL" || fechaInicio || fechaFin) && (
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearFilters}
                      className="text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    >
                      <FilterX className="mr-2 h-4 w-4" />
                      Limpiar filtros
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Table Container */}
            <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-slate-200">
                      <TableHead className="w-[120px] font-bold text-slate-700">OT / Recepción</TableHead>
                      <TableHead className="font-bold text-slate-700">Cliente / Proyecto</TableHead>
                      <TableHead className="font-bold text-slate-700">Muestra / Identificación</TableHead>
                      <TableHead className="font-bold text-slate-700">Estructura</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 w-[100px]">Detalle</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 w-[110px]">Moldeo</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 w-[110px]">Programado</TableHead>
                      <TableHead className="text-center font-bold text-slate-700 w-[120px]">Estado</TableHead>
                      <TableHead className="text-right font-bold text-slate-700 w-[140px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="animate-pulse border-slate-100">
                          <TableCell colSpan={9} className="py-8 text-center text-slate-400">
                            Cargando registros...
                          </TableCell>
                        </TableRow>
                      ))
                    ) : items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-16 text-center text-slate-450 italic">
                          No se encontraron probetas con los filtros actuales.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => {
                        const statusColors = {
                          curado: "bg-sky-50 text-sky-700 border-sky-200",
                          pendiente: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse font-bold",
                          vencido: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
                          ensayado: "bg-emerald-50 text-emerald-700 border-emerald-200",
                        }
                        
                        const statusLabels = {
                          curado: "En Curado",
                          pendiente: "Toca Hoy",
                          vencido: "Vencido",
                          ensayado: "Ensayado",
                        }

                        const estColor = statusColors[item.estado_probeta] || "bg-slate-50 text-slate-750"
                        const estLabel = statusLabels[item.estado_probeta] || item.estado_probeta

                        return (
                          <TableRow key={item.muestra_id} className="hover:bg-slate-50/50 transition-colors border-slate-100 group">
                            
                            <TableCell className="align-middle">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 leading-tight">{item.numero_ot}</span>
                                <span className="text-[10px] font-mono text-slate-400">{item.numero_recepcion}</span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col max-w-[240px]">
                                <span className="text-xs font-semibold text-slate-800 truncate">{item.cliente}</span>
                                <span className="text-[10px] text-slate-400 truncate">{item.proyecto}</span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col max-w-[200px]">
                                <span className="text-xs font-bold text-slate-850 text-ellipsis">
                                  {item.identificacion_muestra || `Muestra #${item.item_numero}`}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  LEM: {item.codigo_muestra_lem || item.codigo_muestra || "-"}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle text-xs text-slate-600 truncate max-w-[120px]">
                              {item.estructura || "-"}
                            </TableCell>

                            <TableCell className="align-middle text-center">
                              <div className="flex flex-col items-center gap-1 justify-center">
                                <div className="flex gap-1 items-center">
                                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-bold">
                                    {item.edad}d
                                  </Badge>
                                  {item.requiere_densidad && (
                                    <Badge variant="outline" className="px-1 py-0 text-[10px] font-semibold border-amber-300 bg-amber-50 text-amber-700">
                                      <Scale className="h-2.5 w-2.5" />
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">
                                  f'c {item.fc_kg_cm2}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle text-center text-xs text-slate-650 font-mono">
                              {formatDateDisplay(item.fecha_moldeo)}
                            </TableCell>

                            <TableCell className="align-middle text-center text-xs text-slate-650 font-mono font-bold">
                              {formatDateDisplay(item.fecha_rotura)}
                            </TableCell>

                            <TableCell className="align-middle text-center">
                              <Badge variant="outline" className={`px-2 py-0.5 rounded-full text-xs border ${estColor} mx-auto block w-fit`}>
                                {estLabel}
                              </Badge>
                            </TableCell>

                            <TableCell className="align-middle text-right">
                              {item.estado_probeta === "ensayado" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-slate-200 text-slate-600 hover:text-slate-900"
                                  onClick={() => handleAction(item)}
                                >
                                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                                  Ver Ensayo
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-8 bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition-all"
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

              {/* Pagination controls inside Fullscreen modal */}
              {totalPages > 1 && (
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-500">
                    Mostrando probetas <span className="font-bold text-slate-800">{(page - 1) * pageSize + 1}</span> a <span className="font-bold text-slate-800">{Math.min(page * pageSize, totalItems)}</span> de <span className="font-bold text-slate-800">{totalItems}</span> registros.
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Filas:</span>
                      <Select value={pageSize.toString()} onValueChange={(val) => setPageSize(Number(val))}>
                        <SelectTrigger className="h-8 w-[70px] bg-white border-slate-200">
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

                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 rounded-lg border-slate-200"
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
                        className="h-8 w-8 rounded-lg border-slate-200"
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
        </FullDialogContent>
      </FullDialog>

      {/* Register/Link manual modal */}
      <VincularMuestrasModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSave={handleReload}
        apiUrl={API_URL}
      />

    </div>
  )
}
