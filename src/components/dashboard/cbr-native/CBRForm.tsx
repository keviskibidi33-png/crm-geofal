
import { useState, useMemo, useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Download, Loader2, FlaskConical, Gauge, X } from 'lucide-react'
import { authFetch } from '@/lib/api-auth'
import FormatConfirmModal from '../shared/FormatConfirmModal'

// --- Local Types ---
export interface CBRLecturaPenetracionRow {
    tension_standard?: number
    lectura_dial_esp_01?: number
    lectura_dial_esp_02?: number
    lectura_dial_esp_03?: number
}

export interface CBRHinchamientoRow {
    fecha?: string
    hora?: string
    esp_01?: number
    esp_02?: number
    esp_03?: number
}

export interface CBRPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    sobretamano_porcentaje?: number
    masa_grava_adicionada_g?: number
    condicion_muestra_saturado: "-" | "SI" | "NO"
    condicion_muestra_sin_saturar: "-" | "SI" | "NO"
    maxima_densidad_seca?: number
    optimo_contenido_humedad?: number
    temperatura_inicial_c?: number
    temperatura_final_c?: number
    tamano_maximo_visual_in?: string
    descripcion_muestra_astm?: string

    golpes_por_especimen: Array<number | null>
    codigo_molde_por_especimen: Array<string | null>
    temperatura_inicio_c_por_columna: Array<number | null>
    temperatura_final_c_por_columna: Array<number | null>
    masa_molde_suelo_g_por_columna: Array<number | null>
    codigo_tara_por_columna: Array<string | null>
    masa_tara_g_por_columna: Array<number | null>
    masa_suelo_humedo_tara_g_por_columna: Array<number | null>
    masa_suelo_seco_tara_g_por_columna: Array<number | null>
    masa_suelo_seco_tara_constante_g_por_columna: Array<number | null>

    lecturas_penetracion: CBRLecturaPenetracionRow[]
    hinchamiento: CBRHinchamientoRow[]
    profundidad_hendidura_mm_por_celda: Array<number | null>
    profundidad_hendidura_mm?: number

    equipo_cbr?: string
    equipo_dial_deformacion?: string
    equipo_dial_expansion?: string
    equipo_horno_110?: string
    equipo_pison?: string
    equipo_balanza_1g?: string
    equipo_balanza_01g?: string

    observaciones?: string
    revisado_por?: string
    revisado_fecha?: string
    aprobado_por?: string
    aprobado_fecha?: string
    [key: string]: unknown
}

export interface CBREnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    indice_cbr?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface CBREnsayoDetail extends CBREnsayoSummary {
    payload?: CBRPayload | null
}

export interface CBRSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    indice_cbr?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

async function getCBREnsayoDetail(ensayoId: number): Promise<CBREnsayoDetail> {
    const url = `${API_URL}/api/cbr/${ensayoId}`
    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error("No se pudo cargar el ensayo de CBR.")
    }
    return response.json()
}

async function saveCBREnsayo(payload: CBRPayload, ensayoId?: number): Promise<CBRSaveResponse> {
    const url = `${API_URL}/api/cbr/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || "Error al guardar el ensayo de CBR.")
    }
    return response.json()
}

async function saveAndDownloadCBRExcel(payload: CBRPayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/cbr/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || "Error al descargar el excel de CBR.")
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

const normalizeTime = (raw: string): string => {
    const value = raw.trim()
    if (!value) return ''

    const digits = value.replace(/\D/g, '')
    const pad2 = (part: string) => part.padStart(2, '0').slice(-2)

    if (value.includes(':')) {
        const [h = '', m = '', s = ''] = value.split(':').map(part => part.trim())
        return `${pad2(h || '0')}:${pad2(m || '0')}:${pad2(s || '0')}`
    }

    if (digits.length <= 2) return `${pad2(digits)}:00:00`
    if (digits.length <= 4) return `${pad2(digits.slice(0, 2))}:${pad2(digits.slice(2, 4))}:00`
    return `${pad2(digits.slice(0, 2))}:${pad2(digits.slice(2, 4))}:${pad2(digits.slice(4, 6))}`
}

const PENETRACION_BASE = [
    { tiempo: '0:00', pulg: 0.0, mm: 0.0 },
    { tiempo: '0:30', pulg: 0.025, mm: 0.64 },
    { tiempo: '1:00', pulg: 0.05, mm: 1.3 },
    { tiempo: '1:30', pulg: 0.075, mm: 1.9 },
    { tiempo: '2:00', pulg: 0.1, mm: 2.5 },
    { tiempo: '2:30', pulg: 0.125, mm: 3.18 },
    { tiempo: '3:00', pulg: 0.15, mm: 3.8 },
    { tiempo: '3:30', pulg: 0.175, mm: 4.45 },
    { tiempo: '4:00', pulg: 0.2, mm: 5.1 },
    { tiempo: '6:00', pulg: 0.3, mm: 7.6 },
    { tiempo: '8:00', pulg: 0.4, mm: 10.0 },
    { tiempo: '10:00', pulg: 0.5, mm: 13.0 },
]
const TENSION_STANDARD_FIXED_BY_TIEMPO: Record<string, number> = {
    '2:00': 1000,
    '4:00': 1500,
}
const getFixedTensionStandard = (index: number): number | undefined => {
    const tiempo = PENETRACION_BASE[index]?.tiempo
    if (!tiempo) return undefined
    return TENSION_STANDARD_FIXED_BY_TIEMPO[tiempo]
}
const toFiniteNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}
const normalizePenetracionRows = (rows: CBRLecturaPenetracionRow[] | undefined): CBRLecturaPenetracionRow[] => {
    return Array.from({ length: PENETRACION_BASE.length }, (_, idx): CBRLecturaPenetracionRow => {
        const source = rows?.[idx]
        const fixedTension = getFixedTensionStandard(idx)
        return {
            tension_standard: fixedTension,
            lectura_dial_esp_01: toFiniteNumber(source?.lectura_dial_esp_01),
            lectura_dial_esp_02: toFiniteNumber(source?.lectura_dial_esp_02),
            lectura_dial_esp_03: toFiniteNumber(source?.lectura_dial_esp_03),
        }
    })
}

const THREE_SPECIMEN_LABELS = ['Especimen N°01', 'Especimen N°02', 'Especimen N°03']
const HUMEDAD_INDEX_GROUPS = {
    sin_saturar: [0, 2, 4],
    saturado: [1, 3, 5],
} as const
const MOLD_CODE_REFERENCE: ReadonlyArray<{ codigo: string; equipo: string; label?: string }> = [
    { codigo: 'D', equipo: 'MOLDE D', label: 'INS-173 / MOLDE D' },
    { codigo: 'J', equipo: 'MOLDE J', label: 'INS-174 / MOLDE J' },
    { codigo: 'T', equipo: 'MOLDE T', label: 'INS-175 / MOLDE T' },
    { codigo: 'INS-200', equipo: 'MOLDE A' },
    { codigo: 'INS-201', equipo: 'MOLDE B' },
    { codigo: 'INS-202', equipo: 'MOLDE C' },
    { codigo: 'INS-203', equipo: 'MOLDE E' },
    { codigo: 'INS-204', equipo: 'MOLDE H' },
    { codigo: 'INS-205', equipo: 'MOLDE L' },
]
type DropdownOption = { value: string; label: string }

const CODE_DROPDOWN_OPTIONS = [
    '-',
    'INS-000',
    ...Array.from(new Set(MOLD_CODE_REFERENCE.map(({ codigo }) => codigo))),
]
const GOLPES_ALLOWED_VALUES = new Set([56, 25, 10])
const GOLPES_DROPDOWN_OPTIONS: DropdownOption[] = [
    { value: '-', label: '-' },
    { value: '56', label: '56' },
    { value: '25', label: '25' },
    { value: '10', label: '10' },
]
const CODE_LABEL_BY_VALUE: Record<string, string> = {
    '-': '-',
    'INS-000': 'INS-000',
    ...Object.fromEntries(MOLD_CODE_REFERENCE.map((item) => [
        item.codigo,
        item.label ?? `${item.codigo} / ${item.equipo}`
    ])),
}
const CODE_DROPDOWN_DISPLAY_OPTIONS: DropdownOption[] = CODE_DROPDOWN_OPTIONS.map((value) => ({
    value,
    label: CODE_LABEL_BY_VALUE[value] ?? value,
}))
const normalizeGolpesArray = (values: Array<number | null> | undefined): Array<number | null> => {
    return Array.from({ length: 3 }, (_, idx) => {
        const raw = values?.[idx]
        const parsed = Number(raw)
        return Number.isFinite(parsed) && GOLPES_ALLOWED_VALUES.has(parsed) ? parsed : null
    })
}
const isValidCodeOption = (value: string | null | undefined): value is string => {
    return typeof value === 'string' && CODE_DROPDOWN_OPTIONS.includes(value)
}
const normalizeCodeArray = (values: Array<string | null> | undefined, length: number): Array<string | null> => {
    return Array.from({ length }, (_, idx) => {
        const raw = values?.[idx]
        return isValidCodeOption(raw) ? raw : '-'
    })
}
const normalizeFreeTextArray = (values: Array<string | null> | undefined, length: number): Array<string | null> => {
    return Array.from({ length }, (_, idx) => {
        const raw = values?.[idx]
        if (typeof raw !== 'string') return null
        const normalized = raw.trim()
        return normalized === '' ? null : normalized
    })
}
const collapseSixToThree = (values: Array<number | null>): Array<number | null> => {
    return [0, 1, 2].map((specimenIdx) => {
        const base = specimenIdx * 2
        return values[base] ?? values[base + 1] ?? null
    })
}
const expandThreeToSix = (values: Array<number | null>): Array<number | null> => {
    return [0, 1, 2].flatMap((specimenIdx) => {
        const value = values[specimenIdx] ?? null
        return [value, value]
    })
}

const EMPTY_SIX_NUMBERS = () => Array.from({ length: 6 }, () => null as number | null)
const EMPTY_SIX_TEXTS = () => Array.from({ length: 6 }, () => null as string | null)
const EMPTY_THREE_NUMBERS = () => [56, 25, 10].map(v => v as number | null)
const EMPTY_THREE_STRINGS = () => ['-', '-', '-'].map(v => v as string | null)
const EMPTY_PENETRACION_ROWS = () => normalizePenetracionRows([])
const HINCHAMIENTO_ROWS = 5
const HENDIDURA_CELLS = 3
const EMPTY_HINCHAMIENTO_ROWS = () => Array.from({ length: HINCHAMIENTO_ROWS }, (): CBRHinchamientoRow => ({
    fecha: '',
    hora: '',
    esp_01: undefined,
    esp_02: undefined,
    esp_03: undefined,
}))
const EMPTY_HENDIDURA_CELLS = () => Array.from({ length: HENDIDURA_CELLS }, () => null as number | null)

const ENTER_NAV_SELECTOR = '[data-enter-nav="true"]:not([disabled])'

const getEnterNavigableFields = (): HTMLElement[] => {
    if (typeof document === 'undefined') return []
    return Array.from(document.querySelectorAll<HTMLElement>(ENTER_NAV_SELECTOR)).filter((field) => {
        if (field.tabIndex < 0) return false
        return field.getClientRects().length > 0
    })
}

const handleAdvanceOnEnter = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return

    const current = event.currentTarget
    if (current instanceof HTMLTextAreaElement) return

    const fields = getEnterNavigableFields()
    const currentIndex = fields.indexOf(current)
    if (currentIndex < 0) return

    const next = fields[currentIndex + 1]
    if (!next) return

    event.preventDefault()
    next.focus()

    if (next instanceof HTMLInputElement && next.type !== 'checkbox' && next.type !== 'radio') {
        next.select()
    }
}

const buildInitialState = (): CBRPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',

    sobretamano_porcentaje: undefined,
    masa_grava_adicionada_g: undefined,
    condicion_muestra_saturado: '-',
    condicion_muestra_sin_saturar: '-',
    maxima_densidad_seca: undefined,
    optimo_contenido_humedad: undefined,
    temperatura_inicial_c: undefined,
    temperatura_final_c: undefined,
    tamano_maximo_visual_in: '',
    descripcion_muestra_astm: '',

    golpes_por_especimen: EMPTY_THREE_NUMBERS(),
    codigo_molde_por_especimen: EMPTY_THREE_STRINGS(),
    temperatura_inicio_c_por_columna: EMPTY_SIX_NUMBERS(),
    temperatura_final_c_por_columna: EMPTY_SIX_NUMBERS(),
    masa_molde_suelo_g_por_columna: EMPTY_SIX_NUMBERS(),
    codigo_tara_por_columna: EMPTY_SIX_TEXTS(),
    masa_tara_g_por_columna: EMPTY_SIX_NUMBERS(),
    masa_suelo_humedo_tara_g_por_columna: EMPTY_SIX_NUMBERS(),
    masa_suelo_seco_tara_g_por_columna: EMPTY_SIX_NUMBERS(),
    masa_suelo_seco_tara_constante_g_por_columna: EMPTY_SIX_NUMBERS(),

    lecturas_penetracion: EMPTY_PENETRACION_ROWS(),
    hinchamiento: EMPTY_HINCHAMIENTO_ROWS(),
    profundidad_hendidura_mm_por_celda: EMPTY_HENDIDURA_CELLS(),
    profundidad_hendidura_mm: undefined,

    equipo_cbr: '-',
    equipo_dial_deformacion: '-',
    equipo_dial_expansion: '-',
    equipo_horno_110: '-',
    equipo_pison: '-',
    equipo_balanza_1g: '-',
    equipo_balanza_01g: '-',

    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

type NumericArrayKey =
    | 'golpes_por_especimen'
    | 'temperatura_inicio_c_por_columna'
    | 'temperatura_final_c_por_columna'
    | 'masa_molde_suelo_g_por_columna'
    | 'masa_tara_g_por_columna'
    | 'masa_suelo_humedo_tara_g_por_columna'
    | 'masa_suelo_seco_tara_g_por_columna'
    | 'masa_suelo_seco_tara_constante_g_por_columna'
    | 'profundidad_hendidura_mm_por_celda'

type StringArrayKey = 'codigo_molde_por_especimen' | 'codigo_tara_por_columna'
type TemperaturaSixKey = 'temperatura_inicio_c_por_columna' | 'temperatura_final_c_por_columna'
type DateFieldKey = 'fecha_ensayo' | 'revisado_fecha' | 'aprobado_fecha'
type PenetracionKey = keyof CBRLecturaPenetracionRow
type HinchamientoKey = keyof CBRHinchamientoRow
type EquipoKey =
    | 'equipo_cbr'
    | 'equipo_dial_deformacion'
    | 'equipo_dial_expansion'
    | 'equipo_horno_110'
    | 'equipo_pison'
    | 'equipo_balanza_1g'
    | 'equipo_balanza_01g'

interface HumedadResumenRow {
    muestra: string
    valor: number | null
    estado: 'Cumple' | 'No cumple' | '-'
}

const EQUIPO_OPTIONS: Record<EquipoKey, string[]> = {
    equipo_cbr: ['-', 'EQP-0026'],
    equipo_dial_deformacion: ['-', 'EQP-0109'],
    equipo_dial_expansion: ['-', 'EQP-0080'],
    equipo_horno_110: ['-', 'EQP-0150', 'EQP-0049'],
    equipo_pison: ['-', 'INS-0196'],
    equipo_balanza_1g: ['-', 'EQP-0054'],
    equipo_balanza_01g: ['-', 'EQP-0046'],
}
const REVISADO_POR_OPTIONS = ['-', 'FABIAN LA ROSA']
const APROBADO_POR_OPTIONS = ['-', 'IRMA COAQUIRA']
const CBR_DRAFT_STORAGE_PREFIX = 'cbr_form_draft_v1'
const DRAFT_DEBOUNCE_MS = 700
const STICKY_LABEL_WIDTH_CLASS = "w-[320px] min-w-[320px] max-w-[320px]"
const STICKY_LABEL_TH_CLASS = "sticky left-0 z-50 bg-muted relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.45)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"
const STICKY_LABEL_TD_CLASS = "sticky left-0 z-40 bg-background relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.35)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"
const PEN_STICKY_TIME_WIDTH_CLASS = "w-[88px] min-w-[88px] max-w-[88px]"
const PEN_STICKY_IN_WIDTH_CLASS = "w-[160px] min-w-[160px] max-w-[160px]"
const PEN_STICKY_MM_WIDTH_CLASS = "w-[180px] min-w-[180px] max-w-[180px]"
const PEN_STICKY_TIME_TH_CLASS = "sticky left-0 z-40 bg-muted/40"
const PEN_STICKY_IN_TH_CLASS = "sticky left-[88px] z-40 bg-muted/40"
const PEN_STICKY_MM_TH_CLASS = "sticky left-[248px] z-40 bg-muted/40 relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.35)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"
const PEN_STICKY_TIME_TD_CLASS = "sticky left-0 z-30 bg-muted/20"
const PEN_STICKY_IN_TD_CLASS = "sticky left-[88px] z-30 bg-muted/20"
const PEN_STICKY_MM_TD_CLASS = "sticky left-[248px] z-30 bg-muted/20 relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.25)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-border"

const getDraftStorageKey = (ensayoId: number | null): string => {
    return `${CBR_DRAFT_STORAGE_PREFIX}:${ensayoId ?? 'new'}`
}

const normalizeNullableNumberArray = (
    values: Array<number | null> | undefined,
    length: number,
): Array<number | null> => {
    return Array.from({ length }, (_, idx) => {
        const normalized = toFiniteNumber(values?.[idx])
        return normalized ?? null
    })
}

const normalizeHinchamientoRows = (rows: CBRHinchamientoRow[] | undefined): CBRHinchamientoRow[] => {
    return Array.from({ length: HINCHAMIENTO_ROWS }, (_, idx): CBRHinchamientoRow => {
        const source = rows?.[idx]
        return {
            fecha: typeof source?.fecha === 'string' ? source.fecha : '',
            hora: typeof source?.hora === 'string' ? source.hora : '',
            esp_01: toFiniteNumber(source?.esp_01),
            esp_02: toFiniteNumber(source?.esp_02),
            esp_03: toFiniteNumber(source?.esp_03),
        }
    })
}

const hydrateCBRFormSnapshot = (payload?: Partial<CBRPayload> | null): CBRPayload => {
    const merged: CBRPayload = { ...buildInitialState(), ...(payload ?? {}) }
    merged.golpes_por_especimen = normalizeGolpesArray(merged.golpes_por_especimen)
    merged.codigo_molde_por_especimen = normalizeCodeArray(merged.codigo_molde_por_especimen, 3)
    merged.codigo_tara_por_columna = normalizeFreeTextArray(merged.codigo_tara_por_columna, 6)
    merged.temperatura_inicio_c_por_columna = normalizeNullableNumberArray(merged.temperatura_inicio_c_por_columna, 6)
    merged.temperatura_final_c_por_columna = normalizeNullableNumberArray(merged.temperatura_final_c_por_columna, 6)
    merged.masa_molde_suelo_g_por_columna = normalizeNullableNumberArray(merged.masa_molde_suelo_g_por_columna, 6)
    merged.masa_tara_g_por_columna = normalizeNullableNumberArray(merged.masa_tara_g_por_columna, 6)
    merged.masa_suelo_humedo_tara_g_por_columna = normalizeNullableNumberArray(merged.masa_suelo_humedo_tara_g_por_columna, 6)
    merged.masa_suelo_seco_tara_g_por_columna = normalizeNullableNumberArray(merged.masa_suelo_seco_tara_g_por_columna, 6)
    merged.masa_suelo_seco_tara_constante_g_por_columna = normalizeNullableNumberArray(merged.masa_suelo_seco_tara_constante_g_por_columna, 6)
    merged.lecturas_penetracion = normalizePenetracionRows(merged.lecturas_penetracion)
    merged.hinchamiento = normalizeHinchamientoRows(merged.hinchamiento)
    merged.profundidad_hendidura_mm_por_celda = normalizeNullableNumberArray(
        merged.profundidad_hendidura_mm_por_celda,
        HENDIDURA_CELLS,
    )
    const allHendiduraEmpty = merged.profundidad_hendidura_mm_por_celda.every(value => value == null)
    if (
        merged.profundidad_hendidura_mm != null
        && allHendiduraEmpty
    ) {
        merged.profundidad_hendidura_mm_por_celda[0] = merged.profundidad_hendidura_mm
    }
    merged.profundidad_hendidura_mm = merged.profundidad_hendidura_mm_por_celda[0] ?? undefined
    return merged
}

interface CBRDraftSnapshot {
    version: number
    updatedAt: string
    form: Partial<CBRPayload>
}

const areCBRFormsEquivalent = (left: CBRPayload, right: CBRPayload): boolean => {
    return JSON.stringify(left) === JSON.stringify(right)
}

const isCBRFormAtInitialState = (form: CBRPayload): boolean => {
    return areCBRFormsEquivalent(form, buildInitialState())
}

const getEnsayoIdFromQuery = (): number | null => {
    const raw = new URLSearchParams(window.location.search).get('ensayo_id')
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export default function CBRForm({
    editId,
    onClose,
    onSaveSuccess,
}: {
    editId?: number
    onClose?: () => void
    onSaveSuccess?: () => void
}) {
    const [form, setForm] = useState<CBRPayload>(() => buildInitialState())
    const [loading, setLoading] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [showDraftBanner, setShowDraftBanner] = useState(false)
    const [draftData, setDraftData] = useState<CBRPayload | null>(null)
    const draftStorageKey = useMemo(() => getDraftStorageKey(editingEnsayoId), [editingEnsayoId])
    const hydratedFromServerRef = useRef<CBRPayload | null>(null)
    const restoredDraftKeysRef = useRef<Set<string>>(new Set())

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
        set('muestra', newCode)
    }

    const handleTypeToggle = (newType: 'SU' | 'AG') => {
        setMuestraType(newType)
        const { number, year } = parseMuestraCode(muestraInput, newType)
        const nextYear = year || muestraYear || new Date().getFullYear().toString().slice(-2)
        setMuestraYear(nextYear)
        const newCode = buildMuestraCode(number, newType, nextYear)
        set('muestra', newCode)
    }

    const handleYearChange = (rawYear: string) => {
        const digits = rawYear.replace(/\D/g, '').slice(-2)
        setMuestraYear(digits)
        const { number } = parseMuestraCode(muestraInput, muestraType)
        const nextYear = digits ? (digits.length === 1 ? `0${digits}` : digits) : new Date().getFullYear().toString().slice(-2)
        const newCode = buildMuestraCode(number, muestraType, nextYear)
        set('muestra', newCode)
    }

    const handleYearBlur = () => {
        const digits = muestraYear.replace(/\D/g, '').slice(-2)
        const nextYear = digits ? (digits.length === 1 ? `0${digits}` : digits) : new Date().getFullYear().toString().slice(-2)
        setMuestraYear(nextYear)
        const { number } = parseMuestraCode(muestraInput, muestraType)
        const newCode = buildMuestraCode(number, muestraType, nextYear)
        set('muestra', newCode)
    }

    const set = useCallback(<K extends keyof CBRPayload>(key: K, value: CBRPayload[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }, [])

    const [importLoading, setImportLoading] = useState(false)

    const handleImportFromReception = useCallback(async () => {
        const fullCode = buildMuestraCode(muestraInput, muestraType, muestraYear)
        if (!fullCode || fullCode.trim() === '-') return

        setImportLoading(true)
        try {
            const url = `${API_URL}/api/verificacion/buscar-recepcion?numero=${encodeURIComponent(fullCode)}`
            const res = await authFetch(url)
            if (!res.ok) throw new Error('No se encontró el registro')
            const data = await res.json()
            if (data.encontrado && data.datos) {
                if (data.datos.numero_ot) {
                    set('numero_ot', data.datos.numero_ot)
                }
                const sampleLem = fullCode.trim().toUpperCase()
                const matchingSample = data.datos.muestras?.find((m: any) => {
                    const mCode = (m.codigo_muestra_lem || m.codigo_muestra || '').trim().toUpperCase()
                    return mCode && (mCode === sampleLem || mCode.includes(muestraInput))
                })
                if (matchingSample?.identificacion_muestra) {
                    set('descripcion_muestra_astm', matchingSample.identificacion_muestra)
                }
                toast.success('Datos importados correctamente')
            } else {
                toast.error('No se encontró información para esta muestra')
            }
        } catch (err) {
            console.error(err)
            toast.error('Error al importar datos de la muestra')
        } finally {
            setImportLoading(false)
        }
    }, [muestraInput, muestraType, muestraYear, set])

    const setNum = useCallback((key: keyof CBRPayload, raw: string) => {
        const val = raw === '' ? undefined : parseFloat(raw)
        setForm(prev => ({ ...prev, [key]: val }))
    }, [])

    const setArrayNum = useCallback((key: NumericArrayKey, index: number, raw: string) => {
        const val = raw === '' ? null : parseFloat(raw)
        setForm(prev => {
            const next = [...prev[key]]
            next[index] = Number.isFinite(val as number) ? (val as number) : null
            return { ...prev, [key]: next }
        })
    }, [])

    const setArrayText = useCallback((key: StringArrayKey, index: number, raw: string) => {
        const val = raw.trim() === '' ? null : raw
        setForm(prev => {
            const next = [...prev[key]]
            next[index] = val
            return { ...prev, [key]: next }
        })
    }, [])

    const setTemperaturaPorEspecimen = useCallback((key: TemperaturaSixKey, specimenIndex: number, raw: string) => {
        const parsed = raw === '' ? null : parseFloat(raw)
        const value = Number.isFinite(parsed as number) ? (parsed as number) : null
        setForm(prev => {
            const next = [...prev[key]]
            const base = specimenIndex * 2
            next[base] = value
            next[base + 1] = value
            return { ...prev, [key]: next }
        })
    }, [])

    const setPenetracion = useCallback((index: number, field: PenetracionKey, raw: string) => {
        setForm(prev => {
            const nextRows = [...prev.lecturas_penetracion]
            const row = { ...nextRows[index] }
            if (field === 'tension_standard') {
                const fixedValue = getFixedTensionStandard(index)
                if (fixedValue !== undefined) {
                    row[field] = fixedValue
                } else {
                    const numericVal = raw === '' ? undefined : parseFloat(raw)
                    row[field] = Number.isFinite(numericVal as number) ? (numericVal as number) : undefined
                }
            } else {
                const numericVal = raw === '' ? undefined : parseFloat(raw)
                row[field] = Number.isFinite(numericVal as number) ? (numericVal as number) : undefined
            }
            nextRows[index] = row
            return { ...prev, lecturas_penetracion: nextRows }
        })
    }, [])

    const setHinchamiento = useCallback((index: number, field: HinchamientoKey, raw: string) => {
        setForm(prev => {
            const nextRows = [...prev.hinchamiento]
            const row = { ...nextRows[index] }

            if (field === 'fecha' || field === 'hora') {
                row[field] = raw
            } else {
                const numericVal = raw === '' ? undefined : parseFloat(raw)
                row[field] = Number.isFinite(numericVal as number) ? (numericVal as number) : undefined
            }

            nextRows[index] = row
            return { ...prev, hinchamiento: nextRows }
        })
    }, [])

    const applyFormattedField = useCallback((key: DateFieldKey, formatter: (raw: string) => string) => {
        setForm(prev => {
            const current = String(prev[key] ?? '')
            const formatted = formatter(current)
            if (formatted === current) return prev
            return { ...prev, [key]: formatted }
        })
    }, [])

    const masaSueloHumedoPorColumna = useMemo(() => {
        return form.masa_suelo_humedo_tara_g_por_columna.map((humedoTara, idx) => {
            const tara = form.masa_tara_g_por_columna[idx]
            if (humedoTara == null || tara == null) return null
            return Math.round((humedoTara - tara) * 100) / 100
        })
    }, [form.masa_suelo_humedo_tara_g_por_columna, form.masa_tara_g_por_columna])

    const temperaturaInicioPorEspecimen = useMemo(
        () => collapseSixToThree(form.temperatura_inicio_c_por_columna),
        [form.temperatura_inicio_c_por_columna],
    )
    const temperaturaFinalPorEspecimen = useMemo(
        () => collapseSixToThree(form.temperatura_final_c_por_columna),
        [form.temperatura_final_c_por_columna],
    )

    const humedadResumen = useMemo(() => {
        const calculateHumedad = (index: number): number | null => {
            const masaHumeda = masaSueloHumedoPorColumna[index]
            const masaSecaTaraConstante = form.masa_suelo_seco_tara_constante_g_por_columna[index]
            const tara = form.masa_tara_g_por_columna[index]

            if (masaHumeda == null || masaSecaTaraConstante == null || tara == null) return null

            // Replica la formula del template Excel (S30:S36): (col32 - (col34 - col30)) / (col34 - col30) * 100
            const masaSeca = masaSecaTaraConstante - tara
            if (!Number.isFinite(masaSeca) || masaSeca === 0) return null

            const humedad = ((masaHumeda - masaSeca) / masaSeca) * 100
            return Math.round(humedad * 100) / 100
        }

        const buildRows = (indexes: readonly number[]): HumedadResumenRow[] => {
            return indexes.map((index, rowIdx) => {
                const valor = calculateHumedad(index)
                const estado: HumedadResumenRow['estado'] =
                    valor == null
                        ? '-'
                        : form.optimo_contenido_humedad == null
                            ? '-'
                            : Math.abs(valor - form.optimo_contenido_humedad) <= 2
                                ? 'Cumple'
                                : 'No cumple'
                return {
                    muestra: `Especimen N°${String(rowIdx + 1).padStart(2, '0')}`,
                    valor,
                    estado,
                }
            })
        }

        return {
            sin_saturar: buildRows(HUMEDAD_INDEX_GROUPS.sin_saturar),
            saturado: buildRows(HUMEDAD_INDEX_GROUPS.saturado),
        }
    }, [
        masaSueloHumedoPorColumna,
        form.masa_suelo_seco_tara_constante_g_por_columna,
        form.masa_tara_g_por_columna,
        form.optimo_contenido_humedad,
    ])

    useEffect(() => {
        if (!editingEnsayoId) return

        let cancelled = false
        const loadForEdit = async () => {
            setLoadingEnsayo(true)
            try {
                const detail: CBREnsayoDetail = await getCBREnsayoDetail(editingEnsayoId)
                if (!detail.payload) {
                    toast.error('El ensayo seleccionado no tiene payload guardado para edicion.')
                    return
                }
                if (!cancelled) {
                    const nextState = hydrateCBRFormSnapshot(detail.payload)
                    hydratedFromServerRef.current = nextState

                    // Compare with local draft
                    const rawDraft = localStorage.getItem(draftStorageKey)
                    if (rawDraft) {
                        try {
                            const parsed = JSON.parse(rawDraft) as CBRDraftSnapshot
                            if (parsed && typeof parsed === 'object' && typeof parsed.form === 'object') {
                                const draftState = hydrateCBRFormSnapshot(parsed.form)
                                if (!areCBRFormsEquivalent(draftState, nextState)) {
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

                    setForm(nextState)
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Error desconocido'
                toast.error(`No se pudo cargar ensayo para edicion: ${msg}`)
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
            const parsed = JSON.parse(raw) as CBRDraftSnapshot
            if (!parsed || typeof parsed !== 'object' || typeof parsed.form !== 'object') {
                localStorage.removeItem(draftStorageKey)
                return
            }

            const hydratedDraft = hydrateCBRFormSnapshot(parsed.form)
            setForm(hydratedDraft)
            toast.success('Se restauró un borrador local de CBR.', { duration: 2500 })
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
                areCBRFormsEquivalent(form, hydratedFromServerRef.current)
            )

            if (isCBRFormAtInitialState(form) || sameAsServer) {
                localStorage.removeItem(draftStorageKey)
                return
            }

            const snapshot: CBRDraftSnapshot = {
                version: 1,
                updatedAt: new Date().toISOString(),
                form,
            }
            localStorage.setItem(draftStorageKey, JSON.stringify(snapshot))
        }, DRAFT_DEBOUNCE_MS)

        return () => window.clearTimeout(timeoutId)
    }, [draftStorageKey, editingEnsayoId, form, loadingEnsayo])

    const downloadBlob = useCallback((blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }, [])

    const closeParentModalIfEmbedded = useCallback(() => {
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
        }
    }, [])
    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)


    const handleSave = useCallback(async (withDownload: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) {
            toast.error('Complete los campos obligatorios: Codigo de muestra, N OT y Realizado por')
            return
        }

        setLoading(true)
        try {
            const profundidadHendiduraPorCelda = normalizeNullableNumberArray(
                form.profundidad_hendidura_mm_por_celda,
                HENDIDURA_CELLS,
            )
            const payload: CBRPayload = {
                ...form,
                temperatura_inicio_c_por_columna: expandThreeToSix(temperaturaInicioPorEspecimen),
                temperatura_final_c_por_columna: expandThreeToSix(temperaturaFinalPorEspecimen),
                lecturas_penetracion: normalizePenetracionRows(form.lecturas_penetracion),
                hinchamiento: normalizeHinchamientoRows(form.hinchamiento),
                profundidad_hendidura_mm_por_celda: profundidadHendiduraPorCelda,
                profundidad_hendidura_mm: profundidadHendiduraPorCelda[0] ?? undefined,
            }
            if (withDownload) {
                const { blob, filename } = await saveAndDownloadCBRExcel(payload, editingEnsayoId ?? undefined)
                downloadBlob(blob, filename || `${buildFormatPreview(form.muestra, muestraType, 'CBR')}.xlsx`)
                toast.success(editingEnsayoId ? 'Formato CBR actualizado y descargado.' : 'Formato CBR guardado y descargado.')
            } else {
                await saveCBREnsayo(payload, editingEnsayoId ?? undefined)
                toast.success(editingEnsayoId ? 'Formato CBR actualizado correctamente.' : 'Formato CBR guardado correctamente.')
            }

            localStorage.removeItem(draftStorageKey)
            setForm(buildInitialState())
            setEditingEnsayoId(null)
            if (onSaveSuccess) {
                onSaveSuccess()
            } else {
                closeParentModalIfEmbedded()
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido'
            toast.error(`Error guardando formato CBR: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [closeParentModalIfEmbedded, downloadBlob, draftStorageKey, editingEnsayoId, form, muestraType])

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Gauge className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            California Bearing Ratio (CBR) - ASTM D1883-21
                        </h1>
                        <p className="text-sm text-muted-foreground">Generador de informe de laboratorio</p>
                        {editingEnsayoId && (
                            <p className="text-xs text-primary font-medium mt-1">Editando ensayo #{editingEnsayoId}</p>
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
                    Cargando datos guardados para edicion...
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-5">
                <Section title="Encabezado" icon={<FlaskConical className="h-4 w-4" />}>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-muted-foreground mb-1">Codigo de muestra *</label>
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
                                        className="h-7 w-[88px] rounded-md border-0 bg-transparent px-2 text-xs font-bold uppercase text-slate-700 focus:outline-none focus:ring-0"
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
                                        className="h-7 w-[48px] rounded-md border-0 bg-transparent px-2 text-center text-xs font-bold text-slate-700 focus:outline-none focus:ring-0"
                                    />
                                </div>
                            </div>
                            {muestraInput && (
                                <button
                                    type="button"
                                    onClick={handleImportFromReception}
                                    disabled={importLoading}
                                    className="mt-1.5 flex items-center justify-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black rounded border border-blue-100 hover:bg-blue-100 transition-all shadow-sm"
                                >
                                    {importLoading ? 'IMPORTANDO...' : 'IMPORTAR DATOS'}
                                </button>
                            )}
                        </div>
                        <Input
                            label="N OT *"
                            value={form.numero_ot}
                            onChange={v => set('numero_ot', v)}
                            onBlur={() => set('numero_ot', normalizeNumeroOtCode(form.numero_ot))}
                            placeholder="XXX-26"
                        />
                        <Input
                            label="Fecha de ensayo"
                            value={form.fecha_ensayo}
                            onChange={v => set('fecha_ensayo', v)}
                            onBlur={() => applyFormattedField('fecha_ensayo', normalizeFlexibleDate)}
                            placeholder="YYYY/MM/DD"
                        />
                        <Input
                            label="Realizado por *"
                            value={form.realizado_por}
                            onChange={v => set('realizado_por', v)}
                        />
                    </div>
                </Section>

                <Section title="Condiciones del Ensayo CBR">
                    <div className="space-y-3">
                        <ConditionRow label="Sobretamano mayor a 3/4 in (%)">
                            <ConditionNumberInput
                                value={form.sobretamano_porcentaje}
                                onChange={v => setNum('sobretamano_porcentaje', v)}
                            />
                        </ConditionRow>
                        <ConditionRow label="Masa de grava entre 3/4 in - No.4 adicionada (g)">
                            <ConditionNumberInput
                                value={form.masa_grava_adicionada_g}
                                onChange={v => setNum('masa_grava_adicionada_g', v)}
                            />
                        </ConditionRow>
                        <ConditionRow label="Maxima Densidad Seca (g/cm3)">
                            <ConditionNumberInput
                                value={form.maxima_densidad_seca}
                                onChange={v => setNum('maxima_densidad_seca', v)}
                            />
                        </ConditionRow>
                        <ConditionRow label="Optimo Contenido de Humedad (%)">
                            <ConditionNumberInput
                                value={form.optimo_contenido_humedad}
                                onChange={v => setNum('optimo_contenido_humedad', v)}
                            />
                        </ConditionRow>
                        <ConditionRow label="Condicion de la muestra - saturado (Si/No)">
                            <ConditionSelectInput
                                value={form.condicion_muestra_saturado}
                                options={['-', 'SI', 'NO']}
                                onChange={v => set('condicion_muestra_saturado', v as '-' | 'SI' | 'NO')}
                            />
                        </ConditionRow>
                        <ConditionRow label="Condicion de la muestra - sin saturar (Si/No)">
                            <ConditionSelectInput
                                value={form.condicion_muestra_sin_saturar}
                                options={['-', 'SI', 'NO']}
                                onChange={v => set('condicion_muestra_sin_saturar', v as '-' | 'SI' | 'NO')}
                            />
                        </ConditionRow>
                        <ConditionRow label="Temperatura Inicial (°C) (18-24°C)">
                            <ConditionNumberInput
                                value={form.temperatura_inicial_c}
                                onChange={v => setNum('temperatura_inicial_c', v)}
                            />
                        </ConditionRow>
                        <ConditionRow label="Temperatura Final (°C) (18-24°C)">
                            <ConditionNumberInput
                                value={form.temperatura_final_c}
                                onChange={v => setNum('temperatura_final_c', v)}
                            />
                        </ConditionRow>
                        <ConditionRow label="Tamano maximo visual (in)">
                            <ConditionTextInput
                                value={form.tamano_maximo_visual_in || ''}
                                onChange={v => set('tamano_maximo_visual_in', v)}
                            />
                        </ConditionRow>
                        <ConditionRow label="Descripcion de muestra ASTM D2488">
                            <ConditionTextInput
                                value={form.descripcion_muestra_astm || ''}
                                onChange={v => set('descripcion_muestra_astm', v)}
                            />
                        </ConditionRow>
                    </div>
                </Section>

                <Section title="Ensayo y Determinacion de Humedad">
                    <div className="overflow-x-auto rounded-md border border-border relative">
                        <table className="w-full min-w-[1200px] table-fixed text-sm">
                            <thead className="bg-muted/40">
                                <tr>
                                    <th className={`${STICKY_LABEL_WIDTH_CLASS} px-3 py-1.5 text-center border-b border-r border-border font-semibold uppercase ${STICKY_LABEL_TH_CLASS}`}>
                                        Ensayo
                                    </th>
                                    {THREE_SPECIMEN_LABELS.map((label) => (
                                        <th key={`${label}-group`} colSpan={2} className="px-2 py-1.5 text-center border-b border-r border-border">
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    <th className={`${STICKY_LABEL_WIDTH_CLASS} px-3 py-1.5 text-center border-b border-r border-border font-semibold uppercase ${STICKY_LABEL_TH_CLASS}`}>
                                        Condicion
                                    </th>
                                    {THREE_SPECIMEN_LABELS.flatMap((label) => [
                                        <th key={`${label}-sin-saturar`} className="px-2 py-1.5 text-center border-b border-r border-border">
                                            Sin Saturar
                                        </th>,
                                        <th key={`${label}-saturado`} className="px-2 py-1.5 text-center border-b border-r border-border">
                                            Saturado
                                        </th>,
                                    ])}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className={`px-3 py-1 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS} ${STICKY_LABEL_TD_CLASS}`}>N Golpes (56-25-10)</td>
                                    {form.golpes_por_especimen.map((value, idx) => (
                                        <td key={`golpes-${idx}`} colSpan={2} className="px-2 py-1 border-r border-b border-border">
                                            <TableSelectInputCompact
                                                value={value == null ? '-' : String(value)}
                                                options={GOLPES_DROPDOWN_OPTIONS}
                                                onChange={v => setArrayNum('golpes_por_especimen', idx, v)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={`px-3 py-1 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS} ${STICKY_LABEL_TD_CLASS}`}>Codigo de Moldes</td>
                                    {form.codigo_molde_por_especimen.map((value, idx) => (
                                        <td key={`molde-${idx}`} colSpan={2} className="px-2 py-1 border-r border-b border-border">
                                            <TableSelectInputCompact
                                                value={value || '-'}
                                                options={CODE_DROPDOWN_DISPLAY_OPTIONS}
                                                onChange={v => setArrayText('codigo_molde_por_especimen', idx, v)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={`px-3 py-1 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS} ${STICKY_LABEL_TD_CLASS}`}>Temperatura de inicio (°C) (18-24°C)</td>
                                    {temperaturaInicioPorEspecimen.map((value, idx) => (
                                        <td key={`temp-inicio-${idx}`} colSpan={2} className="px-2 py-1 border-r border-b border-border">
                                            <TableNumInputCompact
                                                value={value}
                                                onChange={raw => setTemperaturaPorEspecimen('temperatura_inicio_c_por_columna', idx, raw)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                                <tr>
                                    <td className={`px-3 py-1 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS} ${STICKY_LABEL_TD_CLASS}`}>Temperatura final (°C) (18-24°C)</td>
                                    {temperaturaFinalPorEspecimen.map((value, idx) => (
                                        <td key={`temp-final-${idx}`} colSpan={2} className="px-2 py-1 border-r border-b border-border">
                                            <TableNumInputCompact
                                                value={value}
                                                onChange={raw => setTemperaturaPorEspecimen('temperatura_final_c_por_columna', idx, raw)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                                <ArrayNumberRow
                                    label="Masa de molde + suelo moldeado (g)"
                                    values={form.masa_molde_suelo_g_por_columna}
                                    compact
                                    stickyLabel
                                    onChange={(idx, raw) => setArrayNum('masa_molde_suelo_g_por_columna', idx, raw)}
                                />
                                <tr>
                                    <td
                                        className={`px-3 py-1.5 border-b border-r border-border bg-muted/30 text-left font-semibold uppercase tracking-wide ${STICKY_LABEL_WIDTH_CLASS} ${STICKY_LABEL_TD_CLASS}`}
                                    >
                                        Determinacion de Humedad
                                    </td>
                                    <td colSpan={6} className="px-2 py-1.5 border-b border-border bg-muted/30" />
                                </tr>
                                <ArrayTextRow
                                    label="Codigo tara"
                                    values={form.codigo_tara_por_columna}
                                    compact
                                    stickyLabel
                                    onChange={(idx, raw) => setArrayText('codigo_tara_por_columna', idx, raw)}
                                />
                                <ArrayNumberRow
                                    label="Masa de tara (g)"
                                    values={form.masa_tara_g_por_columna}
                                    compact
                                    stickyLabel
                                    onChange={(idx, raw) => setArrayNum('masa_tara_g_por_columna', idx, raw)}
                                />
                                <ArrayNumberRow
                                    label="Masa de suelo humedo + tara (g)"
                                    values={form.masa_suelo_humedo_tara_g_por_columna}
                                    compact
                                    stickyLabel
                                    onChange={(idx, raw) => setArrayNum('masa_suelo_humedo_tara_g_por_columna', idx, raw)}
                                />
                                <tr>
                                    <td className={`px-3 py-1 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS} ${STICKY_LABEL_TD_CLASS}`}>Masa de suelo humedo (g) (*)</td>
                                    {masaSueloHumedoPorColumna.map((value, idx) => (
                                        <td
                                            key={`calc-32-${idx}`}
                                            className={`px-2 py-1 border-b border-border ${idx < masaSueloHumedoPorColumna.length - 1 ? 'border-r' : ''}`}
                                        >
                                            <TableComputedValueCompact value={value} />
                                        </td>
                                    ))}
                                </tr>
                                <ArrayNumberRow
                                    label="Masa de suelo seco + tara (g)"
                                    values={form.masa_suelo_seco_tara_g_por_columna}
                                    compact
                                    stickyLabel
                                    onChange={(idx, raw) => setArrayNum('masa_suelo_seco_tara_g_por_columna', idx, raw)}
                                />
                                <ArrayNumberRow
                                    label="Masa de suelo seco + tara (g) constante"
                                    values={form.masa_suelo_seco_tara_constante_g_por_columna}
                                    compact
                                    stickyLabel
                                    onChange={(idx, raw) => setArrayNum('masa_suelo_seco_tara_constante_g_por_columna', idx, raw)}
                                />
                            </tbody>
                        </table>
                    </div>
                </Section>

                <Section title="Lectura de Penetracion">
                    <div className="overflow-x-auto rounded-md border border-border">
                        <table className="w-full min-w-[1100px] table-fixed text-sm">
                            <thead className="bg-muted/40">
                                <tr>
                                    <th className={`px-2 py-1.5 border-b border-r border-border text-center ${PEN_STICKY_TIME_WIDTH_CLASS} ${PEN_STICKY_TIME_TH_CLASS}`}>Tiempo</th>
                                    <th className={`px-2 py-1.5 border-b border-r border-border text-center ${PEN_STICKY_IN_WIDTH_CLASS} ${PEN_STICKY_IN_TH_CLASS}`}>Penetracion (in)</th>
                                    <th className={`px-2 py-1.5 border-b border-r border-border text-center ${PEN_STICKY_MM_WIDTH_CLASS} ${PEN_STICKY_MM_TH_CLASS}`}>Penetracion (mm)</th>
                                    <th className="px-2 py-1.5 border-b border-r border-border text-center">Tension estandar</th>
                                    <th className="px-2 py-1.5 border-b border-r border-border text-center">Dial Especimen N°01</th>
                                    <th className="px-2 py-1.5 border-b border-r border-border text-center">Dial Especimen N°02</th>
                                    <th className="px-2 py-1.5 border-b border-border text-center">Dial Especimen N°03</th>
                                </tr>
                            </thead>
                            <tbody>
                                {PENETRACION_BASE.map((base, idx) => (
                                    <tr key={base.tiempo}>
                                        <td className={`px-2 py-1 border-b border-r border-border text-center ${PEN_STICKY_TIME_WIDTH_CLASS} ${PEN_STICKY_TIME_TD_CLASS}`}>{base.tiempo}</td>
                                        <td className={`px-2 py-1 border-b border-r border-border text-center ${PEN_STICKY_IN_WIDTH_CLASS} ${PEN_STICKY_IN_TD_CLASS}`}>{base.pulg.toFixed(3)}</td>
                                        <td className={`px-2 py-1 border-b border-r border-border text-center ${PEN_STICKY_MM_WIDTH_CLASS} ${PEN_STICKY_MM_TD_CLASS}`}>{base.mm.toFixed(2)}</td>
                                        <td className="px-2 py-1 border-b border-r border-border">
                                            <TableFixedValueCompact value={getFixedTensionStandard(idx)} />
                                        </td>
                                        <td className="px-2 py-1 border-b border-r border-border">
                                            <TableNumInputCompact value={form.lecturas_penetracion[idx]?.lectura_dial_esp_01} onChange={v => setPenetracion(idx, 'lectura_dial_esp_01', v)} />
                                        </td>
                                        <td className="px-2 py-1 border-b border-r border-border">
                                            <TableNumInputCompact value={form.lecturas_penetracion[idx]?.lectura_dial_esp_02} onChange={v => setPenetracion(idx, 'lectura_dial_esp_02', v)} />
                                        </td>
                                        <td className="px-2 py-1 border-b border-border">
                                            <TableNumInputCompact value={form.lecturas_penetracion[idx]?.lectura_dial_esp_03} onChange={v => setPenetracion(idx, 'lectura_dial_esp_03', v)} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-3">
                        <p className="text-sm font-medium text-foreground mb-2">Profundidad de la hendidura (mm)</p>
                        <div className="overflow-x-auto rounded-md border border-border max-w-3xl">
                            <table className="w-full min-w-[620px] text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        <th className="px-2 py-1.5 border-b border-r border-border text-center">Especimen N°01</th>
                                        <th className="px-2 py-1.5 border-b border-r border-border text-center">Especimen N°02</th>
                                        <th className="px-2 py-1.5 border-b border-border text-center">Especimen N°03</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        {Array.from({ length: HENDIDURA_CELLS }, (_, idx) => (
                                            <td key={`hendidura-${idx}`} className={`px-2 py-1 border-b border-border ${idx < HENDIDURA_CELLS - 1 ? 'border-r' : ''}`}>
                                                <TableNumInputCompact
                                                    value={form.profundidad_hendidura_mm_por_celda[idx] ?? undefined}
                                                    onChange={v => setArrayNum('profundidad_hendidura_mm_por_celda', idx, v)}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Section>

                <Section title="Hinchamiento / Equipos">
                    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,0.95fr)] gap-4">
                        <div className="rounded-md border border-border bg-background p-3">
                            <h3 className="text-xs font-semibold text-foreground mb-2">Hinchamiento</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[520px] table-fixed text-sm">
                                    <thead className="bg-muted/40">
                                        <tr>
                                            <th rowSpan={2} className="w-[88px] px-2 py-1.5 border-b border-r border-border text-center">Fecha</th>
                                            <th rowSpan={2} className="w-[88px] px-2 py-1.5 border-b border-r border-border text-center">Hora</th>
                                            <th colSpan={3} className="px-2 py-1.5 border-b border-border text-center">Expansión (mm)</th>
                                        </tr>
                                        <tr>
                                            <th className="w-[102px] px-2 py-1.5 border-b border-r border-border text-center">Esp. N°01</th>
                                            <th className="w-[102px] px-2 py-1.5 border-b border-r border-border text-center">Esp. N°02</th>
                                            <th className="w-[102px] px-2 py-1.5 border-b border-border text-center">Esp. N°03</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from({ length: HINCHAMIENTO_ROWS }, (_, idx) => (
                                            <tr key={`hinch-${idx}`}>
                                                <td className="px-2 py-1 border-b border-r border-border">
                                                    <TableTextInputCompact
                                                        value={form.hinchamiento[idx]?.fecha || ''}
                                                        onChange={v => setHinchamiento(idx, 'fecha', v)}
                                                        onBlur={() => setHinchamiento(idx, 'fecha', normalizeFlexibleDate(form.hinchamiento[idx]?.fecha || ''))}
                                                        placeholder="YYYY/MM/DD"
                                                    />
                                                </td>
                                                <td className="px-2 py-1 border-b border-r border-border">
                                                    <TableTextInputCompact
                                                        value={form.hinchamiento[idx]?.hora || ''}
                                                        onChange={v => setHinchamiento(idx, 'hora', v)}
                                                        onBlur={() => setHinchamiento(idx, 'hora', normalizeTime(form.hinchamiento[idx]?.hora || ''))}
                                                        placeholder="00:00:00"
                                                    />
                                                </td>
                                                <td className="px-2 py-1 border-b border-r border-border">
                                                    <TableNumInputCompact value={form.hinchamiento[idx]?.esp_01} onChange={v => setHinchamiento(idx, 'esp_01', v)} />
                                                </td>
                                                <td className="px-2 py-1 border-b border-r border-border">
                                                    <TableNumInputCompact value={form.hinchamiento[idx]?.esp_02} onChange={v => setHinchamiento(idx, 'esp_02', v)} />
                                                </td>
                                                <td className="px-2 py-1 border-b border-border">
                                                    <TableNumInputCompact value={form.hinchamiento[idx]?.esp_03} onChange={v => setHinchamiento(idx, 'esp_03', v)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-md border border-border bg-background p-3">
                            <h3 className="text-xs font-semibold text-foreground mb-2">Equipos</h3>
                            <div className="space-y-2">
                                <EquipmentSelect
                                    label="Equipo CBR"
                                    value={form.equipo_cbr || '-'}
                                    options={EQUIPO_OPTIONS.equipo_cbr}
                                    onChange={v => set('equipo_cbr', v)}
                                />
                                <EquipmentSelect
                                    label="Dial deformacion"
                                    value={form.equipo_dial_deformacion || '-'}
                                    options={EQUIPO_OPTIONS.equipo_dial_deformacion}
                                    onChange={v => set('equipo_dial_deformacion', v)}
                                />
                                <EquipmentSelect
                                    label="Dial expansion"
                                    value={form.equipo_dial_expansion || '-'}
                                    options={EQUIPO_OPTIONS.equipo_dial_expansion}
                                    onChange={v => set('equipo_dial_expansion', v)}
                                />
                                <EquipmentSelect
                                    label="Horno 110 C"
                                    value={form.equipo_horno_110 || '-'}
                                    options={EQUIPO_OPTIONS.equipo_horno_110}
                                    onChange={v => set('equipo_horno_110', v)}
                                />
                                <EquipmentSelect
                                    label="Pison"
                                    value={form.equipo_pison || '-'}
                                    options={EQUIPO_OPTIONS.equipo_pison}
                                    onChange={v => set('equipo_pison', v)}
                                />
                                <EquipmentSelect
                                    label="Balanza 1 g"
                                    value={form.equipo_balanza_1g || '-'}
                                    options={EQUIPO_OPTIONS.equipo_balanza_1g}
                                    onChange={v => set('equipo_balanza_1g', v)}
                                />
                                <EquipmentSelect
                                    label="Balanza 0.1 g"
                                    value={form.equipo_balanza_01g || '-'}
                                    options={EQUIPO_OPTIONS.equipo_balanza_01g}
                                    onChange={v => set('equipo_balanza_01g', v)}
                                />
                            </div>
                        </div>
                    </div>
                </Section>

                <Section title="Observaciones">
                    <textarea
                        value={form.observaciones || ''}
                        onChange={e => set('observaciones', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Observaciones del ensayo..."
                    />
                </Section>

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
                        <Input
                            label="Fecha revision"
                            value={form.revisado_fecha || ''}
                            onChange={v => set('revisado_fecha', v)}
                            onBlur={() => applyFormattedField('revisado_fecha', normalizeFlexibleDate)}
                            placeholder="YYYY/MM/DD"
                        />
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
                        <Input
                            label="Fecha aprobacion"
                            value={form.aprobado_fecha || ''}
                            onChange={v => set('aprobado_fecha', v)}
                            onBlur={() => applyFormattedField('aprobado_fecha', normalizeFlexibleDate)}
                            placeholder="YYYY/MM/DD"
                        />
                    </div>
                </Section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                        onClick={() => setPendingFormatAction(false)}
                        disabled={loading}
                        className="h-11 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                            : 'Guardar'
                        }
                    </button>
                    <button
                        onClick={() => setPendingFormatAction(true)}
                        disabled={loading}
                        className="h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                            : <><Download className="h-4 w-4" /> Guardar y Descargar</>
                        }
                    </button>
                </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-4 space-y-4">
                        <HumedadResumenTable
                            sinSaturar={humedadResumen.sin_saturar}
                            saturado={humedadResumen.saturado}
                            humedadObjetivo={form.optimo_contenido_humedad}
                        />
                        <MoldCodeReferenceTable />
                    </div>
                </div>
            </div>
        <FormatConfirmModal
            open={pendingFormatAction !== null}
            formatLabel={buildFormatPreview(form.muestra, muestraType, 'CBR')}
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

function HumedadResumenTable({
    sinSaturar,
    saturado,
    humedadObjetivo,
}: {
    sinSaturar: HumedadResumenRow[]
    saturado: HumedadResumenRow[]
    humedadObjetivo?: number
}) {
    return (
        <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                <h2 className="text-sm font-semibold text-foreground">C.H Referencial</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Objetivo: {humedadObjetivo != null ? `${humedadObjetivo}%` : '-'}
                </p>
            </div>
            <div className="p-4">
                <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-xs">
                        <thead className="bg-sky-100">
                            <tr>
                                <th className="px-2 py-1.5 text-left border-b border-r border-border">C.H SIN SATURAR</th>
                                <th className="px-2 py-1.5 text-center border-b border-border">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sinSaturar.map((row) => (
                                <tr key={`ss-${row.muestra}`}>
                                    <td className="px-2 py-1.5 border-b border-r border-border">
                                        <span className="font-medium">{row.muestra}</span>
                                        <span className="ml-2 text-muted-foreground">{row.valor == null ? '-' : `${row.valor.toFixed(2)}%`}</span>
                                    </td>
                                    <td className="px-2 py-1.5 border-b border-border text-center">{row.estado}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="overflow-hidden rounded-md border border-border mt-3">
                    <table className="w-full text-xs">
                        <thead className="bg-sky-100">
                            <tr>
                                <th className="px-2 py-1.5 text-left border-b border-border">C.H SATURADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {saturado.map((row) => (
                                <tr key={`sat-${row.muestra}`}>
                                    <td className="px-2 py-1.5 border-b border-border">
                                        <span className="font-medium">{row.muestra}</span>
                                        <span className="ml-2 text-muted-foreground">{row.valor == null ? '-' : `${row.valor.toFixed(2)}%`}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function MoldCodeReferenceTable() {
    return (
        <div className="bg-card border border-border rounded-lg shadow-sm">
            <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                <h2 className="text-sm font-semibold text-foreground">Codigos / Equipos Utilizado</h2>
            </div>
            <div className="p-4">
                <div className="overflow-hidden rounded-md border border-border">
                    <table className="w-full text-xs">
                        <thead className="bg-sky-100">
                            <tr>
                                <th className="px-2 py-1.5 border-b border-r border-border text-center">CODIGOS</th>
                                <th className="px-2 py-1.5 border-b border-border text-center">EQUIPOS UTILIZADO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOLD_CODE_REFERENCE.map((entry) => (
                                <tr key={entry.codigo}>
                                    <td className="px-2 py-1.5 border-b border-r border-border text-center">{entry.codigo}</td>
                                    <td className="px-2 py-1.5 border-b border-border text-center">{entry.label ?? `${entry.codigo} / ${entry.equipo}`}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
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
                onKeyDown={handleAdvanceOnEnter}
                placeholder={placeholder}
                autoComplete="off"
                data-lpignore="true"
                data-enter-nav="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )
}

function SelectField({ label, value, onChange, options }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: string[]
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={handleAdvanceOnEnter}
                    data-enter-nav="true"
                    className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
        </div>
    )
}

function EquipmentSelect({ label, value, onChange, options }: {
    label: string
    value: string
    onChange: (v: string) => void
    options: string[]
}) {
    return (
        <div className="grid grid-cols-[114px_minmax(0,1fr)] gap-2 items-center">
            <p className="text-xs text-muted-foreground font-medium leading-none">{label}</p>
            <div className="relative">
                <select
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={handleAdvanceOnEnter}
                    data-enter-nav="true"
                    className="w-full h-8 pl-2.5 pr-8 rounded-md border border-input bg-background text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map(option => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
        </div>
    )
}

function ConditionRow({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-3 items-center">
            <p className="text-sm md:text-[15px] text-muted-foreground font-medium">{label}</p>
            {children}
        </div>
    )
}

function ConditionNumberInput({ value, onChange }: {
    value: number | undefined | null
    onChange: (raw: string) => void
}) {
    return (
        <input
            type="number"
            step="any"
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleAdvanceOnEnter}
            autoComplete="off"
            data-lpignore="true"
            data-enter-nav="true"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function ConditionTextInput({ value, onChange }: {
    value: string
    onChange: (raw: string) => void
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleAdvanceOnEnter}
            autoComplete="off"
            data-lpignore="true"
            data-enter-nav="true"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function ConditionSelectInput({ value, options, onChange }: {
    value: string
    options: string[]
    onChange: (v: string) => void
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleAdvanceOnEnter}
                data-enter-nav="true"
                className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {options.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
    )
}

function TableTextInput({ value, onChange, onBlur, placeholder }: {
    value: string
    onChange: (raw: string) => void
    onBlur?: () => void
    placeholder?: string
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={handleAdvanceOnEnter}
            placeholder={placeholder}
            autoComplete="off"
            data-lpignore="true"
            data-enter-nav="true"
            className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function TableTextInputCompact({ value, onChange, onBlur, placeholder }: {
    value: string
    onChange: (raw: string) => void
    onBlur?: () => void
    placeholder?: string
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={handleAdvanceOnEnter}
            placeholder={placeholder}
            autoComplete="off"
            data-lpignore="true"
            data-enter-nav="true"
            className="w-full h-7 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}


function TableSelectInputCompact({ value, options, onChange }: {
    value: string
    options: DropdownOption[]
    onChange: (raw: string) => void
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleAdvanceOnEnter}
                data-enter-nav="true"
                className="w-full h-7 pl-2 pr-7 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
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
            onKeyDown={handleAdvanceOnEnter}
            autoComplete="off"
            data-lpignore="true"
            data-enter-nav="true"
            className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function TableNumInputCompact({ value, onChange }: {
    value: number | undefined | null
    onChange: (raw: string) => void
}) {
    return (
        <input
            type="number"
            step="any"
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleAdvanceOnEnter}
            autoComplete="off"
            data-lpignore="true"
            data-enter-nav="true"
            className="w-full h-7 px-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )
}

function TableComputedValueCompact({ value }: {
    value: number | null
}) {
    return (
        <div className="h-7 px-2 rounded-md border border-input bg-muted/30 text-sm flex items-center justify-center text-foreground font-medium">
            {value != null ? value : '-'}
        </div>
    )
}

function TableFixedValueCompact({ value }: {
    value?: number
}) {
    return (
        <div className="h-7 px-2 rounded-md border border-input bg-muted/40 text-sm flex items-center justify-center text-foreground font-semibold">
            {value ?? '-'}
        </div>
    )
}

function ArrayNumberRow({
    label,
    values,
    compact = false,
    stickyLabel = false,
    onChange,
}: {
    label: string
    values: Array<number | null>
    compact?: boolean
    stickyLabel?: boolean
    onChange: (idx: number, raw: string) => void
}) {
    const labelClass = compact
        ? `px-3 py-1 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS}`
        : `px-3 py-2 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS}`
    return (
        <tr>
            <td className={`${labelClass} ${stickyLabel ? STICKY_LABEL_TD_CLASS : ""}`}>{label}</td>
            {values.map((value, idx) => (
                <td
                    key={`${label}-${idx}`}
                    className={`${compact ? "px-2 py-1" : "px-2 py-2"} border-b border-border ${idx < values.length - 1 ? "border-r" : ""}`}
                >
                    {compact ? (
                        <TableNumInputCompact value={value} onChange={raw => onChange(idx, raw)} />
                    ) : (
                        <TableNumInput value={value} onChange={raw => onChange(idx, raw)} />
                    )}
                </td>
            ))}
        </tr>
    )
}

function ArrayTextRow({
    label,
    values,
    compact = false,
    stickyLabel = false,
    onChange,
}: {
    label: string
    values: Array<string | null>
    compact?: boolean
    stickyLabel?: boolean
    onChange: (idx: number, raw: string) => void
}) {
    const labelClass = compact
        ? `px-3 py-1 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS}`
        : `px-3 py-2 border-r border-b border-border ${STICKY_LABEL_WIDTH_CLASS}`
    return (
        <tr>
            <td className={`${labelClass} ${stickyLabel ? STICKY_LABEL_TD_CLASS : ""}`}>{label}</td>
            {values.map((value, idx) => (
                <td
                    key={`${label}-${idx}`}
                    className={`${compact ? "px-2 py-1" : "px-2 py-2"} border-b border-border ${idx < values.length - 1 ? "border-r" : ""}`}
                >
                    {compact ? (
                        <TableTextInputCompact value={value ?? ''} onChange={raw => onChange(idx, raw)} />
                    ) : (
                        <TableTextInput value={value ?? ''} onChange={raw => onChange(idx, raw)} />
                    )}
                </td>
            ))}
        </tr>
    )
}
