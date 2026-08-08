"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import {
  Thermometer,
  Scale,
  Plus,
  RefreshCw,
  Search,
  Clock,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { ModernConfirmDialog } from "@/components/dashboard/modern-confirm-dialog"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

interface ControlAmbientalModuleProps {
  defaultTab?: "dashboard" | "temperatura" | "balanza"
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface ControlTemperaturaItem {
  id: number
  fecha: string
  hora_lectura: string
  area_ambiente: string
  temperatura_c: number
  humedad_relativa_pct: number
  temp_min?: number | null
  temp_max?: number | null
  cumple_especificacion: boolean
  responsable_lectura: string
  observaciones?: string | null
}

interface ControlBalanzaItem {
  id: number
  fecha: string
  codigo_balanza: string
  ubicacion: string
  capacidad_g: number
  masa_patron_g: number
  lectura_balanza_g: number
  error_g: number
  error_max_permitido_g: number
  estado_conforme: boolean
  limpieza_nivelacion: boolean
  verificado_por: string
  observaciones?: string | null
}

const DEFAULT_AREAS = [
  "Area de Recepción de muestras",
  "Área de Ensayos físicos",
  "Area de Ensayos especiales",
  "Area de Temperatura controlada",
  "Area de Lavado y compactación",
]

const DEFAULT_BALANZAS = [
  { codigo: "BAL-01", ubi: "Muestras / Cám. Húmeda",  cap: 30000, masa: 5000, tol: 1.0   },
  { codigo: "BAL-02", ubi: "Laboratorio Suelos",       cap: 20000, masa: 2000, tol: 0.5   },
  { codigo: "BAL-03", ubi: "Laboratorio Concreto",     cap: 5000,  masa: 1000, tol: 0.1   },
  { codigo: "BAL-04", ubi: "Química / Finos",          cap: 1000,  masa: 500,  tol: 0.05  },
  { codigo: "BAL-05", ubi: "Analítica General",        cap: 300,   masa: 100,  tol: 0.005 },
  { codigo: "BAL-06", ubi: "Laboratorio Huanta",       cap: 15000, masa: 2000, tol: 0.5   },
]

function getMesAnio() {
  return new Date()
    .toLocaleString("es-PE", { month: "long", year: "numeric" })
    .toUpperCase()
}

export function ControlAmbientalModule({ user, defaultTab = "temperatura" }: ControlAmbientalModuleProps) {
  const [currentModuleMode, setCurrentModuleMode] = useState<"temperatura" | "balanza">(
    defaultTab === "balanza" ? "balanza" : "temperatura"
  )

  useEffect(() => {
    if (defaultTab === "balanza") {
      setCurrentModuleMode("balanza")
    } else if (defaultTab === "temperatura") {
      setCurrentModuleMode("temperatura")
    }
  }, [defaultTab])

  const [loading, setLoading] = useState(false)
  const [temperaturaList, setTemperaturaList] = useState<ControlTemperaturaItem[]>([])
  const [balanzaList, setBalanzaList] = useState<ControlBalanzaItem[]>([])

  // ── Search and Filters ──
  const [searchTemp, setSearchTemp] = useState("")
  const [searchBalanza, setSearchBalanza] = useState("")
  const [areaFilter, setAreaFilter] = useState("TODAS")
  const [balanzaFilter, setBalanzaFilter] = useState("TODAS")

  // ── Pagination states ──
  const [tempPage, setTempPage] = useState(1)
  const [tempRowsPerPage, setTempRowsPerPage] = useState(25)

  const [balanzaPage, setBalanzaPage] = useState(1)
  const [balanzaRowsPerPage, setBalanzaRowsPerPage] = useState(25)

  // ── Modals ──
  const [showTempModal, setShowTempModal] = useState(false)
  const [editingTempId, setEditingTempId] = useState<number | null>(null)
  const [tempIsDirty, setTempIsDirty] = useState(false)
  const [tempForm, setTempForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    hora_lectura: "08:00",
    fecha_lectura: new Date().toISOString().split("T")[0],
    area_ambiente: "Area de Recepción de muestras",
    temperatura_c: "23.0",
    humedad_relativa_pct: "50.0",
    temp_min: "10.0",
    temp_max: "30.0",
    hum_min: "20.0",
    hum_max: "80.0",
    cumple_especificacion: true,
    responsable_lectura: user.name || "LABORATORIO",
    revisado_por: "",
    observaciones: "",
  })

  const [showBalanzaModal, setShowBalanzaModal] = useState(false)
  const [editingBalanzaId, setEditingBalanzaId] = useState<number | null>(null)
  const [balanzaIsDirty, setBalanzaIsDirty] = useState(false)
  const [balanzaForm, setBalanzaForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    hora: "08:00",
    mes_anio: getMesAnio(),
    codigo_balanza: "BAL-01",
    ubicacion: "Muestras / Cám. Húmeda",
    codigos_pesas_patron: "PP-01, PP-02, PP-05",
    capacidad_g: "30000",
    masa_patron_g: "5000",
    lectura_balanza_g: "5000.0",
    error_max_permitido_g: "1.0",
    limpieza_nivelacion: true,
    verificado_por: user.name || "LABORATORIO",
    revisado_por: "",
    observaciones: "",
  })

  // ── Safety exit ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null)

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [resTemp, resBal] = await Promise.all([
        authFetch(`${API_URL}/api/control-ambiental/temperatura?limit=200`),
        authFetch(`${API_URL}/api/control-ambiental/balanza?limit=200`),
      ])
      if (resTemp.ok) setTemperaturaList(await resTemp.json())
      if (resBal.ok) setBalanzaList(await resBal.json())
    } catch (error) {
      console.error("Error loading Control Ambiental data:", error)
      toast.error("Error al cargar datos del servidor")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Safety exit ──
  const executeWithSafetyCheck = (action: () => void) => {
    if (tempIsDirty || balanzaIsDirty) {
      setPendingExitAction(() => action)
      setShowUnsavedDialog(true)
    } else {
      action()
    }
  }

  const confirmExitWithoutSaving = () => {
    setTempIsDirty(false)
    setBalanzaIsDirty(false)
    setShowTempModal(false)
    setShowBalanzaModal(false)
    setShowUnsavedDialog(false)
    if (pendingExitAction) {
      pendingExitAction()
      setPendingExitAction(null)
    }
  }

  // ── Guardar temperatura ──
  const handleSaveTemp = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        fecha: tempForm.fecha,
        hora_lectura: tempForm.hora_lectura,
        area_ambiente: tempForm.area_ambiente,
        temperatura_c: parseFloat(tempForm.temperatura_c) || 0.0,
        humedad_relativa_pct: parseFloat(tempForm.humedad_relativa_pct) || 0.0,
        temp_min: tempForm.temp_min ? parseFloat(tempForm.temp_min) : null,
        temp_max: tempForm.temp_max ? parseFloat(tempForm.temp_max) : null,
        cumple_especificacion: tempForm.cumple_especificacion,
        responsable_lectura: tempForm.responsable_lectura,
        observaciones: tempForm.observaciones,
      }
      const url = editingTempId
        ? `${API_URL}/api/control-ambiental/temperatura/${editingTempId}`
        : `${API_URL}/api/control-ambiental/temperatura`
      const method = editingTempId ? "PUT" : "POST"
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success(editingTempId ? "Lectura actualizada" : "Lectura registrada con éxito")
        setTempIsDirty(false)
        setShowTempModal(false)
        fetchData()
      } else {
        const err = await res.json()
        toast.error(`Error al guardar: ${err.detail || "Error del servidor"}`)
      }
    } catch {
      toast.error("Error de conexión al guardar la lectura")
    }
  }

  // ── Guardar balanza ──
  const handleSaveBalanza = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        fecha: balanzaForm.fecha,
        codigo_balanza: balanzaForm.codigo_balanza,
        ubicacion: balanzaForm.ubicacion,
        capacidad_g: parseFloat(balanzaForm.capacidad_g) || 0.0,
        masa_patron_g: parseFloat(balanzaForm.masa_patron_g) || 0.0,
        lectura_balanza_g: parseFloat(balanzaForm.lectura_balanza_g) || 0.0,
        error_max_permitido_g: parseFloat(balanzaForm.error_max_permitido_g) || 0.5,
        limpieza_nivelacion: balanzaForm.limpieza_nivelacion,
        verificado_por: balanzaForm.verificado_por,
        observaciones: balanzaForm.observaciones,
      }
      const url = editingBalanzaId
        ? `${API_URL}/api/control-ambiental/balanza/${editingBalanzaId}`
        : `${API_URL}/api/control-ambiental/balanza`
      const method = editingBalanzaId ? "PUT" : "POST"
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast.success(editingBalanzaId ? "Verificación actualizada" : "Verificación registrada con éxito")
        setBalanzaIsDirty(false)
        setShowBalanzaModal(false)
        fetchData()
      } else {
        const err = await res.json()
        toast.error(`Error al guardar: ${err.detail || "Error del servidor"}`)
      }
    } catch {
      toast.error("Error de conexión al guardar la verificación")
    }
  }

  // ── Eliminar ──
  const handleDeleteTemp = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta lectura de temperatura?")) return
    try {
      const res = await authFetch(`${API_URL}/api/control-ambiental/temperatura/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Lectura eliminada")
        fetchData()
      }
    } catch {
      toast.error("Error eliminando registro")
    }
  }

  const handleDeleteBalanza = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta verificación de balanza?")) return
    try {
      const res = await authFetch(`${API_URL}/api/control-ambiental/balanza/${id}`, { method: "DELETE" })
      if (res.ok) {
        toast.success("Verificación eliminada")
        fetchData()
      }
    } catch {
      toast.error("Error eliminando registro")
    }
  }

  // ── Listas filtradas ──
  const filteredTempList = useMemo(() =>
    temperaturaList.filter((item) => {
      const q = searchTemp.toLowerCase()
      const matchSearch =
        item.area_ambiente.toLowerCase().includes(q) ||
        item.responsable_lectura.toLowerCase().includes(q) ||
        item.fecha.includes(q)
      const matchArea = areaFilter === "TODAS" || item.area_ambiente.toUpperCase().includes(areaFilter.toUpperCase())
      return matchSearch && matchArea
    }),
  [temperaturaList, searchTemp, areaFilter])

  const filteredBalanzaList = useMemo(() =>
    balanzaList.filter((item) => {
      const q = searchBalanza.toLowerCase()
      const matchSearch =
        item.codigo_balanza.toLowerCase().includes(q) ||
        item.ubicacion.toLowerCase().includes(q) ||
        item.verificado_por.toLowerCase().includes(q) ||
        item.fecha.includes(q)
      const matchBalanza = balanzaFilter === "TODAS" || item.codigo_balanza === balanzaFilter
      return matchSearch && matchBalanza
    }),
  [balanzaList, searchBalanza, balanzaFilter])

  // ── Paginated data calculation ──
  const tempTotalPages = Math.ceil(filteredTempList.length / tempRowsPerPage) || 1
  const paginatedTempList = useMemo(() => {
    const start = (tempPage - 1) * tempRowsPerPage
    return filteredTempList.slice(start, start + tempRowsPerPage)
  }, [filteredTempList, tempPage, tempRowsPerPage])

  const balanzaTotalPages = Math.ceil(filteredBalanzaList.length / balanzaRowsPerPage) || 1
  const paginatedBalanzaList = useMemo(() => {
    const start = (balanzaPage - 1) * balanzaRowsPerPage
    return filteredBalanzaList.slice(start, start + balanzaRowsPerPage)
  }, [filteredBalanzaList, balanzaPage, balanzaRowsPerPage])

  // ── Balanza calculation error helper ──
  const balanzaErrorCalc = useMemo(() => {
    const m = parseFloat(balanzaForm.masa_patron_g) || 0
    const l = parseFloat(balanzaForm.lectura_balanza_g) || 0
    const tol = parseFloat(balanzaForm.error_max_permitido_g) || 0.5
    const err = l - m
    const conforme = Math.abs(err) <= tol
    return { error: err, conforme }
  }, [balanzaForm.masa_patron_g, balanzaForm.lectura_balanza_g, balanzaForm.error_max_permitido_g])

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: MODULE 1 · CONTROL DE TEMPERATURA Y HUMEDAD
  // ─────────────────────────────────────────────────────────────────────────────
  if (currentModuleMode === "temperatura") {
    return (
      <div className="space-y-6">
        {/* Header estilo Imagen 2 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-sky-100 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0 shadow-xs">
              <Thermometer className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Control de Temperatura y Humedad
              </h1>
              <p className="text-xs text-muted-foreground">
                Control de temperatura y humedad relativa (F-LEM-P-05.01 V03).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Input
                placeholder="Buscar por área, fecha, usuario..."
                value={searchTemp}
                onChange={(e) => {
                  setSearchTemp(e.target.value)
                  setTempPage(1)
                }}
                className="pl-9 h-9 text-xs bg-white"
              />
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9 bg-white"
              onClick={() => void fetchData()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() =>
                executeWithSafetyCheck(() => {
                  setEditingTempId(null)
                  setTempIsDirty(false)
                  setShowTempModal(true)
                })
              }
              className="gap-2 h-9 bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Nuevo Registro
            </Button>
          </div>
        </div>

        {/* Card Historial estilo Imagen 2 */}
        <div className="border rounded-xl shadow-xs bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Historial Control de Temperatura
              </h3>
              <p className="text-xs text-muted-foreground">
                Registros guardados con acceso a detalle y edición.
              </p>
            </div>
            <Select value={areaFilter} onValueChange={(val) => { setAreaFilter(val); setTempPage(1) }}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-white"><SelectValue placeholder="Filtrar por Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las áreas</SelectItem>
                {DEFAULT_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Table className="w-full text-xs">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-slate-700">Fecha / Hora</TableHead>
                <TableHead className="font-semibold text-slate-700">Área / Ambiente</TableHead>
                <TableHead className="text-center font-semibold text-slate-700">Temp (°C)</TableHead>
                <TableHead className="text-center font-semibold text-slate-700">Humedad (%)</TableHead>
                <TableHead className="text-center font-semibold text-slate-700">Estado</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
                    Cargando registros...
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredTempList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Sin resultados.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                paginatedTempList.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-medium">
                      <div className="font-semibold text-slate-900">{item.fecha}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.hora_lectura}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">{item.area_ambiente}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-sky-600 text-sm">
                      {item.temperatura_c.toFixed(1)}°C
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-blue-600 text-sm">
                      {item.humedad_relativa_pct.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        item.cumple_especificacion
                          ? "bg-blue-50 text-blue-600 border-blue-100"
                          : "bg-red-50 text-red-600 border-red-100"
                      }`}>
                        {item.cumple_especificacion ? "CUMPLE" : "NO CUMPLE"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          onClick={() =>
                            executeWithSafetyCheck(() => {
                              setEditingTempId(item.id)
                              setTempForm({
                                fecha: item.fecha,
                                hora_lectura: item.hora_lectura,
                                fecha_lectura: item.fecha,
                                area_ambiente: item.area_ambiente,
                                temperatura_c: String(item.temperatura_c),
                                humedad_relativa_pct: String(item.humedad_relativa_pct),
                                temp_min: item.temp_min ? String(item.temp_min) : "10.0",
                                temp_max: item.temp_max ? String(item.temp_max) : "30.0",
                                hum_min: "20.0",
                                hum_max: "80.0",
                                cumple_especificacion: item.cumple_especificacion,
                                responsable_lectura: item.responsable_lectura,
                                revisado_por: "",
                                observaciones: item.observaciones || "",
                              })
                              setTempIsDirty(false)
                              setShowTempModal(true)
                            })
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          onClick={() =>
                            executeWithSafetyCheck(() => {
                              setEditingTempId(item.id)
                              setTempForm({
                                fecha: item.fecha,
                                hora_lectura: item.hora_lectura,
                                fecha_lectura: item.fecha,
                                area_ambiente: item.area_ambiente,
                                temperatura_c: String(item.temperatura_c),
                                humedad_relativa_pct: String(item.humedad_relativa_pct),
                                temp_min: item.temp_min ? String(item.temp_min) : "10.0",
                                temp_max: item.temp_max ? String(item.temp_max) : "30.0",
                                hum_min: "20.0",
                                hum_max: "80.0",
                                cumple_especificacion: item.cumple_especificacion,
                                responsable_lectura: item.responsable_lectura,
                                revisado_por: "",
                                observaciones: item.observaciones || "",
                              })
                              setTempIsDirty(false)
                              setShowTempModal(true)
                            })
                          }
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteTemp(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>

          {/* Pagination Footer estilo Imagen 2 */}
          {!loading && filteredTempList.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t px-5 py-3 text-xs gap-3">
              <span className="text-muted-foreground">
                Mostrando {(tempPage - 1) * tempRowsPerPage + 1} a{" "}
                {Math.min(tempPage * tempRowsPerPage, filteredTempList.length)} de{" "}
                {filteredTempList.length} registros
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Filas por página:</span>
                  <Select
                    value={String(tempRowsPerPage)}
                    onValueChange={(val) => {
                      setTempRowsPerPage(Number(val))
                      setTempPage(1)
                    }}
                  >
                    <SelectTrigger className="w-16 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-white"
                    disabled={tempPage <= 1}
                    onClick={() => setTempPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[90px] text-center font-medium px-2">
                    Página {tempPage} de {tempTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-white"
                    disabled={tempPage >= tempTotalPages}
                    onClick={() => setTempPage((p) => Math.min(tempTotalPages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Form F-LEM-P-05.01 */}
        {renderTempModal()}

        <ModernConfirmDialog
          open={showUnsavedDialog}
          onOpenChange={setShowUnsavedDialog}
          onConfirm={confirmExitWithoutSaving}
          title="¿Desea salir sin guardar los cambios?"
          description="Ha modificado datos en el formulario. Si sale ahora, se perderán los registros ingresados."
          confirmText="Salir sin guardar"
          cancelText="Continuar editando"
          variant="destructive"
        />
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: MODULE 2 · VERIFICACIÓN DE BALANZAS
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header estilo Imagen 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-sky-100 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0 shadow-xs">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Verificación de Balanzas
            </h1>
            <p className="text-xs text-muted-foreground">
              Formato de verificación diaria de balanzas (F-LEM-IN-01.02 V03).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Input
              placeholder="Buscar por código de balanza, ubicación..."
              value={searchBalanza}
              onChange={(e) => {
                setSearchBalanza(e.target.value)
                setBalanzaPage(1)
              }}
              className="pl-9 h-9 text-xs bg-white"
            />
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-9 bg-white"
            onClick={() => void fetchData()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() =>
              executeWithSafetyCheck(() => {
                setEditingBalanzaId(null)
                setBalanzaIsDirty(false)
                setShowBalanzaModal(true)
              })
            }
            className="gap-2 h-9 bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nueva Verificación
          </Button>
        </div>
      </div>

      {/* Card Historial estilo Imagen 2 */}
      <div className="border rounded-xl shadow-xs bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Historial Verificación de Balanzas
            </h3>
            <p className="text-xs text-muted-foreground">
              Registros guardados con acceso a detalle y edición.
            </p>
          </div>
          <Select value={balanzaFilter} onValueChange={(val) => { setBalanzaFilter(val); setBalanzaPage(1) }}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-white"><SelectValue placeholder="Filtrar por Balanza" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas las balanzas</SelectItem>
              {DEFAULT_BALANZAS.map((b) => <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} — {b.ubi}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Table className="w-full text-xs">
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-slate-700">Código Balanza</TableHead>
              <TableHead className="font-semibold text-slate-700">Ubicación / Fecha</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">Masa Patrón (g)</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">Lectura (g)</TableHead>
              <TableHead className="text-center font-semibold text-slate-700">Error (g)</TableHead>
              <TableHead className="text-center font-semibold text-slate-700">Estado</TableHead>
              <TableHead className="text-right font-semibold text-slate-700 pr-6">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
                  Cargando verificaciones...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredBalanzaList.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              paginatedBalanzaList.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-bold text-sky-600 text-sm">
                    {item.codigo_balanza}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="font-semibold text-slate-900">{item.ubicacion}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{item.fecha}</div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{item.masa_patron_g}g</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold">{item.lectura_balanza_g}g</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    <span className={item.error_g === 0 ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                      {item.error_g > 0 ? `+${item.error_g}` : item.error_g}g
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      item.estado_conforme
                        ? "bg-blue-50 text-blue-600 border-blue-100"
                        : "bg-red-50 text-red-600 border-red-100"
                    }`}>
                      {item.estado_conforme ? "CONFORME" : "NO CONFORME"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() =>
                          executeWithSafetyCheck(() => {
                            setEditingBalanzaId(item.id)
                            const fechaObj = new Date(item.fecha + "T00:00:00")
                            setBalanzaForm({
                              fecha: item.fecha,
                              hora: "08:00",
                              mes_anio: fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase(),
                              codigo_balanza: item.codigo_balanza,
                              ubicacion: item.ubicacion,
                              codigos_pesas_patron: "PP-01, PP-02, PP-05",
                              capacidad_g: String(item.capacidad_g),
                              masa_patron_g: String(item.masa_patron_g),
                              lectura_balanza_g: String(item.lectura_balanza_g),
                              error_max_permitido_g: String(item.error_max_permitido_g),
                              limpieza_nivelacion: item.limpieza_nivelacion,
                              verificado_por: item.verificado_por,
                              revisado_por: "",
                              observaciones: item.observaciones || "",
                            })
                            setBalanzaIsDirty(false)
                            setShowBalanzaModal(true)
                          })
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() =>
                          executeWithSafetyCheck(() => {
                            setEditingBalanzaId(item.id)
                            const fechaObj = new Date(item.fecha + "T00:00:00")
                            setBalanzaForm({
                              fecha: item.fecha,
                              hora: "08:00",
                              mes_anio: fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase(),
                              codigo_balanza: item.codigo_balanza,
                              ubicacion: item.ubicacion,
                              codigos_pesas_patron: "PP-01, PP-02, PP-05",
                              capacidad_g: String(item.capacidad_g),
                              masa_patron_g: String(item.masa_patron_g),
                              lectura_balanza_g: String(item.lectura_balanza_g),
                              error_max_permitido_g: String(item.error_max_permitido_g),
                              limpieza_nivelacion: item.limpieza_nivelacion,
                              verificado_por: item.verificado_por,
                              revisado_por: "",
                              observaciones: item.observaciones || "",
                            })
                            setBalanzaIsDirty(false)
                            setShowBalanzaModal(true)
                          })
                        }
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteBalanza(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>

        {/* Pagination Footer estilo Imagen 2 */}
        {!loading && filteredBalanzaList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t px-5 py-3 text-xs gap-3">
            <span className="text-muted-foreground">
              Mostrando {(balanzaPage - 1) * balanzaRowsPerPage + 1} a{" "}
              {Math.min(balanzaPage * balanzaRowsPerPage, filteredBalanzaList.length)} de{" "}
              {filteredBalanzaList.length} registros
            </span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Filas por página:</span>
                <Select
                  value={String(balanzaRowsPerPage)}
                  onValueChange={(val) => {
                    setBalanzaRowsPerPage(Number(val))
                    setBalanzaPage(1)
                  }}
                >
                  <SelectTrigger className="w-16 h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  disabled={balanzaPage <= 1}
                  onClick={() => setBalanzaPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-[90px] text-center font-medium px-2">
                  Página {balanzaPage} de {balanzaTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 bg-white"
                  disabled={balanzaPage >= balanzaTotalPages}
                  onClick={() => setBalanzaPage((p) => Math.min(balanzaTotalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Form F-LEM-IN-01.02 */}
      {renderBalanzaModal()}

      <ModernConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={confirmExitWithoutSaving}
        title="¿Desea salir sin guardar los cambios?"
        description="Ha modificado datos en el formulario. Si sale ahora, se perderán los registros ingresados."
        confirmText="Salir sin guardar"
        cancelText="Continuar editando"
        variant="destructive"
      />
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  // FORMULARIO SHEET EXCEL EXACTO ILUSTRADO EN LA SEGUNDA IMAGEN: F-LEM-P-05.01 V03
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTempModal() {
    return (
      <Dialog
        open={showTempModal}
        onOpenChange={(o) => {
          if (!o) executeWithSafetyCheck(() => setShowTempModal(false))
          else setShowTempModal(true)
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[1000px] max-h-[92vh] overflow-y-auto p-6 bg-white">
          <form onSubmit={handleSaveTemp} className="space-y-4">
            {/* Header Formato Oficial (Imagen F-LEM-P-05.01 V03) */}
            <div className="border border-slate-400 rounded-md p-3 bg-white text-center space-y-1">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Image src="/logo-geofal.svg" alt="Geofal Logo" width={110} height={32} className="h-7 w-auto" />
              </div>
              <h2 className="font-bold text-sm sm:text-base uppercase text-slate-900 tracking-wide underline">
                LABORATORIO DE ENSAYO DE MATERIALES
              </h2>
              <h3 className="font-bold text-xs sm:text-sm uppercase text-slate-800 tracking-wide underline">
                F-LEM-P-05.01 V03 CONTROL DE TEMPERATURA Y HUMEDAD RELATIVA
              </h3>
            </div>

            {/* Cabecera de 4 cajas (REGISTRO | MES-AÑO | APROBADO POR | FECHA DE APROBACIÓN) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="border border-slate-400 rounded-md p-2 bg-slate-50/50 space-y-1">
                <label className="text-[10px] font-bold text-slate-900 uppercase block text-center">
                  REGISTRO
                </label>
                <Input
                  defaultValue="REG-01"
                  className="h-7 text-xs font-mono text-center bg-white"
                />
              </div>
              <div className="border border-slate-400 rounded-md p-2 bg-slate-50/50 space-y-1">
                <label className="text-[10px] font-bold text-slate-900 uppercase block text-center">
                  MES-AÑO
                </label>
                <Input
                  value={tempForm.fecha ? tempForm.fecha.substring(0, 7) : "2026-08"}
                  onChange={(e) => {
                    setTempForm((p) => ({ ...p, fecha: e.target.value + "-01" }))
                    setTempIsDirty(true)
                  }}
                  className="h-7 text-xs font-mono text-center uppercase bg-white"
                  placeholder="AGOSTO-2026"
                />
              </div>
              <div className="border border-slate-400 rounded-md p-2 bg-slate-50/50 space-y-1">
                <label className="text-[10px] font-bold text-slate-900 uppercase block text-center">
                  APROBADO POR
                </label>
                <Input
                  defaultValue="JEFE DE LABORATORIO"
                  className="h-7 text-xs text-center uppercase bg-white"
                />
              </div>
              <div className="border border-slate-400 rounded-md p-2 bg-slate-50/50 space-y-1">
                <label className="text-[10px] font-bold text-slate-900 uppercase block text-center">
                  FECHA DE APROBACIÓN
                </label>
                <Input
                  type="date"
                  defaultValue="2024-01-02"
                  className="h-7 text-xs font-mono text-center bg-white"
                />
              </div>
            </div>

            {/* Sección DATOS + Tabla de Parámetros de las Áreas */}
            <div className="border border-slate-400 rounded-md p-3 bg-white grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7 space-y-3">
                <div className="bg-slate-200 px-3 py-1 font-bold text-xs uppercase border border-slate-400 text-slate-900 text-center">
                  DATOS
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-900 w-36 shrink-0">
                      ÁREA DE CONTROL:
                    </label>
                    <Select
                      value={tempForm.area_ambiente}
                      onValueChange={(val) => {
                        setTempForm((p) => ({ ...p, area_ambiente: val }))
                        setTempIsDirty(true)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-semibold bg-white flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Area de Recepción de muestras">Area de Recepción de muestras</SelectItem>
                        <SelectItem value="Área de Ensayos físicos">Área de Ensayos físicos</SelectItem>
                        <SelectItem value="Area de Ensayos especiales">Area de Ensayos especiales</SelectItem>
                        <SelectItem value="Area de Temperatura controlada">Area de Temperatura controlada</SelectItem>
                        <SelectItem value="Area de Lavado y compactación">Area de Lavado y compactación</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-900 w-36 shrink-0">
                      PARÁMETROS:
                    </label>
                    <Input
                      readOnly
                      value={
                        tempForm.area_ambiente.includes("compactación")
                          ? "18 °C – 24 °C | Menor a 80 %"
                          : "10 °C – 30 °C | Menor a 80 %"
                      }
                      className="h-8 text-xs font-mono font-semibold bg-slate-50 flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Tabla PARÁMETROS DE LAS ÁREAS */}
              <div className="lg:col-span-5 border border-slate-400 rounded overflow-hidden text-[11px]">
                <div className="bg-slate-100 p-1.5 font-bold text-center border-b border-slate-400 text-slate-900 uppercase">
                  PARÁMETROS DE LAS ÁREAS
                </div>
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-300">
                      <td className="p-1.5 font-medium border-r border-slate-300">Area de Recepción de muestras</td>
                      <td className="p-1.5 font-bold text-center">10 °C – 30 °C<br/>Menor a 80 %</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-1.5 font-medium border-r border-slate-300">Área de Ensayos físicos</td>
                      <td className="p-1.5 font-bold text-center">10 °C – 30 °C<br/>Menor a 80 %</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-1.5 font-medium border-r border-slate-300">Area de Ensayos especiales</td>
                      <td className="p-1.5 font-bold text-center">10 °C – 30 °C<br/>Menor a 80 %</td>
                    </tr>
                    <tr className="border-b border-slate-300">
                      <td className="p-1.5 font-medium border-r border-slate-300">Area de Temperatura controlada</td>
                      <td className="p-1.5 font-bold text-center">10 °C – 30 °C<br/>Menor a 80 %</td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-medium border-r border-slate-300">Area de Lavado y compactación</td>
                      <td className="p-1.5 font-bold text-center">18 °C – 24 °C<br/>Menor a 80 %</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table Grid Sheet de Datos (F-LEM-P-05.01) */}
            <div className="border border-slate-400 rounded-md overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-100 font-bold text-[11px] text-slate-900 border-b border-slate-400 text-center">
                    <tr>
                      <th className="border-r border-slate-300 p-2 w-32">FECHA DE REGISTRO DE DATOS</th>
                      <th className="border-r border-slate-300 p-2 w-24">HORA DE TOMA DE DATOS</th>
                      <th className="border-r border-slate-300 p-2 w-32">FECHA DE LECTURA DE TEMPERATURA Y HUMEDAD</th>
                      <th className="border-r border-slate-300 p-1" colSpan={2}>
                        TEMPERATURA (°C)
                        <div className="grid grid-cols-2 border-t border-slate-300 mt-1 font-semibold text-[10px]">
                          <div className="border-r border-slate-300 p-1">Mínimo</div>
                          <div className="p-1">Máximo</div>
                        </div>
                      </th>
                      <th className="border-r border-slate-300 p-1" colSpan={2}>
                        HUMEDAD RELATIVA (%)
                        <div className="grid grid-cols-2 border-t border-slate-300 mt-1 font-semibold text-[10px]">
                          <div className="border-r border-slate-300 p-1">Mínimo</div>
                          <div className="p-1">Máximo</div>
                        </div>
                      </th>
                      <th className="border-r border-slate-300 p-2 w-40">[ ] RESPONSABLE DEL REGISTRO</th>
                      <th className="p-2 w-40">[ ] RESPONSABLE DE LA REVISIÓN DEL REGISTRO</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="date"
                          value={tempForm.fecha}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, fecha: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono text-center"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="time"
                          value={tempForm.hora_lectura}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, hora_lectura: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono text-center"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="date"
                          value={tempForm.fecha_lectura || tempForm.fecha}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, fecha_lectura: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono text-center"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Mín"
                          value={tempForm.temp_min}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, temp_min: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono text-center"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Máx / Actual"
                          value={tempForm.temperatura_c}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, temperatura_c: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono font-bold text-sky-700 text-center"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Mín"
                          value={tempForm.hum_min}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, hum_min: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono text-center"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="Máx / Actual"
                          value={tempForm.humedad_relativa_pct}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, humedad_relativa_pct: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono font-bold text-blue-700 text-center"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          value={tempForm.responsable_lectura}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, responsable_lectura: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs"
                          placeholder="Nombre operador"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={tempForm.revisado_por}
                          onChange={(e) => {
                            setTempForm((p) => ({ ...p, revisado_por: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          className="h-8 text-xs"
                          placeholder="Nombre revisor"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cumple Especificación Toggle */}
            <div className="flex items-center justify-between p-3 rounded-md border border-slate-300 bg-slate-50">
              <span className="text-xs font-bold text-slate-800">
                Cumple Especificaciones del Área
              </span>
              <div className="flex gap-2">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => {
                      setTempForm((p) => ({ ...p, cumple_especificacion: val }))
                      setTempIsDirty(true)
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                      tempForm.cumple_especificacion === val
                        ? val
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-red-600 border-red-600 text-white"
                        : "border-slate-300 text-slate-600 bg-white"
                    }`}
                  >
                    {val ? "SÍ CUMPLE (OK)" : "NO CUMPLE"}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowTempModal(false))}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white">
                {editingTempId ? "Actualizar Registro" : "Guardar Registro"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FORMULARIO SHEET EXACTO ILUSTRADO EN LA PRIMERA IMAGEN: F-LEM-IN-01.02 V03
  // ─────────────────────────────────────────────────────────────────────────────
  function renderBalanzaModal() {
    return (
      <Dialog
        open={showBalanzaModal}
        onOpenChange={(o) => {
          if (!o) executeWithSafetyCheck(() => setShowBalanzaModal(false))
          else setShowBalanzaModal(true)
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[1000px] max-h-[92vh] overflow-y-auto p-6 bg-white">
          <form onSubmit={handleSaveBalanza} className="space-y-4">
            {/* Header Formato Oficial idéntico a Imagen 1 */}
            <div className="border border-slate-400 rounded-md p-3 bg-white flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Image src="/logo-geofal.svg" alt="Geofal Logo" width={110} height={32} className="h-8 w-auto" />
              </div>
              <div className="flex-1 text-center">
                <h2 className="font-bold text-sm sm:text-base uppercase text-slate-900 tracking-wide">
                  FORMATO DE VERIFICACIÓN DIARIA DE BALANZAS
                </h2>
              </div>
              <div className="border border-slate-400 rounded bg-slate-50 p-2 text-[10px] space-y-0.5 text-slate-700 font-mono">
                <div><span className="font-bold">CÓDIGO:</span> F-LEM-IN-01.02</div>
                <div><span className="font-bold">VERSIÓN:</span> 03</div>
                <div><span className="font-bold">FECHA:</span> 02-01-2024</div>
                <div><span className="font-bold">PÁGINA:</span> 1 de 1</div>
              </div>
            </div>

            {/* Cabecera del Formato (Imagen 1): CÓDIGO DE LA BALANZA | MES/AÑO | PESAS PATRÓN */}
            <div className="border border-slate-400 rounded-md p-3 space-y-3 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-900 uppercase">
                    CÓDIGO DE LA BALANZA:
                  </label>
                  <Select
                    value={balanzaForm.codigo_balanza}
                    onValueChange={(val) => {
                      const found = DEFAULT_BALANZAS.find((b) => b.codigo === val)
                      setBalanzaForm((p) => ({
                        ...p,
                        codigo_balanza: val,
                        ubicacion: found?.ubi || p.ubicacion,
                        capacidad_g: found ? String(found.cap) : p.capacidad_g,
                        masa_patron_g: found ? String(found.masa) : p.masa_patron_g,
                        error_max_permitido_g: found ? String(found.tol) : p.error_max_permitido_g,
                      }))
                      setBalanzaIsDirty(true)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-bold bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEFAULT_BALANZAS.map((b) => (
                        <SelectItem key={b.codigo} value={b.codigo}>
                          {b.codigo} — {b.ubi} ({b.cap}g)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-900 uppercase">
                    MES / AÑO:
                  </label>
                  <Input
                    value={balanzaForm.mes_anio}
                    onChange={(e) => {
                      setBalanzaForm((p) => ({ ...p, mes_anio: e.target.value }))
                      setBalanzaIsDirty(true)
                    }}
                    className="h-8 text-xs font-mono uppercase bg-white"
                    placeholder="AGOSTO 2026"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-900 uppercase">
                    UBICACIÓN:
                  </label>
                  <Input
                    value={balanzaForm.ubicacion}
                    onChange={(e) => {
                      setBalanzaForm((p) => ({ ...p, ubicacion: e.target.value }))
                      setBalanzaIsDirty(true)
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-900 uppercase">
                  CÓDIGOS DE LAS PESAS PATRÓN:
                </label>
                <Input
                  value={balanzaForm.codigos_pesas_patron}
                  onChange={(e) => {
                    setBalanzaForm((p) => ({ ...p, codigos_pesas_patron: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  className="h-8 text-xs font-mono bg-white"
                  placeholder="Ej: PP-50G, PP-100G, PP-500G, PP-2000G"
                />
              </div>
            </div>

            {/* Grid Formulario Sheet Interactivo (F-LEM-IN-01.02 de Imagen 1) */}
            <div className="border border-slate-400 rounded-md overflow-hidden bg-white">
              <div className="bg-slate-200 px-3 py-1.5 text-center font-bold text-xs uppercase border-b border-slate-400 text-slate-800">
                PESA PATRÓN USADO (g) - ANOTAR LAS LECTURAS DE LA BALANZA
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-100 font-bold text-[11px] text-slate-800 border-b border-slate-400">
                    <tr>
                      <th className="border-r border-slate-300 p-2 w-28">FECHA</th>
                      <th className="border-r border-slate-300 p-2 w-20">HORA</th>
                      <th className="border-r border-slate-300 p-2 w-28">Temp (°C)</th>
                      <th className="border-r border-slate-300 p-2 w-28">Humedad (%H.R.)</th>
                      <th className="border-r border-slate-300 p-2 text-right">Masa Patrón (g)</th>
                      <th className="border-r border-slate-300 p-2 text-right">Lectura (g)</th>
                      <th className="border-r border-slate-300 p-2 text-center w-28">Error / Result</th>
                      <th className="border-r border-slate-300 p-2 w-36">Realizado por:</th>
                      <th className="p-2 w-36">Revisado por:</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="date"
                          value={balanzaForm.fecha}
                          onChange={(e) => {
                            setBalanzaForm((p) => ({ ...p, fecha: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="time"
                          value={balanzaForm.hora}
                          onChange={(e) => {
                            setBalanzaForm((p) => ({ ...p, hora: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="23.0"
                          defaultValue="23.0"
                          className="h-8 text-xs font-mono"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="50.0"
                          defaultValue="50.0"
                          className="h-8 text-xs font-mono"
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={balanzaForm.masa_patron_g}
                          onChange={(e) => {
                            setBalanzaForm((p) => ({ ...p, masa_patron_g: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono font-bold text-right"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={balanzaForm.lectura_balanza_g}
                          onChange={(e) => {
                            setBalanzaForm((p) => ({ ...p, lectura_balanza_g: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          className="h-8 text-xs font-mono font-bold text-sky-700 text-right"
                          required
                        />
                      </td>
                      <td className="border-r border-slate-300 p-2 text-center">
                        <div
                          className={`h-8 flex items-center justify-center rounded px-2 text-xs font-bold ${
                            balanzaErrorCalc.conforme
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {balanzaErrorCalc.conforme ? "OK" : "NO OK"} (
                          {balanzaErrorCalc.error >= 0 ? "+" : ""}
                          {balanzaErrorCalc.error.toFixed(2)}g)
                        </div>
                      </td>
                      <td className="border-r border-slate-300 p-2">
                        <Input
                          value={balanzaForm.verificado_por}
                          onChange={(e) => {
                            setBalanzaForm((p) => ({ ...p, verificado_por: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          className="h-8 text-xs"
                          placeholder="Operador"
                          required
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          value={balanzaForm.revisado_por}
                          onChange={(e) => {
                            setBalanzaForm((p) => ({ ...p, revisado_por: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          className="h-8 text-xs"
                          placeholder="Revisado por"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Limpieza y nivelación */}
            <div className="flex items-center justify-between p-3 rounded-md border border-slate-300 bg-slate-50">
              <span className="text-xs font-bold text-slate-800">
                Limpieza y Nivelación de la Balanza
              </span>
              <div className="flex gap-2">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => {
                      setBalanzaForm((p) => ({ ...p, limpieza_nivelacion: val }))
                      setBalanzaIsDirty(true)
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                      balanzaForm.limpieza_nivelacion === val
                        ? val
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-red-600 border-red-600 text-white"
                        : "border-slate-300 text-slate-600 bg-white"
                    }`}
                  >
                    {val ? "CONFORME (OK)" : "NO CONFORME"}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowBalanzaModal(false))}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white">
                {editingBalanzaId ? "Actualizar Verificación" : "Guardar Verificación"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
}
