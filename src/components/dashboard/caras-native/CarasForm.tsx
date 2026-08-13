import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Download, Loader2, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'

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

const DRAFT_KEY = 'caras_form_draft_v1'
const DEBOUNCE_MS = 700

const EQ_HORNO = ['-', 'EQP-0150', 'EQP-0049'] as const
const EQ_BALANZA = ['-', 'EQP-0046'] as const
const EQ_TAMIZ = ['-', 'INS-0053', 'INS-0053 y INS-0052'] as const
const EQ_CUARTEADOR = ['-', 'EQP-0078'] as const
const REVISADO = ['-', 'FABIAN LA ROSA'] as const
const APROBADO = ['-', 'IRMA COAQUIRA'] as const

const NOTE_1 = '(*) El tamiz especificado sera No. 4 o la designada de acuerdo a la gradacion.'
const NOTE_2 =
    '(**) Fraccionada SI, para agregados con un TMN de 3/4 in o mayor donde se debe determinar el contenido de particulas de fractura para el material retenido en el tamiz No. 4 o menor, la muestra de prueba se puede separar en el tamiz 3/8 in y la masa se reduce hasta un minimo de 200 g.'
const NOTE_3 =
    '(***) El porcentaje de la particula mas grande no representara mas de 1% de masa de muestra de ensayo o la muestra sera tan grande como se indica en la tabla 1, lo que sea menor.'
const NOTE_4 = '(****) Dato registrado solo para metodo fraccionado.'

const formatTodayShortDate = () => {
    const [yyyy = '', mm = '', dd = ''] = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }).split('-')
    return `${yyyy}/${mm}/${dd}`
}

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestraCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const match = compact.match(/^(\d+)(?:-(?:SU|AG))?(?:-(\d{2,4}))?$/)
    if (!match) return value

    const normalizedYear = (match[2] || year).slice(-2)
    return `${match[1]}-AG-${normalizedYear}`
}

const normalizeNumeroOtCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const patterns = [
        /^(?:N?OT-)?(\d+)(?:-(\d{2,4}))?$/,
        /^(\d+)(?:-(?:N?OT))?(?:-(\d{2,4}))?$/,
    ]

    for (const pattern of patterns) {
        const match = compact.match(pattern)
        if (match) {
            const normalizedYear = (match[2] || year).slice(-2)
            return `${match[1]}-${normalizedYear}`
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

export interface CarasPayload {
    muestra: string
    numero_ot: string
    cliente?: string | null
    fecha_ensayo: string
    realizado_por: string

    metodo_determinacion?: "MASA" | "RECUENTO" | "-" | null
    tamano_maximo_nominal_in?: string | null
    tamiz_especificado_in?: string | null
    fraccionada?: boolean | null

    masa_muestra_retenida_g?: number | null
    masa_particula_mas_grande_g?: number | null
    porcentaje_particula_mas_grande_pct?: number | null
    masa_muestra_seca_lavada_g?: number | null
    masa_muestra_seca_lavada_constante_g?: number | null
    masa_muestra_mayor_3_8_g?: number | null
    masa_muestra_menor_3_8_g?: number | null

    global_una_f_masa_fracturadas_g?: number | null
    global_una_n_masa_no_cumple_g?: number | null
    global_una_p_porcentaje_pct?: number | null

    global_dos_f_masa_fracturadas_g?: number | null
    global_dos_n_masa_no_cumple_g?: number | null
    global_dos_p_porcentaje_pct?: number | null

    fraccion_masa_menor_3_8_mayor_200g_una_g?: number | null
    fraccion_masa_menor_3_8_mayor_200g_dos_g?: number | null
    fraccion_una_f_masa_fracturadas_g?: number | null
    fraccion_una_n_masa_no_cumple_g?: number | null
    fraccion_una_p_porcentaje_pct?: number | null
    fraccion_dos_f_masa_fracturadas_g?: number | null
    fraccion_dos_n_masa_no_cumple_g?: number | null
    fraccion_dos_p_porcentaje_pct?: number | null

    promedio_ponderado_una_pct?: number | null
    promedio_ponderado_dos_pct?: number | null

    horno_codigo?: string | null
    balanza_01g_codigo?: string | null
    tamiz_especificado_codigo?: string | null
    cuarteador_codigo?: string | null

    nota?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const initialState = (): CarasPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    metodo_determinacion: null,
    tamano_maximo_nominal_in: '',
    tamiz_especificado_in: '',
    fraccionada: null,
    masa_muestra_retenida_g: null,
    masa_particula_mas_grande_g: null,
    porcentaje_particula_mas_grande_pct: null,
    masa_muestra_seca_lavada_g: null,
    masa_muestra_seca_lavada_constante_g: null,
    masa_muestra_mayor_3_8_g: null,
    masa_muestra_menor_3_8_g: null,
    global_una_f_masa_fracturadas_g: null,
    global_una_n_masa_no_cumple_g: null,
    global_una_p_porcentaje_pct: null,
    global_dos_f_masa_fracturadas_g: null,
    global_dos_n_masa_no_cumple_g: null,
    global_dos_p_porcentaje_pct: null,
    fraccion_masa_menor_3_8_mayor_200g_una_g: null,
    fraccion_masa_menor_3_8_mayor_200g_dos_g: null,
    fraccion_una_f_masa_fracturadas_g: null,
    fraccion_una_n_masa_no_cumple_g: null,
    fraccion_una_p_porcentaje_pct: null,
    fraccion_dos_f_masa_fracturadas_g: null,
    fraccion_dos_n_masa_no_cumple_g: null,
    fraccion_dos_p_porcentaje_pct: null,
    promedio_ponderado_una_pct: null,
    promedio_ponderado_dos_pct: null,
    horno_codigo: '-',
    balanza_01g_codigo: '-',
    tamiz_especificado_codigo: '-',
    cuarteador_codigo: '-',
    nota: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const parseNum = (raw: string): number | null => {
    if (!raw.trim()) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
}

const calcPct = (f: number | null | undefined, n: number | null | undefined): number | null => {
    if (f == null || n == null) return null
    const total = f + n
    if (total <= 0) return null
    return Number(((f / total) * 100).toFixed(4))
}

const weightedPct = (
    pg: number | null,
    mg: number | null | undefined,
    pf: number | null,
    mf: number | null | undefined,
): number | null => {
    if (pg == null) return null
    if (pf == null || mf == null || mf <= 0) return Number(pg.toFixed(4))
    const g = mg ?? 0
    const total = g + mf
    if (total <= 0) return Number(pg.toFixed(4))
    return Number((((pg * g) + pf * mf) / total).toFixed(4))
}

const formatDisplay = (value: number | null): string => {
    if (value == null) return '-'
    return value.toFixed(4)
}

const INPUT_BASE_CLASS =
    'caras-input h-7 w-full border border-[#4b4b4b] bg-white px-1.5 text-[12px] text-black outline-none focus:ring-1 focus:ring-black'

const MarkOption = ({ active, label, onClick }: { active: boolean, label: string, onClick: () => void }) => (
    <div className="flex items-center gap-2 cursor-pointer group" onClick={onClick}>
        <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${active ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300 group-hover:border-blue-400'}`}>
            {active && <span className="text-white text-xs font-bold">X</span>}
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

export interface CarasFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function CarasForm({ editId, onClose, onSaved }: CarasFormProps) {
    const [form, setForm] = useState<CarasPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)

    const pctParticula = useMemo(() => {
        const a = form.masa_muestra_retenida_g
        const b = form.masa_particula_mas_grande_g
        if (a == null || b == null || a <= 0) return null
        return Number(((b / a) * 100).toFixed(4))
    }, [form.masa_muestra_retenida_g, form.masa_particula_mas_grande_g])

    const g1 = useMemo(
        () => calcPct(form.global_una_f_masa_fracturadas_g, form.global_una_n_masa_no_cumple_g),
        [form.global_una_f_masa_fracturadas_g, form.global_una_n_masa_no_cumple_g],
    )
    const g2 = useMemo(
        () => calcPct(form.global_dos_f_masa_fracturadas_g, form.global_dos_n_masa_no_cumple_g),
        [form.global_dos_f_masa_fracturadas_g, form.global_dos_n_masa_no_cumple_g],
    )
    const f1 = useMemo(
        () => calcPct(form.fraccion_una_f_masa_fracturadas_g, form.fraccion_una_n_masa_no_cumple_g),
        [form.fraccion_una_f_masa_fracturadas_g, form.fraccion_una_n_masa_no_cumple_g],
    )
    const f2 = useMemo(
        () => calcPct(form.fraccion_dos_f_masa_fracturadas_g, form.fraccion_dos_n_masa_no_cumple_g),
        [form.fraccion_dos_f_masa_fracturadas_g, form.fraccion_dos_n_masa_no_cumple_g],
    )
    const p1 = useMemo(
        () =>
            weightedPct(
                g1,
                form.masa_muestra_mayor_3_8_g,
                f1,
                form.fraccion_masa_menor_3_8_mayor_200g_una_g,
            ),
        [g1, form.masa_muestra_mayor_3_8_g, f1, form.fraccion_masa_menor_3_8_mayor_200g_una_g],
    )
    const p2 = useMemo(
        () =>
            weightedPct(
                g2,
                form.masa_muestra_mayor_3_8_g,
                f2,
                form.fraccion_masa_menor_3_8_mayor_200g_dos_g,
            ),
        [g2, form.masa_muestra_mayor_3_8_g, f2, form.fraccion_masa_menor_3_8_mayor_200g_dos_g],
    )

    const setField = useCallback(<K extends keyof CarasPayload>(key: K, value: CarasPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }, [])

    useEffect(() => {
        setEditingEnsayoId(editId ?? null)
    }, [editId])

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
                const res = await authFetch(`${API_URL}/api/caras/${editingEnsayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!cancelled && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged: CarasPayload = {
                        ...initialState(),
                        ...payload,
                        muestra: detail.muestra || payload.muestra || '',
                        numero_ot: detail.numero_ot || payload.numero_ot || '',
                        cliente: detail.cliente || payload.cliente || '',
                        fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || '',
                        realizado_por: payload.realizado_por || 'OPERADOR',
                    }
                    merged.fecha_ensayo = normalizeFlexibleDate(merged.fecha_ensayo || '')
                    setForm(merged)
                }
            } catch {
                toast.error('No se pudo cargar ensayo Caras Fracturadas.')
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
        if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const save = useCallback(
        async (download: boolean) => {
            const normalizedForm: CarasPayload = {
                ...form,
                muestra: normalizeMuestraCode(form.muestra),
                numero_ot: normalizeNumeroOtCode(form.numero_ot),
            }

            if (!normalizedForm.muestra || !normalizedForm.numero_ot || !normalizedForm.realizado_por) {
                toast.error('Complete Muestra, N° OT y Realizado por.')
                return
            }

            setLoading(true)
            try {
                const payload: CarasPayload = {
                    ...normalizedForm,
                    porcentaje_particula_mas_grande_pct: pctParticula,
                    global_una_p_porcentaje_pct: g1,
                    global_dos_p_porcentaje_pct: g2,
                    fraccion_una_p_porcentaje_pct: f1,
                    fraccion_dos_p_porcentaje_pct: f2,
                    promedio_ponderado_una_pct: p1,
                    promedio_ponderado_dos_pct: p2,
                }
                let savedId = editingEnsayoId

                if (download) {
                    const url = `${API_URL}/api/caras/excel?download=true${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    if (!res.ok) throw new Error('Error al generar Excel')
                    const blob = await res.blob()
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `${buildFormatPreview(normalizedForm.muestra, 'AG', 'CARAS')}.xlsx`
                    link.click()
                    URL.revokeObjectURL(link.href)

                    localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                    toast.success('Caras Fracturadas guardado y descargado.')
                    onSaved?.()
                    onClose?.()
                } else {
                    const url = `${API_URL}/api/caras/excel?download=false${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
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
                    toast.success('Caras Fracturadas guardado. Puedes seguir editando.')
                    onSaved?.()
                }
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error desconocido al guardar Caras Fracturadas'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [editingEnsayoId, f1, f2, form, g1, g2, onClose, onSaved, p1, p2, pctParticula],
    )

    const renderNumberInput = (key: keyof CarasPayload) => (
        <input
            type="number"
            step="any"
            value={form[key] == null ? '' : String(form[key])}
            onChange={(e) => setField(key, parseNum(e.target.value) as CarasPayload[typeof key])}
            autoComplete="off"
            data-lpignore="true"
            className={INPUT_BASE_CLASS}
        />
    )

    const renderTextInput = (key: keyof CarasPayload, placeholder = '', extraClass = '', onBlur?: () => void) => (
        <input
            type="text"
            value={String(form[key] ?? '')}
            onChange={(e) => {
                const nextValue = e.target.value as CarasPayload[typeof key]
                setField(key, nextValue)
                if ((key === 'revisado_por' || key === 'aprobado_por') && nextValue !== '-') {
                    setField(key === 'revisado_por' ? 'revisado_fecha' : 'aprobado_fecha', formatTodayShortDate())
                }
            }}
            onBlur={onBlur}
            autoComplete="off"
            data-lpignore="true"
            placeholder={placeholder}
            className={`${INPUT_BASE_CLASS} ${extraClass}`.trim()}
        />
    )

    const renderSelect = (key: keyof CarasPayload, options: readonly string[]) => (
        <select
            value={String(form[key] ?? '-')}
            onChange={(e) => {
                const nextValue = e.target.value as CarasPayload[typeof key]
                setField(key, nextValue)
                if ((key === 'revisado_por' || key === 'aprobado_por') && nextValue !== '-') {
                    setField(key === 'revisado_por' ? 'revisado_fecha' : 'aprobado_fecha', formatTodayShortDate())
                }
            }}
            className={`${INPUT_BASE_CLASS} pr-6`}
            autoComplete="off"
            data-lpignore="true"
        >
            {options.map((option) => (
                <option key={option} value={option}>
                    {option}
                </option>
            ))}
        </select>
    )

    return (
        <div className="caras-page min-h-screen bg-[#e9ecef] px-2 py-4 md:px-4 overflow-y-auto">
            <div className="mx-auto max-w-[1600px] space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-base font-semibold text-slate-900 md:text-lg">CARAS FRACTURADAS ASTM D5821</h1>
                            <p className="text-xs text-slate-600">Replica del formato Excel oficial</p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none"
                            title="Regresar al Dashboard"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {loadingEdit ? (
                    <div className="mb-3 flex h-9 items-center gap-2 border border-[#4b4b4b] bg-white px-3 text-[12px] text-black">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Cargando ensayo...
                    </div>
                ) : null}

                <div className="overflow-x-auto border border-[#1f4f8f] bg-white p-2 md:p-3">
                    <div className="caras-sheet min-w-[1180px] border border-[#4b4b4b] bg-white">
                        <div className="grid grid-cols-4 border-b border-[#4b4b4b] bg-[#f8f8f8] text-center text-[13px] font-bold">
                            <div className="border-r border-[#4b4b4b] py-1">MUESTRA</div>
                            <div className="border-r border-[#4b4b4b] py-1">N° OT</div>
                            <div className="border-r border-[#4b4b4b] py-1">FECHA DE ENSAYO</div>
                            <div className="py-1">REALIZADO</div>
                        </div>

                        <div className="grid grid-cols-4 border-b border-[#4b4b4b]">
                            <div className="border-r border-[#4b4b4b] p-1">{renderTextInput('muestra', '171-AG-26', 'text-center', () => setField('muestra', normalizeMuestraCode(form.muestra)))}</div>
                            <div className="border-r border-[#4b4b4b] p-1">{renderTextInput('numero_ot', '1021-26', 'text-center', () => setField('numero_ot', normalizeNumeroOtCode(form.numero_ot)))}</div>
                            <div className="border-r border-[#4b4b4b] p-1">{renderTextInput('fecha_ensayo', 'YYYY/MM/DD', 'text-center', () => setField('fecha_ensayo', normalizeFlexibleDate(String(form.fecha_ensayo ?? ''))))}</div>
                            <div className="p-1">{renderTextInput('realizado_por', 'Realizado por', 'text-center')}</div>
                        </div>

                        <div className="border-b border-[#4b4b4b] bg-[#f4f4f4] px-2 py-1 text-center">
                            <p className="text-[21px] font-bold leading-tight">
                                STANDARD TEST METHOD FOR DETERMINING THE PERCENTAGE OF FRACTURED PARTICLES IN COARSE AGGREGATE
                            </p>
                            <p className="text-[24px] font-bold leading-tight">ASTM D5821-13 (Reapproved 2025)</p>
                        </div>

                        <div className="grid grid-cols-[3fr_2fr] border-b border-[#4b4b4b]">
                            <div className="border-r border-[#4b4b4b]">
                                <div className="border-b border-[#4b4b4b]">
                                    <div className="border-b border-[#4b4b4b] px-2 py-1 text-center text-[13px] font-bold">
                                        Codigo equipos utilizados
                                    </div>
                                    <div className="grid grid-cols-[1.4fr_1.6fr] border-b border-[#4b4b4b]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Horno</div>
                                        <div className="p-1">{renderSelect('horno_codigo', EQ_HORNO)}</div>
                                    </div>
                                    <div className="grid grid-cols-[1.4fr_1.6fr] border-b border-[#4b4b4b]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Balanza 0.1 g</div>
                                        <div className="p-1">{renderSelect('balanza_01g_codigo', EQ_BALANZA)}</div>
                                    </div>
                                    <div className="grid grid-cols-[1.4fr_1.6fr] border-b border-[#4b4b4b]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Tamiz especificado</div>
                                        <div className="p-1">{renderSelect('tamiz_especificado_codigo', EQ_TAMIZ)}</div>
                                    </div>
                                    <div className="grid grid-cols-[1.4fr_1.6fr]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Cuarteador</div>
                                        <div className="p-1">{renderSelect('cuarteador_codigo', EQ_CUARTEADOR)}</div>
                                    </div>
                                </div>

                                <div className="border-t border-[#4b4b4b]">
                                    <div className="border-b border-[#4b4b4b] px-2 py-1 text-[13px] font-bold">
                                        INFORMACION DEL ENSAYO (Marcar "X")
                                    </div>
                                    <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-[#4b4b4b]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">
                                            Metodo para la determinacion del porcentaje de particulas fracturadas
                                        </div>
                                        <div className="border-r border-[#4b4b4b] px-2 py-1">
                                            <MarkOption
                                                label="Masa"
                                                active={form.metodo_determinacion !== 'RECUENTO'}
                                                onClick={() => setField('metodo_determinacion', 'MASA')}
                                            />
                                        </div>
                                        <div className="px-2 py-1">
                                            <MarkOption
                                                label="Recuento"
                                                active={form.metodo_determinacion === 'RECUENTO'}
                                                onClick={() => setField('metodo_determinacion', 'RECUENTO')}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-[2fr_2fr] border-b border-[#4b4b4b]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Tamano Maximo Nominal (in)</div>
                                        <div className="p-1">{renderTextInput('tamano_maximo_nominal_in')}</div>
                                    </div>
                                    <div className="grid grid-cols-[2fr_2fr] border-b border-[#4b4b4b]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Tamiz especificado (in) (*)</div>
                                        <div className="p-1">{renderTextInput('tamiz_especificado_in')}</div>
                                    </div>
                                    <div className="grid grid-cols-[2fr_1fr_1fr]">
                                        <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Fraccionada (**)</div>
                                        <div className="border-r border-[#4b4b4b] px-2 py-1">
                                            <MarkOption
                                                label="SI"
                                                active={form.fraccionada === true}
                                                onClick={() => setField('fraccionada', form.fraccionada === true ? null : true)}
                                            />
                                        </div>
                                        <div className="px-2 py-1">
                                            <MarkOption
                                                label="NO"
                                                active={form.fraccionada === false}
                                                onClick={() => setField('fraccionada', form.fraccionada === false ? null : false)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white">
                                <div className="h-2 w-full bg-black" />
                                <div className="px-3 py-2 text-[11px] leading-tight text-center">
                                    <p className="font-semibold">Tabla peso minimo</p>
                                    <p>Fuente: Norma ASTM D5821-13 (Reapproved 2025)</p>
                                </div>
                                <div className="flex justify-center pb-3">
                                    <img
                                        src="/caras-ref.png"
                                        alt="Tabla peso minimo ASTM D5821"
                                        className="w-[260px] md:w-[300px] border border-[#4b4b4b] bg-white"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-b border-[#4b4b4b]">
                            <div className="border-b border-[#4b4b4b] px-2 py-1 text-[13px] font-bold">MUESTRA ORIGINAL DE ENSAYO</div>

                            <div className="grid grid-cols-[3fr_1fr_1fr] border-b border-[#4b4b4b]">
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">
                                    (A) Masa de la muestra retenida en el tamiz especificado (g)
                                </div>
                                <div className="border-r border-[#4b4b4b] p-1">{renderNumberInput('masa_muestra_retenida_g')}</div>
                                <div className="p-1" />
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr] border-b border-[#4b4b4b]">
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">(B) Masa de la particula mas grande (g)</div>
                                <div className="border-r border-[#4b4b4b] p-1">{renderNumberInput('masa_particula_mas_grande_g')}</div>
                                <div className="p-1" />
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr] border-b border-[#4b4b4b]">
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">
                                    Porcentaje en masa de la particula mas grande (%) (***) (B*100/A)
                                </div>
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">{pctParticula == null ? '' : formatDisplay(pctParticula)}</div>
                                <div className="px-2 py-1 text-[12px]">&lt;=1% cumple</div>
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr] border-b border-[#4b4b4b]">
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Masa de la muestra seca lavada (g)</div>
                                <div className="border-r border-[#4b4b4b] p-1">{renderNumberInput('masa_muestra_seca_lavada_g')}</div>
                                <div className="p-1" />
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr] border-b border-[#4b4b4b]">
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Masa de la muestra seca lavada constante (g)</div>
                                <div className="border-r border-[#4b4b4b] p-1">{renderNumberInput('masa_muestra_seca_lavada_constante_g')}</div>
                                <div className="p-1" />
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr] border-b border-[#4b4b4b]">
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Masa de la muestra &gt; 3/8 (g) (****)</div>
                                <div className="border-r border-[#4b4b4b] p-1">{renderNumberInput('masa_muestra_mayor_3_8_g')}</div>
                                <div className="p-1" />
                            </div>
                            <div className="grid grid-cols-[3fr_1fr_1fr]">
                                <div className="border-r border-[#4b4b4b] px-2 py-1 text-[12px]">Masa de la muestra &lt; 3/8 (g) (****)</div>
                                <div className="border-r border-[#4b4b4b] p-1">{renderNumberInput('masa_muestra_menor_3_8_g')}</div>
                                <div className="p-1" />
                            </div>
                        </div>

                        <div className="border-b border-[#4b4b4b] px-2 py-1.5 text-[11px] italic leading-tight">
                            <p>{NOTE_1}</p>
                            <p>{NOTE_2}</p>
                            <p>{NOTE_3}</p>
                            <p>{NOTE_4}</p>
                        </div>

                        <table className="w-full border-b border-[#4b4b4b] text-[12px]">
                            <thead>
                                <tr className="bg-[#f8f8f8]">
                                    <th className="border-r border-b border-[#4b4b4b] px-2 py-1.5 text-center font-bold">MUESTRA DE PRUEBA</th>
                                    <th className="border-r border-b border-[#4b4b4b] px-2 py-1.5 text-center font-bold">Particulas con una o mas caras fracturadas</th>
                                    <th className="border-b border-[#4b4b4b] px-2 py-1.5 text-center font-bold">Particulas con dos o mas caras fracturadas</th>
                                </tr>
                                <tr>
                                    <th className="border-r border-b border-[#4b4b4b] px-2 py-1 text-left font-normal" />
                                    <th className="border-r border-b border-[#4b4b4b] px-2 py-1 text-center font-semibold">(1) &gt; 3/8 in o Global</th>
                                    <th className="border-b border-[#4b4b4b] px-2 py-1 text-center font-semibold">(1) &gt; 3/8 in o Global</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1">Masa particulas fracturadas (g)</td>
                                    <td className="border-r border-b border-[#4b4b4b] p-1">{renderNumberInput('global_una_f_masa_fracturadas_g')}</td>
                                    <td className="border-b border-[#4b4b4b] p-1">{renderNumberInput('global_dos_f_masa_fracturadas_g')}</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1">Masa particulas que no cumplen el criterio especificado (g)</td>
                                    <td className="border-r border-b border-[#4b4b4b] p-1">{renderNumberInput('global_una_n_masa_no_cumple_g')}</td>
                                    <td className="border-b border-[#4b4b4b] p-1">{renderNumberInput('global_dos_n_masa_no_cumple_g')}</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1">Porcentaje de particulas con caras fracturadas (%)</td>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1 text-center">{formatDisplay(g1)}</td>
                                    <td className="border-b border-[#4b4b4b] px-2 py-1 text-center">{formatDisplay(g2)}</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1 text-left font-semibold" />
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1 text-center font-semibold">(2) &lt; 3/8 in</td>
                                    <td className="border-b border-[#4b4b4b] px-2 py-1 text-center font-semibold">(2) &lt; 3/8 in</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1">Masa de la muestra &lt; 3/8 (g), FRACCION MAYOR DE 200 g</td>
                                    <td className="border-r border-b border-[#4b4b4b] p-1">{renderNumberInput('fraccion_masa_menor_3_8_mayor_200g_una_g')}</td>
                                    <td className="border-b border-[#4b4b4b] p-1">{renderNumberInput('fraccion_masa_menor_3_8_mayor_200g_dos_g')}</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1">Masa particulas fracturadas (g)</td>
                                    <td className="border-r border-b border-[#4b4b4b] p-1">{renderNumberInput('fraccion_una_f_masa_fracturadas_g')}</td>
                                    <td className="border-b border-[#4b4b4b] p-1">{renderNumberInput('fraccion_dos_f_masa_fracturadas_g')}</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1">Masa particulas que no cumplen el criterio especificado (g)</td>
                                    <td className="border-r border-b border-[#4b4b4b] p-1">{renderNumberInput('fraccion_una_n_masa_no_cumple_g')}</td>
                                    <td className="border-b border-[#4b4b4b] p-1">{renderNumberInput('fraccion_dos_n_masa_no_cumple_g')}</td>
                                </tr>
                                <tr>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1">Porcentaje de particulas con caras fracturadas (%)</td>
                                    <td className="border-r border-b border-[#4b4b4b] px-2 py-1 text-center">{formatDisplay(f1)}</td>
                                    <td className="border-b border-[#4b4b4b] px-2 py-1 text-center">{formatDisplay(f2)}</td>
                                </tr>
                                <tr className="bg-[#f8f8f8]">
                                    <td className="border-r border-[#4b4b4b] px-2 py-1 font-semibold">Promedio Ponderado (%)</td>
                                    <td className="border-r border-[#4b4b4b] px-2 py-1 text-center font-semibold">{formatDisplay(p1)}</td>
                                    <td className="px-2 py-1 text-center font-semibold">{formatDisplay(p2)}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="border-b border-[#4b4b4b] px-2 py-1 text-[12px] font-bold">Nota:</div>
                        <div className="border-b border-[#4b4b4b] p-1">
                            <textarea
                                value={form.nota || ''}
                                onChange={(e) => setField('nota', e.target.value)}
                                rows={3}
                                className="caras-input w-full resize-none border border-[#4b4b4b] bg-white px-2 py-1 text-[12px] outline-none focus:ring-1 focus:ring-black"
                                autoComplete="off"
                                data-lpignore="true"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5 border-b border-[#4b4b4b] px-8 py-3">
                            <div className="border border-[#4b4b4b] p-2">
                                <p className="mb-1 text-[12px] font-semibold">Revisado:</p>
                                <div className="mb-1">{renderSelect('revisado_por', REVISADO)}</div>
                                <p className="mb-1 text-[12px] font-semibold">Fecha:</p>
                                {renderTextInput('revisado_fecha', 'YYYY/MM/DD', '', () => setField('revisado_fecha', normalizeFlexibleDate(String(form.revisado_fecha ?? ''))))}
                            </div>
                            <div className="border border-[#4b4b4b] p-2">
                                <p className="mb-1 text-[12px] font-semibold">Aprobado:</p>
                                <div className="mb-1">{renderSelect('aprobado_por', APROBADO)}</div>
                                <p className="mb-1 text-[12px] font-semibold">Fecha:</p>
                                {renderTextInput('aprobado_fecha', 'YYYY/MM/DD', '', () => setField('aprobado_fecha', normalizeFlexibleDate(String(form.aprobado_fecha ?? ''))))}
                            </div>
                        </div>

                        <div className="px-2 py-1 text-[12px]">Pagina 1 de 1</div>
                        <div className="px-2 pb-1 text-[12px]">Version: 03 (2026-02-12)</div>
                        <div className="border-t-4 border-[#1f4f8f] px-2 py-1 text-center text-[12px]">
                            WEB: www.geofal.com.pe, E-MAIL: laboratorio@geofal.com.pe
                            <br />
                            Av. Maranon 763, Los Olivos-Lima / Telefono: 01 754-3070
                        </div>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                    <button
                        onClick={clearAll}
                        type="button"
                        className="flex h-10 items-center justify-center gap-1.5 border border-[#4b4b4b] bg-white text-[12px] font-semibold text-black hover:bg-[#f2f2f2]"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Limpiar
                    </button>
                    <button
                        onClick={() => void save(false)}
                        disabled={loading}
                        type="button"
                        className="flex h-10 items-center justify-center gap-2 border border-[#4b4b4b] bg-white text-[12px] font-semibold text-black hover:bg-[#f2f2f2] disabled:opacity-60"
                    >
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Guardando...</> : <><Save className="h-4 w-4" />Guardar</>}
                    </button>
                    <button
                        onClick={() => void save(true)}
                        disabled={loading}
                        type="button"
                        className="flex h-10 items-center justify-center gap-1.5 border border-[#4b4b4b] bg-black text-[12px] font-semibold text-white hover:bg-[#1f1f1f] disabled:opacity-60"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                <Download className="h-3.5 w-3.5" />
                                Guardar y Exportar
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
