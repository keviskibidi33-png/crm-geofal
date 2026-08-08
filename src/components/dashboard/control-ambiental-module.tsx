"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {

  Thermometer,
  Scale,
  Activity,
  Plus,
  RefreshCw,
  Download,
  Database,
  Search,
  Clock,
  Edit2,
  Trash2,
  FlaskConical,
  ShieldCheck,
  History,
  CheckCircle2,
  XCircle,
  User,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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

interface AreaStatus {
  area: string
  temperatura_actual: number
  humedad_actual: number
  norma: string
  rango_temperatura: string
  rango_humedad: string
  conforme: boolean
  ultima_lectura: string
}

interface DashboardData {
  total_lecturas_temperatura: number
  promedio_temperatura_c: number
  promedio_humedad_pct: number
  tasa_cumplimiento_temp_pct: number
  total_balanzas_registradas: number
  balanzas_verificadas_hoy: number
  tasa_conformidad_balanzas_pct: number
  alertas_activas: number
  areas_resumen: AreaStatus[]
}

// ─── Catálogos ────────────────────────────────────────────────────────────────

const DEFAULT_AREAS = [
  "CÁMARA HÚMEDA",
  "LABORATORIO SUELOS",
  "LABORATORIO CONCRETO",
  "ENSAYOS QUÍMICOS",
]

const DEFAULT_BALANZAS = [
  { codigo: "BAL-01", ubi: "Muestras / Cám. Húmeda",  cap: 30000, masa: 5000, tol: 1.0   },
  { codigo: "BAL-02", ubi: "Laboratorio Suelos",       cap: 20000, masa: 2000, tol: 0.5   },
  { codigo: "BAL-03", ubi: "Laboratorio Concreto",     cap: 5000,  masa: 1000, tol: 0.1   },
  { codigo: "BAL-04", ubi: "Química / Finos",          cap: 1000,  masa: 500,  tol: 0.05  },
  { codigo: "BAL-05", ubi: "Analítica General",        cap: 300,   masa: 100,  tol: 0.005 },
  { codigo: "BAL-06", ubi: "Laboratorio Huanta",       cap: 15000, masa: 2000, tol: 0.5   },
]

/** Tabla de referencia normativa — F-LEM-P-05.01 */
const AREA_PARAMETROS = [
  { area: "Área de Recepción de muestras",   temp: "10°C – 30°C",  humedad: "Menor a 80%" },
  { area: "Área de Ensayos Físicos",          temp: "10°C – 30°C",  humedad: "Menor a 80%" },
  { area: "Área de Ensayos especiales",       temp: "10°C – 30°C",  humedad: "Menor a 80%" },
  { area: "Área de Temperatura controlada",   temp: "10°C – 30°C",  humedad: "Menor a 80%" },
  { area: "Área de Lavado y compactación",    temp: "10°C – 24°C",  humedad: "Menor a 80%" },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMesAnio() {
  return new Date()
    .toLocaleString("es-PE", { month: "long", year: "numeric" })
    .toUpperCase()
}

// ─── Componente principal ────────────────────────────────────────────────────

export function ControlAmbientalModule({ user }: ControlAmbientalModuleProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "temperatura" | "balanza">("dashboard")
  const [loading, setLoading]   = useState(false)
  const [seeding, setSeeding]   = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [temperaturaList, setTemperaturaList] = useState<ControlTemperaturaItem[]>([])
  const [balanzaList, setBalanzaList]         = useState<ControlBalanzaItem[]>([])

  // ── Filtros ──
  const [searchTemp,    setSearchTemp]    = useState("")
  const [searchBalanza, setSearchBalanza] = useState("")
  const [areaFilter,    setAreaFilter]    = useState("TODAS")
  const [balanzaFilter, setBalanzaFilter] = useState("TODAS")

  // ── Modal temperatura ──
  const [showTempModal,   setShowTempModal]   = useState(false)
  const [editingTempId,   setEditingTempId]   = useState<number | null>(null)
  const [tempIsDirty,     setTempIsDirty]     = useState(false)
  const [tempForm, setTempForm] = useState({
    fecha:                new Date().toISOString().split("T")[0],
    hora_lectura:         "08:00",
    fecha_lectura:        new Date().toISOString().split("T")[0],
    area_ambiente:        "CÁMARA HÚMEDA",
    temperatura_c:        "23.0",
    humedad_relativa_pct: "95.0",
    temp_min:             "",
    temp_max:             "",
    hum_min:              "",
    hum_max:              "",
    cumple_especificacion: true,
    responsable_lectura:  user.name || "LABORATORIO",
    revisado_por:         "",
    observaciones:        "",
  })

  // ── Modal balanza ──
  const [showBalanzaModal,  setShowBalanzaModal]  = useState(false)
  const [editingBalanzaId,  setEditingBalanzaId]  = useState<number | null>(null)
  const [balanzaIsDirty,    setBalanzaIsDirty]    = useState(false)
  const [balanzaForm, setBalanzaForm] = useState({
    fecha:                 new Date().toISOString().split("T")[0],
    hora:                  "08:00",
    mes_anio:              getMesAnio(),
    codigo_balanza:        "BAL-01",
    ubicacion:             "Muestras / Cám. Húmeda",
    codigos_pesas_patron:  "",
    capacidad_g:           "30000",
    masa_patron_g:         "5000",
    lectura_balanza_g:     "5000.0",
    error_max_permitido_g: "1.0",
    limpieza_nivelacion:   true,
    verificado_por:        user.name || "LABORATORIO",
    revisado_por:          "",
    observaciones:         "",
  })

  // ── Safety exit ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingExitAction,  setPendingExitAction] = useState<(() => void) | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [resDash, resTemp, resBal] = await Promise.all([
        authFetch(`${API_URL}/api/control-ambiental/dashboard`),
        authFetch(`${API_URL}/api/control-ambiental/temperatura?limit=200`),
        authFetch(`${API_URL}/api/control-ambiental/balanza?limit=200`),
      ])
      if (resDash.ok) setDashboardData(await resDash.json())
      if (resTemp.ok) setTemperaturaList(await resTemp.json())
      if (resBal.ok)  setBalanzaList(await resBal.json())
    } catch (error) {
      console.error("Error loading Control Ambiental data:", error)
      toast.error("Error al cargar datos del servidor")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Acciones de cabecera ───────────────────────────────────────────────────

  const handleSeedData = async () => {
    setSeeding(true)
    try {
      const res = await authFetch(`${API_URL}/api/control-ambiental/seed`, { method: "POST" })
      if (res.ok) {
        const payload = await res.json()
        toast.success("Inyección completada", {
          description: payload.message || `Se sembraron ${payload.registros_creados} registros.`,
        })
        fetchData()
      } else {
        toast.error("No se pudo sembrar los datos reales")
      }
    } catch {
      toast.error("Error en la solicitud de siembra de datos")
    } finally {
      setSeeding(false)
    }
  }

  const handleExportTempExcel = () => {
    window.open(`${API_URL}/api/control-ambiental/temperatura/excel`, "_blank")
    toast.info("Descargando reporte F-LEM-P-05.01...")
  }

  const handleExportBalanzaExcel = () => {
    window.open(`${API_URL}/api/control-ambiental/balanza/excel`, "_blank")
    toast.info("Descargando reporte F-LEM-IN-01.02...")
  }

  // ── Safety exit ────────────────────────────────────────────────────────────

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
    if (pendingExitAction) { pendingExitAction(); setPendingExitAction(null) }
  }

  // ── Guardar temperatura ────────────────────────────────────────────────────

  const handleSaveTemp = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        fecha:                tempForm.fecha,
        hora_lectura:         tempForm.hora_lectura,
        area_ambiente:        tempForm.area_ambiente,
        temperatura_c:        parseFloat(tempForm.temperatura_c) || 0.0,
        humedad_relativa_pct: parseFloat(tempForm.humedad_relativa_pct) || 0.0,
        temp_min:             tempForm.temp_min ? parseFloat(tempForm.temp_min) : null,
        temp_max:             tempForm.temp_max ? parseFloat(tempForm.temp_max) : null,
        cumple_especificacion: tempForm.cumple_especificacion,
        responsable_lectura:  tempForm.responsable_lectura,
        observaciones:        tempForm.observaciones,
      }
      const url    = editingTempId ? `${API_URL}/api/control-ambiental/temperatura/${editingTempId}` : `${API_URL}/api/control-ambiental/temperatura`
      const method = editingTempId ? "PUT" : "POST"
      const res    = await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
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

  // ── Guardar balanza ────────────────────────────────────────────────────────

  const handleSaveBalanza = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        fecha:                 balanzaForm.fecha,
        codigo_balanza:        balanzaForm.codigo_balanza,
        ubicacion:             balanzaForm.ubicacion,
        capacidad_g:           parseFloat(balanzaForm.capacidad_g) || 0.0,
        masa_patron_g:         parseFloat(balanzaForm.masa_patron_g) || 0.0,
        lectura_balanza_g:     parseFloat(balanzaForm.lectura_balanza_g) || 0.0,
        error_max_permitido_g: parseFloat(balanzaForm.error_max_permitido_g) || 0.5,
        limpieza_nivelacion:   balanzaForm.limpieza_nivelacion,
        verificado_por:        balanzaForm.verificado_por,
        observaciones:         balanzaForm.observaciones,
      }
      const url    = editingBalanzaId ? `${API_URL}/api/control-ambiental/balanza/${editingBalanzaId}` : `${API_URL}/api/control-ambiental/balanza`
      const method = editingBalanzaId ? "PUT" : "POST"
      const res    = await authFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
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

  // ── Eliminar ───────────────────────────────────────────────────────────────

  const handleDeleteTemp = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta lectura de temperatura?")) return
    try {
      const res = await authFetch(`${API_URL}/api/control-ambiental/temperatura/${id}`, { method: "DELETE" })
      if (res.ok) { toast.success("Lectura eliminada"); fetchData() }
    } catch { toast.error("Error eliminando registro") }
  }

  const handleDeleteBalanza = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta verificación de balanza?")) return
    try {
      const res = await authFetch(`${API_URL}/api/control-ambiental/balanza/${id}`, { method: "DELETE" })
      if (res.ok) { toast.success("Verificación eliminada"); fetchData() }
    } catch { toast.error("Error eliminando registro") }
  }

  // ── Listas filtradas ───────────────────────────────────────────────────────

  const filteredTempList = useMemo(() =>
    temperaturaList.filter((item) => {
      const q = searchTemp.toLowerCase()
      const matchSearch = item.area_ambiente.toLowerCase().includes(q) || item.responsable_lectura.toLowerCase().includes(q) || item.fecha.includes(q)
      const matchArea   = areaFilter === "TODAS" || item.area_ambiente.toUpperCase().includes(areaFilter.toUpperCase())
      return matchSearch && matchArea
    }),
  [temperaturaList, searchTemp, areaFilter])

  const filteredBalanzaList = useMemo(() =>
    balanzaList.filter((item) => {
      const q = searchBalanza.toLowerCase()
      const matchSearch  = item.codigo_balanza.toLowerCase().includes(q) || item.ubicacion.toLowerCase().includes(q) || item.verificado_por.toLowerCase().includes(q) || item.fecha.includes(q)
      const matchBalanza = balanzaFilter === "TODAS" || item.codigo_balanza === balanzaFilter
      return matchSearch && matchBalanza
    }),
  [balanzaList, searchBalanza, balanzaFilter])

  // ── Últimos registros combinados ───────────────────────────────────────────

  const ultimosRegistros = useMemo(() => {
    const tempItems = temperaturaList.map((item) => ({
      tipo:        "temperatura" as const,
      fecha:       item.fecha,
      hora:        item.hora_lectura,
      descripcion: item.area_ambiente,
      valor:       `${item.temperatura_c.toFixed(1)}°C / ${item.humedad_relativa_pct.toFixed(1)}%`,
      usuario:     item.responsable_lectura,
      conforme:    item.cumple_especificacion,
      id:          item.id,
    }))
    const balItems = balanzaList.map((item) => ({
      tipo:        "balanza" as const,
      fecha:       item.fecha,
      hora:        "",
      descripcion: `${item.codigo_balanza} — ${item.ubicacion}`,
      valor:       `Lectura: ${item.lectura_balanza_g}g | Patrón: ${item.masa_patron_g}g`,
      usuario:     item.verificado_por,
      conforme:    item.estado_conforme,
      id:          item.id,
    }))
    return [...tempItems, ...balItems]
      .sort((a, b) => {
        const d = b.fecha.localeCompare(a.fecha)
        return d !== 0 ? d : b.hora.localeCompare(a.hora)
      })
      .slice(0, 15)
  }, [temperaturaList, balanzaList])

  // ── Error calculado en tiempo real (balanza) ───────────────────────────────

  const balanzaErrorCalc = useMemo(() => {
    const masa    = parseFloat(balanzaForm.masa_patron_g) || 0
    const lectura = parseFloat(balanzaForm.lectura_balanza_g) || 0
    const tol     = parseFloat(balanzaForm.error_max_permitido_g) || 0
    const error   = lectura - masa
    return { error, absError: Math.abs(error), conforme: Math.abs(error) <= tol }
  }, [balanzaForm.masa_patron_g, balanzaForm.lectura_balanza_g, balanzaForm.error_max_permitido_g])

  // ── Helpers de reset de formularios ───────────────────────────────────────

  const resetTempForm = () => ({
    fecha:                new Date().toISOString().split("T")[0],
    hora_lectura:         "08:00",
    fecha_lectura:        new Date().toISOString().split("T")[0],
    area_ambiente:        "CÁMARA HÚMEDA",
    temperatura_c:        "23.0",
    humedad_relativa_pct: "95.0",
    temp_min:             "21.5",
    temp_max:             "24.0",
    hum_min:              "",
    hum_max:              "",
    cumple_especificacion: true,
    responsable_lectura:  user.name || "LABORATORIO",
    revisado_por:         "",
    observaciones:        "",
  })

  const resetBalanzaForm = () => ({
    fecha:                 new Date().toISOString().split("T")[0],
    hora:                  "08:00",
    mes_anio:              getMesAnio(),
    codigo_balanza:        "BAL-01",
    ubicacion:             "Muestras / Cám. Húmeda",
    codigos_pesas_patron:  "",
    capacidad_g:           "30000",
    masa_patron_g:         "5000",
    lectura_balanza_g:     "5000.0",
    error_max_permitido_g: "1.0",
    limpieza_nivelacion:   true,
    verificado_por:        user.name || "LABORATORIO",
    revisado_por:          "",
    observaciones:         "",
  })

  // ─────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto">

      {/* ── Cabecera ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <FlaskConical className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Control Ambiental de Laboratorio</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Temperatura/Humedad (F-LEM-P-05.01) · Verificación de Balanzas (F-LEM-IN-01.02)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9 gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>

          <Button
            variant="outline" size="sm" onClick={handleSeedData} disabled={seeding}
            className="h-9 gap-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/30 text-blue-400 hover:text-blue-300"
          >
            <Database className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
            Sembrar Datos
          </Button>

          <Select onValueChange={(val) => { if (val === "temp") handleExportTempExcel(); if (val === "balanza") handleExportBalanzaExcel() }}>
            <SelectTrigger className="w-[170px] h-9 gap-2">
              <Download className="h-4 w-4" />
              <SelectValue placeholder="Exportar Excel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="temp">Temp. F-LEM-P-05.01</SelectItem>
              <SelectItem value="balanza">Balanzas F-LEM-IN-01.02</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => executeWithSafetyCheck(() => { setEditingTempId(null); setTempForm(resetTempForm()); setTempIsDirty(false); setShowTempModal(true) })}
            className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20"
          >
            <Plus className="h-4 w-4" /> + Temperatura
          </Button>

          <Button
            size="sm"
            onClick={() => executeWithSafetyCheck(() => { setEditingBalanzaId(null); setBalanzaForm(resetBalanzaForm()); setBalanzaIsDirty(false); setShowBalanzaModal(true) })}
            className="h-9 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          >
            <Plus className="h-4 w-4" /> + Balanza
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temp. Promedio</CardTitle>
            <Thermometer className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData ? `${dashboardData.promedio_temperatura_c}°C` : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-emerald-400 font-medium">NTP 339</span> · 20°C – 23°C</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Humedad Promedio</CardTitle>
            <Activity className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData ? `${dashboardData.promedio_humedad_pct}%` : "—"}</div>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-blue-400 font-medium">Cám. Húmeda ≥ 95%</span> · Lab &lt;80%</p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balanzas Verificadas Hoy</CardTitle>
            <Scale className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData ? `${dashboardData.balanzas_verificadas_hoy} / ${dashboardData.total_balanzas_registradas}` : "— / 6"}</div>
            <p className="text-xs text-muted-foreground mt-1"><span className="text-emerald-400 font-medium">Calibración diaria</span></p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conformidad Global</CardTitle>
            <ShieldCheck className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center justify-between">
              <span>{dashboardData ? `${dashboardData.tasa_cumplimiento_temp_pct}%` : "—"}</span>
              <Badge variant={dashboardData && dashboardData.alertas_activas > 0 ? "destructive" : "default"}>
                {dashboardData?.alertas_activas || 0} Alertas
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{dashboardData?.alertas_activas === 0 ? "Sin desviaciones" : "Atención requerida"}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => executeWithSafetyCheck(() => setActiveTab(v as any))} className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="dashboard"   className="gap-2 font-medium"><History    className="h-4 w-4" />Registros</TabsTrigger>
          <TabsTrigger value="temperatura" className="gap-2 font-medium"><Thermometer className="h-4 w-4" />Temperatura</TabsTrigger>
          <TabsTrigger value="balanza"     className="gap-2 font-medium"><Scale       className="h-4 w-4" />Balanzas</TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════════════════
            TAB 1 · DASHBOARD — Estado de áreas + Últimos registros
        ════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dashboard" className="space-y-6">

          {/* Estado por áreas (solo si hay datos reales) */}
          {dashboardData && dashboardData.areas_resumen?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-400" /> Estado Actual por Área
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {dashboardData.areas_resumen.map((area) => (
                  <Card key={area.area} className="border-border/60 hover:border-border transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold truncate">{area.area}</span>
                        <Badge variant={area.conforme ? "default" : "destructive"} className="text-[10px]">
                          {area.conforme ? "OK" : "ALERTA"}
                        </Badge>
                      </div>
                      <div className="flex gap-3 text-sm font-bold">
                        <span className="text-emerald-400">{area.temperatura_actual}°C</span>
                        <span className="text-blue-400">{area.humedad_actual}%</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{area.rango_temperatura} · {area.rango_humedad}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Últimos registros */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <History className="h-4 w-4 text-purple-400" />
                    Últimos Registros
                  </CardTitle>
                  <CardDescription>Temperatura y balanzas — más recientes primero</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">{ultimosRegistros.length} registros</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ultimosRegistros.length === 0 ? (
                <div className="py-14 text-center text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin registros aún. Use los botones de arriba para ingresar datos.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {ultimosRegistros.map((reg, idx) => (
                    <div
                      key={`${reg.tipo}-${reg.id}-${idx}`}
                      className="flex items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors"
                    >
                      {/* Icono tipo */}
                      <div className={`flex-shrink-0 p-2 rounded-lg ${reg.tipo === "temperatura" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        {reg.tipo === "temperatura" ? <Thermometer className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                      </div>

                      {/* Fecha + Hora */}
                      <div className="flex-shrink-0 w-28">
                        <div className="text-xs font-semibold font-mono text-foreground">{reg.fecha}</div>
                        {reg.hora && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-2.5 w-2.5" />{reg.hora}
                          </div>
                        )}
                      </div>

                      {/* Descripción + Valor */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{reg.descripcion}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{reg.valor}</p>
                      </div>

                      {/* Usuario */}
                      <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground w-36 truncate">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate font-medium">{reg.usuario}</span>
                      </div>

                      {/* Estado */}
                      <div className="flex-shrink-0">
                        {reg.conforme ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="h-4 w-4" />Conforme
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
                            <XCircle className="h-4 w-4" />No Conforme
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════
            TAB 2 · TEMPERATURA Y HUMEDAD RELATIVA
        ════════════════════════════════════════════════════════════════ */}
        {/* ════════════════════════════════════════════════════════════════
            TAB 2 · TEMPERATURA Y HUMEDAD RELATIVA — F-LEM-P-05.01
        ════════════════════════════════════════════════════════════════ */}
        <TabsContent value="temperatura" className="space-y-0">

          {/* Header estilo F. Probetas */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Thermometer className="h-6 w-6 text-emerald-400" />
                Temperatura / Humedad
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gestión y control de registros de temperatura y humedad relativa
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9 gap-1.5">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm"
                onClick={() => executeWithSafetyCheck(() => { setEditingTempId(null); setTempForm(resetTempForm()); setTempIsDirty(false); setShowTempModal(true) })}
                className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Plus className="h-4 w-4" /> Nueva Lectura
              </Button>
            </div>
          </div>

          {/* Barra de búsqueda y filtro */}
          <Card className="border-border/60 mb-0 rounded-b-none border-b-0">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por área, responsable, fecha..."
                  value={searchTemp}
                  onChange={(e) => setSearchTemp(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Filtrar por Área" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las áreas</SelectItem>
                  {DEFAULT_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tabla estilo F. Probetas */}
          <Card className="border-border/60 rounded-t-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="py-3 px-5 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                      <th className="py-3 px-5 text-left text-xs font-semibold text-muted-foreground">Hora</th>
                      <th className="py-3 px-5 text-left text-xs font-semibold text-muted-foreground">Área / Ambiente</th>
                      <th className="py-3 px-5 text-center text-xs font-semibold text-muted-foreground">Temperatura</th>
                      <th className="py-3 px-5 text-center text-xs font-semibold text-muted-foreground">Humedad</th>
                      <th className="py-3 px-5 text-center text-xs font-semibold text-muted-foreground">Min / Max °C</th>
                      <th className="py-3 px-5 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                      <th className="py-3 px-5 text-left text-xs font-semibold text-muted-foreground">Responsable</th>
                      <th className="py-3 px-5 text-right text-xs font-semibold text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTempList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-14 text-center text-muted-foreground">
                          <Thermometer className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No se encontraron registros de temperatura.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredTempList.map((item) => (
                        <tr key={item.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          {/* Fecha en badge azul */}
                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-xs font-semibold font-mono">
                              {item.fecha}
                            </span>
                          </td>
                          {/* Hora */}
                          <td className="py-3.5 px-5 text-xs text-muted-foreground font-mono flex items-center gap-1 pt-5">
                            <Clock className="h-3 w-3" />{item.hora_lectura}
                          </td>
                          {/* Área */}
                          <td className="py-3.5 px-5 font-medium text-sm">{item.area_ambiente}</td>
                          {/* Temperatura */}
                          <td className="py-3.5 px-5 text-center">
                            <span className="font-bold text-emerald-400 text-sm">{item.temperatura_c.toFixed(1)}°C</span>
                          </td>
                          {/* Humedad */}
                          <td className="py-3.5 px-5 text-center">
                            <span className="font-bold text-blue-400 text-sm">{item.humedad_relativa_pct.toFixed(1)}%</span>
                          </td>
                          {/* Min / Max */}
                          <td className="py-3.5 px-5 text-center text-xs text-muted-foreground font-mono">
                            {item.temp_min ? `${item.temp_min}°C` : "—"} / {item.temp_max ? `${item.temp_max}°C` : "—"}
                          </td>
                          {/* Estado badge coloreado */}
                          <td className="py-3.5 px-5 text-center">
                            {item.cumple_especificacion ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold">
                                <CheckCircle2 className="h-3 w-3" />Cumple
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 px-2.5 py-1 text-[11px] font-semibold">
                                <XCircle className="h-3 w-3" />No Cumple
                              </span>
                            )}
                          </td>
                          {/* Responsable */}
                          <td className="py-3.5 px-5 text-xs text-muted-foreground font-mono max-w-[140px] truncate">
                            {item.responsable_lectura}
                          </td>
                          {/* Acciones: ojo, lápiz, basura */}
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => executeWithSafetyCheck(() => {
                                  setEditingTempId(item.id)
                                  setTempForm({
                                    fecha: item.fecha, hora_lectura: item.hora_lectura, fecha_lectura: item.fecha,
                                    area_ambiente: item.area_ambiente, temperatura_c: String(item.temperatura_c),
                                    humedad_relativa_pct: String(item.humedad_relativa_pct),
                                    temp_min: item.temp_min ? String(item.temp_min) : "",
                                    temp_max: item.temp_max ? String(item.temp_max) : "",
                                    hum_min: "", hum_max: "",
                                    cumple_especificacion: item.cumple_especificacion,
                                    responsable_lectura: item.responsable_lectura,
                                    revisado_por: "", observaciones: item.observaciones || "",
                                  })
                                  setTempIsDirty(false); setShowTempModal(true)
                                })}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => executeWithSafetyCheck(() => {
                                  setEditingTempId(item.id)
                                  setTempForm({
                                    fecha: item.fecha, hora_lectura: item.hora_lectura, fecha_lectura: item.fecha,
                                    area_ambiente: item.area_ambiente, temperatura_c: String(item.temperatura_c),
                                    humedad_relativa_pct: String(item.humedad_relativa_pct),
                                    temp_min: item.temp_min ? String(item.temp_min) : "",
                                    temp_max: item.temp_max ? String(item.temp_max) : "",
                                    hum_min: "", hum_max: "",
                                    cumple_especificacion: item.cumple_especificacion,
                                    responsable_lectura: item.responsable_lectura,
                                    revisado_por: "", observaciones: item.observaciones || "",
                                  })
                                  setTempIsDirty(false); setShowTempModal(true)
                                })}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400"
                                onClick={() => handleDeleteTemp(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Footer con conteo */}
              {filteredTempList.length > 0 && (
                <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                  <span>Mostrando <span className="font-semibold text-foreground">{filteredTempList.length}</span> de <span className="font-semibold text-foreground">{temperaturaList.length}</span> registros</span>
                  <span className="font-mono text-[10px]">F-LEM-P-05.01 V03</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════
            TAB 3 · CONTROL DE BALANZAS — F-LEM-IN-01.02
        ════════════════════════════════════════════════════════════════ */}
        <TabsContent value="balanza" className="space-y-0">

          {/* Header estilo F. Probetas */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Scale className="h-6 w-6 text-amber-400" />
                Verificación de Balanzas
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gestión y control de formatos de verificación diaria de balanzas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-9 gap-1.5">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm"
                onClick={() => executeWithSafetyCheck(() => { setEditingBalanzaId(null); setBalanzaForm(resetBalanzaForm()); setBalanzaIsDirty(false); setShowBalanzaModal(true) })}
                className="h-9 gap-2 bg-amber-600 hover:bg-amber-500 text-white"
              >
                <Plus className="h-4 w-4" /> Nueva Verificación
              </Button>
            </div>
          </div>

          {/* Barra de búsqueda y filtro */}
          <Card className="border-border/60 mb-0 rounded-b-none border-b-0">
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por código, ubicación, responsable..."
                  value={searchBalanza}
                  onChange={(e) => setSearchBalanza(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={balanzaFilter} onValueChange={setBalanzaFilter}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Filtrar por Balanza" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas las balanzas</SelectItem>
                  {DEFAULT_BALANZAS.map((b) => <SelectItem key={b.codigo} value={b.codigo}>{b.codigo} — {b.ubi}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Tabla estilo F. Probetas */}
          <Card className="border-border/60 rounded-t-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="py-3 px-5 text-left text-xs font-semibold text-muted-foreground">Fecha</th>
                      <th className="py-3 px-5 text-left text-xs font-semibold text-muted-foreground">Código / Ubicación</th>
                      <th className="py-3 px-5 text-right text-xs font-semibold text-muted-foreground">Capacidad</th>
                      <th className="py-3 px-5 text-right text-xs font-semibold text-muted-foreground">Masa Patrón</th>
                      <th className="py-3 px-5 text-right text-xs font-semibold text-muted-foreground">Lectura</th>
                      <th className="py-3 px-5 text-center text-xs font-semibold text-muted-foreground">Error / Tol.</th>
                      <th className="py-3 px-5 text-center text-xs font-semibold text-muted-foreground">Estado</th>
                      <th className="py-3 px-5 text-left text-xs font-semibold text-muted-foreground">Verificado Por</th>
                      <th className="py-3 px-5 text-right text-xs font-semibold text-muted-foreground">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBalanzaList.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-14 text-center text-muted-foreground">
                          <Scale className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm">No se encontraron verificaciones de balanza.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredBalanzaList.map((item) => (
                        <tr key={item.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          {/* Fecha en badge azul */}
                          <td className="py-3.5 px-5">
                            <span className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-xs font-semibold font-mono">
                              {item.fecha}
                            </span>
                          </td>
                          {/* Código resaltado + ubicación */}
                          <td className="py-3.5 px-5">
                            <div className="font-bold text-primary text-sm">{item.codigo_balanza}</div>
                            <div className="text-xs text-muted-foreground">{item.ubicacion}</div>
                          </td>
                          <td className="py-3.5 px-5 text-right font-mono text-xs">{item.capacidad_g}g</td>
                          <td className="py-3.5 px-5 text-right font-mono text-xs font-semibold">{item.masa_patron_g}g</td>
                          <td className="py-3.5 px-5 text-right font-mono text-xs font-bold">{item.lectura_balanza_g}g</td>
                          {/* Error + tolerancia */}
                          <td className="py-3.5 px-5 text-center">
                            <span className={`font-mono text-xs font-bold block ${item.error_g === 0 ? "text-emerald-400" : "text-amber-400"}`}>
                              {item.error_g > 0 ? `+${item.error_g}` : item.error_g}g
                            </span>
                            <span className="text-[10px] text-muted-foreground">Tol: ±{item.error_max_permitido_g}g</span>
                          </td>
                          {/* Estado con badge coloreado */}
                          <td className="py-3.5 px-5 text-center">
                            {item.estado_conforme ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold">
                                <CheckCircle2 className="h-3 w-3" />Conforme
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25 px-2.5 py-1 text-[11px] font-semibold">
                                <XCircle className="h-3 w-3" />No Conforme
                              </span>
                            )}
                          </td>
                          {/* Verificado por */}
                          <td className="py-3.5 px-5 text-xs text-muted-foreground font-mono max-w-[140px] truncate">
                            {item.verificado_por}
                          </td>
                          {/* Acciones: ojo, lápiz, basura */}
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => executeWithSafetyCheck(() => {
                                  setEditingBalanzaId(item.id)
                                  const fechaObj = new Date(item.fecha + "T00:00:00")
                                  setBalanzaForm({
                                    fecha: item.fecha, hora: "08:00",
                                    mes_anio: fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase(),
                                    codigo_balanza: item.codigo_balanza, ubicacion: item.ubicacion,
                                    codigos_pesas_patron: "",
                                    capacidad_g: String(item.capacidad_g), masa_patron_g: String(item.masa_patron_g),
                                    lectura_balanza_g: String(item.lectura_balanza_g),
                                    error_max_permitido_g: String(item.error_max_permitido_g),
                                    limpieza_nivelacion: item.limpieza_nivelacion,
                                    verificado_por: item.verificado_por, revisado_por: "",
                                    observaciones: item.observaciones || "",
                                  })
                                  setBalanzaIsDirty(false); setShowBalanzaModal(true)
                                })}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => executeWithSafetyCheck(() => {
                                  setEditingBalanzaId(item.id)
                                  const fechaObj = new Date(item.fecha + "T00:00:00")
                                  setBalanzaForm({
                                    fecha: item.fecha, hora: "08:00",
                                    mes_anio: fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase(),
                                    codigo_balanza: item.codigo_balanza, ubicacion: item.ubicacion,
                                    codigos_pesas_patron: "",
                                    capacidad_g: String(item.capacidad_g), masa_patron_g: String(item.masa_patron_g),
                                    lectura_balanza_g: String(item.lectura_balanza_g),
                                    error_max_permitido_g: String(item.error_max_permitido_g),
                                    limpieza_nivelacion: item.limpieza_nivelacion,
                                    verificado_por: item.verificado_por, revisado_por: "",
                                    observaciones: item.observaciones || "",
                                  })
                                  setBalanzaIsDirty(false); setShowBalanzaModal(true)
                                })}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400"
                                onClick={() => handleDeleteBalanza(item.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Footer con conteo */}
              {filteredBalanzaList.length > 0 && (
                <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                  <span>Mostrando <span className="font-semibold text-foreground">{filteredBalanzaList.length}</span> de <span className="font-semibold text-foreground">{balanzaList.length}</span> registros</span>
                  <span className="font-mono text-[10px]">F-LEM-IN-01.02 V03</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
