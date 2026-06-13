import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Beaker, Download, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import FormatConfirmModal from '../shared/FormatConfirmModal'

// --- Local Types ---
export interface SalesSolublesCapsula {
    capsula_numero: string
    peso_capsula_g: number | null
    peso_capsula_sales_g: number | null
    peso_sales_g: number | null
    contenido_sales_ppm: number | null
}

export interface SalesSolublesPayload {
    muestra?: string
    numero_ot?: string
    fecha_ensayo?: string
    realizado_por?: string
    condicion_secado_aire?: string
    condicion_secado_horno?: string
    volumen_agua_ml?: number
    peso_suelo_g?: number
    volumen_solucion_tomada_ml?: number
    capsulas?: SalesSolublesCapsula[]
    peso_constante_hora?: string[]
    peso_constante_peso_1?: Array<number | null>
    peso_constante_variacion_1?: Array<number | null>
    peso_constante_peso_2?: Array<number | null>
    peso_constante_variacion_2?: Array<number | null>
    equipo_horno_codigo?: string
    equipo_balanza_0001_codigo?: string
    equipo_balanza_001_codigo?: string
    revisado_por?: string
    revisado_fecha?: string
    aprobado_por?: string
    aprobado_fecha?: string

    // Legacy fields handled by hydrateForm
    capsula_numero?: string
    peso_capsula_g?: number | null
    peso_capsula_sales_g?: number | null
    peso_sales_g?: number | null
    contenido_sales_ppm?: number | null
}

export interface SalesSolublesDetail {
    id: number
    payload?: SalesSolublesPayload | null
}

export interface SalesSolublesSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

async function getEnsayoDetail(ensayoId: number): Promise<SalesSolublesDetail> {
    const url = `${API_URL}/api/sales-solubles/${ensayoId}`
    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error('No se pudo cargar el ensayo de Sales Solubles.')
    }
    return response.json()
}

async function saveEnsayo(payload: SalesSolublesPayload, ensayoId?: number): Promise<SalesSolublesSaveResponse> {
    const url = `${API_URL}/api/sales-solubles/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
    const response = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
            errorData = JSON.parse(errorText)
        } catch {
            errorData = { detail: errorText }
        }
        throw new Error(errorData.detail || 'Error al guardar el ensayo.')
    }
    return response.json()
}

async function saveAndDownload(payload: SalesSolublesPayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/sales-solubles/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
    const response = await authFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
            errorData = JSON.parse(errorText)
        } catch {
            errorData = { detail: errorText }
        }
        throw new Error(errorData.detail || 'Error al descargar el excel de Sales Solubles.')
    }
    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition')
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


const MODULE_TITLE = 'Sales Solubles'
// const FILE_PREFIX = 'SALES_SOLUBLES'
const DRAFT_KEY = 'sales-solubles_form_draft_v2'
const DEBOUNCE_MS = 700
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const
const SECADO_OPTIONS = ['', 'X'] as const
const CONST_ROWS = [1, 2, 3, 4] as const
const CAPSULA_COUNT = 2
const FIXED_SHARED_VALUES = {
    volumen_agua_ml: 500,
    peso_suelo_g: 100,
    volumen_solucion_tomada_ml: 100,
} as const
const LOCKED_CURSOR =
    'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27%3E%3Ctext x=%273%27 y=%2718%27 font-size=%2716%27%3E%F0%9F%94%92%3C/text%3E%3C/svg%3E") 6 6, not-allowed'

type TableFieldElement = HTMLInputElement | HTMLSelectElement
type TableNavigationGroup = 'secado' | 'sales' | 'constante' | 'equipos'

const getTableFieldKey = (table: TableNavigationGroup, row: number, col: number) => `${table}:${row}:${col}`

type CapsulaForm = {
    capsula_numero: string
    peso_capsula_g: number | null
    peso_capsula_sales_g: number | null
    peso_sales_g: number | null
    contenido_sales_ppm: number | null
}

const createEmptyCapsula = (): CapsulaForm => ({
    capsula_numero: '',
    peso_capsula_g: null,
    peso_capsula_sales_g: null,
    peso_sales_g: null,
    contenido_sales_ppm: null,
})

const hasCapsulaData = (capsula: Partial<CapsulaForm> | undefined): boolean => {
    if (!capsula) return false
    return [
        capsula.capsula_numero?.trim(),
        capsula.peso_capsula_g,
        capsula.peso_capsula_sales_g,
        capsula.peso_sales_g,
        capsula.contenido_sales_ppm,
    ].some((value) => value !== null && value !== undefined && value !== '')
}

const toCapsulaForm = (capsula?: SalesSolublesCapsula | null): CapsulaForm => ({
    capsula_numero: capsula?.capsula_numero ?? '',
    peso_capsula_g: capsula?.peso_capsula_g ?? null,
    peso_capsula_sales_g: capsula?.peso_capsula_sales_g ?? null,
    peso_sales_g: capsula?.peso_sales_g ?? null,
    contenido_sales_ppm: capsula?.contenido_sales_ppm ?? null,
})

const normalizeCapsulas = (capsulas?: SalesSolublesCapsula[]): CapsulaForm[] =>
    Array.from({ length: CAPSULA_COUNT }, (_, idx) => toCapsulaForm(capsulas?.[idx]))

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestraCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''
    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const match = compact.match(/^(\d+)(?:-[A-Z]+)?(?:-(\d{2}))?$/)
    return match ? `${match[1]}-${match[2] || year}` : value
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

const parseNum = (value: string) => {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const round = (value: number, decimals = 4) => {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
}

const resolveCapsula = (
    capsula: CapsulaForm,
    shared: {
        volumen_agua_ml: number | null
        volumen_solucion_tomada_ml: number | null
    },
): CapsulaForm => {
    const pesoSales = capsula.peso_capsula_g != null && capsula.peso_capsula_sales_g != null
        ? round(capsula.peso_capsula_sales_g - capsula.peso_capsula_g, 4)
        : capsula.peso_sales_g ?? null

    const contenidoSales = pesoSales != null
        && shared.volumen_agua_ml != null
        && shared.volumen_solucion_tomada_ml != null
        && shared.volumen_solucion_tomada_ml !== 0
        ? round(((pesoSales * (shared.volumen_agua_ml / shared.volumen_solucion_tomada_ml)) / shared.volumen_solucion_tomada_ml) * 1000000, 3)
        : capsula.contenido_sales_ppm ?? null

    return {
        ...capsula,
        peso_sales_g: pesoSales,
        contenido_sales_ppm: contenidoSales,
    }
}

const SALES_SHARED_ROWS: Array<{
    key: string
    label: string
    unit: string
    field: 'volumen_agua_ml' | 'peso_suelo_g' | 'volumen_solucion_tomada_ml'
}> = [
    { key: 'a', label: 'Volumen de Agua Destilada', unit: '(ml)', field: 'volumen_agua_ml' },
    { key: 'b', label: 'Peso del Suelo', unit: '(g)', field: 'peso_suelo_g' },
    { key: 'c', label: 'Volumen de la Solucion Tomada', unit: '(ml)', field: 'volumen_solucion_tomada_ml' },
]

const SALES_CAPSULA_ROWS: Array<{
    key: string
    label: string
    unit: string
    field: keyof CapsulaForm
    readOnly?: boolean
}> = [
    { key: 'd', label: 'Peso de Capsula', unit: '(g)', field: 'peso_capsula_g' },
    { key: 'e', label: 'Peso de Capsula + Sales Solubles', unit: '(g)', field: 'peso_capsula_sales_g' },
    { key: 'f', label: 'Peso de Sales Solubles (e-d)', unit: '(g)', field: 'peso_sales_g', readOnly: true },
    {
        key: 'g',
        label: 'Contenido de Sales Solubles ((f*(a/c))/c)*1000000',
        unit: '(ppm)',
        field: 'contenido_sales_ppm',
        readOnly: true,
    },
]

const normalizeArray = <T,>(value: T[] | undefined, length: number, fallback: T): T[] => {
    const result = Array.from({ length }, () => fallback)
    if (!value) return result
    value.slice(0, length).forEach((item, idx) => {
        result[idx] = item
    })
    return result
}

const getEnsayoId = () => {
    const raw = new URLSearchParams(window.location.search).get('ensayo_id')
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
}

type FormState = {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string
    condicion_secado_aire: string
    condicion_secado_horno: string
    volumen_agua_ml: number | null
    peso_suelo_g: number | null
    volumen_solucion_tomada_ml: number | null
    capsulas: CapsulaForm[]
    peso_constante_hora: string[]
    peso_constante_peso_1: Array<number | null>
    peso_constante_variacion_1: Array<number | null>
    peso_constante_peso_2: Array<number | null>
    peso_constante_variacion_2: Array<number | null>
    equipo_horno_codigo: string
    equipo_balanza_0001_codigo: string
    equipo_balanza_001_codigo: string
    revisado_por: string
    revisado_fecha: string
    aprobado_por: string
    aprobado_fecha: string
}

const initialState = (): FormState => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    condicion_secado_aire: '',
    condicion_secado_horno: '',
    volumen_agua_ml: FIXED_SHARED_VALUES.volumen_agua_ml,
    peso_suelo_g: FIXED_SHARED_VALUES.peso_suelo_g,
    volumen_solucion_tomada_ml: FIXED_SHARED_VALUES.volumen_solucion_tomada_ml,
    capsulas: Array.from({ length: CAPSULA_COUNT }, () => createEmptyCapsula()),
    peso_constante_hora: Array.from({ length: CONST_ROWS.length }, () => ''),
    peso_constante_peso_1: Array.from({ length: CONST_ROWS.length }, () => null),
    peso_constante_variacion_1: Array.from({ length: CONST_ROWS.length }, () => null),
    peso_constante_peso_2: Array.from({ length: CONST_ROWS.length }, () => null),
    peso_constante_variacion_2: Array.from({ length: CONST_ROWS.length }, () => null),
    equipo_horno_codigo: '',
    equipo_balanza_0001_codigo: '',
    equipo_balanza_001_codigo: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const hydrateForm = (payload?: Partial<SalesSolublesPayload>): FormState => {
    const base = initialState()
    if (!payload) return base

    const legacyCapsula = toCapsulaForm({
        capsula_numero: payload.capsula_numero ?? '',
        peso_capsula_g: payload.peso_capsula_g ?? null,
        peso_capsula_sales_g: payload.peso_capsula_sales_g ?? null,
        peso_sales_g: payload.peso_sales_g ?? null,
        contenido_sales_ppm: payload.contenido_sales_ppm ?? null,
    })
    const capsulas = normalizeCapsulas(payload.capsulas)
    if ((!payload.capsulas || payload.capsulas.length === 0) && hasCapsulaData(legacyCapsula)) {
        capsulas[0] = legacyCapsula
    }

    return {
        ...base,
        ...payload,
        condicion_secado_aire: payload.condicion_secado_aire ?? base.condicion_secado_aire,
        condicion_secado_horno: payload.condicion_secado_horno ?? base.condicion_secado_horno,
        volumen_agua_ml: FIXED_SHARED_VALUES.volumen_agua_ml,
        peso_suelo_g: FIXED_SHARED_VALUES.peso_suelo_g,
        volumen_solucion_tomada_ml: FIXED_SHARED_VALUES.volumen_solucion_tomada_ml,
        capsulas,
        peso_constante_hora: normalizeArray(payload.peso_constante_hora, CONST_ROWS.length, ''),
        peso_constante_peso_1: normalizeArray(payload.peso_constante_peso_1, CONST_ROWS.length, null),
        peso_constante_variacion_1: normalizeArray(payload.peso_constante_variacion_1, CONST_ROWS.length, null),
        peso_constante_peso_2: normalizeArray(payload.peso_constante_peso_2, CONST_ROWS.length, null),
        peso_constante_variacion_2: normalizeArray(payload.peso_constante_variacion_2, CONST_ROWS.length, null),
        equipo_horno_codigo: payload.equipo_horno_codigo ?? base.equipo_horno_codigo,
        equipo_balanza_0001_codigo: payload.equipo_balanza_0001_codigo ?? base.equipo_balanza_0001_codigo,
        equipo_balanza_001_codigo: payload.equipo_balanza_001_codigo ?? base.equipo_balanza_001_codigo,
    }
}

export interface SalesSolublesFormProps {
    ensayoId?: number | null
    onClose?: () => void
    onSaveSuccess?: () => void
}

export default function SalesSolublesForm({ ensayoId: initialEnsayoId, onClose, onSaveSuccess }: SalesSolublesFormProps) {
    const [form, setForm] = useState<FormState>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [ensayoId, setEnsayoId] = useState<number | null>(initialEnsayoId ?? null)
    const [showDraftBanner, setShowDraftBanner] = useState(false)
    const [draftData, setDraftData] = useState<FormState | null>(null)
    const tableFieldRefs = useRef<Record<string, TableFieldElement | null>>({})

    useEffect(() => {
        if (ensayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as Partial<SalesSolublesPayload>
            setForm(hydrateForm(parsed))
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
                const detail = await getEnsayoDetail(ensayoId)
                if (!cancel && detail.payload) {
                    const serverState = hydrateForm(detail.payload)
                    const rawDraft = localStorage.getItem(`${DRAFT_KEY}:${ensayoId}`)
                    if (rawDraft) {
                        try {
                            const parsedDraft = JSON.parse(rawDraft) as Partial<SalesSolublesPayload>
                            const draftState = hydrateForm(parsedDraft)
                            if (JSON.stringify(draftState) !== JSON.stringify(serverState)) {
                                setDraftData(draftState)
                                setShowDraftBanner(true)
                            } else {
                                localStorage.removeItem(`${DRAFT_KEY}:${ensayoId}`)
                            }
                        } catch {
                            // Ignored
                        }
                    }
                    setForm(serverState)
                }
            } catch {
                toast.error('No se pudo cargar ensayo de sales solubles.')
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

    const setArrayTextField = useCallback((key: 'peso_constante_hora', index: number, value: string) => {
        setForm((prev) => {
            const arr = [...prev[key]]
            arr[index] = value
            return { ...prev, [key]: arr }
        })
    }, [])

    const setArrayNumberField = useCallback(
        (
            key: 'peso_constante_peso_1' | 'peso_constante_variacion_1' | 'peso_constante_peso_2' | 'peso_constante_variacion_2',
            index: number,
            value: number | null,
        ) => {
            setForm((prev) => {
                const arr = [...prev[key]]
                arr[index] = value
                return { ...prev, [key]: arr }
            })
        },
        [],
    )

    const setCapsulaField = useCallback(
        <K extends keyof CapsulaForm>(capsulaIndex: number, key: K, value: CapsulaForm[K]) => {
            setForm((prev) => {
                const capsulas = prev.capsulas.map((capsula, idx) =>
                    idx === capsulaIndex ? { ...capsula, [key]: value } : capsula,
                )
                return { ...prev, capsulas }
            })
        },
        [],
    )

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
                const [fieldTable, fieldRow, fieldCol] = key.split(':')
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
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (focusTableField(table, row + 1, col)) return
            focusNextTableField(table, row, col)
        },
        [focusNextTableField, focusTableField],
    )

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
        setForm(initialState())
    }, [ensayoId])
    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)


    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.fecha_ensayo) {
                toast.error('Complete Muestra, N OT y Fecha de ensayo.')
                return
            }
            setLoading(true)
            try {
                const capsulas = form.capsulas.map((capsula) =>
                    resolveCapsula(capsula, {
                        volumen_agua_ml: form.volumen_agua_ml,
                        volumen_solucion_tomada_ml: form.volumen_solucion_tomada_ml,
                    }),
                )
                const capsulaPrincipal = capsulas[0] ?? createEmptyCapsula()
                const payload: SalesSolublesPayload = {
                    ...form,
                    ...FIXED_SHARED_VALUES,
                    capsulas,
                    capsula_numero: capsulaPrincipal.capsula_numero,
                    peso_capsula_g: capsulaPrincipal.peso_capsula_g,
                    peso_capsula_sales_g: capsulaPrincipal.peso_capsula_sales_g,
                    peso_sales_g: capsulaPrincipal.peso_sales_g,
                    contenido_sales_ppm: capsulaPrincipal.contenido_sales_ppm,
                }

                if (download) {
                    const downloadResult = await saveAndDownload(payload, ensayoId ?? undefined)
                    const blob = downloadResult instanceof Blob ? downloadResult : downloadResult.blob
                    const filename = downloadResult instanceof Blob ? undefined : downloadResult.filename
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = filename || `${buildFormatPreview(form.muestra, 'SU', 'SALES SOLUBLES')}.xlsx`
                    a.click()
                    URL.revokeObjectURL(url)
                } else {
                    await saveEnsayo(payload, ensayoId ?? undefined)
                }
                localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
                setForm(initialState())
                setEnsayoId(null)
                if (onSaveSuccess) {
                    onSaveSuccess()
                } else if (onClose) {
                    onClose()
                } else {
                    if (window.parent !== window) window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
                }
                toast.success(download ? 'Sales solubles guardado y descargado.' : 'Sales solubles guardado.')
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'No se pudo generar Sales Solubles.'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [
            ensayoId,
            form,
        ],
    )

    const denseInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

    const readOnlyInputClass = 'h-8 w-full rounded-md border border-slate-200 bg-slate-100 px-2 text-sm text-slate-800'
    const fixedInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-center text-sm text-slate-900 shadow-sm'
    const resolvedCapsulas = form.capsulas.map((capsula) =>
        resolveCapsula(capsula, {
            volumen_agua_ml: form.volumen_agua_ml,
            volumen_solucion_tomada_ml: form.volumen_solucion_tomada_ml,
        }),
    )

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-6">
            <div className="mx-auto max-w-[1100px] space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
                            <Beaker className="h-5 w-5 text-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-base font-semibold text-slate-900 md:text-lg">{MODULE_TITLE.toUpperCase()}</h1>
                            <p className="text-xs text-slate-600">Replica del formato Excel oficial</p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-950 focus:outline-none"
                            title="Regresar al Dashboard"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {showDraftBanner ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-start gap-2.5 text-sm text-amber-800">
                            <span className="text-lg leading-none">⚠️</span>
                            <div>
                                <p className="font-semibold text-amber-900">Cambios locales no guardados detectados</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                    Se encontró un borrador en este navegador que tiene diferencias con la versión guardada en el servidor.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            <button
                                onClick={() => {
                                    if (draftData) setForm(draftData)
                                    setShowDraftBanner(false)
                                    toast.success('Borrador local recuperado con éxito.')
                                }}
                                className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition"
                            >
                                Recuperar Trabajo
                            </button>
                            <button
                                onClick={() => {
                                    localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
                                    setShowDraftBanner(false)
                                    setDraftData(null)
                                    toast.success('Borrador descartado.')
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
                        <p className="text-[24px] font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                        <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-SU-13.01</p>
                    </div>

                    <div className="border-b border-slate-300 bg-white px-3 py-3">
                        <table className="w-full table-fixed border border-slate-300 text-sm">
                            <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                <tr>
                                    <th className="border-r border-slate-300 py-1" colSpan={2}>MUESTRA</th>
                                    <th className="border-r border-slate-300 py-1">N° OT</th>
                                    <th className="border-r border-slate-300 py-1" colSpan={2}>FECHA DE ENSAYO</th>
                                    <th className="py-1" colSpan={2}>REALIZADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                                        <input
                                            className={`${denseInputClass} text-center`}
                                            value={form.muestra}
                                            onChange={(e) => setField('muestra', e.target.value)}
                                            onBlur={() => setField('muestra', normalizeMuestraCode(form.muestra))}
                                            autoComplete="off"
                                            data-lpignore="true"
                                        />
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
                                    <td className="border-r border-t border-slate-300 p-1" colSpan={2}>
                                        <input
                                            className={`${denseInputClass} text-center`}
                                            value={form.fecha_ensayo}
                                            onChange={(e) => setField('fecha_ensayo', e.target.value)}
                                            onBlur={() => setField('fecha_ensayo', normalizeFlexibleDate(form.fecha_ensayo))}
                                            autoComplete="off"
                                            data-lpignore="true"
                                            placeholder="DD/MM/AA"
                                        />
                                    </td>
                                    <td className="border-t border-slate-300 p-1" colSpan={2}>
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
                        <p className="text-[15px] font-semibold leading-tight text-slate-900">
                            METODO DE ENSAYONORMALIZADO PARA LA DETERMINACION DEL CONTENIDO DE SALES SOLUBLES EN SUELOS Y AGUA SUBTERRANEA
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900">NORMA NTP 339.152</p>
                    </div>

                    <div className="p-3">
                        <div className="mb-4 w-full max-w-md overflow-hidden rounded-lg border border-slate-300">
                            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 text-center">
                                CONDICIONES DE SECADO DE SUELO
                            </div>
                            <table className="w-full table-fixed text-sm">
                                <tbody>
                                    {[
                                        { label: 'SECADO AL AIRE', key: 'condicion_secado_aire' as const },
                                        { label: 'SECADO EN HORNO 60°C', key: 'condicion_secado_horno' as const },
                                    ].map((row, idx) => (
                                        <tr key={row.key}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                            <td className="border-t border-slate-300 p-1 w-20">
                                                <select
                                                    className={denseInputClass}
                                                    value={form[row.key]}
                                                    onChange={(e) => setField(row.key, e.target.value)}
                                                    onKeyDown={(e) => handleTableEnter(e, 'secado', idx, 0)}
                                                    ref={(element) => {
                                                        tableFieldRefs.current[getTableFieldKey('secado', idx, 0)] = element
                                                    }}
                                                >
                                                    {SECADO_OPTIONS.map((opt) => (
                                                        <option key={opt} value={opt}>
                                                            {opt}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mb-2 text-xs font-semibold text-slate-800">DETERMINACION DEL CONTENIDO DE SALES SOLUBLES</div>
                        <table className="w-full table-fixed border border-slate-300 text-sm">
                            <colgroup>
                                <col className="w-10" />
                                <col />
                                <col className="w-20" />
                                <col className="w-44" />
                                <col className="w-44" />
                            </colgroup>
                            <tbody>
                                <tr className="bg-slate-50 text-xs font-semibold text-slate-800">
                                    <td className="border-r border-slate-300 py-1" colSpan={2}>Capsula</td>
                                    <td className="border-r border-slate-300 py-1 text-center">N°</td>
                                    {form.capsulas.map((capsula, idx) => (
                                        <td
                                            key={idx}
                                            className={idx < CAPSULA_COUNT - 1 ? 'border-r border-slate-300 py-1 px-1' : 'py-1 px-1'}
                                        >
                                            <input
                                                className={denseInputClass}
                                                value={capsula.capsula_numero}
                                                onChange={(e) => setCapsulaField(idx, 'capsula_numero', e.target.value)}
                                                onKeyDown={(e) => handleTableEnter(e, 'sales', 0, idx)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('sales', 0, idx)] = element
                                                }}
                                                autoComplete="off"
                                                data-lpignore="true"
                                            />
                                        </td>
                                    ))}
                                </tr>
                                {SALES_SHARED_ROWS.map((row) => (
                                    <tr key={row.key}>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs font-semibold">{row.key}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{row.unit}</td>
                                        <td className="border-t border-slate-300 p-1" colSpan={2}>
                                            <input
                                                type="number"
                                                step="any"
                                                className={fixedInputClass}
                                                value={FIXED_SHARED_VALUES[row.field]}
                                                readOnly
                                                style={{ cursor: LOCKED_CURSOR }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                                {SALES_CAPSULA_ROWS.map((row) => (
                                    <tr key={row.key}>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs font-semibold">{row.key}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{row.unit}</td>
                                        {form.capsulas.map((capsula, idx) => (
                                            <td
                                                key={`${row.key}-${idx}`}
                                                className={idx < CAPSULA_COUNT - 1 ? 'border-t border-r border-slate-300 p-1' : 'border-t border-slate-300 p-1'}
                                            >
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={row.readOnly ? readOnlyInputClass : denseInputClass}
                                                    value={(row.readOnly ? resolvedCapsulas[idx][row.field] : capsula[row.field]) ?? ''}
                                                    onChange={(e) => {
                                                        if (row.readOnly) return
                                                        setCapsulaField(
                                                            idx,
                                                            row.field,
                                                            parseNum(e.target.value) as CapsulaForm[typeof row.field],
                                                        )
                                                    }}
                                                    readOnly={row.readOnly}
                                                    onKeyDown={
                                                        row.readOnly
                                                            ? undefined
                                                            : (e) => handleTableEnter(e, 'sales', row.key === 'd' ? 1 : 2, idx)
                                                    }
                                                    ref={
                                                        row.readOnly
                                                            ? undefined
                                                            : (element) => {
                                                                tableFieldRefs.current[
                                                                    getTableFieldKey('sales', row.key === 'd' ? 1 : 2, idx)
                                                                ] = element
                                                            }
                                                    }
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-4 text-xs font-semibold text-slate-800">DETERMINACIÓN PESO CONTANTE</div>
                        <table className="w-full table-fixed border border-slate-300 text-sm">
                            <thead className="bg-slate-100 text-[11px] font-semibold text-slate-800">
                                <tr>
                                    <th className="border-b border-r border-slate-300 py-1">N°</th>
                                    <th className="border-b border-r border-slate-300 py-1">Hora</th>
                                    <th className="border-b border-r border-slate-300 py-1">P. Cap. + Sales</th>
                                    <th className="border-b border-r border-slate-300 py-1">Variacion (%)</th>
                                    <th className="border-b border-r border-slate-300 py-1">P. Cap. + Sales</th>
                                    <th className="border-b border-slate-300 py-1">Variacion (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {CONST_ROWS.map((rowNumber, idx) => (
                                    <tr key={rowNumber}>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{rowNumber}</td>
                                        <td className="border-t border-r border-slate-300 p-1">
                                            <input
                                                className={denseInputClass}
                                                value={form.peso_constante_hora[idx]}
                                                onChange={(e) => setArrayTextField('peso_constante_hora', idx, e.target.value)}
                                                onKeyDown={(e) => handleTableEnter(e, 'constante', idx, 0)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('constante', idx, 0)] = element
                                                }}
                                            />
                                        </td>
                                        <td className="border-t border-r border-slate-300 p-1">
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.peso_constante_peso_1[idx] ?? ''}
                                                onChange={(e) => setArrayNumberField('peso_constante_peso_1', idx, parseNum(e.target.value))}
                                                onKeyDown={(e) => handleTableEnter(e, 'constante', idx, 1)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('constante', idx, 1)] = element
                                                }}
                                            />
                                        </td>
                                        <td className="border-t border-r border-slate-300 p-1">
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.peso_constante_variacion_1[idx] ?? ''}
                                                onChange={(e) => setArrayNumberField('peso_constante_variacion_1', idx, parseNum(e.target.value))}
                                                onKeyDown={(e) => handleTableEnter(e, 'constante', idx, 2)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('constante', idx, 2)] = element
                                                }}
                                            />
                                        </td>
                                        <td className="border-t border-r border-slate-300 p-1">
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.peso_constante_peso_2[idx] ?? ''}
                                                onChange={(e) => setArrayNumberField('peso_constante_peso_2', idx, parseNum(e.target.value))}
                                                onKeyDown={(e) => handleTableEnter(e, 'constante', idx, 3)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('constante', idx, 3)] = element
                                                }}
                                            />
                                        </td>
                                        <td className="border-t border-slate-300 p-1">
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.peso_constante_variacion_2[idx] ?? ''}
                                                onChange={(e) => setArrayNumberField('peso_constante_variacion_2', idx, parseNum(e.target.value))}
                                                onKeyDown={(e) => handleTableEnter(e, 'constante', idx, 4)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('constante', idx, 4)] = element
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="mt-2 text-[11px] text-slate-600">
                            Repetir el ciclo de secado, enfriamiento con desecación y pesaje hasta obtener un peso
                            constante, o hasta que la variación de peso sea menor al 4 % de la pesada anterior ó 1 mg,
                            cualquiera que se cumpla.
                        </p>

                        <div className="mt-4 w-full max-w-md overflow-hidden rounded-lg border border-slate-300">
                            <table className="w-full table-fixed text-sm">
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                    <tr>
                                        <th className="border-b border-r border-slate-300 py-1">Equipo utilizado</th>
                                        <th className="border-b border-slate-300 py-1">Código</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: 'Horno', key: 'equipo_horno_codigo' as const },
                                        { label: 'Balanza 0.0001', key: 'equipo_balanza_0001_codigo' as const },
                                        { label: 'Balanza 0.01', key: 'equipo_balanza_001_codigo' as const },
                                    ].map((row, idx) => (
                                        <tr key={row.key}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                            <td className="border-t border-slate-300 p-1">
                                                <input
                                                    className={denseInputClass}
                                                    value={form[row.key]}
                                                    onChange={(e) => setField(row.key, e.target.value)}
                                                    onKeyDown={(e) => handleTableEnter(e, 'equipos', idx, 0)}
                                                    ref={(element) => {
                                                        tableFieldRefs.current[getTableFieldKey('equipos', idx, 0)] = element
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 md:justify-end">
                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Revisado</div>
                                <div className="space-y-2 p-2">
                                    <select
                                        className={denseInputClass}
                                        value={form.revisado_por}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            setField('revisado_por', v)
                                            if (v !== '-') {
                                                setField('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                            }
                                        }}
                                    >
                                        {REVISORES.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        className={denseInputClass}
                                        value={form.revisado_fecha}
                                        onChange={(e) => setField('revisado_fecha', e.target.value)}
                                        onBlur={() => setField('revisado_fecha', normalizeFlexibleDate(form.revisado_fecha))}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        placeholder="DD/MM/AA"
                                    />
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Aprobado</div>
                                <div className="space-y-2 p-2">
                                    <select
                                        className={denseInputClass}
                                        value={form.aprobado_por}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            setField('aprobado_por', v)
                                            if (v !== '-') {
                                                setField('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                            }
                                        }}
                                    >
                                        {APROBADORES.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        className={denseInputClass}
                                        value={form.aprobado_fecha}
                                        onChange={(e) => setField('aprobado_fecha', e.target.value)}
                                        onBlur={() => setField('aprobado_fecha', normalizeFlexibleDate(form.aprobado_fecha))}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        placeholder="DD/MM/AA"
                                    />
                                </div>
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
                </div>
            </div>
            <FormatConfirmModal
                open={pendingFormatAction !== null}
                formatLabel={buildFormatPreview(form.muestra, 'SU', 'SALES SOLUBLES')}
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
