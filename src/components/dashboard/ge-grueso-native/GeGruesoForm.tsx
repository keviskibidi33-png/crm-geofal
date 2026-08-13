import { useCallback, useEffect, useMemo, useState } from "react"
import { Beaker, Download, Loader2, Save, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import FormActionDock from "../shared/FormActionDock"
import UnsavedChangesModal from "../shared/UnsavedChangesModal"

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

const DRAFT_KEY = "ge_grueso_form_draft_v1"
const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
const REVISORES = ["-", "FABIAN LA ROSA"] as const
const APROBADORES = ["-", "IRMA COAQUIRA"] as const

const TMN = [
  ["4 in", "40"],
  ["3 1/2 in", "25"],
  ["3 in", "18"],
  ["2 1/2", "12"],
  ["2 in", "8"],
  ["1 1/2 in", "5"],
  ["1 in", "4"],
  ["3/4 in", "3"],
  ["1/2 in", "2"],
  ["N°4", "2"],
] as const

type SiNoFlag = "-" | "SI" | "NO"

type EquipoField =
  | "equipo_balanza_1g_codigo"
  | "equipo_horno_110_codigo"
  | "equipo_termometro_01c_codigo"
  | "equipo_canastilla_codigo"
  | "equipo_tamiz_codigo"
  | "equipo_gravedad_especifica_codigo"

const EQUIPO_OPTIONS: Record<EquipoField, readonly string[]> = {
  equipo_balanza_1g_codigo: ["-", "EQP-0050"],
  equipo_horno_110_codigo: ["-", "EQP-0150", "EQP-0049"],
  equipo_termometro_01c_codigo: ["-", "INS-0153"],
  equipo_canastilla_codigo: ["-", "INS-0191"],
  equipo_tamiz_codigo: ["-", "INS-0053 (No 4)", "INS-0053 (No 4) y INS-0048"],
  equipo_gravedad_especifica_codigo: ["-", "EQP-0119"],
}

const getEquipmentOptions = (value: string | null | undefined, base: readonly string[]) => {
  const current = (value ?? "").trim()
  if (!current || base.includes(current)) return base
  return [...base, current]
}

type NumericField =
  | "masa_retenida_malla_1_1_2_pct"
  | "masa_muestra_inicial_total_kg"
  | "masa_fraccion_01_kg"
  | "masa_fraccion_02_kg"
  | "fr1_a_g"
  | "fr1_b_g"
  | "fr1_c_g"
  | "fr1_d1_g"
  | "fr1_d2_g"
  | "fr1_d_g"
  | "fr1_masa_total_g"
  | "fr2_a_g"
  | "fr2_b_g"
  | "fr2_c_g"
  | "fr2_d1_g"
  | "fr2_d2_g"
  | "fr2_d_g"
  | "fr2_masa_total_g"

interface GeGruesoPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    tamano_maximo_nominal?: string | null
    agregado_grupo_ligero_si_no?: SiNoFlag
    retenido_malla_no4_si_no?: SiNoFlag
    retenido_malla_1_1_2_si_no?: SiNoFlag
    fecha_hora_inmersion_inicial?: string | null
    fecha_hora_inmersion_final?: string | null

    equipo_balanza_1g_codigo?: string | null
    equipo_horno_110_codigo?: string | null
    equipo_termometro_01c_codigo?: string | null
    equipo_canastilla_codigo?: string | null
    equipo_tamiz_codigo?: string | null
    equipo_gravedad_especifica_codigo?: string | null

    seco_horno_110_si_no?: SiNoFlag
    ensayada_en_fracciones_si_no?: SiNoFlag
    malla_fraccion?: string | null

    masa_retenida_malla_1_1_2_pct?: number | null
    masa_muestra_inicial_total_kg?: number | null
    masa_fraccion_01_kg?: number | null
    masa_fraccion_02_kg?: number | null

    fr1_a_g?: number | null
    fr1_b_g?: number | null
    fr1_c_g?: number | null
    fr1_d1_g?: number | null
    fr1_d2_g?: number | null
    fr1_d_g?: number | null
    fr1_masa_total_g?: number | null

    fr2_a_g?: number | null
    fr2_b_g?: number | null
    fr2_c_g?: number | null
    fr2_d1_g?: number | null
    fr2_d2_g?: number | null
    fr2_d_g?: number | null
    fr2_masa_total_g?: number | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const init = (): GeGruesoPayload => ({
  muestra: "",
  numero_ot: "",
  fecha_ensayo: "",
  realizado_por: "",
  tamano_maximo_nominal: "",
  agregado_grupo_ligero_si_no: "-",
  retenido_malla_no4_si_no: "-",
  retenido_malla_1_1_2_si_no: "-",
  fecha_hora_inmersion_inicial: "",
  fecha_hora_inmersion_final: "",
  equipo_balanza_1g_codigo: "-",
  equipo_horno_110_codigo: "-",
  equipo_termometro_01c_codigo: "-",
  equipo_canastilla_codigo: "-",
  equipo_tamiz_codigo: "-",
  equipo_gravedad_especifica_codigo: "-",
  seco_horno_110_si_no: "-",
  ensayada_en_fracciones_si_no: "-",
  malla_fraccion: "",
  masa_retenida_malla_1_1_2_pct: null,
  masa_muestra_inicial_total_kg: null,
  masa_fraccion_01_kg: null,
  masa_fraccion_02_kg: null,
  fr1_a_g: null,
  fr1_b_g: null,
  fr1_c_g: null,
  fr1_d1_g: null,
  fr1_d2_g: null,
  fr1_d_g: null,
  fr1_masa_total_g: null,
  fr2_a_g: null,
  fr2_b_g: null,
  fr2_c_g: null,
  fr2_d1_g: null,
  fr2_d2_g: null,
  fr2_d_g: null,
  fr2_masa_total_g: null,
  observaciones: "",
  revisado_por: "-",
  revisado_fecha: "",
  aprobado_por: "-",
  aprobado_fecha: "",
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

const n = (value: unknown): number | null => {
  if (value === "" || value == null) return null
  const out = Number(normalizeNumericText(String(value)))
  return Number.isFinite(out) ? out : null
}

const y2 = () => new Date().getFullYear().toString().slice(-2)
const normDate = (raw: string) => {
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

const parseMuestraCode = (muestra: string, defaultType: 'SU' | 'AG' = 'SU') => {
    const clean = (muestra || '').trim().toUpperCase().replace(/\s+/g, '')
    const currentYear = new Date().getFullYear().toString().slice(-2)
    if (!clean) return { number: '', type: defaultType, year: currentYear }

    const parts = clean.split('-')
    
    let type: 'SU' | 'AG' = defaultType
    if (clean.includes('-SU')) {
        type = 'SU'
    } else if (clean.includes('-AG')) {
        type = 'AG'
    }

    const filteredParts = parts.filter(p => p !== 'SU' && p !== 'AG')

    let number = ''
    let year = currentYear

    if (filteredParts.length === 0) {
        return { number: '', type, year }
    }

    if (filteredParts.length === 1) {
        number = filteredParts[0]
    } else {
        const last = filteredParts[filteredParts.length - 1]
        if (/^\d{2,4}$/.test(last)) {
            year = last.slice(-2)
            number = filteredParts.slice(0, -1).join('-')
        } else {
            number = filteredParts.join('-')
        }
    }

    return { number, type, year }
}

const buildMuestraCode = (number: string, type: 'SU' | 'AG', year: string) => {
    const cleanNum = number.trim()
    if (!cleanNum) return ''
    return `${cleanNum}-${type}-${year}`
}

const normOt = (raw: string) => {
  const c = raw.trim().toUpperCase().replace(/\s+/g, "")
  const m = c.match(/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/) || c.match(/^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/)
  return m ? `${m[1]}-${m[2] || y2()}` : raw.trim().toUpperCase()
}

const round4 = (v: number | null) => (v == null ? null : Number(v.toFixed(4)))
const sum = (arr: Array<number | null | undefined>): number | null => {
  const values = arr.filter((x): x is number => typeof x === "number")
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0)
}

function SiNo({ value, onChange }: { value: SiNoFlag | undefined; onChange: (v: SiNoFlag) => void }) {
  const v = value ?? "-"
  const btn = (t: SiNoFlag) =>
    `rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-500/35 ${v === t ? "border-slate-400 bg-slate-100 text-slate-900" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`
  const box = (t: SiNoFlag) =>
    `ml-1 inline-flex h-4 w-4 items-center justify-center rounded-sm border ${v === t ? "border-slate-500 text-slate-700" : "border-slate-300 text-slate-700"}`
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={btn("-")} onClick={() => onChange("-")}>
        -
      </button>
      <button type="button" className={btn("SI")} onClick={() => onChange("SI")}>
        SI <span className={box("SI")}>{v === "SI" ? "X" : ""}</span>
      </button>
      <button type="button" className={btn("NO")} onClick={() => onChange("NO")}>
        NO <span className={box("NO")}>{v === "NO" ? "X" : ""}</span>
      </button>
    </div>
  )
}

function Report({
  title,
  values,
  setNum,
  d1,
  d2,
  setDBox,
  totalAuto,
  totalValue,
  totalField,
  input,
}: {
  title: string
  values: { a: number | null | undefined; b: number | null | undefined; c: number | null | undefined; d: number | null | undefined }
  setNum: (field: NumericField, raw: string) => void
  d1: number | null | undefined
  d2: number | null | undefined
  setDBox: (box: "box1" | "box2", raw: string) => void
  totalAuto: number | null
  totalValue: number | null
  totalField: NumericField
  input: string
}) {
  return (
    <div className="border-b border-slate-300 p-2">
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="w-10 border border-slate-300"></th>
            <th className="border border-slate-300">Descripción</th>
            <th className="w-16 border border-slate-300">Und</th>
            <th className="w-56 border border-slate-300">Datos</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["A", "Masa de la muestra secada al horno", "a", values.a],
            ["B", "Masa de la muestra secada al horno constante", "b", values.b],
            ["C", "Masa de la muestra de ensayo de superficie seca saturada", "c", values.c],
            ["D", "Masa aparente de la muestra de prueba sumergida en agua", "d", values.d],
          ].map(([sym, label, k, val]) => (
            <tr key={String(k)}>
              <td className="border border-slate-300 text-center">{sym}</td>
              <td className="border border-slate-300 px-2 py-1">{label}</td>
              <td className="border border-slate-300 text-center">g</td>
              <td className="border border-slate-300 p-1">
                {k === "d" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      className={input}
                      value={d1 ?? ""}
                      onChange={(e) => setDBox("box1", e.target.value)}
                      placeholder="Caja 1"
                    />
                    <input
                      type="number"
                      step="any"
                      className={input}
                      value={d2 ?? ""}
                      onChange={(e) => setDBox("box2", e.target.value)}
                      placeholder="Caja 2"
                    />
                  </div>
                ) : (
                  <input type="number" step="any" className={input} value={(val as number | null | undefined) ?? ""} onChange={(e) => setNum(`${title.startsWith("1") ? "fr1" : "fr2"}_${k}_g` as NumericField, e.target.value)} />
                )}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-slate-300" colSpan={2}></td>
            <td className="border border-slate-300 px-2 py-1 text-right font-semibold">Masa total =</td>
            <td className="border border-slate-300 p-1">
              <input type="number" step="any" className={`${input} bg-slate-50`} value={totalValue ?? totalAuto ?? ""} onChange={(e) => setNum(totalField, e.target.value)} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export interface GeGruesoFormProps {
  editId?: number | null
  onClose?: () => void
  onSaved?: () => void
}

export default function GeGruesoForm({ editId, onClose, onSaved }: GeGruesoFormProps) {
  const [form, setForm] = useState<GeGruesoPayload>(() => init())
  const [loading, setLoading] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [ensayoId, setEnsayoId] = useState<number | null>(editId ?? null)
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = useState(false)

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(init())
  }, [form])

  const handleRequestClose = useCallback(() => {
    if (isDirty) {
      setIsUnsavedChangesModalOpen(true)
    } else {
      onClose?.()
    }
  }, [isDirty, onClose])

  const [muestraInput, setMuestraInput] = useState('')
  const [muestraType, setMuestraType] = useState<'SU' | 'AG'>('AG')
  const [muestraYear, setMuestraYear] = useState(() => new Date().getFullYear().toString().slice(-2))

  useEffect(() => {
    setEnsayoId(editId ?? null)
  }, [editId])

  useEffect(() => {
    if (form.muestra && !muestraInput) {
        const { number, type, year } = parseMuestraCode(form.muestra, 'AG')
        const currentYear = new Date().getFullYear().toString().slice(-2)
        setMuestraInput(number)
        setMuestraType(type)
        setMuestraYear(year || currentYear)
    }
  }, [form.muestra, muestraInput])

  useEffect(() => {
    if (!form.muestra) {
        setMuestraInput('')
        setMuestraType('AG')
        setMuestraYear(new Date().getFullYear().toString().slice(-2))
    }
  }, [form.muestra])

  const handleMuestraInputChange = (val: string) => {
    setMuestraInput(val)
    const { number, year } = parseMuestraCode(val, muestraType)
    const nextYear = year || muestraYear || new Date().getFullYear().toString().slice(-2)
    setMuestraYear(nextYear)
    const newCode = buildMuestraCode(number, muestraType, nextYear)
    setField('muestra', newCode)
  }

  const handleTypeToggle = (newType: 'SU' | 'AG') => {
    setMuestraType(newType)
    const { number, year } = parseMuestraCode(muestraInput, newType)
    const nextYear = year || muestraYear || new Date().getFullYear().toString().slice(-2)
    setMuestraYear(nextYear)
    const newCode = buildMuestraCode(number, newType, nextYear)
    setField('muestra', newCode)
  }

  const handleYearChange = (rawYear: string) => {
    const digits = rawYear.replace(/\D/g, '').slice(-2)
    setMuestraYear(digits)
    const { number } = parseMuestraCode(muestraInput, muestraType)
    const nextYear = digits ? (digits.length === 1 ? `0${digits}` : digits) : new Date().getFullYear().toString().slice(-2)
    const newCode = buildMuestraCode(number, muestraType, nextYear)
    setField('muestra', newCode)
  }

  const handleYearBlur = () => {
    const digits = muestraYear.replace(/\D/g, '').slice(-2)
    const nextYear = digits ? (digits.length === 1 ? `0${digits}` : digits) : new Date().getFullYear().toString().slice(-2)
    setMuestraYear(nextYear)
    const { number } = parseMuestraCode(muestraInput, muestraType)
    const newCode = buildMuestraCode(number, muestraType, nextYear)
    setField('muestra', newCode)
  }

  const setField = useCallback(<K extends keyof GeGruesoPayload>(k: K, v: GeGruesoPayload[K]) => setForm((p) => ({ ...p, [k]: v })), [])
  const setNum = useCallback((k: NumericField, raw: string) => setField(k, n(raw) as GeGruesoPayload[NumericField]), [setField])
  const setDBox = useCallback(
    (fraction: "fr1" | "fr2", box: "box1" | "box2", raw: string) => {
      const parsed = n(raw)
      const d1Field = `${fraction}_d1_g` as keyof GeGruesoPayload
      const d2Field = `${fraction}_d2_g` as keyof GeGruesoPayload
      const dField = `${fraction}_d_g` as keyof GeGruesoPayload
      setForm((p) => {
        const d1 = box === "box1" ? parsed : (p[d1Field] as number | null)
        const d2 = box === "box2" ? parsed : (p[d2Field] as number | null)
        const total = sum([d1, d2])
        return {
          ...p,
          [d1Field]: d1,
          [d2Field]: d2,
          [dField]: total,
        }
      })
    },
    [setForm],
  )

  const fr1Auto = useMemo(() => round4(form.fr1_d_g ?? null), [form.fr1_d_g])
  const fr2Auto = useMemo(() => round4(form.fr2_d_g ?? null), [form.fr2_d_g])
  const muestraCodigoPreview = useMemo(() => {
    const number = muestraInput.trim()
    if (!number) return ""
    return buildMuestraCode(number, muestraType, muestraYear || new Date().getFullYear().toString().slice(-2))
  }, [muestraInput, muestraType, muestraYear])

  useEffect(() => {
    if (ensayoId) return
    const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
    if (!raw) return
    try {
      const hydrated = { ...init(), ...JSON.parse(raw) } as GeGruesoPayload
      hydrated.fecha_ensayo = normDate(hydrated.fecha_ensayo || "")
      if (hydrated.fr1_d1_g === undefined && hydrated.fr1_d_g !== null) {
        hydrated.fr1_d1_g = hydrated.fr1_d_g
      }
      if (hydrated.fr2_d1_g === undefined && hydrated.fr2_d_g !== null) {
        hydrated.fr2_d1_g = hydrated.fr2_d_g
      }
      setForm(hydrated)
    } catch {
      localStorage.removeItem(`${DRAFT_KEY}:new`)
    }
  }, [ensayoId])

  useEffect(() => {
    const t = window.setTimeout(() => localStorage.setItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`, JSON.stringify(form)), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [ensayoId, form])

  useEffect(() => {
    if (!ensayoId) return
    let cancelled = false
    const run = async () => {
      setLoadingEdit(true)
      try {
        const res = await authFetch(`${API_URL}/api/ge-grueso/${ensayoId}`)
        if (!res.ok) throw new Error("Error al cargar")
        const detail = await res.json()
        if (!cancelled && detail) {
          const payload = detail.payload || (detail as any)
          const merged: GeGruesoPayload = {
            ...init(),
            muestra: detail.muestra || payload.muestra || "",
            numero_ot: detail.numero_ot || payload.numero_ot || "",
            cliente: detail.cliente || payload.cliente || "",
            fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || "",
            realizado_por: payload.realizado_por || "OPERADOR",
            ...payload,
          }
          merged.fecha_ensayo = normDate(merged.fecha_ensayo || "")
          if (merged.fr1_d1_g === undefined && merged.fr1_d_g !== null) {
            merged.fr1_d1_g = merged.fr1_d_g
          }
          if (merged.fr2_d1_g === undefined && merged.fr2_d_g !== null) {
            merged.fr2_d1_g = merged.fr2_d_g
          }
          setForm(merged)
          if (merged.muestra) {
            const { number, type, year } = parseMuestraCode(merged.muestra, 'AG')
            setMuestraInput(number)
            setMuestraType(type)
            setMuestraYear(year || new Date().getFullYear().toString().slice(-2))
          }
        }
      } catch {
        toast.error("No se pudo cargar ensayo GE Grueso para edicion.")
      } finally {
        if (!cancelled) setLoadingEdit(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [ensayoId])

  const save = useCallback(
    async (download: boolean) => {
      if (!form.muestra || !form.numero_ot || !form.realizado_por || !form.fecha_ensayo) {
        return toast.error("Complete Muestra, N OT, Fecha de ensayo y Realizado por.")
      }
      setLoading(true)
      try {
        const payload: GeGruesoPayload = { ...form, fr1_masa_total_g: form.fr1_masa_total_g ?? fr1Auto, fr2_masa_total_g: form.fr2_masa_total_g ?? fr2Auto }
        let savedId = ensayoId

        if (download) {
          const url = `${API_URL}/api/ge-grueso/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
          const res = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (!res.ok) throw new Error("Error al generar Excel")
          const blob = await res.blob()
          const link = document.createElement("a")
          link.href = URL.createObjectURL(blob)
          link.download = `${buildFormatPreview(form.muestra, muestraType, 'GE GRUESO')}.xlsx`
          link.click()
          URL.revokeObjectURL(link.href)

          localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`)
          toast.success("GE Grueso guardado y descargado.")
          onSaved?.()
          onClose?.()
        } else {
          const url = `${API_URL}/api/ge-grueso/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
          toast.success("GE Grueso guardado. Puedes seguir editando.")
          onSaved?.()
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Error guardando GE Grueso"
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    },
    [ensayoId, form, fr1Auto, fr2Auto, muestraType, onClose, onSaved],
  )

  const clear = () => {
    if (!window.confirm("Se limpiaran los datos no guardados. ¿Deseas continuar?")) return
    localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? "new"}`)
    setForm(init())
  }

  const text = "h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500/35"
  const topHeaders = ["MUESTRA", "N° OT", "FECHA", "REALIZADO"]

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
                                Gravedad Específica Grueso — ASTM C127-25
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-AG-19.01</p>
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
          <div className="space-y-2 border-b border-slate-300 px-3 py-4 text-center"><p className="text-[30px] font-semibold text-slate-800">LABORATORIO DE ENSAYO DE MATERIALES</p><p className="text-2xl font-semibold text-slate-800">FORMATO N° F-LEM-P-AG-28.01</p></div>

          <div className="px-3 py-3">
            <div className="mx-auto max-w-[900px] overflow-hidden rounded-lg border border-slate-300">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] bg-white text-center text-xs font-semibold uppercase tracking-wide">
                {topHeaders.map((h, i) => (
                  <div key={h} className={`${i < 3 ? "border-r border-slate-300" : ""} py-1`}>
                    {h}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-t border-slate-300">
                <div className="border-r border-slate-300 p-1">
                  <div className="flex min-w-0 flex-col gap-1 px-0.5">
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_88px_18px_56px] gap-1.5">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código</span>
                        <input
                          className={`${text} min-w-0 text-center font-mono tracking-wide`}
                          value={muestraInput}
                          onChange={(e) => handleMuestraInputChange(e.target.value)}
                          autoComplete="off"
                          data-lpignore="true"
                          placeholder="1234"
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-center text-slate-500">Tipo</span>
                        <div className="flex h-9 items-center rounded-md border border-slate-300 bg-background px-1.5">
                          <select
                            value={muestraType}
                            onChange={(e) => handleTypeToggle(e.target.value as "SU" | "AG")}
                            className="h-7 w-full rounded-md border-0 bg-transparent px-2 text-xs font-bold uppercase text-slate-700 focus:outline-none focus:ring-0"
                            aria-label="Tipo de muestra"
                          >
                            <option value="SU">SU</option>
                            <option value="AG">AG</option>
                          </select>
                        </div>
                      </div>
                      <span className="flex items-end justify-center pb-3 text-sm font-semibold text-slate-500">-</span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-center text-slate-500">Año</span>
                        <div className="flex h-9 items-center rounded-md border border-slate-300 bg-background px-1.5">
                          <input
                            type="text"
                            value={muestraYear}
                            onChange={(e) => handleYearChange(e.target.value)}
                            onBlur={handleYearBlur}
                            maxLength={2}
                            inputMode="numeric"
                            aria-label="Año de muestra"
                            className="h-7 w-full rounded-md border-0 bg-transparent px-2 text-center text-xs font-bold text-slate-700 focus:outline-none focus:ring-0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="px-1 text-[11px] leading-tight text-slate-500">
                      Se guardará como{" "}
                      <span className="font-mono font-semibold text-slate-700">
                        {muestraCodigoPreview || `${muestraInput || "1234"}-${muestraType}-${muestraYear}`}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="border-r border-slate-300 p-1">
                  <input
                    className={`${text} text-center`}
                    value={form.numero_ot}
                    onChange={(e) => setField("numero_ot", e.target.value)}
                    onBlur={() => setField("numero_ot", normOt(form.numero_ot || ""))}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
                <div className="border-r border-slate-300 p-1">
                  <input
                    className={`${text} text-center`}
                    value={form.fecha_ensayo}
                    onChange={(e) => setField("fecha_ensayo", e.target.value)}
                    onBlur={() => setField("fecha_ensayo", normDate(form.fecha_ensayo || ""))}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
                <div className="p-1">
                  <input
                    className={`${text} text-center`}
                    value={form.realizado_por}
                    onChange={(e) => setField("realizado_por", e.target.value)}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-y border-slate-300 bg-slate-100 px-3 py-2 text-center">
            <p className="mx-auto max-w-5xl text-balance text-[18px] font-semibold leading-tight text-slate-800 md:text-[26px]">
              Standard Test Method for Relative Density (Specific Gravity) and Absorption of Coarse Aggregate
            </p>
            <p className="text-[22px] font-semibold leading-tight text-slate-800 md:text-[32px]">ASTM C127-25</p>
          </div>

          <div className="grid grid-cols-1 gap-3 border-b border-slate-300 p-3 xl:grid-cols-[1.55fr_0.9fr_0.75fr]">
            <div className="overflow-hidden rounded-lg border border-slate-300">
              <div className="border-b border-slate-300 bg-slate-100 py-1 text-center text-xs font-semibold">Descripción de la muestra</div>
              {[
                { label: "- Tamaño máximo nominal", control: <input key="tamano_maximo" className={text} value={form.tamano_maximo_nominal || ""} onChange={(e) => setField("tamano_maximo_nominal", e.target.value)} autoComplete="off" data-lpignore="true" /> },
                { label: "- Agregado Grupo II(Ligero) (*)", control: <SiNo key="grupo_ligero" value={form.agregado_grupo_ligero_si_no} onChange={(v) => setField("agregado_grupo_ligero_si_no", v)} /> },
                { label: "- Retenido en la malla No 4 (1)", control: <SiNo key="ret_no4" value={form.retenido_malla_no4_si_no} onChange={(v) => setField("retenido_malla_no4_si_no", v)} /> },
                { label: "- Retenido en la malla 1 1/2 in (2)", control: <SiNo key="ret_1_1_2" value={form.retenido_malla_1_1_2_si_no} onChange={(v) => setField("retenido_malla_1_1_2_si_no", v)} /> },
                { label: "- Fecha/ hora de inmersión Inicial", control: <input key="inmersion_ini" className={text} value={form.fecha_hora_inmersion_inicial || ""} onChange={(e) => setField("fecha_hora_inmersion_inicial", e.target.value)} autoComplete="off" data-lpignore="true" /> },
                { label: "- Fecha/ hora de inmersión Final", control: <input key="inmersion_fin" className={text} value={form.fecha_hora_inmersion_final || ""} onChange={(e) => setField("fecha_hora_inmersion_final", e.target.value)} autoComplete="off" data-lpignore="true" /> },
              ].map(({ label, control }, i) => (
                <div key={label} className={`grid grid-cols-[1fr_240px] ${i < 5 ? "border-b border-slate-300" : ""}`}>
                  <div className="p-2 text-sm">{label}</div>
                  <div className="border-l border-slate-300 p-1">{control}</div>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-300">
              <div className="grid grid-cols-2 bg-slate-100 text-center text-xs font-semibold"><div className="border-r border-slate-300 py-1">Equipo utilizado</div><div className="py-1">Código</div></div>
              {[
                { label: "Balanza 1 g", key: "equipo_balanza_1g_codigo" as const },
                { label: "Horno 110 °C", key: "equipo_horno_110_codigo" as const },
                { label: "Termómetro 0.1°C", key: "equipo_termometro_01c_codigo" as const },
                { label: "Canastilla", key: "equipo_canastilla_codigo" as const },
                { label: "Tamiz", key: "equipo_tamiz_codigo" as const },
                { label: "Equipo Gravedad Específica", key: "equipo_gravedad_especifica_codigo" as const },
              ].map(({ label, key }, i) => {
                const currentValue = form[key] || "-"
                const options = getEquipmentOptions(currentValue, EQUIPO_OPTIONS[key])
                return (
                  <div key={key} className={`grid grid-cols-2 ${i < 5 ? "border-t border-slate-300" : ""}`}>
                    <div className="border-r border-slate-300 p-2 text-sm">{label}</div>
                    <div className="p-1">
                      <select className={text} value={currentValue} onChange={(e) => setField(key, e.target.value)}>
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-300">
              <div className="grid grid-cols-2 bg-slate-100 text-center text-xs font-semibold"><div className="border-r border-slate-300 py-1">TMN<br />(in.)</div><div className="py-1">MASA MINIMA<br />(kg)</div></div>
              {TMN.map(([a, b], i) => <div key={`${a}-${b}`} className={`grid grid-cols-2 text-center text-sm ${i < TMN.length - 1 ? "border-t border-slate-300" : ""}`}><div className="border-r border-slate-300 py-1">{a}</div><div className="py-1">{b}</div></div>)}
              <div className="border-t border-slate-300 py-1 text-center text-xs">Fuente: Norma ASTM C127-24</div>
            </div>
          </div>

          <div className="border-b border-slate-300 px-3 py-2 text-xs">(*) Ejm. Pómez(72h ±4h) - P. Inmersión; (1) Uso de malla No. 4 en el ensayo; (2) Realizar Fraccionamiento &gt;15%.</div>

          <div className="grid grid-cols-1 border-b border-slate-300 xl:grid-cols-2">
            <div className="border-r-0 border-slate-300 p-2 xl:border-r">
              <div className="mb-1 text-sm font-semibold">Condiciones del ensayo</div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_220px] items-center gap-2"><label className="text-sm">- La muestra se secó en horno a masa constante a 110 ± 5°C, antes de saturar</label><SiNo value={form.seco_horno_110_si_no} onChange={(v) => setField("seco_horno_110_si_no", v)} /></div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-2"><label className="text-sm">- La muestra fue ensayada en fracciones</label><SiNo value={form.ensayada_en_fracciones_si_no} onChange={(v) => setField("ensayada_en_fracciones_si_no", v)} /></div>
                <div className="grid grid-cols-[1fr_220px] items-center gap-2"><label className="text-sm">- Malla de fracción</label><input className={text} value={form.malla_fraccion || ""} onChange={(e) => setField("malla_fraccion", e.target.value)} autoComplete="off" data-lpignore="true" /></div>
              </div>
            </div>
            <div className="p-2">
              {[
                ["Masa retenido de malla 1 1/2 in Porcentaje (%)", "masa_retenida_malla_1_1_2_pct"],
                ["Masa de la muestra inicial total (kg)", "masa_muestra_inicial_total_kg"],
                ["Masa de la fracción N°01 (kg)", "masa_fraccion_01_kg"],
                ["Masa de la fracción N°02 (kg)", "masa_fraccion_02_kg"],
              ].map(([label, key]) => <div key={key as string} className="grid grid-cols-[1fr_180px] items-center gap-2 pb-2"><label className="text-sm">{label as string}</label><input type="number" step="any" className={text} value={(form[key as keyof GeGruesoPayload] as number | null | undefined) ?? ""} onChange={(e) => setNum(key as NumericField, e.target.value)} /></div>)}
            </div>
          </div>

          <div className="border-b border-slate-300 bg-slate-100 px-3 py-2 text-center text-sm font-bold">REPORTE DE DATOS DE ENSAYO</div>
          <Report
            title="1° Fracción"
            values={{ a: form.fr1_a_g, b: form.fr1_b_g, c: form.fr1_c_g, d: form.fr1_d_g }}
            setNum={setNum}
            d1={form.fr1_d1_g}
            d2={form.fr1_d2_g}
            setDBox={(box, raw) => setDBox("fr1", box, raw)}
            totalAuto={fr1Auto}
            totalValue={form.fr1_masa_total_g ?? null}
            totalField="fr1_masa_total_g"
            input={text}
          />
          <Report
            title="2° Fracción"
            values={{ a: form.fr2_a_g, b: form.fr2_b_g, c: form.fr2_c_g, d: form.fr2_d_g }}
            setNum={setNum}
            d1={form.fr2_d1_g}
            d2={form.fr2_d2_g}
            setDBox={(box, raw) => setDBox("fr2", box, raw)}
            totalAuto={fr2Auto}
            totalValue={form.fr2_masa_total_g ?? null}
            totalField="fr2_masa_total_g"
            input={text}
          />

          <div className="border-b border-slate-300 px-3 py-2 text-sm"><span className="font-semibold">Nota:</span> La muestra de prueba se enfriará en un período de 1 a 3 horas a temperatura ambiente para agregados hasta 1 1/2 in TMN o hasta que sea manipulable.</div>
          <div className="border-b border-slate-300 p-3"><div className="mb-1 text-sm font-semibold">Observaciones:</div><textarea className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500/35" rows={3} value={form.observaciones || ""} onChange={(e) => setField("observaciones", e.target.value)} autoComplete="off" data-lpignore="true" /></div>

          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-100 p-3">
              <p className="text-sm font-semibold">Revisado:</p>
              <select className={text} value={form.revisado_por || "-"} onChange={(e) => {
                const v = e.target.value;
                setField("revisado_por", v);
                if (v !== "-") {
                  setField("revisado_fecha", normDate(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" })));
                } else {
                  setField("revisado_fecha", "");
                }
              }}>{REVISORES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              <p className="text-sm font-semibold">Fecha:</p>
              <input className={text} value={form.revisado_fecha || ""} onChange={(e) => setField("revisado_fecha", e.target.value)} onBlur={() => setField("revisado_fecha", normDate(form.revisado_fecha || ""))} autoComplete="off" data-lpignore="true" />
            </div>
            <div className="space-y-2 rounded-lg border border-slate-300 bg-slate-100 p-3">
              <p className="text-sm font-semibold">Aprobado:</p>
              <select className={text} value={form.aprobado_por || "-"} onChange={(e) => {
                const v = e.target.value;
                setField("aprobado_por", v);
                if (v !== "-") {
                  setField("aprobado_fecha", normDate(new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" })));
                } else {
                  setField("aprobado_fecha", "");
                }
              }}>{APROBADORES.map((x) => <option key={x} value={x}>{x}</option>)}</select>
              <p className="text-sm font-semibold">Fecha:</p>
              <input className={text} value={form.aprobado_fecha || ""} onChange={(e) => setField("aprobado_fecha", e.target.value)} onBlur={() => setField("aprobado_fecha", normDate(form.aprobado_fecha || ""))} autoComplete="off" data-lpignore="true" />
            </div>
          </div>
        </div>

      </div>
      <FormActionDock
        onSave={() => void save(false)}
        onSaveAndDownload={() => void save(true)}
        onClear={clear}
        loading={loading}
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
