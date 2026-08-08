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
  TrendingUp,
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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
} from "recharts"

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

interface BalanzaStatus {
  codigo_balanza: string
  ubicacion: string
  capacidad_g: number
  ultima_verificacion: string
  error_reciente_g: number
  error_max_permitido_g: number
  conforme: boolean
  verificado_por: string
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
  balanzas_resumen: BalanzaStatus[]
}

const DEFAULT_AREAS = [
  "CÁMARA HÚMEDA",
  "LABORATORIO SUELOS",
  "LABORATORIO CONCRETO",
  "ENSAYOS QUÍMICOS",
]

const DEFAULT_BALANZAS = [
  { codigo: "BAL-01", ubi: "Muestras / Cám. Húmeda", cap: 30000, masa: 5000, tol: 1.0 },
  { codigo: "BAL-02", ubi: "Laboratorio Suelos", cap: 20000, masa: 2000, tol: 0.5 },
  { codigo: "BAL-03", ubi: "Laboratorio Concreto", cap: 5000, masa: 1000, tol: 0.1 },
  { codigo: "BAL-04", ubi: "Química / Finos", cap: 1000, masa: 500, tol: 0.05 },
  { codigo: "BAL-05", ubi: "Analítica General", cap: 300, masa: 100, tol: 0.005 },
  { codigo: "BAL-06", ubi: "Laboratorio Huanta", cap: 15000, masa: 2000, tol: 0.5 },
]

export function ControlAmbientalModule({ user }: ControlAmbientalModuleProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "temperatura" | "balanza">("dashboard")
  const [loading, setLoading] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [temperaturaList, setTemperaturaList] = useState<ControlTemperaturaItem[]>([])
  const [balanzaList, setBalanzaList] = useState<ControlBalanzaItem[]>([])

  // Filters
  const [searchTemp, setSearchTemp] = useState("")
  const [searchBalanza, setSearchBalanza] = useState("")
  const [areaFilter, setAreaFilter] = useState("TODAS")
  const [balanzaFilter, setBalanzaFilter] = useState("TODAS")

  // Modals
  const [showTempModal, setShowTempModal] = useState(false)
  const [editingTempId, setEditingTempId] = useState<number | null>(null)
  const [tempIsDirty, setTempIsDirty] = useState(false)
  const [tempForm, setTempForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    hora_lectura: "08:00",
    area_ambiente: "CÁMARA HÚMEDA",
    temperatura_c: "23.0",
    humedad_relativa_pct: "95.0",
    temp_min: "",
    temp_max: "",
    cumple_especificacion: true,
    responsable_lectura: user.name || "LABORATORIO",
    observaciones: "",
  })

  const [showBalanzaModal, setShowBalanzaModal] = useState(false)
  const [editingBalanzaId, setEditingBalanzaId] = useState<number | null>(null)
  const [balanzaIsDirty, setBalanzaIsDirty] = useState(false)
  const [balanzaForm, setBalanzaForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    codigo_balanza: "BAL-01",
    ubicacion: "LABORATORIO PRINCIPAL",
    capacidad_g: "5000",
    masa_patron_g: "1000",
    lectura_balanza_g: "1000.0",
    error_max_permitido_g: "0.5",
    limpieza_nivelacion: true,
    verificado_por: user.name || "LABORATORIO",
    observaciones: "",
  })

  // Safety Exit confirmation modal
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null)

  // Fetch Data
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

  // Seed Data Handler
  const handleSeedData = async () => {
    setSeeding(true)
    try {
      const res = await authFetch(`${API_URL}/api/control-ambiental/seed`, {
        method: "POST",
      })
      if (res.ok) {
        const payload = await res.json()
        toast.success("Inyección completada", {
          description: payload.message || `Se sembraron ${payload.registros_creados} registros de laboratorio.`,
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

  // Export Excel Handlers
  const handleExportTempExcel = () => {
    window.open(`${API_URL}/api/control-ambiental/temperatura/excel`, "_blank")
    toast.info("Descargando reporte de Temperatura F-LEM-P-05.01...")
  }

  const handleExportBalanzaExcel = () => {
    window.open(`${API_URL}/api/control-ambiental/balanza/excel`, "_blank")
    toast.info("Descargando reporte de Balanzas F-LEM-IN-01.02...")
  }

  // Safety exit helper
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

  // Form Submit Handlers
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

  const handleDeleteTemp = async (id: number) => {
    if (!confirm("¿Está seguro de eliminar esta lectura de temperatura?")) return
    try {
      const res = await authFetch(`${API_URL}/api/control-ambiental/temperatura/${id}`, {
        method: "DELETE",
      })
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
      const res = await authFetch(`${API_URL}/api/control-ambiental/balanza/${id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast.success("Verificación eliminada")
        fetchData()
      }
    } catch {
      toast.error("Error eliminando registro")
    }
  }

  // Filtered lists
  const filteredTempList = useMemo(() => {
    return temperaturaList.filter((item) => {
      const matchesSearch =
        item.area_ambiente.toLowerCase().includes(searchTemp.toLowerCase()) ||
        item.responsable_lectura.toLowerCase().includes(searchTemp.toLowerCase()) ||
        item.fecha.includes(searchTemp)
      const matchesArea = areaFilter === "TODAS" || item.area_ambiente.toUpperCase().includes(areaFilter.toUpperCase())
      return matchesSearch && matchesArea
    })
  }, [temperaturaList, searchTemp, areaFilter])

  const filteredBalanzaList = useMemo(() => {
    return balanzaList.filter((item) => {
      const matchesSearch =
        item.codigo_balanza.toLowerCase().includes(searchBalanza.toLowerCase()) ||
        item.ubicacion.toLowerCase().includes(searchBalanza.toLowerCase()) ||
        item.verificado_por.toLowerCase().includes(searchBalanza.toLowerCase()) ||
        item.fecha.includes(searchBalanza)
      const matchesBalanza = balanzaFilter === "TODAS" || item.codigo_balanza === balanzaFilter
      return matchesSearch && matchesBalanza
    })
  }, [balanzaList, searchBalanza, balanzaFilter])

  // Recharts Chart Data Prepared
  const chartTempData = useMemo(() => {
    const sorted = [...temperaturaList].sort((a, b) => a.fecha.localeCompare(b.fecha))
    const mapByDate: Record<string, { fecha: string; tempCamara: number; humCamara: number; tempSuelos: number; humSuelos: number }> = {}

    sorted.forEach((item) => {
      if (!mapByDate[item.fecha]) {
        mapByDate[item.fecha] = { fecha: item.fecha, tempCamara: 23, humCamara: 95, tempSuelos: 20, humSuelos: 60 }
      }
      if (item.area_ambiente.includes("CÁMARA")) {
        mapByDate[item.fecha].tempCamara = item.temperatura_c
        mapByDate[item.fecha].humCamara = item.humedad_relativa_pct
      } else {
        mapByDate[item.fecha].tempSuelos = item.temperatura_c
        mapByDate[item.fecha].humSuelos = item.humedad_relativa_pct
      }
    })
    return Object.values(mapByDate).slice(-15)
  }, [temperaturaList])

  const chartBalanzaData = useMemo(() => {
    const sorted = [...balanzaList].sort((a, b) => a.fecha.localeCompare(b.fecha))
    return sorted.slice(-15).map((item) => ({
      fecha: item.fecha,
      codigo: item.codigo_balanza,
      error: item.error_g,
      tol: item.error_max_permitido_g,
      tolNeg: -item.error_max_permitido_g,
    }))
  }, [balanzaList])

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto">
      {/* Header & Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Control Ambiental de Laboratorio
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Seguimiento de Temperatura/Humedad (F-LEM-P-05.01) y Verificación de Balanzas (F-LEM-IN-01.02)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="h-9 gap-2 border-border shadow-xs hover:bg-secondary"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedData}
            disabled={seeding}
            className="h-9 gap-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/30 text-blue-400 hover:text-blue-300"
          >
            <Database className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
            Sembrar Datos Reales
          </Button>

          <Select onValueChange={(val) => {
            if (val === "temp") handleExportTempExcel()
            if (val === "balanza") handleExportBalanzaExcel()
          }}>
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
            onClick={() => {
              executeWithSafetyCheck(() => {
                setEditingTempId(null)
                setTempForm({
                  fecha: new Date().toISOString().split("T")[0],
                  hora_lectura: "08:00",
                  area_ambiente: "CÁMARA HÚMEDA",
                  temperatura_c: "23.0",
                  humedad_relativa_pct: "95.0",
                  temp_min: "21.5",
                  temp_max: "24.0",
                  cumple_especificacion: true,
                  responsable_lectura: user.name || "LABORATORIO",
                  observaciones: "",
                })
                setTempIsDirty(false)
                setShowTempModal(true)
              })
            }}
            className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/20"
          >
            <Plus className="h-4 w-4" />
            + Nueva Lectura Temp.
          </Button>

          <Button
            size="sm"
            onClick={() => {
              executeWithSafetyCheck(() => {
                setEditingBalanzaId(null)
                setBalanzaForm({
                  fecha: new Date().toISOString().split("T")[0],
                  codigo_balanza: "BAL-01",
                  ubicacion: "LABORATORIO PRINCIPAL",
                  capacidad_g: "30000",
                  masa_patron_g: "5000",
                  lectura_balanza_g: "5000.0",
                  error_max_permitido_g: "1.0",
                  limpieza_nivelacion: true,
                  verificado_por: user.name || "LABORATORIO",
                  observaciones: "",
                })
                setBalanzaIsDirty(false)
                setShowBalanzaModal(true)
              })
            }}
            className="h-9 gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
          >
            <Plus className="h-4 w-4" />
            + Verificación Balanza
          </Button>
        </div>
      </div>

      {/* Top Executive Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/70 border-border/80 shadow-xs backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Temp. Promedio Laboratorio
            </CardTitle>
            <Thermometer className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {dashboardData ? `${dashboardData.promedio_temperatura_c}°C` : "21.5°C"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">Norma NTP 339</span> — Rango 20°C - 23°C
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Humedad Relativa Promedio
            </CardTitle>

            <Activity className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {dashboardData ? `${dashboardData.promedio_humedad_pct}%` : "75.0%"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-blue-400 font-medium">Cám. Húmeda ≥ 95%</span> | Lab 50-70%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Balanzas Verificadas Hoy
            </CardTitle>
            <Scale className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {dashboardData ? `${dashboardData.balanzas_verificadas_hoy} / ${dashboardData.total_balanzas_registradas}` : "6 / 6"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-emerald-400 font-medium">100% calibración diaria</span> conforme
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/80 shadow-xs backdrop-blur-xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tasa de Conformidad Global
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground flex items-center justify-between">
              <span>{dashboardData ? `${dashboardData.tasa_cumplimiento_temp_pct}%` : "98.5%"}</span>
              <Badge variant={dashboardData && dashboardData.alertas_activas > 0 ? "destructive" : "default"}>
                {dashboardData?.alertas_activas || 0} Alertas
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {dashboardData?.alertas_activas === 0 ? "Sin desviaciones registradas" : "Atención requerida en parámetros"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Component */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          executeWithSafetyCheck(() => setActiveTab(value as any))
        }}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-3 max-w-md bg-muted/60 p-1">
          <TabsTrigger value="dashboard" className="gap-2 font-medium">
            <TrendingUp className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="temperatura" className="gap-2 font-medium">
            <Thermometer className="h-4 w-4" />
            Temperatura
          </TabsTrigger>
          <TabsTrigger value="balanza" className="gap-2 font-medium">
            <Scale className="h-4 w-4" />
            Balanzas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: EXECUTIVE DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Areas Status Cards Grid */}
          <div>
            <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              Estado Actual por Área de Ambientes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {(dashboardData?.areas_resumen || []).map((area) => (
                <Card key={area.area} className="border-border/60 hover:border-border transition-all">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-bold truncate">{area.area}</CardTitle>
                      <Badge variant={area.conforme ? "default" : "destructive"}>
                        {area.conforme ? "CONFORME" : "ALERTA"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs truncate">{area.norma}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Temp. Lectura:</span>
                      <span className="font-semibold text-sm">{area.temperatura_actual}°C</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-border/40">
                      <span className="text-muted-foreground">Humedad Lectura:</span>
                      <span className="font-semibold text-sm text-blue-400">{area.humedad_actual}%</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-1">
                      <span>Rango Temp: {area.rango_temperatura}</span>
                      <span>{area.rango_humedad}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recharts Analytics Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Tendencia de Temperatura (°C) — Últimos Días</span>
                  <Badge variant="outline" className="text-xs">F-LEM-P-05.01</Badge>
                </CardTitle>
                <CardDescription>Comportamiento térmico en Cámara Húmeda vs Laboratorio Suelos</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartTempData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis domain={[15, 28]} tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Legend />
                    <ReferenceLine y={23} stroke="#10b981" strokeDasharray="3 3" label="Target Cám. (23°C)" />
                    <ReferenceLine y={20} stroke="#3b82f6" strokeDasharray="3 3" label="Target Lab (20°C)" />
                    <Line type="monotone" dataKey="tempCamara" name="Cámara Húmeda (°C)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="tempSuelos" name="Lab Suelos (°C)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center justify-between">
                  <span>Desviación de Balanzas — Error Obtenido (g)</span>
                  <Badge variant="outline" className="text-xs">F-LEM-IN-01.02</Badge>
                </CardTitle>
                <CardDescription>Monitoreo de tolerancia y precisión diaria por balanza</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartBalanzaData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="codigo" tick={{ fontSize: 11 }} />
                    <YAxis domain={[-1.2, 1.2]} tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Legend />
                    <ReferenceLine y={0} stroke="#888888" />
                    <Bar dataKey="error" name="Error (g)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tol" name="Tolerancia Max (g)" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.4} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: TEMPERATURA Y HUMEDAD RELATIVA */}
        <TabsContent value="temperatura" className="space-y-4">
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Thermometer className="h-5 w-5 text-emerald-400" />
                    Control de Temperatura y Humedad Relativa Diario
                  </CardTitle>
                  <CardDescription>Formato LEM: F-LEM-P-05.01 V03</CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar área, fecha, usuario..."
                      value={searchTemp}
                      onChange={(e) => setSearchTemp(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>

                  <Select value={areaFilter} onValueChange={setAreaFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Filtrar por Área" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Todas las áreas</SelectItem>
                      {DEFAULT_AREAS.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border border-border/60 overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b border-border/60">
                    <tr>
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">Área / Ambiente</th>
                      <th className="py-3 px-4 text-center">Temp (°C)</th>
                      <th className="py-3 px-4 text-center">Humedad (%)</th>
                      <th className="py-3 px-4 text-center">Min / Max</th>
                      <th className="py-3 px-4 text-center">Estado Spec</th>
                      <th className="py-3 px-4">Responsable</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredTempList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-muted-foreground">
                          No se encontraron registros de temperatura.
                        </td>
                      </tr>
                    ) : (
                      filteredTempList.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs">
                            <div className="font-semibold text-foreground">{item.fecha}</div>
                            <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {item.hora_lectura}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium">{item.area_ambiente}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-400">
                            {item.temperatura_c.toFixed(1)}°C
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-blue-400">
                            {item.humedad_relativa_pct.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                            {item.temp_min ? `${item.temp_min}°C` : "-"} / {item.temp_max ? `${item.temp_max}°C` : "-"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={item.cumple_especificacion ? "default" : "destructive"}>
                              {item.cumple_especificacion ? "CUMPLE" : "NO CUMPLE"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono">{item.responsable_lectura}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  executeWithSafetyCheck(() => {
                                    setEditingTempId(item.id)
                                    setTempForm({
                                      fecha: item.fecha,
                                      hora_lectura: item.hora_lectura,
                                      area_ambiente: item.area_ambiente,
                                      temperatura_c: String(item.temperatura_c),
                                      humedad_relativa_pct: String(item.humedad_relativa_pct),
                                      temp_min: item.temp_min ? String(item.temp_min) : "",
                                      temp_max: item.temp_max ? String(item.temp_max) : "",
                                      cumple_especificacion: item.cumple_especificacion,
                                      responsable_lectura: item.responsable_lectura,
                                      observaciones: item.observaciones || "",
                                    })
                                    setTempIsDirty(false)
                                    setShowTempModal(true)
                                  })
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteTemp(item.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-red-400"
                              >
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CONTROL DE BALANZAS */}
        <TabsContent value="balanza" className="space-y-4">
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Scale className="h-5 w-5 text-amber-400" />
                    Formato de Verificación Diaria de Balanzas
                  </CardTitle>
                  <CardDescription>Formato LEM: F-LEM-IN-01.02 V03</CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar balanza, ubicación..."
                      value={searchBalanza}
                      onChange={(e) => setSearchBalanza(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>

                  <Select value={balanzaFilter} onValueChange={setBalanzaFilter}>
                    <SelectTrigger className="w-[180px] h-9">
                      <SelectValue placeholder="Filtrar por Balanza" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Todas las balanzas</SelectItem>
                      {DEFAULT_BALANZAS.map((b) => (
                        <SelectItem key={b.codigo} value={b.codigo}>{b.codigo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border border-border/60 overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase border-b border-border/60">
                    <tr>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Código / Ubicación</th>
                      <th className="py-3 px-4 text-right">Capacidad</th>
                      <th className="py-3 px-4 text-right">Masa Patrón</th>
                      <th className="py-3 px-4 text-right">Lectura</th>
                      <th className="py-3 px-4 text-center">Error / Tol.</th>
                      <th className="py-3 px-4 text-center">Nivel / Limpieza</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4">Verificado Por</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredBalanzaList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-muted-foreground">
                          No se encontraron verificaciones de balanza.
                        </td>
                      </tr>
                    ) : (
                      filteredBalanzaList.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-semibold">{item.fecha}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-foreground">{item.codigo_balanza}</div>
                            <div className="text-xs text-muted-foreground">{item.ubicacion}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs">{item.capacidad_g}g</td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-medium">{item.masa_patron_g}g</td>
                          <td className="py-3 px-4 text-right font-mono text-xs font-bold text-foreground">
                            {item.lectura_balanza_g}g
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-xs">
                            <span className={item.error_g === 0 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                              {item.error_g > 0 ? `+${item.error_g}` : item.error_g}g
                            </span>
                            <span className="text-muted-foreground text-[11px] block">
                              Tol: ±{item.error_max_permitido_g}g
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={item.limpieza_nivelacion ? "outline" : "destructive"}>
                              {item.limpieza_nivelacion ? "OK" : "NO"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={item.estado_conforme ? "default" : "destructive"}>
                              {item.estado_conforme ? "CONFORME" : "NO CONFORME"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono">{item.verificado_por}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  executeWithSafetyCheck(() => {
                                    setEditingBalanzaId(item.id)
                                    setBalanzaForm({
                                      fecha: item.fecha,
                                      codigo_balanza: item.codigo_balanza,
                                      ubicacion: item.ubicacion,
                                      capacidad_g: String(item.capacidad_g),
                                      masa_patron_g: String(item.masa_patron_g),
                                      lectura_balanza_g: String(item.lectura_balanza_g),
                                      error_max_permitido_g: String(item.error_max_permitido_g),
                                      limpieza_nivelacion: item.limpieza_nivelacion,
                                      verificado_por: item.verificado_por,
                                      observaciones: item.observaciones || "",
                                    })
                                    setBalanzaIsDirty(false)
                                    setShowBalanzaModal(true)
                                  })
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteBalanza(item.id)}
                                className="h-8 w-8 text-muted-foreground hover:text-red-400"
                              >
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG 1: FORMULARIO TEMPERATURA Y HUMEDAD */}
      <Dialog
        open={showTempModal}
        onOpenChange={(open) => {
          if (!open) {
            executeWithSafetyCheck(() => setShowTempModal(false))
          } else {
            setShowTempModal(true)
          }
        }}
      >
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-emerald-400" />
              {editingTempId ? "Editar Lectura de Temperatura" : "Nueva Lectura de Temperatura (F-LEM-P-05.01)"}
            </DialogTitle>
            <DialogDescription>
              Ingrese las variables térmicas y de humedad del laboratorio.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveTemp} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Fecha</label>
                <Input
                  type="date"
                  value={tempForm.fecha}
                  onChange={(e) => {
                    setTempForm((prev) => ({ ...prev, fecha: e.target.value }))
                    setTempIsDirty(true)
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Hora de Lectura</label>
                <Input
                  type="time"
                  value={tempForm.hora_lectura}
                  onChange={(e) => {
                    setTempForm((prev) => ({ ...prev, hora_lectura: e.target.value }))
                    setTempIsDirty(true)
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Área / Ambiente de Laboratorio</label>
              <Select
                value={tempForm.area_ambiente}
                onValueChange={(val) => {
                  setTempForm((prev) => ({ ...prev, area_ambiente: val }))
                  setTempIsDirty(true)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione área" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_AREAS.map((area) => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Temperatura °C</label>
                <Input
                  type="number"
                  step="0.1"
                  value={tempForm.temperatura_c}
                  onChange={(e) => {
                    setTempForm((prev) => ({ ...prev, temperatura_c: e.target.value }))
                    setTempIsDirty(true)
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Humedad Relativa %</label>
                <Input
                  type="number"
                  step="0.1"
                  value={tempForm.humedad_relativa_pct}
                  onChange={(e) => {
                    setTempForm((prev) => ({ ...prev, humedad_relativa_pct: e.target.value }))
                    setTempIsDirty(true)
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Temp. Mínima °C (Opcional)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={tempForm.temp_min}
                  onChange={(e) => {
                    setTempForm((prev) => ({ ...prev, temp_min: e.target.value }))
                    setTempIsDirty(true)
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Temp. Máxima °C (Opcional)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={tempForm.temp_max}
                  onChange={(e) => {
                    setTempForm((prev) => ({ ...prev, temp_max: e.target.value }))
                    setTempIsDirty(true)
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Responsable de Lectura</label>
              <Input
                value={tempForm.responsable_lectura}
                onChange={(e) => {
                  setTempForm((prev) => ({ ...prev, responsable_lectura: e.target.value }))
                  setTempIsDirty(true)
                }}
                required
              />
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowTempModal(false))}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                Guardar Lectura
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: FORMULARIO VERIFICACIÓN DE BALANZA */}
      <Dialog
        open={showBalanzaModal}
        onOpenChange={(open) => {
          if (!open) {
            executeWithSafetyCheck(() => setShowBalanzaModal(false))
          } else {
            setShowBalanzaModal(true)
          }
        }}
      >
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-400" />
              {editingBalanzaId ? "Editar Verificación de Balanza" : "Nueva Verificación Diaria de Balanza (F-LEM-IN-01.02)"}
            </DialogTitle>
            <DialogDescription>
              Control de tolerancia y verificación de patrón de balanza.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBalanza} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Fecha</label>
                <Input
                  type="date"
                  value={balanzaForm.fecha}
                  onChange={(e) => {
                    setBalanzaForm((prev) => ({ ...prev, fecha: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Código Balanza</label>
                <Select
                  value={balanzaForm.codigo_balanza}
                  onValueChange={(val) => {
                    const preset = DEFAULT_BALANZAS.find((b) => b.codigo === val)
                    setBalanzaForm((prev) => ({
                      ...prev,
                      codigo_balanza: val,
                      ubicacion: preset?.ubi || prev.ubicacion,
                      capacidad_g: String(preset?.cap || prev.capacidad_g),
                      masa_patron_g: String(preset?.masa || prev.masa_patron_g),
                      lectura_balanza_g: String(preset?.masa || prev.masa_patron_g),
                      error_max_permitido_g: String(preset?.tol || prev.error_max_permitido_g),
                    }))
                    setBalanzaIsDirty(true)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione código" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_BALANZAS.map((b) => (
                      <SelectItem key={b.codigo} value={b.codigo}>
                        {b.codigo} — {b.ubi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ubicación Física</label>
              <Input
                value={balanzaForm.ubicacion}
                onChange={(e) => {
                  setBalanzaForm((prev) => ({ ...prev, ubicacion: e.target.value }))
                  setBalanzaIsDirty(true)
                }}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Capacidad (g)</label>
                <Input
                  type="number"
                  value={balanzaForm.capacidad_g}
                  onChange={(e) => {
                    setBalanzaForm((prev) => ({ ...prev, capacidad_g: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Masa Patrón (g)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={balanzaForm.masa_patron_g}
                  onChange={(e) => {
                    setBalanzaForm((prev) => ({ ...prev, masa_patron_g: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Lectura (g)</label>
                <Input
                  type="number"
                  step="0.001"
                  value={balanzaForm.lectura_balanza_g}
                  onChange={(e) => {
                    setBalanzaForm((prev) => ({ ...prev, lectura_balanza_g: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Error Máx. Permitido ±g</label>
                <Input
                  type="number"
                  step="0.001"
                  value={balanzaForm.error_max_permitido_g}
                  onChange={(e) => {
                    setBalanzaForm((prev) => ({ ...prev, error_max_permitido_g: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Verificado Por</label>
                <Input
                  value={balanzaForm.verificado_por}
                  onChange={(e) => {
                    setBalanzaForm((prev) => ({ ...prev, verificado_por: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowBalanzaModal(false))}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                Guardar Verificación
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODERN SAFETY CONFIRMATION DIALOG (SALIR SIN GUARDAR) */}
      <ModernConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={confirmExitWithoutSaving}
        title="¿Desea salir sin guardar los cambios?"
        description="Ha modificado datos en el formulario de control ambiental. Si sale ahora, se perderán las lecturas o verificaciones ingresadas."
        confirmText="Salir sin guardar"
        cancelText="Continuar editando"
        variant="destructive"
      />
    </div>
  )
}
