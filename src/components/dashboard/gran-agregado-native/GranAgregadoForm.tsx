import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Beaker, ChevronDown, Download, Loader2, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import FormActionDock from '../shared/FormActionDock'

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

const DRAFT_KEY = 'gran_agregado_form_draft_v1'
const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

const SIEVE_LABELS = [
    '3 in',
    '2 1/2 in',
    '2 in',
    '1 1/2 in',
    '1 in',
    '3/4 in',
    '1/2 in',
    '3/8 in',
    'No. 4',
    'No. 8',
    'No. 10',
    'No. 16',
    'No. 30',
    'No. 40',
    'No. 50',
    'No. 100',
    'No. 200',
    '< 200',
] as const

const EQ_BALANZA = ['-', 'EQP-0046'] as const
const EQ_HORNO = ['-', 'EQP-0150', 'EQP-0049'] as const
const REVISADO = ['-', 'FABIAN LA ROSA'] as const
const APROBADO = ['-', 'IRMA COAQUIRA'] as const
const ERROR_TAMIZADO_MAX_PCT = 0.3

export interface GranAgregadoPayload {
    muestra: string
    numero_ot: string
    cliente?: string | null
    fecha_ensayo: string
    realizado_por: string

    tipo_muestra?: string | null
    tamano_maximo_particula_visual_in?: string | null
    forma_particula?: string | null

    masa_muestra_humeda_inicial_total_global_g?: number | null
    masa_muestra_seca_global_g?: number | null
    masa_muestra_seca_constante_global_g?: number | null
    masa_muestra_seca_lavada_global_g?: number | null

    masa_muestra_humeda_inicial_total_fraccionada_g?: number | null
    masa_muestra_seca_inicial_total_fraccionada_g?: number | null
    masa_muestra_seca_grueso_g?: number | null
    masa_muestra_seca_constante_grueso_g?: number | null
    masa_muestra_humeda_fino_g?: number | null
    masa_muestra_seca_fino_g?: number | null
    masa_muestra_humeda_fraccion_g?: number | null
    masa_muestra_seca_fraccion_g?: number | null
    masa_muestra_seca_constante_fraccion_g?: number | null
    contenido_humedad_fraccion_pct?: number | null
    masa_muestra_seca_lavada_fraccion_g?: number | null

    masa_retenida_tamiz_g: Array<number | null>

    masa_antes_tamizado_g?: number | null
    masa_despues_tamizado_g?: number | null
    error_tamizado_pct?: number | null

    balanza_01g_codigo?: string | null
    horno_codigo?: string | null
    observaciones?: string | null

    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const formatTodayShortDate = () => {
    const [yyyy = '', mm = '', dd = ''] = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }).split('-')
    return `${yyyy}/${mm}/${dd}`
}

const initialState = (): GranAgregadoPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    tipo_muestra: '',
    tamano_maximo_particula_visual_in: '',
    forma_particula: '',
    masa_muestra_humeda_inicial_total_global_g: null,
    masa_muestra_seca_global_g: null,
    masa_muestra_seca_constante_global_g: null,
    masa_muestra_seca_lavada_global_g: null,
    masa_muestra_humeda_inicial_total_fraccionada_g: null,
    masa_muestra_seca_inicial_total_fraccionada_g: null,
    masa_muestra_seca_grueso_g: null,
    masa_muestra_seca_constante_grueso_g: null,
    masa_muestra_humeda_fino_g: null,
    masa_muestra_seca_fino_g: null,
    masa_muestra_humeda_fraccion_g: null,
    masa_muestra_seca_fraccion_g: null,
    masa_muestra_seca_constante_fraccion_g: null,
    contenido_humedad_fraccion_pct: null,
    masa_muestra_seca_lavada_fraccion_g: null,
    masa_retenida_tamiz_g: Array.from({ length: SIEVE_LABELS.length }, () => null),
    masa_antes_tamizado_g: null,
    masa_despues_tamizado_g: null,
    error_tamizado_pct: null,
    balanza_01g_codigo: '-',
    horno_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: formatTodayShortDate(),
})

const parseNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestraCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const match = compact.match(/^(\d+)(?:-(?:SU|AG))?(?:-(\d{2}))?$/)
    if (match) {
        return `${match[1]}-AG-${match[2] || year}`
    }
    return value
}

const normalizeNumeroOtCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const patterns = [
        /^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/,
        /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/,
    ]

    for (const pattern of patterns) {
        const match = compact.match(pattern)
        if (match) {
            return `${match[1]}-${match[2] || year}`
        }
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

type FormattedFieldKey = 'muestra' | 'numero_ot' | 'fecha_ensayo' | 'revisado_fecha' | 'aprobado_fecha'

export interface GranAgregadoFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function GranAgregadoForm({ editId, onClose, onSaved }: GranAgregadoFormProps) {
    const [form, setForm] = useState<GranAgregadoPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)

    useEffect(() => {
        setEditingEnsayoId(editId ?? null)
    }, [editId])

    const filledSieves = useMemo(() => (form.masa_retenida_tamiz_g || []).filter((v) => v != null).length, [form.masa_retenida_tamiz_g])
    const totalSieves = useMemo(
        () => Number((form.masa_retenida_tamiz_g || []).reduce((sum: number, v) => sum + (v ?? 0), 0).toFixed(3)),
        [form.masa_retenida_tamiz_g],
    )
    const derivedError = useMemo(() => {
        if (!form.masa_antes_tamizado_g || !form.masa_despues_tamizado_g || form.masa_antes_tamizado_g === 0) return null
        return Number((((form.masa_antes_tamizado_g - form.masa_despues_tamizado_g) / form.masa_antes_tamizado_g) * 100).toFixed(4))
    }, [form.masa_antes_tamizado_g, form.masa_despues_tamizado_g])

    const setField = useCallback(<K extends keyof GranAgregadoPayload>(key: K, value: GranAgregadoPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }, [])

    const applyFormattedField = useCallback((key: FormattedFieldKey, formatter: (raw: string) => string) => {
        setForm((prev) => {
            const current = String(prev[key] ?? '')
            const formatted = formatter(current)
            if (formatted === current) return prev
            return { ...prev, [key]: formatted }
        })
    }, [])

    const setSieveValue = useCallback((index: number, raw: string) => {
        setForm((prev) => {
            const next = [...prev.masa_retenida_tamiz_g]
            next[index] = parseNum(raw)
            return { ...prev, masa_retenida_tamiz_g: next }
        })
    }, [])

    useEffect(() => {
        if (editingEnsayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            setForm({ ...initialState(), ...JSON.parse(raw) })
        } catch {
            localStorage.removeItem(`${DRAFT_KEY}:new`)
        }
    }, [editingEnsayoId])

    useEffect(() => {
        if (loadingEdit) return
        const timer = window.setTimeout(() => {
            localStorage.setItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`, JSON.stringify(form))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(timer)
    }, [editingEnsayoId, form, loadingEdit])

    const justSavedRef = useRef(false)

    useEffect(() => {
        if (!editingEnsayoId) return
        if (justSavedRef.current) {
            justSavedRef.current = false
            return
        }
        let cancelled = false
        const run = async () => {
            setLoadingEdit(true)
            try {
                const res = await authFetch(`${API_URL}/api/gran-agregado/${editingEnsayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!cancelled && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged: GranAgregadoPayload = {
                        ...initialState(),
                        muestra: detail.muestra || payload.muestra || '',
                        numero_ot: detail.numero_ot || payload.numero_ot || '',
                        cliente: detail.cliente || payload.cliente || '',
                        fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || '',
                        realizado_por: payload.realizado_por || 'OPERADOR',
                        ...payload,
                    }
                    merged.muestra = normalizeMuestraCode(merged.muestra || '')
                    merged.fecha_ensayo = normalizeFlexibleDate(merged.fecha_ensayo || '')
                    if (!merged.masa_retenida_tamiz_g || !Array.isArray(merged.masa_retenida_tamiz_g)) {
                        merged.masa_retenida_tamiz_g = Array.from({ length: SIEVE_LABELS.length }, () => null)
                    }
                    setForm(merged)
                }
            } catch {
                toast.error('No se pudo cargar ensayo Gran Agregado para edición.')
            } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [editingEnsayoId])

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiarán los datos no guardados. ¿Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.realizado_por) {
                toast.error('Complete Muestra, N OT y Realizado por.')
                return
            }
            setLoading(true)
            try {
                const payload: GranAgregadoPayload = {
                    ...form,
                    error_tamizado_pct: form.error_tamizado_pct ?? derivedError,
                }
                let savedId = editingEnsayoId

                if (download) {
                    const url = `${API_URL}/api/gran-agregado/excel?download=true${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    if (!res.ok) throw new Error('Error al generar Excel')
                    const blob = await res.blob()
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `${buildFormatPreview(form.muestra, 'AG', 'GR. AGREGADO')}.xlsx`
                    link.click()
                    URL.revokeObjectURL(link.href)

                    localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                    toast.success('Gran Agregado guardado y descargado.')
                    onSaved?.()
                    onClose?.()
                } else {
                    const url = `${API_URL}/api/gran-agregado/excel?download=false${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    if (!res.ok) throw new Error('Error al guardar ensayo')
                    const saved = await res.json()
                    savedId = saved.id || saved.ensayoId || editingEnsayoId
                    if (savedId) setEditingEnsayoId(savedId)
                    localStorage.removeItem(`${DRAFT_KEY}:new`)
                    toast.success('Gran Agregado guardado. Puedes seguir editando.')
                    onSaved?.()
                }
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error al guardar Gran Agregado'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [derivedError, editingEnsayoId, form, onClose, onSaved],
    )

    const renderText = (
        label: string,
        value: string | undefined | null,
        onChange: (v: string) => void,
        placeholder?: string,
        onBlur?: () => void,
    ) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )

    const renderNum = (label: string, value: number | null | undefined, onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
                type="number"
                step="any"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )

    const renderSelect = (label: string, value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {o}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 pointer-events-none" />
            </div>
        </div>
    )

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
                                Granulometría Agregados — ASTM C136/C136M-25
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-AG-17.01</p>
                            {editingEnsayoId && (
                                <p className="text-xs text-blue-600 font-semibold mt-0.5">
                                    Editando ensayo #{editingEnsayoId}
                                </p>
                            )}
                        </div>
                    </div>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
                            title="Regresar al Dashboard"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                <div className="space-y-5">
                    {loadingEdit ? (
                        <div className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 flex items-center gap-2 shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando ensayo...
                        </div>
                    ) : null}

                    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 shadow-sm">
                        <div className="border-b border-slate-300 px-4 py-4 text-center">
                            <p className="text-[22px] font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                            <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-AG-19.01</p>
                        </div>
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center">
                            <p className="text-sm font-semibold text-slate-900">Standard Test Method for Sieve Analysis of Fine and Coarse Aggregates</p>
                            <p className="text-sm font-semibold text-slate-900">ASTM C136/C136M-25</p>
                        </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Encabezado</h2>
                        </div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {renderText('Muestra *', form.muestra, (v) => setField('muestra', v), '123-AG-26', () => applyFormattedField('muestra', normalizeMuestraCode))}
                            {renderText('N OT *', form.numero_ot, (v) => setField('numero_ot', v), '1234-26', () => applyFormattedField('numero_ot', normalizeNumeroOtCode))}
                            {renderText('Fecha ensayo', form.fecha_ensayo, (v) => setField('fecha_ensayo', v), 'YYYY/MM/DD', () => applyFormattedField('fecha_ensayo', normalizeFlexibleDate))}
                            {renderText('Realizado por *', form.realizado_por, (v) => setField('realizado_por', v))}
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Descripción y granulometría</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {renderText('Tipo de muestra', form.tipo_muestra, (v) => setField('tipo_muestra', v))}
                                {renderText('Tamaño máximo visual (in)', form.tamano_maximo_particula_visual_in, (v) => setField('tamano_maximo_particula_visual_in', v))}
                                {renderText('Forma de la partícula', form.forma_particula, (v) => setField('forma_particula', v))}
                            </div>
                            <div className="rounded-xl border border-slate-300 bg-slate-50">
                                <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Granulometría Global</h3>
                                </div>
                                <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    {renderNum('Masa húmeda inicial total (g)', form.masa_muestra_humeda_inicial_total_global_g, (v) => setField('masa_muestra_humeda_inicial_total_global_g', parseNum(v)))}
                                    {renderNum('Masa muestra seca (g)', form.masa_muestra_seca_global_g, (v) => setField('masa_muestra_seca_global_g', parseNum(v)))}
                                    {renderNum('Masa muestra seca constante (g)', form.masa_muestra_seca_constante_global_g, (v) => setField('masa_muestra_seca_constante_global_g', parseNum(v)))}
                                    {renderNum('Masa muestra seca lavada (g)', form.masa_muestra_seca_lavada_global_g, (v) => setField('masa_muestra_seca_lavada_global_g', parseNum(v)))}
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-300 bg-slate-50">
                                <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Granulometría Fraccionada</h3>
                                </div>
                                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {renderNum('Masa húmeda inicial total (g)', form.masa_muestra_humeda_inicial_total_fraccionada_g, (v) => setField('masa_muestra_humeda_inicial_total_fraccionada_g', parseNum(v)))}
                                    {renderNum('Masa muestra seco inicial total (g)', form.masa_muestra_seca_inicial_total_fraccionada_g, (v) => setField('masa_muestra_seca_inicial_total_fraccionada_g', parseNum(v)))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="rounded-xl border border-slate-300 bg-slate-50 self-start">
                                    <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Grueso</h3>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {renderNum('Masa muestra seca (g)', form.masa_muestra_seca_grueso_g, (v) => setField('masa_muestra_seca_grueso_g', parseNum(v)))}
                                        {renderNum('Masa muestra seca constante (g)', form.masa_muestra_seca_constante_grueso_g, (v) => setField('masa_muestra_seca_constante_grueso_g', parseNum(v)))}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-300 bg-slate-50 self-start">
                                    <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Fino</h3>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {renderNum('Masa muestra húmedo fino (g)', form.masa_muestra_humeda_fino_g, (v) => setField('masa_muestra_humeda_fino_g', parseNum(v)))}
                                        {renderNum('Masa muestra seco fino (g)', form.masa_muestra_seca_fino_g, (v) => setField('masa_muestra_seca_fino_g', parseNum(v)))}
                                        {renderNum('Masa muestra húmedo fracción (g)', form.masa_muestra_humeda_fraccion_g, (v) => setField('masa_muestra_humeda_fraccion_g', parseNum(v)))}
                                        {renderNum('Masa muestra seco fracción (g)', form.masa_muestra_seca_fraccion_g, (v) => setField('masa_muestra_seca_fraccion_g', parseNum(v)))}
                                        {renderNum('Masa muestra seco constante fracción (g)', form.masa_muestra_seca_constante_fraccion_g, (v) => setField('masa_muestra_seca_constante_fraccion_g', parseNum(v)))}
                                        {renderNum('Contenido humedad fracción (%)', form.contenido_humedad_fraccion_pct, (v) => setField('contenido_humedad_fraccion_pct', parseNum(v)))}
                                        {renderNum('Masa muestra seco lavado fracción (g)', form.masa_muestra_seca_lavada_fraccion_g, (v) => setField('masa_muestra_seca_lavada_fraccion_g', parseNum(v)))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Masa retenida por tamiz (g)</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[780px] text-sm">
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-r border-slate-300 text-left">Tamiz</th>
                                        <th className="px-3 py-2 border-b border-slate-300 text-left">Masa retenida (g)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SIEVE_LABELS.map((label, idx) => (
                                        <tr key={label}>
                                            <td className="px-3 py-2 border-b border-r border-slate-300">{label}</td>
                                            <td className="px-3 py-2 border-b border-slate-300">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.masa_retenida_tamiz_g[idx] ?? ''}
                                                    onChange={(e) => setSieveValue(idx, e.target.value)}
                                                    className="w-full h-8 px-2 rounded-md border border-input bg-white text-sm"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Control de error de tamizado</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-[1.2fr_420px] gap-4 items-start">
                            <div className="border border-slate-300">
                                <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-800">
                                    Error máximo permitido {ERROR_TAMIZADO_MAX_PCT}%
                                </div>
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-2">
                                                Masa muestra ANTES tamizado (g)
                                            </td>
                                            <td className="border-b border-slate-300 px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.masa_antes_tamizado_g ?? ''}
                                                    onChange={(e) => setField('masa_antes_tamizado_g', parseNum(e.target.value))}
                                                    autoComplete="off"
                                                    data-lpignore="true"
                                                    className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-2">
                                                Masa muestra DESPUES tamizado (g)
                                            </td>
                                            <td className="border-b border-slate-300 px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.masa_despues_tamizado_g ?? ''}
                                                    onChange={(e) => setField('masa_despues_tamizado_g', parseNum(e.target.value))}
                                                    autoComplete="off"
                                                    data-lpignore="true"
                                                    className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-r border-slate-300 px-2 py-2 font-semibold">
                                                Error de tamizado ((a-b)/(a)*100)
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.error_tamizado_pct ?? derivedError ?? ''}
                                                    readOnly
                                                    className="w-full h-9 px-3 rounded-md border border-input bg-slate-50 text-sm"
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Equipos / observaciones / firmas</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {renderSelect('Balanza 0.1 g', form.balanza_01g_codigo || '-', EQ_BALANZA, (v) => setField('balanza_01g_codigo', v))}
                                {renderSelect('Horno', form.horno_codigo || '-', EQ_HORNO, (v) => setField('horno_codigo', v))}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
                                    <textarea
                                        value={form.observaciones || ''}
                                        onChange={(e) => setField('observaciones', e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-md border border-input bg-white text-sm resize-none"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {renderSelect('Revisado por', form.revisado_por || '-', REVISADO, (v) => {
                                        setField('revisado_por', v)
                                        if (v !== '-') {
                                            setField('revisado_fecha', formatTodayShortDate())
                                        }
                                    })}
                                    {renderSelect('Aprobado por', form.aprobado_por || '-', APROBADO, (v) => {
                                        setField('aprobado_por', v)
                                        if (v !== '-') {
                                            setField('aprobado_fecha', formatTodayShortDate())
                                        }
                                    })}
                                    {renderText('Fecha revisado', form.revisado_fecha || '', (v) => setField('revisado_fecha', v), 'YYYY/MM/DD', () => applyFormattedField('revisado_fecha', normalizeFlexibleDate))}
                                    {renderText('Fecha aprobado', form.aprobado_fecha || '', (v) => setField('aprobado_fecha', v), 'YYYY/MM/DD', () => applyFormattedField('aprobado_fecha', normalizeFlexibleDate))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white p-3">
                        <table className="w-full text-xs">
                            <tbody>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">Tamices llenos</td>
                                    <td className="px-2 py-2 text-right font-semibold">{filledSieves}/{SIEVE_LABELS.length}</td>
                                </tr>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">Peso total (g)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{totalSieves || '-'}</td>
                                </tr>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">Error derivado (%)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{derivedError ?? '-'}</td>
                                </tr>
                                <tr>
                                    <td className="px-2 py-2">Error final (%)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{form.error_tamizado_pct ?? derivedError ?? '-'}</td>
                                </tr>
                            </tbody>
                        </table>
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
        </div>
    )
}
