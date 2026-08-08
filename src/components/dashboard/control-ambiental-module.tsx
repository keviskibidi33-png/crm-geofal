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
  FileText,
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

interface TempRow {
  id?: number
  fecha_registro: string
  hora_toma: string
  fecha_lectura: string
  temp_min: string
  temp_max: string
  hum_min: string
  hum_max: string
  temperatura_c: string
  humedad_relativa_pct: string
  cumple: boolean
  responsable_registro: string
  responsable_revision: string
}

interface BalanzaRow {
  id?: number
  fecha: string
  hora: string
  temp_c: string
  humedad_pct: string
  masa_patron_g: string
  lectura_balanza_g: string
  verificado_por: string
  revisado_por: string
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

  // ── Safety exit ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null)

  // ── Modals & Document State ──
  const [showTempModal, setShowTempModal] = useState(false)
  const [tempIsDirty, setTempIsDirty] = useState(false)
  const [tempDocHeader, setTempDocHeader] = useState({
    registro: "REG-01",
    mes_anio: getMesAnio(),
    aprobado_por: "JEFE DE LABORATORIO",
    fecha_aprobacion: "2024-01-02",
    area_ambiente: "Area de Recepción de muestras",
  })
  const [tempDocRows, setTempDocRows] = useState<TempRow[]>([
    {
      fecha_registro: new Date().toISOString().split("T")[0],
      hora_toma: "08:00",
      fecha_lectura: new Date().toISOString().split("T")[0],
      temp_min: "10.0",
      temp_max: "30.0",
      hum_min: "20.0",
      hum_max: "80.0",
      temperatura_c: "23.0",
      humedad_relativa_pct: "50.0",
      cumple: true,
      responsable_registro: user.name || "LABORATORIO",
      responsable_revision: "",
    },
  ])

  const [showBalanzaModal, setShowBalanzaModal] = useState(false)
  const [balanzaIsDirty, setBalanzaIsDirty] = useState(false)
  const [balanzaDocHeader, setBalanzaDocHeader] = useState({
    codigo_balanza: "BAL-01",
    mes_anio: getMesAnio(),
    ubicacion: "Muestras / Cám. Húmeda",
    codigos_pesas_patron: "PP-01, PP-02, PP-05",
    capacidad_g: "30000",
    masa_patron_g: "5000",
    error_max_permitido_g: "1.0",
    limpieza_nivelacion: true,
  })
  const [balanzaDocRows, setBalanzaDocRows] = useState<BalanzaRow[]>([
    {
      fecha: new Date().toISOString().split("T")[0],
      hora: "08:00",
      temp_c: "23.0",
      humedad_pct: "50.0",
      masa_patron_g: "5000",
      lectura_balanza_g: "5000.0",
      verificado_por: user.name || "LABORATORIO",
      revisado_por: "",
    },
  ])

  // ── Fetch ──
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [resTemp, resBal] = await Promise.all([
        authFetch(`${API_URL}/api/control-ambiental/temperatura?limit=500`),
        authFetch(`${API_URL}/api/control-ambiental/balanza?limit=500`),
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

  // ── Document Groupings for History List (Imagen 2 format) ──
  const tempDocGroups = useMemo(() => {
    const map = new Map<string, {
      key: string
      area_ambiente: string
      mes_anio: string
      items: ControlTemperaturaItem[]
    }>()

    temperaturaList.forEach((item) => {
      const fechaObj = new Date(item.fecha + "T00:00:00")
      const mes_anio = item.fecha
        ? fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase()
        : "AGOSTO 2026"
      const key = `${item.area_ambiente}__${mes_anio}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          area_ambiente: item.area_ambiente,
          mes_anio,
          items: [],
        })
      }
      map.get(key)!.items.push(item)
    })

    return Array.from(map.values())
  }, [temperaturaList])

  const balanzaDocGroups = useMemo(() => {
    const map = new Map<string, {
      key: string
      codigo_balanza: string
      mes_anio: string
      ubicacion: string
      items: ControlBalanzaItem[]
    }>()

    balanzaList.forEach((item) => {
      const fechaObj = new Date(item.fecha + "T00:00:00")
      const mes_anio = item.fecha
        ? fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase()
        : "AGOSTO 2026"
      const key = `${item.codigo_balanza}__${mes_anio}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          codigo_balanza: item.codigo_balanza,
          mes_anio,
          ubicacion: item.ubicacion,
          items: [],
        })
      }
      map.get(key)!.items.push(item)
    })

    return Array.from(map.values())
  }, [balanzaList])

  // ── Filtered Document Lists ──
  const filteredTempDocs = useMemo(() => {
    return tempDocGroups.filter((doc) => {
      const q = searchTemp.toLowerCase()
      const matchSearch = doc.area_ambiente.toLowerCase().includes(q) || doc.mes_anio.toLowerCase().includes(q)
      const matchArea = areaFilter === "TODAS" || doc.area_ambiente.toUpperCase().includes(areaFilter.toUpperCase())
      return matchSearch && matchArea
    })
  }, [tempDocGroups, searchTemp, areaFilter])

  const filteredBalanzaDocs = useMemo(() => {
    return balanzaDocGroups.filter((doc) => {
      const q = searchBalanza.toLowerCase()
      const matchSearch =
        doc.codigo_balanza.toLowerCase().includes(q) ||
        doc.ubicacion.toLowerCase().includes(q) ||
        doc.mes_anio.toLowerCase().includes(q)
      const matchBalanza = balanzaFilter === "TODAS" || doc.codigo_balanza === balanzaFilter
      return matchSearch && matchBalanza
    })
  }, [balanzaDocGroups, searchBalanza, balanzaFilter])

  // ── Paginated Data ──
  const tempTotalPages = Math.ceil(filteredTempDocs.length / tempRowsPerPage) || 1
  const paginatedTempDocs = useMemo(() => {
    const start = (tempPage - 1) * tempRowsPerPage
    return filteredTempDocs.slice(start, start + tempRowsPerPage)
  }, [filteredTempDocs, tempPage, tempRowsPerPage])

  const balanzaTotalPages = Math.ceil(filteredBalanzaDocs.length / balanzaRowsPerPage) || 1
  const paginatedBalanzaDocs = useMemo(() => {
    const start = (balanzaPage - 1) * balanzaRowsPerPage
    return filteredBalanzaDocs.slice(start, start + balanzaRowsPerPage)
  }, [filteredBalanzaDocs, balanzaPage, balanzaRowsPerPage])

  // ── Open Form for New Document ──
  const openNewTempDoc = () => {
    executeWithSafetyCheck(() => {
      setTempDocHeader({
        registro: "REG-01",
        mes_anio: getMesAnio(),
        aprobado_por: "JEFE DE LABORATORIO",
        fecha_aprobacion: "2024-01-02",
        area_ambiente: "Area de Recepción de muestras",
      })
      setTempDocRows([
        {
          fecha_registro: new Date().toISOString().split("T")[0],
          hora_toma: "08:00",
          fecha_lectura: new Date().toISOString().split("T")[0],
          temp_min: "10.0",
          temp_max: "30.0",
          hum_min: "20.0",
          hum_max: "80.0",
          temperatura_c: "23.0",
          humedad_relativa_pct: "50.0",
          cumple: true,
          responsable_registro: user.name || "LABORATORIO",
          responsable_revision: "",
        },
      ])
      setTempIsDirty(false)
      setShowTempModal(true)
    })
  }

  const openNewBalanzaDoc = () => {
    executeWithSafetyCheck(() => {
      setBalanzaDocHeader({
        codigo_balanza: "BAL-01",
        mes_anio: getMesAnio(),
        ubicacion: "Muestras / Cám. Húmeda",
        codigos_pesas_patron: "PP-01, PP-02, PP-05",
        capacidad_g: "30000",
        masa_patron_g: "5000",
        error_max_permitido_g: "1.0",
        limpieza_nivelacion: true,
      })
      setBalanzaDocRows([
        {
          fecha: new Date().toISOString().split("T")[0],
          hora: "08:00",
          temp_c: "23.0",
          humedad_pct: "50.0",
          masa_patron_g: "5000",
          lectura_balanza_g: "5000.0",
          verificado_por: user.name || "LABORATORIO",
          revisado_por: "",
        },
      ])
      setBalanzaIsDirty(false)
      setShowBalanzaModal(true)
    })
  }

  // ── Open Form for Existing Document (Edit Sheet) ──
  const openEditTempDoc = (items: ControlTemperaturaItem[]) => {
    executeWithSafetyCheck(() => {
      if (items.length > 0) {
        const first = items[0]
        const fechaObj = new Date(first.fecha + "T00:00:00")
        setTempDocHeader({
          registro: "REG-01",
          mes_anio: fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase(),
          aprobado_por: "JEFE DE LABORATORIO",
          fecha_aprobacion: "2024-01-02",
          area_ambiente: first.area_ambiente,
        })
        setTempDocRows(
          items.map((it) => ({
            id: it.id,
            fecha_registro: it.fecha,
            hora_toma: it.hora_lectura,
            fecha_lectura: it.fecha,
            temp_min: String(it.temp_min ?? "10.0"),
            temp_max: String(it.temp_max ?? "30.0"),
            hum_min: "20.0",
            hum_max: "80.0",
            temperatura_c: String(it.temperatura_c),
            humedad_relativa_pct: String(it.humedad_relativa_pct),
            cumple: it.cumple_especificacion,
            responsable_registro: it.responsable_lectura,
            responsable_revision: "",
          }))
        )
      }
      setTempIsDirty(false)
      setShowTempModal(true)
    })
  }

  const openEditBalanzaDoc = (items: ControlBalanzaItem[]) => {
    executeWithSafetyCheck(() => {
      if (items.length > 0) {
        const first = items[0]
        const fechaObj = new Date(first.fecha + "T00:00:00")
        setBalanzaDocHeader({
          codigo_balanza: first.codigo_balanza,
          mes_anio: fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase(),
          ubicacion: first.ubicacion,
          codigos_pesas_patron: "PP-01, PP-02, PP-05",
          capacidad_g: String(first.capacidad_g),
          masa_patron_g: String(first.masa_patron_g),
          error_max_permitido_g: String(first.error_max_permitido_g),
          limpieza_nivelacion: first.limpieza_nivelacion,
        })
        setBalanzaDocRows(
          items.map((it) => ({
            id: it.id,
            fecha: it.fecha,
            hora: "08:00",
            temp_c: "23.0",
            humedad_pct: "50.0",
            masa_patron_g: String(it.masa_patron_g),
            lectura_balanza_g: String(it.lectura_balanza_g),
            verificado_por: it.verificado_por,
            revisado_por: "",
          }))
        )
      }
      setBalanzaIsDirty(false)
      setShowBalanzaModal(true)
    })
  }

  // ── Delete Document Group ──
  const handleDeleteTempGroup = async (items: ControlTemperaturaItem[]) => {
    if (!confirm(`¿Está seguro de eliminar el formato con ${items.length} lecturas?`)) return
    try {
      await Promise.all(
        items.map((it) => authFetch(`${API_URL}/api/control-ambiental/temperatura/${it.id}`, { method: "DELETE" }))
      )
      toast.success("Formato eliminado")
      fetchData()
    } catch {
      toast.error("Error eliminando formato")
    }
  }

  const handleDeleteBalanzaGroup = async (items: ControlBalanzaItem[]) => {
    if (!confirm(`¿Está seguro de eliminar el formato con ${items.length} verificaciones?`)) return
    try {
      await Promise.all(
        items.map((it) => authFetch(`${API_URL}/api/control-ambiental/balanza/${it.id}`, { method: "DELETE" }))
      )
      toast.success("Formato eliminado")
      fetchData()
    } catch {
      toast.error("Error eliminando formato")
    }
  }

  // ── Save Document Sheets ──
  const handleSaveTempDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const promises = tempDocRows.map((row) => {
        const payload = {
          fecha: row.fecha_registro,
          hora_lectura: row.hora_toma,
          area_ambiente: tempDocHeader.area_ambiente,
          temperatura_c: parseFloat(row.temperatura_c) || 0.0,
          humedad_relativa_pct: parseFloat(row.humedad_relativa_pct) || 0.0,
          temp_min: parseFloat(row.temp_min) || 10.0,
          temp_max: parseFloat(row.temp_max) || 30.0,
          cumple_especificacion: row.cumple,
          responsable_lectura: row.responsable_registro,
          observaciones: "",
        }
        const url = row.id
          ? `${API_URL}/api/control-ambiental/temperatura/${row.id}`
          : `${API_URL}/api/control-ambiental/temperatura`
        const method = row.id ? "PUT" : "POST"
        return authFetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      })

      await Promise.all(promises)
      toast.success("Formato F-LEM-P-05.01 guardado con éxito")
      setTempIsDirty(false)
      setShowTempModal(false)
      fetchData()
    } catch {
      toast.error("Error al guardar formato de temperatura")
    }
  }

  const handleSaveBalanzaDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const promises = balanzaDocRows.map((row) => {
        const payload = {
          fecha: row.fecha,
          codigo_balanza: balanzaDocHeader.codigo_balanza,
          ubicacion: balanzaDocHeader.ubicacion,
          capacidad_g: parseFloat(balanzaDocHeader.capacidad_g) || 0.0,
          masa_patron_g: parseFloat(row.masa_patron_g) || 0.0,
          lectura_balanza_g: parseFloat(row.lectura_balanza_g) || 0.0,
          error_max_permitido_g: parseFloat(balanzaDocHeader.error_max_permitido_g) || 0.5,
          limpieza_nivelacion: balanzaDocHeader.limpieza_nivelacion,
          verificado_por: row.verificado_por,
          observaciones: "",
        }
        const url = row.id
          ? `${API_URL}/api/control-ambiental/balanza/${row.id}`
          : `${API_URL}/api/control-ambiental/balanza`
        const method = row.id ? "PUT" : "POST"
        return authFetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      })

      await Promise.all(promises)
      toast.success("Formato F-LEM-IN-01.02 guardado con éxito")
      setBalanzaIsDirty(false)
      setShowBalanzaModal(false)
      fetchData()
    } catch {
      toast.error("Error al guardar formato de balanzas")
    }
  }

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
                placeholder="Buscar por área o mes..."
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
              onClick={openNewTempDoc}
              className="gap-2 h-9 bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Nuevo Formato
            </Button>
          </div>
        </div>

        {/* Card Historial estilo Imagen 2 */}
        <div className="border rounded-xl shadow-xs bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-slate-50/70 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Historial Formatos Control de Temperatura
              </h3>
              <p className="text-xs text-muted-foreground">
                Registros guardados con acceso a detalle y edición de la hoja completa.
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
                <TableHead className="font-semibold text-slate-700">Formato / Código</TableHead>
                <TableHead className="font-semibold text-slate-700">Área de Control</TableHead>
                <TableHead className="font-semibold text-slate-700">Mes / Año</TableHead>
                <TableHead className="text-center font-semibold text-slate-700">Lecturas en Hoja</TableHead>
                <TableHead className="text-center font-semibold text-slate-700">Estado</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 pr-6">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
                    Cargando formatos...
                  </TableCell>
                </TableRow>
              )}
              {!loading && filteredTempDocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Sin resultados.
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                paginatedTempDocs.map((doc) => (
                  <TableRow key={doc.key} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-medium">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-sky-600" />
                        F-LEM-P-05.01-2026
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-800">{doc.area_ambiente}</TableCell>
                    <TableCell className="font-mono text-slate-700 font-medium">{doc.mes_anio}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-sky-700">
                      {doc.items.length} filas diarias
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                        COMPLETO
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          onClick={() => openEditTempDoc(doc.items)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          onClick={() => openEditTempDoc(doc.items)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteTempGroup(doc.items)}
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
          {!loading && filteredTempDocs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between border-t px-5 py-3 text-xs gap-3">
              <span className="text-muted-foreground">
                Mostrando {(tempPage - 1) * tempRowsPerPage + 1} a{" "}
                {Math.min(tempPage * tempRowsPerPage, filteredTempDocs.length)} de{" "}
                {filteredTempDocs.length} formatos
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

        {/* Modal Form F-LEM-P-05.01 Sheet Completo */}
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
            onClick={openNewBalanzaDoc}
            className="gap-2 h-9 bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nuevo Formato
          </Button>
        </div>
      </div>

      {/* Card Historial estilo Imagen 2 */}
      <div className="border rounded-xl shadow-xs bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Historial Formatos Verificación de Balanzas
            </h3>
            <p className="text-xs text-muted-foreground">
              Registros guardados con acceso a detalle y edición de la hoja completa.
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
              <TableHead className="font-semibold text-slate-700">Formato / Código Balanza</TableHead>
              <TableHead className="font-semibold text-slate-700">Ubicación</TableHead>
              <TableHead className="font-semibold text-slate-700">Mes / Año</TableHead>
              <TableHead className="text-center font-semibold text-slate-700">Verificaciones en Hoja</TableHead>
              <TableHead className="text-center font-semibold text-slate-700">Estado</TableHead>
              <TableHead className="text-right font-semibold text-slate-700 pr-6">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-1" />
                  Cargando formatos...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredBalanzaDocs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              paginatedBalanzaDocs.map((doc) => (
                <TableRow key={doc.key} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-bold text-sky-600 text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-600" />
                    {doc.codigo_balanza}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800">{doc.ubicacion}</TableCell>
                  <TableCell className="font-mono text-slate-700 font-medium">{doc.mes_anio}</TableCell>
                  <TableCell className="text-center font-mono font-bold text-sky-700">
                    {doc.items.length} verificaciones
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                      COMPLETO
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => openEditBalanzaDoc(doc.items)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                        onClick={() => openEditBalanzaDoc(doc.items)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteBalanzaGroup(doc.items)}
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
        {!loading && filteredBalanzaDocs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t px-5 py-3 text-xs gap-3">
            <span className="text-muted-foreground">
              Mostrando {(balanzaPage - 1) * balanzaRowsPerPage + 1} a{" "}
              {Math.min(balanzaPage * balanzaRowsPerPage, filteredBalanzaDocs.length)} de{" "}
              {filteredBalanzaDocs.length} formatos
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

      {/* Modal Form F-LEM-IN-01.02 Sheet Completo */}
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
  // (FORMATO COMPLETO MULTIFILA / MULTIPLE LECTURAS EN EL MISMO DOCUMENTO)
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
        <DialogContent className="max-w-[95vw] sm:max-w-[1100px] max-h-[92vh] overflow-y-auto p-6 bg-white">
          <form onSubmit={handleSaveTempDoc} className="space-y-4">
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
                  value={tempDocHeader.registro}
                  onChange={(e) => {
                    setTempDocHeader((p) => ({ ...p, registro: e.target.value }))
                    setTempIsDirty(true)
                  }}
                  className="h-7 text-xs font-mono text-center bg-white"
                />
              </div>
              <div className="border border-slate-400 rounded-md p-2 bg-slate-50/50 space-y-1">
                <label className="text-[10px] font-bold text-slate-900 uppercase block text-center">
                  MES-AÑO
                </label>
                <Input
                  value={tempDocHeader.mes_anio}
                  onChange={(e) => {
                    setTempDocHeader((p) => ({ ...p, mes_anio: e.target.value }))
                    setTempIsDirty(true)
                  }}
                  className="h-7 text-xs font-mono text-center uppercase bg-white"
                  placeholder="AGOSTO 2026"
                />
              </div>
              <div className="border border-slate-400 rounded-md p-2 bg-slate-50/50 space-y-1">
                <label className="text-[10px] font-bold text-slate-900 uppercase block text-center">
                  APROBADO POR
                </label>
                <Input
                  value={tempDocHeader.aprobado_por}
                  onChange={(e) => {
                    setTempDocHeader((p) => ({ ...p, aprobado_por: e.target.value }))
                    setTempIsDirty(true)
                  }}
                  className="h-7 text-xs text-center uppercase bg-white"
                />
              </div>
              <div className="border border-slate-400 rounded-md p-2 bg-slate-50/50 space-y-1">
                <label className="text-[10px] font-bold text-slate-900 uppercase block text-center">
                  FECHA DE APROBACIÓN
                </label>
                <Input
                  type="date"
                  value={tempDocHeader.fecha_aprobacion}
                  onChange={(e) => {
                    setTempDocHeader((p) => ({ ...p, fecha_aprobacion: e.target.value }))
                    setTempIsDirty(true)
                  }}
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
                      value={tempDocHeader.area_ambiente}
                      onValueChange={(val) => {
                        setTempDocHeader((p) => ({ ...p, area_ambiente: val }))
                        setTempIsDirty(true)
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-semibold bg-white flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DEFAULT_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
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
                        tempDocHeader.area_ambiente.includes("compactación")
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

            {/* Table Grid Sheet MULTIFILA de Datos (Todas las lecturas del informe en una sola hoja) */}
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
                      <th className="border-r border-slate-300 p-2 w-36">[ ] RESPONSABLE DEL REGISTRO</th>
                      <th className="border-r border-slate-300 p-2 w-36">[ ] RESPONSABLE DE LA REVISIÓN</th>
                      <th className="p-2 w-12 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempDocRows.map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50">
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            type="date"
                            value={row.fecha_registro}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, fecha_registro: val, fecha_lectura: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs font-mono text-center"
                            required
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            type="time"
                            value={row.hora_toma}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, hora_toma: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs font-mono text-center"
                            required
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            type="date"
                            value={row.fecha_lectura}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, fecha_lectura: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs font-mono text-center"
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="10.0"
                            value={row.temp_min}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, temp_min: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs font-mono text-center"
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="30.0"
                            value={row.temperatura_c}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, temperatura_c: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs font-mono font-bold text-sky-700 text-center"
                            required
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="20.0"
                            value={row.hum_min}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, hum_min: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs font-mono text-center"
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="80.0"
                            value={row.humedad_relativa_pct}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, humedad_relativa_pct: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs font-mono font-bold text-blue-700 text-center"
                            required
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            value={row.responsable_registro}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, responsable_registro: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs"
                            placeholder="Nombre operador"
                            required
                          />
                        </td>
                        <td className="border-r border-slate-300 p-1.5">
                          <Input
                            value={row.responsable_revision}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, responsable_revision: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            className="h-8 text-xs"
                            placeholder="Nombre revisor"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={tempDocRows.length <= 1}
                            onClick={() => {
                              setTempDocRows((rows) => rows.filter((_, i) => i !== idx))
                              setTempIsDirty(true)
                            }}
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Botón Agregar Nueva Fila al Informe */}
              <div className="p-2 bg-slate-50 border-t border-slate-300 flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const last = tempDocRows[tempDocRows.length - 1]
                    setTempDocRows((rows) => [
                      ...rows,
                      {
                        fecha_registro: last ? last.fecha_registro : new Date().toISOString().split("T")[0],
                        hora_toma: "08:00",
                        fecha_lectura: last ? last.fecha_lectura : new Date().toISOString().split("T")[0],
                        temp_min: "10.0",
                        temp_max: "30.0",
                        hum_min: "20.0",
                        hum_max: "80.0",
                        temperatura_c: "23.0",
                        humedad_relativa_pct: "50.0",
                        cumple: true,
                        responsable_registro: user.name || "LABORATORIO",
                        responsable_revision: "",
                      },
                    ])
                    setTempIsDirty(true)
                  }}
                  className="gap-2 h-8 text-xs font-semibold bg-white border-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Fila de Lectura Diaria
                </Button>
                <span className="text-[11px] font-semibold text-slate-600">
                  Total de filas en este informe: {tempDocRows.length}
                </span>
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
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-semibold">
                Guardar Formato F-LEM-P-05.01
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FORMULARIO SHEET EXACTO ILUSTRADO EN LA PRIMERA IMAGEN: F-LEM-IN-01.02 V03
  // (FORMATO COMPLETO MULTIFILA / MULTIPLE VERIFICACIONES EN EL MISMO DOCUMENTO)
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
        <DialogContent className="max-w-[95vw] sm:max-w-[1100px] max-h-[92vh] overflow-y-auto p-6 bg-white">
          <form onSubmit={handleSaveBalanzaDoc} className="space-y-4">
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
                    value={balanzaDocHeader.codigo_balanza}
                    onValueChange={(val) => {
                      const found = DEFAULT_BALANZAS.find((b) => b.codigo === val)
                      setBalanzaDocHeader((p) => ({
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
                    value={balanzaDocHeader.mes_anio}
                    onChange={(e) => {
                      setBalanzaDocHeader((p) => ({ ...p, mes_anio: e.target.value }))
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
                    value={balanzaDocHeader.ubicacion}
                    onChange={(e) => {
                      setBalanzaDocHeader((p) => ({ ...p, ubicacion: e.target.value }))
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
                  value={balanzaDocHeader.codigos_pesas_patron}
                  onChange={(e) => {
                    setBalanzaDocHeader((p) => ({ ...p, codigos_pesas_patron: e.target.value }))
                    setBalanzaIsDirty(true)
                  }}
                  className="h-8 text-xs font-mono bg-white"
                  placeholder="Ej: PP-50G, PP-100G, PP-500G, PP-2000G"
                />
              </div>
            </div>

            {/* Grid Formulario Sheet MULTIFILA Interactivo (F-LEM-IN-01.02 de Imagen 1) */}
            <div className="border border-slate-400 rounded-md overflow-hidden bg-white">
              <div className="bg-slate-200 px-3 py-1.5 text-center font-bold text-xs uppercase border-b border-slate-400 text-slate-800">
                PESA PATRÓN USADO (g) - ANOTAR LAS LECTURAS DE LA BALANZA
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-100 font-bold text-[11px] text-slate-800 border-b border-slate-400 text-center">
                    <tr>
                      <th className="border-r border-slate-300 p-2 w-28">FECHA</th>
                      <th className="border-r border-slate-300 p-2 w-20">HORA</th>
                      <th className="border-r border-slate-300 p-2 w-24">Temp (°C)</th>
                      <th className="border-r border-slate-300 p-2 w-24">Humedad (%H.R.)</th>
                      <th className="border-r border-slate-300 p-2 text-right w-28">Masa Patrón (g)</th>
                      <th className="border-r border-slate-300 p-2 text-right w-28">Lectura (g)</th>
                      <th className="border-r border-slate-300 p-2 text-center w-28">Error / Result</th>
                      <th className="border-r border-slate-300 p-2 w-32">Realizado por:</th>
                      <th className="border-r border-slate-300 p-2 w-32">Revisado por:</th>
                      <th className="p-2 w-12 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanzaDocRows.map((row, idx) => {
                      const m = parseFloat(row.masa_patron_g) || 0
                      const l = parseFloat(row.lectura_balanza_g) || 0
                      const tol = parseFloat(balanzaDocHeader.error_max_permitido_g) || 0.5
                      const err = l - m
                      const conforme = Math.abs(err) <= tol

                      return (
                        <tr key={idx} className="border-b border-slate-300 hover:bg-slate-50">
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              type="date"
                              value={row.fecha}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, fecha: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs font-mono text-center"
                              required
                            />
                          </td>
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              type="time"
                              value={row.hora}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, hora: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs font-mono text-center"
                              required
                            />
                          </td>
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              type="number"
                              step="0.1"
                              value={row.temp_c}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, temp_c: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs font-mono text-center"
                            />
                          </td>
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              type="number"
                              step="0.1"
                              value={row.humedad_pct}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, humedad_pct: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs font-mono text-center"
                            />
                          </td>
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              type="number"
                              step="0.001"
                              value={row.masa_patron_g}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, masa_patron_g: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs font-mono font-bold text-right"
                              required
                            />
                          </td>
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              type="number"
                              step="0.001"
                              value={row.lectura_balanza_g}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, lectura_balanza_g: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs font-mono font-bold text-sky-700 text-right"
                              required
                            />
                          </td>
                          <td className="border-r border-slate-300 p-1.5 text-center">
                            <div
                              className={`h-8 flex items-center justify-center rounded px-1.5 text-[11px] font-bold ${
                                conforme
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-red-50 text-red-700 border border-red-200"
                              }`}
                            >
                              {conforme ? "OK" : "NO OK"} ({err >= 0 ? "+" : ""}
                              {err.toFixed(2)}g)
                            </div>
                          </td>
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              value={row.verificado_por}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, verificado_por: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs"
                              placeholder="Operador"
                              required
                            />
                          </td>
                          <td className="border-r border-slate-300 p-1.5">
                            <Input
                              value={row.revisado_por}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, revisado_por: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              className="h-8 text-xs"
                              placeholder="Revisado por"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={balanzaDocRows.length <= 1}
                              onClick={() => {
                                setBalanzaDocRows((rows) => rows.filter((_, i) => i !== idx))
                                setBalanzaIsDirty(true)
                              }}
                              className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botón Agregar Nueva Fila a la Verificación */}
              <div className="p-2 bg-slate-50 border-t border-slate-300 flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const last = balanzaDocRows[balanzaDocRows.length - 1]
                    setBalanzaDocRows((rows) => [
                      ...rows,
                      {
                        fecha: last ? last.fecha : new Date().toISOString().split("T")[0],
                        hora: "08:00",
                        temp_c: "23.0",
                        humedad_pct: "50.0",
                        masa_patron_g: last ? last.masa_patron_g : "5000",
                        lectura_balanza_g: last ? last.lectura_balanza_g : "5000.0",
                        verificado_por: user.name || "LABORATORIO",
                        revisado_por: "",
                      },
                    ])
                    setBalanzaIsDirty(true)
                  }}
                  className="gap-2 h-8 text-xs font-semibold bg-white border-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Fila de Verificación Diaria
                </Button>
                <span className="text-[11px] font-semibold text-slate-600">
                  Total de verificaciones en este informe: {balanzaDocRows.length}
                </span>
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
                      setBalanzaDocHeader((p) => ({ ...p, limpieza_nivelacion: val }))
                      setBalanzaIsDirty(true)
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                      balanzaDocHeader.limpieza_nivelacion === val
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
              <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-semibold">
                Guardar Formato F-LEM-IN-01.02
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
}
