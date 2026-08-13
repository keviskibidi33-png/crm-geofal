import { useCallback, useEffect, useMemo, useState } from 'react'
import { Beaker, Download, Loader2, Save, Trash2, X } from 'lucide-react'
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

const DRAFT_KEY = 'tamiz_form_draft_v1'
const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const

const EQUIPO_OPTIONS = {
    balanza_01g_codigo: ['-', 'EQP-0046'],
    horno_110c_codigo: ['-', 'EQP-0150', 'EQP-0049'],
    tamiz_no_200_codigo: ['-', 'INS-0199'],
    tamiz_no_16_codigo: ['-', 'INS-0171'],
} as const

interface TamizPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    procedimiento?: "A" | "B" | "-" | null
    tamano_maximo_nominal_visual_in?: string | null

    a_masa_recipiente_g?: number | null
    b_masa_recipiente_muestra_seca_g?: number | null
    c_masa_recipiente_muestra_seca_constante_g?: number | null
    d_masa_seca_original_muestra_g?: number | null
    e_masa_recipiente_muestra_seca_despues_lavado_g?: number | null
    f_masa_recipiente_muestra_seca_despues_lavado_constante_g?: number | null
    g_masa_seca_muestra_despues_lavado_g?: number | null
    h_porcentaje_material_fino_pct?: number | null

    balanza_01g_codigo?: string | null
    horno_110c_codigo?: string | null
    tamiz_no_200_codigo?: string | null
    tamiz_no_16_codigo?: string | null

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

const parseNum = (value: string) => {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const parseMuestraCode = (muestra: string, defaultType: 'SU' | 'AG' = 'AG') => {
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

const initialState = (): TamizPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    procedimiento: '-',
    tamano_maximo_nominal_visual_in: '',
    a_masa_recipiente_g: null,
    b_masa_recipiente_muestra_seca_g: null,
    c_masa_recipiente_muestra_seca_constante_g: null,
    d_masa_seca_original_muestra_g: null,
    e_masa_recipiente_muestra_seca_despues_lavado_g: null,
    f_masa_recipiente_muestra_seca_despues_lavado_constante_g: null,
    g_masa_seca_muestra_despues_lavado_g: null,
    h_porcentaje_material_fino_pct: null,
    balanza_01g_codigo: '-',
    horno_110c_codigo: '-',
    tamiz_no_200_codigo: '-',
    tamiz_no_16_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

function preparePayload(payload: TamizPayload): TamizPayload {
    const next: TamizPayload = { ...payload }

    if (next.d_masa_seca_original_muestra_g == null && next.c_masa_recipiente_muestra_seca_constante_g != null && next.a_masa_recipiente_g != null) {
        next.d_masa_seca_original_muestra_g = Number(
            (next.c_masa_recipiente_muestra_seca_constante_g - next.a_masa_recipiente_g).toFixed(4),
        )
    }

    if (next.g_masa_seca_muestra_despues_lavado_g == null && next.f_masa_recipiente_muestra_seca_despues_lavado_constante_g != null && next.a_masa_recipiente_g != null) {
        next.g_masa_seca_muestra_despues_lavado_g = Number(
            (next.f_masa_recipiente_muestra_seca_despues_lavado_constante_g - next.a_masa_recipiente_g).toFixed(4),
        )
    }

    if (
        next.h_porcentaje_material_fino_pct == null &&
        next.d_masa_seca_original_muestra_g != null &&
        next.g_masa_seca_muestra_despues_lavado_g != null &&
        next.d_masa_seca_original_muestra_g !== 0
    ) {
        next.h_porcentaje_material_fino_pct = Number(
            (((next.d_masa_seca_original_muestra_g - next.g_masa_seca_muestra_despues_lavado_g) / next.d_masa_seca_original_muestra_g) * 100).toFixed(4),
        )
    }

    return next
}

const FIELD_ROWS: Array<{ key: keyof TamizPayload; label: string; unit: string; code: string; formula?: string }> = [
    { code: 'A', key: 'a_masa_recipiente_g', label: 'Masa del recipiente', unit: 'g' },
    { code: 'B', key: 'b_masa_recipiente_muestra_seca_g', label: 'Masa del recipiente + muestra seca', unit: 'g' },
    { code: 'C', key: 'c_masa_recipiente_muestra_seca_constante_g', label: 'Masa del recipiente + muestra seca constante', unit: 'g' },
    { code: 'D', key: 'd_masa_seca_original_muestra_g', label: 'Masa seca original de la muestra', unit: 'g', formula: '(C - A)' },
    { code: 'E', key: 'e_masa_recipiente_muestra_seca_despues_lavado_g', label: 'Masa del recipiente + muestra seca despues del lavado', unit: 'g' },
    { code: 'F', key: 'f_masa_recipiente_muestra_seca_despues_lavado_constante_g', label: 'Masa del recipiente + muestra seca despues del lavado, constante', unit: 'g' },
    { code: 'G', key: 'g_masa_seca_muestra_despues_lavado_g', label: 'Masa seca de la muestra despues del lavado', unit: 'g', formula: '(F - A)' },
    { code: 'H', key: 'h_porcentaje_material_fino_pct', label: 'Porcentaje de material mas fino que un tamiz 75 um (N°200) por lavado', unit: '%', formula: '(D-G)/D*100' },
]

export interface TamizFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function TamizForm({ editId, onClose, onSaved }: TamizFormProps) {
    const [form, setForm] = useState<TamizPayload>(() => initialState())
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

    useEffect(() => {
        if (ensayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            setForm({ ...initialState(), ...JSON.parse(raw) })
        } catch {
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
                const res = await authFetch(`${API_URL}/api/tamiz/${ensayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!cancel && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged = {
                        ...initialState(),
                        muestra: detail.muestra || payload.muestra || '',
                        numero_ot: detail.numero_ot || payload.numero_ot || '',
                        cliente: detail.cliente || payload.cliente || '',
                        fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || '',
                        realizado_por: payload.realizado_por || 'OPERADOR',
                        ...payload,
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
                toast.error('No se pudo cargar ensayo Tamiz.')
            } finally {
                if (!cancel) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancel = true
        }
    }, [ensayoId])

    const computedPayload = useMemo(() => preparePayload(form), [form])

    const setField = useCallback(<K extends keyof TamizPayload>(k: K, v: TamizPayload[K]) => {
        setForm((prev) => ({ ...prev, [k]: v }))
    }, [])

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
        setForm(initialState())
    }, [ensayoId])

    const save = useCallback(async (download: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) return toast.error('Complete Muestra, N OT y Realizado por.')
        setLoading(true)
        try {
            const payload = preparePayload(form)
            let savedId = ensayoId

            if (download) {
                const url = `${API_URL}/api/tamiz/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
                const res = await authFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error('Error al generar Excel')
                const blob = await res.blob()
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = `${buildFormatPreview(form.muestra, muestraType, 'TAMIZ')}.xlsx`
                link.click()
                URL.revokeObjectURL(link.href)

                localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
                toast.success('Tamiz guardado y descargado.')
                onSaved?.()
                onClose?.()
            } else {
                const url = `${API_URL}/api/tamiz/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
                const res = await authFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error('Error al guardar ensayo')
                const saved = await res.json()
                savedId = saved.id || saved.ensayoId || ensayoId
                if (savedId) setEnsayoId(savedId)
                localStorage.removeItem(`${DRAFT_KEY}:new`)
                toast.success('Tamiz guardado. Puedes seguir editando.')
                onSaved?.()
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'No se pudo generar Tamiz.'
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [ensayoId, form, muestraType, onClose, onSaved])

    const selectedA = form.procedimiento === 'A'
    const selectedB = form.procedimiento === 'B'

    const denseInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

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
                                Tamiz N° 200 — ASTM C117-23
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-AG-23.01</p>
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

                {loadingEdit && (
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando ensayo...
                    </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                    <div className="border-b border-slate-300 bg-slate-50 px-4 py-4 text-center">
                        <p className="text-2xl font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                        <p className="text-xl font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-AG-23.01</p>
                    </div>

                    <div className="border-b border-slate-300 bg-white px-3 py-3">
                        <table className="w-full table-fixed border border-slate-300 text-sm">
                            <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                <tr>
                                    <th className="border-r border-slate-300 py-1">MUESTRA</th>
                                    <th className="border-r border-slate-300 py-1">N° OT</th>
                                    <th className="border-r border-slate-300 py-1">FECHA DE ENSAYO</th>
                                    <th className="py-1">REALIZADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border-r border-t border-slate-300 p-1">
                                        <div className="flex min-w-0 items-center gap-1.5 px-0.5">
                                            <input
                                                className={`${denseInputClass} min-w-0 flex-1 text-center`}
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
                                    <td className="border-r border-t border-slate-300 p-1">
                                        <input className={`${denseInputClass} text-center`} value={form.numero_ot} onChange={(e) => setField('numero_ot', e.target.value)} onBlur={() => setField('numero_ot', normalizeNumeroOtCode(form.numero_ot))} autoComplete="off" data-lpignore="true" />
                                    </td>
                                    <td className="border-r border-t border-slate-300 p-1">
                                        <input className={`${denseInputClass} text-center`} value={form.fecha_ensayo} onChange={(e) => setField('fecha_ensayo', e.target.value)} onBlur={() => setField('fecha_ensayo', normalizeFlexibleDate(form.fecha_ensayo))} autoComplete="off" data-lpignore="true" placeholder="YYYY/MM/DD" />
                                    </td>
                                    <td className="border-t border-slate-300 p-1">
                                        <input className={`${denseInputClass} text-center`} value={form.realizado_por} onChange={(e) => setField('realizado_por', e.target.value)} autoComplete="off" data-lpignore="true" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center">
                        <p className="text-2xl font-semibold leading-tight text-slate-900">Standard Test Method for Materials Finer than 75-um (No. 200) Sieve in Mineral Aggregates by Washing</p>
                        <p className="text-2xl font-semibold text-slate-900">ASTM C117-23</p>
                    </div>

                    <div className="space-y-3 p-3">
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_420px]">
                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="border-b border-slate-300 px-2 py-1 text-center font-medium" colSpan={2}>Marca con "X"</td>
                                        </tr>
                                        <tr>
                                            <td className="w-16 border-b border-r border-slate-300 px-1 py-1 text-center">
                                                <button type="button" className={`h-8 w-full rounded-md border text-xs font-semibold ${selectedA ? 'border-slate-700 bg-slate-200 text-slate-900' : 'border-slate-300 bg-white text-slate-700'}`} onClick={() => setField('procedimiento', 'A')}>
                                                    {selectedA ? 'X' : ''}
                                                </button>
                                            </td>
                                            <td className="border-b border-slate-300 px-2 py-1">Procedimiento A: lavado con agua</td>
                                        </tr>
                                        <tr>
                                            <td className="w-16 border-r border-slate-300 px-1 py-1 text-center">
                                                <button type="button" className={`h-8 w-full rounded-md border text-xs font-semibold ${selectedB ? 'border-slate-700 bg-slate-200 text-slate-900' : 'border-slate-300 bg-white text-slate-700'}`} onClick={() => setField('procedimiento', 'B')}>
                                                    {selectedB ? 'X' : ''}
                                                </button>
                                            </td>
                                            <td className="px-2 py-1">Procedimiento B: lavado con agente humectante</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="border-r border-slate-300 px-2 py-1">Tamano maximo nominal muestra (visual) (in):</td>
                                            <td className="w-40 p-1">
                                                <input className={denseInputClass} value={form.tamano_maximo_nominal_visual_in ?? ''} onChange={(e) => setField('tamano_maximo_nominal_visual_in', e.target.value)} autoComplete="off" data-lpignore="true" />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-300">
                            <table className="w-full table-fixed text-sm">
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                    <tr>
                                        <th className="w-10 border-b border-r border-slate-300 py-1">N°</th>
                                        <th className="border-b border-r border-slate-300 px-2 py-1 text-left">DESCRIPCION</th>
                                        <th className="w-16 border-b border-r border-slate-300 py-1">UND.</th>
                                        <th className="w-36 border-b border-slate-300 py-1">DATOS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {FIELD_ROWS.map((row) => (
                                        <tr key={row.code}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{row.code}</td>
                                            <td className="border-t border-r border-slate-300 px-2 py-1">
                                                {row.label} {row.formula ? <span className="text-xs text-slate-500">{row.formula}</span> : null}
                                            </td>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{row.unit}</td>
                                            <td className="border-t border-slate-300 p-1">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={denseInputClass}
                                                    value={(computedPayload[row.key] as number | null) ?? ''}
                                                    onChange={(e) => setField(row.key, parseNum(e.target.value) as TamizPayload[keyof TamizPayload])}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center"></td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-sm font-medium">Perdida adicional de la masa seca &lt;1%</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center"></td>
                                        <td className="border-t border-slate-300 px-2 py-1"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr]">
                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                        <tr>
                                            <th className="border-b border-r border-slate-300 py-1">Equipo utilizado</th>
                                            <th className="border-b border-slate-300 py-1">Codigo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border-t border-r border-slate-300 px-2 py-1">Balanza 0.1 g</td>
                                            <td className="border-t border-slate-300 p-1"><select className={denseInputClass} value={form.balanza_01g_codigo ?? '-'} onChange={(e) => setField('balanza_01g_codigo', e.target.value)}>{withCurrentOption(form.balanza_01g_codigo, EQUIPO_OPTIONS.balanza_01g_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                                        </tr>
                                        <tr>
                                            <td className="border-t border-r border-slate-300 px-2 py-1">Horno 110°C</td>
                                            <td className="border-t border-slate-300 p-1"><select className={denseInputClass} value={form.horno_110c_codigo ?? '-'} onChange={(e) => setField('horno_110c_codigo', e.target.value)}>{withCurrentOption(form.horno_110c_codigo, EQUIPO_OPTIONS.horno_110c_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                                        </tr>
                                        <tr>
                                            <td className="border-t border-r border-slate-300 px-2 py-1">Tamiz No. 200</td>
                                            <td className="border-t border-slate-300 p-1"><select className={denseInputClass} value={form.tamiz_no_200_codigo ?? '-'} onChange={(e) => setField('tamiz_no_200_codigo', e.target.value)}>{withCurrentOption(form.tamiz_no_200_codigo, EQUIPO_OPTIONS.tamiz_no_200_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                                        </tr>
                                        <tr>
                                            <td className="border-t border-r border-slate-300 px-2 py-1">Tamiz No. 16</td>
                                            <td className="border-t border-slate-300 p-1"><select className={denseInputClass} value={form.tamiz_no_16_codigo ?? '-'} onChange={(e) => setField('tamiz_no_16_codigo', e.target.value)}>{withCurrentOption(form.tamiz_no_16_codigo, EQUIPO_OPTIONS.tamiz_no_16_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                        <tr>
                                            <th className="border-b border-r border-slate-300 py-1">Tamano maximo nominal</th>
                                            <th className="border-b border-slate-300 py-1">Peso minimo (g)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1">No. 4 o menos</td><td className="border-t border-slate-300 px-2 py-1 text-center">300</td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1">Mas grande No. 4 hasta 3/8 in</td><td className="border-t border-slate-300 px-2 py-1 text-center">1000</td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1">Mas grande 3/8 in hasta 3/4 in</td><td className="border-t border-slate-300 px-2 py-1 text-center">2500</td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1">Mas grande 3/4 in</td><td className="border-t border-slate-300 px-2 py-1 text-center">5000</td></tr>
                                        <tr><td className="border-t border-slate-300 px-2 py-1 text-xs text-slate-600" colSpan={2}>Fuente: Elaboracion propia en base a la Norma ASTM C117-23.</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-300">
                            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">Observaciones</div>
                            <div className="p-2">
                                <textarea className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35" rows={3} value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} autoComplete="off" data-lpignore="true" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_280px] xl:justify-end">
                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Revisado</div>
                                <div className="space-y-2 p-2">
                                    <select className={denseInputClass} value={form.revisado_por ?? '-'} onChange={(e) => { const v = e.target.value; setField('revisado_por', v); if (v !== '-') { setField('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }))) } }}>
                                        {REVISORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <input className={denseInputClass} value={form.revisado_fecha ?? ''} onChange={(e) => setField('revisado_fecha', e.target.value)} onBlur={() => setField('revisado_fecha', normalizeFlexibleDate(form.revisado_fecha ?? ''))} autoComplete="off" data-lpignore="true" placeholder="Fecha" />
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Aprobado</div>
                                <div className="space-y-2 p-2">
                                    <select className={denseInputClass} value={form.aprobado_por ?? '-'} onChange={(e) => { const v = e.target.value; setField('aprobado_por', v); if (v !== '-') { setField('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }))) } }}>
                                        {APROBADORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <input className={denseInputClass} value={form.aprobado_fecha ?? ''} onChange={(e) => setField('aprobado_fecha', e.target.value)} onBlur={() => setField('aprobado_fecha', normalizeFlexibleDate(form.aprobado_fecha ?? ''))} autoComplete="off" data-lpignore="true" placeholder="Fecha" />
                                </div>
                            </div>
                        </div>

                        <div className="border-t-2 border-blue-900 px-3 py-2 text-center text-[11px] leading-tight text-slate-700">
                            <p>WEB: www.geofal.com.pe  E-MAIL: laboratorio@geofal.com.pe / geofal.sac@gmail.com</p>
                            <p>Av. Maranon 763, Los Olivos-Lima / Telefono 01 522-1851</p>
                        </div>
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
