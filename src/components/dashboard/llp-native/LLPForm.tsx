import { useCallback, useEffect, useMemo, useState } from 'react'
import { Beaker, ChevronDown, Download, Loader2, Trash2, X } from 'lucide-react'
import FormatConfirmModal from '../shared/FormatConfirmModal'
import { authFetch } from '@/lib/api-auth'
import { toast } from 'sonner'

export interface LLPPuntoRow {
    recipiente_numero?: string | null
    numero_golpes?: number | null
    masa_recipiente_suelo_humedo?: number | null
    masa_recipiente_suelo_seco?: number | null
    masa_recipiente_suelo_seco_1?: number | null
    masa_recipiente?: number | null
}

export interface LLPPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    metodo_ensayo_limite_liquido: "-" | "MULTIPUNTO" | "UNIPUNTO"
    herramienta_ranurado_limite_liquido: "-" | "METAL" | "PLASTICO"
    dispositivo_limite_liquido: "-" | "MANUAL" | "MECANICO"
    metodo_laminacion_limite_plastico: "-" | "MANUAL" | "DISPOSITIVO DE LAMINACION"
    contenido_humedad_muestra_inicial_pct?: number | null
    proceso_seleccion_muestra?: string | null
    metodo_preparacion_muestra: "-" | "HUMEDO" | "SECADO AL AIRE" | "SECADO AL HORNO"
    metodo_eliminacion_particulas_tamiz_40:
        | "-"
        | "LAVADO POR EL TAMIZ NO. 40"
        | "TAMIZADO EN SECO POR EL TAMIZ NO. 40"
        | "MECANICAMENTE EMPUJADO A TRAVES DEL TAMIZ NO. 40"
        | "MEZCLADO EN PLACA DE VIDRIO Y ELIMINACION DE PARTICULAS DE ARENA MEDIANAS"

    tipo_muestra?: string | null
    condicion_muestra: "-" | "ALTERADO" | "INTACTO"
    tamano_maximo_visual_in?: string | null
    porcentaje_retenido_tamiz_40_pct?: number | null
    forma_particula?: string | null

    puntos: LLPPuntoRow[]

    balanza_001g_codigo?: string | null
    horno_110_codigo?: string | null
    copa_casagrande_codigo?: string | null
    ranurador_codigo?: string | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

export interface LLPEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    limite_liquido_promedio?: number | null
    limite_plastico_promedio?: number | null
    indice_plasticidad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface LLPEnsayoDetail extends LLPEnsayoSummary {
    payload?: LLPPayload | null
}

export interface LLPSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    limite_liquido_promedio?: number | null
    limite_plastico_promedio?: number | null
    indice_plasticidad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

async function getLLPEnsayoDetail(ensayoId: number): Promise<LLPEnsayoDetail> {
    const res = await authFetch(`${API_URL}/api/llp/${ensayoId}?_ts=${Date.now()}`)
    if (!res.ok) {
        throw new Error("No se pudo cargar el ensayo de LLP.")
    }
    return res.json()
}

async function saveLLPEnsayo(payload: LLPPayload, ensayoId?: number): Promise<LLPSaveResponse> {
    const url = `${API_URL}/api/llp/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
    const res = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    if (!res.ok) {
        const errorText = await res.text()
        let errorData
        try {
            errorData = JSON.parse(errorText)
        } catch {
            errorData = { detail: errorText }
        }
        throw new Error(errorData.detail || "Error al guardar el ensayo LLP.")
    }
    return res.json()
}

async function saveAndDownloadLLPExcel(payload: LLPPayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/llp/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
    const res = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    if (!res.ok) {
        const errorText = await res.text()
        let errorData
        try {
            errorData = JSON.parse(errorText)
        } catch {
            errorData = { detail: errorText }
        }
        throw new Error(errorData.detail || "Error al descargar el excel de LLP.")
    }
    const blob = await res.blob()
    const contentDisposition = res.headers.get("content-disposition")
    const match = contentDisposition ? contentDisposition.match(/filename="?([^";]+)"?/i) : null
    const filename = match?.[1]
    return { blob, filename }
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

const POINT_HEADERS = ['1', '2', '3', '1', '2']
const DRAFT_KEY = 'llp_form_draft_v1'
const DEBOUNCE_MS = 700

const METODO_LIQUIDO = ['-', 'MULTIPUNTO', 'UNIPUNTO'] as const
const HERRAMIENTA = ['-', 'METAL', 'PLASTICO'] as const
const DISPOSITIVO = ['-', 'MANUAL', 'MECANICO'] as const
const LAMINACION = ['-', 'MANUAL', 'DISPOSITIVO DE LAMINACION'] as const
const PREPARACION = ['-', 'HUMEDO', 'SECADO AL AIRE', 'SECADO AL HORNO'] as const
const ELIMINACION_PARTICULAS_OPTIONS = [
    { value: 'LAVADO POR EL TAMIZ NO. 40', label: 'Lavado por el tamiz No. 40' },
    { value: 'MECANICAMENTE EMPUJADO A TRAVES DEL TAMIZ NO. 40', label: 'Mecánicamente empujado a través del tamiz No. 40' },
    { value: 'TAMIZADO EN SECO POR EL TAMIZ NO. 40', label: 'Tamizado en seco por el tamiz No. 40' },
    { value: 'MEZCLADO EN PLACA DE VIDRIO Y ELIMINACION DE PARTICULAS DE ARENA MEDIANAS', label: 'Mezclado en placa de vidrio y eliminación de partículas de arena medianas' },
] as const
const CONDICION = ['-', 'ALTERADO', 'INTACTO'] as const
const EQ_BALANZA = ['-', 'EQP-0045'] as const
const EQ_HORNO = ['-', 'EQP-0150', 'EQP-0049'] as const
const EQ_COPA = ['-', 'EQP-0048'] as const
const EQ_RANURADOR = ['-', 'INS-0107'] as const
const REVISADO = ['-', 'FABIAN LA ROSA'] as const
const APROBADO = ['-', 'IRMA COAQUIRA'] as const

const formatTodayShortDate = () => {
    const [yyyy = '', mm = '', dd = ''] = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }).split('-')
    return `${yyyy}/${mm}/${dd}`
}
const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

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

const STICKY_DESC_WIDTH_CLASS = 'w-[320px] min-w-[320px] max-w-[320px]'
const STICKY_UNIT_WIDTH_CLASS = 'w-[72px] min-w-[72px] max-w-[72px]'
const STICKY_DESC_TH_CLASS = "sticky left-0 z-50 bg-muted relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.35)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"
const STICKY_DESC_TD_CLASS = "sticky left-0 z-30 bg-card relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.25)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"
const STICKY_UNIT_TH_CLASS = "sticky left-[320px] z-40 bg-muted relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.30)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"
const STICKY_UNIT_TD_CLASS = "sticky left-[320px] z-20 bg-card relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"

const emptyPoint = (): LLPPuntoRow => ({
    recipiente_numero: '',
    numero_golpes: null,
    masa_recipiente_suelo_humedo: null,
    masa_recipiente_suelo_seco: null,
    masa_recipiente_suelo_seco_1: null,
    masa_recipiente: null,
})

const initialState = (): LLPPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    metodo_ensayo_limite_liquido: '-',
    herramienta_ranurado_limite_liquido: '-',
    dispositivo_limite_liquido: '-',
    metodo_laminacion_limite_plastico: '-',
    contenido_humedad_muestra_inicial_pct: null,
    proceso_seleccion_muestra: '',
    metodo_preparacion_muestra: '-',
    metodo_eliminacion_particulas_tamiz_40: '-',
    tipo_muestra: '',
    condicion_muestra: '-',
    tamano_maximo_visual_in: '',
    porcentaje_retenido_tamiz_40_pct: null,
    forma_particula: '',
    puntos: Array.from({ length: 5 }, () => emptyPoint()),
    balanza_001g_codigo: '-',
    horno_110_codigo: '-',
    copa_casagrande_codigo: '-',
    ranurador_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: formatTodayShortDate(),
    aprobado_por: '-',
    aprobado_fecha: formatTodayShortDate(),
})

const parseNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const normalizeNumeroOtCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''
    const compact = value.replace(/\s+/g, '')
    const match = compact.match(/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/) ?? compact.match(/^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/)
    if (!match) return value
    return `${match[1]}-${getCurrentYearShort()}`
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

const isMuestraValid = (raw: string): boolean => {
    const value = raw.trim().toUpperCase()
    const regex = /^[A-Z0-9.\- ]+-(SU|AG)-\d{2,4}$/
    return regex.test(value)
}

const isNumeroOtValid = (raw: string): boolean => {
    const value = raw.trim()
    const regex = /^[A-Z0-9.\- ]+-\d{2,4}$/
    return regex.test(value)
}

const normalizeRanuradorCodigo = (v: unknown): string => {
    if (typeof v !== 'string') return '-'
    const raw = v.trim().toUpperCase()
    if (!raw || raw === '-') return '-'
    if (raw.includes('0107')) return 'INS-0107'
    return raw
}

const normalizeForm = (raw: Partial<LLPPayload> | null | undefined): LLPPayload => ({
    ...initialState(),
    ...(raw ?? {}),
    ranurador_codigo: normalizeRanuradorCodigo(raw?.ranurador_codigo),
})

const compute = (row: LLPPuntoRow) => {
    const agua = row.masa_recipiente_suelo_humedo != null && row.masa_recipiente_suelo_seco_1 != null
        ? Number((row.masa_recipiente_suelo_humedo - row.masa_recipiente_suelo_seco_1).toFixed(2))
        : null
    const seco = row.masa_recipiente_suelo_seco_1 != null && row.masa_recipiente != null
        ? Number((row.masa_recipiente_suelo_seco_1 - row.masa_recipiente).toFixed(2))
        : null
    const humedad = agua != null && seco != null && seco !== 0 ? Number(((agua / seco) * 100).toFixed(2)) : null
    return { agua, seco, humedad }
}

const avg = (values: Array<number | null | undefined>) => {
    const valid = values.filter((x): x is number => x != null && Number.isFinite(x))
    if (!valid.length) return null
    return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2))
}

interface LLPFormProps {
    editId?: number
    onClose: () => void
    onSaveSuccess: () => void
}

export default function LLPForm({ editId, onClose, onSaveSuccess }: LLPFormProps) {
    const [form, setForm] = useState<LLPPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)
    const currentYear = getCurrentYearShort()
    const [muestraInput, setMuestraInput] = useState('')
    const [muestraType, setMuestraType] = useState<'SU' | 'AG'>('SU')
    const [muestraYear, setMuestraYear] = useState(() => new Date().getFullYear().toString().slice(-2))

    const calc = useMemo(() => form.puntos.map(p => compute(p)), [form.puntos])
    const llCheckRows = useMemo(() => {
        return [0, 1, 2].map((idx) => {
            const nRaw = form.puntos[idx]?.numero_golpes
            const n = nRaw != null && Number.isFinite(Number(nRaw)) ? Number(nRaw) : null
            const lnN = n != null && n > 0 ? Number(Math.log(n).toFixed(6)) : null
            return {
                lnN,
                n,
                humedad: calc[idx]?.humedad ?? null,
            }
        })
    }, [calc, form.puntos])
    const llHumedadPromedioCheck = useMemo(() => avg(llCheckRows.map(row => row.humedad)), [llCheckRows])
    const llR2 = useMemo(() => {
        const pairs = llCheckRows.filter(
            (row): row is { lnN: number; n: number; humedad: number } =>
                row.lnN != null &&
                row.n != null &&
                row.humedad != null,
        )
        if (pairs.length < 3) return null
        const x = pairs.map(row => row.lnN)
        const y = pairs.map(row => row.humedad)
        const xMean = x.reduce((sum, value) => sum + value, 0) / x.length
        const yMean = y.reduce((sum, value) => sum + value, 0) / y.length
        const cov = x.reduce((sum, value, idx) => sum + ((value - xMean) * (y[idx] - yMean)), 0)
        const varX = x.reduce((sum, value) => sum + ((value - xMean) ** 2), 0)
        const varY = y.reduce((sum, value) => sum + ((value - yMean) ** 2), 0)
        if (varX === 0 || varY === 0) return null
        const r = cov / Math.sqrt(varX * varY)
        return Number((r ** 2).toFixed(4))
    }, [llCheckRows])
    const llConformidad = useMemo(() => {
        if (llR2 == null) return 'PENDIENTE'
        return llR2 <= 0.95 ? 'NO CONFORME' : 'CONFORME'
    }, [llR2])
    const lpStdDev1S = useMemo(() => {
        const lp1 = calc[3]?.humedad ?? null
        const lp2 = calc[4]?.humedad ?? null
        if (lp1 == null || lp2 == null) return null
        const mean = (lp1 + lp2) / 2
        const variance = (((lp1 - mean) ** 2) + ((lp2 - mean) ** 2))
        return Number(Math.sqrt(variance).toFixed(4))
    }, [calc])
    const lpD2s = useMemo(() => (lpStdDev1S != null ? Math.floor(lpStdDev1S * 2.8) : null), [lpStdDev1S])
    const lpLimite1S = 0.5
    const lpLimiteD2s = 1
    const lpControl = useMemo(() => {
        if (lpD2s == null) return 'PENDIENTE'
        return lpD2s < lpLimiteD2s ? 'CUMPLE' : 'NO CUMPLE'
    }, [lpD2s])

    const setField = useCallback(<K extends keyof LLPPayload>(key: K, value: LLPPayload[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }, [])

    const setPoint = useCallback((idx: number, key: keyof LLPPuntoRow, raw: string) => {
        setForm(prev => {
            const next = [...prev.puntos]
            const row = { ...next[idx] }
            if (key === 'recipiente_numero') row[key] = raw
            if (key === 'numero_golpes') row[key] = raw === '' ? null : Math.round(Number(raw))
            if (key !== 'recipiente_numero' && key !== 'numero_golpes') row[key] = parseNum(raw)
            next[idx] = row
            return { ...prev, puntos: next }
        })
    }, [])

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
        const raw = localStorage.getItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        if (!raw) return
        try { setForm(normalizeForm(JSON.parse(raw))) } catch { /* ignore */ }
    }, [editingEnsayoId])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            localStorage.setItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`, JSON.stringify(form))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(timer)
    }, [editingEnsayoId, form])

    useEffect(() => {
        if (!editingEnsayoId) return
        let cancelled = false
        const run = async () => {
            setLoadingEdit(true)
            try {
                const detail = await getLLPEnsayoDetail(editingEnsayoId)
                if (!cancelled && detail.payload) setForm(normalizeForm(detail.payload))
            } catch { toast.error('No se pudo cargar ensayo LLP para edición.') } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }
        void run()
        return () => { cancelled = true }
    }, [editingEnsayoId])

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiarán los datos no guardados. ¿Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)

    const save = useCallback(async (download: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) {
            toast.error('Complete Muestra, N OT y Realizado por.')
            return
        }
        if (!isMuestraValid(form.muestra)) {
            toast.error(`La muestra debe tener un formato válido (ej: 1234-SU-26 o 1234-AG-26).`)
            return
        }
        if (!isNumeroOtValid(form.numero_ot)) {
            toast.error(`El N OT debe tener un formato válido (ej: 1234-26).`)
            return
        }
        setLoading(true)
        try {
            const payload: LLPPayload = {
                ...form,
                ranurador_codigo: normalizeRanuradorCodigo(form.ranurador_codigo),
                puntos: form.puntos.map((p, idx) => ({ ...p, numero_golpes: idx < 3 ? parseNum(p.numero_golpes) : null })),
            }
            if (download) {
                const { blob, filename } = await saveAndDownloadLLPExcel(payload, editingEnsayoId ?? undefined)
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = filename || `${buildFormatPreview(form.muestra, muestraType, 'LLP')}.xlsx`
                a.click()
                URL.revokeObjectURL(url)
            } else {
                await saveLLPEnsayo(payload, editingEnsayoId ?? undefined)
            }
            localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
            setForm(initialState())
            setEditingEnsayoId(null)
            onSaveSuccess()
            toast.success(download ? 'LLP guardado y descargado.' : 'LLP guardado.')
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Error desconocido'
            toast.error(`Error guardando LLP: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [editingEnsayoId, form, muestraType, onSaveSuccess])

    const renderText = (label: string, value: string, onChange: (v: string) => void, placeholder?: string, onBlur?: () => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input 
                type="text" 
                value={value} 
                onChange={e => onChange(e.target.value)} 
                onBlur={onBlur} 
                placeholder={placeholder} 
                autoComplete="off" 
                data-lpignore="true" 
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
            />
        </div>
    )

    const renderNum = (label: string, value: number | null | undefined, onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input 
                type="number" 
                step="any" 
                value={value ?? ''} 
                onChange={e => onChange(e.target.value)} 
                autoComplete="off" 
                data-lpignore="true" 
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" 
            />
        </div>
    )

    const renderSelect = (label: string, value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <div className="relative">
                <select 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
        </div>
    )

    return (
        <div data-form-overlay className="max-w-[1780px] w-full mx-auto p-4 md:p-6 bg-slate-100 min-h-screen">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Beaker className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Limite Liquido / Limite Plastico - ASTM D4318-17e1</h1>
                        <p className="text-sm text-muted-foreground">Formulario operativo LLP</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition shadow-sm"
                >
                    <X className="h-4 w-4" />
                    Volver
                </button>
            </div>

            <div>
                <div className="space-y-5">
                    {loadingEdit ? <div className="h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando ensayo...</div> : null}

                    <div className="bg-card border border-border bg-white rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Encabezado</h2>
                        </div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-muted-foreground mb-1">Muestra *</label>
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={muestraInput}
                                        onChange={(e) => handleMuestraInputChange(e.target.value)}
                                        placeholder="1234"
                                        autoComplete="off"
                                        data-lpignore="true"
                                        className="min-w-0 flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                            </div>
                            {renderText('N OT *', form.numero_ot, v => setField('numero_ot', v), `1234-${currentYear}`, () => setField('numero_ot', normalizeNumeroOtCode(form.numero_ot || '')))}
                            {renderText('Fecha ensayo', form.fecha_ensayo, v => setField('fecha_ensayo', v), 'YYYY/MM/DD', () => setField('fecha_ensayo', normalizeFlexibleDate(form.fecha_ensayo || '')))}
                            {renderText('Realizado por *', form.realizado_por, v => setField('realizado_por', v))}
                        </div>
                    </div>

                    <div className="bg-card border border-border bg-white rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Condiciones del ensayo</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[980px] text-sm border border-border">
                                <tbody>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-r border-border">Método de ensayo en el Límite Líquido</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <select
                                                value={form.metodo_ensayo_limite_liquido}
                                                onChange={e => setField('metodo_ensayo_limite_liquido', e.target.value as LLPPayload['metodo_ensayo_limite_liquido'])}
                                                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                {METODO_LIQUIDO.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-r border-border">Herramienta de ranurado para el límite líquido</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <select
                                                value={form.herramienta_ranurado_limite_liquido}
                                                onChange={e => setField('herramienta_ranurado_limite_liquido', e.target.value as LLPPayload['herramienta_ranurado_limite_liquido'])}
                                                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                {HERRAMIENTA.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-r border-border">Dispositivo para el límite líquido</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <select
                                                value={form.dispositivo_limite_liquido}
                                                onChange={e => setField('dispositivo_limite_liquido', e.target.value as LLPPayload['dispositivo_limite_liquido'])}
                                                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                {DISPOSITIVO.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-r border-border">Método de laminación para el Límite Plástico</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <select
                                                value={form.metodo_laminacion_limite_plastico}
                                                onChange={e => setField('metodo_laminacion_limite_plastico', e.target.value as LLPPayload['metodo_laminacion_limite_plastico'])}
                                                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                {LAMINACION.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-r border-border">Contenido de humedad de muestra inicial (%)</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <input
                                                type="number"
                                                step="any"
                                                value={form.contenido_humedad_muestra_inicial_pct ?? ''}
                                                onChange={e => setField('contenido_humedad_muestra_inicial_pct', parseNum(e.target.value))}
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-r border-border">Proceso de selección en caso de muestras Intacta, se retiró lentes de arena</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <input
                                                type="text"
                                                value={form.proceso_seleccion_muestra || ''}
                                                onChange={e => setField('proceso_seleccion_muestra', e.target.value)}
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-r border-border">Método de preparación de la muestra de ensayo</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <select
                                                value={form.metodo_preparacion_muestra}
                                                onChange={e => setField('metodo_preparacion_muestra', e.target.value as LLPPayload['metodo_preparacion_muestra'])}
                                                className="w-full h-9 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                {PREPARACION.map(option => <option key={option} value={option}>{option}</option>)}
                                            </select>
                                            <p className="mt-1 text-[11px] text-muted-foreground">Opciones válidas: HUMEDO, SECADO AL AIRE, SECADO AL HORNO.</p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 border-b border-border text-center font-medium" colSpan={2}>Método de eliminación de partículas más grandes que el tamiz No. 40</td>
                                    </tr>
                                    <tr>
                                        <td className="p-0 border-b border-r border-border">
                                            <div className="grid grid-cols-[34px_minmax(0,1fr)]">
                                                <button
                                                    type="button"
                                                    className="h-12 border-r border-border text-center font-semibold hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[0].value)}
                                                >
                                                    {form.metodo_eliminacion_particulas_tamiz_40 === ELIMINACION_PARTICULAS_OPTIONS[0].value ? 'X' : ''}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="h-12 px-2 text-left hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[0].value)}
                                                >
                                                    {ELIMINACION_PARTICULAS_OPTIONS[0].label}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-0 border-b border-border">
                                            <div className="grid grid-cols-[34px_minmax(0,1fr)]">
                                                <button
                                                    type="button"
                                                    className="h-12 border-r border-border text-center font-semibold hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[1].value)}
                                                >
                                                    {form.metodo_eliminacion_particulas_tamiz_40 === ELIMINACION_PARTICULAS_OPTIONS[1].value ? 'X' : ''}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="h-12 px-2 text-left hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[1].value)}
                                                >
                                                    {ELIMINACION_PARTICULAS_OPTIONS[1].label}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="p-0 border-r border-border">
                                            <div className="grid grid-cols-[34px_minmax(0,1fr)]">
                                                <button
                                                    type="button"
                                                    className="h-12 border-r border-border text-center font-semibold hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[2].value)}
                                                >
                                                    {form.metodo_eliminacion_particulas_tamiz_40 === ELIMINACION_PARTICULAS_OPTIONS[2].value ? 'X' : ''}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="h-12 px-2 text-left hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[2].value)}
                                                >
                                                    {ELIMINACION_PARTICULAS_OPTIONS[2].label}
                                                </button>
                                            </div>
                                        </td>
                                        <td className="p-0">
                                            <div className="grid grid-cols-[34px_minmax(0,1fr)]">
                                                <button
                                                    type="button"
                                                    className="h-12 border-r border-border text-center font-semibold hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[3].value)}
                                                >
                                                    {form.metodo_eliminacion_particulas_tamiz_40 === ELIMINACION_PARTICULAS_OPTIONS[3].value ? 'X' : ''}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="h-12 px-2 text-left hover:bg-muted/30"
                                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', ELIMINACION_PARTICULAS_OPTIONS[3].value)}
                                                >
                                                    {ELIMINACION_PARTICULAS_OPTIONS[3].label}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="mt-2 text-right">
                                <button
                                    type="button"
                                    className="h-8 px-3 rounded-md border border-input bg-background text-xs hover:bg-muted/60"
                                    onClick={() => setField('metodo_eliminacion_particulas_tamiz_40', '-')}
                                >
                                    Limpiar selección de método de eliminación
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border bg-white rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Descripción de la muestra</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {renderText('Tipo de muestra', form.tipo_muestra || '', v => setField('tipo_muestra', v))}
                                {renderSelect('Condición muestra', form.condicion_muestra, CONDICION, v => setField('condicion_muestra', v as LLPPayload['condicion_muestra']))}
                                {renderText('Tamaño máximo visual (in)', form.tamano_maximo_visual_in || '', v => setField('tamano_maximo_visual_in', v))}
                            </div>
                            <div className="space-y-3">
                                {renderNum('% retenido tamiz No.40', form.porcentaje_retenido_tamiz_40_pct, v => setField('porcentaje_retenido_tamiz_40_pct', parseNum(v)))}
                                {renderText('Forma de partícula', form.forma_particula || '', v => setField('forma_particula', v))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border bg-white rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Tabla principal</h2>
                        </div>
                        <div className="p-4 overflow-x-auto relative isolate">
                            <table className="w-full min-w-[1100px] table-fixed text-sm">
                                <thead className="bg-muted text-xs font-semibold text-muted-foreground">
                                    <tr>
                                        <th className={`${STICKY_DESC_WIDTH_CLASS} px-3 py-2 border-b border-r border-border text-left ${STICKY_DESC_TH_CLASS}`} rowSpan={2}>DESCRIPCIÓN</th>
                                        <th className={`${STICKY_UNIT_WIDTH_CLASS} px-2 py-2 border-b border-r border-border text-center ${STICKY_UNIT_TH_CLASS}`} rowSpan={2}>UND</th>
                                        <th className="px-2 py-2 border-b border-r border-border text-center" colSpan={3}>LIMITE LIQUIDO</th>
                                        <th className="px-2 py-2 border-b text-center" colSpan={2}>LIMITE PLASTICO</th>
                                    </tr>
                                    <tr>
                                        {POINT_HEADERS.map((h, i) => (
                                            <th key={i} className="w-36 px-2 py-2 border-b border-r border-border text-center last:border-r-0">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className={`px-3 py-2 border-b border-r border-border ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>Recipiente N°</td>
                                        <td className={`px-2 py-2 border-b border-r border-border text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}></td>
                                        {form.puntos.map((p, i) => (
                                            <td key={`r-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                                                <input type="text" value={p.recipiente_numero || ''} onChange={e => setPoint(i, 'recipiente_numero', e.target.value)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center" />
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className={`px-3 py-2 border-b border-r border-border ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>N° de golpes</td>
                                        <td className={`px-2 py-2 border-b border-r border-border text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}></td>
                                        {form.puntos.map((p, i) => (
                                            <td key={`g-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                                                {i < 3 ? <input type="number" value={p.numero_golpes ?? ''} onChange={e => setPoint(i, 'numero_golpes', e.target.value)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center" /> : <div className="h-8 rounded-md border border-input bg-muted/30 flex items-center justify-center">---</div>}
                                            </td>
                                        ))}
                                    </tr>
                                    {[
                                        ['Masa recipiente y suelo húmedo', 'masa_recipiente_suelo_humedo'],
                                        ['Masa recipiente y suelo seco', 'masa_recipiente_suelo_seco'],
                                        ['Masa recipiente y suelo seco 1', 'masa_recipiente_suelo_seco_1'],
                                        ['Masa del recipiente', 'masa_recipiente'],
                                    ].map(([label, key]) => (
                                        <tr key={key}>
                                            <td className={`px-3 py-2 border-b border-r border-border ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>{label}</td>
                                            <td className={`px-2 py-2 border-b border-r border-border text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>g</td>
                                            {form.puntos.map((p, i) => (
                                                <td key={`${key}-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                                                    <input type="number" step="any" value={(p as any)[key] ?? ''} onChange={e => setPoint(i, key as keyof LLPPuntoRow, e.target.value)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm text-center" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr>
                                        <td className={`px-3 py-2 border-b border-r border-border ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>Masa del agua (C-E)</td>
                                        <td className={`px-2 py-2 border-b border-r border-border text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>g</td>
                                        {calc.map((c, i) => (
                                            <td key={`a-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                                                <div className="h-8 rounded-md border border-input bg-muted/30 flex items-center justify-center">{c.agua ?? '-'}</div>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className={`px-3 py-2 border-b border-r border-border ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>Masa del suelo seco (E-F)</td>
                                        <td className={`px-2 py-2 border-b border-r border-border text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>g</td>
                                        {calc.map((c, i) => (
                                            <td key={`s-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                                                <div className="h-8 rounded-md border border-input bg-muted/30 flex items-center justify-center">{c.seco ?? '-'}</div>
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className={`px-3 py-2 border-b border-r border-border ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>% Humedad (G/H*100)</td>
                                        <td className={`px-2 py-2 border-b border-r border-border text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>%</td>
                                        {calc.map((c, i) => (
                                            <td key={`h-${i}`} className="px-2 py-2 border-b border-r border-border last:border-r-0">
                                                <div className="h-8 rounded-md border border-primary bg-primary/5 text-primary font-semibold flex items-center justify-center">{c.humedad ?? '-'}</div>
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-card border border-border bg-white rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Control de cumplimiento (fuera del formato)</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                <div className="rounded-md border border-border overflow-hidden">
                                    <div className="px-3 py-2 text-xs font-semibold bg-muted/40 text-foreground">LIMITE LIQUIDO</div>
                                    <table className="w-full text-sm bg-white">
                                        <thead className="bg-muted/20 text-xs text-muted-foreground">
                                            <tr>
                                                <th className="px-2 py-2 border-b border-r border-border text-center">LN(N)</th>
                                                <th className="px-2 py-2 border-b border-r border-border text-center">N</th>
                                                <th className="px-2 py-2 border-b border-border text-center">Humedad</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {llCheckRows.map((row, idx) => (
                                                <tr key={`ll-check-${idx}`}>
                                                    <td className="px-2 py-2 border-b border-r border-border text-center">{row.lnN != null ? row.lnN.toFixed(4) : '-'}</td>
                                                    <td className="px-2 py-2 border-b border-r border-border text-center">{row.n ?? '-'}</td>
                                                    <td className="px-2 py-2 border-b border-border text-center">{row.humedad != null ? row.humedad.toFixed(2) : '-'}</td>
                                                </tr>
                                            ))}
                                            <tr>
                                                <td className="px-2 py-2 border-r border-border text-center text-muted-foreground" colSpan={2}>Wpromedio</td>
                                                <td className="px-2 py-2 text-center font-semibold">{llHumedadPromedioCheck != null ? llHumedadPromedioCheck.toFixed(2) : '-'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="rounded-md border border-border overflow-hidden">
                                    <div className="px-3 py-2 text-xs font-semibold bg-muted/40 text-foreground">Verificar aquí (gráfico Min. 0.95 y Max. 1.00)</div>
                                    <table className="w-full text-sm bg-white">
                                        <tbody>
                                            <tr>
                                                <td className="px-3 py-2 border-b border-r border-border text-muted-foreground">COEFICIENTE.R2(Q30:Q32;O30:O32)</td>
                                                <td className="px-3 py-2 border-b border-border text-center font-semibold">{llR2 != null ? llR2.toFixed(4) : '-'}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-3 py-2 border-r border-border text-muted-foreground">SI(R2 &gt; 0.95)</td>
                                                <td className={`px-3 py-2 text-center font-semibold ${llConformidad === 'CONFORME' ? 'text-emerald-700' : llConformidad === 'NO CONFORME' ? 'text-rose-700' : 'text-muted-foreground'}`}>{llConformidad}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="rounded-md border border-border overflow-hidden">
                                <div className="px-3 py-2 text-xs font-semibold bg-muted/40 text-foreground">PARÁMETRO DE CONTROL LIMITE PLASTICO</div>
                                <table className="w-full text-sm bg-white">
                                    <thead className="bg-muted/20 text-xs text-muted-foreground">
                                        <tr>
                                            <th className="px-2 py-2 border-b border-r border-border text-center" colSpan={2}>Parámetro calculado</th>
                                            <th className="px-2 py-2 border-b border-r border-border text-center" colSpan={2}>Límites diferencia norma</th>
                                            <th className="px-2 py-2 border-b border-border text-center" rowSpan={2}>Control</th>
                                        </tr>
                                        <tr>
                                            <th className="px-2 py-2 border-b border-r border-border text-center">1S</th>
                                            <th className="px-2 py-2 border-b border-r border-border text-center">d2s</th>
                                            <th className="px-2 py-2 border-b border-r border-border text-center">1S</th>
                                            <th className="px-2 py-2 border-b border-r border-border text-center">d2s</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="px-2 py-2 border-r border-border text-center">{lpStdDev1S != null ? lpStdDev1S.toFixed(4) : '-'}</td>
                                            <td className="px-2 py-2 border-r border-border text-center">{lpD2s != null ? lpD2s : '-'}</td>
                                            <td className="px-2 py-2 border-r border-border text-center">{lpLimite1S.toFixed(1)}</td>
                                            <td className="px-2 py-2 border-r border-border text-center">{lpLimiteD2s}</td>
                                            <td className={`px-2 py-2 text-center font-semibold ${lpControl === 'CUMPLE' ? 'text-emerald-700' : lpControl === 'NO CUMPLE' ? 'text-rose-700' : 'text-muted-foreground'}`}>{lpControl}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border bg-white rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Equipos / observaciones / firmas</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {renderSelect('Balanza 0.01 g', form.balanza_001g_codigo || '-', EQ_BALANZA, v => setField('balanza_001g_codigo', v))}
                                {renderSelect('Horno 110 C', form.horno_110_codigo || '-', EQ_HORNO, v => setField('horno_110_codigo', v))}
                                {renderSelect('Copa casagrande', form.copa_casagrande_codigo || '-', EQ_COPA, v => setField('copa_casagrande_codigo', v))}
                                {renderSelect('Ranurador', form.ranurador_codigo || '-', EQ_RANURADOR, v => setField('ranurador_codigo', v))}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Observaciones</label>
                                    <textarea value={form.observaciones || ''} onChange={e => setField('observaciones', e.target.value)} rows={4} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {renderSelect('Revisado por', form.revisado_por || '-', REVISADO, v => {
                                        setField('revisado_por', v)
                                        if (v !== '-') {
                                            setField('revisado_fecha', formatTodayShortDate())
                                        }
                                    })}
                                    {renderSelect('Aprobado por', form.aprobado_por || '-', APROBADO, v => {
                                        setField('aprobado_por', v)
                                        if (v !== '-') {
                                            setField('aprobado_fecha', formatTodayShortDate())
                                        }
                                    })}
                                    {renderText('Fecha revisado', form.revisado_fecha || '', v => setField('revisado_fecha', v), 'YYYY/MM/DD', () => setField('revisado_fecha', normalizeFlexibleDate(form.revisado_fecha || '')))}
                                    {renderText('Fecha aprobado', form.aprobado_fecha || '', v => setField('aprobado_fecha', v), 'YYYY/MM/DD', () => setField('aprobado_fecha', normalizeFlexibleDate(form.aprobado_fecha || '')))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button onClick={clearAll} disabled={loading} className="h-11 rounded-lg border border-input bg-white text-foreground font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"><Trash2 className="h-4 w-4" />Limpiar todo</button>
                        <button onClick={() => setPendingFormatAction(false)} disabled={loading} className="h-11 rounded-lg border border-[#0089b3] text-[#0089b3] bg-white font-semibold hover:bg-[#0089b3]/5 transition-colors disabled:opacity-50 shadow-sm">{loading ? 'Guardando...' : 'Guardar'}</button>
                        <button onClick={() => setPendingFormatAction(true)} disabled={loading} className="h-11 rounded-lg bg-[#0089b3] text-white font-semibold hover:bg-[#007499] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">{loading ? <><Loader2 className="h-4 w-4 animate-spin" />Procesando...</> : <><Download className="h-4 w-4" />Guardar y descargar Excel</>}</button>
                    </div>
                </div>
            </div>
            
            <FormatConfirmModal
                open={pendingFormatAction !== null}
                formatLabel={buildFormatPreview(form.muestra, muestraType, 'LLP')}
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
