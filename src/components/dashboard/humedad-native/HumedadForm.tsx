import { createPortal } from 'react-dom'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Download, Loader2, Droplets, FlaskConical, Trash2, X } from 'lucide-react'
import TMCalculator from './TMCalculator'
import FormatConfirmModal from './FormatConfirmModal'
import { authFetch } from '@/lib/api-auth'

// --- Local Types ---
export interface HumedadPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string
    condicion_masa_menor: "-" | "SI" | "NO"
    condicion_capas: "-" | "SI" | "NO"
    condicion_temperatura: "-" | "SI" | "NO"
    condicion_excluido: "-" | "SI" | "NO"
    descripcion_material_excluido?: string
    tipo_muestra?: string
    condicion_muestra?: string
    tamano_maximo_particula?: string
    metodo_a: boolean
    metodo_b: boolean
    numero_ensayo?: number
    recipiente_numero?: string
    masa_recipiente_muestra_humeda?: number
    masa_recipiente_muestra_seca?: number
    masa_recipiente_muestra_seca_constante?: number
    masa_recipiente?: number
    metodo_a_tamano_1?: string
    metodo_a_tamano_2?: string
    metodo_a_tamano_3?: string
    metodo_a_masa_1?: string
    metodo_a_masa_2?: string
    metodo_a_masa_3?: string
    metodo_a_legibilidad_1?: string
    metodo_a_legibilidad_2?: string
    metodo_a_legibilidad_3?: string
    metodo_b_tamano_1?: string
    metodo_b_tamano_2?: string
    metodo_b_tamano_3?: string
    metodo_b_masa_1?: string
    metodo_b_masa_2?: string
    metodo_b_masa_3?: string
    metodo_b_legibilidad_1?: string
    metodo_b_legibilidad_2?: string
    metodo_b_legibilidad_3?: string
    equipo_balanza_01?: string
    equipo_balanza_001?: string
    equipo_horno?: string
    observaciones?: string
    revisado_por?: string
    revisado_fecha?: string
    aprobado_por?: string
    aprobado_fecha?: string
    masa_agua?: number
    masa_muestra_seca?: number
    contenido_humedad?: number
    [key: string]: unknown
}

export interface HumedadEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    contenido_humedad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface HumedadEnsayoDetail extends HumedadEnsayoSummary {
    payload?: HumedadPayload | null
}

export interface HumedadSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    contenido_humedad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

async function getHumedadEnsayoDetail(ensayoId: number): Promise<HumedadEnsayoDetail> {
    const url = `${API_URL}/api/humedad/${ensayoId}`
    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error("No se pudo cargar el ensayo de humedad.")
    }
    return response.json()
}

async function saveHumedadEnsayo(payload: HumedadPayload, ensayoId?: number): Promise<HumedadSaveResponse> {
    const url = `${API_URL}/api/humedad/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || "Error al guardar el ensayo de humedad.")
    }
    return response.json()
}

async function saveAndDownloadHumedadExcel(payload: HumedadPayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/humedad/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || "Error al descargar el excel de humedad.")
    }
    const blob = await response.blob()
    const contentDisposition = response.headers.get("content-disposition")
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

const buildHumedadExportFilename = (muestraRaw: string): string => {
    const raw = (muestraRaw || '').trim().toUpperCase()
    const currentYear = getCurrentYearShort()
    let xxx = 'XXX'
    let yy = currentYear

    const strict = raw.match(/^([A-Z0-9]+)-SU-(\d{2})$/)
    if (strict) {
        xxx = strict[1]
        yy = strict[2]
    } else {
        const relaxed = raw.match(/([A-Z0-9]+)-SU(?:-(\d{2}))?/)
        if (relaxed) {
            xxx = relaxed[1]
            yy = relaxed[2] || currentYear
        } else {
            const compact = raw.replace(/[^A-Z0-9]+/g, '')
            if (compact) xxx = compact.slice(0, 12)
        }
    }

    return `Formato N-${xxx}-${yy} SU20 HUMEDAD SUELO - V05.xlsx`
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

const sanitizeParticulaText = (raw: string): string => {
    return raw
        .replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s-]/g, '')
        .replace(/\s+/g, ' ')
}

type MetodoPruebaOption = '-' | 'A' | 'B'

const resolveMetodoPrueba = (payload: Partial<HumedadPayload> & { metodo_prueba?: string | null }): MetodoPruebaOption => {
    const direct = (payload.metodo_prueba || '').toUpperCase()
    if (direct === 'A' || direct === 'B') return direct
    if (payload.metodo_a && !payload.metodo_b) return 'A'
    if (payload.metodo_b && !payload.metodo_a) return 'B'
    if (payload.metodo_a && payload.metodo_b) return 'A'
    return '-'
}

type HumedadFormState = HumedadPayload & {
    metodo_prueba: MetodoPruebaOption
    forma_particula: string
}

// ── Initial form state ───────────────────────────────────────────────────────
const INITIAL_STATE: HumedadFormState = {
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    condicion_masa_menor: '-',
    condicion_capas: '-',
    condicion_temperatura: '-',
    condicion_excluido: '-',
    descripcion_material_excluido: '',
    tipo_muestra: '',
    condicion_muestra: '',
    tamano_maximo_particula: '',
    forma_particula: '',
    metodo_prueba: '-',
    metodo_a: false,
    metodo_b: false,
    metodo_a_tamano_1: '3 in',
    metodo_a_tamano_2: '1 1/2 in',
    metodo_a_tamano_3: '3/4 in',
    metodo_a_masa_1: '5 kg',
    metodo_a_masa_2: '1 kg',
    metodo_a_masa_3: '250 g',
    metodo_a_legibilidad_1: '0.1 g',
    metodo_a_legibilidad_2: '0.1 g',
    metodo_a_legibilidad_3: '0.1 g',
    metodo_b_tamano_1: '3/8 in',
    metodo_b_tamano_2: 'No. 4',
    metodo_b_tamano_3: 'No. 10',
    metodo_b_masa_1: '500 g',
    metodo_b_masa_2: '250 g',
    metodo_b_masa_3: '250 g',
    metodo_b_legibilidad_1: '0.01 g',
    metodo_b_legibilidad_2: '0.01 g',
    metodo_b_legibilidad_3: '0.01 g',
    numero_ensayo: undefined,
    recipiente_numero: '',
    masa_recipiente_muestra_humeda: undefined,
    masa_recipiente_muestra_seca: undefined,
    masa_recipiente_muestra_seca_constante: undefined,
    masa_recipiente: undefined,
    equipo_balanza_01: '-',
    equipo_balanza_001: '-',
    equipo_horno: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
}

type CondicionKey = 'condicion_masa_menor' | 'condicion_capas' | 'condicion_temperatura' | 'condicion_excluido'
type MetodoStringKey =
    | 'metodo_a_tamano_1' | 'metodo_a_tamano_2' | 'metodo_a_tamano_3'
    | 'metodo_a_masa_1' | 'metodo_a_masa_2' | 'metodo_a_masa_3'
    | 'metodo_a_legibilidad_1' | 'metodo_a_legibilidad_2' | 'metodo_a_legibilidad_3'
    | 'metodo_b_tamano_1' | 'metodo_b_tamano_2' | 'metodo_b_tamano_3'
    | 'metodo_b_masa_1' | 'metodo_b_masa_2' | 'metodo_b_masa_3'
    | 'metodo_b_legibilidad_1' | 'metodo_b_legibilidad_2' | 'metodo_b_legibilidad_3'
type EquipoKey = 'equipo_balanza_01' | 'equipo_balanza_001' | 'equipo_horno'

interface MetodoRowConfig {
    tamanoKey: MetodoStringKey
    masaKey: MetodoStringKey
    legibilidadKey: MetodoStringKey
}

const METHOD_A_ROWS: MetodoRowConfig[] = [
    { tamanoKey: 'metodo_a_tamano_1', masaKey: 'metodo_a_masa_1', legibilidadKey: 'metodo_a_legibilidad_1' },
    { tamanoKey: 'metodo_a_tamano_2', masaKey: 'metodo_a_masa_2', legibilidadKey: 'metodo_a_legibilidad_2' },
    { tamanoKey: 'metodo_a_tamano_3', masaKey: 'metodo_a_masa_3', legibilidadKey: 'metodo_a_legibilidad_3' },
]

const METHOD_B_ROWS: MetodoRowConfig[] = [
    { tamanoKey: 'metodo_b_tamano_1', masaKey: 'metodo_b_masa_1', legibilidadKey: 'metodo_b_legibilidad_1' },
    { tamanoKey: 'metodo_b_tamano_2', masaKey: 'metodo_b_masa_2', legibilidadKey: 'metodo_b_legibilidad_2' },
    { tamanoKey: 'metodo_b_tamano_3', masaKey: 'metodo_b_masa_3', legibilidadKey: 'metodo_b_legibilidad_3' },
]

const EQUIPO_OPTIONS: Record<EquipoKey, string[]> = {
    equipo_balanza_01: ['-', 'EQP-0046'],
    equipo_balanza_001: ['-', 'EQP-0045'],
    equipo_horno: ['-', 'EQP-0150', 'EQP-0049'],
}

const REVISADO_POR_OPTIONS = ['-', 'FABIAN LA ROSA']
const APROBADO_POR_OPTIONS = ['-', 'IRMA COAQUIRA']
const HUMEDAD_DRAFT_STORAGE_PREFIX = 'humedad_form_draft_v1'
const AUTOSAVE_DEBOUNCE_MS = 700

interface HumedadDraftSnapshot {
    version: number
    updatedAt: string
    form: Partial<HumedadFormState>
}

const getDraftStorageKey = (ensayoId: number | null) =>
    `${HUMEDAD_DRAFT_STORAGE_PREFIX}:${ensayoId ?? 'new'}`

const hydrateHumedadFormState = (candidate: Partial<HumedadFormState>): HumedadFormState => {
    const mergedPayload = {
        ...INITIAL_STATE,
        ...candidate,
    }
    const metodoPrueba = resolveMetodoPrueba(mergedPayload)
    return {
        ...mergedPayload,
        metodo_prueba: metodoPrueba,
        metodo_a: metodoPrueba === 'A',
        metodo_b: metodoPrueba === 'B',
        forma_particula: sanitizeParticulaText(mergedPayload.forma_particula || ''),
    }
}

const isSameNumber = (a: unknown, b: unknown): boolean => {
    const na = typeof a === 'number' ? a : (a == null || a === '' ? undefined : Number(a))
    const nb = typeof b === 'number' ? b : (b == null || b === '' ? undefined : Number(b))
    if (Number.isNaN(na) && Number.isNaN(nb)) return true
    return na === nb
}

const areFormsEquivalent = (left: HumedadFormState, right: HumedadFormState): boolean => {
    const keys = Object.keys(INITIAL_STATE) as Array<keyof HumedadFormState>
    return keys.every((key) => {
        const initialValue = right[key]
        const currentValue = left[key]

        if (typeof initialValue === 'boolean') {
            return Boolean(currentValue) === initialValue
        }
        if (typeof initialValue === 'number' || typeof currentValue === 'number') {
            return isSameNumber(currentValue, initialValue)
        }
        const normalizedCurrent = String(currentValue ?? '').trim()
        const normalizedInitial = String(initialValue ?? '').trim()
        return normalizedCurrent === normalizedInitial
    })
}

const isFormAtInitialState = (form: HumedadFormState): boolean => {
    return areFormsEquivalent(form, INITIAL_STATE)
}

const hasNumberValue = (value: number | undefined | null): boolean =>
    value !== null && value !== undefined && !Number.isNaN(value)

export default function HumedadForm({
    editId,
    onClose,
    onSaveSuccess,
}: {
    editId?: number
    onClose?: () => void
    onSaveSuccess?: () => void
}) {
    const [form, setForm] = useState<HumedadFormState>({ ...INITIAL_STATE })
    const [loading, setLoading] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [showDraftBanner, setShowDraftBanner] = useState(false)
    const [draftData, setDraftData] = useState<HumedadFormState | null>(null)
    const [isClearDraftModalOpen, setIsClearDraftModalOpen] = useState(false)
    const hydratedFromServerRef = useRef<HumedadFormState | null>(null)
    const restoredDraftKeysRef = useRef<Set<string>>(new Set())
    const draftStorageKey = useMemo(() => getDraftStorageKey(editingEnsayoId), [editingEnsayoId])

    // ── Helpers ───────────────────────────────────────────────────────
    const set = useCallback(<K extends keyof HumedadFormState>(key: K, value: HumedadFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }, [])

    const setNum = useCallback((key: keyof HumedadFormState, raw: string) => {
        const val = raw === '' ? undefined : parseFloat(raw)
        setForm(prev => ({ ...prev, [key]: val }))
    }, [])

    const applyFormattedField = useCallback((
        key: 'muestra' | 'numero_ot' | 'fecha_ensayo' | 'revisado_fecha' | 'aprobado_fecha',
        formatter: (raw: string) => string,
    ) => {
        setForm(prev => {
            const current = String(prev[key] ?? '')
            const formatted = formatter(current)
            if (formatted === current) return prev
            return { ...prev, [key]: formatted }
        })
    }, [])

    const handleMetodoPruebaChange = useCallback((rawValue: string) => {
        const metodo = rawValue === 'A' || rawValue === 'B' ? rawValue : '-'
        setForm(prev => ({
            ...prev,
            metodo_prueba: metodo,
            metodo_a: metodo === 'A',
            metodo_b: metodo === 'B',
        }))
    }, [])

    // ── Computed formulas ─────────────────────────────────────────────
    const masaAgua = useMemo(() => {
        const h = form.masa_recipiente_muestra_humeda
        const sc = form.masa_recipiente_muestra_seca_constante
        if (h != null && sc != null) return Math.round((h - sc) * 100) / 100
        return null
    }, [form.masa_recipiente_muestra_humeda, form.masa_recipiente_muestra_seca_constante])

    const masaMuestraSeca = useMemo(() => {
        const sc = form.masa_recipiente_muestra_seca_constante
        const r = form.masa_recipiente
        if (sc != null && r != null) return Math.round((sc - r) * 100) / 100
        return null
    }, [form.masa_recipiente_muestra_seca_constante, form.masa_recipiente])

    const contenidoHumedad = useMemo(() => {
        if (masaAgua != null && masaMuestraSeca != null && masaMuestraSeca !== 0) {
            return Math.round((masaAgua / masaMuestraSeca) * 1000) / 10
        }
        return null
    }, [masaAgua, masaMuestraSeca])

    // masa muestra neta (húmeda - recipiente) para la calculadora TM
    const masaMuestraNeta = useMemo(() => {
        const h = form.masa_recipiente_muestra_humeda
        const r = form.masa_recipiente
        if (h != null && r != null) return Math.round((h - r) * 100) / 100
        return undefined
    }, [form.masa_recipiente_muestra_humeda, form.masa_recipiente])

    const ensayoDataStarted = useMemo(() => {
        return (
            (form.recipiente_numero || '').trim() !== '' ||
            hasNumberValue(form.masa_recipiente_muestra_humeda) ||
            hasNumberValue(form.masa_recipiente_muestra_seca) ||
            hasNumberValue(form.masa_recipiente_muestra_seca_constante) ||
            hasNumberValue(form.masa_recipiente) ||
            (form.numero_ensayo ?? INITIAL_STATE.numero_ensayo) !== INITIAL_STATE.numero_ensayo
        )
    }, [
        form.masa_recipiente,
        form.masa_recipiente_muestra_humeda,
        form.masa_recipiente_muestra_seca,
        form.masa_recipiente_muestra_seca_constante,
        form.numero_ensayo,
        form.recipiente_numero,
    ])

    const minimoHastaFila7Completo = !ensayoDataStarted || masaAgua !== null

    const buildPayload = useCallback((): HumedadPayload & { metodo_prueba?: MetodoPruebaOption; forma_particula?: string } => {
        const metodoPrueba = resolveMetodoPrueba(form)
        const formaParticula = sanitizeParticulaText(form.forma_particula || '').trim()
        const payload: HumedadPayload & { metodo_prueba?: MetodoPruebaOption; forma_particula?: string } = {
            ...form,
            metodo_prueba: metodoPrueba,
            forma_particula: formaParticula,
            metodo_a: metodoPrueba === 'A',
            metodo_b: metodoPrueba === 'B',
        }
        if (masaAgua !== null) payload.masa_agua = masaAgua
        if (masaMuestraSeca !== null) payload.masa_muestra_seca = masaMuestraSeca
        if (contenidoHumedad !== null) payload.contenido_humedad = contenidoHumedad
        return payload
    }, [contenidoHumedad, form, masaAgua, masaMuestraSeca])

    useEffect(() => {
        if (!editingEnsayoId) return

        let cancelled = false
        const loadForEdit = async () => {
            setLoadingEnsayo(true)
            try {
                const detail: HumedadEnsayoDetail = await getHumedadEnsayoDetail(editingEnsayoId)
                if (!detail.payload) {
                    toast.error('El ensayo seleccionado no tiene payload guardado para edición.')
                    return
                }
                if (!cancelled) {
                    const hydrated = hydrateHumedadFormState(detail.payload as Partial<HumedadFormState>)
                    hydratedFromServerRef.current = hydrated

                    // Compare with local draft
                    const rawDraft = localStorage.getItem(draftStorageKey)
                    if (rawDraft) {
                        try {
                            const parsed = JSON.parse(rawDraft) as HumedadDraftSnapshot
                            if (parsed && typeof parsed === 'object' && typeof parsed.form === 'object') {
                                const draftState = hydrateHumedadFormState(parsed.form)
                                if (!areFormsEquivalent(draftState, hydrated)) {
                                    setDraftData(draftState)
                                    setShowDraftBanner(true)
                                } else {
                                    localStorage.removeItem(draftStorageKey)
                                }
                            }
                        } catch {
                            // Ignored
                        }
                    }

                    setForm(hydrated)
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Error desconocido'
                toast.error(`No se pudo cargar ensayo para edición: ${msg}`)
            } finally {
                if (!cancelled) {
                    setLoadingEnsayo(false)
                }
            }
        }

        void loadForEdit()
        return () => {
            cancelled = true
        }
    }, [editingEnsayoId, draftStorageKey])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (editingEnsayoId) return // Edit mode handles draft check in loadForEdit
        if (restoredDraftKeysRef.current.has(draftStorageKey)) return

        restoredDraftKeysRef.current.add(draftStorageKey)
        const raw = localStorage.getItem(draftStorageKey)
        if (!raw) return

        try {
            const parsed = JSON.parse(raw) as HumedadDraftSnapshot
            if (!parsed || typeof parsed !== 'object' || typeof parsed.form !== 'object') {
                localStorage.removeItem(draftStorageKey)
                return
            }

            const hydratedDraft = hydrateHumedadFormState(parsed.form)
            setForm(hydratedDraft)
            toast.success('Se restauró un borrador local.')
        } catch {
            localStorage.removeItem(draftStorageKey)
        }
    }, [draftStorageKey, editingEnsayoId])

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (loadingEnsayo) return

        const timeoutId = window.setTimeout(() => {
            const sameAsServer = Boolean(
                editingEnsayoId &&
                hydratedFromServerRef.current &&
                areFormsEquivalent(form, hydratedFromServerRef.current)
            )

            if (isFormAtInitialState(form) || sameAsServer) {
                localStorage.removeItem(draftStorageKey)
                return
            }

            const snapshot: HumedadDraftSnapshot = {
                version: 1,
                updatedAt: new Date().toISOString(),
                form,
            }
            localStorage.setItem(draftStorageKey, JSON.stringify(snapshot))
        }, AUTOSAVE_DEBOUNCE_MS)

        return () => window.clearTimeout(timeoutId)
    }, [draftStorageKey, editingEnsayoId, form, loadingEnsayo])

    useEffect(() => {
        const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
            if (minimoHastaFila7Completo) return
            event.preventDefault()
            event.returnValue = ''
        }
        window.addEventListener('beforeunload', beforeUnloadHandler)
        return () => window.removeEventListener('beforeunload', beforeUnloadHandler)
    }, [minimoHastaFila7Completo])

    useEffect(() => {
        if (!isClearDraftModalOpen) return
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsClearDraftModalOpen(false)
            }
        }
        window.addEventListener('keydown', onEscape)
        return () => window.removeEventListener('keydown', onEscape)
    }, [isClearDraftModalOpen])

    const downloadBlob = useCallback((blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }, [])

    // ── TM callback ───────────────────────────────────────────────────
    const handleTMSelect = useCallback((tm: string) => {
        set('tamano_maximo_particula', tm)
    }, [set])

    const closeParentModalIfEmbedded = useCallback(() => {
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
        }
    }, [])

    const clearLocalDraft = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(draftStorageKey)
        }

        if (editingEnsayoId && hydratedFromServerRef.current) {
            setForm(hydratedFromServerRef.current)
            toast.success('Cambios locales limpiados. Se restauraron los datos guardados.')
            return
        }

        setForm({ ...INITIAL_STATE })
        toast.success('Datos limpiados.')
    }, [draftStorageKey, editingEnsayoId])

    const handleClearLocalData = useCallback(() => {
        const hasChanges = !isFormAtInitialState(form)
        if (!hasChanges) {
            clearLocalDraft()
            return
        }
        setIsClearDraftModalOpen(true)
    }, [clearLocalDraft, form])

    const confirmClearLocalData = useCallback(() => {
        setIsClearDraftModalOpen(false)
        clearLocalDraft()
    }, [clearLocalDraft])
    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)


    const handleSave = useCallback(async (withDownload: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) {
            toast.error('Complete los campos obligatorios: Muestra, N° OT, Realizado por')
            return
        }

        setLoading(true)
        try {
            const payload = buildPayload()
            if (withDownload) {
                const { blob, filename } = await saveAndDownloadHumedadExcel(payload, editingEnsayoId ?? undefined)
                downloadBlob(blob, filename || buildHumedadExportFilename(payload.muestra))
                toast.success(editingEnsayoId ? 'Formato actualizado y descargado.' : 'Formato guardado y descargado.')
            } else {
                await saveHumedadEnsayo(payload, editingEnsayoId ?? undefined)
                toast.success(editingEnsayoId ? 'Formato actualizado correctamente.' : 'Formato guardado correctamente.')
            }
            if (typeof window !== 'undefined') {
                localStorage.removeItem(draftStorageKey)
            }
            hydratedFromServerRef.current = null
            setForm({ ...INITIAL_STATE })
            setEditingEnsayoId(null)
            if (onSaveSuccess) {
                onSaveSuccess()
            } else {
                closeParentModalIfEmbedded()
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido'
            toast.error(`Error guardando formato: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [buildPayload, closeParentModalIfEmbedded, downloadBlob, draftStorageKey, editingEnsayoId, form.muestra, form.numero_ot, form.realizado_por, onSaveSuccess])

    // ── Render ────────────────────────────────────────────────────────
    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6">
            {/* Title */}
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Droplets className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Contenido de Humedad — ASTM D2216-19
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Generador de informe de laboratorio
                        </p>
                        {editingEnsayoId && (
                            <p className="text-xs text-primary font-medium mt-1">
                                Editando ensayo #{editingEnsayoId}
                            </p>
                        )}
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
                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2">
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
                                localStorage.removeItem(draftStorageKey)
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

            {loadingEnsayo && (
                <div className="mb-4 h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando datos guardados para edición...
                </div>
            )}

            {/* ═══ SPLIT LAYOUT: Form | Calculator ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── LEFT: Formulario (2/3) ─────────────────────── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Encabezado */}
                    <Section title="Encabezado" icon={<FlaskConical className="h-4 w-4" />}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Input label="Muestra *" value={form.muestra}
                                   onChange={v => set('muestra', v)}
                                   onBlur={() => applyFormattedField('muestra', normalizeMuestraCode)}
                                   placeholder="XXX-SU-26" />
                            <Input label="N° OT *" value={form.numero_ot}
                                   onChange={v => set('numero_ot', v)}
                                   onBlur={() => applyFormattedField('numero_ot', normalizeNumeroOtCode)}
                                   placeholder="XXX-26" />
                            <Input label="Fecha Ensayo" value={form.fecha_ensayo}
                                   onChange={v => set('fecha_ensayo', v)}
                                   onBlur={() => applyFormattedField('fecha_ensayo', normalizeFlexibleDate)}
                                   placeholder="YYYY/MM/DD" />
                            <Input label="Realizado por *" value={form.realizado_por}
                                   onChange={v => set('realizado_por', v)} />
                        </div>
                    </Section>

                    {/* Condiciones del ensayo */}
                    <Section title="Condiciones del Ensayo">
                        <div className="space-y-2">
                            {([
                                ['condicion_masa_menor', '- La muestra de ensayo tiene una masa menor que la minima requerida por la norma. (Si/No)'],
                                ['condicion_capas', '- La muestra de ensayo presenta mas de un tipo de material (capas, etc.). (Si/No)'],
                                ['condicion_temperatura', '- La temperatura de secado es diferente a 110 ± 5°C. (Si/No)'],
                                ['condicion_excluido', '- Se excluyo algun material (tamano y cantidad) de la muestra de prueba. (Si/No)'],
                            ] as [CondicionKey, string][]).map(([key, label]) => (
                                <SelectField
                                    key={key}
                                    label={label}
                                    value={form[key]}
                                    options={['-', 'SI', 'NO']}
                                    inline
                                    onChange={(value) => set(key, value as "-" | "SI" | "NO")}
                                />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_280px] gap-2 md:gap-3 items-center pt-1">
                            <label className="text-sm font-medium text-muted-foreground">
                                Descripción material excluido
                            </label>
                            <input
                                type="text"
                                value={form.descripcion_material_excluido || ''}
                                onChange={(e) => set('descripcion_material_excluido', e.target.value)}
                                placeholder="Ej: Se excluyó grava > 3 in, aprox. 450 g"
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm
                                           focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </Section>

                    {/* Descripción de la muestra + Método */}
                    <Section title="Descripción de la Muestra">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            <Input label="Tipo de muestra" value={form.tipo_muestra || ''}
                                   onChange={v => set('tipo_muestra', v)} />
                            <Input label="Condición de la muestra" value={form.condicion_muestra || ''}
                                   onChange={v => set('condicion_muestra', v)} />
                            <Input label="Tamaño máx. partícula (in)" value={form.tamano_maximo_particula || ''}
                                   onChange={v => set('tamano_maximo_particula', v)} />
                            <Input
                                label="Forma de la partícula"
                                value={form.forma_particula || ''}
                                onChange={v => set('forma_particula', sanitizeParticulaText(v))}
                                placeholder="Ej: Angular 12"
                            />
                        </div>
                        <div className="mt-3 max-w-xs">
                            <SelectField
                                label="Método de prueba"
                                value={form.metodo_prueba}
                                options={['-', 'A', 'B']}
                                onChange={handleMetodoPruebaChange}
                            />
                        </div>
                    </Section>

                    {/* Datos de ensayo */}
                    <Section title="Datos del Ensayo">
                        <div className="overflow-x-auto rounded-md border border-border">
                            <table className="w-full min-w-[720px] text-sm">
                                <thead className="bg-muted/40">
                                    <tr className="text-xs font-semibold text-muted-foreground">
                                        <th className="w-10 px-2 py-2 border-b border-r border-border text-center">#</th>
                                        <th className="px-3 py-2 border-b border-r border-border text-left">DESCRIPCIÓN</th>
                                        <th className="w-24 px-2 py-2 border-b border-r border-border text-center">UND</th>
                                        <th className="w-72 px-3 py-2 border-b border-border text-left">ENSAYO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">1</td>
                                        <td className="px-3 py-2 border-b border-r border-border">N° de ensayo</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">N°</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableNumInput value={form.numero_ensayo} onChange={v => setNum('numero_ensayo', v)} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">2</td>
                                        <td className="px-3 py-2 border-b border-r border-border">Recipiente N°</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">N°</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableTextInput value={form.recipiente_numero || ''} onChange={v => set('recipiente_numero', v)} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">3</td>
                                        <td className="px-3 py-2 border-b border-r border-border">Masa del recipiente y muestra húmeda</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">g</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableNumInput value={form.masa_recipiente_muestra_humeda} onChange={v => setNum('masa_recipiente_muestra_humeda', v)} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">4</td>
                                        <td className="px-3 py-2 border-b border-r border-border">Masa del recipiente y muestra seca al horno</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">g</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableNumInput value={form.masa_recipiente_muestra_seca} onChange={v => setNum('masa_recipiente_muestra_seca', v)} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">5</td>
                                        <td className="px-3 py-2 border-b border-r border-border">Masa del recipiente y muestra seca al horno constante</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">g</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableNumInput value={form.masa_recipiente_muestra_seca_constante} onChange={v => setNum('masa_recipiente_muestra_seca_constante', v)} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">6</td>
                                        <td className="px-3 py-2 border-b border-r border-border">Masa del recipiente</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">g</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableNumInput value={form.masa_recipiente} onChange={v => setNum('masa_recipiente', v)} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">7</td>
                                        <td className="px-3 py-2 border-b border-r border-border">Masa del agua (5-3)</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">g</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableComputedValue value={masaAgua} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">8</td>
                                        <td className="px-3 py-2 border-b border-r border-border">Masa de muestra seca al horno (5-6)</td>
                                        <td className="px-2 py-2 border-b border-r border-border text-center">g</td>
                                        <td className="px-3 py-2 border-b border-border">
                                            <TableComputedValue value={masaMuestraSeca} />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-2 py-2 border-r border-border text-center">9</td>
                                        <td className="px-3 py-2 border-r border-border">CONTENIDO DE AGUA (HUMEDAD) * (7/8*100)</td>
                                        <td className="px-2 py-2 border-r border-border text-center">%</td>
                                        <td className="px-3 py-2">
                                            <TableComputedValue value={contenidoHumedad} highlight />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        {ensayoDataStarted && !minimoHastaFila7Completo && (
                            <p className="mt-3 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                Para salir o guardar, complete mínimo hasta la fila 7: <strong>Masa del agua (5-3)</strong>.
                            </p>
                        )}
                    </Section>

                    {/* Método A / Método B - Datos de tabla */}
                    <Section title="Método A / Método B">
                        {form.metodo_prueba === '-' ? (
                            <p className="text-sm text-muted-foreground">
                                Seleccione Método A o B para visualizar la tabla de referencia.
                            </p>
                        ) : (
                            <MetodoGrid
                                title={`Método ${form.metodo_prueba}`}
                                rows={form.metodo_prueba === 'A' ? METHOD_A_ROWS : METHOD_B_ROWS}
                                form={form}
                            />
                        )}
                    </Section>

                    {/* Equipo */}
                    <Section title="Equipo Utilizado">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <EquipmentSelect
                                label="Balanza 0.1 g"
                                value={form.equipo_balanza_01 || '-'}
                                options={EQUIPO_OPTIONS.equipo_balanza_01}
                                onChange={v => set('equipo_balanza_01', v)}
                            />
                            <EquipmentSelect
                                label="Balanza 0.01 g"
                                value={form.equipo_balanza_001 || '-'}
                                options={EQUIPO_OPTIONS.equipo_balanza_001}
                                onChange={v => set('equipo_balanza_001', v)}
                            />
                            <EquipmentSelect
                                label="Horno 110°C"
                                value={form.equipo_horno || '-'}
                                options={EQUIPO_OPTIONS.equipo_horno}
                                onChange={v => set('equipo_horno', v)}
                            />
                        </div>
                    </Section>

                    {/* Observaciones */}
                    <Section title="Observaciones">
                        <textarea
                            value={form.observaciones || ''}
                            onChange={e => set('observaciones', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm
                                       resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                            placeholder="Observaciones del ensayo..."
                        />
                    </Section>

                    {/* Footer - Revisado / Aprobado */}
                    <Section title="Revisado / Aprobado">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <SelectField
                                label="Revisado por"
                                value={form.revisado_por || '-'}
                                options={REVISADO_POR_OPTIONS}
                                onChange={v => {
                                    set('revisado_por', v)
                                    if (v !== '-') {
                                        set('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                    }
                                }}
                            />
                            <Input label="Fecha revisión" value={form.revisado_fecha || ''}
                                   onChange={v => set('revisado_fecha', v)}
                                   onBlur={() => applyFormattedField('revisado_fecha', normalizeFlexibleDate)}
                                   placeholder="YYYY/MM/DD" />
                            <SelectField
                                label="Aprobado por"
                                value={form.aprobado_por || '-'}
                                options={APROBADO_POR_OPTIONS}
                                onChange={v => {
                                    set('aprobado_por', v)
                                    if (v !== '-') {
                                        set('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                    }
                                }}
                            />
                            <Input label="Fecha aprobación" value={form.aprobado_fecha || ''}
                                   onChange={v => set('aprobado_fecha', v)}
                                   onBlur={() => applyFormattedField('aprobado_fecha', normalizeFlexibleDate)}
                                   placeholder="YYYY/MM/DD" />
                        </div>
                    </Section>

                    {/* Guardado / Descarga */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            onClick={handleClearLocalData}
                            disabled={loading}
                            className="h-11 rounded-lg border border-input bg-background text-foreground font-medium
                                   hover:bg-muted/60 transition-colors disabled:opacity-50
                                   flex items-center justify-center gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Limpiar datos
                        </button>
                        <button
                            onClick={() => setPendingFormatAction(false)}
                            disabled={loading}
                            className="h-11 rounded-lg bg-secondary text-secondary-foreground font-medium
                                   hover:bg-secondary/80 transition-colors disabled:opacity-50
                                   flex items-center justify-center gap-2"
                        >
                            {loading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                                : 'Guardar'
                            }
                        </button>
                        <button
                            onClick={() => setPendingFormatAction(true)}
                            disabled={loading}
                            className="h-11 rounded-lg bg-primary text-primary-foreground font-medium
                                   hover:bg-primary/90 transition-colors disabled:opacity-50
                                   flex items-center justify-center gap-2"
                        >
                            {loading
                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                                : <><Download className="h-4 w-4" /> Guardar y Descargar</>
                            }
                        </button>
                    </div>
                </div>

                {/* ── RIGHT: Calculator (1/3) ────────────────────── */}
                <div className="lg:col-span-1">
                    <div className="sticky top-4">
                        <TMCalculator
                            onSelect={handleTMSelect}
                            selectedTM={form.tamano_maximo_particula || ''}
                            masaMuestra={masaMuestraNeta}
                        />
                        {/* Quick info card */}
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground text-sm mb-2">Resumen en vivo</p>
                            <p><strong>Muestra:</strong> {form.muestra || '—'}</p>
                            <p><strong>OT:</strong> {form.numero_ot || '—'}</p>
                            <p><strong>TM:</strong> {form.tamano_maximo_particula || '—'}</p>
                            <p><strong>Forma partícula:</strong> {form.forma_particula || '—'}</p>
                            <p><strong>Método:</strong> {form.metodo_prueba !== '-' ? form.metodo_prueba : '—'}</p>
                            <p><strong>Masa muestra neta:</strong> {masaMuestraNeta != null ? `${masaMuestraNeta} g` : '—'}</p>
                            <p><strong>Humedad:</strong>{' '}
                                {contenidoHumedad != null
                                    ? <span className="text-primary font-bold">{contenidoHumedad}%</span>
                                    : '—'
                                }
                            </p>
                        </div>

                    </div>
                </div>
            </div>

            <ConfirmActionModal
                isOpen={isClearDraftModalOpen}
                title="Limpiar datos no guardados"
                message="Se limpiarán los datos no guardados. ¿Deseas continuar?"
                confirmText="Sí, limpiar"
                cancelText="Cancelar"
                onConfirm={confirmClearLocalData}
                onCancel={() => setIsClearDraftModalOpen(false)}
            />
            <FormatConfirmModal
                open={pendingFormatAction !== null}
                formatLabel={buildFormatPreview(form.muestra, 'SU', 'HUMEDAD')}
                actionLabel={pendingFormatAction ? 'Guardar y Descargar' : 'Guardar'}
                onClose={() => setPendingFormatAction(null)}
                onConfirm={() => {
                    if (pendingFormatAction === null) return
                    const shouldDownload = pendingFormatAction
                    setPendingFormatAction(null)
                    void handleSave(shouldDownload)
                }}
            />
        </div>
    )
}

// ── Reusable sub-components ─────────────────────────────────────────────────

function ConfirmActionModal({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
}: {
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    onConfirm: () => void
    onCancel: () => void
}) {
    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-99999 flex items-center justify-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={title}>
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm cursor-default"
                onClick={onCancel}
                aria-label="Cerrar modal"
            />
            <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                            <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 px-4 rounded-lg border border-input bg-background text-foreground text-sm font-medium hover:bg-muted/60 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}

function Section({ title, icon, children }: {
    title: string
    icon?: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg flex items-center gap-2">
                {icon}
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            </div>
            <div className="p-4">{children}</div>
        </div>
    )
}

function Input({ label, value, onChange, placeholder, onBlur }: {
    label: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    onBlur?: () => void
}) {
    return (
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
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm
                           focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )
}

function SelectField({ label, value, onChange, options, inline = false }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: string[]
    inline?: boolean
}) {
    const selectElement = (
        <>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none
                           focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {options.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </>
    )

    if (inline) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,1fr)_200px] gap-2 md:gap-3 items-center">
                <label className="text-sm font-medium text-muted-foreground">{label}</label>
                <div className="relative w-full md:max-w-[200px] md:justify-self-end">
                    {selectElement}
                </div>
            </div>
        )
    }

    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <div className="relative">
                {selectElement}
            </div>
        </div>
    )
}

function TableTextInput({ value, onChange }: {
    value: string
    onChange: (raw: string) => void
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function TableNumInput({ value, onChange }: {
    value: number | undefined | null
    onChange: (raw: string) => void
}) {
    return (
        <input
            type="number"
            step="any"
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function TableComputedValue({ value, highlight }: {
    value: number | null
    highlight?: boolean
}) {
    return (
        <div
            className={`h-8 px-2 rounded-md border text-sm flex items-center ${
                highlight && value != null
                    ? 'border-primary bg-primary/5 text-primary font-semibold'
                    : 'border-input bg-muted/30 text-foreground'
            }`}
        >
            {value != null ? value : '—'}
        </div>
    )
}

function EquipmentSelect({ label, value, onChange, options }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: string[]
}) {
    return <SelectField label={label} value={value} onChange={onChange} options={options} />
}

function MetodoGrid({
    title,
    rows,
    form,
}: {
    title: string
    rows: MetodoRowConfig[]
    form: HumedadPayload
}) {
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-muted/40 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            </div>
            <div className="p-3 space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-muted-foreground px-1">
                    <div className="col-span-4">Tamaño partícula</div>
                    <div className="col-span-4">Masa mínima</div>
                    <div className="col-span-4">Legibilidad</div>
                </div>
                {rows.map((row) => (
                    <div key={row.tamanoKey} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4 h-9 px-2 rounded-md border border-input bg-muted/40 text-sm flex items-center text-foreground">
                            {(form[row.tamanoKey] as string) || '-'}
                        </div>
                        <div className="col-span-4 h-9 px-2 rounded-md border border-input bg-muted/40 text-sm flex items-center text-foreground">
                            {(form[row.masaKey] as string) || '-'}
                        </div>
                        <div className="col-span-4 h-9 px-2 rounded-md border border-input bg-muted/40 text-sm flex items-center text-foreground">
                            {(form[row.legibilidadKey] as string) || '-'}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
