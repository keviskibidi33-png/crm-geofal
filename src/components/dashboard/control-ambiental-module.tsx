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
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
  X,
  Save,
  Download,
  Lock,
  Unlock,
  Clock,
  KeyRound,
  ShieldCheck,
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

export interface PesadaOption {
  label: string
  nominal: number
  variacion: number
  precision: number
}

export interface BalanzaDef {
  codigo: string
  nombre: string
  ubi: string
  cap: number
  masa: number
  tol: number
  pats: string[]
  pesadas: PesadaOption[]
}

const DEFAULT_BALANZAS: BalanzaDef[] = [
  {
    codigo: "EQP-0054",
    nombre: "BALANZA 1g (Ensayos Físicos)",
    ubi: "Área de Ensayos físicos",
    cap: 20000,
    masa: 5000,
    tol: 1.0,
    pats: ["PAT 6", "PAT 7", "PAT 8", "PAT 9", "PAT 10", "PAT 11"],
    pesadas: [
      { label: "5,00KG", nominal: 5, variacion: 4.99, precision: 2 },
      { label: "10,00 KG", nominal: 10, variacion: 9.99, precision: 2 },
      { label: "15,00KG", nominal: 15, variacion: 14.99, precision: 2 },
      { label: "20,00KG", nominal: 20, variacion: 19.99, precision: 2 },
      { label: "30,00KG", nominal: 30, variacion: 29.99, precision: 2 },
      { label: "40,00KG", nominal: 40, variacion: 39.99, precision: 2 },
      { label: "60,00KG", nominal: 60, variacion: 59.99, precision: 2 },
    ],
  },
  {
    codigo: "EQP-0093",
    nombre: "BALANZA (Densidad / Ensayos Físicos)",
    ubi: "Área de Ensayos físicos",
    cap: 20000,
    masa: 5000,
    tol: 1.0,
    pats: ["PAT 3", "PAT 4", "PAT 5", "PAT 6", "PAT 7"],
    pesadas: [
      { label: "500G", nominal: 500, variacion: 499, precision: 0 },
      { label: "1000G", nominal: 1000, variacion: 999, precision: 0 },
      { label: "5000G", nominal: 5000, variacion: 4999, precision: 0 },
      { label: "10000G", nominal: 10000, variacion: 9999, precision: 0 },
      { label: "15000G", nominal: 15000, variacion: 14999, precision: 0 },
      { label: "20000G", nominal: 20000, variacion: 19999, precision: 0 },
    ],
  },
  {
    codigo: "EQP-0046",
    nombre: "BALANZA 0.1g (Ensayos Físicos)",
    ubi: "Área de Ensayos físicos",
    cap: 15000,
    masa: 2000,
    tol: 0.5,
    pats: ["PAT 1", "PAT 2", "PAT 3", "PAT 4", "PAT 5", "PAT 6"],
    pesadas: [
      { label: "20,0G", nominal: 20, variacion: 19.9, precision: 1 },
      { label: "200,0G", nominal: 200, variacion: 199.9, precision: 1 },
      { label: "500,0G", nominal: 500, variacion: 499.9, precision: 1 },
      { label: "1000,0G", nominal: 1000, variacion: 999.9, precision: 1 },
      { label: "5000,0G", nominal: 5000, variacion: 4999.9, precision: 1 },
      { label: "10000,0G", nominal: 10000, variacion: 9999.9, precision: 1 },
      { label: "11000,0G", nominal: 11000, variacion: 10999.9, precision: 1 },
    ],
  },
  {
    codigo: "EQP-0005",
    nombre: "BALANZA (Ensayos Físicos)",
    ubi: "Área de Ensayos físicos",
    cap: 15000,
    masa: 2000,
    tol: 0.5,
    pats: ["PAT 3", "PAT 4", "PAT 5", "PAT 6", "PAT 7"],
    pesadas: [
      { label: "500G", nominal: 500, variacion: 499, precision: 0 },
      { label: "1000G", nominal: 1000, variacion: 999, precision: 0 },
      { label: "5000G", nominal: 5000, variacion: 4999, precision: 0 },
      { label: "10000G", nominal: 10000, variacion: 9999, precision: 0 },
      { label: "15000G", nominal: 15000, variacion: 14999, precision: 0 },
      { label: "20000G", nominal: 20000, variacion: 19999, precision: 0 },
    ],
  },
  {
    codigo: "EQP-0019",
    nombre: "BALANZA (Temperatura Controlada)",
    ubi: "Area de Temperatura controlada",
    cap: 10000,
    masa: 2000,
    tol: 0.5,
    pats: ["PAT 1"],
    pesadas: [
      { label: "20,0000G", nominal: 20, variacion: 19.9999, precision: 4 },
    ],
  },
  {
    codigo: "EQP-0147",
    nombre: "BALANZA (Temperatura Controlada)",
    ubi: "Area de Temperatura controlada",
    cap: 10000,
    masa: 2000,
    tol: 0.5,
    pats: ["PAT 3", "PAT 4", "PAT 5", "PAT 6", "PAT 7"],
    pesadas: [
      { label: "500G", nominal: 500, variacion: 499, precision: 0 },
      { label: "1000G", nominal: 1000, variacion: 999, precision: 0 },
      { label: "5000G", nominal: 5000, variacion: 4999, precision: 0 },
      { label: "10000G", nominal: 10000, variacion: 9999, precision: 0 },
      { label: "15000G", nominal: 15000, variacion: 14999, precision: 0 },
      { label: "20000G", nominal: 20000, variacion: 19999, precision: 0 },
    ],
  },
  {
    codigo: "EQP-0090",
    nombre: "BALANZA 0.1g (Temperatura Controlada)",
    ubi: "Area de Temperatura controlada",
    cap: 1000,
    masa: 500,
    tol: 0.05,
    pats: ["PAT 1", "PAT 2", "PAT 3", "PAT 4"],
    pesadas: [
      { label: "20,0G", nominal: 20, variacion: 19.9, precision: 1 },
      { label: "200,0G", nominal: 200, variacion: 199.9, precision: 1 },
      { label: "500,0G", nominal: 500, variacion: 499.9, precision: 1 },
      { label: "1000,0G", nominal: 1000, variacion: 999.9, precision: 1 },
      { label: "1200,0G", nominal: 1200, variacion: 1199.9, precision: 1 },
    ],
  },
  {
    codigo: "EQP-0045",
    nombre: "BALANZA 0.01g (Ensayos Especiales)",
    ubi: "Area de Ensayos especiales",
    cap: 5000,
    masa: 1000,
    tol: 0.1,
    pats: ["PAT 1", "PAT 2", "PAT 3", "PAT 4"],
    pesadas: [
      { label: "20,00G", nominal: 20, variacion: 19.99, precision: 2 },
      { label: "200,00G", nominal: 200, variacion: 199.99, precision: 2 },
      { label: "500,00G", nominal: 500, variacion: 499.99, precision: 2 },
      { label: "1000,00G", nominal: 1000, variacion: 999.99, precision: 2 },
    ],
  },
  {
    codigo: "EQP-0059",
    nombre: "BALANZA 10g (Ensayos Físicos)",
    ubi: "Área de Ensayos físicos",
    cap: 30000,
    masa: 10000,
    tol: 2.0,
    pats: ["PAT 1", "PAT 2"],
    pesadas: [
      { label: "5000G", nominal: 5000, variacion: 4999, precision: 0 },
      { label: "10000G", nominal: 10000, variacion: 9999, precision: 0 },
      { label: "20000G", nominal: 20000, variacion: 19999, precision: 0 },
    ],
  },
]

const REALIZADO_POR_LIST = ["BEATRIZ"]
const REVISADO_POR_LIST = ["ING. FABIAN"]

function getMesAnio() {
  return new Date()
    .toLocaleString("es-PE", { month: "long", year: "numeric" })
    .toUpperCase()
}

function ensurePesadas(pesadas?: PesadaItem[], count: number = 15): PesadaItem[] {
  const list = pesadas || []
  const result: PesadaItem[] = list.map((p) => {
    return { ...p, estado: p.estado || "-" }
  })
  while (result.length < count) {
    result.push({ masa_patron_g: "", lectura_balanza_g: "", estado: "-" })
  }
  return result.slice(0, count)
}

function ensure15Pesadas(pesadas?: PesadaItem[]): PesadaItem[] {
  return ensurePesadas(pesadas, 15)
}

interface TempHeaderMeta {
  registro?: string
  mes_anio?: string
  aprobado_por?: string
  fecha_aprobacion?: string
  revisado_por?: string
  hum_min?: string
  fecha_lectura?: string
  cerrado?: boolean
  cerrado_por?: string
  fecha_cierre?: string
  pin_cierre?: string
}

interface BalanzaHeaderMeta {
  mes_anio?: string
  codigos_pesas_patron?: string
  revisado_por?: string
  hora?: string
  temp_c?: string
  humedad_pct?: string
  estado_pesadas?: Record<number, string>
  columnas_pesadas?: string[]
  cerrado?: boolean
  cerrado_por?: string
  fecha_cierre?: string
  pin_cierre?: string
}

function parseTempObs(obs?: string | null): TempHeaderMeta {
  if (!obs) return {}
  try {
    if (obs.startsWith("{")) {
      return JSON.parse(obs)
    }
  } catch {}
  if (obs.startsWith("REVISADO POR:")) {
    return { revisado_por: obs.replace(/^REVISADO POR:\s*/i, "") }
  }
  return {}
}

function parseBalanzaObs(obs?: string | null): BalanzaHeaderMeta {
  if (!obs) return {}
  try {
    if (obs.startsWith("{")) {
      return JSON.parse(obs)
    }
  } catch {}
  if (obs.startsWith("REVISADO POR:")) {
    return { revisado_por: obs.replace(/^REVISADO POR:\s*/i, "") }
  }
  return {}
}

function normalizeAreaName(areaStr?: string): string {
  if (!areaStr) return DEFAULT_AREAS[0]
  const clean = areaStr.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const found = DEFAULT_AREAS.find((a) => {
    const aClean = a.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    return aClean === clean || clean.includes(aClean) || aClean.includes(clean)
  })
  return found || DEFAULT_AREAS[0]
}

function normalizeBalanzaCode(code?: string): string {
  if (!code) return DEFAULT_BALANZAS[0].codigo
  const clean = code.trim().toUpperCase().replace(/\s+/g, "-")
  const found = DEFAULT_BALANZAS.find((b) => {
    const bClean = b.codigo.toUpperCase().replace(/\s+/g, "-")
    return bClean === clean || clean.includes(bClean) || bClean.includes(clean)
  })
  return found ? found.codigo : DEFAULT_BALANZAS[0].codigo
}

function evaluateTempHumRow(row: TempRow, areaName: string) {
  const isLavado = areaName.toLowerCase().includes("compactac") || areaName.toLowerCase().includes("lavado")
  const minLimitTemp = isLavado ? 18.0 : 10.0
  const maxLimitTemp = isLavado ? 24.0 : 30.0
  const maxLimitHum = 80.0

  const tempVal = parseFloat(row.temperatura_c)
  const humVal = parseFloat(row.humedad_relativa_pct)
  const tempMinVal = parseFloat(row.temp_min)
  const tempMaxVal = parseFloat(row.temp_max || row.temperatura_c)
  const humMinVal = parseFloat(row.hum_min)

  const isTempOut = !isNaN(tempVal) && (tempVal < minLimitTemp || tempVal > maxLimitTemp)
  const isHumOut = !isNaN(humVal) && (humVal >= maxLimitHum)
  const isTempRangeInvalid = !isNaN(tempMinVal) && !isNaN(tempMaxVal) && tempMinVal > tempMaxVal
  const isHumRangeInvalid = !isNaN(humMinVal) && !isNaN(humVal) && humMinVal > humVal

  const cumple = !isTempOut && !isHumOut && !isTempRangeInvalid && !isHumRangeInvalid

  return {
    cumple,
    isTempOut,
    isHumOut,
    isTempRangeInvalid,
    isHumRangeInvalid,
    tempLimitsMsg: `${minLimitTemp} - ${maxLimitTemp} °C`,
    humLimitsMsg: `< ${maxLimitHum}% H.R.`,
  }
}

function evaluatePesadaConformity(lectura?: string, patron?: string, tol: number = 0.5) {
  const lecNum = parseFloat(lectura || patron || "")
  const patNum = parseFloat(patron || lectura || "")

  if (isNaN(lecNum) || isNaN(patNum)) {
    return { estado: "-", conforme: true, diff: 0 }
  }

  const diff = Math.abs(lecNum - patNum)
  const isOk = Math.round(diff * 100000) / 100000 <= Math.round(tol * 100000) / 100000
  return {
    estado: isOk ? "OK" : "NO",
    conforme: isOk,
    diff,
  }
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
  const [deletedTempRowIds, setDeletedTempRowIds] = useState<number[]>([])
  const [deletedBalanzaRowIds, setDeletedBalanzaRowIds] = useState<number[]>([])
  const [showTempModal, setShowTempModal] = useState(false)
  const [tempIsDirty, setTempIsDirty] = useState(false)
  const [tempDocHeader, setTempDocHeader] = useState({
    registro: "REG-01",
    mes_anio: getMesAnio(),
    aprobado_por: "JEFE DE LABORATORIO",
    fecha_aprobacion: "2024-01-02",
    area_ambiente: DEFAULT_AREAS[0],
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
  const [balanzaDocHeader, setBalanzaDocHeader] = useState<{
    codigo_balanza: string
    mes_anio: string
    ubicacion: string
    codigos_pesas_patron: string
    capacidad_g: string
    masa_patron_g: string
    error_max_permitido_g: string
    limpieza_nivelacion: boolean
    columnas_pesadas: string[]
    cerrado: boolean
    cerrado_por?: string
    fecha_cierre?: string
    pin_cierre?: string
  }>({
    codigo_balanza: DEFAULT_BALANZAS[0].codigo,
    mes_anio: getMesAnio(),
    ubicacion: DEFAULT_BALANZAS[0].ubi,
    codigos_pesas_patron: DEFAULT_BALANZAS[0].pats.join(", "),
    capacidad_g: String(DEFAULT_BALANZAS[0].cap),
    masa_patron_g: String(DEFAULT_BALANZAS[0].masa),
    error_max_permitido_g: String(DEFAULT_BALANZAS[0].tol),
    limpieza_nivelacion: true,
    columnas_pesadas: DEFAULT_BALANZAS[0].pesadas.map((p) => p.label),
    cerrado: false,
  })

  // ── Modal de Cierre / Bloqueo Mensual con PIN ──
  const [cierreModalOpen, setCierreModalOpen] = useState(false)
  const [cierreTargetDoc, setCierreTargetDoc] = useState<{
    type: "balanza" | "temperatura"
    title: string
    items: (ControlBalanzaItem | ControlTemperaturaItem)[]
    isClosing: boolean
    currentPin?: string
  } | null>(null)
  const [cierrePinInput, setCierrePinInput] = useState("")
  const [cierrePinError, setCierrePinError] = useState("")

  const currentBalanzaDef = useMemo(() => {
    const normCode = normalizeBalanzaCode(balanzaDocHeader.codigo_balanza)
    return DEFAULT_BALANZAS.find((b) => b.codigo === normCode) || DEFAULT_BALANZAS[0]
  }, [balanzaDocHeader.codigo_balanza])

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

  // ── Excel Export Functions using official reference .xlsx template with JWT Auth ──
  const handleExportTempExcel = async (area?: string) => {
    try {
      toast.info("Generando formato oficial Excel (F-LEM-P-05.01)...")
      const query = area ? `?area=${encodeURIComponent(area)}` : ""
      const res = await authFetch(`${API_URL}/api/control-ambiental/temperatura/excel${query}`)
      if (!res.ok) {
        toast.error("No se pudo generar el Excel del formato")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `F-LEM-P-05.01_${(area || "GENERAL").replace(/\s+/g, "_")}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Formato oficial Excel F-LEM-P-05.01 descargado")
    } catch {
      toast.error("Error al descargar Excel del servidor")
    }
  }

  const handleExportBalanzaExcel = async (codigo?: string) => {
    try {
      toast.info("Generando formato oficial Excel (F-LEM-IN-01.02)...")
      const query = codigo ? `?codigo=${encodeURIComponent(codigo)}` : ""
      const res = await authFetch(`${API_URL}/api/control-ambiental/balanza/excel${query}`)
      if (!res.ok) {
        toast.error("No se pudo generar el Excel del formato")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `F-LEM-IN-01.02_${(codigo || "GENERAL").replace(/\s+/g, "_")}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Formato oficial Excel F-LEM-IN-01.02 descargado")
    } catch {
      toast.error("Error al descargar Excel del servidor")
    }
  }

  // ── Document Groupings for History List ──
  const tempDocGroups = useMemo(() => {
    const map = new Map<string, {
      key: string
      area_ambiente: string
      mes_anio: string
      cerrado: boolean
      cerrado_por?: string
      fecha_cierre?: string
      pin_cierre?: string
      items: ControlTemperaturaItem[]
    }>()

    temperaturaList.forEach((item) => {
      const normArea = normalizeAreaName(item.area_ambiente)
      const parsedObs = parseTempObs(item.observaciones)
      const fechaObj = new Date(item.fecha + "T00:00:00")
      const defaultMesAnio = item.fecha
        ? fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase()
        : getMesAnio()
      const mes_anio = parsedObs.mes_anio || defaultMesAnio
      const key = `${normArea}__${mes_anio}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          area_ambiente: normArea,
          mes_anio,
          cerrado: Boolean(parsedObs.cerrado),
          cerrado_por: parsedObs.cerrado_por,
          fecha_cierre: parsedObs.fecha_cierre,
          pin_cierre: parsedObs.pin_cierre,
          items: [],
        })
      }
      const grp = map.get(key)!
      if (parsedObs.cerrado) {
        grp.cerrado = true
        grp.cerrado_por = parsedObs.cerrado_por || grp.cerrado_por
        grp.fecha_cierre = parsedObs.fecha_cierre || grp.fecha_cierre
        grp.pin_cierre = parsedObs.pin_cierre || grp.pin_cierre
      }
      grp.items.push(item)
    })

    return Array.from(map.values())
  }, [temperaturaList])

  const balanzaDocGroups = useMemo(() => {
    const map = new Map<string, {
      key: string
      codigo_balanza: string
      mes_anio: string
      ubicacion: string
      cerrado: boolean
      cerrado_por?: string
      fecha_cierre?: string
      pin_cierre?: string
      items: ControlBalanzaItem[]
    }>()

    balanzaList.forEach((item) => {
      const normCode = normalizeBalanzaCode(item.codigo_balanza)
      const parsedObs = parseBalanzaObs(item.observaciones)
      const fechaObj = new Date(item.fecha + "T00:00:00")
      const defaultMesAnio = item.fecha
        ? fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase()
        : getMesAnio()
      const mes_anio = parsedObs.mes_anio || defaultMesAnio
      const key = `${normCode}__${mes_anio}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          codigo_balanza: normCode,
          mes_anio,
          ubicacion: item.ubicacion,
          cerrado: Boolean(parsedObs.cerrado),
          cerrado_por: parsedObs.cerrado_por,
          fecha_cierre: parsedObs.fecha_cierre,
          pin_cierre: parsedObs.pin_cierre,
          items: [],
        })
      }
      const grp = map.get(key)!
      if (parsedObs.cerrado) {
        grp.cerrado = true
        grp.cerrado_por = parsedObs.cerrado_por || grp.cerrado_por
        grp.fecha_cierre = parsedObs.fecha_cierre || grp.fecha_cierre
        grp.pin_cierre = parsedObs.pin_cierre || grp.pin_cierre
      }
      grp.items.push(item)
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
      setDeletedTempRowIds([])
      const todayStr = new Date().toISOString().split("T")[0]
      setTempDocHeader({
        registro: "REG-01",
        mes_anio: getMesAnio(),
        aprobado_por: "JEFE DE LABORATORIO",
        fecha_aprobacion: todayStr,
        area_ambiente: DEFAULT_AREAS[0],
        cumple_global: true,
      })
      setTempDocRows([
        {
          fecha_registro: todayStr,
          hora_toma: "08:00",
          fecha_lectura: todayStr,
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
      const defaultCols = firstBalanza.pesadas.map((p) => p.label)
      setDeletedBalanzaRowIds([])
      setBalanzaDocHeader({
        codigo_balanza: firstBalanza.codigo,
        mes_anio: getMesAnio(),
        ubicacion: firstBalanza.ubi,
        codigos_pesas_patron: firstBalanza.pats.join(", "),
        capacidad_g: String(firstBalanza.cap),
        masa_patron_g: String(firstBalanza.masa),
        error_max_permitido_g: String(firstBalanza.tol),
        limpieza_nivelacion: true,
        columnas_pesadas: defaultCols,
        cerrado: false,
        cerrado_por: undefined,
        fecha_cierre: undefined,
        pin_cierre: undefined,
      })
      setBalanzaDocRows([
        {
          fecha: new Date().toISOString().split("T")[0],
          hora: "08:00",
          temp_c: "",
          humedad_pct: "",
          pesadas: ensurePesadas([], defaultCols.length),
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
      setDeletedTempRowIds([])
      if (items.length > 0) {
        const first = items[0]
        const parsedObs = parseTempObs(first.observaciones)
        const fechaObj = new Date(first.fecha + "T00:00:00")
        const defaultMesAnio = fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase()

        setTempDocHeader({
          registro: parsedObs.registro || "REG-01",
          mes_anio: parsedObs.mes_anio || defaultMesAnio,
          aprobado_por: parsedObs.aprobado_por || "JEFE DE LABORATORIO",
          fecha_aprobacion: parsedObs.fecha_aprobacion || first.fecha || new Date().toISOString().split("T")[0],
          area_ambiente: normalizeAreaName(first.area_ambiente),
          cumple_global: first.cumple_especificacion,
        })
        setTempDocRows(
          items.map((it) => {
            const rowObs = parseTempObs(it.observaciones)
            return {
              id: it.id,
              fecha_registro: it.fecha,
              hora_toma: it.hora_lectura,
              fecha_lectura: rowObs.fecha_lectura || it.fecha,
              temp_min: it.temp_min != null ? String(it.temp_min) : "",
              temp_max: it.temp_max != null ? String(it.temp_max) : String(it.temperatura_c ?? ""),
              hum_min: rowObs.hum_min != null ? String(rowObs.hum_min) : "",
              hum_max: "",
              temperatura_c: it.temperatura_c != null ? String(it.temperatura_c) : "",
              humedad_relativa_pct: it.humedad_relativa_pct != null ? String(it.humedad_relativa_pct) : "",
              cumple: it.cumple_especificacion,
              responsable_registro: it.responsable_lectura || "BEATRIZ",
              responsable_revision: rowObs.revisado_por || "ING. FABIAN",
            }
          })
        )
      }
      setTempIsDirty(false)
      setShowTempModal(true)
    })
  }

  const openEditBalanzaDoc = (items: ControlBalanzaItem[]) => {
    executeWithSafetyCheck(() => {
      setDeletedBalanzaRowIds([])
      if (items.length > 0) {
        const first = items[0]
        const parsedObs = parseBalanzaObs(first.observaciones)
        const fechaObj = new Date(first.fecha + "T00:00:00")
        const normCode = normalizeBalanzaCode(first.codigo_balanza)
        const matchingDef = DEFAULT_BALANZAS.find((b) => b.codigo === normCode) || DEFAULT_BALANZAS[0]
        const defaultMesAnio = fechaObj.toLocaleString("es-PE", { month: "long", year: "numeric" }).toUpperCase()
        const defaultPats = matchingDef.pats.join(", ")
        const defaultCols = matchingDef.pesadas.map((p) => p.label)

        setBalanzaDocHeader({
          codigo_balanza: normCode,
          mes_anio: parsedObs.mes_anio || defaultMesAnio,
          ubicacion: first.ubicacion || matchingDef.ubi,
          codigos_pesas_patron: parsedObs.codigos_pesas_patron || defaultPats,
          capacidad_g: String(first.capacidad_g ?? matchingDef.cap),
          masa_patron_g: String(first.masa_patron_g ?? matchingDef.masa),
          error_max_permitido_g: String(first.error_max_permitido_g ?? matchingDef.tol),
          limpieza_nivelacion: first.limpieza_nivelacion,
          columnas_pesadas:
            parsedObs.columnas_pesadas && Array.isArray(parsedObs.columnas_pesadas) && parsedObs.columnas_pesadas.length > 0
              ? parsedObs.columnas_pesadas
              : defaultCols,
          cerrado: Boolean(parsedObs.cerrado),
          cerrado_por: parsedObs.cerrado_por,
          fecha_cierre: parsedObs.fecha_cierre,
          pin_cierre: parsedObs.pin_cierre,
        })

        // Agrupar pesadas por fecha y verificador en filas horizontales
        const rowMap = new Map<string, BalanzaRow>()

        items.forEach((it) => {
          const rowObs = parseBalanzaObs(it.observaciones)
          const key = `${it.fecha}__${it.verificado_por}`
          if (!rowMap.has(key)) {
            rowMap.set(key, {
              fecha: it.fecha,
              hora: rowObs.hora || "08:00",
              temp_c: rowObs.temp_c || "",
              humedad_pct: rowObs.humedad_pct || "",
              pesadas: [],
              verificado_por: it.verificado_por || "BEATRIZ",
              revisado_por: rowObs.revisado_por || "ING. FABIAN",
            })
          }
          rowMap.get(key)!.pesadas.push({
            id: it.id,
            masa_patron_g: String(it.masa_patron_g),
            lectura_balanza_g: String(it.lectura_balanza_g),
            estado: (it as any).estado || "-",
          })
        })

        const numPesadas = matchingDef.pesadas.length || 6
        const rows = Array.from(rowMap.values()).map((r) => {
          const pesadasDyn = ensurePesadas(r.pesadas, numPesadas)
          const firstObs = items.length > 0 ? parseBalanzaObs(items[0].observaciones) : {}
          if (firstObs.estado_pesadas) {
            pesadasDyn.forEach((p, idx) => {
              if (firstObs.estado_pesadas?.[idx]) {
                p.estado = firstObs.estado_pesadas[idx]
              }
            })
          }
          return { ...r, pesadas: pesadasDyn }
        })

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
      // 1. Eliminar filas descartadas por el usuario en la UI
      if (deletedTempRowIds.length > 0) {
        await Promise.all(
          deletedTempRowIds.map((id) =>
            authFetch(`${API_URL}/api/control-ambiental/temperatura/${id}`, { method: "DELETE" })
          )
        )
        setDeletedTempRowIds([])
      }

      // 2. Guardar o actualizar filas activas
      const promises = tempDocRows.map((row) => {
        const tempVal = parseFloat(row.temperatura_c)
        const humVal = parseFloat(row.humedad_relativa_pct)
        const tempMinVal = parseFloat(row.temp_min)
        const tempMaxVal = parseFloat(row.temp_max) || tempVal

        const obsMeta: TempHeaderMeta = {
          registro: tempDocHeader.registro,
          mes_anio: tempDocHeader.mes_anio,
          aprobado_por: tempDocHeader.aprobado_por,
          fecha_aprobacion: tempDocHeader.fecha_aprobacion,
          revisado_por: row.responsable_revision || "ING. FABIAN",
          hum_min: row.hum_min || "",
          fecha_lectura: row.fecha_lectura || row.fecha_registro,
        }
        const payload = {
          fecha: row.fecha_registro,
          hora_lectura: row.hora_toma,
          area_ambiente: tempDocHeader.area_ambiente,
          temperatura_c: isNaN(tempVal) ? 0.0 : tempVal,
          humedad_relativa_pct: isNaN(humVal) ? 0.0 : humVal,
          temp_min: isNaN(tempMinVal) ? null : tempMinVal,
          temp_max: isNaN(tempMaxVal) ? null : tempMaxVal,
          cumple_especificacion: tempDocHeader.cumple_global,
          responsable_lectura: row.responsable_registro || user.name || "BEATRIZ",
          observaciones: JSON.stringify(obsMeta),
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
      // 1. Eliminar pesadas descartadas en la UI
      if (deletedBalanzaRowIds.length > 0) {
        await Promise.all(
          deletedBalanzaRowIds.map((id) =>
            authFetch(`${API_URL}/api/control-ambiental/balanza/${id}`, { method: "DELETE" })
          )
        )
        setDeletedBalanzaRowIds([])
      }

      // 2. Guardar o actualizar pesadas activas
      const promises: Promise<Response>[] = []

      balanzaDocRows.forEach((row) => {
        const estadoMap: Record<number, string> = {}
        row.pesadas.forEach((p, i) => {
          if (p.estado) estadoMap[i] = p.estado
        })

        row.pesadas.forEach((p) => {
          if (!p.masa_patron_g && !p.lectura_balanza_g) return

          const obsMeta: BalanzaHeaderMeta = {
            mes_anio: balanzaDocHeader.mes_anio,
            codigos_pesas_patron: balanzaDocHeader.codigos_pesas_patron,
            revisado_por: row.revisado_por || "ING. FABIAN",
            hora: row.hora,
            temp_c: row.temp_c,
            humedad_pct: row.humedad_pct,
            estado_pesadas: estadoMap,
            columnas_pesadas: balanzaDocHeader.columnas_pesadas,
            cerrado: balanzaDocHeader.cerrado,
            cerrado_por: balanzaDocHeader.cerrado_por,
            fecha_cierre: balanzaDocHeader.fecha_cierre,
            pin_cierre: balanzaDocHeader.pin_cierre,
          }

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
            observaciones: JSON.stringify(obsMeta),
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

  // ── Handlers para Concluir / Reabrir Mes con PIN ──
  const handleOpenCierreBalanza = (doc: {
    codigo_balanza: string
    mes_anio: string
    items: ControlBalanzaItem[]
    cerrado: boolean
    pin_cierre?: string
  }) => {
    setCierreTargetDoc({
      type: "balanza",
      title: `${doc.codigo_balanza} — ${doc.mes_anio}`,
      items: doc.items,
      isClosing: !doc.cerrado,
      currentPin: doc.pin_cierre,
    })
    setCierrePinInput("")
    setCierrePinError("")
    setCierreModalOpen(true)
  }

  const handleOpenCierreTemp = (doc: {
    area_ambiente: string
    mes_anio: string
    items: ControlTemperaturaItem[]
    cerrado: boolean
    pin_cierre?: string
  }) => {
    setCierreTargetDoc({
      type: "temperatura",
      title: `${doc.area_ambiente} — ${doc.mes_anio}`,
      items: doc.items,
      isClosing: !doc.cerrado,
      currentPin: doc.pin_cierre,
    })
    setCierrePinInput("")
    setCierrePinError("")
    setCierreModalOpen(true)
  }

  const handleConfirmCierre = async () => {
    if (!cierreTargetDoc) return
    const pin = cierrePinInput.trim()
    if (!pin) {
      setCierrePinError("Por favor ingrese una contraseña o PIN")
      return
    }

    if (!cierreTargetDoc.isClosing && cierreTargetDoc.currentPin) {
      if (pin !== cierreTargetDoc.currentPin.trim()) {
        setCierrePinError("Contraseña / PIN incorrecto para desbloquear")
        return
      }
    }

    try {
      if (cierreTargetDoc.type === "balanza") {
        const items = cierreTargetDoc.items as ControlBalanzaItem[]
        const promises = items.map((item) => {
          const obs = parseBalanzaObs(item.observaciones)
          const newObs: BalanzaHeaderMeta = {
            ...obs,
            cerrado: cierreTargetDoc.isClosing,
            cerrado_por: cierreTargetDoc.isClosing ? user.name || "SUPERVISOR" : undefined,
            fecha_cierre: cierreTargetDoc.isClosing ? new Date().toISOString() : undefined,
            pin_cierre: cierreTargetDoc.isClosing ? pin : undefined,
          }
          return authFetch(`${API_URL}/api/control-ambiental/balanza/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...item,
              observaciones: JSON.stringify(newObs),
            }),
          })
        })
        await Promise.all(promises)
        toast.success(
          cierreTargetDoc.isClosing
            ? "Mes concluido y bloqueado exitosamente"
            : "Formato mensual reabierto y desbloqueado"
        )
      } else {
        const items = cierreTargetDoc.items as ControlTemperaturaItem[]
        const promises = items.map((item) => {
          const obs = parseTempObs(item.observaciones)
          const newObs: TempHeaderMeta = {
            ...obs,
            cerrado: cierreTargetDoc.isClosing,
            cerrado_por: cierreTargetDoc.isClosing ? user.name || "SUPERVISOR" : undefined,
            fecha_cierre: cierreTargetDoc.isClosing ? new Date().toISOString() : undefined,
            pin_cierre: cierreTargetDoc.isClosing ? pin : undefined,
          }
          return authFetch(`${API_URL}/api/control-ambiental/temperatura/${item.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...item,
              observaciones: JSON.stringify(newObs),
            }),
          })
        })
        await Promise.all(promises)
        toast.success(
          cierreTargetDoc.isClosing
            ? "Mes concluido y bloqueado exitosamente"
            : "Formato mensual reabierto y desbloqueado"
        )
      }

      if (cierreTargetDoc.type === "balanza" && showBalanzaModal) {
        setBalanzaDocHeader((prev) => ({
          ...prev,
          cerrado: cierreTargetDoc.isClosing,
          cerrado_por: cierreTargetDoc.isClosing ? user.name || "SUPERVISOR" : undefined,
          fecha_cierre: cierreTargetDoc.isClosing ? new Date().toISOString() : undefined,
          pin_cierre: cierreTargetDoc.isClosing ? pin : undefined,
        }))
      }

      setCierreModalOpen(false)
      fetchData()
    } catch {
      toast.error("Error al actualizar el estado del formato")
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
              <SelectTrigger className="w-45 h-8 text-xs bg-white"><SelectValue placeholder="Filtrar por Área" /></SelectTrigger>
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
                    <TableCell className="text-center font-mono text-slate-700 font-medium">
                      {doc.items.length} filas diarias
                    </TableCell>
                    <TableCell className="text-center">
                      {doc.cerrado ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Lock className="h-3 w-3" />
                          CONCLUIDO
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" />
                          EN PROCESO
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${
                            doc.cerrado
                              ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                              : "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                          }`}
                          onClick={() => handleOpenCierreTemp(doc)}
                          title={doc.cerrado ? "Reabrir mes (Ingresar PIN)" : "Concluir mes y bloquear"}
                        >
                          {doc.cerrado ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                          onClick={() => handleExportTempExcel(doc.area_ambiente)}
                          title="Exportar formato oficial Excel (F-LEM-P-05.01 V03)"
                        >
                          <Download className="h-4 w-4" />
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
                  <span className="min-w-22.5 text-center font-medium px-2">
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

        {/* Modal Cierre / PIN de Seguridad */}
        {renderCierreModal()}

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
            <SelectTrigger className="w-45 h-8 text-xs bg-white"><SelectValue placeholder="Filtrar por Balanza" /></SelectTrigger>
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
                  <TableCell className="text-center font-mono text-slate-700 font-medium">
                    {doc.items.length} verificaciones
                  </TableCell>
                  <TableCell className="text-center">
                    {doc.cerrado ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Lock className="h-3 w-3" />
                        CONCLUIDO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="h-3 w-3" />
                        EN PROCESO
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${
                          doc.cerrado
                            ? "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                            : "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                        }`}
                        onClick={() => handleOpenCierreBalanza(doc)}
                        title={doc.cerrado ? "Reabrir mes (Ingresar PIN)" : "Concluir mes y bloquear"}
                      >
                        {doc.cerrado ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                        onClick={() => handleExportBalanzaExcel(doc.codigo_balanza)}
                        title="Exportar formato oficial Excel (F-LEM-IN-01.02 V03)"
                      >
                        <Download className="h-4 w-4" />
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
                <span className="min-w-22.5 text-center font-medium px-2">
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

      {/* Modal Cierre / PIN de Seguridad */}
      {renderCierreModal()}

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
        <DialogContent className="max-w-[99vw] md:max-w-[96vw] w-[99vw] h-[98vh] max-h-[98vh] p-2 sm:p-3 md:p-4 bg-[#f1f5f9] overflow-hidden rounded-xl border-none shadow-2xl flex flex-col [&>button]:hidden">
          <form onSubmit={handleSaveTempDoc} className="flex flex-col h-full overflow-hidden space-y-2">
            {/* Header Barra Superior Nativa */}
            <div className="flex items-center justify-between gap-3 mb-1 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                  <Thermometer className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                    CONTROL DE TEMPERATURA Y HUMEDAD RELATIVA — F-LEM-P-05.01 V03
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">Módulo nativo del CRM</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => executeWithSafetyCheck(() => setShowTempModal(false))}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none"
                title="Cerrar Formulario"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Hoja de Excel Blanca Central */}
            <div className="w-full max-w-[99vw] mx-auto overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs flex flex-col flex-1 min-h-0">
              {/* Bloque Encabezado Oficial con Logo y Título Centrado */}
              <div className="border-b border-slate-300 bg-slate-50 p-3 text-center shrink-0">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <Image src="/logo-geofal.svg" alt="Geofal Logo" width={110} height={32} className="h-7 w-auto" />
                </div>
                <p className="text-base sm:text-lg font-bold leading-tight text-slate-900 font-sans">
                  LABORATORIO DE ENSAYO DE MATERIALES
                </p>
                <p className="text-xs sm:text-sm font-bold text-slate-800 underline uppercase mt-0.5">
                  F-LEM-P-05.01 V03 CONTROL DE TEMPERATURA Y HUMEDAD RELATIVA
                </p>
              </div>

              {/* Tabla Encabezado Metadatos Superior */}
              <div className="border-b border-slate-300 bg-white p-2 shrink-0 overflow-x-auto">
                <table className="w-full min-w-162.5 table-fixed border border-slate-300 text-xs">
                  <thead className="bg-slate-100 text-[11px] font-semibold text-slate-800">
                    <tr>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>REGISTRO</th>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>MES - AÑO</th>
                      <th className="border-r border-slate-300 py-1" colSpan={2}>APROBADO POR</th>
                      <th className="py-1" colSpan={2}>FECHA APROBACIÓN</th>
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
              <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold text-slate-800 shrink-0">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="shrink-0">ÁREA DE CONTROL:</span>
                  <Select
                    value={tempDocHeader.area_ambiente}
                    onValueChange={(val) => {
                      setTempDocHeader((p) => ({ ...p, area_ambiente: val }))
                      setTempIsDirty(true)
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-semibold bg-white border-slate-300 w-full sm:w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEFAULT_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span>PARÁMETROS NORMATIVOS:</span>
                  <span className="bg-white border border-slate-300 px-3 py-1 rounded font-bold text-sky-700">
                    {tempDocHeader.area_ambiente.toLowerCase().includes("compactac")
                      ? "18 °C – 24 °C | < 80 % H.R."
                      : "10 °C – 30 °C | < 80 % H.R."}
                  </span>
                </div>
              </div>

              {/* Tabla Principal de Lecturas con Scroll Responsive */}
              <div className="p-2 sm:p-3 overflow-x-auto overflow-y-auto flex-1 min-h-0">
                <table className="w-full min-w-240 table-fixed border border-slate-300 text-xs">
                  <thead className="bg-slate-100 text-xs font-semibold text-slate-800 sticky top-0 z-10">
                    <tr>
                      <th className="border-r border-b border-slate-300 py-2 w-28 text-center bg-slate-100">FECHA REGISTRO</th>
                      <th className="border-r border-b border-slate-300 py-2 w-20 text-center bg-slate-100">HORA TOMA</th>
                      <th className="border-r border-b border-slate-300 py-2 w-28 text-center bg-slate-100">FECHA LECTURA</th>
                      <th className="border-r border-b border-slate-300 py-1 bg-slate-100" colSpan={2}>
                        TEMPERATURA (°C)
                        <div className="grid grid-cols-2 border-t border-slate-300 mt-1 text-[10px]">
                          <div className="border-r border-slate-300 py-0.5">Mínimo</div>
                          <div className="py-0.5">Máximo / Actual</div>
                        </div>
                      </th>
                      <th className="border-r border-b border-slate-300 py-1 bg-slate-100" colSpan={2}>
                        HUMEDAD RELATIVA (%)
                        <div className="grid grid-cols-2 border-t border-slate-300 mt-1 text-[10px]">
                          <div className="border-r border-slate-300 py-0.5">Mínimo</div>
                          <div className="py-0.5">Máximo / Actual</div>
                        </div>
                      </th>
                      <th className="border-r border-b border-slate-300 py-2 w-24 text-center bg-slate-100">ESTADO</th>
                      <th className="border-r border-b border-slate-300 py-2 w-32 text-center bg-slate-100">REGISTRADO POR</th>
                      <th className="border-r border-b border-slate-300 py-2 w-32 text-center bg-slate-100">REVISADO POR</th>
                      <th className="border-b border-slate-300 py-2 w-12 text-center bg-slate-100">ACCION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tempDocRows.map((row, idx) => {
                      const evalRes = evaluateTempHumRow(row, tempDocHeader.area_ambiente)

                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
                              className={`${denseInputClass} ${evalRes.isTempRangeInvalid ? "bg-red-50 text-red-700 border-red-400 font-bold" : ""}`}
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
                              className={`${denseInputClass} font-bold ${
                                evalRes.isTempOut || evalRes.isTempRangeInvalid
                                  ? "bg-red-50 text-red-700 border-red-400 focus:ring-red-500 font-extrabold"
                                  : "text-sky-700"
                              }`}
                              value={row.temperatura_c}
                              onChange={(e) => {
                                const val = e.target.value
                                setTempDocRows((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, temperatura_c: val, temp_max: val } : r))
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
                              className={`${denseInputClass} ${evalRes.isHumRangeInvalid ? "bg-red-50 text-red-700 border-red-400 font-bold" : ""}`}
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
                              className={`${denseInputClass} font-bold ${
                                evalRes.isHumOut || evalRes.isHumRangeInvalid
                                  ? "bg-red-50 text-red-700 border-red-400 focus:ring-red-500 font-extrabold"
                                  : "text-blue-700"
                              }`}
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
                          <td className="border-t border-r border-slate-300 p-1 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold font-mono border ${
                                evalRes.cumple
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-100 text-red-800 border-red-300 animate-pulse"
                              }`}
                              title={
                                evalRes.cumple
                                  ? "Lecturas dentro del rango de especificación"
                                  : `Fuera de límites (${evalRes.tempLimitsMsg} / ${evalRes.humLimitsMsg})`
                              }
                            >
                              {evalRes.cumple ? "CONFORME" : "NO CUMPLE"}
                            </span>
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
                                const targetId = tempDocRows[idx]?.id
                                if (targetId) {
                                  setDeletedTempRowIds((ids) => [...ids, targetId])
                                }
                                setTempDocRows((rows) => rows.filter((_, i) => i !== idx))
                                setTempIsDirty(true)
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

              {/* Botón de Agregar Fila */}
              <div className="p-2 sm:p-3 bg-slate-50 border-t border-slate-300 flex justify-between items-center shrink-0">
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

            {/* Footer Botones Guardar y Cancelar Responsive */}
            <div className="pt-1.5 flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-3 border-t border-slate-300 shrink-0">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs font-semibold bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-2 w-full sm:w-auto"
                onClick={() => handleExportTempExcel(tempDocHeader.area_ambiente)}
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowTempModal(false))}
                className="h-8 text-xs font-semibold bg-white border-slate-300 px-5 w-full sm:w-auto"
              >
                Cerrar
              </Button>
              <Button
                type="submit"
                className="h-8 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white px-6 flex items-center justify-center gap-1.5 w-full sm:w-auto"
              >
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
    const isLocked = Boolean(balanzaDocHeader.cerrado)

    return (
      <Dialog
        open={showBalanzaModal}
        onOpenChange={(o) => {
          if (!o) executeWithSafetyCheck(() => setShowBalanzaModal(false))
          else setShowBalanzaModal(true)
        }}
      >
        <DialogContent className="max-w-[99vw] md:max-w-[96vw] w-[99vw] h-[98vh] max-h-[98vh] p-2 sm:p-3 md:p-4 bg-[#f1f5f9] overflow-hidden rounded-xl border-none shadow-2xl flex flex-col [&>button]:hidden">
          <form onSubmit={handleSaveBalanzaDoc} className="flex flex-col h-full overflow-hidden space-y-2">
            {/* Header Barra Superior Nativa */}
            <div className="flex items-center justify-between gap-3 shrink-0 px-1">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  isLocked
                    ? "bg-amber-50 border-amber-200 text-amber-600"
                    : "bg-indigo-50 border-indigo-100 text-indigo-600"
                }`}>
                  {isLocked ? <Lock className="h-5 w-5" /> : <Scale className="h-5 w-5" />}
                </div>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-none">
                    FORMATO DE VERIFICACIÓN DIARIA DE BALANZAS — F-LEM-IN-01.02 V03
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isLocked ? "Mes Concluido — Modo Solo Lectura" : "Módulo nativo del CRM"}
                  </p>
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

            {/* Banner de Bloqueo / Solo Lectura si está Cerrado */}
            {isLocked && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 text-xs text-amber-900 font-medium">
                  <Lock className="h-4 w-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>FORMATO MENSUAL CONCLUIDO Y BLOQUEADO</strong> (Solo Lectura) — Concluido por <strong>{balanzaDocHeader.cerrado_por || "SUPERVISOR"}</strong>
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCierreTargetDoc({
                      type: "balanza",
                      title: `${balanzaDocHeader.codigo_balanza} — ${balanzaDocHeader.mes_anio}`,
                      items: balanzaList.filter((b) => normalizeBalanzaCode(b.codigo_balanza) === normalizeBalanzaCode(balanzaDocHeader.codigo_balanza)),
                      isClosing: false,
                      currentPin: balanzaDocHeader.pin_cierre,
                    })
                    setCierrePinInput("")
                    setCierrePinError("")
                    setCierreModalOpen(true)
                  }}
                  className="h-7 text-xs font-semibold gap-1.5 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shadow-2xs"
                >
                  <Unlock className="h-3.5 w-3.5 text-amber-700" />
                  Desbloquear / Reabrir Mes
                </Button>
              </div>
            )}

            {/* Hoja de Excel Blanca Central */}
            <div className="w-full max-w-[99vw] mx-auto overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xs flex flex-col flex-1 min-h-0">
              {/* Bloque Encabezado Oficial Estilo Hoja Excel 3 Columnas */}
              <div className="border-b border-slate-300 bg-white p-2 shrink-0">
                <div className="grid grid-cols-12 border border-slate-300 items-center">
                  <div className="col-span-12 sm:col-span-3 border-b sm:border-b-0 sm:border-r border-slate-300 p-1.5 flex items-center justify-center bg-slate-50 min-h-14">
                    <Image src="/logo-geofal.svg" alt="Geofal Logo" width={110} height={32} className="h-7 w-auto" />
                  </div>
                  <div className="col-span-12 sm:col-span-6 border-b sm:border-b-0 sm:border-r border-slate-300 p-1.5 text-center bg-slate-50 min-h-14 flex flex-col justify-center">
                    <p className="text-sm sm:text-base font-bold leading-tight text-slate-900 uppercase">
                      FORMATO DE VERIFICACIÓN DIARIA DE BALANZAS
                    </p>
                    <p className="text-[11px] font-semibold text-slate-600 uppercase mt-0.5">
                      NORMA NTP / ASTM — F-LEM-IN-01.02 V03
                    </p>
                  </div>
                  <div className="col-span-12 sm:col-span-3 text-[10px] font-mono text-slate-800 bg-slate-50 min-h-14 flex flex-col justify-center">
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

              {/* Tabla Encabezado Metadatos Superior */}
              <div className="border-b border-slate-300 bg-white p-2 shrink-0 overflow-x-auto">
                <table className="w-full min-w-175 table-fixed border border-slate-300 text-xs">
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
                          disabled={isLocked}
                          onChange={(e) => {
                            const val = e.target.value
                            const found = DEFAULT_BALANZAS.find((b) => b.codigo === val)
                            const defCols = found?.pesadas.map((p) => p.label) || []
                            const defPats = found?.pats.join(", ") || ""
                            setBalanzaDocHeader((p) => ({
                              ...p,
                              codigo_balanza: val,
                              ubicacion: found?.ubi || p.ubicacion,
                              codigos_pesas_patron: defPats,
                              capacidad_g: found ? String(found.cap) : p.capacidad_g,
                              masa_patron_g: found ? String(found.masa) : p.masa_patron_g,
                              error_max_permitido_g: found ? String(found.tol) : p.error_max_permitido_g,
                              columnas_pesadas: defCols,
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
                          disabled={isLocked}
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
                          disabled={isLocked}
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
                        <select
                          className={`${denseInputClass} font-semibold text-xs bg-white border-slate-300 cursor-pointer w-full text-ellipsis overflow-hidden`}
                          value={balanzaDocHeader.codigos_pesas_patron}
                          disabled={isLocked}
                          onChange={(e) => {
                            setBalanzaDocHeader((p) => ({ ...p, codigos_pesas_patron: e.target.value }))
                            setBalanzaIsDirty(true)
                          }}
                        >
                          {currentBalanzaDef?.pats && currentBalanzaDef.pats.length > 0 && (
                            <option value={currentBalanzaDef.pats.join(", ")}>
                              {currentBalanzaDef.pats.join(", ")}
                            </option>
                          )}
                          {DEFAULT_BALANZAS.filter((b) => b.codigo !== currentBalanzaDef?.codigo).map((b) => (
                            <option key={b.codigo} value={b.pats.join(", ")}>
                              {b.pats.join(", ")} ({b.codigo})
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ÚNICO CONTENEDOR CON SCROLL: Tabla Principal de Casillas Grid Dinámico de Pesadas */}
              {(() => {
                const numPesadas = currentBalanzaDef?.pesadas.length || 6
                const totalTableWidth = 130 + 95 + 95 + 115 + numPesadas * 230 + 145 + 145 + 60

                return (
                  <div className="p-2 overflow-x-auto overflow-y-auto flex-1 min-h-0 max-w-full">
                    <table
                      className="border-collapse border border-slate-300 text-xs table-fixed"
                      style={{ width: `${totalTableWidth}px`, minWidth: "100%" }}
                    >
                      <colgroup>
                        <col style={{ width: "130px" }} />
                        <col style={{ width: "95px" }} />
                        <col style={{ width: "95px" }} />
                        <col style={{ width: "115px" }} />
                        {currentBalanzaDef?.pesadas.map((_, i) => (
                          <col key={i} style={{ width: "230px" }} />
                        ))}
                        <col style={{ width: "145px" }} />
                        <col style={{ width: "145px" }} />
                        <col style={{ width: "60px" }} />
                      </colgroup>
                      <thead className="bg-slate-100 text-xs font-semibold text-slate-800 sticky top-0 z-30 shadow-[0_1px_0_0_#cbd5e1]">
                        <tr>
                          <th className="border-r border-b border-slate-300 py-2 text-center bg-slate-100" rowSpan={2}>FECHA</th>
                          <th className="border-r border-b border-slate-300 py-2 text-center bg-slate-100" rowSpan={2}>HORA</th>
                          <th className="border-r border-b border-slate-300 py-2 text-center bg-slate-100" rowSpan={2}>TEMP (°C)</th>
                          <th className="border-r border-b border-slate-300 py-2 text-center bg-slate-100" rowSpan={2}>HUMEDAD (%H.R.)</th>
                          <th className="border-r border-b border-emerald-300 py-1.5 text-center font-bold bg-emerald-100 text-emerald-900 uppercase tracking-wide" colSpan={numPesadas}>
                            PESA PATRÓN USADO (g) - ANOTAR LAS LECTURAS DE LA BALANZA
                          </th>
                          <th className="border-r border-b border-slate-300 py-2 text-center bg-slate-100" rowSpan={2}>REALIZADO POR</th>
                          <th className="border-r border-b border-slate-300 py-2 text-center bg-slate-100" rowSpan={2}>REVISADO POR</th>
                          <th className="border-b border-slate-300 py-2 text-center bg-slate-100" rowSpan={2}>ACCIÓN</th>
                        </tr>
                        <tr>
                          {currentBalanzaDef?.pesadas.map((pesadaObj, i) => {
                            const colPesadaLabel = balanzaDocHeader.columnas_pesadas?.[i] || pesadaObj.label
                            return (
                              <th key={i} className="border-r border-b border-slate-300 py-1.5 px-2 text-center font-bold text-slate-700 bg-slate-100">
                                <div className="flex flex-col gap-1 items-center justify-center">
                                  <select
                                    className="h-7 w-full text-xs font-bold bg-white border border-slate-300 rounded px-1.5 text-slate-800 cursor-pointer shadow-2xs focus:ring-1 focus:ring-sky-500"
                                    value={colPesadaLabel}
                                    disabled={isLocked}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      setBalanzaDocHeader((p) => {
                                        const updated = [...(p.columnas_pesadas || [])]
                                        updated[i] = val
                                        return { ...p, columnas_pesadas: updated }
                                      })
                                      setBalanzaIsDirty(true)
                                    }}
                                  >
                                    {currentBalanzaDef.pesadas.map((pes) => (
                                      <option key={pes.label} value={pes.label}>
                                        {pes.label}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="text-[10px] text-slate-500 font-semibold tracking-wider">OK / NO</span>
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {balanzaDocRows.map((row, idx) => {
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="border-t border-r border-slate-300 p-1.5 bg-white">
                                <input
                                  type="date"
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-1.5 text-xs text-slate-800 font-medium shadow-2xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                  value={row.fecha}
                                  disabled={isLocked}
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
                              <td className="border-t border-r border-slate-300 p-1.5 bg-white">
                                <input
                                  type="time"
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-1 text-center text-xs text-slate-800 font-medium shadow-2xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                  value={row.hora}
                                  disabled={isLocked}
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
                              <td className="border-t border-r border-slate-300 p-1.5 bg-white">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="23.0"
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-1.5 text-center font-mono font-bold text-xs text-slate-800 shadow-2xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                  value={row.temp_c}
                                  disabled={isLocked}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setBalanzaDocRows((rows) =>
                                      rows.map((r, i) => (i === idx ? { ...r, temp_c: val } : r))
                                    )
                                    setBalanzaIsDirty(true)
                                  }}
                                />
                              </td>
                              <td className="border-t border-r border-slate-300 p-1.5 bg-white">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="50.0"
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-1.5 text-center font-mono font-bold text-xs text-slate-800 shadow-2xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                  value={row.humedad_pct}
                                  disabled={isLocked}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setBalanzaDocRows((rows) =>
                                      rows.map((r, i) => (i === idx ? { ...r, humedad_pct: val } : r))
                                    )
                                    setBalanzaIsDirty(true)
                                  }}
                                />
                              </td>

                              {/* Casillas Horizontales Exactas por Equipo dentro de cada cuadro sin desbordamiento */}
                              {ensurePesadas(row.pesadas, numPesadas).map((p, pIdx) => {
                                const colPesadaLabel = balanzaDocHeader.columnas_pesadas?.[pIdx] || currentBalanzaDef?.pesadas[pIdx]?.label || ""
                                const pesadaObj = currentBalanzaDef?.pesadas.find((pes) => pes.label === colPesadaLabel) || currentBalanzaDef?.pesadas[pIdx]
                                const valText = p.lectura_balanza_g || p.masa_patron_g || ""
                                const estText = p.estado || "-"

                                return (
                                  <td key={pIdx} className="border-t border-r border-slate-300 p-1.5 bg-white text-center">
                                    <div className="flex items-center gap-1.5 w-full">
                                      <div className="relative flex-1 min-w-0">
                                        <input
                                          type="text"
                                          list={`datalist-p-${idx}-${pIdx}`}
                                          placeholder={pesadaObj ? `${pesadaObj.nominal}` : "Dato"}
                                          className={`h-8 w-full rounded border border-slate-300 bg-white px-2 text-center font-mono font-bold text-xs shadow-2xs outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 ${
                                            estText === "NO" ? "border-red-400 bg-red-50 text-red-800" : "text-slate-800"
                                          }`}
                                          value={valText}
                                          disabled={isLocked}
                                          onChange={(e) => {
                                            const val = e.target.value
                                            setBalanzaDocRows((rows) =>
                                              rows.map((r, i) =>
                                                i === idx
                                                  ? {
                                                      ...r,
                                                      pesadas: ensurePesadas(r.pesadas, numPesadas).map((pes, pi) =>
                                                        pi === pIdx
                                                          ? {
                                                              ...pes,
                                                              lectura_balanza_g: val,
                                                              masa_patron_g: val,
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
                                        {pesadaObj && (
                                          <datalist id={`datalist-p-${idx}-${pIdx}`}>
                                            <option value={String(pesadaObj.nominal)}>{pesadaObj.nominal} (Nominal)</option>
                                            <option value={String(pesadaObj.variacion)}>{pesadaObj.variacion} (Variación)</option>
                                          </datalist>
                                        )}
                                      </div>
                                      <select
                                        className={`h-8 w-16 shrink-0 rounded border text-center text-xs font-extrabold cursor-pointer shadow-2xs outline-none transition ${
                                          estText === "NO"
                                            ? "bg-red-100 text-red-800 border-red-300"
                                            : estText === "OK"
                                            ? "bg-blue-100 text-blue-800 border-blue-300"
                                            : "bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100"
                                        }`}
                                        value={estText}
                                        disabled={isLocked}
                                        onChange={(e) => {
                                          const val = e.target.value
                                          setBalanzaDocRows((rows) =>
                                            rows.map((r, i) =>
                                              i === idx
                                                ? {
                                                    ...r,
                                                    pesadas: ensurePesadas(r.pesadas, numPesadas).map((pes, pi) =>
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

                              <td className="border-t border-r border-slate-300 p-1.5 bg-white">
                                <select
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-center text-xs font-bold text-slate-800 cursor-pointer shadow-2xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                  value={row.verificado_por}
                                  disabled={isLocked}
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
                              <td className="border-t border-r border-slate-300 p-1.5 bg-white">
                                <select
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-center text-xs font-bold text-slate-800 cursor-pointer shadow-2xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                  value={row.revisado_por}
                                  disabled={isLocked}
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
                              <td className="border-t border-slate-300 p-1.5 bg-white text-center">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={isLocked}
                                  onClick={() => {
                                    if (balanzaDocRows.length === 1) {
                                      toast.error("El formato debe tener al menos una fila")
                                      return
                                    }
                                    const rowToDelete = balanzaDocRows[idx]
                                    if (rowToDelete && rowToDelete.pesadas) {
                                      const idsToDelete = rowToDelete.pesadas
                                        .map((p) => p.id)
                                        .filter((id): id is number => typeof id === "number")
                                      if (idsToDelete.length > 0) {
                                        setDeletedBalanzaRowIds((prev) => [...prev, ...idsToDelete])
                                      }
                                    }
                                    setBalanzaDocRows((rows) => rows.filter((_, i) => i !== idx))
                                    setBalanzaIsDirty(true)
                                  }}
                                  className="h-7 w-7 p-0 mx-auto flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                                  title="Eliminar fila"
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
                )
              })()}

              {/* Botón de Agregar Fila */}
              <div className="p-2 bg-slate-50 border-t border-slate-300 flex justify-between items-center shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isLocked}
                  onClick={() => {
                    const last = balanzaDocRows[balanzaDocRows.length - 1]
                    const numPesadas = currentBalanzaDef?.pesadas.length || 6
                    setBalanzaDocRows((rows) => [
                      ...rows,
                      {
                        fecha: last ? last.fecha : new Date().toISOString().split("T")[0],
                        hora: "08:00",
                        temp_c: "23.0",
                        humedad_pct: "50.0",
                        pesadas: ensurePesadas([], numPesadas),
                        verificado_por: last ? last.verificado_por : "BEATRIZ",
                        revisado_por: last ? last.revisado_por : "ING. FABIAN",
                      },
                    ])
                    setBalanzaIsDirty(true)
                  }}
                  className="gap-2 h-7 text-xs font-semibold bg-white border-slate-300 disabled:opacity-40"
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
                    disabled={isLocked}
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
                    } ${isLocked ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    {val ? "CONFORME (OK)" : "NO CONFORME"}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer Botones Guardar y Cancelar Responsive */}
            <div className="pt-1.5 flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-3 border-t border-slate-300 shrink-0">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs font-semibold bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50 gap-2 w-full sm:w-auto"
                onClick={() => handleExportBalanzaExcel(balanzaDocHeader.codigo_balanza)}
              >
                <Download className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => executeWithSafetyCheck(() => setShowBalanzaModal(false))}
                className="h-8 text-xs font-semibold bg-white border-slate-300 px-5 w-full sm:w-auto"
              >
                Cerrar
              </Button>
              <Button
                type="submit"
                disabled={isLocked}
                className={`h-8 text-xs font-bold px-6 flex items-center justify-center gap-1.5 w-full sm:w-auto ${
                  isLocked
                    ? "bg-slate-400 text-white cursor-not-allowed"
                    : "bg-sky-600 hover:bg-sky-700 text-white"
                }`}
              >
                {isLocked ? (
                  <>
                    <Lock className="h-4 w-4" />
                    Formato Concluido (Solo Lectura)
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar Formato F-LEM-IN-01.02
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODAL DE CIERRE / DESBLOQUEO MENSUAL CON PIN DE SEGURIDAD
  // ─────────────────────────────────────────────────────────────────────────────
  function renderCierreModal() {
    return (
      <Dialog open={cierreModalOpen} onOpenChange={setCierreModalOpen}>
        <DialogContent className="max-w-md p-6 bg-white rounded-xl shadow-2xl border border-slate-200">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                cierreTargetDoc?.isClosing ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
              }`}>
                {cierreTargetDoc?.isClosing ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {cierreTargetDoc?.isClosing ? "Concluir y Bloquear Mes" : "Reabrir Formato Mensual"}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  {cierreTargetDoc?.title}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
              {cierreTargetDoc?.isClosing ? (
                <>
                  Al concluir el mes, el formato quedará en <strong>Modo Solo Lectura</strong> para proteger las lecturas de modificaciones no autorizadas. Ingrese una <strong>contraseña o PIN de seguridad</strong> para bloquearlo.
                </>
              ) : (
                <>
                  Este formato está concluido. Ingrese el <strong>PIN / Contraseña de seguridad</strong> configurado al concluir el mes para desbloquearlo y habilitar su edición.
                </>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {cierreTargetDoc?.isClosing ? "Establecer PIN / Contraseña de Cierre:" : "Ingresar PIN / Contraseña de Desbloqueo:"}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  type="password"
                  autoFocus
                  placeholder="Ej. 1234 o clave de laboratorio"
                  value={cierrePinInput}
                  onChange={(e) => {
                    setCierrePinInput(e.target.value)
                    setCierrePinError("")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleConfirmCierre()
                    }
                  }}
                  className="pl-9 text-sm font-mono"
                />
              </div>
              {cierrePinError && (
                <p className="text-xs font-semibold text-red-600 animate-in fade-in">
                  {cierrePinError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCierreModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmCierre}
                className={`text-xs font-semibold gap-1.5 ${
                  cierreTargetDoc?.isClosing
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-sky-600 hover:bg-sky-700 text-white"
                }`}
              >
                {cierreTargetDoc?.isClosing ? (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Concluir y Bloquear
                  </>
                ) : (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    Desbloquear Formato
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
}
