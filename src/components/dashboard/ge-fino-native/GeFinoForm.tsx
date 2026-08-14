import { useCallback, useEffect, useMemo, useState } from "react"
import { Beaker, Download, Loader2, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { ConfirmActionModal, FormActionDock, UnsavedChangesModal, useConfirmDialog } from "../shared"

const buildFormatPreview = (sampleCode: string | undefined, materialCode: 'SU' | 'AG', ensayo: string) => {
    const currentYear = new Date().getFullYear().toString().slice(-2)
    const normalized = (sampleCode || '').trim().toUpperCase()
    const fullMatch = normalized.match(/^(\d+)(?:-[A-Z0-9. ]+)?-(\d{2,4})$/)
    const partialMatch = normalized.match(/^(\d+)(?:-(\d{2,4}))?$/)
    const match = fullMatch || partialMatch
    const numero = match?.[1] || 'xxxx'
    const year = (match?.[2] || currentYear).slice(-2)
    return `Formato N-${numero}-${materialCode}-${year} ${ensayo}`
}

const DRAFT_KEY = "ge_fino_form_draft_v1"
const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
const REVISORES = ["-", "FABIAN LA ROSA"] as const
const APROBADORES = ["-", "IRMA COAQUIRA"] as const

type EquipoField =
  | "equipo_balanza_01g_codigo"
  | "equipo_horno_110_codigo"
  | "equipo_termometro_codigo"
  | "equipo_picnometro_codigo"
  | "equipo_molde_pison_codigo"

const EQUIPO_OPTIONS: Record<EquipoField, readonly string[]> = {
  equipo_balanza_01g_codigo: ["-", "EQP-0090"],
  equipo_horno_110_codigo: ["-", "EQP-0150", "EQP-0049"],
  equipo_termometro_codigo: ["-", "INS-0153"],
  equipo_picnometro_codigo: ["-"],
  equipo_molde_pison_codigo: ["-", "INS-0111"],
}

const getEquipmentOptions = (value: string | null | undefined, base: readonly string[]) => {
  const current = (value ?? "").trim()
  if (!current || base.includes(current)) return base
  return [...base, current]
}

interface GeFinoPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    masa_humeda_g?: number | null
    masa_seca_g?: number | null
    masa_seca_constante_g?: number | null
    fecha_hora_inmersion?: string | null
    fecha_hora_salida_inmersion?: string | null
    temp_picnometro_contenido_c?: number | null
    temp_durante_calibracion_c?: number | null

    valor_s_g?: number | null
    valor_c_g?: number | null
    valor_b_g?: number | null
    valor_d_g?: string | null
    valor_e_g?: number | null
    valor_f_g?: number | null
    valor_g_g?: number | null
    valor_a_g?: number | null
    densidad_relativa_od?: number | null
    densidad_relativa_ssd?: number | null
    densidad_relativa_aparente?: number | null
    absorcion_pct?: number | null

    seco_horno_110_si_no?: "-" | "SI" | "NO"
    equipo_balanza_01g_codigo?: string | null
    equipo_horno_110_codigo?: string | null
    equipo_termometro_codigo?: string | null
    equipo_picnometro_codigo?: string | null
    equipo_molde_pison_codigo?: string | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const initialState = (): GeFinoPayload => ({
  muestra: "",
  numero_ot: "",
  fecha_ensayo: "",
  realizado_por: "",
  masa_humeda_g: null,
  masa_seca_g: null,
  masa_seca_constante_g: null,
  fecha_hora_inmersion: "",
  fecha_hora_salida_inmersion: "",
  temp_picnometro_contenido_c: null,
  temp_durante_calibracion_c: null,
  valor_s_g: null,
  valor_c_g: null,
  valor_b_g: null,
  valor_d_g: "",
  valor_e_g: null,
  valor_f_g: null,
  valor_g_g: null,
  valor_a_g: null,
  densidad_relativa_od: null,
  densidad_relativa_ssd: null,
  densidad_relativa_aparente: null,
  absorcion_pct: null,
  seco_horno_110_si_no: "-",
  equipo_balanza_01g_codigo: "-",
  equipo_horno_110_codigo: "-",
  equipo_termometro_codigo: "-",
  equipo_picnometro_codigo: "",
  equipo_molde_pison_codigo: "-",
  observaciones: "",
  revisado_por: "-",
  revisado_fecha: '',
  aprobado_por: '-',
  aprobado_fecha: '',
})

const normalizeNumericText = (value: string) => {
  const raw = value.trim().replace(/\s+/g, "")
  if (!raw) return ""
  const hasComma = raw.includes(",")
  const hasDot = raw.includes(".")
  if (hasComma && hasDot) {
    return raw.lastIndexOf(",") > raw.lastIndexOf(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "")
  }
  if (hasComma) return raw.replace(",", ".")
  return raw
}

const parseNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null
  const n = Number(normalizeNumericText(String(v)))
  return Number.isFinite(n) ? n : null
}

const y2 = () => new Date().getFullYear().toString().slice(-2)
const normalizeMuestra = (raw: string) => {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "")
  const m = compact.match(/^(\d+)(?:-(?:SU|AG))?(?:-(\d{2}))?$/)
  return m ? `${m[1]}-AG-${m[2] || y2()}` : raw.trim().toUpperCase()
}
const normalizeOt = (raw: string) => {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "")
  const a = compact.match(/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/)
  const b = compact.match(/^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/)
  const m = a || b
  return m ? `${m[1]}-${m[2] || y2()}` : raw.trim().toUpperCase()
}
const normalizeDate = (raw: string): string => {
    const value = raw.trim()
    if (!value) return ''
    const digits = value.replace(/\D/g, '')
    const currentYear = String(new Date().getFullYear())
    const pad2 = (part: string) => part.padStart(2, '0').slice(-2)
    const normalizeYear = (part: string) => {
        const clean = part.replace(/\D/g, '')
        if (clean.length >= 4) return clean.slice(0, 4)
        if (clean.length === 2) return `20${clean}`
        if (clean.length === 1) return `200${clean}`
        return currentYear
    }
    const build = (y: string, m: string, d: string) => `${normalizeYear(y)}/${pad2(m)}/${pad2(d)}`

    if (value.includes('/') || value.includes('-')) {
        const [a = '', b = '', c = ''] = value.split(/[/-]/).map((part) => part.trim())
        if (!a || !b) return value
        if (a.length === 4) return build(a, b, c || '01')
        if (c) return build(c, b, a)
        return value
    }

    if (digits.length === 8) {
        if (digits.startsWith('19') || digits.startsWith('20')) return build(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8))
        return build(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2))
    }
    if (digits.length === 6) return build(digits.slice(4, 6), digits.slice(2, 4), digits.slice(0, 2))
    if (digits.length === 5) return build(digits.slice(3, 5), digits.slice(1, 3), digits[0])
    if (digits.length === 4) return build(currentYear, digits.slice(0, 2), digits.slice(2, 4))
    if (digits.length === 3) return build(currentYear, digits[0], digits.slice(1, 3))
    if (digits.length === 2) return build(currentYear, digits[0], digits[1])

    return value
}

const round4 = (n: number | null) => (n == null ? null : Number(n.toFixed(4)))
const round2 = (n: number | null) => (n == null ? null : Number(n.toFixed(2)))
const fixed4 = (n: number | null | undefined) => (n == null ? "" : n.toFixed(4))
const fixed2 = (n: number | null | undefined) => (n == null ? "" : n.toFixed(2))

type NKey =
  | "valor_s_g"
  | "valor_c_g"
  | "valor_b_g"
  | "valor_d_g"
  | "valor_e_g"
  | "valor_f_g"
  | "valor_g_g"
  | "valor_a_g"
  | "densidad_relativa_od"
  | "densidad_relativa_ssd"
  | "densidad_relativa_aparente"
  | "absorcion_pct"

export interface GeFinoFormProps {
  editId?: number | null
  onClose?: () => void
  onSaved?: () => void
}

export default function GeFinoForm({ editId, onClose, onSaved }: GeFinoFormProps) {
  const [form, setForm] = useState<GeFinoPayload>(() => initialState())
  const [loading, setLoading] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [ensayoId, setEnsayoId] = useState<number | null>(editId ?? null)
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = useState(false)

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(initialState())
  }, [form])

  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setIsUnsavedChangesModalOpen(true)
    } else {
      onClose?.()
    }
  }, [isDirty, onClose])

  useEffect(() => {
    setEnsayoId(editId ?? null)
  }, [editId])

  const setField = useCallback(<K extends keyof GeFinoPayload>(key: K, value: GeFinoPayload[K]) => {
    setForm((p) => ({ ...p, [key]: value }))
  }, [])

  const computedA = useMemo(() => {
    if (form.valor_a_g != null) return form.valor_a_g
    if (form.valor_g_g != null && form.valor_e_g != null) return round4(form.valor_g_g - form.valor_e_g)
    if (form.valor_f_g != null && form.valor_e_g != null) return round4(form.valor_f_g - form.valor_e_g)
    return null
  }, [form.valor_a_g, form.valor_e_g, form.valor_f_g, form.valor_g_g])

  const d = useMemo(() => {
    if (form.valor_b_g == null || form.valor_s_g == null || form.valor_c_g == null) return null
    const den = form.valor_b_g + form.valor_s_g - form.valor_c_g
    return den === 0 ? null : den
  }, [form.valor_b_g, form.valor_c_g, form.valor_s_g])

  const od = useMemo(() => form.densidad_relativa_od ?? (computedA != null && d != null ? round4(computedA / d) : null), [computedA, d, form.densidad_relativa_od])
  const ssd = useMemo(() => form.densidad_relativa_ssd ?? (form.valor_s_g != null && d != null ? round4(form.valor_s_g / d) : null), [d, form.densidad_relativa_ssd, form.valor_s_g])
  const aparente = useMemo(() => {
    if (form.densidad_relativa_aparente != null) return form.densidad_relativa_aparente
    if (computedA == null || form.valor_b_g == null || form.valor_c_g == null) return null
    const den = form.valor_b_g + computedA - form.valor_c_g
    return den === 0 ? null : round4(computedA / den)
  }, [computedA, form.densidad_relativa_aparente, form.valor_b_g, form.valor_c_g])
  const absorcion = useMemo(() => form.absorcion_pct ?? (form.valor_s_g != null && computedA != null && computedA !== 0 ? round2(((form.valor_s_g - computedA) / computedA) * 100) : null), [computedA, form.absorcion_pct, form.valor_s_g])

  useEffect(() => {
    if (ensayoId) return
    const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
    if (!raw) return
    try {
      const hydrated = { ...initialState(), ...JSON.parse(raw) } as GeFinoPayload
      hydrated.muestra = normalizeMuestra(hydrated.muestra || "")
      hydrated.fecha_ensayo = normalizeDate(hydrated.fecha_ensayo || "")
      setForm(hydrated)
    } catch {
      localStorage.removeItem(`${DRAFT_KEY}:new`)
    }
  }, [ensayoId])

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`, JSON.stringify(form))
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [ensayoId, form])

  useEffect(() => {
    if (!ensayoId) return
    let cancelled = false
    const run = async () => {
      setLoadingEdit(true)
      try {
        const res = await authFetch(`${API_URL}/api/ge-fino/${ensayoId}`)
        if (!res.ok) throw new Error("Error al cargar")
        const detail = await res.json()
        if (!cancelled && detail) {
          const payload = detail.payload || (detail as any)
          const merged: GeFinoPayload = {
            ...initialState(),
            muestra: detail.muestra || payload.muestra || "",
            numero_ot: detail.numero_ot || payload.numero_ot || "",
            cliente: detail.cliente || payload.cliente || "",
            fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || "",
            realizado_por: payload.realizado_por || "OPERADOR",
            ...payload,
          }
          merged.muestra = normalizeMuestra(merged.muestra || "")
          merged.fecha_ensayo = normalizeDate(merged.fecha_ensayo || "")
          setForm(merged)
        }
      } catch {
        toast.error("No se pudo cargar ensayo GE Fino para edicion.")
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [ensayoId])

  useEffect(() => {
    const today = normalizeDate(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" }))
    if (form.revisado_por && form.revisado_por !== "-" && !form.revisado_fecha) {
      setField("revisado_fecha", today)
    }
    if (form.aprobado_por && form.aprobado_por !== "-" && !form.aprobado_fecha) {
      setField("aprobado_fecha", today)
    }
  }, [form.aprobado_fecha, form.aprobado_por, form.revisado_fecha, form.revisado_por, setField])

  const save = useCallback(async (download: boolean) => {
    if (!form.muestra || !form.numero_ot || !form.realizado_por || !form.fecha_ensayo) {
      toast.error("Complete Muestra, N OT, Fecha de ensayo y Realizado por.")
      return
    }
    setLoading(true)
    try {
      const sanitize = (v: string | null | undefined) => (v === "-" ? "" : v || "")
      const payload: GeFinoPayload = {
        ...form,
        equipo_picnometro_codigo: sanitize(form.equipo_picnometro_codigo),
        valor_a_g: form.valor_a_g ?? computedA,
        densidad_relativa_od: form.densidad_relativa_od ?? od,
        densidad_relativa_ssd: form.densidad_relativa_ssd ?? ssd,
        densidad_relativa_aparente: form.densidad_relativa_aparente ?? aparente,
        absorcion_pct: form.absorcion_pct ?? absorcion,
      }
      let savedId = ensayoId

      if (download) {
        const url = `${API_URL}/api/ge-fino/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
        const res = await authFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Error al generar Excel")
        const blob = await res.blob()
        const link = document.createElement("a")
        link.href = URL.createObjectURL(blob)
        link.download = `${buildFormatPreview(form.muestra, 'AG', 'GE FINO')}.xlsx`
        link.click()
        URL.revokeObjectURL(link.href)

        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`)
        toast.success("GE Fino guardado y descargado.")
        onSaved?.()
        onClose?.()
      } else {
        const url = `${API_URL}/api/ge-fino/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
        const res = await authFetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error("Error al guardar ensayo")
        const saved = await res.json()
        savedId = saved.id || saved.ensayoId || ensayoId
        if (savedId) setEnsayoId(savedId)
        localStorage.removeItem(`${DRAFT_KEY}:new`)
        toast.success("GE Fino guardado. Puedes seguir editando.")
        onSaved?.()
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Error guardando GE Fino"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [absorcion, aparente, computedA, ensayoId, form, od, ssd, onClose, onSaved])

  const confirmReset = useCallback(() => {
    localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`)
    setForm(initialState())
  }, [ensayoId])

  const {
    isOpen: isClearDraftModalOpen,
    openDialog: handleRequestClear,
    closeDialog: handleCancelClear,
    handleConfirm: handleConfirmClear,
  } = useConfirmDialog(confirmReset)

  const rows: Array<{ key: NKey; sym: string; desc: string; unit: string; val: number | string | null }> = [
    { key: "valor_s_g", sym: "S", desc: "Masa de muestra saturada de superficie seca y densidad relativa", unit: "g", val: form.valor_s_g ?? null },
    { key: "valor_c_g", sym: "C", desc: "Masa del picnometro lleno de muestra y agua", unit: "g", val: form.valor_c_g ?? null },
    { key: "valor_b_g", sym: "B", desc: "Masa del picnometro lleno de agua", unit: "g", val: form.valor_b_g ?? null },
    { key: "valor_d_g", sym: "d", desc: "Recipiente", unit: "g", val: form.valor_d_g ?? "" },
    { key: "valor_e_g", sym: "e", desc: "Masa del recipiente", unit: "g", val: form.valor_e_g ?? null },
    { key: "valor_f_g", sym: "f", desc: "Masa del recipiente mas muestra secada al horno", unit: "g", val: form.valor_f_g ?? null },
    { key: "valor_g_g", sym: "g", desc: "Masa del recipiente mas muestra secada al horno constante", unit: "g", val: form.valor_g_g ?? null },
    { key: "valor_a_g", sym: "A", desc: "Masa de la muestra secada al horno", unit: "g", val: computedA },
    { key: "densidad_relativa_od", sym: "-", desc: "Densidad relativa (OD)", unit: "-", val: od },
    { key: "densidad_relativa_ssd", sym: "-", desc: "Densidad relativa (SSD)", unit: "-", val: ssd },
    { key: "densidad_relativa_aparente", sym: "-", desc: "Densidad relativa aparente", unit: "-", val: aparente },
    { key: "absorcion_pct", sym: "-", desc: "Absorcion (%)", unit: "%", val: absorcion },
  ]

  const txt = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35"
  const num = txt

  return (
    <div className="min-h-screen bg-slate-50/70 p-3 sm:p-5 lg:p-7 overflow-y-auto pb-28">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md px-5 py-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-blue-600">
              <Beaker className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                Gravedad Específica Fino — ASTM C128-22
              </h1>
              <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-AG-18.01</p>
              {ensayoId && (
                <p className="text-xs text-blue-600 font-semibold mt-0.5">
                  Editando ensayo #{ensayoId}
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={handleRequestClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
              title="Regresar al Dashboard"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loadingEdit ? <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm"><Loader2 className="h-4 w-4 animate-spin" />Cargando ensayo...</div> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 shadow-sm">
          <div className="grid grid-cols-4 border-b border-slate-300 bg-white text-xs font-semibold text-center">
            <div className="border-r border-slate-300 py-1">MUESTRA</div><div className="border-r border-slate-300 py-1">N° OT</div><div className="border-r border-slate-300 py-1">FECHA DE ENSAYO</div><div className="py-1">REALIZADO</div>
          </div>
          <div className="grid grid-cols-4 border-b border-slate-300">
            <div className="border-r border-slate-300 p-1"><input className={`${txt} text-center`} value={form.muestra} onChange={(e) => setField("muestra", e.target.value)} onBlur={() => setField("muestra", normalizeMuestra(form.muestra || ""))} autoComplete="off" data-lpignore="true" /></div>
            <div className="border-r border-slate-300 p-1"><input className={`${txt} text-center`} value={form.numero_ot} onChange={(e) => setField("numero_ot", e.target.value)} onBlur={() => setField("numero_ot", normalizeOt(form.numero_ot || ""))} autoComplete="off" data-lpignore="true" /></div>
            <div className="border-r border-slate-300 p-1"><input className={`${txt} text-center`} value={form.fecha_ensayo} onChange={(e) => setField("fecha_ensayo", e.target.value)} onBlur={() => setField("fecha_ensayo", normalizeDate(form.fecha_ensayo || ""))} autoComplete="off" data-lpignore="true" /></div>
            <div className="p-1"><input className={`${txt} text-center`} value={form.realizado_por || ""} onChange={(e) => setField("realizado_por", e.target.value)} autoComplete="off" data-lpignore="true" /></div>
          </div>

          <div className="text-center py-2 border-b border-slate-300 bg-slate-100">
            <p className="text-[13px] font-semibold text-slate-900">Standard Test Method for Relative Density (Specific Gravity) and Absorption of Fine Aggregate</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">ASTM C128-25</p>
          </div>

          <div className="border-b border-slate-300 p-3 space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_220px] gap-2 items-center"><label className="text-sm">Masa humeda</label><input type="number" step="any" className={num} value={form.masa_humeda_g ?? ""} onChange={(e) => setField("masa_humeda_g", parseNum(e.target.value))} /></div>
                <div className="grid grid-cols-[1fr_220px] gap-2 items-center"><label className="text-sm">Masa seca</label><input type="number" step="any" className={num} value={form.masa_seca_g ?? ""} onChange={(e) => setField("masa_seca_g", parseNum(e.target.value))} /></div>
                <div className="grid grid-cols-[1fr_220px] gap-2 items-center"><label className="text-sm">Masa seca constante</label><input type="number" step="any" className={num} value={form.masa_seca_constante_g ?? ""} onChange={(e) => setField("masa_seca_constante_g", parseNum(e.target.value))} /></div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_250px] gap-2 items-center"><label className="text-sm">Fecha / hora de inmersion</label><input className={txt} value={form.fecha_hora_inmersion || ""} onChange={(e) => setField("fecha_hora_inmersion", e.target.value)} autoComplete="off" data-lpignore="true" /></div>
                <div className="grid grid-cols-[1fr_250px] gap-2 items-center"><label className="text-sm">Fecha / hora de salida inmersion</label><input className={txt} value={form.fecha_hora_salida_inmersion || ""} onChange={(e) => setField("fecha_hora_salida_inmersion", e.target.value)} autoComplete="off" data-lpignore="true" /></div>
                <div className="grid grid-cols-[1fr_250px] gap-2 items-center"><label className="text-sm">Temp. picnometro y contenido</label><input type="number" step="any" className={num} value={form.temp_picnometro_contenido_c ?? ""} onChange={(e) => setField("temp_picnometro_contenido_c", parseNum(e.target.value))} /></div>
                <div className="grid grid-cols-[1fr_250px] gap-2 items-center"><label className="text-sm">Temp. durante calibracion</label><input type="number" step="any" className={num} value={form.temp_durante_calibracion_c ?? ""} onChange={(e) => setField("temp_durante_calibracion_c", parseNum(e.target.value))} /></div>
              </div>
            </div>
          </div>

          <table className="w-full border-collapse text-sm border-b border-slate-300">
            <thead><tr className="bg-slate-100"><th className="w-12 border border-slate-300"></th><th className="border border-slate-300">Descripcion</th><th className="w-14 border border-slate-300">Und.</th><th className="w-56 border border-slate-300">Ensayo</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="border border-slate-300 text-center">{r.sym}</td>
                  <td className="border border-slate-300 px-2 py-1">{r.desc}</td>
                  <td className="border border-slate-300 text-center">{r.unit}</td>
                  <td className="border border-slate-300 p-1">
                    {r.key === "densidad_relativa_od" || r.key === "densidad_relativa_ssd" || r.key === "densidad_relativa_aparente" ? (
                      <input type="text" className={`${num} bg-slate-50`} value={fixed4((form[r.key] as number | null | undefined) ?? (r.val as number | null) ?? null)} readOnly />
                    ) : r.key === "absorcion_pct" ? (
                      <input type="text" className={`${num} bg-slate-50`} value={fixed2((form[r.key] as number | null | undefined) ?? (r.val as number | null) ?? null)} readOnly />
                    ) : r.key === "valor_d_g" ? (
                      <input type="text" className={num} value={form.valor_d_g || ""} onChange={(e) => setField("valor_d_g", e.target.value)} autoComplete="off" data-lpignore="true" />
                    ) : (
                      <input type="number" step="any" className={`${num} ${r.key === "valor_a_g" ? "bg-slate-50" : ""}`} value={(form[r.key] as number | null | undefined) ?? r.val ?? ""} onChange={(e) => setField(r.key, parseNum(e.target.value))} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="p-3 border-b border-slate-300 grid grid-cols-[1fr_140px] gap-3 items-center">
            <p className="text-sm">La muestra se seco en horno a masa constante a 110 ± 5°C, antes de saturar. (Si o No)</p>
            <select className={txt} value={form.seco_horno_110_si_no || "-"} onChange={(e) => setField("seco_horno_110_si_no", e.target.value as GeFinoPayload["seco_horno_110_si_no"])}><option value="-">-</option><option value="SI">SI</option><option value="NO">NO</option></select>
          </div>

          <div className="p-3 border-b border-slate-300">
            <div className="mx-auto grid max-w-190 grid-cols-2 gap-2 overflow-hidden rounded-lg text-sm">
              {[
                { label: "Balanza 0.1 g", key: "equipo_balanza_01g_codigo" as const },
                { label: "Horno 110°C", key: "equipo_horno_110_codigo" as const },
                { label: "Termometro", key: "equipo_termometro_codigo" as const },
                { label: "Picnometro", key: "equipo_picnometro_codigo" as const },
                { label: "Molde (tronco conico) y pison", key: "equipo_molde_pison_codigo" as const },
              ].map(({ label, key }) => {
                const options = getEquipmentOptions(form[key], EQUIPO_OPTIONS[key])
                return (
                  <div key={key} className="contents">
                    <div className="border border-slate-300 p-2">{label}</div>
                    <div className="border border-slate-300 p-1">
                      {key === "equipo_picnometro_codigo" ? (
                        <input
                          type="text"
                          className={txt}
                          value={form[key] || ""}
                          onChange={(e) => setField(key, e.target.value)}
                          placeholder="-"
                          autoComplete="off"
                          data-lpignore="true"
                        />
                      ) : (
                        <select
                          className={txt}
                          value={form[key] || "-"}
                          onChange={(e) => setField(key, e.target.value)}
                        >
                          {options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="p-3 border-b border-slate-300"><textarea value={form.observaciones || ""} onChange={(e) => setField("observaciones", e.target.value)} rows={3} autoComplete="off" data-lpignore="true" className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35" /></div>

          <div className="grid grid-cols-2 gap-3 p-3">
            <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 space-y-2">
              <p className="text-sm font-semibold">Revisado:</p>
              <select className={txt} value={form.revisado_por || "-"} onChange={(e) => { const v = e.target.value; setField("revisado_por", v); if (v !== "-") { setField("revisado_fecha", normalizeDate(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" }))) } }}>{REVISORES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              <p className="text-sm font-semibold">Fecha:</p>
              <input className={txt} value={form.revisado_fecha || ""} onChange={(e) => setField("revisado_fecha", e.target.value)} onBlur={() => setField("revisado_fecha", normalizeDate(form.revisado_fecha || ""))} autoComplete="off" data-lpignore="true" />
            </div>
            <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 space-y-2">
              <p className="text-sm font-semibold">Aprobado:</p>
              <select className={txt} value={form.aprobado_por || "-"} onChange={(e) => { const v = e.target.value; setField("aprobado_por", v); if (v !== "-") { setField("aprobado_fecha", normalizeDate(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" }))) } }}>{APROBADORES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              <p className="text-sm font-semibold">Fecha:</p>
              <input className={txt} value={form.aprobado_fecha || ""} onChange={(e) => setField("aprobado_fecha", e.target.value)} onBlur={() => setField("aprobado_fecha", normalizeDate(form.aprobado_fecha || ""))} autoComplete="off" data-lpignore="true" />
            </div>
          </div>
        </div>

      </div>
      <FormActionDock
        onSave={() => void save(false)}
        onSaveAndDownload={() => void save(true)}
        onClear={handleRequestClear}
        loading={loading}
      />
      <ConfirmActionModal
        isOpen={isClearDraftModalOpen}
        title="Limpiar datos no guardados"
        message="Se limpiarán los datos no guardados. ¿Deseas continuar?"
        confirmText="Sí, limpiar"
        cancelText="Cancelar"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
      <UnsavedChangesModal
        open={isUnsavedChangesModalOpen}
        onClose={() => setIsUnsavedChangesModalOpen(false)}
        onDiscard={() => {
          setIsUnsavedChangesModalOpen(false)
          onClose?.()
        }}
        onSave={() => {
          void save(false).then(() => {
            setIsUnsavedChangesModalOpen(false)
            onClose?.()
          })
        }}
        isSaving={loading}
      />
    </div>
  )
}
