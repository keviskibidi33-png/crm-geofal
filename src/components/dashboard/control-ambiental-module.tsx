"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import {
  Thermometer,
  Scale,
  Plus,
  RefreshCw,
  Search,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  Save,
  CheckCircle2,
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

const denseInputClass =
  "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-center font-mono text-xs text-slate-900 shadow-2xs focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

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

interface PesadaItem {
  id?: number
  masa_patron_g: string
  lectura_balanza_g: string
  estado?: string
}

interface BalanzaRow {
  fecha: string
  hora: string
  temp_c: string
  humedad_pct: string
  pesadas: PesadaItem[]
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
  { codigo: "EQP-0046", nombre: "BALANZA 0.1g (Recepcion / Suelos)", ubi: "Area de Recepción de muestras", cap: 15000, masa: 2000, tol: 0.5 },
  { codigo: "EQP-0045", nombre: "BALANZA 0.01g (Ensayos Físicos / Límite Líquido)", ubi: "Área de Ensayos físicos", cap: 5000, masa: 1000, tol: 0.1 },
  { codigo: "EQP-0054", nombre: "BALANZA 1g (Proctor / Peso Unitario)", ubi: "Area de Lavado y compactación", cap: 20000, masa: 5000, tol: 1.0 },
  { codigo: "EQP-0090", nombre: "BALANZA 0.1g (Peso Específico Finos)", ubi: "Área de Ensayos físicos", cap: 1000, masa: 500, tol: 0.05 },
  { codigo: "EQP-0059", nombre: "BALANZA 10g (Peso Unitario 10g)", ubi: "Area de Lavado y compactación", cap: 30000, masa: 10000, tol: 2.0 },
  { codigo: "EQP-0050", nombre: "BALANZA 1g (Gravedad Específica Agregado Grueso)", ubi: "Área de Ensayos físicos", cap: 20000, masa: 5000, tol: 1.0 },
  { codigo: "EQP-0044", nombre: "BALANZA 0.0001g (Analítica)", ubi: "Area de Ensayos especiales", cap: 300, masa: 100, tol: 0.005 },
  { codigo: "EQP-0047", nombre: "BALANZA 0.1g (Temperatura Controlada)", ubi: "Area de Temperatura controlada", cap: 10000, masa: 2000, tol: 0.5 },
]

const REALIZADO_POR_LIST = ["BEATRIZ"]
const REVISADO_POR_LIST = ["ING. FABIAN"]

function getMesAnio() {
  return new Date()
    .toLocaleString("es-PE", { month: "long", year: "numeric" })
    .toUpperCase()
}

function ensure15Pesadas(pesadas: PesadaItem[]): PesadaItem[] {
  const result = pesadas ? pesadas.map((p) => ({ ...p, estado: p.estado || (p.lectura_balanza_g ? "OK" : "-") })) : []
  while (result.length < 15) {
    result.push({ masa_patron_g: "", lectura_balanza_g: "", estado: "-" })
  }
  return result.slice(0, 15)
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
    cumple_global: true,
  })
  const [tempDocRows, setTempDocRows] = useState<TempRow[]>([
    {
      fecha_registro: new Date().toISOString().split("T")[0],
      hora_toma: "08:00",
      fecha_lectura: new Date().toISOString().split("T")[0],
      temp_min: "",
      temp_max: "",
      hum_min: "",
      hum_max: "",
      temperatura_c: "",
      humedad_relativa_pct: "",
      cumple: true,
      responsable_registro: user.name || "LABORATORIO",
      responsable_revision: "",
    },
  ])

  const [showBalanzaModal, setShowBalanzaModal] = useState(false)
  const [balanzaIsDirty, setBalanzaIsDirty] = useState(false)
  const [balanzaDocHeader, setBalanzaDocHeader] = useState({
    codigo_balanza: "EQP-0046",
    mes_anio: getMesAnio(),
    ubicacion: "Area de Recepción de muestras",
    codigos_pesas_patron: "PP-01, PP-02, PP-05",
    capacidad_g: "15000",
    masa_patron_g: "2000",
    error_max_permitido_g: "0.5",
    limpieza_nivelacion: true,
  })
  const [balanzaDocRows, setBalanzaDocRows] = useState<BalanzaRow[]>([
    {
      fecha: new Date().toISOString().split("T")[0],
      hora: "08:00",
      temp_c: "",
      humedad_pct: "",
      pesadas: ensure15Pesadas([]),
      verificado_por: "BEATRIZ",
      revisado_por: "ING. FABIAN",
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

  // ── Document Groupings for History List ──
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
        cumple_global: true,
      })
      setTempDocRows([
        {
          fecha_registro: new Date().toISOString().split("T")[0],
          hora_toma: "08:00",
          fecha_lectura: new Date().toISOString().split("T")[0],
          temp_min: "",
          temp_max: "",
          hum_min: "",
          hum_max: "",
          temperatura_c: "",
          humedad_relativa_pct: "",
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
      const firstBalanza = DEFAULT_BALANZAS[0]
      setBalanzaDocHeader({
        codigo_balanza: firstBalanza.codigo,
        mes_anio: getMesAnio(),
        ubicacion: firstBalanza.ubi,
        codigos_pesas_patron: "PP-01, PP-02, PP-05",
        capacidad_g: String(firstBalanza.cap),
        masa_patron_g: String(firstBalanza.masa),
        error_max_permitido_g: String(firstBalanza.tol),
        limpieza_nivelacion: true,
      })
      setBalanzaDocRows([
        {
          fecha: new Date().toISOString().split("T")[0],
          hora: "08:00",
          temp_c: "",
          humedad_pct: "",
          pesadas: ensure15Pesadas([]),
          verificado_por: "BEATRIZ",
          revisado_por: "ING. FABIAN",
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
          cumple_global: first.cumple_especificacion,
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
            responsable_registro: it.responsable_lectura || "BEATRIZ",
            responsable_revision: "ING. FABIAN",
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

        // Agrupar pesadas por fecha y verificador en filas horizontales
        const rowMap = new Map<string, BalanzaRow>()

        items.forEach((it) => {
          const key = `${it.fecha}__${it.verificado_por}`
          if (!rowMap.has(key)) {
            rowMap.set(key, {
              fecha: it.fecha,
              hora: "08:00",
              temp_c: "23.0",
              humedad_pct: "50.0",
              pesadas: [],
              verificado_por: it.verificado_por || "BEATRIZ",
              revisado_por: it.observaciones?.replace(/^REVISADO POR:\s*/i, "") || "ING. FABIAN",
            })
          }
          rowMap.get(key)!.pesadas.push({
            id: it.id,
            masa_patron_g: String(it.masa_patron_g),
            lectura_balanza_g: String(it.lectura_balanza_g),
          })
        })

        const rows = Array.from(rowMap.values()).map((r) => ({
          ...r,
          pesadas: ensure15Pesadas(r.pesadas),
        }))

        setBalanzaDocRows(rows)
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
          cumple_especificacion: tempDocHeader.cumple_global,
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
      const promises: Promise<Response>[] = []

      balanzaDocRows.forEach((row) => {
        row.pesadas.forEach((p) => {
          if (!p.masa_patron_g && !p.lectura_balanza_g) return

          const payload = {
            fecha: row.fecha,
            codigo_balanza: balanzaDocHeader.codigo_balanza,
            ubicacion: balanzaDocHeader.ubicacion,
            capacidad_g: parseFloat(balanzaDocHeader.capacidad_g) || 0.0,
            masa_patron_g: parseFloat(p.masa_patron_g) || 0.0,
            lectura_balanza_g: parseFloat(p.lectura_balanza_g) || 0.0,
            error_max_permitido_g: parseFloat(balanzaDocHeader.error_max_permitido_g) || 0.5,
            limpieza_nivelacion: balanzaDocHeader.limpieza_nivelacion,
            verificado_por: row.verificado_por,
            observaciones: row.revisado_por ? `REVISADO POR: ${row.revisado_por}` : "",
          }

          const url = p.id
            ? `${API_URL}/api/control-ambiental/balanza/${p.id}`
            : `${API_URL}/api/control-ambiental/balanza`
          const method = p.id ? "PUT" : "POST"

          promises.push(
            authFetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          )
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
                Historial Control de Temperatura
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
                        F-LEM-P-05.01 V03
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

        {/* Modal Form Nativo Estilo Corte Directo (Imagen 6) */}
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
              Historial Verificación de Balanzas
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

      {/* Modal Form Nativo Estilo Corte Directo (Imagen 6) */}
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
  // FORMULARIO CON DISEÑO IDÉNTICO A CORTE DIRECTO (IMAGEN 6)
  // F-LEM-P-05.01 V03 CONTROL DE TEMPERATURA Y HUMEDAD RELATIVA
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
        <DialogContent className="max-w-[99vw] w-[99vw] h-[98vh] max-h-[98vh] p-2 sm:p-3 bg-[#f1f5f9] overflow-hidden rounded-xl border-none shadow-2xl flex flex-col [&>button]:hidden">
          <form onSubmit={handleSaveTempDoc} className="flex flex-col h-full overflow-hidden space-y-2">
            {/* Header Barra Superior Nativa (Idéntico a Corte Directo Imagen 6) */}
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Thermometer className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-900">
                    CONTROL DE TEMPERATURA Y HUMEDAD RELATIVA — F-LEM-P-05.01 V03
                  </h1>
                  <p className="text-xs text-slate-500">Módulo nativo del CRM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => executeWithSafetyCheck(() => setShowTempModal(false))}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none"
                title="Cerrar Formulario"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Hoja de Excel Blanca Central (Document Paper Box amplio a pantalla completa) */}
            <div className="w-full max-w-[99vw] mx-auto overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs">
              {/* Bloque Encabezado Oficial con Logo y Título Centrado */}
              <div className="border-b border-slate-300 bg-slate-50 p-4 text-center">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Image src="/logo-geofal.svg" alt="Geofal Logo" width={110} height={32} className="h-7 w-auto" />
                </div>
                <p className="text-[20px] font-bold leading-tight text-slate-900 font-sans">
                  LABORATORIO DE ENSAYO DE MATERIALES
                </p>
                <p className="text-sm font-bold text-slate-800 underline uppercase mt-0.5">
                  F-LEM-P-05.01 V03 CONTROL DE TEMPERATURA Y HUMEDAD RELATIVA
                </p>
              </div>

              {/* Tabla Encabezado Metadatos Superior */}
              <div className="border-b border-slate-300 bg-white p-3">
                <table className="w-full table-fixed border border-slate-300 text-sm">
                  <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                    <tr>
                      <th className="border-r border-slate-300 py-1.5" colSpan={2}>REGISTRO</th>
                      <th className="border-r border-slate-300 py-1.5" colSpan={2}>MES - AÑO</th>
                      <th className="border-r border-slate-300 py-1.5" colSpan={2}>APROBADO POR</th>
                      <th className="py-1.5" colSpan={2}>FECHA APROBACIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                        <input
                          className={`${denseInputClass} text-center`}
                          value={tempDocHeader.registro}
                          onChange={(e) => {
                            setTempDocHeader((p) => ({ ...p, registro: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          placeholder="REG-01"
                        />
                      </td>
                      <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                        <input
                          className={`${denseInputClass} text-center uppercase`}
                          value={tempDocHeader.mes_anio}
                          onChange={(e) => {
                            setTempDocHeader((p) => ({ ...p, mes_anio: e.target.value }))
                            setTempIsDirty(true)
                          }}
                          placeholder="AGOSTO 2026"
                        />
                      </td>
                      <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                        <input
                          className={`${denseInputClass} text-center uppercase`}
                          value={tempDocHeader.aprobado_por}
                          onChange={(e) => {
                            setTempDocHeader((p) => ({ ...p, aprobado_por: e.target.value }))
                            setTempIsDirty(true)
                          }}
                        />
                      </td>
                      <td className="border-t border-slate-300 p-1" colSpan={2}>
                        <input
                          type="date"
                          className={`${denseInputClass} text-center`}
                          value={tempDocHeader.fecha_aprobacion}
                          onChange={(e) => {
                            setTempDocHeader((p) => ({ ...p, fecha_aprobacion: e.target.value }))
                            setTempIsDirty(true)
                          }}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Sub-Banner DATOS Y PARÁMETROS */}
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-800">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="shrink-0">ÁREA DE CONTROL:</span>
                  <Select
                    value={tempDocHeader.area_ambiente}
                    onValueChange={(val) => {
                      setTempDocHeader((p) => ({ ...p, area_ambiente: val }))
                      setTempIsDirty(true)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-300 w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEFAULT_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span>PARÁMETROS:</span>
                  <span className="bg-white border border-slate-300 px-3 py-1 rounded font-bold text-sky-700">
                    {tempDocHeader.area_ambiente.includes("compactación")
                      ? "18 °C – 24 °C | Menor a 80 % H.R."
                      : "10 °C – 30 °C | Menor a 80 % H.R."}
                  </span>
                </div>
              </div>

              {/* Tabla Principal de Casillas Grid Estilo Corte Directo (Imagen 6) */}
              <div className="p-3">
                <table className="w-full table-fixed border border-slate-300 text-xs">
                  <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                    <tr>
                      <th className="border-r border-slate-300 py-2 w-32">FECHA REGISTRO</th>
                      <th className="border-r border-slate-300 py-2 w-24">HORA TOMA</th>
                      <th className="border-r border-slate-300 py-2 w-32">FECHA LECTURA</th>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>
                        TEMPERATURA (°C)
                        <div className="grid grid-cols-2 border-t border-slate-300 mt-1 text-[10px]">
                          <div className="border-r border-slate-300 py-0.5">Mínimo</div>
                          <div className="py-0.5">Máximo</div>
                        </div>
                      </th>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>
                        HUMEDAD RELATIVA (%)
                        <div className="grid grid-cols-2 border-t border-slate-300 mt-1 text-[10px]">
                          <div className="border-r border-slate-300 py-0.5">Mínimo</div>
                          <div className="py-0.5">Máximo</div>
                        </div>
                      </th>
                      <th className="border-r border-slate-300 py-2 w-36">RESPONSABLE REGISTRO</th>
                      <th className="border-r border-slate-300 py-2 w-36">RESPONSABLE REVISIÓN</th>
                      <th className="py-2 w-12 text-center">ACCION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempDocRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="date"
                            className={denseInputClass}
                            value={row.fecha_registro}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, fecha_registro: val, fecha_lectura: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            required
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="time"
                            className={denseInputClass}
                            value={row.hora_toma}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, hora_toma: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            required
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="date"
                            className={denseInputClass}
                            value={row.fecha_lectura}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, fecha_lectura: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="10.0"
                            className={denseInputClass}
                            value={row.temp_min}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, temp_min: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="30.0"
                            className={`${denseInputClass} font-bold text-sky-700`}
                            value={row.temperatura_c}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, temperatura_c: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            required
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="20.0"
                            className={denseInputClass}
                            value={row.hum_min}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, hum_min: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="80.0"
                            className={`${denseInputClass} font-bold text-blue-700`}
                            value={row.humedad_relativa_pct}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, humedad_relativa_pct: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                            required
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <select
                            className={`${denseInputClass} text-center font-bold text-slate-800 cursor-pointer`}
                            value={row.responsable_registro}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, responsable_registro: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                          >
                            {REALIZADO_POR_LIST.map((resp) => (
                              <option key={resp} value={resp}>
                                {resp}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <select
                            className={`${denseInputClass} text-center font-bold text-slate-800 cursor-pointer`}
                            value={row.responsable_revision}
                            onChange={(e) => {
                              const val = e.target.value
                              setTempDocRows((rows) =>
                                rows.map((r, i) => (i === idx ? { ...r, responsable_revision: val } : r))
                              )
                              setTempIsDirty(true)
                            }}
                          >
                            {REVISADO_POR_LIST.map((resp) => (
                              <option key={resp} value={resp}>
                                {resp}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-t border-slate-300 p-1 text-center">
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

              {/* Botón de Agregar Fila estilo Hoja Excel */}
              <div className="p-3 bg-slate-50 border-t border-slate-300 flex justify-between items-center">
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
                        temp_min: "",
                        temp_max: "",
                        hum_min: "",
                        hum_max: "",
                        temperatura_c: "",
                        humedad_relativa_pct: "",
                        cumple: true,
                        responsable_registro: user.name || "LABORATORIO",
                        responsable_revision: "",
                      },
                    ])
                    setTempIsDirty(true)
                  }}
                  className="gap-2 h-8 text-xs font-semibold bg-white border-slate-300"
                >
                  <Plus className="h-3.5 w-3.5 text-sky-600" />
                  Agregar Fila de Lectura Diaria
                </Button>
                <span className="text-xs font-semibold text-slate-600">
                  Total de filas: {tempDocRows.length}
                </span>
              </div>
            </div>

            {/* Footer Botones Guardar y Cancelar */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-300">
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowTempModal(false))}
                className="h-9 text-xs font-semibold bg-white border-slate-300 px-5"
              >
                Cancelar
              </Button>
              <Button type="submit" className="h-9 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white px-6 flex items-center gap-1.5">
                <Save className="h-4 w-4" />
                Guardar Formato F-LEM-P-05.01
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FORMULARIO CON DISEÑO IDÉNTICO A CORTE DIRECTO (IMAGEN 6)
  // F-LEM-IN-01.02 V03 FORMATO DE VERIFICACIÓN DIARIA DE BALANZAS
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
        <DialogContent className="max-w-[99vw] w-[99vw] h-[98vh] max-h-[98vh] p-2 sm:p-3 bg-[#f1f5f9] overflow-hidden rounded-xl border-none shadow-2xl flex flex-col [&>button]:hidden">
          <form onSubmit={handleSaveBalanzaDoc} className="flex flex-col h-full overflow-hidden space-y-2">
            {/* Header Barra Superior Nativa (Idéntico a Corte Directo Imagen 6) */}
            <div className="flex items-center justify-between gap-3 shrink-0 px-1">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                    FORMATO DE VERIFICACIÓN DIARIA DE BALANZAS — F-LEM-IN-01.02 V03
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">Módulo nativo del CRM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => executeWithSafetyCheck(() => setShowBalanzaModal(false))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none"
                title="Cerrar Formulario"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Hoja de Excel Blanca Central (Document Paper Box amplio flex-1 sin scroll exterior) */}
            <div className="w-full max-w-[99vw] mx-auto overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs flex flex-col flex-1 min-h-0">
              {/* Bloque Encabezado Oficial Estilo Hoja Excel 3 Columnas (Logo | Título | Metadatos) */}
              <div className="border-b border-slate-300 bg-white p-2 shrink-0">
                <div className="grid grid-cols-12 border border-slate-300 items-center">
                  <div className="col-span-3 border-r border-slate-300 p-1.5 flex items-center justify-center bg-slate-50 min-h-[56px]">
                    <Image src="/logo-geofal.svg" alt="Geofal Logo" width={110} height={32} className="h-7 w-auto" />
                  </div>
                  <div className="col-span-6 border-r border-slate-300 p-1.5 text-center bg-slate-50 min-h-[56px] flex flex-col justify-center">
                    <p className="text-sm sm:text-base font-bold leading-tight text-slate-900 uppercase">
                      FORMATO DE VERIFICACIÓN DIARIA DE BALANZAS
                    </p>
                    <p className="text-[11px] font-semibold text-slate-600 uppercase mt-0.5">
                      NORMA NTP / ASTM — F-LEM-IN-01.02 V03
                    </p>
                  </div>
                  <div className="col-span-3 text-[10px] font-mono text-slate-800 bg-slate-50 min-h-[56px] flex flex-col justify-center">
                    <div className="border-b border-slate-300 px-2 py-0.5 flex justify-between gap-1 whitespace-nowrap">
                      <span className="font-bold">CÓDIGO:</span>
                      <span className="font-bold text-slate-900">F-LEM-IN-01.02</span>
                    </div>
                    <div className="border-b border-slate-300 px-2 py-0.5 flex justify-between gap-1 whitespace-nowrap">
                      <span className="font-bold">REVISIÓN:</span>
                      <span>03</span>
                    </div>
                    <div className="border-b border-slate-300 px-2 py-0.5 flex justify-between gap-1 whitespace-nowrap">
                      <span className="font-bold">FECHA:</span>
                      <span>2024-01-02</span>
                    </div>
                    <div className="px-2 py-0.5 flex justify-between gap-1 whitespace-nowrap">
                      <span className="font-bold">PÁGINA:</span>
                      <span>1 de 1</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla Encabezado Metadatos Superior (Código Balanza | Mes-Año | Ubicación | Pesas Patrón) */}
              <div className="border-b border-slate-300 bg-white p-2 shrink-0">
                <table className="w-full table-fixed border border-slate-300 text-xs">
                  <thead className="bg-slate-100 text-[11px] font-semibold text-slate-800">
                    <tr>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>CÓDIGO DE LA BALANZA</th>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>MES / AÑO</th>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>UBICACIÓN</th>
                      <th className="py-1" colSpan={2}>CÓDIGOS DE LAS PESAS PATRÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                        <select
                          className={`${denseInputClass} font-bold text-xs bg-white border-slate-300 cursor-pointer w-full text-ellipsis overflow-hidden`}
                          value={balanzaDocHeader.codigo_balanza}
                          onChange={(e) => {
                            const val = e.target.value
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
                          {DEFAULT_BALANZAS.map((b) => (
                            <option key={b.codigo} value={b.codigo}>
                              {b.codigo} — {b.nombre} ({b.cap}g)
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                        <input
                          className={`${denseInputClass} text-center uppercase`}
                          value={balanzaDocHeader.mes_anio}
                          onChange={(e) => {
                            setBalanzaDocHeader((p) => ({ ...p, mes_anio: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          placeholder="AGOSTO 2026"
                        />
                      </td>
                      <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                        <select
                          className={`${denseInputClass} font-semibold bg-white cursor-pointer`}
                          value={balanzaDocHeader.ubicacion}
                          onChange={(e) => {
                            const val = e.target.value
                            setBalanzaDocHeader((p) => ({ ...p, ubicacion: val }))
                            setBalanzaIsDirty(true)
                          }}
                        >
                          {DEFAULT_AREAS.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-t border-slate-300 p-1" colSpan={2}>
                        <input
                          className={denseInputClass}
                          value={balanzaDocHeader.codigos_pesas_patron}
                          onChange={(e) => {
                            setBalanzaDocHeader((p) => ({ ...p, codigos_pesas_patron: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                          placeholder="PP-01, PP-02"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ÚNICO CONTENEDOR CON SCROLL: Tabla Principal de Casillas Grid 15 Pesadas */}
              <div className="p-2 overflow-x-auto overflow-y-auto flex-1 min-h-0 max-w-full">
                <table className="min-w-[2400px] w-full border-collapse border border-slate-300 text-xs">
                  <thead className="bg-slate-100 text-xs font-semibold text-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="border-r border-b border-slate-300 py-1.5 w-28 text-center bg-slate-100" rowSpan={2}>FECHA</th>
                      <th className="border-r border-b border-slate-300 py-1.5 w-20 text-center bg-slate-100" rowSpan={2}>HORA</th>
                      <th className="border-r border-b border-slate-300 py-1.5 w-28 min-w-[105px] text-center bg-slate-100" rowSpan={2}>TEMP (°C)</th>
                      <th className="border-r border-b border-slate-300 py-1.5 w-32 min-w-[125px] text-center bg-slate-100" rowSpan={2}>HUMEDAD (%H.R.)</th>
                      <th className="border-r border-b border-slate-300 py-1 text-center font-bold bg-emerald-100 text-emerald-900 border-emerald-300 uppercase tracking-wide" colSpan={15}>
                        PESA PATRÓN USADO (g) - ANOTAR LAS LECTURAS DE LA BALANZA
                      </th>
                      <th className="border-r border-b border-slate-300 py-1.5 w-32 text-center bg-slate-100" rowSpan={2}>REALIZADO POR</th>
                      <th className="border-r border-b border-slate-300 py-1.5 w-32 text-center bg-slate-100" rowSpan={2}>REVISADO POR</th>
                      <th className="border-b border-slate-300 py-1.5 w-12 text-center bg-slate-100" rowSpan={2}>ACCION</th>
                    </tr>
                    <tr>
                      {Array.from({ length: 15 }).map((_, i) => (
                        <th key={i} className="border-r border-b border-slate-300 py-1 px-1 text-center font-bold text-slate-700 bg-slate-100 w-36 min-w-[136px]">
                          OK / NO
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {balanzaDocRows.map((row, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border-t border-r border-slate-300 p-1">
                            <input
                              type="date"
                              className={denseInputClass}
                              value={row.fecha}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, fecha: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              required
                            />
                          </td>
                          <td className="border-t border-r border-slate-300 p-1">
                            <input
                              type="time"
                              className={denseInputClass}
                              value={row.hora}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, hora: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                              required
                            />
                          </td>
                          <td className="border-t border-r border-slate-300 p-1 w-28 min-w-[105px]">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="23.0"
                              className={denseInputClass}
                              value={row.temp_c}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, temp_c: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                            />
                          </td>
                          <td className="border-t border-r border-slate-300 p-1 w-32 min-w-[125px]">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="50.0"
                              className={denseInputClass}
                              value={row.humedad_pct}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, humedad_pct: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                            />
                          </td>

                          {/* 15 Casillas Horizontales: /casilla de dato/desplegable (ok)(no)/ */}
                          {ensure15Pesadas(row.pesadas).map((p, pIdx) => {
                            const valText = p.lectura_balanza_g || p.masa_patron_g
                            const estText = p.estado || (valText ? "OK" : "-")

                            return (
                              <td key={pIdx} className="border-t border-r border-slate-300 p-1 min-w-[136px] w-36 text-center bg-white">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="Dato"
                                    className={`${denseInputClass} text-center font-mono font-bold text-xs h-7 w-20 border-slate-300 bg-white`}
                                    value={valText}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setBalanzaDocRows((rows) =>
                                        rows.map((r, i) =>
                                          i === idx
                                            ? {
                                                ...r,
                                                pesadas: ensure15Pesadas(r.pesadas).map((pes, pi) =>
                                                  pi === pIdx
                                                    ? {
                                                        ...pes,
                                                        lectura_balanza_g: val,
                                                        masa_patron_g: val,
                                                        estado: pes.estado === "-" && val ? "OK" : pes.estado,
                                                      }
                                                    : pes
                                                ),
                                              }
                                            : r
                                        )
                                      )
                                      setBalanzaIsDirty(true)
                                    }}
                                  />
                                  <select
                                    className={`${denseInputClass} text-center font-extrabold text-[11px] h-7 w-14 cursor-pointer rounded ${
                                      estText === "NO"
                                        ? "bg-red-100 text-red-800 border-red-300"
                                        : estText === "OK"
                                        ? "bg-blue-100 text-blue-800 border-blue-300"
                                        : "bg-slate-50 text-slate-600 border-slate-300"
                                    }`}
                                    value={estText}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setBalanzaDocRows((rows) =>
                                        rows.map((r, i) =>
                                          i === idx
                                            ? {
                                                ...r,
                                                pesadas: ensure15Pesadas(r.pesadas).map((pes, pi) =>
                                                  pi === pIdx ? { ...pes, estado: val } : pes
                                                ),
                                              }
                                            : r
                                        )
                                      )
                                      setBalanzaIsDirty(true)
                                    }}
                                  >
                                    <option value="-">-</option>
                                    <option value="OK">OK</option>
                                    <option value="NO">NO</option>
                                  </select>
                                </div>
                              </td>
                            )
                          })}

                          <td className="border-t border-r border-slate-300 p-1">
                            <select
                              className={`${denseInputClass} text-center font-bold text-slate-800 cursor-pointer`}
                              value={row.verificado_por}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, verificado_por: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                            >
                              {REALIZADO_POR_LIST.map((resp) => (
                                <option key={resp} value={resp}>
                                  {resp}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border-t border-r border-slate-300 p-1">
                            <select
                              className={`${denseInputClass} text-center font-bold text-slate-800 cursor-pointer`}
                              value={row.revisado_por}
                              onChange={(e) => {
                                const val = e.target.value
                                setBalanzaDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, revisado_por: val } : r))
                                )
                                setBalanzaIsDirty(true)
                              }}
                            >
                              {REVISADO_POR_LIST.map((resp) => (
                                <option key={resp} value={resp}>
                                  {resp}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="border-t border-slate-300 p-1 text-center">
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

              {/* Botón de Agregar Fila estilo Hoja Excel */}
              <div className="p-2 bg-slate-50 border-t border-slate-300 flex justify-between items-center shrink-0">
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
                        pesadas: ensure15Pesadas([]),
                        verificado_por: last ? last.verificado_por : "BEATRIZ",
                        revisado_por: last ? last.revisado_por : "ING. FABIAN",
                      },
                    ])
                    setBalanzaIsDirty(true)
                  }}
                  className="gap-2 h-7 text-xs font-semibold bg-white border-slate-300"
                >
                  <Plus className="h-3.5 w-3.5 text-sky-600" />
                  Agregar Fila de Verificación Diaria
                </Button>
                <span className="text-xs font-semibold text-slate-600">
                  Total de verificaciones: {balanzaDocRows.length}
                </span>
              </div>
            </div>

            {/* Sub-Card Limpieza y Nivelación */}
            <div className="w-full max-w-[99vw] mx-auto flex items-center justify-between p-2 px-3 rounded-lg border border-slate-300 bg-white shrink-0">
              <span className="text-xs font-bold text-slate-800">
                LIMPIEZA Y NIVELACIÓN DE LA BALANZA
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
                    className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                      balanzaDocHeader.limpieza_nivelacion === val
                        ? val
                          ? "bg-sky-600 border-sky-600 text-white"
                          : "bg-red-600 border-red-600 text-white"
                        : "border-slate-300 text-slate-600 bg-white hover:bg-slate-50"
                    }`}
                  >
                    {val ? "CONFORME (OK)" : "NO CONFORME"}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Botones Guardar y Cancelar */}
            <div className="pt-1.5 flex items-center justify-end gap-3 border-t border-slate-300 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowBalanzaModal(false))}
                className="h-8 text-xs font-semibold bg-white border-slate-300 px-5"
              >
                Cancelar
              </Button>
              <Button type="submit" className="h-8 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white px-6 flex items-center gap-1.5">
                <Save className="h-4 w-4" />
                Guardar Formato F-LEM-IN-01.02
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
}
