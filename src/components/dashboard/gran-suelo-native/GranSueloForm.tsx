import { useCallback, useEffect, useRef, useState } from 'react'
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

const DRAFT_KEY = 'gran_suelo_form_draft_v1'
const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

const SIEVE_LABELS = [
    '3 in',
    '2 in',
    '1 1/2 in',
    '1 in',
    '3/4 in',
    '3/8 in',
    'No. 4',
    'No. 10',
    'No. 20',
    'No. 40',
    'No. 60',
    'No. 100',
    'No. 140',
    'No. 200',
    '< No. 200',
] as const

const SIEVE_OPENINGS = ['75.00', '50.00', '37.50', '25.00', '19.00', '9.50', '4.75', '2.000', '0.850', '0.425', '0.250', '0.150', '0.106', '0.075', '...'] as const

const CONDICION = ['-', 'ALTERADO', 'INTACTA'] as const
const SI_NO = ['-', 'SI', 'NO'] as const
const TAMIZ_SEPARADOR = ['-', 'No. 4', 'No. 10', 'No. 20'] as const
const EQ_BALANZA = ['-', 'EQP-0046'] as const
const EQ_HORNO = ['-', 'EQP-0150', 'EQP-0049'] as const
const REVISADO = ['-', 'FABIAN LA ROSA'] as const
const APROBADO = ['-', 'IRMA COAQUIRA'] as const

const SHEET_SECTION = 'border border-slate-500 bg-white'
const SHEET_TITLE = 'border-b border-slate-500 px-2 py-1 text-center text-[13px] font-bold uppercase tracking-[0.02em] text-slate-900'
const SHEET_LABEL = 'border-b border-r border-slate-400 px-2 py-1 text-[13px] leading-snug text-slate-900 align-middle'
const SHEET_VALUE = 'border-b border-slate-400 px-2 py-1 text-[13px] align-middle'
const SHEET_HEADER_CELL = 'border-b border-r border-slate-400 px-2 py-1 text-center text-[12px] font-bold text-slate-900 align-middle'
const SHEET_INPUT = 'w-full h-8 border border-slate-300 bg-white px-2 text-[13px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400'
const SHEET_TEXTAREA = 'w-full min-h-[68px] resize-none border border-slate-300 bg-white px-2 py-1 text-[13px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400'

export interface GranSueloPayload {
    muestra: string
    numero_ot: string
    cliente?: string | null
    fecha_ensayo: string
    realizado_por: string

    descripcion_turbo_organico?: string | null
    metodo_prueba: '-' | 'A' | 'B'
    tamizado_tipo: '-' | 'FRACCIONADO' | 'GLOBAL'
    metodo_muestreo: '-' | 'HUMEDO' | 'SECADO AL AIRE' | 'SECADO AL HORNO'

    tipo_muestra?: string | null
    condicion_muestra: '-' | 'ALTERADO' | 'INTACTA'
    tamano_maximo_particula_in?: string | null
    forma_particula?: string | null
    tamiz_separador?: string | null

    masa_seca_porcion_gruesa_cp_md_g?: number | null
    masa_humeda_porcion_fina_fp_mm_g?: number | null
    masa_seca_porcion_fina_fp_md_g?: number | null
    masa_seca_muestra_s_md_g?: number | null
    masa_seca_global_g?: number | null
    subespecie_masa_humeda_g?: number | null
    subespecie_masa_seca_g?: number | null
    contenido_agua_wfp_pct?: number | null

    masa_porcion_gruesa_lavada_cpwmd_g?: number | null
    masa_retenida_plato_cpmrpan_g?: number | null
    perdida_cpl_pct?: number | null
    masa_subespecimen_lavado_fina_g?: number | null
    masa_seca_muestra_perdida_smd_g?: number | null

    clasificacion_visual_simbolo?: string | null
    clasificacion_visual_nombre?: string | null
    excluyo_material: '-' | 'SI' | 'NO'
    excluyo_material_descripcion?: string | null
    problema_muestra: '-' | 'SI' | 'NO'
    problema_descripcion?: string | null
    proceso_dispersion: '-' | 'MANUAL' | 'BAÑO ULTRASÓNICO' | 'APARATO DE AGITACIÓN'
    masa_retenida_primer_tamiz_g?: number | null

    masa_retenida_tamiz_g: Array<number | null>

    balanza_01g_codigo?: string | null
    horno_110_codigo?: string | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const initialState = (): GranSueloPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    descripcion_turbo_organico: '',
    metodo_prueba: '-',
    tamizado_tipo: '-',
    metodo_muestreo: '-',
    tipo_muestra: '',
    condicion_muestra: '-',
    tamano_maximo_particula_in: '',
    forma_particula: '',
    tamiz_separador: '-',
    masa_seca_porcion_gruesa_cp_md_g: null,
    masa_humeda_porcion_fina_fp_mm_g: null,
    masa_seca_porcion_fina_fp_md_g: null,
    masa_seca_muestra_s_md_g: null,
    masa_seca_global_g: null,
    subespecie_masa_humeda_g: null,
    subespecie_masa_seca_g: null,
    contenido_agua_wfp_pct: null,
    masa_porcion_gruesa_lavada_cpwmd_g: null,
    masa_retenida_plato_cpmrpan_g: null,
    perdida_cpl_pct: null,
    masa_subespecimen_lavado_fina_g: null,
    masa_seca_muestra_perdida_smd_g: null,
    clasificacion_visual_simbolo: '',
    clasificacion_visual_nombre: '',
    excluyo_material: '-',
    excluyo_material_descripcion: '',
    problema_muestra: '-',
    problema_descripcion: '',
    proceso_dispersion: '-',
    masa_retenida_primer_tamiz_g: null,
    masa_retenida_tamiz_g: Array.from({ length: SIEVE_LABELS.length }, () => null),
    balanza_01g_codigo: '-',
    horno_110_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
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
    const match = compact.match(/^(\d+)(?:-SU)?(?:-(\d{2}))?$/)
    if (match) {
        return `${match[1]}-SU-${match[2] || year}`
    }
    return value
}

const normalizeNumeroOtCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const patterns = [/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/, /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/]

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

export interface GranSueloFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function GranSueloForm({ editId, onClose, onSaved }: GranSueloFormProps) {
    const [form, setForm] = useState<GranSueloPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)

    useEffect(() => {
        setEditingEnsayoId(editId ?? null)
    }, [editId])

    const setField = useCallback(<K extends keyof GranSueloPayload>(key: K, value: GranSueloPayload[K]) => {
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
                const res = await authFetch(`${API_URL}/api/gran-suelo/${editingEnsayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!cancelled && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged: GranSueloPayload = {
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
                toast.error('No se pudo cargar ensayo Gran Suelo para edición.')
            } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [editingEnsayoId])

    useEffect(() => {
        if (form.revisado_por && form.revisado_por !== '-' && !form.revisado_fecha) {
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })
            setField('revisado_fecha', normalizeFlexibleDate(today))
        }
    }, [form.revisado_por, form.revisado_fecha, setField])

    useEffect(() => {
        if (form.aprobado_por && form.aprobado_por !== '-' && !form.aprobado_fecha) {
            const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })
            setField('aprobado_fecha', normalizeFlexibleDate(today))
        }
    }, [form.aprobado_por, form.aprobado_fecha, setField])

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
                let savedId = editingEnsayoId

                if (download) {
                    const url = `${API_URL}/api/gran-suelo/excel?download=true${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(form),
                    })
                    if (!res.ok) throw new Error('Error al generar Excel')
                    const blob = await res.blob()
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `${buildFormatPreview(form.muestra, 'SU', 'GR. SUELO')}.xlsx`
                    link.click()
                    URL.revokeObjectURL(link.href)

                    localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                    toast.success('Gran Suelo guardado y descargado.')
                    onSaved?.()
                    onClose?.()
                } else {
                    const url = `${API_URL}/api/gran-suelo/excel?download=false${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(form),
                    })
                    if (!res.ok) throw new Error('Error al guardar ensayo')
                    const saved = await res.json()
                    savedId = saved.id || saved.ensayoId || editingEnsayoId
                    if (savedId) setEditingEnsayoId(savedId)
                    localStorage.removeItem(`${DRAFT_KEY}:new`)
                    toast.success('Gran Suelo guardado. Puedes seguir editando.')
                    onSaved?.()
                }
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error al guardar Gran Suelo'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [editingEnsayoId, form, onClose, onSaved],
    )

    const renderText = (
        value: string | undefined | null,
        onChange: (v: string) => void,
        placeholder?: string,
        onBlur?: () => void,
        className: string = SHEET_INPUT,
    ) => (
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            autoComplete="off"
            data-lpignore="true"
            className={className}
        />
    )

    const renderTextarea = (value: string | undefined | null, onChange: (v: string) => void, rows = 3) => (
        <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            autoComplete="off"
            data-lpignore="true"
            className={SHEET_TEXTAREA}
        />
    )

    const renderNumber = (value: number | null | undefined, onChange: (v: string) => void, className: string = SHEET_INPUT) => (
        <input
            type="number"
            step="any"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            className={className}
        />
    )

    const renderSelect = (value: string, options: readonly string[], onChange: (v: string) => void, className: string = SHEET_INPUT) => (
        <div className="relative">
            <select value={value} onChange={(e) => onChange(e.target.value)} className={`${className} appearance-none pr-8`}>
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
        </div>
    )

    const renderMarkButton = (active: boolean, onClick: () => void) => (
        <button
            type="button"
            onClick={onClick}
            className="flex h-7 w-9 items-center justify-center border border-slate-400 bg-white text-[13px] font-bold text-slate-900"
        >
            {active ? 'X' : ''}
        </button>
    )

    const renderProcesoButton = (label: GranSueloPayload['proceso_dispersion'], text: string) => (
        <button
            type="button"
            onClick={() => setField('proceso_dispersion', form.proceso_dispersion === label ? '-' : label)}
            className={`h-8 border border-slate-400 px-2 text-[12px] text-slate-900 ${
                form.proceso_dispersion === label ? 'bg-slate-200 font-semibold' : 'bg-white'
            }`}
        >
            {text}
        </button>
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
                                Granulometría Suelo — ASTM D6913/D6913M-17
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-SU-24.01</p>
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

                {loadingEdit ? (
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando ensayo...
                    </div>
                ) : null}

                <div className="overflow-hidden border border-slate-500 bg-white shadow-sm">
                    <div className="border-b border-slate-500 px-4 py-3 text-center">
                        <p className="text-[22px] font-semibold uppercase leading-tight text-slate-900">Laboratorio de Ensayo de Materiales</p>
                        <p className="text-lg font-semibold leading-tight text-slate-900">Formato N° F-LEM-P-SU-24.01</p>
                    </div>
                    <div className="border-b border-slate-500 px-4 py-2 text-center">
                        <p className="text-[14px] font-bold text-slate-900">
                            Standard Test Methods for Particle-Size Distribution (Gradation) of Soils Using Sieve Analysis
                        </p>
                        <p className="text-[14px] font-bold text-slate-900">ASTM D6913/D6913M-17 (Reapproved 2025)</p>
                    </div>

                    <div className="overflow-x-auto border-b border-slate-500">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    {['Muestra', 'N° OT', 'Fecha de ensayo', 'Realizado'].map((title, index) => (
                                        <th
                                            key={title}
                                            className={`px-2 py-1 text-center text-[13px] font-bold uppercase text-slate-900 ${
                                                index < 3 ? 'border-r border-slate-500' : ''
                                            }`}
                                        >
                                            {title}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border-r border-t border-slate-500 p-2">
                                        {renderText(
                                            form.muestra,
                                            (v) => setField('muestra', v),
                                            '123-SU-26',
                                            () => applyFormattedField('muestra', normalizeMuestraCode),
                                            'w-full h-8 border border-slate-300 bg-white px-2 text-center text-[13px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400',
                                        )}
                                    </td>
                                    <td className="border-r border-t border-slate-500 p-2">
                                        {renderText(
                                            form.numero_ot,
                                            (v) => setField('numero_ot', v),
                                            '1234-26',
                                            () => applyFormattedField('numero_ot', normalizeNumeroOtCode),
                                            'w-full h-8 border border-slate-300 bg-white px-2 text-center text-[13px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400',
                                        )}
                                    </td>
                                    <td className="border-r border-t border-slate-500 p-2">
                                        {renderText(
                                            form.fecha_ensayo,
                                            (v) => setField('fecha_ensayo', v),
                                            'YYYY/MM/DD',
                                            () => applyFormattedField('fecha_ensayo', normalizeFlexibleDate),
                                            'w-full h-8 border border-slate-300 bg-white px-2 text-center text-[13px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400',
                                        )}
                                    </td>
                                    <td className="border-t border-slate-500 p-2">
                                        {renderText(
                                            form.realizado_por,
                                            (v) => setField('realizado_por', v),
                                            undefined,
                                            undefined,
                                            'w-full h-8 border border-slate-300 bg-white px-2 text-center text-[13px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400',
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-3">
                        <div className="grid gap-3 xl:grid-cols-[210px_minmax(0,1fr)_320px]">
                            <div className="space-y-3">
                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Método de prueba</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Método "A"</td>
                                                <td className={SHEET_VALUE}>{renderMarkButton(form.metodo_prueba === 'A', () => setField('metodo_prueba', form.metodo_prueba === 'A' ? '-' : 'A'))}</td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Método "B"</td>
                                                <td className="px-2 py-1">{renderMarkButton(form.metodo_prueba === 'B', () => setField('metodo_prueba', form.metodo_prueba === 'B' ? '-' : 'B'))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Tamizado</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Fraccionado</td>
                                                <td className={SHEET_VALUE}>
                                                    {renderMarkButton(form.tamizado_tipo === 'FRACCIONADO', () =>
                                                        setField('tamizado_tipo', form.tamizado_tipo === 'FRACCIONADO' ? '-' : 'FRACCIONADO'),
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Global</td>
                                                <td className="px-2 py-1">
                                                    {renderMarkButton(form.tamizado_tipo === 'GLOBAL', () =>
                                                        setField('tamizado_tipo', form.tamizado_tipo === 'GLOBAL' ? '-' : 'GLOBAL'),
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Método de muestreo</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Húmedo</td>
                                                <td className={SHEET_VALUE}>
                                                    {renderMarkButton(form.metodo_muestreo === 'HUMEDO', () =>
                                                        setField('metodo_muestreo', form.metodo_muestreo === 'HUMEDO' ? '-' : 'HUMEDO'),
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Secado al aire</td>
                                                <td className={SHEET_VALUE}>
                                                    {renderMarkButton(form.metodo_muestreo === 'SECADO AL AIRE', () =>
                                                        setField('metodo_muestreo', form.metodo_muestreo === 'SECADO AL AIRE' ? '-' : 'SECADO AL AIRE'),
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Secado al horno</td>
                                                <td className="px-2 py-1">
                                                    {renderMarkButton(form.metodo_muestreo === 'SECADO AL HORNO', () =>
                                                        setField('metodo_muestreo', form.metodo_muestreo === 'SECADO AL HORNO' ? '-' : 'SECADO AL HORNO'),
                                                    )}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Descripción de la muestra</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Tipo de muestra :</td>
                                                <td className={SHEET_VALUE}>{renderText(form.tipo_muestra, (v) => setField('tipo_muestra', v))}</td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Condición de muestra:</td>
                                                <td className={SHEET_VALUE}>
                                                    {renderSelect(form.condicion_muestra, CONDICION, (v) => setField('condicion_muestra', v as GranSueloPayload['condicion_muestra']))}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Tamaño máximo de la partícula, Visual (in):</td>
                                                <td className={SHEET_VALUE}>{renderText(form.tamano_maximo_particula_in, (v) => setField('tamano_maximo_particula_in', v))}</td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Forma de la partícula:</td>
                                                <td className="px-2 py-1">{renderText(form.forma_particula, (v) => setField('forma_particula', v))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Tamizado compuesto (fraccionado)</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa seca porción gruesa (CP, Md) (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.masa_seca_porcion_gruesa_cp_md_g, (v) => setField('masa_seca_porcion_gruesa_cp_md_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa húmeda porción fina (FP, Mm) (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.masa_humeda_porcion_fina_fp_mm_g, (v) => setField('masa_humeda_porcion_fina_fp_mm_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa seca porción fina (FP, Md) (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.masa_seca_porcion_fina_fp_md_g, (v) => setField('masa_seca_porcion_fina_fp_md_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Masa seca de la muestra (S, Md) (g)</td>
                                                <td className="px-2 py-1">{renderNumber(form.masa_seca_muestra_s_md_g, (v) => setField('masa_seca_muestra_s_md_g', parseNum(v)))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Describa si es turbo o orgánico</div>
                                    <div className="p-2">{renderTextarea(form.descripcion_turbo_organico, (v) => setField('descripcion_turbo_organico', v), 3)}</div>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Tamiz separador (*)</div>
                                    <div className="p-2">{renderSelect(form.tamiz_separador || '-', TAMIZ_SEPARADOR, (v) => setField('tamiz_separador', v))}</div>
                                    <p className="border-t border-slate-400 px-2 py-1 text-[11px] text-slate-700">(*) si aplica tamizado compuesto</p>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Tamizado serie única de tamiz (global)</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa seca global (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.masa_seca_global_g, (v) => setField('masa_seca_global_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className={`${SHEET_LABEL} font-bold`}>Humedad de la subespecie porción fina</td>
                                                <td className={SHEET_VALUE}></td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa húmeda (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.subespecie_masa_humeda_g, (v) => setField('subespecie_masa_humeda_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa seca (SubS, Md) (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.subespecie_masa_seca_g, (v) => setField('subespecie_masa_seca_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Contenido de agua (wfp) (%)</td>
                                                <td className="px-2 py-1">{renderNumber(form.contenido_agua_wfp_pct, (v) => setField('contenido_agua_wfp_pct', parseNum(v)))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 xl:grid-cols-[210px_minmax(0,1fr)_320px]">
                            <div className="space-y-3">
                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Clasif. visual muestra</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Símbolo</td>
                                                <td className={SHEET_VALUE}>{renderText(form.clasificacion_visual_simbolo, (v) => setField('clasificacion_visual_simbolo', v))}</td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Nombre</td>
                                                <td className="px-2 py-1">{renderText(form.clasificacion_visual_nombre, (v) => setField('clasificacion_visual_nombre', v))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className="grid grid-cols-[1fr_84px] border-b border-slate-500">
                                        <div className="px-2 py-1 text-center text-[13px] font-bold text-slate-900">Se excluyó cualquier suelo o material de la muestra</div>
                                        <div className="border-l border-slate-500 p-1">
                                            {renderSelect(form.excluyo_material, SI_NO, (v) => setField('excluyo_material', v as GranSueloPayload['excluyo_material']))}
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 text-[12px] font-semibold text-slate-900">Describirlo:</div>
                                    <div className="p-2 pt-0">{renderTextarea(form.excluyo_material_descripcion, (v) => setField('excluyo_material_descripcion', v), 3)}</div>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className="grid grid-cols-[1fr_84px] border-b border-slate-500">
                                        <div className="px-2 py-1 text-center text-[13px] font-bold text-slate-900">Se encontró algún problema en la muestra</div>
                                        <div className="border-l border-slate-500 p-1">
                                            {renderSelect(form.problema_muestra, SI_NO, (v) => setField('problema_muestra', v as GranSueloPayload['problema_muestra']))}
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 text-[12px] font-semibold text-slate-900">Describirlo:</div>
                                    <div className="p-2 pt-0">{renderTextarea(form.problema_descripcion, (v) => setField('problema_descripcion', v), 3)}</div>
                                </div>
                            </div>

                            <div className="xl:col-span-2 space-y-3">
                                <div className={SHEET_SECTION}>
                                    <div className="border-b border-slate-500 px-2 py-1 text-[13px] font-bold uppercase text-slate-900">
                                        Pérdida aceptable durante el lavado y el tamizado{' '}
                                        <span className="font-normal normal-case">CPL=(((CP,Md-CPw,MD)+CP,Mrpan)/S,Md)</span>
                                    </div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa seca de la porción más gruesa después del lavado (CPwMd) (g)</td>
                                                <td className={`${SHEET_VALUE} w-[170px]`}>
                                                    {renderNumber(form.masa_porcion_gruesa_lavada_cpwmd_g, (v) => setField('masa_porcion_gruesa_lavada_cpwmd_g', parseNum(v)))}
                                                </td>
                                                <td className="border-b border-l border-slate-400 px-3 py-1 text-[12px] text-slate-900" rowSpan={5}>
                                                    El porcentaje de pérdida es aceptable si el valor de <span className="font-bold">CPL</span> es menor o igual al <span className="font-bold">0.5%</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa seca retenida en el plato después de tamizar la porción más gruesa (CP, Mrpan) (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.masa_retenida_plato_cpmrpan_g, (v) => setField('masa_retenida_plato_cpmrpan_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Porcentaje de la porción más gruesa perdida durante el lavado y tamizado (CPL) (%)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.perdida_cpl_pct, (v) => setField('perdida_cpl_pct', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className={SHEET_LABEL}>Masa de subespecimen lavado porción fina (g)</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.masa_subespecimen_lavado_fina_g, (v) => setField('masa_subespecimen_lavado_fina_g', parseNum(v)))}</td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-2 text-[13px] text-slate-900">
                                                    <span className="block">Masa seca de la muestra (S,Md)</span>
                                                    <span className="mt-1 block text-[12px] italic text-slate-700">S,Md= CP,Md + (FP,Mm/(1+wfp/100))</span>
                                                </td>
                                                <td className="px-2 py-1">{renderNumber(form.masa_seca_muestra_perdida_smd_g, (v) => setField('masa_seca_muestra_perdida_smd_g', parseNum(v)))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_250px]">
                                    <div className={SHEET_SECTION}>
                                        <div className={SHEET_TITLE}>Proceso de dispersión</div>
                                        <div className="grid grid-cols-1 gap-[1px] bg-slate-400 sm:grid-cols-3">
                                            <div className="bg-white p-1">{renderProcesoButton('MANUAL', 'Manual')}</div>
                                            <div className="bg-white p-1">{renderProcesoButton('BAÑO ULTRASÓNICO', 'Baño ultrasónico')}</div>
                                            <div className="bg-white p-1">{renderProcesoButton('APARATO DE AGITACIÓN', 'Aparato de agitación')}</div>
                                        </div>
                                    </div>

                                    <div className={SHEET_SECTION}>
                                        <div className={SHEET_TITLE}>Masa retenida en el primer tamiz (g)</div>
                                        <div className="p-2">{renderNumber(form.masa_retenida_primer_tamiz_g, (v) => setField('masa_retenida_primer_tamiz_g', parseNum(v)))}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
                            <div className={SHEET_SECTION}>
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={SHEET_HEADER_CELL}>Malla</th>
                                            <th className={SHEET_HEADER_CELL}>Abertura</th>
                                            <th className="border-b border-slate-400 px-2 py-1 text-center text-[12px] font-bold text-slate-900">Peso</th>
                                        </tr>
                                        <tr>
                                            <th className={SHEET_HEADER_CELL}>Tamiz</th>
                                            <th className={SHEET_HEADER_CELL}>(mm)</th>
                                            <th className="border-b border-slate-400 px-2 py-1 text-center text-[12px] font-bold text-slate-900">(g)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SIEVE_LABELS.map((label, index) => (
                                            <tr key={label}>
                                                <td className={SHEET_LABEL}>{label}</td>
                                                <td className={SHEET_LABEL}>{SIEVE_OPENINGS[index]}</td>
                                                <td className={SHEET_VALUE}>{renderNumber(form.masa_retenida_tamiz_g[index], (v) => setSieveValue(index, v), 'w-full h-7 border border-slate-300 bg-white px-2 text-[12px] text-slate-900 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-400')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="space-y-3">
                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Observaciones</div>
                                    <div className="p-2">{renderTextarea(form.observaciones, (v) => setField('observaciones', v), 4)}</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className={SHEET_SECTION}>
                                    <div className={SHEET_TITLE}>Equipos utilizados / Códigos</div>
                                    <table className="w-full border-collapse">
                                        <tbody>
                                            <tr>
                                                <td className={SHEET_LABEL}>Balanza 0.1 g</td>
                                                <td className={SHEET_VALUE}>{renderSelect(form.balanza_01g_codigo || '-', EQ_BALANZA, (v) => setField('balanza_01g_codigo', v))}</td>
                                            </tr>
                                            <tr>
                                                <td className="border-r border-slate-400 px-2 py-1 text-[13px] text-slate-900">Horno 110°C</td>
                                                <td className="px-2 py-1">{renderSelect(form.horno_110_codigo || '-', EQ_HORNO, (v) => setField('horno_110_codigo', v))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className={SHEET_SECTION}>
                                    <div className="grid grid-cols-2 gap-0">
                                        <div className="border-r border-slate-500 p-2">
                                            <p className="mb-2 text-[13px] font-semibold text-slate-900">Revisado:</p>
                                            <div className="space-y-2">
                                                {renderSelect(form.revisado_por || '-', REVISADO, (v) => {
                                                    setField('revisado_por', v);
                                                    if (v !== '-') {
                                                        setField('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                                    } else {
                                                        setField('revisado_fecha', '')
                                                    }
                                                })}
                                                {renderText(form.revisado_fecha || '', (v) => setField('revisado_fecha', v), 'YYYY/MM/DD', () =>
                                                    applyFormattedField('revisado_fecha', normalizeFlexibleDate),
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <p className="mb-2 text-[13px] font-semibold text-slate-900">Aprobado:</p>
                                            <div className="space-y-2">
                                                {renderSelect(form.aprobado_por || '-', APROBADO, (v) => {
                                                    setField('aprobado_por', v);
                                                    if (v !== '-') {
                                                        setField('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                                    } else {
                                                        setField('aprobado_fecha', '')
                                                    }
                                                })}
                                                {renderText(form.aprobado_fecha || '', (v) => setField('aprobado_fecha', v), 'YYYY/MM/DD', () =>
                                                    applyFormattedField('aprobado_fecha', normalizeFlexibleDate),
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
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
