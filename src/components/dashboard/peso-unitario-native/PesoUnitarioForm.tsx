import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Loader2, Save, Scale, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import FormActionDock from '../shared/FormActionDock'
import UnsavedChangesModal from '../shared/UnsavedChangesModal'

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

const DRAFT_KEY = 'peso_unitario_form_draft_v1'
const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const
const empty3 = () => [null, null, null] as Array<number | null>

const EQUIPO_OPTIONS = {
  equipo_molde_codigo: ['-', 'INS-0005 (MOLDE 1)', 'INS-0004 (MOLDE 2)', 'INS-0003 (MOLDE 3)', 'INS-0135 (MOLDE 4)'],
  equipo_balanza_codigo: ['-', 'EQP-0054 (MOLDE 1-2)', 'EQP-0059 (MOLDE 3-4)'],
  equipo_varilla_codigo: ['-', 'INS-0132'],
  equipo_horno_codigo: ['-', 'EQP-0150', 'EQP-0049'],
} as const

export interface PesoUnitarioPayload {
    muestra: string
    numero_ot: string
    cliente?: string | null
    fecha_ensayo: string
    realizado_por: string

    recipiente_molde_numero?: string | null
    recipiente_masa_medida_kg?: number | null
    recipiente_volumen_m3?: number | null
    metodo_compactacion?: "A" | "B" | "C" | "-" | null

    tipo_muestra?: string | null
    tamano_maximo_nominal_visual_in?: string | null
    masa_agregado_g?: number | null
    masa_agregado_seco_g?: number | null
    masa_agregado_seco_constante_g?: number | null

    prueba_d_masa_agregado_mas_medida_kg: Array<number | null>
    prueba_e_masa_agregado_kg: Array<number | null>
    prueba_f_densidad_aparente_kg_m3: Array<number | null>
    densidad_aparente_promedio_kg_m3?: number | null

    vacios_i_gravedad_especifica_base_seca: Array<number | null>
    vacios_j_densidad_agua_kg_m3: Array<number | null>
    vacios_k_porcentaje: Array<number | null>
    vacios_promedio_pct?: number | null

    equipo_molde_codigo?: string | null
    equipo_balanza_codigo?: string | null
    equipo_varilla_codigo?: string | null
    equipo_horno_codigo?: string | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const withCurrentOption = (value: string | null | undefined, base: readonly string[]) => {
  const current = (value ?? '').trim()
  if (!current || base.includes(current)) return base
  return [...base, current]
}

type TripleFieldKey =
  | 'prueba_d_masa_agregado_mas_medida_kg'
  | 'prueba_e_masa_agregado_kg'
  | 'prueba_f_densidad_aparente_kg_m3'
  | 'vacios_i_gravedad_especifica_base_seca'
  | 'vacios_j_densidad_agua_kg_m3'
  | 'vacios_k_porcentaje'

const parseNum = (v: string) => {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const shortYear = () => new Date().getFullYear().toString().slice(-2)

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

const normalizeNumeroOtCode = (raw: string): string => {
  const value = raw.trim().toUpperCase()
  if (!value) return ''
  const compact = value.replace(/\s+/g, '')
  const patterns = [/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/, /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/]
  for (const pattern of patterns) {
    const m = compact.match(pattern)
    if (m) return `${m[1]}-${m[2] || shortYear()}`
  }
  return value
}

const normalizeFlexibleDate = (raw: string): string => {
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

const initialState = (): PesoUnitarioPayload => ({
  muestra: '',
  numero_ot: '',
  fecha_ensayo: '',
  realizado_por: '',
  recipiente_molde_numero: '',
  recipiente_masa_medida_kg: null,
  recipiente_volumen_m3: null,
  metodo_compactacion: '-',
  tipo_muestra: '',
  tamano_maximo_nominal_visual_in: '',
  masa_agregado_g: null,
  masa_agregado_seco_g: null,
  masa_agregado_seco_constante_g: null,
  prueba_d_masa_agregado_mas_medida_kg: empty3(),
  prueba_e_masa_agregado_kg: empty3(),
  prueba_f_densidad_aparente_kg_m3: empty3(),
  densidad_aparente_promedio_kg_m3: null,
  vacios_i_gravedad_especifica_base_seca: empty3(),
  vacios_j_densidad_agua_kg_m3: empty3(),
  vacios_k_porcentaje: empty3(),
  vacios_promedio_pct: null,
  equipo_molde_codigo: '-',
  equipo_balanza_codigo: '-',
  equipo_varilla_codigo: '-',
  equipo_horno_codigo: '-',
  observaciones: '',
  revisado_por: '-',
  revisado_fecha: '',
  aprobado_por: '-',
  aprobado_fecha: '',
})

function avg(values: Array<number | null>): number | null {
  const arr = values.filter((v): v is number => v !== null)
  return arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4)) : null
}

function preparePayload(payload: PesoUnitarioPayload): PesoUnitarioPayload {
  const next: PesoUnitarioPayload = {
    ...payload,
    prueba_d_masa_agregado_mas_medida_kg: [...payload.prueba_d_masa_agregado_mas_medida_kg],
    prueba_e_masa_agregado_kg: [...payload.prueba_e_masa_agregado_kg],
    prueba_f_densidad_aparente_kg_m3: [...payload.prueba_f_densidad_aparente_kg_m3],
    vacios_i_gravedad_especifica_base_seca: [...payload.vacios_i_gravedad_especifica_base_seca],
    vacios_j_densidad_agua_kg_m3: [...payload.vacios_j_densidad_agua_kg_m3],
    vacios_k_porcentaje: [...payload.vacios_k_porcentaje],
  }

  for (let i = 0; i < 3; i += 1) {
    const d = next.prueba_d_masa_agregado_mas_medida_kg[i]
    if (next.prueba_e_masa_agregado_kg[i] == null && d != null && next.recipiente_masa_medida_kg != null) {
      next.prueba_e_masa_agregado_kg[i] = Number((d - next.recipiente_masa_medida_kg).toFixed(4))
    }

    const e = next.prueba_e_masa_agregado_kg[i]
    if (next.prueba_f_densidad_aparente_kg_m3[i] == null && e != null && next.recipiente_volumen_m3) {
      next.prueba_f_densidad_aparente_kg_m3[i] = Number((e / next.recipiente_volumen_m3).toFixed(4))
    }

    const iVal = next.vacios_i_gravedad_especifica_base_seca[i]
    const jVal = next.vacios_j_densidad_agua_kg_m3[i]
    const fVal = next.prueba_f_densidad_aparente_kg_m3[i]
    if (next.vacios_k_porcentaje[i] == null && iVal != null && jVal != null && fVal != null && iVal * jVal !== 0) {
      next.vacios_k_porcentaje[i] = Number((100 * ((iVal * jVal - fVal) / (iVal * jVal))).toFixed(4))
    }
  }

  if (next.densidad_aparente_promedio_kg_m3 == null) next.densidad_aparente_promedio_kg_m3 = avg(next.prueba_f_densidad_aparente_kg_m3)
  if (next.vacios_promedio_pct == null) next.vacios_promedio_pct = avg(next.vacios_k_porcentaje)
  return next
}

const inputClass = 'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

export interface PesoUnitarioFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function PesoUnitarioForm({ editId, onClose, onSaved }: PesoUnitarioFormProps) {
  const [form, setForm] = useState<PesoUnitarioPayload>(() => initialState())
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

  const [muestraInput, setMuestraInput] = useState('')
  const [muestraType, setMuestraType] = useState<'SU' | 'AG'>('SU')
  const [muestraYear, setMuestraYear] = useState(() => new Date().getFullYear().toString().slice(-2))

  useEffect(() => {
    setEnsayoId(editId ?? null)
  }, [editId])

  useEffect(() => {
    if (form.muestra && !muestraInput) {
      const { number, type, year } = parseMuestraCode(form.muestra, 'SU')
      const currentYear = new Date().getFullYear().toString().slice(-2)
      setMuestraInput(number)
      setMuestraType(type)
      setMuestraYear(year || currentYear)
    }
  }, [form.muestra, muestraInput])

  useEffect(() => {
    if (!form.muestra) {
      setMuestraInput('')
      setMuestraType('SU')
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

  useEffect(() => {
    if (ensayoId) return
    const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
    if (!raw) return
    try { setForm({ ...initialState(), ...JSON.parse(raw) }) } catch {
        localStorage.removeItem(`${DRAFT_KEY}:new`)
    }
  }, [ensayoId])

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`, JSON.stringify(form))
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [form, ensayoId])

  useEffect(() => {
    if (!ensayoId) return
    let cancel = false
    const run = async () => {
      setLoadingEdit(true)
      try {
        const res = await authFetch(`${API_URL}/api/peso-unitario/${ensayoId}`)
        if (!res.ok) throw new Error('Error al cargar')
        const detail = await res.json()
        if (!cancel && detail) {
            const payload = detail.payload || (detail as any)
            const merged: PesoUnitarioPayload = {
                ...initialState(),
                muestra: detail.muestra || payload.muestra || '',
                numero_ot: detail.numero_ot || payload.numero_ot || '',
                cliente: detail.cliente || payload.cliente || '',
                fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || '',
                realizado_por: payload.realizado_por || 'OPERADOR',
                ...payload,
            }
            merged.fecha_ensayo = normalizeFlexibleDate(merged.fecha_ensayo || '')
            setForm(merged)
        }
      } catch {
        toast.error('No se pudo cargar ensayo de Peso Unitario.')
      } finally {
        if (!cancel) setLoadingEdit(false)
      }
    }
    void run()
    return () => { cancel = true }
  }, [ensayoId])

  const payload = useMemo(() => preparePayload(form), [form])

  const setField = useCallback(<K extends keyof PesoUnitarioPayload>(key: K, value: PesoUnitarioPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setTriple = useCallback((key: TripleFieldKey, idx: number, raw: string) => {
    setForm((prev) => {
      const next = [...prev[key]]
      next[idx] = parseNum(raw)
      return { ...prev, [key]: next }
    })
  }, [])

  const clearAll = useCallback(() => {
    if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
    localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
    setForm(initialState())
  }, [ensayoId])

  const save = useCallback(async (download: boolean) => {
    if (!form.muestra || !form.numero_ot || !form.fecha_ensayo || !form.realizado_por) {
      toast.error('Complete Muestra, N OT, Fecha de Ensayo y Realizado por.')
      return
    }
    setLoading(true)
    try {
      const p = preparePayload(form)
      let savedId = ensayoId

      if (download) {
        const url = `${API_URL}/api/peso-unitario/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
        const res = await authFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        })
        if (!res.ok) throw new Error('Error al generar Excel')
        const blob = await res.blob()
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `${buildFormatPreview(form.muestra, muestraType, 'PESO UNITARIO')}.xlsx`
        link.click()
        URL.revokeObjectURL(link.href)

        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
        toast.success('Peso Unitario guardado y descargado.')
        onSaved?.()
        onClose?.()
      } else {
        const url = `${API_URL}/api/peso-unitario/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
        const res = await authFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(p),
        })
        if (!res.ok) throw new Error('Error al guardar ensayo')
        const saved = await res.json()
        savedId = saved.id || saved.ensayoId || ensayoId
        if (savedId) setEnsayoId(savedId)
        localStorage.removeItem(`${DRAFT_KEY}:new`)
        toast.success('Peso Unitario guardado. Puedes seguir editando.')
        onSaved?.()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo generar Peso Unitario.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [ensayoId, form, muestraType, onClose, onSaved])

    return (
        <div className="min-h-screen bg-slate-50/70 p-3 sm:p-5 lg:p-7 overflow-y-auto pb-28">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md px-5 py-4 shadow-xs">
                    <div className="flex items-center gap-3.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 border border-blue-100 text-blue-600">
                            <Scale className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                                Peso Unitario — ASTM C29/C29M-23
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-AG-21.01</p>
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

        <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
          <div className="border-b border-slate-300 bg-white px-3 py-3">
            <table className="w-full table-fixed border border-slate-300 text-sm">
              <thead className="bg-slate-100 text-xs font-semibold text-slate-800"><tr><th className="border-r border-slate-300 py-1">MUESTRA</th><th className="border-r border-slate-300 py-1">N° OT</th><th className="border-r border-slate-300 py-1">FECHA DE ENSAYO</th><th className="py-1">REALIZADO</th></tr></thead>
              <tbody><tr>
                <td className="border-r border-t border-slate-300 p-1">
                  <div className="flex min-w-0 items-center gap-1.5 px-0.5">
                    <input
                      className={`${inputClass} min-w-0 flex-1 text-center`}
                      value={muestraInput}
                      onChange={(e) => handleMuestraInputChange(e.target.value)}
                      autoComplete="off"
                      data-lpignore="true"
                      placeholder="1234"
                    />
                    <div className="flex h-9 shrink-0 items-center rounded-md border border-slate-300 bg-background px-1.5">
                        <select
                            value={muestraType}
                            onChange={(e) => handleTypeToggle(e.target.value as 'SU' | 'AG')}
                            className="h-7 w-[92px] rounded-md border-0 bg-transparent px-2 text-xs font-bold uppercase text-slate-700 focus:outline-none focus:ring-0"
                            aria-label="Tipo de muestra"
                        >
                            <option value="SU">SU</option>
                            <option value="AG">AG</option>
                        </select>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-500">-</span>
                    <div className="flex h-9 shrink-0 items-center rounded-md border border-slate-300 bg-background px-1.5">
                        <input
                            type="text"
                            value={muestraYear}
                            onChange={(e) => handleYearChange(e.target.value)}
                            onBlur={handleYearBlur}
                            maxLength={2}
                            inputMode="numeric"
                            aria-label="Año de muestra"
                            className="h-7 w-[56px] rounded-md border-0 bg-transparent px-2 text-center text-xs font-bold text-slate-700 focus:outline-none focus:ring-0"
                        />
                    </div>
                  </div>
                </td>
                <td className="border-r border-t border-slate-300 p-1"><input className={`${inputClass} text-center`} value={form.numero_ot} onChange={(e) => setField('numero_ot', e.target.value)} onBlur={() => setField('numero_ot', normalizeNumeroOtCode(form.numero_ot))} autoComplete="off" data-lpignore="true" /></td>
                <td className="border-r border-t border-slate-300 p-1"><input className={`${inputClass} text-center`} value={form.fecha_ensayo} onChange={(e) => setField('fecha_ensayo', e.target.value)} onBlur={() => setField('fecha_ensayo', normalizeFlexibleDate(form.fecha_ensayo))} autoComplete="off" data-lpignore="true" placeholder="YYYY/MM/DD" /></td>
                <td className="border-t border-slate-300 p-1"><input className={`${inputClass} text-center`} value={form.realizado_por} onChange={(e) => setField('realizado_por', e.target.value)} autoComplete="off" data-lpignore="true" /></td>
              </tr></tbody>
            </table>
          </div>

          <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center">
            <p className="text-2xl font-semibold leading-tight text-slate-900">Standard Test Method for Bulk Density (Unit Weight) and Voids in Aggregate</p>
            <p className="text-2xl font-semibold text-slate-900">ASTM C29/C29M-23</p>
          </div>

          <div className="space-y-3 p-3">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_340px]">
              <div className="overflow-hidden rounded-lg border border-slate-300">
                <table className="w-full text-sm"><tbody>
                  <tr><td className="w-8 border-b border-r border-slate-300 px-2 py-1 text-center">a</td><td className="border-b border-r border-slate-300 px-2 py-1">Molde</td><td className="w-48 border-b border-slate-300 p-1"><input className={inputClass} value={form.recipiente_molde_numero ?? ''} onChange={(e) => setField('recipiente_molde_numero', e.target.value)} /></td></tr>
                  <tr><td className="border-b border-r border-slate-300 px-2 py-1 text-center">b</td><td className="border-b border-r border-slate-300 px-2 py-1">Masa de medida (kg)</td><td className="border-b border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={form.recipiente_masa_medida_kg ?? ''} onChange={(e) => setField('recipiente_masa_medida_kg', parseNum(e.target.value))} /></td></tr>
                  <tr><td className="border-r border-slate-300 px-2 py-1 text-center">c</td><td className="border-r border-slate-300 px-2 py-1">Volumen de la medida (m³)</td><td className="p-1"><input type="number" step="any" className={inputClass} value={form.recipiente_volumen_m3 ?? ''} onChange={(e) => setField('recipiente_volumen_m3', parseNum(e.target.value))} /></td></tr>
                </tbody></table>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-300"><table className="w-full text-sm"><tbody>
                {(['A', 'B', 'C'] as const).map((m, idx) => (
                  <tr key={m}><td className="border-b border-slate-300 px-2 py-1"><button type="button" className={`flex h-8 w-full items-center justify-between rounded-md border px-2 text-xs font-semibold ${form.metodo_compactacion === m ? 'border-slate-700 bg-slate-200 text-slate-900' : 'border-slate-300 bg-white text-slate-700'}`} onClick={() => setField('metodo_compactacion', form.metodo_compactacion === m ? '-' : m)}><span>{m}: {idx === 0 ? 'Varillado' : idx === 1 ? 'Percusion' : 'Suelto'}</span><span>{form.metodo_compactacion === m ? 'X' : ''}</span></button></td></tr>
                ))}
              </tbody></table></div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-300">
              <table className="w-full text-sm">
                <tbody>
                  <tr>
                    <td className="w-64 border-b border-r border-slate-300 px-2 py-1">Tipo de muestra</td>
                    <td className="border-b border-r border-slate-300 p-1"><input className={inputClass} value={form.tipo_muestra ?? ''} onChange={(e) => setField('tipo_muestra', e.target.value)} /></td>
                    <td className="w-64 border-b border-r border-slate-300 px-2 py-1">Masa del agregado (g)</td>
                    <td className="border-b border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={form.masa_agregado_g ?? ''} onChange={(e) => setField('masa_agregado_g', parseNum(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border-b border-r border-slate-300 px-2 py-1">Tamaño maximo nominal agregado (visual) (in)</td>
                    <td className="border-b border-r border-slate-300 p-1"><input className={inputClass} value={form.tamano_maximo_nominal_visual_in ?? ''} onChange={(e) => setField('tamano_maximo_nominal_visual_in', e.target.value)} /></td>
                    <td className="border-b border-r border-slate-300 px-2 py-1">Masa del agregado seco (g)</td>
                    <td className="border-b border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={form.masa_agregado_seco_g ?? ''} onChange={(e) => setField('masa_agregado_seco_g', parseNum(e.target.value))} /></td>
                  </tr>
                  <tr>
                    <td className="border-r border-slate-300 px-2 py-1"></td>
                    <td className="border-r border-slate-300 p-1"></td>
                    <td className="border-r border-slate-300 px-2 py-1">Masa del agregado seco constante (g)</td>
                    <td className="p-1"><input type="number" step="any" className={inputClass} value={form.masa_agregado_seco_constante_g ?? ''} onChange={(e) => setField('masa_agregado_seco_constante_g', parseNum(e.target.value))} /></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-300">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 text-xs font-semibold text-slate-800"><tr><th className="border-b border-r border-slate-300 px-2 py-1 text-left" colSpan={2}>Peso Unitario</th><th className="w-28 border-b border-r border-slate-300 py-1">1</th><th className="w-28 border-b border-r border-slate-300 py-1">2</th><th className="w-28 border-b border-r border-slate-300 py-1">3</th><th className="w-16 border-b border-slate-300 py-1">Und.</th></tr></thead>
                <tbody>
                  <tr><td className="w-8 border-t border-r border-slate-300 px-2 py-1 text-center">d</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa del agregado mas medida</td>{[0,1,2].map((i)=><td key={`d-${i}`} className="border-t border-r border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={form.prueba_d_masa_agregado_mas_medida_kg[i] ?? ''} onChange={(e)=>setTriple('prueba_d_masa_agregado_mas_medida_kg', i, e.target.value)} /></td>)}<td className="border-t border-slate-300 px-2 py-1 text-center">kg</td></tr>
                  <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">e</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa del agregado (d-b)</td>{[0,1,2].map((i)=><td key={`e-${i}`} className="border-t border-r border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={payload.prueba_e_masa_agregado_kg[i] ?? ''} onChange={(e)=>setTriple('prueba_e_masa_agregado_kg', i, e.target.value)} /></td>)}<td className="border-t border-slate-300 px-2 py-1 text-center">kg</td></tr>
                  <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">f</td><td className="border-t border-r border-slate-300 px-2 py-1">Densidad aparente del agregado (e/c)</td>{[0,1,2].map((i)=><td key={`f-${i}`} className="border-t border-r border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={payload.prueba_f_densidad_aparente_kg_m3[i] ?? ''} onChange={(e)=>setTriple('prueba_f_densidad_aparente_kg_m3', i, e.target.value)} /></td>)}<td className="border-t border-slate-300 px-2 py-1 text-center">kg/m³</td></tr>
                  <tr className="bg-slate-50"><td className="border-t border-r border-slate-300 px-2 py-1"></td><td className="border-t border-r border-slate-300 px-2 py-1 font-semibold">Promedio densidad aparente</td><td className="border-t border-r border-slate-300 p-1" colSpan={3}><input type="number" step="any" className={inputClass} value={payload.densidad_aparente_promedio_kg_m3 ?? ''} onChange={(e)=>setField('densidad_aparente_promedio_kg_m3', parseNum(e.target.value))} /></td><td className="border-t border-slate-300 px-2 py-1 text-center">kg/m³</td></tr>
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-300">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-slate-100 text-xs font-semibold text-slate-800"><tr><th className="border-b border-r border-slate-300 px-2 py-1 text-left" colSpan={2}>Contenido de Vacios</th><th className="w-28 border-b border-r border-slate-300 py-1">1</th><th className="w-28 border-b border-r border-slate-300 py-1">2</th><th className="w-28 border-b border-r border-slate-300 py-1">3</th><th className="w-16 border-b border-slate-300 py-1">Und.</th></tr></thead>
                <tbody>
                  <tr><td className="w-8 border-t border-r border-slate-300 px-2 py-1 text-center">i</td><td className="border-t border-r border-slate-300 px-2 py-1">Gravedad especifica base seca</td>{[0,1,2].map((i)=><td key={`i-${i}`} className="border-t border-r border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={form.vacios_i_gravedad_especifica_base_seca[i] ?? ''} onChange={(e)=>setTriple('vacios_i_gravedad_especifica_base_seca', i, e.target.value)} /></td>)}<td className="border-t border-slate-300 px-2 py-1 text-center">-</td></tr>
                  <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">j</td><td className="border-t border-r border-slate-300 px-2 py-1">Densidad del agua</td>{[0,1,2].map((i)=><td key={`j-${i}`} className="border-t border-r border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={form.vacios_j_densidad_agua_kg_m3[i] ?? ''} onChange={(e)=>setTriple('vacios_j_densidad_agua_kg_m3', i, e.target.value)} /></td>)}<td className="border-t border-slate-300 px-2 py-1 text-center">kg/m³</td></tr>
                  <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">k</td><td className="border-t border-r border-slate-300 px-2 py-1">% de vacios</td>{[0,1,2].map((i)=><td key={`k-${i}`} className="border-t border-r border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={payload.vacios_k_porcentaje[i] ?? ''} onChange={(e)=>setTriple('vacios_k_porcentaje', i, e.target.value)} /></td>)}<td className="border-t border-slate-300 px-2 py-1 text-center">%</td></tr>
                  <tr className="bg-slate-50"><td className="border-t border-r border-slate-300 px-2 py-1"></td><td className="border-t border-r border-slate-300 px-2 py-1 font-semibold">Promedio % vacios</td><td className="border-t border-r border-slate-300 p-1" colSpan={3}><input type="number" step="any" className={inputClass} value={payload.vacios_promedio_pct ?? ''} onChange={(e)=>setField('vacios_promedio_pct', parseNum(e.target.value))} /></td><td className="border-t border-slate-300 px-2 py-1 text-center">%</td></tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr_280px_280px]">
              <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-xs font-semibold text-slate-800"><tr><th className="border-b border-r border-slate-300 py-1">Equipo utilizado</th><th className="border-b border-slate-300 py-1">Codigo</th></tr></thead>
                  <tbody>
                    <tr><td className="border-t border-r border-slate-300 px-2 py-1">Molde</td><td className="border-t border-slate-300 p-1"><select className={inputClass} value={form.equipo_molde_codigo ?? '-'} onChange={(e) => setField('equipo_molde_codigo', e.target.value)}>{withCurrentOption(form.equipo_molde_codigo, EQUIPO_OPTIONS.equipo_molde_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td></tr>
                    <tr><td className="border-t border-r border-slate-300 px-2 py-1">Balanza</td><td className="border-t border-slate-300 p-1"><select className={inputClass} value={form.equipo_balanza_codigo ?? '-'} onChange={(e) => setField('equipo_balanza_codigo', e.target.value)}>{withCurrentOption(form.equipo_balanza_codigo, EQUIPO_OPTIONS.equipo_balanza_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td></tr>
                    <tr><td className="border-t border-r border-slate-300 px-2 py-1">Varilla de apisonamiento</td><td className="border-t border-slate-300 p-1"><select className={inputClass} value={form.equipo_varilla_codigo ?? '-'} onChange={(e) => setField('equipo_varilla_codigo', e.target.value)}>{withCurrentOption(form.equipo_varilla_codigo, EQUIPO_OPTIONS.equipo_varilla_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td></tr>
                    <tr><td className="border-t border-r border-slate-300 px-2 py-1">Horno</td><td className="border-t border-slate-300 p-1"><select className={inputClass} value={form.equipo_horno_codigo ?? '-'} onChange={(e) => setField('equipo_horno_codigo', e.target.value)}>{withCurrentOption(form.equipo_horno_codigo, EQUIPO_OPTIONS.equipo_horno_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td></tr>
                  </tbody>
                </table>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-300"><div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">Observaciones</div><div className="p-2"><textarea className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35" rows={4} value={form.observaciones ?? ''} onChange={(e)=>setField('observaciones', e.target.value)} /></div></div>
              <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50"><div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Revisado</div><div className="space-y-2 p-2"><select className={inputClass} value={form.revisado_por ?? '-'} onChange={(e)=>{ const v = e.target.value; setField('revisado_por', v); if (v !== '-') { setField('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }))) } }}>{REVISORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select><input className={inputClass} value={form.revisado_fecha ?? ''} onChange={(e)=>setField('revisado_fecha', e.target.value)} onBlur={() => setField('revisado_fecha', normalizeFlexibleDate(form.revisado_fecha ?? ''))} placeholder="Fecha" /></div></div>
              <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50"><div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Aprobado</div><div className="space-y-2 p-2"><select className={inputClass} value={form.aprobado_por ?? '-'} onChange={(e)=>{ const v = e.target.value; setField('aprobado_por', v); if (v !== '-') { setField('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }))) } }}>{APROBADORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select><input className={inputClass} value={form.aprobado_fecha ?? ''} onChange={(e)=>setField('aprobado_fecha', e.target.value)} onBlur={() => setField('aprobado_fecha', normalizeFlexibleDate(form.aprobado_fecha ?? ''))} placeholder="Fecha" /></div></div>
            </div>

            <div className="border-t-2 border-blue-900 px-3 py-2 text-center text-[11px] leading-tight text-slate-700"><p>WEB: www.geofal.com.pe  E-MAIL: laboratorio@geofal.com.pe / geofal.sac@gmail.com</p><p>Av. Maranon 763, Los Olivos-Lima | Telefono 01522-1851</p></div>
          </div>
        </div>

      </div>
      <FormActionDock
        onSave={() => void save(false)}
        onSaveAndDownload={() => void save(true)}
        onClear={clearAll}
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
