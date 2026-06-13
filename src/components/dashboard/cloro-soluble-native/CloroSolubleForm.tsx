import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Beaker, Download, Loader2, Lock, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import FormatConfirmModal from '../shared/FormatConfirmModal'

// --- Local Types ---
export interface CloroSolubleResultado {
    mililitros_solucion_usada: number | null
    contenido_cloruros_ppm: number | null
}

export interface CloroSolublePayload {
    muestra?: string
    numero_ot?: string
    fecha_ensayo?: string
    realizado_por?: string
    condicion_secado_aire?: string
    condicion_secado_horno?: string
    volumen_agua_ml?: number | null
    peso_suelo_seco_g?: number | null
    alicuota_tomada_ml?: number | null
    titulacion_suelo_g?: number | null
    titulacion_nitrato_plata?: number | null
    ph_ensayo?: number | null
    factor_dilucion?: number | null
    resultados?: CloroSolubleResultado[]
    observaciones?: string
    equipo_horno_codigo?: string
    equipo_balanza_001_codigo?: string
    revisado_por?: string
    revisado_fecha?: string
    aprobado_por?: string
    aprobado_fecha?: string

    // Legacy fields handled by hydrateForm
    mililitros_solucion_usada?: number | null
    contenido_cloruros_ppm?: number | null
}

export interface CloroSolubleDetail {
    id: number
    payload?: CloroSolublePayload | null
}

export interface CloroSolubleSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

async function getEnsayoDetail(ensayoId: number): Promise<CloroSolubleDetail> {
    const url = `${API_URL}/api/cloro-soluble/${ensayoId}`
    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error('No se pudo cargar el ensayo de Cloro Soluble.')
    }
    return response.json()
}

async function saveEnsayo(payload: CloroSolublePayload, ensayoId?: number): Promise<CloroSolubleSaveResponse> {
    const url = `${API_URL}/api/cloro-soluble/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || 'Error al guardar el ensayo de Cloro.')
    }
    return response.json()
}

async function saveAndDownload(payload: CloroSolublePayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/cloro-soluble/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || 'Error al descargar el excel de Cloro.')
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


const MODULE_TITLE = 'Cloruros Solubles'
// const FILE_PREFIX = 'CLORO_SOLUBLE'
const DRAFT_KEY = 'cloro-soluble_form_draft_v2'
const DEBOUNCE_MS = 700
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const
const SECADO_OPTIONS = ['', 'X'] as const
const RESULTADO_COUNT = 2
const FIXED_SHARED_VALUES = {
    volumen_agua_ml: 300,
    peso_suelo_seco_g: 100,
    alicuota_tomada_ml: 30,
    titulacion_suelo_g: 10,
} as const

type TableFieldElement = HTMLInputElement | HTMLSelectElement
type TableNavigationGroup = 'secado' | 'cloro' | 'equipos'

const getTableFieldKey = (table: TableNavigationGroup, row: number, col: number) => `${table}:${row}:${col}`

type ResultadoForm = {
    mililitros_solucion_usada: number | null
    contenido_cloruros_ppm: number | null
}

const createEmptyResultado = (): ResultadoForm => ({
    mililitros_solucion_usada: null,
    contenido_cloruros_ppm: null,
})

const hasResultadoData = (resultado: Partial<ResultadoForm> | undefined): boolean => {
    if (!resultado) return false
    return [resultado.mililitros_solucion_usada, resultado.contenido_cloruros_ppm].some(
        (value) => value !== null && value !== undefined && (value as any) !== '',
    )
}

const toResultadoForm = (resultado?: CloroSolubleResultado | null): ResultadoForm => ({
    mililitros_solucion_usada: resultado?.mililitros_solucion_usada ?? null,
    contenido_cloruros_ppm: resultado?.contenido_cloruros_ppm ?? null,
})

const normalizeResultados = (resultados?: CloroSolubleResultado[]): ResultadoForm[] =>
    Array.from({ length: RESULTADO_COUNT }, (_, idx) => toResultadoForm(resultados?.[idx]))

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

const resolveResultado = (
    resultado: ResultadoForm,
    shared: {
        titulacion_nitrato_plata: number | null
        factor_dilucion: number | null
        titulacion_suelo_g: number | null
    },
): ResultadoForm => {
    const contenido = resultado.mililitros_solucion_usada != null
        && shared.titulacion_nitrato_plata != null
        && shared.factor_dilucion != null
        && shared.titulacion_suelo_g != null
        && shared.titulacion_suelo_g !== 0
        ? round((((resultado.mililitros_solucion_usada - 0.2) * shared.titulacion_nitrato_plata * 1000) / shared.titulacion_suelo_g) * shared.factor_dilucion, 3)
        : resultado.contenido_cloruros_ppm ?? null

    return {
        ...resultado,
        contenido_cloruros_ppm: contenido,
    }
}

const CLORO_SHARED_ROWS: Array<{
    key: string
    label: string
    unit: string
    field:
        | 'volumen_agua_ml'
        | 'peso_suelo_seco_g'
        | 'alicuota_tomada_ml'
        | 'titulacion_suelo_g'
        | 'titulacion_nitrato_plata'
        | 'ph_ensayo'
        | 'factor_dilucion'
    readOnly?: boolean
    locked?: boolean
    fixedValue?: number
}> = [
    {
        key: 'a',
        label: 'Volumen de agua destilada',
        unit: '(ml)',
        field: 'volumen_agua_ml',
        readOnly: true,
        locked: true,
        fixedValue: FIXED_SHARED_VALUES.volumen_agua_ml,
    },
    {
        key: 'b',
        label: 'Peso de suelo seco',
        unit: '(g)',
        field: 'peso_suelo_seco_g',
        readOnly: true,
        locked: true,
        fixedValue: FIXED_SHARED_VALUES.peso_suelo_seco_g,
    },
    {
        key: 'c',
        label: 'Alicuota Tomada',
        unit: '(ml)',
        field: 'alicuota_tomada_ml',
        readOnly: true,
        locked: true,
        fixedValue: FIXED_SHARED_VALUES.alicuota_tomada_ml,
    },
    {
        key: 'd',
        label: 'Titulacion del suelo (b/(a/c))',
        unit: '',
        field: 'titulacion_suelo_g',
        readOnly: true,
        locked: true,
        fixedValue: FIXED_SHARED_VALUES.titulacion_suelo_g,
    },
    { key: 'e', label: 'Titulacion de la solucion Nitrato de Plata', unit: '', field: 'titulacion_nitrato_plata' },
    { key: 'f', label: 'PH de ensayo', unit: '', field: 'ph_ensayo' },
    { key: 'g', label: 'Factor de Dilucion', unit: '(ml)', field: 'factor_dilucion' },
]

const CLORO_RESULTADO_ROWS: Array<{
    key: string
    label: string
    unit: string
    field: keyof ResultadoForm
    readOnly?: boolean
}> = [
    { key: 'h', label: 'Mililitros de solucion usada', unit: '(ml)', field: 'mililitros_solucion_usada' },
    {
        key: 'i',
        label: 'Contenido de Cloruros (((h-0.2)*e*1000)/d*g)',
        unit: '(ppm)',
        field: 'contenido_cloruros_ppm',
        readOnly: true,
    },
]
const CLORO_NAV_ROWS = {
    a: 0,
    b: 1,
    c: 2,
    e: 3,
    f: 4,
    g: 5,
    h: 6,
} as const

type FormState = {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string
    condicion_secado_aire: string
    condicion_secado_horno: string
    volumen_agua_ml: number | null
    peso_suelo_seco_g: number | null
    alicuota_tomada_ml: number | null
    titulacion_suelo_g: number | null
    titulacion_nitrato_plata: number | null
    ph_ensayo: number | null
    factor_dilucion: number | null
    resultados: ResultadoForm[]
    observaciones: string
    equipo_horno_codigo: string
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
    peso_suelo_seco_g: FIXED_SHARED_VALUES.peso_suelo_seco_g,
    alicuota_tomada_ml: FIXED_SHARED_VALUES.alicuota_tomada_ml,
    titulacion_suelo_g: FIXED_SHARED_VALUES.titulacion_suelo_g,
    titulacion_nitrato_plata: null,
    ph_ensayo: null,
    factor_dilucion: null,
    resultados: Array.from({ length: RESULTADO_COUNT }, () => createEmptyResultado()),
    observaciones: '',
    equipo_horno_codigo: '',
    equipo_balanza_001_codigo: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const hydrateForm = (payload?: Partial<CloroSolublePayload>): FormState => {
    const base = initialState()
    if (!payload) return base

    const legacyResultado = toResultadoForm({
        mililitros_solucion_usada: payload.mililitros_solucion_usada ?? null,
        contenido_cloruros_ppm: payload.contenido_cloruros_ppm ?? null,
    })
    const resultados = normalizeResultados(payload.resultados)
    if ((!payload.resultados || payload.resultados.length === 0) && hasResultadoData(legacyResultado)) {
        resultados[0] = legacyResultado
    }

    return {
        ...base,
        ...payload,
        condicion_secado_aire: payload.condicion_secado_aire ?? base.condicion_secado_aire,
        condicion_secado_horno: payload.condicion_secado_horno ?? base.condicion_secado_horno,
        volumen_agua_ml: FIXED_SHARED_VALUES.volumen_agua_ml,
        peso_suelo_seco_g: FIXED_SHARED_VALUES.peso_suelo_seco_g,
        alicuota_tomada_ml: FIXED_SHARED_VALUES.alicuota_tomada_ml,
        titulacion_suelo_g: FIXED_SHARED_VALUES.titulacion_suelo_g,
        titulacion_nitrato_plata: payload.titulacion_nitrato_plata ?? base.titulacion_nitrato_plata,
        ph_ensayo: payload.ph_ensayo ?? base.ph_ensayo,
        factor_dilucion: payload.factor_dilucion ?? base.factor_dilucion,
        resultados,
        equipo_horno_codigo: payload.equipo_horno_codigo ?? base.equipo_horno_codigo,
        equipo_balanza_001_codigo: payload.equipo_balanza_001_codigo ?? base.equipo_balanza_001_codigo,
    }
}

export interface CloroSolubleFormProps {
    ensayoId?: number | null
    onClose?: () => void
    onSaveSuccess?: () => void
}

export default function CloroSolubleForm({ ensayoId: initialEnsayoId, onClose, onSaveSuccess }: CloroSolubleFormProps) {
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
            const parsed = JSON.parse(raw) as Partial<CloroSolublePayload>
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
                            const parsedDraft = JSON.parse(rawDraft) as Partial<CloroSolublePayload>
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
                toast.error('No se pudo cargar ensayo de cloruros solubles.')
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

    const setResultadoField = useCallback(
        <K extends keyof ResultadoForm>(resultadoIndex: number, key: K, value: ResultadoForm[K]) => {
            setForm((prev) => {
                const resultados = prev.resultados.map((resultado, idx) =>
                    idx === resultadoIndex ? { ...resultado, [key]: value } : resultado,
                )
                return { ...prev, resultados }
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

    const resolvedTitulacion = FIXED_SHARED_VALUES.titulacion_suelo_g
    const resolvedResultados = form.resultados.map((resultado) =>
        resolveResultado(resultado, {
            titulacion_nitrato_plata: form.titulacion_nitrato_plata,
            factor_dilucion: form.factor_dilucion,
            titulacion_suelo_g: resolvedTitulacion,
        }),
    )
    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)


    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.fecha_ensayo) {
                toast.error('Complete Muestra, N OT y Fecha de ensayo.')
                return
            }
            setLoading(true)
            try {
                const resultados = form.resultados.map((resultado) =>
                    resolveResultado(resultado, {
                        titulacion_nitrato_plata: form.titulacion_nitrato_plata,
                        factor_dilucion: form.factor_dilucion,
                        titulacion_suelo_g: resolvedTitulacion,
                    }),
                )
                const resultadoPrincipal = resultados[0] ?? createEmptyResultado()
                const payload: CloroSolublePayload = {
                    ...form,
                    ...FIXED_SHARED_VALUES,
                    resultados,
                    titulacion_suelo_g: resolvedTitulacion,
                    mililitros_solucion_usada: resultadoPrincipal.mililitros_solucion_usada,
                    contenido_cloruros_ppm: resultadoPrincipal.contenido_cloruros_ppm,
                }

                if (download) {
                    const downloadResult = await saveAndDownload(payload, ensayoId ?? undefined)
                    const blob = downloadResult instanceof Blob ? downloadResult : downloadResult.blob
                    const filename = downloadResult instanceof Blob ? undefined : downloadResult.filename
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = filename || `${buildFormatPreview(form.muestra, 'SU', 'CLORO SOLUBLE')}.xlsx`
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
                toast.success(download ? 'Cloruros solubles guardado y descargado.' : 'Cloruros solubles guardado.')
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'No se pudo generar Cloruros Solubles.'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [
            ensayoId,
            form,
            resolvedTitulacion,
            onClose,
            onSaveSuccess,
        ],
    )

    const denseInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

    const readOnlyInputClass = 'h-8 w-full rounded-md border border-slate-200 bg-slate-100 px-2 text-sm text-slate-800'
    const fixedInputClass = 'h-8 w-full rounded-md border border-slate-200 bg-slate-100 px-2 pr-8 text-sm font-medium text-slate-800 cursor-not-allowed'
    const compactInputClass = `${denseInputClass} text-center`
    const compactReadOnlyInputClass = `${readOnlyInputClass} text-center`
    const compactFixedInputClass = `${fixedInputClass} pl-8 text-center`

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
                        <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-SU-14.01</p>
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
                                            placeholder="YYYY/MM/DD"
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
                            METODO DE ENSAYONORMALIZADO PARA LA DETERMINACION CUANTITATIVA DE CLORUROS SOLUBLES EN SUELOS Y AGUA SUBTERRANEA
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900">NORMA NTP 339.177</p>
                    </div>

                    <div className="p-3">
                        <div className="mb-4 w-full max-w-md overflow-hidden rounded-lg border border-slate-300">
                            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 text-center">
                                CONDICIONES DE SECADO
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
                                                    className={compactInputClass}
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

                        <table className="w-full table-fixed border border-slate-300 text-sm">
                            <colgroup>
                                <col className="w-10" />
                                <col />
                                <col className="w-20" />
                                <col className="w-44" />
                                <col className="w-44" />
                            </colgroup>
                            <tbody>
                                {CLORO_SHARED_ROWS.map((row) => (
                                    <tr key={row.key}>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs font-semibold">{row.key}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{row.unit}</td>
                                        <td className="border-t border-slate-300 p-1" colSpan={2}>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={
                                                        row.locked
                                                            ? compactFixedInputClass
                                                            : row.readOnly
                                                                ? compactReadOnlyInputClass
                                                                : compactInputClass
                                                    }
                                                    value={row.fixedValue ?? (form[row.field] ?? '')}
                                                    onChange={(e) => {
                                                        if (row.readOnly) return
                                                        setField(row.field, parseNum(e.target.value))
                                                    }}
                                                    readOnly={row.readOnly}
                                                    onKeyDown={
                                                        row.readOnly
                                                            ? undefined
                                                            : (e) => handleTableEnter(
                                                                e,
                                                                'cloro',
                                                                CLORO_NAV_ROWS[row.key as keyof typeof CLORO_NAV_ROWS],
                                                                0,
                                                            )
                                                    }
                                                    ref={
                                                        row.readOnly
                                                            ? undefined
                                                            : (element) => {
                                                                tableFieldRefs.current[
                                                                    getTableFieldKey(
                                                                        'cloro',
                                                                        CLORO_NAV_ROWS[row.key as keyof typeof CLORO_NAV_ROWS],
                                                                        0,
                                                                    )
                                                                ] = element
                                                            }
                                                    }
                                                />
                                                {row.locked ? (
                                                    <Lock className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {CLORO_RESULTADO_ROWS.map((row) => (
                                    <tr key={row.key}>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs font-semibold">{row.key}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{row.unit}</td>
                                        {form.resultados.map((resultado, idx) => (
                                            <td
                                                key={`${row.key}-${idx}`}
                                                className={idx < RESULTADO_COUNT - 1 ? 'border-t border-r border-slate-300 p-1' : 'border-t border-slate-300 p-1'}
                                            >
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={row.readOnly ? compactReadOnlyInputClass : compactInputClass}
                                                    value={(row.readOnly ? resolvedResultados[idx][row.field] : resultado[row.field]) ?? ''}
                                                    onChange={(e) => {
                                                        if (row.readOnly) return
                                                        setResultadoField(
                                                            idx,
                                                            row.field,
                                                            parseNum(e.target.value) as ResultadoForm[typeof row.field],
                                                        )
                                                    }}
                                                    readOnly={row.readOnly}
                                                    onKeyDown={
                                                        row.readOnly
                                                            ? undefined
                                                            : (e) => handleTableEnter(
                                                                e,
                                                                'cloro',
                                                                CLORO_NAV_ROWS[row.key as keyof typeof CLORO_NAV_ROWS],
                                                                idx,
                                                            )
                                                    }
                                                    ref={
                                                        row.readOnly
                                                            ? undefined
                                                            : (element) => {
                                                                tableFieldRefs.current[
                                                                    getTableFieldKey(
                                                                        'cloro',
                                                                        CLORO_NAV_ROWS[row.key as keyof typeof CLORO_NAV_ROWS],
                                                                        idx,
                                                                    )
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

                        <div className="mt-4 overflow-hidden rounded-lg border border-slate-300">
                            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
                                Observaciones
                            </div>
                            <div className="p-2">
                                <textarea
                                    className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35"
                                    rows={3}
                                    value={form.observaciones}
                                    onChange={(e) => setField('observaciones', e.target.value)}
                                    autoComplete="off"
                                    data-lpignore="true"
                                />
                            </div>
                        </div>

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
                                        placeholder="YYYY/MM/DD"
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
                                        placeholder="YYYY/MM/DD"
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
                                className="h-11 rounded-lg bg-secondary text-secondary-foreground font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    'Guardar'
                                )}
                            </button>
                            <button
                                onClick={() => setPendingFormatAction(true)}
                                disabled={loading}
                                className="h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                formatLabel={buildFormatPreview(form.muestra, 'SU', 'CLORO SOLUBLE')}
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
