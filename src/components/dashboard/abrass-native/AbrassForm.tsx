import { useCallback, useEffect, useMemo, useState } from "react"
import { Beaker, Download, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import FormatConfirmModal from "../abra-native/FormatConfirmModal"
import { authFetch } from "@/lib/api-auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export interface AbrassPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string
    masa_muestra_inicial_g?: number | null
    masa_muestra_inicial_seca_despues_lavado_g?: number | null
    masa_muestra_inicial_seca_constante_despues_lavado_g?: number | null
    requiere_lavado?: "SI" | "NO" | "-" | null
    numero_revoluciones?: number | null
    gradacion_a_tamiz_g: Array<number | null>
    gradacion_b_tamiz_g: Array<number | null>
    gradacion_c_tamiz_g: Array<number | null>
    gradacion_d_tamiz_g: Array<number | null>
    item_3_masa_esferas_conjunto_g: Array<number | null>
    item_a_masa_original_g: Array<number | null>
    item_b_masa_final_g: Array<number | null>
    item_c_masa_final_lavada_seca_g: Array<number | null>
    item_d_masa_final_lavada_seca_constante_g: Array<number | null>
    item_e_perdida_abrasion_pct: Array<number | null>
    item_f_perdida_lavado_pct: Array<number | null>
    horno_codigo?: string | null
    maquina_los_angeles_codigo?: string | null
    balanza_1g_codigo?: string | null
    malla_no_12_codigo?: string | null
    malla_no_4_codigo?: string | null
    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

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

const DRAFT_KEY = 'abrass_form_draft_v1'
const DEBOUNCE_MS = 700
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const

const TAMIZ_ROWS = [
    { pasante: '1 1/2', retenido: '1' },
    { pasante: '1', retenido: '3/4' },
    { pasante: '3/4', retenido: '1/2' },
    { pasante: '1/2', retenido: '3/8' },
    { pasante: '3/8', retenido: '1/4' },
    { pasante: '1/4', retenido: 'No. 4' },
    { pasante: 'No. 4', retenido: 'No. 8' },
] as const

const ESFERAS_CANTIDAD = ['12', '11', '8', '6'] as const
const ESFERAS_RANGO = ['4975 - 5025', '4555 - 4605', '3310 - 3350', '2485 - 2515'] as const

const EQUIPO_OPTIONS = {
    horno_codigo: ['-', 'EQP-0150', 'EQP-0049'],
    maquina_los_angeles_codigo: ['-', 'EQP-0043'],
    balanza_1g_codigo: ['-', 'EQP-0054'],
    malla_no_12_codigo: ['-', 'INS-0144'],
    malla_no_4_codigo: ['-', 'INS-0053'],
} as const

const withCurrentOption = (value: string | null | undefined, base: readonly string[]) => {
    const current = (value ?? '').trim()
    if (!current || base.includes(current)) return base
    return [...base, current]
}

type TamizFieldKey =
    | 'gradacion_a_tamiz_g'
    | 'gradacion_b_tamiz_g'
    | 'gradacion_c_tamiz_g'
    | 'gradacion_d_tamiz_g'

type QuadFieldKey =
    | 'item_3_masa_esferas_conjunto_g'
    | 'item_a_masa_original_g'
    | 'item_b_masa_final_g'
    | 'item_c_masa_final_lavada_seca_g'
    | 'item_d_masa_final_lavada_seca_constante_g'
    | 'item_e_perdida_abrasion_pct'
    | 'item_f_perdida_lavado_pct'

const ITEM_ROWS: ReadonlyArray<{ item: string; descripcion: string; unidad: string; key: QuadFieldKey }> = [
    { item: '3', descripcion: 'Masa de esferas en conjunto', unidad: 'g', key: 'item_3_masa_esferas_conjunto_g' },
    { item: 'a', descripcion: 'Masa de la muestra de prueba original', unidad: 'g', key: 'item_a_masa_original_g' },
    { item: 'b', descripcion: 'Masa final de la muestra de prueba', unidad: 'g', key: 'item_b_masa_final_g' },
    { item: 'c', descripcion: 'Masa final de la muestra (Lavada seca)', unidad: 'g', key: 'item_c_masa_final_lavada_seca_g' },
    { item: 'd', descripcion: 'Masa final de la muestra (Lavada seca constante)', unidad: 'g', key: 'item_d_masa_final_lavada_seca_constante_g' },
    { item: 'e', descripcion: 'Pérdida por abrasión ((a-d)/a *100)', unidad: '%', key: 'item_e_perdida_abrasion_pct' },
    { item: 'f', descripcion: 'Perdida de masa por lavado ((b-d)/a)*100', unidad: '%', key: 'item_f_perdida_lavado_pct' },
]

const GRADACION_EDITABLE_ROWS: Record<TamizFieldKey, readonly boolean[]> = {
    gradacion_a_tamiz_g: [true, true, true, true, false, false, false],
    gradacion_b_tamiz_g: [false, false, true, true, false, false, false],
    gradacion_c_tamiz_g: [false, false, false, false, true, true, false],
    gradacion_d_tamiz_g: [false, false, false, false, false, false, true],
}

const isGradacionEditable = (key: TamizFieldKey, rowIndex: number) => Boolean(GRADACION_EDITABLE_ROWS[key]?.[rowIndex])

const sanitizeGradacionField = (key: TamizFieldKey, values?: Array<number | null>): Array<number | null> =>
    Array.from({ length: TAMIZ_ROWS.length }, (_, idx) => {
        if (!isGradacionEditable(key, idx)) return null
        return values?.[idx] ?? null
    })

const sanitizeGradaciones = (payload: AbrassPayload): AbrassPayload => ({
    ...payload,
    gradacion_a_tamiz_g: sanitizeGradacionField('gradacion_a_tamiz_g', payload.gradacion_a_tamiz_g),
    gradacion_b_tamiz_g: sanitizeGradacionField('gradacion_b_tamiz_g', payload.gradacion_b_tamiz_g),
    gradacion_c_tamiz_g: sanitizeGradacionField('gradacion_c_tamiz_g', payload.gradacion_c_tamiz_g),
    gradacion_d_tamiz_g: sanitizeGradacionField('gradacion_d_tamiz_g', payload.gradacion_d_tamiz_g),
})

const sumGradacionColumn = (key: TamizFieldKey, values: Array<number | null>) =>
    Number(
        values
            .reduce((acc: number, current, idx) => acc + (isGradacionEditable(key, idx) ? (current ?? 0) : 0), 0)
            .toFixed(4),
    )

const formatComputedNumber = (value: number) => {
    if (Number.isInteger(value)) return String(value)
    return value.toFixed(4).replace(/\.?0+$/, '')
}

const empty4 = () => [null, null, null, null] as Array<number | null>
const empty7 = () => Array.from({ length: 7 }, () => null as number | null)
const parseNum = (v: string) => {
    if (v.trim() === '') return null
    const parsed = Number(v)
    return Number.isFinite(parsed) ? parsed : null
}

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)
const formatTodayYmd = () => {
    const [yyyy = '', mm = '', dd = ''] = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }).split('-')
    return `${yyyy}/${mm}/${dd}`
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
    const build = (y: string, m: string, d: string) => `${y}/${pad2(m)}/${pad2(d)}`
    const normalizeYear = (y: string) => {
        const clean = y.replace(/\D/g, '')
        if (clean.length >= 4) return clean.slice(0, 4)
        if (clean.length === 2) return `20${clean}`
        if (clean.length === 1) return `200${clean}`
        return currentYear
    }

    if (value.includes('/')) {
        const [a = '', b = '', c = ''] = value.split('/').map((part) => part.trim())
        if (!a || !b) return value
        if (a.length === 4) return build(normalizeYear(a), b, c || '01')
        return build(normalizeYear(c), b, a)
    }

    if (digits.length === 8) {
        if (digits.startsWith('19') || digits.startsWith('20')) return build(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8))
        return build(digits.slice(4, 8), digits.slice(2, 4), digits.slice(0, 2))
    }
    if (digits.length === 6) return build(`20${digits.slice(4, 6)}`, digits.slice(2, 4), digits.slice(0, 2))
    if (digits.length === 4) return build(currentYear, digits.slice(2, 4), digits.slice(0, 2))
    if (digits.length === 3) return build(currentYear, digits.slice(1, 3), digits.slice(0, 1))
    if (digits.length === 2) return build(currentYear, digits.slice(1, 2), digits.slice(0, 1))

    return value
}

const initialState = (): AbrassPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    masa_muestra_inicial_g: null,
    masa_muestra_inicial_seca_despues_lavado_g: null,
    masa_muestra_inicial_seca_constante_despues_lavado_g: null,
    requiere_lavado: '-',
    numero_revoluciones: 500,
    gradacion_a_tamiz_g: empty7(),
    gradacion_b_tamiz_g: empty7(),
    gradacion_c_tamiz_g: empty7(),
    gradacion_d_tamiz_g: empty7(),
    item_3_masa_esferas_conjunto_g: empty4(),
    item_a_masa_original_g: empty4(),
    item_b_masa_final_g: empty4(),
    item_c_masa_final_lavada_seca_g: empty4(),
    item_d_masa_final_lavada_seca_constante_g: empty4(),
    item_e_perdida_abrasion_pct: empty4(),
    item_f_perdida_lavado_pct: empty4(),
    horno_codigo: '-',
    maquina_los_angeles_codigo: '-',
    balanza_1g_codigo: '-',
    malla_no_12_codigo: '-',
    malla_no_4_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: formatTodayYmd(),
    aprobado_por: '-',
    aprobado_fecha: formatTodayYmd(),
})

interface AbrassFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function AbrassForm({ editId, onClose, onSaved }: AbrassFormProps) {
    const [form, setForm] = useState<AbrassPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [ensayoId, setEnsayoId] = useState<number | null>(editId || null)

    const [muestraInput, setMuestraInput] = useState('')
    const [muestraType, setMuestraType] = useState<'SU' | 'AG'>('SU')
    const [muestraYear, setMuestraYear] = useState(() => new Date().getFullYear().toString().slice(-2))

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
        const raw = localStorage.getItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
        if (!raw) return
        try {
            setForm(sanitizeGradaciones({ ...initialState(), ...JSON.parse(raw) }))
        } catch {
            // ignore draft corruption
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
                const res = await authFetch(`${API_URL}/api/abrass/${ensayoId}`)
                if (!res.ok) throw new Error("Error loading detail")
                const detail = await res.json()
                if (!cancel && detail.payload) setForm(sanitizeGradaciones({ ...initialState(), ...detail.payload }))
            } catch {
                toast.error('No se pudo cargar ensayo ABRASS.')
            } finally {
                if (!cancel) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancel = true
        }
    }, [ensayoId])

    const gradacionTotals = useMemo(
        () => ({
            a: sumGradacionColumn('gradacion_a_tamiz_g', form.gradacion_a_tamiz_g),
            b: sumGradacionColumn('gradacion_b_tamiz_g', form.gradacion_b_tamiz_g),
            c: sumGradacionColumn('gradacion_c_tamiz_g', form.gradacion_c_tamiz_g),
            d: sumGradacionColumn('gradacion_d_tamiz_g', form.gradacion_d_tamiz_g),
        }),
        [form.gradacion_a_tamiz_g, form.gradacion_b_tamiz_g, form.gradacion_c_tamiz_g, form.gradacion_d_tamiz_g],
    )

    const itemAMasaOriginalComputed = useMemo(
        () => [gradacionTotals.a, gradacionTotals.b, gradacionTotals.c, gradacionTotals.d] as const,
        [gradacionTotals.a, gradacionTotals.b, gradacionTotals.c, gradacionTotals.d],
    )

    useEffect(() => {
        setForm((prev) => {
            const nextE = [...prev.item_e_perdida_abrasion_pct]
            const nextF = [...prev.item_f_perdida_lavado_pct]
            let changed = false

            for (let i = 0; i < 4; i++) {
                const a = itemAMasaOriginalComputed[i]
                const b = prev.item_b_masa_final_g[i]
                const d = prev.item_d_masa_final_lavada_seca_constante_g[i]

                if (a && a > 0) {
                    if (d != null) {
                        const valE = Number(((a - d) / a * 100).toFixed(4))
                        if (nextE[i] !== valE) {
                            nextE[i] = valE
                            changed = true
                        }
                    } else if (nextE[i] !== null) {
                        nextE[i] = null
                        changed = true
                    }

                    if (b != null && d != null) {
                        const valF = Number(((b - d) / a * 100).toFixed(4))
                        if (nextF[i] !== valF) {
                            nextF[i] = valF
                            changed = true
                        }
                    } else if (nextF[i] !== null) {
                        nextF[i] = null
                        changed = true
                    }
                } else {
                    if (nextE[i] !== null || nextF[i] !== null) {
                        nextE[i] = null
                        nextF[i] = null
                        changed = true
                    }
                }
            }

            if (changed) {
                return {
                    ...prev,
                    item_e_perdida_abrasion_pct: nextE,
                    item_f_perdida_lavado_pct: nextF,
                }
            }
            return prev
        })
    }, [itemAMasaOriginalComputed, form.item_b_masa_final_g, form.item_d_masa_final_lavada_seca_constante_g])

    const perdidaAbrasionPromedio = useMemo(() => {
        const vals = form.item_e_perdida_abrasion_pct.filter((v): v is number => v != null)
        return vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4)) : null
    }, [form.item_e_perdida_abrasion_pct])

    const setField = useCallback(<K extends keyof AbrassPayload>(k: K, v: AbrassPayload[K]) => {
        setForm((p) => ({ ...p, [k]: v }))
    }, [])

    const setArray = useCallback((k: TamizFieldKey, i: number, raw: string) => {
        if (!isGradacionEditable(k, i)) return
        setForm((p) => {
            const next = [...p[k]]
            next[i] = parseNum(raw)
            return { ...p, [k]: next }
        })
    }, [])

    const setQuad = useCallback((k: QuadFieldKey, i: number, raw: string) => {
        setForm((p) => {
            const next = [...p[k]]
            next[i] = parseNum(raw)
            return { ...p, [k]: next }
        })
    }, [])

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiarán los datos no guardados. ¿Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
        setForm(initialState())
    }, [ensayoId])

    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)

    const save = useCallback(async (download: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) return toast.error('Complete Muestra, N OT y Realizado por.')
        const payload = sanitizeGradaciones({
            ...form,
            item_a_masa_original_g: [
                sumGradacionColumn('gradacion_a_tamiz_g', form.gradacion_a_tamiz_g),
                sumGradacionColumn('gradacion_b_tamiz_g', form.gradacion_b_tamiz_g),
                sumGradacionColumn('gradacion_c_tamiz_g', form.gradacion_c_tamiz_g),
                sumGradacionColumn('gradacion_d_tamiz_g', form.gradacion_d_tamiz_g),
            ],
            numero_revoluciones: 500,
        })

        setLoading(true)
        try {
            if (download) {
                const res = await authFetch(`${API_URL}/api/abrass/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ""}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                })
                if (!res.ok) throw new Error("Excel generation failed")
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                
                const cd = res.headers.get('content-disposition')
                const filenameMatch = cd ? cd.match(/filename="?([^";]+)"?/i) : null
                const filename = filenameMatch?.[1] || `${buildFormatPreview(form.muestra, 'AG', 'ABRASS')}.xlsx`
                
                a.download = filename
                a.click()
                URL.revokeObjectURL(url)
            } else {
                const res = await authFetch(`${API_URL}/api/abrass/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ""}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                })
                if (!res.ok) throw new Error("Save failed")
            }

            localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
            setForm(initialState())
            setEnsayoId(null)
            
            toast.success(download ? 'ABRASS guardado y descargado.' : 'ABRASS guardado.')
            onSaved?.()
            onClose?.()
        } catch (err) {
            toast.error('No se pudo generar ABRASS.')
        } finally {
            setLoading(false)
        }
    }, [ensayoId, form, onClose, onSaved])

    const denseInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

    return (
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 md:p-6 min-h-0">
            <div className="mx-auto max-w-[1280px] space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
                            <Beaker className="h-5 w-5 text-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-slate-900 md:text-lg">ABRASS - ASTM C131/C131M-20 (NATIVO)</h1>
                            <p className="text-xs text-slate-600">Réplica del formato Excel oficial</p>
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 shadow-sm transition-colors">
                            Cerrar
                        </button>
                    )}
                </div>

                {loadingEdit ? (
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando ensayo...
                    </div>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                    <div className="border-b border-slate-300 bg-slate-50 px-4 py-4 text-center">
                        <p className="text-[28px] font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                        <p className="text-xl font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-AG-36.01</p>
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
                                                    className="h-7 w-[92px] rounded-md border-0 bg-transparent px-2 text-xs font-bold uppercase text-slate-700 focus:outline-none focus:ring-0 focus:border-0"
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
                                        <input
                                            className={`${denseInputClass} text-center`}
                                            value={form.numero_ot}
                                            onChange={(e) => setField('numero_ot', e.target.value)}
                                            onBlur={() => setField('numero_ot', normalizeNumeroOtCode(form.numero_ot))}
                                            autoComplete="off"
                                            data-lpignore="true"
                                        />
                                    </td>
                                    <td className="border-r border-t border-slate-300 p-1">
                                        <input
                                            className={`${denseInputClass} text-center`}
                                            value={form.fecha_ensayo}
                                            onChange={(e) => setField('fecha_ensayo', e.target.value)}
                                            onBlur={() => setField('fecha_ensayo', normalizeFlexibleDate(form.fecha_ensayo))}
                                            autoComplete="off"
                                            data-lpignore="true"
                                            placeholder="AAAA/MM/DD"
                                        />
                                    </td>
                                    <td className="border-t border-slate-300 p-1">
                                        <input
                                            className={`${denseInputClass} text-center`}
                                            value={form.realizado_por}
                                            onChange={(e) => setField('realizado_por', e.target.value)}
                                            autoComplete="off"
                                            data-lpignore="true"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center">
                        <p className="text-[27px] font-semibold leading-tight text-slate-900">
                            STANDARD TEST METHOD FOR RESISTANCE TO DEGRADATION OF SMALL-SIZE COARSE AGGREGATE
                        </p>
                        <p className="text-[27px] font-semibold leading-tight text-slate-900">
                            AGGREGATE BY ABRASION AND IMPACT IN THE LOS ANGELES MACHINE
                        </p>
                        <p className="text-[27px] font-semibold text-slate-900">ASTM C131/C131M-20</p>
                    </div>

                    <div className="space-y-3 p-3">
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_420px]">
                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                        <tr>
                                            <th className="border-b border-r border-slate-300 px-2 py-1 text-left">MUESTRA DE PRUEBA ANTES DEL FRACCIONAMIENTO</th>
                                            <th className="w-12 border-b border-r border-slate-300 py-1">UND</th>
                                            <th className="w-52 border-b border-slate-300 py-1">DATO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-1">Masa muestra inicial</td>
                                            <td className="border-b border-r border-slate-300 text-center">g</td>
                                            <td className="border-b border-slate-300 p-1">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={`${denseInputClass} text-center`}
                                                    value={form.masa_muestra_inicial_g ?? ''}
                                                    onChange={(e) => setField('masa_muestra_inicial_g', parseNum(e.target.value))}
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-1">Masa muestra inicial seca despues del lavado</td>
                                            <td className="border-b border-r border-slate-300 text-center">g</td>
                                            <td className="border-b border-slate-300 p-1">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={`${denseInputClass} text-center`}
                                                    value={form.masa_muestra_inicial_seca_despues_lavado_g ?? ''}
                                                    onChange={(e) => setField('masa_muestra_inicial_seca_despues_lavado_g', parseNum(e.target.value))}
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-r border-slate-300 px-2 py-1">Masa muestra inicial seca constante despues del lavado</td>
                                            <td className="border-r border-slate-300 text-center">g</td>
                                            <td className="p-1">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={`${denseInputClass} text-center`}
                                                    value={form.masa_muestra_inicial_seca_constante_despues_lavado_g ?? ''}
                                                    onChange={(e) => setField('masa_muestra_inicial_seca_constante_despues_lavado_g', parseNum(e.target.value))}
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                        <tr>
                                            <th className="border-b border-r border-slate-300 px-2 py-1 text-left">
                                                Se requiere lavado despues de la prueba (colocado en maquina angeles)
                                            </th>
                                            <th className="w-[70px] border-b border-r border-slate-300 px-1 py-1 text-center">SI</th>
                                            <th className="w-[70px] border-b border-slate-300 px-1 py-1 text-center">NO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-1">Selección</td>
                                            <td className="border-b border-slate-300 px-1 py-1 text-center" colSpan={2}>
                                                <select
                                                    className={denseInputClass}
                                                    value={form.requiere_lavado ?? '-'}
                                                    onChange={(e) => setField('requiere_lavado', e.target.value as any)}
                                                >
                                                    <option value="-">-</option>
                                                    <option value="SI">SI</option>
                                                    <option value="NO">NO</option>
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-r border-slate-300 px-2 py-1">N° revoluciones</td>
                                            <td className="border-b border-slate-300 p-1" colSpan={2}>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={`${denseInputClass} cursor-not-allowed bg-slate-100 text-center font-bold`}
                                                    value={500}
                                                    readOnly
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-300">
                            <table className="w-full table-fixed text-sm">
                                <colgroup>
                                    <col className="w-24" />
                                    <col className="w-24" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                </colgroup>
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                    <tr>
                                        <th className="border-b border-r border-slate-300 py-1" colSpan={2}>TAMIZ (in)</th>
                                        <th className="border-b border-slate-300 py-1" colSpan={4}>GRADACIONES (Masa en cada tamiz, g)</th>
                                    </tr>
                                    <tr>
                                        <th className="w-24 border-r border-slate-300 px-2 py-1">Pasante</th>
                                        <th className="w-24 border-r border-slate-300 px-2 py-1">Retenido</th>
                                        <th className="w-32 border-r border-slate-300 px-2 py-1">Gradación A</th>
                                        <th className="w-32 border-r border-slate-300 px-2 py-1">Gradación B</th>
                                        <th className="w-32 border-r border-slate-300 px-2 py-1">Gradación C</th>
                                        <th className="w-32 px-2 py-1">Gradación D</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {TAMIZ_ROWS.map((row, i) => (
                                        <tr key={`${row.pasante}-${row.retenido}`}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{row.pasante}</td>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{row.retenido}</td>
                                            <td className={`border-t border-r border-slate-300 p-1 ${isGradacionEditable('gradacion_a_tamiz_g', i) ? 'bg-slate-200/80' : 'bg-slate-50'}`}>
                                                <input
                                                    type={isGradacionEditable('gradacion_a_tamiz_g', i) ? 'number' : 'text'}
                                                    step="any"
                                                    className={`${denseInputClass} ${isGradacionEditable('gradacion_a_tamiz_g', i) ? 'border-slate-400 bg-slate-200 font-medium' : 'cursor-not-allowed bg-slate-100 text-center text-slate-500'}`}
                                                    value={isGradacionEditable('gradacion_a_tamiz_g', i) ? (form.gradacion_a_tamiz_g[i] ?? '') : '-'}
                                                    onChange={(e) => setArray('gradacion_a_tamiz_g', i, e.target.value)}
                                                    readOnly={!isGradacionEditable('gradacion_a_tamiz_g', i)}
                                                    tabIndex={isGradacionEditable('gradacion_a_tamiz_g', i) ? 0 : -1}
                                                />
                                            </td>
                                            <td className={`border-t border-r border-slate-300 p-1 ${isGradacionEditable('gradacion_b_tamiz_g', i) ? 'bg-slate-200/80' : 'bg-slate-50'}`}>
                                                <input
                                                    type={isGradacionEditable('gradacion_b_tamiz_g', i) ? 'number' : 'text'}
                                                    step="any"
                                                    className={`${denseInputClass} ${isGradacionEditable('gradacion_b_tamiz_g', i) ? 'border-slate-400 bg-slate-200 font-medium' : 'cursor-not-allowed bg-slate-100 text-center text-slate-500'}`}
                                                    value={isGradacionEditable('gradacion_b_tamiz_g', i) ? (form.gradacion_b_tamiz_g[i] ?? '') : '-'}
                                                    onChange={(e) => setArray('gradacion_b_tamiz_g', i, e.target.value)}
                                                    readOnly={!isGradacionEditable('gradacion_b_tamiz_g', i)}
                                                    tabIndex={isGradacionEditable('gradacion_b_tamiz_g', i) ? 0 : -1}
                                                />
                                            </td>
                                            <td className={`border-t border-r border-slate-300 p-1 ${isGradacionEditable('gradacion_c_tamiz_g', i) ? 'bg-slate-200/80' : 'bg-slate-50'}`}>
                                                <input
                                                    type={isGradacionEditable('gradacion_c_tamiz_g', i) ? 'number' : 'text'}
                                                    step="any"
                                                    className={`${denseInputClass} ${isGradacionEditable('gradacion_c_tamiz_g', i) ? 'border-slate-400 bg-slate-200 font-medium' : 'cursor-not-allowed bg-slate-100 text-center text-slate-500'}`}
                                                    value={isGradacionEditable('gradacion_c_tamiz_g', i) ? (form.gradacion_c_tamiz_g[i] ?? '') : '-'}
                                                    onChange={(e) => setArray('gradacion_c_tamiz_g', i, e.target.value)}
                                                    readOnly={!isGradacionEditable('gradacion_c_tamiz_g', i)}
                                                    tabIndex={isGradacionEditable('gradacion_c_tamiz_g', i) ? 0 : -1}
                                                />
                                            </td>
                                            <td className={`border-t border-slate-300 p-1 ${isGradacionEditable('gradacion_d_tamiz_g', i) ? 'bg-slate-200/80' : 'bg-slate-50'}`}>
                                                <input
                                                    type={isGradacionEditable('gradacion_d_tamiz_g', i) ? 'number' : 'text'}
                                                    step="any"
                                                    className={`${denseInputClass} ${isGradacionEditable('gradacion_d_tamiz_g', i) ? 'border-slate-400 bg-slate-200 font-medium' : 'cursor-not-allowed bg-slate-100 text-center text-slate-500'}`}
                                                    value={isGradacionEditable('gradacion_d_tamiz_g', i) ? (form.gradacion_d_tamiz_g[i] ?? '') : '-'}
                                                    onChange={(e) => setArray('gradacion_d_tamiz_g', i, e.target.value)}
                                                    readOnly={!isGradacionEditable('gradacion_d_tamiz_g', i)}
                                                    tabIndex={isGradacionEditable('gradacion_d_tamiz_g', i) ? 0 : -1}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-slate-50 font-semibold text-slate-900">
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center" colSpan={2}>TOTAL</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{formatComputedNumber(gradacionTotals.a)}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{formatComputedNumber(gradacionTotals.b)}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{formatComputedNumber(gradacionTotals.c)}</td>
                                        <td className="border-t border-slate-300 px-2 py-1 text-center">{formatComputedNumber(gradacionTotals.d)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-300">
                            <table className="w-full table-fixed text-sm">
                                <colgroup>
                                    <col className="w-12" />
                                    <col className="w-24" />
                                    <col className="w-12" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                    <col className="w-32" />
                                </colgroup>
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                    <tr>
                                        <th className="w-12 border-b border-r border-slate-300 py-1">ITEM</th>
                                        <th className="w-24 border-b border-r border-slate-300 py-1">DESCRIPCIÓN</th>
                                        <th className="w-12 border-b border-r border-slate-300 py-1">UND</th>
                                        <th className="w-32 border-b border-r border-slate-300 py-1">Gradación A</th>
                                        <th className="w-32 border-b border-r border-slate-300 py-1">Gradación B</th>
                                        <th className="w-32 border-b border-r border-slate-300 py-1">Gradación C</th>
                                        <th className="w-32 border-b border-slate-300 py-1">Gradación D</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center">1</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1">Numero de esferas</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center">-</td>
                                        {ESFERAS_CANTIDAD.map((value, idx) => (
                                            <td key={`esferas-cant-${idx}`} className={`border-t ${idx < 3 ? 'border-r' : ''} border-slate-300 px-2 py-1 text-center`}>
                                                {value}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center">2</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1">Masa requerida de las esferas</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center">g</td>
                                        {ESFERAS_RANGO.map((value, idx) => (
                                            <td key={`esferas-rango-${idx}`} className={`border-t ${idx < 3 ? 'border-r' : ''} border-slate-300 px-2 py-1 text-center`}>
                                                {value}
                                            </td>
                                        ))}
                                    </tr>
                                    {ITEM_ROWS.map((row) => (
                                        <tr key={`${row.item}-${row.key}`}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{row.item}</td>
                                            <td className="border-t border-r border-slate-300 px-2 py-1">{row.descripcion}</td>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center">{row.unidad}</td>
                                            {[0, 1, 2, 3].map((idx) => (
                                                <td key={`${row.key}-${idx}`} className={`border-t ${idx < 3 ? 'border-r' : ''} border-slate-300 p-1`}>
                                                    {row.key === 'item_a_masa_original_g' || row.key === 'item_e_perdida_abrasion_pct' || row.key === 'item_f_perdida_lavado_pct' ? (
                                                        <input
                                                            type="text"
                                                            className={`${denseInputClass} cursor-not-allowed bg-slate-100 text-center font-medium text-slate-700`}
                                                            value={form[row.key][idx] != null ? formatComputedNumber(form[row.key][idx] as number) : (row.key === 'item_a_masa_original_g' ? formatComputedNumber(itemAMasaOriginalComputed[idx]) : '-')}
                                                            readOnly
                                                            tabIndex={-1}
                                                        />
                                                    ) : (
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className={`${denseInputClass} text-center`}
                                                            value={form[row.key][idx] ?? ''}
                                                            onChange={(e) => setQuad(row.key, idx, e.target.value)}
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="border-t border-slate-300 px-3 py-2 text-xs text-slate-700">
                                (*) la perdida por lavado no superara en mas del 0.2% de la muestra original
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                            <div className="border-b border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800">
                                Referencia visual (Abrasion menores)
                            </div>
                            <div className="p-3">
                                <img
                                    src="/ImagenAbrasionesMenores.png"
                                    alt="Referencia de abrasiones menores - tabla de gradación"
                                    className="w-full max-h-[420px] rounded-md border border-slate-200 object-contain bg-white"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <p className="mt-2 text-[11px] text-slate-600">
                                    Tabla guía para gradaciones y masa de muestra (formato Excel oficial).
                                </p>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-300">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                    <tr>
                                        <th className="border-b border-r border-slate-300 py-1">Equipo</th>
                                        <th className="w-44 border-b border-r border-slate-300 py-1">Código</th>
                                        <th className="border-b border-r border-slate-300 py-1">Equipo</th>
                                        <th className="w-44 border-b border-slate-300 py-1">Código</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1">Horno</td>
                                        <td className="border-t border-r border-slate-300 p-1">
                                            <select className={denseInputClass} value={form.horno_codigo ?? '-'} onChange={(e) => setField('horno_codigo', e.target.value)}>
                                                {withCurrentOption(form.horno_codigo, EQUIPO_OPTIONS.horno_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1">Malla No. 12</td>
                                        <td className="border-t border-slate-300 p-1">
                                            <select className={denseInputClass} value={form.malla_no_12_codigo ?? '-'} onChange={(e) => setField('malla_no_12_codigo', e.target.value)}>
                                                {withCurrentOption(form.malla_no_12_codigo, EQUIPO_OPTIONS.malla_no_12_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1">Máquina Los Ángeles</td>
                                        <td className="border-t border-r border-slate-300 p-1">
                                            <select className={denseInputClass} value={form.maquina_los_angeles_codigo ?? '-'} onChange={(e) => setField('maquina_los_angeles_codigo', e.target.value)}>
                                                {withCurrentOption(form.maquina_los_angeles_codigo, EQUIPO_OPTIONS.maquina_los_angeles_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1">Malla No. 4</td>
                                        <td className="border-t border-slate-300 p-1">
                                            <select className={denseInputClass} value={form.malla_no_4_codigo ?? '-'} onChange={(e) => setField('malla_no_4_codigo', e.target.value)}>
                                                {withCurrentOption(form.malla_no_4_codigo, EQUIPO_OPTIONS.malla_no_4_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1">Balanza 1g</td>
                                        <td className="border-t border-r border-slate-300 p-1">
                                            <select className={denseInputClass} value={form.balanza_1g_codigo ?? '-'} onChange={(e) => setField('balanza_1g_codigo', e.target.value)}>
                                                {withCurrentOption(form.balanza_1g_codigo, EQUIPO_OPTIONS.balanza_1g_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1"></td>
                                        <td className="border-t border-slate-300 p-1"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_280px_280px]">
                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">Nota:</div>
                                <div className="p-2">
                                    <textarea
                                        className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35"
                                        rows={4}
                                        value={form.observaciones ?? ''}
                                        onChange={(e) => setField('observaciones', e.target.value)}
                                        autoComplete="off"
                                        data-lpignore="true"
                                    />
                                    <p className="mt-2 text-xs font-semibold text-slate-700">Pérdida abrasión promedio (%): {perdidaAbrasionPromedio ?? '-'}</p>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Revisado:</div>
                                <div className="space-y-2 p-2">
                                    <select className={denseInputClass} value={form.revisado_por ?? '-'} onChange={(e) => {
                                        const value = e.target.value
                                        setField('revisado_por', value)
                                        if (value !== '-') {
                                            setField('revisado_fecha', formatTodayYmd())
                                        }
                                    }}>
                                        {REVISORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <input
                                        className={denseInputClass}
                                        value={form.revisado_fecha ?? ''}
                                        onChange={(e) => setField('revisado_fecha', e.target.value)}
                                        onBlur={() => setField('revisado_fecha', normalizeFlexibleDate(form.revisado_fecha ?? ''))}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        placeholder="AAAA/MM/DD"
                                    />
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Aprobado:</div>
                                <div className="space-y-2 p-2">
                                    <select className={denseInputClass} value={form.aprobado_por ?? '-'} onChange={(e) => {
                                        const value = e.target.value
                                        setField('aprobado_por', value)
                                        if (value !== '-') {
                                            setField('aprobado_fecha', formatTodayYmd())
                                        }
                                    }}>
                                        {APROBADORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <input
                                        className={denseInputClass}
                                        value={form.aprobado_fecha ?? ''}
                                        onChange={(e) => setField('aprobado_fecha', e.target.value)}
                                        onBlur={() => setField('aprobado_fecha', normalizeFlexibleDate(form.aprobado_fecha ?? ''))}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        placeholder="AAAA/MM/DD"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t-2 border-blue-900 px-3 py-2 text-center text-[11px] leading-tight text-slate-700">
                            <p>WEB: www.geofal.com.pe  E-MAIL: laboratorio@geofal.com.pe / geofal.sac@gmail.com</p>
                            <p>Av. Marañón 763, Los Olivos-Lima | Teléfono 01522-1851</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
                        {loading ? 'Guardando...' : 'Guardar'}
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

            <FormatConfirmModal
                open={pendingFormatAction !== null}
                formatLabel={buildFormatPreview(form.muestra, muestraType, 'ABRASS')}
                actionLabel={pendingFormatAction ? 'Guardar y Descargar' : 'Guardar'}
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
