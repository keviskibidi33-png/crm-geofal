"use client"

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Beaker, Download, Loader2, Trash2, X } from "lucide-react"
import { authFetch } from "@/lib/api-auth"
import FormatConfirmModal from "./FormatConfirmModal"

// --- Types ---
export type CdHumedadPunto = {
  recipiente_numero?: string
  peso_recipiente_g?: number | null
  peso_recipiente_suelo_humedo_g?: number | null
  peso_recipiente_suelo_seco_g?: number | null
  peso_agua_g?: number | null
  peso_suelo_g?: number | null
  contenido_humedad_pct?: number | null
}

export type CdPayload = {
  muestra: string
  numero_ot: string
  fecha_ensayo: string
  peso_kg?: Array<number | null>
  esf_normal?: Array<number | null>
  carga_kg_1?: Array<number | null>
  carga_kg_2?: Array<number | null>
  carga_kg_3?: Array<number | null>
  def_horizontal?: number[]
  humedad_puntos?: CdHumedadPunto[]
  recipiente_numero?: string
  peso_recipiente_g?: number | null
  peso_recipiente_suelo_humedo_g?: number | null
  peso_recipiente_suelo_seco_g?: number | null
  peso_agua_g?: number | null
  peso_suelo_g?: number | null
  contenido_humedad_pct?: number | null
  hora_1?: string[]
  deform_1?: Array<number | null>
  hora_2?: string[]
  deform_2?: Array<number | null>
  hora_3?: string[]
  deform_3?: Array<number | null>
  realizado_por?: string
  revisado_por?: string
  aprobado_por?: string
  [key: string]: unknown
}

export type EnsayoDetail = {
  id: number
  numero_ensayo?: string | null
  numero_ot?: string | null
  cliente?: string | null
  muestra?: string | null
  fecha_documento?: string | null
  estado?: string | null
  payload?: CdPayload | null
}

export type SaveResponse = {
  id: number
  numero_ensayo: string
  numero_ot: string
  estado: string
}

// --- Constants ---
const MODULE_TITLE = "Corte Directo"
const DRAFT_KEY = "cd_form_draft_v2"
const DEBOUNCE_MS = 700
const DEF_VALUES = [
  0, 3, 6, 12, 18, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300, 360, 420, 480, 540, 600, 660, 720,
] as const
const REVISORES = ["-", "FABIAN LA ROSA"] as const
const APROBADORES = ["-", "IRMA COAQUIRA"] as const
const HORA_ROWS = Array.from({ length: 5 }, (_, i) => i)
const HUMEDAD_POINT_COUNT = 3

type TableFieldElement = HTMLInputElement | HTMLSelectElement
type TableNavigationGroup = "cargas" | "humedad" | "hora"

const getTableFieldKey = (table: TableNavigationGroup, row: number, col: number) => `${table}:${row}:${col}`

type HumedadPointForm = {
  recipiente_numero: string
  peso_recipiente_g: number | null
  peso_recipiente_suelo_humedo_g: number | null
  peso_recipiente_suelo_seco_g: number | null
  peso_agua_g: number | null
  peso_suelo_g: number | null
  contenido_humedad_pct: number | null
}

const createEmptyHumedadPoint = (): HumedadPointForm => ({
  recipiente_numero: "",
  peso_recipiente_g: null,
  peso_recipiente_suelo_humedo_g: null,
  peso_recipiente_suelo_seco_g: null,
  peso_agua_g: null,
  peso_suelo_g: null,
  contenido_humedad_pct: null,
})

const hasHumedadData = (point: Partial<HumedadPointForm> | undefined): boolean => {
  if (!point) return false
  return [
    point.recipiente_numero?.trim(),
    point.peso_recipiente_g,
    point.peso_recipiente_suelo_humedo_g,
    point.peso_recipiente_suelo_seco_g,
    point.peso_agua_g,
    point.peso_suelo_g,
    point.contenido_humedad_pct,
  ].some((value) => value !== null && value !== undefined && value !== "")
}

const toHumedadPointForm = (point?: CdHumedadPunto | null): HumedadPointForm => ({
  recipiente_numero: point?.recipiente_numero ?? "",
  peso_recipiente_g: point?.peso_recipiente_g ?? null,
  peso_recipiente_suelo_humedo_g: point?.peso_recipiente_suelo_humedo_g ?? null,
  peso_recipiente_suelo_seco_g: point?.peso_recipiente_suelo_seco_g ?? null,
  peso_agua_g: point?.peso_agua_g ?? null,
  peso_suelo_g: point?.peso_suelo_g ?? null,
  contenido_humedad_pct: point?.contenido_humedad_pct ?? null,
})

const normalizeHumedadPoints = (points?: CdHumedadPunto[]): HumedadPointForm[] => {
  const normalized = Array.from({ length: HUMEDAD_POINT_COUNT }, (_, idx) => toHumedadPointForm(points?.[idx]))
  return normalized
}

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestraCode = (raw: string): string => {
  const value = raw.trim().toUpperCase()
  if (!value) return ""
  const compact = value.replace(/\s+/g, "")
  const year = getCurrentYearShort()
  const match = compact.match(/^(\d+)(?:-[A-Z]+)?(?:-(\d{2}))?$/)
  return match ? `${match[1]}-${match[2] || year}` : value
}

const normalizeNumeroOtCode = (raw: string): string => {
  const value = raw.trim().toUpperCase()
  if (!value) return ""
  const compact = value.replace(/\s+/g, "")
  const year = getCurrentYearShort()
  const patterns = [/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/, /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/]
  for (const pattern of patterns) {
    const match = compact.match(pattern)
    if (match) return `${match[1]}-${match[2] || year}`
  }
  return value
}

const normalizeFlexibleDate = (raw: string): string => {
  const value = raw.trim()
  if (!value) return ""
  const digits = value.replace(/\D/g, "")
  const currentYear = String(new Date().getFullYear())
  const pad2 = (part: string) => part.padStart(2, "0").slice(-2)
  const normalizeYear = (part: string) => {
    const clean = part.replace(/\D/g, "")
    if (clean.length >= 4) return clean.slice(0, 4)
    if (clean.length === 2) return `20${clean}`
    if (clean.length === 1) return `200${clean}`
    return currentYear
  }
  const build = (y: string, m: string, d: string) => `${normalizeYear(y)}/${pad2(m)}/${pad2(d)}`

  if (value.includes("/") || value.includes("-")) {
    const [a = "", b = "", c = ""] = value.split(/[/-]/).map((part) => part.trim())
    if (!a || !b) return value
    if (a.length === 4) return build(a, b, c || "01")
    if (c) return build(c, b, a)
    return value
  }

  if (digits.length === 8) {
    if (digits.startsWith("19") || digits.startsWith("20")) return build(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8))
    return build(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2))
  }
  if (digits.length === 6) return build(digits.slice(4, 6), digits.slice(2, 4), digits.slice(0, 2))
  if (digits.length === 5) return build(digits.slice(3, 5), digits.slice(1, 3), digits[0])
  if (digits.length === 4) return build(currentYear, digits.slice(0, 2), digits.slice(2, 4))
  if (digits.length === 3) return build(currentYear, digits[0], digits.slice(1, 3))
  if (digits.length === 2) return build(currentYear, digits[0], digits[1])

  return value
}

const parseNum = (value: string) => {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const round = (value: number, decimals = 4) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const resolveHumedadPoint = (point: HumedadPointForm): HumedadPointForm => {
  const pesoAgua =
    point.peso_recipiente_suelo_humedo_g != null && point.peso_recipiente_suelo_seco_g != null
      ? round(point.peso_recipiente_suelo_humedo_g - point.peso_recipiente_suelo_seco_g)
      : point.peso_agua_g ?? null

  const pesoSuelo =
    point.peso_recipiente_suelo_seco_g != null && point.peso_recipiente_g != null
      ? round(point.peso_recipiente_suelo_seco_g - point.peso_recipiente_g)
      : point.peso_suelo_g ?? null

  const contenidoHumedad =
    pesoAgua != null && pesoSuelo != null && pesoSuelo !== 0
      ? round((pesoAgua / pesoSuelo) * 100, 3)
      : point.contenido_humedad_pct ?? null

  return {
    ...point,
    peso_agua_g: pesoAgua,
    peso_suelo_g: pesoSuelo,
    contenido_humedad_pct: contenidoHumedad,
  }
}

const HUMEDAD_ROWS: Array<{
  key: string
  label: string
  unit: string
  field: keyof HumedadPointForm
  type: "text" | "number"
  readOnly?: boolean
}> = [
  { key: "1", label: "N° del recipiente", unit: "", field: "recipiente_numero", type: "text" },
  { key: "2", label: "Peso del recipiente", unit: "(g)", field: "peso_recipiente_g", type: "number" },
  {
    key: "3",
    label: "peso del recipiente + Suelo humedo",
    unit: "(g)",
    field: "peso_recipiente_suelo_humedo_g",
    type: "number",
  },
  {
    key: "4",
    label: "Peso de recipiente + suelo seco",
    unit: "(g)",
    field: "peso_recipiente_suelo_seco_g",
    type: "number",
  },
  { key: "5", label: "Peso del agua  (3)-(4)", unit: "(g)", field: "peso_agua_g", type: "number", readOnly: true },
  { key: "6", label: "peso del suelo (4)-(2)", unit: "(g)", field: "peso_suelo_g", type: "number", readOnly: true },
  {
    key: "7",
    label: "contenido de humedad (5)/(6) * 100",
    unit: "(%)",
    field: "contenido_humedad_pct",
    type: "number",
    readOnly: true,
  },
]
const HUMEDAD_NAV_ROWS = {
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
} as const

const normalizeArray = <T>(value: T[] | undefined, length: number, fallback: T): T[] => {
  const result = Array.from({ length }, () => fallback)
  if (!value) return result
  value.slice(0, length).forEach((item, idx) => {
    result[idx] = item
  })
  return result
}

const buildFormatPreview = (sampleCode: string | undefined, materialCode: "SU" | "AG", ensayo: string) => {
  const currentYear = new Date().getFullYear().toString().slice(-2)
  const normalized = (sampleCode || "").trim().toUpperCase()
  const fullMatch = normalized.match(/^(\d+)(?:-[A-Z0-9. ]+)?-(\d{2,4})$/)
  const partialMatch = normalized.match(/^(\d+)(?:-(\d{2,4}))?$/)
  const match = fullMatch || partialMatch
  const numero = match?.[1] || "xxxx"
  const year = (match?.[2] || currentYear).slice(-2)
  return `Formato N-${numero}-${materialCode}-${year} ${ensayo}`
}

type FormState = {
  muestra: string
  numero_ot: string
  fecha_ensayo: string
  peso_kg: Array<number | null>
  esf_normal: Array<number | null>
  carga_kg_1: Array<number | null>
  carga_kg_2: Array<number | null>
  carga_kg_3: Array<number | null>
  humedad_puntos: HumedadPointForm[]
  hora_1: string[]
  deform_1: Array<number | null>
  hora_2: string[]
  deform_2: Array<number | null>
  hora_3: string[]
  deform_3: Array<number | null>
  realizado_por: string
  revisado_por: string
  aprobado_por: string
}

const initialState = (): FormState => ({
  muestra: "",
  numero_ot: "",
  fecha_ensayo: "",
  peso_kg: Array.from({ length: 3 }, () => null),
  esf_normal: Array.from({ length: 3 }, () => null),
  carga_kg_1: Array.from({ length: DEF_VALUES.length }, () => null),
  carga_kg_2: Array.from({ length: DEF_VALUES.length }, () => null),
  carga_kg_3: Array.from({ length: DEF_VALUES.length }, () => null),
  humedad_puntos: Array.from({ length: HUMEDAD_POINT_COUNT }, () => createEmptyHumedadPoint()),
  hora_1: Array.from({ length: HORA_ROWS.length }, () => ""),
  deform_1: Array.from({ length: HORA_ROWS.length }, () => null),
  hora_2: Array.from({ length: HORA_ROWS.length }, () => ""),
  deform_2: Array.from({ length: HORA_ROWS.length }, () => null),
  hora_3: Array.from({ length: HORA_ROWS.length }, () => ""),
  deform_3: Array.from({ length: HORA_ROWS.length }, () => null),
  realizado_por: "",
  revisado_por: "-",
  aprobado_por: "-",
})

const hydrateForm = (payload?: Partial<CdPayload>): FormState => {
  const base = initialState()
  if (!payload) return base

  const legacyHumedadPoint = toHumedadPointForm({
    recipiente_numero: payload.recipiente_numero,
    peso_recipiente_g: payload.peso_recipiente_g,
    peso_recipiente_suelo_humedo_g: payload.peso_recipiente_suelo_humedo_g,
    peso_recipiente_suelo_seco_g: payload.peso_recipiente_suelo_seco_g,
    peso_agua_g: payload.peso_agua_g,
    peso_suelo_g: payload.peso_suelo_g,
    contenido_humedad_pct: payload.contenido_humedad_pct,
  })
  const humedadPuntos = normalizeHumedadPoints(payload.humedad_puntos)
  if ((!payload.humedad_puntos || payload.humedad_puntos.length === 0) && hasHumedadData(legacyHumedadPoint)) {
    humedadPuntos[0] = legacyHumedadPoint
  }

  const revisado = typeof payload.revisado_por === "string" && payload.revisado_por.trim() ? payload.revisado_por : base.revisado_por
  const aprobado = typeof payload.aprobado_por === "string" && payload.aprobado_por.trim() ? payload.aprobado_por : base.aprobado_por

  return {
    ...base,
    ...payload,
    peso_kg: normalizeArray(payload.peso_kg, 3, null),
    esf_normal: normalizeArray(payload.esf_normal, 3, null),
    carga_kg_1: normalizeArray(payload.carga_kg_1, DEF_VALUES.length, null),
    carga_kg_2: normalizeArray(payload.carga_kg_2, DEF_VALUES.length, null),
    carga_kg_3: normalizeArray(payload.carga_kg_3, DEF_VALUES.length, null),
    humedad_puntos: humedadPuntos,
    hora_1: normalizeArray(payload.hora_1, HORA_ROWS.length, ""),
    deform_1: normalizeArray(payload.deform_1, HORA_ROWS.length, null),
    hora_2: normalizeArray(payload.hora_2, HORA_ROWS.length, ""),
    deform_2: normalizeArray(payload.deform_2, HORA_ROWS.length, null),
    hora_3: normalizeArray(payload.hora_3, HORA_ROWS.length, ""),
    deform_3: normalizeArray(payload.deform_3, HORA_ROWS.length, null),
    revisado_por: revisado,
    aprobado_por: aprobado,
  }
}

// --- API Helpers using authFetch ---
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

async function saveEnsayo(payload: CdPayload, ensayoId?: number): Promise<SaveResponse> {
  const url = `${API_URL}/api/cd/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ""}`
  const response = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || "No se pudo guardar el ensayo.")
  }
  return response.json()
}

async function saveAndDownload(payload: CdPayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
  const url = `${API_URL}/api/cd/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ""}`
  const response = await authFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || "No se pudo descargar el archivo.")
  }
  const blob = await response.blob()
  const contentDisposition = response.headers.get("content-disposition")
  const match = contentDisposition ? contentDisposition.match(/filename="?([^";]+)"?/i) : null
  const filename = match?.[1]
  return { blob, filename }
}

async function getEnsayoDetail(ensayoId: number): Promise<EnsayoDetail> {
  const url = `${API_URL}/api/cd/${ensayoId}`
  const response = await authFetch(url)
  if (!response.ok) {
    throw new Error("No se pudo cargar el ensayo de corte directo.")
  }
  return response.json()
}

// --- Form Component ---
export default function CorteDirectoForm({ editId }: { editId?: number }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(() => initialState())
  const [loading, setLoading] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [ensayoId, setEnsayoId] = useState<number | null>(editId ?? null)
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [draftData, setDraftData] = useState<FormState | null>(null)
  const tableFieldRefs = useRef<Record<string, TableFieldElement | null>>({})

  useEffect(() => {
    if (ensayoId) return
    const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<CdPayload>
      setForm(hydrateForm(parsed))
    } catch {
      localStorage.removeItem(`${DRAFT_KEY}:new`)
    }
  }, [ensayoId])

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`, JSON.stringify(form))
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [form, ensayoId])

  useEffect(() => {
    if (!ensayoId) return
    let cancel = false
    const run = async () => {
      setLoadingEdit(true)
      try {
        const detail = await getEnsayoDetail(ensayoId)
        if (!cancel && detail.payload) {
          const serverState = hydrateForm(detail.payload)
          const rawDraft = localStorage.getItem(`${DRAFT_KEY}:${ensayoId}`)
          if (rawDraft) {
            try {
              const parsedDraft = JSON.parse(rawDraft) as Partial<CdPayload>
              const draftState = hydrateForm(parsedDraft)
              if (JSON.stringify(draftState) !== JSON.stringify(serverState)) {
                setDraftData(draftState)
                setShowDraftBanner(true)
              }
            } catch {
              // Ignored
            }
          }
          setForm(serverState)
        }
      } catch {
        toast.error("No se pudo cargar ensayo de corte directo.")
      } finally {
        if (!cancel) setLoadingEdit(false)
      }
    }
    void run()
    return () => {
      cancel = true
    }
  }, [ensayoId])

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setArrayNumberField = useCallback(
    (
      key: "peso_kg" | "esf_normal" | "carga_kg_1" | "carga_kg_2" | "carga_kg_3" | "deform_1" | "deform_2" | "deform_3",
      index: number,
      value: number | null
    ) => {
      setForm((prev) => {
        const arr = [...prev[key]]
        arr[index] = value
        return { ...prev, [key]: arr }
      })
    },
    []
  )

  const setArrayTextField = useCallback((key: "hora_1" | "hora_2" | "hora_3", index: number, value: string) => {
    setForm((prev) => {
      const arr = [...prev[key]]
      arr[index] = value
      return { ...prev, [key]: arr }
    })
  }, [])

  const setHumedadField = useCallback(<K extends keyof HumedadPointForm>(pointIndex: number, key: K, value: HumedadPointForm[K]) => {
    setForm((prev) => {
      const humedadPuntos = prev.humedad_puntos.map((point, idx) => (idx === pointIndex ? { ...point, [key]: value } : point))
      return { ...prev, humedad_puntos: humedadPuntos }
    })
  }, [])

  const focusTableField = useCallback((table: TableNavigationGroup, row: number, col: number) => {
    const target = tableFieldRefs.current[getTableFieldKey(table, row, col)]
    if (!target) return false
    target.focus()
    return true
  }, [])

  const focusNextTableField = useCallback((table: TableNavigationGroup, row: number, col: number) => {
    const fields = Object.entries(tableFieldRefs.current)
      .flatMap(([key, element]) => {
        if (!element) return []
        const [fieldTable, fieldRow, fieldCol] = key.split(":")
        const parsedRow = Number(fieldRow)
        const parsedCol = Number(fieldCol)
        if (fieldTable !== table || !Number.isInteger(parsedRow) || !Number.isInteger(parsedCol)) return []
        return [{ row: parsedRow, col: parsedCol, element }]
      })
      .sort((a, b) => (a.col === b.col ? a.row - b.row : a.col - b.col))

    const currentIndex = fields.findIndex((field) => field.row === row && field.col === col)
    const nextField = currentIndex >= 0 ? fields[currentIndex + 1] : null
    if (!nextField) return false

    nextField.element.focus()
    return true
  }, [])

  const handleTableEnter = useCallback(
    (event: ReactKeyboardEvent<TableFieldElement>, table: TableNavigationGroup, row: number, col: number) => {
      if (event.key !== "Enter") return
      event.preventDefault()
      if (focusTableField(table, row + 1, col)) return
      focusNextTableField(table, row, col)
    },
    [focusNextTableField, focusTableField]
  )

  const clearAll = useCallback(() => {
    if (!window.confirm("Se limpiarán los datos no guardados. ¿Deseas continuar?")) return
    localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`)
    setForm(initialState())
  }, [ensayoId])

  const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)

  const save = useCallback(
    async (download: boolean) => {
      if (!form.muestra || !form.numero_ot || !form.fecha_ensayo) {
        toast.error("Complete Muestra, N OT y Fecha de ensayo.")
        return
      }
      setLoading(true)
      try {
        const humedadPuntos = form.humedad_puntos.map(resolveHumedadPoint)
        const humedadPrincipal = humedadPuntos[0] ?? createEmptyHumedadPoint()
        const payload: CdPayload = {
          ...form,
          def_horizontal: [...DEF_VALUES],
          humedad_puntos: humedadPuntos,
          recipiente_numero: humedadPrincipal.recipiente_numero,
          peso_recipiente_g: humedadPrincipal.peso_recipiente_g,
          peso_recipiente_suelo_humedo_g: humedadPrincipal.peso_recipiente_suelo_humedo_g,
          peso_recipiente_suelo_seco_g: humedadPrincipal.peso_recipiente_suelo_seco_g,
          peso_agua_g: humedadPrincipal.peso_agua_g,
          peso_suelo_g: humedadPrincipal.peso_suelo_g,
          contenido_humedad_pct: humedadPrincipal.contenido_humedad_pct,
        }

        if (download) {
          const downloadResult = await saveAndDownload(payload, ensayoId ?? undefined)
          const blob = downloadResult.blob
          const filename = downloadResult.filename
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = filename || `${buildFormatPreview(form.muestra, "SU", "CD")}.xlsx`
          a.click()
          URL.revokeObjectURL(url)
        } else {
          await saveEnsayo(payload, ensayoId ?? undefined)
        }
        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`)
        setForm(initialState())
        setEnsayoId(null)
        router.push("/dashboard")
        toast.success(download ? "Corte directo guardado y descargado." : "Corte directo guardado.")
      } catch (err: any) {
        const msg = err.message || "No se pudo generar CD."
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    },
    [ensayoId, form, router]
  )

  const handleClose = () => {
    router.push("/dashboard")
  }

  useEffect(() => {
    // Enable scroll on body for this full-screen route
    document.body.classList.remove("overflow-hidden")
    return () => {
      document.body.classList.add("overflow-hidden")
    }
  }, [])

  const denseInputClass =
    "h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35"

  const readOnlyInputClass = "h-8 w-full rounded-md border border-slate-200 bg-slate-100 px-2 text-sm text-slate-800"
  const humedadInputClass = `${denseInputClass} text-center`
  const humedadReadOnlyInputClass = `${readOnlyInputClass} text-center`
  const resolvedHumedadPuntos = form.humedad_puntos.map(resolveHumedadPoint)

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col overflow-y-auto">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Beaker className="h-6 w-6 text-indigo-600" />
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight sm:text-lg">CORTE DIRECTO - NTP 339.171</h1>
            <p className="text-xs text-slate-500">Módulo nativo del CRM</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none"
          title="Regresar al Dashboard"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-[1200px] space-y-4">
          {showDraftBanner ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2.5 text-sm text-amber-800">
                <span className="text-lg leading-none">⚠️</span>
                <div>
                  <p className="font-semibold">Cambios locales no guardados detectados</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Se encontró un borrador en este navegador que tiene diferencias con la versión guardada en el servidor.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => {
                    if (draftData) setForm(draftData)
                    setShowDraftBanner(false)
                    toast.success("Borrador local recuperado con éxito.")
                  }}
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition"
                >
                  Recuperar Trabajo
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`)
                    setShowDraftBanner(false)
                    setDraftData(null)
                    toast.success("Borrador descartado.")
                  }}
                  className="rounded-lg border border-amber-300 bg-white hover:bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition"
                >
                  Descartar
                </button>
              </div>
            </div>
          ) : null}

          {loadingEdit ? (
            <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando ensayo...
            </div>
          ) : null}

          <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
            <div className="border-b border-slate-300 bg-slate-50 px-4 py-4 text-center">
              <p className="text-[24px] font-semibold leading-tight text-slate-900 font-sans">LABORATORIO DE ENSAYO DE MATERIALES</p>
              <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-SU-05.01</p>
            </div>

            <div className="border-b border-slate-300 bg-white px-3 py-3">
              <table className="w-full table-fixed border border-slate-300 text-sm">
                <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                  <tr>
                    <th className="border-r border-slate-300 py-1" colSpan={2}>
                      MUESTRA
                    </th>
                    <th className="border-r border-slate-300 py-1" colSpan={2}>
                      N° OT
                    </th>
                    <th className="py-1" colSpan={2}>
                      FECHA
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                      <input
                        className={`${denseInputClass} text-center font-mono`}
                        value={form.muestra}
                        onChange={(e) => setField("muestra", e.target.value)}
                        onBlur={() => setField("muestra", normalizeMuestraCode(form.muestra))}
                        autoComplete="off"
                        data-lpignore="true"
                        placeholder="Código de muestra"
                      />
                    </td>
                    <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                      <input
                        className={`${denseInputClass} text-center`}
                        value={form.numero_ot}
                        onChange={(e) => setField("numero_ot", e.target.value)}
                        onBlur={() => setField("numero_ot", normalizeNumeroOtCode(form.numero_ot))}
                        autoComplete="off"
                        data-lpignore="true"
                        placeholder="Número de OT"
                      />
                    </td>
                    <td className="border-t border-slate-300 p-1" colSpan={2}>
                      <input
                        className={`${denseInputClass} text-center`}
                        value={form.fecha_ensayo}
                        onChange={(e) => setField("fecha_ensayo", e.target.value)}
                        onBlur={() => setField("fecha_ensayo", normalizeFlexibleDate(form.fecha_ensayo))}
                        autoComplete="off"
                        data-lpignore="true"
                        placeholder="YYYY/MM/DD"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center">
              <p className="text-[14px] font-semibold leading-tight text-slate-900">
                METODO DE ENSAYO NORMALIZADO PARA EL CORTE DIRECTO DE SUELOS BAJO CONDICIONES CONSOLIDADAS DRENADAS
              </p>
              <p className="text-[13px] font-semibold text-slate-900">NORMA NTP 339.171 / ASTM D3080</p>
            </div>

            <div className="p-3">
              <table className="w-full table-fixed border border-slate-300 text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-800">
                  <tr>
                    {[0, 1, 2].map((idx) => (
                      <th key={`peso-${idx}`} className="border-r border-slate-300 py-2" colSpan={2}>
                        <div className="flex flex-col items-center gap-1">
                          <span>Peso....... Kg</span>
                          <input
                            type="number"
                            step="any"
                            className={denseInputClass}
                            value={form.peso_kg[idx] ?? ""}
                            onChange={(e) => setArrayNumberField("peso_kg", idx, parseNum(e.target.value))}
                            onKeyDown={(e) => handleTableEnter(e, "cargas", 0, idx)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("cargas", 0, idx)] = element
                            }}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {[0, 1, 2].map((idx) => (
                      <th key={`esf-${idx}`} className="border-r border-slate-300 py-2" colSpan={2}>
                        <div className="flex flex-col items-center gap-1">
                          <span>Esf. Normal......</span>
                          <input
                            type="number"
                            step="any"
                            className={denseInputClass}
                            value={form.esf_normal[idx] ?? ""}
                            onChange={(e) => setArrayNumberField("esf_normal", idx, parseNum(e.target.value))}
                            onKeyDown={(e) => handleTableEnter(e, "cargas", 1, idx)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("cargas", 1, idx)] = element
                            }}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border-r border-slate-300 py-1">Def. Horizontal</th>
                    <th className="border-r border-slate-300 py-1">Carga</th>
                    <th className="border-r border-slate-300 py-1">Def. Horizontal</th>
                    <th className="border-r border-slate-300 py-1">Carga</th>
                    <th className="border-r border-slate-300 py-1">Def. Horizontal</th>
                    <th className="py-1">Carga</th>
                  </tr>
                  <tr>
                    <th className="border-r border-slate-300 py-1">Div (0.01)</th>
                    <th className="border-r border-slate-300 py-1">Kg</th>
                    <th className="border-r border-slate-300 py-1">Div (0.01)</th>
                    <th className="border-r border-slate-300 py-1">Kg</th>
                    <th className="border-r border-slate-300 py-1">Div (0.01)</th>
                    <th className="py-1">Kg</th>
                  </tr>
                </thead>
                <tbody>
                  {DEF_VALUES.map((defValue, idx) => (
                    <tr key={defValue}>
                      <td className="border-t border-r border-slate-300 px-2 py-1 text-xs text-center">{defValue}</td>
                      <td className="border-t border-r border-slate-300 p-1">
                        <input
                          type="number"
                          step="any"
                          className={denseInputClass}
                          value={form.carga_kg_1[idx] ?? ""}
                          onChange={(e) => setArrayNumberField("carga_kg_1", idx, parseNum(e.target.value))}
                          onKeyDown={(e) => handleTableEnter(e, "cargas", idx + 2, 0)}
                          ref={(element) => {
                            tableFieldRefs.current[getTableFieldKey("cargas", idx + 2, 0)] = element
                          }}
                        />
                      </td>
                      <td className="border-t border-r border-slate-300 px-2 py-1 text-xs text-center">{defValue}</td>
                      <td className="border-t border-r border-slate-300 p-1">
                        <input
                          type="number"
                          step="any"
                          className={denseInputClass}
                          value={form.carga_kg_2[idx] ?? ""}
                          onChange={(e) => setArrayNumberField("carga_kg_2", idx, parseNum(e.target.value))}
                          onKeyDown={(e) => handleTableEnter(e, "cargas", idx + 2, 1)}
                          ref={(element) => {
                            tableFieldRefs.current[getTableFieldKey("cargas", idx + 2, 1)] = element
                          }}
                        />
                      </td>
                      <td className="border-t border-r border-slate-300 px-2 py-1 text-xs text-center">{defValue}</td>
                      <td className="border-t border-slate-300 p-1">
                        <input
                          type="number"
                          step="any"
                          className={denseInputClass}
                          value={form.carga_kg_3[idx] ?? ""}
                          onChange={(e) => setArrayNumberField("carga_kg_3", idx, parseNum(e.target.value))}
                          onKeyDown={(e) => handleTableEnter(e, "cargas", idx + 2, 2)}
                          ref={(element) => {
                            tableFieldRefs.current[getTableFieldKey("cargas", idx + 2, 2)] = element
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 rounded-lg border border-slate-300 p-2">
                <div className="mb-2 text-center text-xs font-semibold text-slate-800">
                  CONTENIDO DE HUMEDAD - NTP 339.127 / ASTM D2216
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[920px] w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-10" />
                      <col />
                      <col className="w-20" />
                      {Array.from({ length: HUMEDAD_POINT_COUNT }).map((_, idx) => (
                        <col key={idx} className="w-32" />
                      ))}
                    </colgroup>
                    <tbody>
                      {HUMEDAD_ROWS.map((row) => (
                        <tr key={row.key}>
                          <td className="border-t border-r border-slate-300 px-2 py-1 text-xs text-center">{row.key}</td>
                          <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                          <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{row.unit}</td>
                          {form.humedad_puntos.map((point, idx) => {
                            const resolvedPoint = resolvedHumedadPuntos[idx]
                            const cellClass = idx < HUMEDAD_POINT_COUNT - 1 ? "border-t border-r border-slate-300 p-1" : "border-t border-slate-300 p-1"

                            if (row.type === "text") {
                              return (
                                <td key={`${row.key}-${idx}`} className={cellClass}>
                                  <input
                                    className={humedadInputClass}
                                    value={point[row.field] as string}
                                    onChange={(e) => setHumedadField(idx, row.field, e.target.value as HumedadPointForm[typeof row.field])}
                                    onKeyDown={(e) =>
                                      handleTableEnter(e, "humedad", HUMEDAD_NAV_ROWS[row.key as keyof typeof HUMEDAD_NAV_ROWS], idx)
                                    }
                                    ref={(element) => {
                                      tableFieldRefs.current[
                                        getTableFieldKey("humedad", HUMEDAD_NAV_ROWS[row.key as keyof typeof HUMEDAD_NAV_ROWS], idx)
                                      ] = element
                                    }}
                                  />
                                </td>
                              )
                            }

                            return (
                              <td key={`${row.key}-${idx}`} className={cellClass}>
                                <input
                                  type="number"
                                  step="any"
                                  className={row.readOnly ? humedadReadOnlyInputClass : humedadInputClass}
                                  value={(row.readOnly ? resolvedPoint[row.field] : point[row.field]) ?? ""}
                                  onChange={(e) => {
                                    if (row.readOnly) return
                                    setHumedadField(idx, row.field, parseNum(e.target.value) as HumedadPointForm[typeof row.field])
                                  }}
                                  readOnly={row.readOnly}
                                  onKeyDown={
                                    row.readOnly
                                      ? undefined
                                      : (e) => handleTableEnter(e, "humedad", HUMEDAD_NAV_ROWS[row.key as keyof typeof HUMEDAD_NAV_ROWS], idx)
                                  }
                                  ref={
                                    row.readOnly
                                      ? undefined
                                      : (element) => {
                                          tableFieldRefs.current[
                                            getTableFieldKey("humedad", HUMEDAD_NAV_ROWS[row.key as keyof typeof HUMEDAD_NAV_ROWS], idx)
                                          ] = element
                                        }
                                  }
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-300">
                <table className="w-full table-fixed text-sm">
                  <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                    <tr>
                      <th className="border-b border-r border-slate-300 py-1">Hora</th>
                      <th className="border-b border-r border-slate-300 py-1">Deform. #1</th>
                      <th className="border-b border-r border-slate-300 py-1">Hora</th>
                      <th className="border-b border-r border-slate-300 py-1">Deform. #2</th>
                      <th className="border-b border-r border-slate-300 py-1">Hora</th>
                      <th className="border-b border-slate-300 py-1">Deform. #3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {HORA_ROWS.map((rowIdx) => (
                      <tr key={rowIdx}>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            className={denseInputClass}
                            value={form.hora_1[rowIdx]}
                            onChange={(e) => setArrayTextField("hora_1", rowIdx, e.target.value)}
                            onKeyDown={(e) => handleTableEnter(e, "hora", rowIdx, 0)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("hora", rowIdx, 0)] = element
                            }}
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="number"
                            step="any"
                            className={denseInputClass}
                            value={form.deform_1[rowIdx] ?? ""}
                            onChange={(e) => setArrayNumberField("deform_1", rowIdx, parseNum(e.target.value))}
                            onKeyDown={(e) => handleTableEnter(e, "hora", rowIdx, 1)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("hora", rowIdx, 1)] = element
                            }}
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            className={denseInputClass}
                            value={form.hora_2[rowIdx]}
                            onChange={(e) => setArrayTextField("hora_2", rowIdx, e.target.value)}
                            onKeyDown={(e) => handleTableEnter(e, "hora", rowIdx, 2)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("hora", rowIdx, 2)] = element
                            }}
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            type="number"
                            step="any"
                            className={denseInputClass}
                            value={form.deform_2[rowIdx] ?? ""}
                            onChange={(e) => setArrayNumberField("deform_2", rowIdx, parseNum(e.target.value))}
                            onKeyDown={(e) => handleTableEnter(e, "hora", rowIdx, 3)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("hora", rowIdx, 3)] = element
                            }}
                          />
                        </td>
                        <td className="border-t border-r border-slate-300 p-1">
                          <input
                            className={denseInputClass}
                            value={form.hora_3[rowIdx]}
                            onChange={(e) => setArrayTextField("hora_3", rowIdx, e.target.value)}
                            onKeyDown={(e) => handleTableEnter(e, "hora", rowIdx, 4)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("hora", rowIdx, 4)] = element
                            }}
                          />
                        </td>
                        <td className="border-t border-slate-300 p-1">
                          <input
                            type="number"
                            step="any"
                            className={denseInputClass}
                            value={form.deform_3[rowIdx] ?? ""}
                            onChange={(e) => setArrayNumberField("deform_3", rowIdx, parseNum(e.target.value))}
                            onKeyDown={(e) => handleTableEnter(e, "hora", rowIdx, 5)}
                            ref={(element) => {
                              tableFieldRefs.current[getTableFieldKey("hora", rowIdx, 5)] = element
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-center text-xs font-semibold text-slate-800">Realizado</div>
                  <input className={denseInputClass} value={form.realizado_por} onChange={(e) => setField("realizado_por", e.target.value)} />
                </div>
                <div className="rounded-lg border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-center text-xs font-semibold text-slate-800">Revisado</div>
                  <select className={denseInputClass} value={form.revisado_por} onChange={(e) => setField("revisado_por", e.target.value)}>
                    {REVISORES.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-slate-300 bg-white p-2">
                  <div className="mb-2 text-center text-xs font-semibold text-slate-800">Aprobado</div>
                  <select className={denseInputClass} value={form.aprobado_por} onChange={(e) => setField("aprobado_por", e.target.value)}>
                    {APROBADORES.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <button
                  onClick={clearAll}
                  disabled={loading}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpiar todo
                </button>
                <button
                  onClick={() => setPendingFormatAction(false)}
                  disabled={loading}
                  className="h-11 rounded-lg border border-slate-900 bg-white font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:opacity-50"
                >
                  {loading ? "Guardando..." : "Guardar"}
                </button>
                <button
                  onClick={() => setPendingFormatAction(true)}
                  disabled={loading}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Guardar y Descargar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <FormatConfirmModal
        open={pendingFormatAction !== null}
        formatLabel={buildFormatPreview(form.muestra, "SU", "CD")}
        actionLabel={pendingFormatAction ? "Guardar y Descargar" : "Guardar"}
        onClose={() => setPendingFormatAction(null)}
        onConfirm={() => {
          if (pendingFormatAction === null) return
          const shouldDownload = pendingFormatAction
          setPendingFormatAction(null)
          void save(shouldDownload)
        }}
      />
    </div>
  )
}
