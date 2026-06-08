import { useState, useMemo, useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Download, Loader2, FlaskConical, Beaker, Trash2, X } from 'lucide-react'
import FormatConfirmModal from './FormatConfirmModal'
import { authFetch } from '@/lib/api-auth'

// --- Local Types ---
export interface ProctorPunto {
    prueba_numero: number
    numero_capas: number
    numero_golpes: number | null
    masa_suelo_humedo_molde_a: number | null
    masa_molde_compactacion_b: number | null
    masa_suelo_compactado_c: number | null
    volumen_molde_compactacion_d: number | null
    densidad_humeda_x: number | null
    tara_numero: string
    masa_recipiente_suelo_humedo_e: number | null
    masa_recipiente_suelo_seco_1: number | null
    masa_recipiente_suelo_seco_2: number | null
    masa_recipiente_suelo_seco_3_f: number | null
    masa_agua_y: number | null
    masa_recipiente_g: number | null
    masa_suelo_seco_z: number | null
    contenido_humedad_moldeo_w: number | null
    densidad_seca: number | null
}

export interface ProctorPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string
    puntos: ProctorPunto[]
    tipo_muestra?: string
    condicion_muestra?: string
    tamano_maximo_particula_in?: string
    forma_particula?: string
    clasificacion_sucs_visual?: string
    metodo_ensayo?: string
    metodo_preparacion?: string
    tipo_apisonador?: string
    contenido_humedad_natural_pct?: number | null
    excluyo_material_muestra?: string
    tamiz_masa_retenida_g: Array<number | null>
    tamiz_porcentaje_retenido: Array<number | null>
    tamiz_porcentaje_retenido_acumulado: Array<number | null>
    tamiz_metodo_a_codigo?: string
    tamiz_metodo_b_codigo?: string
    tamiz_metodo_c_codigo?: string
    tamiz_utilizado_metodo_codigo?: string
    balanza_1g_codigo?: string
    balanza_codigo?: string
    horno_110_codigo?: string
    molde_codigo?: string
    pison_codigo?: string
    observaciones?: string
    revisado_por?: string
    revisado_fecha?: string
    aprobado_por?: string
    aprobado_fecha?: string
    [key: string]: unknown
}

export interface ProctorEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    maxima_densidad_seca?: number | null
    optimo_contenido_humedad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface ProctorEnsayoDetail extends ProctorEnsayoSummary {
    payload?: ProctorPayload | null
}

export interface ProctorSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    maxima_densidad_seca?: number | null
    optimo_contenido_humedad?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

async function getProctorEnsayoDetail(ensayoId: number): Promise<ProctorEnsayoDetail> {
    const url = `${API_URL}/api/proctor/${ensayoId}`
    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error("No se pudo cargar el ensayo de proctor.")
    }
    return response.json()
}

async function saveProctorEnsayo(payload: ProctorPayload, ensayoId?: number): Promise<ProctorSaveResponse> {
    const url = `${API_URL}/api/proctor/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || "Error al guardar el ensayo de proctor.")
    }
    return response.json()
}

async function saveAndDownloadProctorExcel(payload: ProctorPayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/proctor/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || "Error al descargar el excel de proctor.")
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
    const fullMatch = normalized.match(/^(?:N-?)?(\d+)(?:-[A-Z0-9. ]+)?-(\d{2,4})$/)
    const partialMatch = normalized.match(/^(?:N-?)?(\d+)(?:-(\d{2,4}))?$/)
    const match = fullMatch || partialMatch
    const numero = match?.[1] || 'xxxx'
    const year = (match?.[2] || currentYear).slice(-2)
    return `Formato N-${numero}-${materialCode}-${year} ${ensayo}`
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



const POINT_COLUMNS = ['Punto 1', 'Punto 2', 'Punto 3', 'Punto 4', 'Punto 5']
const SIEVE_LABELS = ['19 mm (3/4 in)', '9.5 mm (3/8 in)', '4.75 mm (No. 4)', 'Menor (No. 4)', 'Total']
const FIXED_NUMERO_CAPAS = 5

const CONDICION_MUESTRA_OPTIONS: Array<'-' | 'ALTERADO' | 'INTACTA'> = ['-', 'ALTERADO', 'INTACTA']
const METODO_ENSAYO_OPTIONS: Array<'-' | 'A' | 'B' | 'C'> = ['-', 'A', 'B', 'C']
const METODO_PREPARACION_OPTIONS: Array<'-' | 'HUMEDO' | 'SECO'> = ['-', 'HUMEDO', 'SECO']
const APISONADOR_OPTIONS: Array<'-' | 'MANUAL' | 'MECANICO'> = ['-', 'MANUAL', 'MECANICO']
const SI_NO_OPTIONS: Array<'-' | 'SI' | 'NO'> = ['-', 'SI', 'NO']
const GOLPES_OPTIONS: Array<'-' | '25' | '56'> = ['-', '25', '56']
const TAMIZ_METODO_A_OPTIONS = ['-', 'INS-0053 (No 4)'] as const
const TAMIZ_METODO_B_OPTIONS = ['-', 'INS-0052 (3/8in)'] as const
const TAMIZ_METODO_C_OPTIONS = ['-', 'INS-0050 (3/4in)'] as const
const BALANZA_1G_OPTIONS = ['-', 'EQP-0054'] as const
const BALANZA_01G_OPTIONS = ['-', 'EQP-0046'] as const
const HORNO_110_OPTIONS = ['-', 'EQP-0150', 'EQP-0049'] as const
const MOLDE_OPTIONS = ['-', 'INS-0195 (MOLDE 6in)', 'INS-0114 (MOLDE 4in)'] as const
const PISON_OPTIONS = ['-', 'INS-0196'] as const

const REVISADO_POR_OPTIONS = ['-', 'FABIAN LA ROSA']
const APROBADO_POR_OPTIONS = ['-', 'IRMA COAQUIRA']
const PROCTOR_DRAFT_STORAGE_PREFIX = 'proctor_form_draft_v1'
const AUTOSAVE_DEBOUNCE_MS = 700
const STICKY_DESC_WIDTH_CLASS = "w-[320px] min-w-[320px] max-w-[320px]"
const STICKY_UNIT_WIDTH_CLASS = "w-[80px] min-w-[80px] max-w-[80px]"
const STICKY_DESC_TH_CLASS = "sticky left-0 z-40 bg-slate-200 text-slate-800 relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.18)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-slate-300"
const STICKY_DESC_TD_CLASS = "sticky left-0 z-30 bg-slate-50 text-slate-800 relative shadow-[8px_0_12px_-10px_rgba(15,23,42,0.12)] after:content-[''] after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-slate-200"
const STICKY_UNIT_TH_CLASS = "bg-slate-200 text-slate-800"
const STICKY_UNIT_TD_CLASS = "bg-slate-50 text-slate-800"
const ENTER_NAV_SELECTOR = '[data-enter-nav="true"]:not([disabled])'

interface ProctorDraftSnapshot {
    version: number
    updatedAt: string
    form: Partial<ProctorPayload>
}

const getDraftStorageKey = (ensayoId: number | null) =>
    `${PROCTOR_DRAFT_STORAGE_PREFIX}:${ensayoId ?? 'new'}`

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)


const getEnterNavigableFields = (): HTMLElement[] => {
    if (typeof document === 'undefined') return []
    return Array.from(document.querySelectorAll<HTMLElement>(ENTER_NAV_SELECTOR)).filter((field) => {
        if (field.tabIndex < 0) return false
        return field.getClientRects().length > 0
    })
}

const handleAdvanceOnEnter = (event: ReactKeyboardEvent<HTMLElement>): void => {
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

const toOptionalNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const normalizeNumeroGolpes = (value: unknown): number | null => {
    const parsed = toOptionalNumber(value)
    return parsed === 25 || parsed === 56 ? parsed : null
}

const emptyPoint = (index: number): ProctorPunto => ({
    prueba_numero: index + 1,
    numero_capas: FIXED_NUMERO_CAPAS,
    numero_golpes: null,
    masa_suelo_humedo_molde_a: null,
    masa_molde_compactacion_b: null,
    masa_suelo_compactado_c: null,
    volumen_molde_compactacion_d: null,
    densidad_humeda_x: null,
    tara_numero: '',
    masa_recipiente_suelo_humedo_e: null,
    masa_recipiente_suelo_seco_1: null,
    masa_recipiente_suelo_seco_2: null,
    masa_recipiente_suelo_seco_3_f: null,
    masa_agua_y: null,
    masa_recipiente_g: null,
    masa_suelo_seco_z: null,
    contenido_humedad_moldeo_w: null,
    densidad_seca: null,
})

const emptySieveArray = () => Array.from({ length: 5 }, () => null as number | null)

const buildInitialState = (): ProctorPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    puntos: Array.from({ length: 5 }, (_, idx) => emptyPoint(idx)),
    tipo_muestra: '',
    condicion_muestra: '-',
    tamano_maximo_particula_in: '',
    forma_particula: '',
    clasificacion_sucs_visual: '',
    metodo_ensayo: '-',
    metodo_preparacion: '-',
    tipo_apisonador: '-',
    contenido_humedad_natural_pct: null,
    excluyo_material_muestra: '-',
    tamiz_masa_retenida_g: emptySieveArray(),
    tamiz_porcentaje_retenido: emptySieveArray(),
    tamiz_porcentaje_retenido_acumulado: emptySieveArray(),
    tamiz_metodo_a_codigo: 'INS-0053 (No 4)',
    tamiz_metodo_b_codigo: 'INS-0052 (3/8in)',
    tamiz_metodo_c_codigo: 'INS-0050 (3/4in)',
    tamiz_utilizado_metodo_codigo: 'INS-0050 (3/4in), INS-0053 (No 4), INS-0052 (3/8in)',
    balanza_1g_codigo: '-',
    balanza_codigo: '-',
    horno_110_codigo: '-',
    molde_codigo: '-',
    pison_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const normalizeNumberArray = (value: Array<number | null> | undefined, length: number): Array<number | null> => {
    return Array.from({ length }, (_, idx) => toOptionalNumber(value?.[idx]))
}

const normalizePoint = (value: ProctorPunto | undefined, index: number): ProctorPunto => {
    const merged = { ...emptyPoint(index), ...(value || {}) }
    return {
        ...merged,
        prueba_numero: toOptionalNumber(merged.prueba_numero) ?? index + 1,
        numero_capas: FIXED_NUMERO_CAPAS,
        numero_golpes: normalizeNumeroGolpes(merged.numero_golpes),
        masa_suelo_humedo_molde_a: toOptionalNumber(merged.masa_suelo_humedo_molde_a),
        masa_molde_compactacion_b: toOptionalNumber(merged.masa_molde_compactacion_b),
        masa_suelo_compactado_c: toOptionalNumber(merged.masa_suelo_compactado_c),
        volumen_molde_compactacion_d: toOptionalNumber(merged.volumen_molde_compactacion_d),
        densidad_humeda_x: toOptionalNumber(merged.densidad_humeda_x),
        tara_numero: (merged.tara_numero || ''),
        masa_recipiente_suelo_humedo_e: toOptionalNumber(merged.masa_recipiente_suelo_humedo_e),
        masa_recipiente_suelo_seco_1: toOptionalNumber(merged.masa_recipiente_suelo_seco_1),
        masa_recipiente_suelo_seco_2: toOptionalNumber(merged.masa_recipiente_suelo_seco_2),
        masa_recipiente_suelo_seco_3_f: toOptionalNumber(merged.masa_recipiente_suelo_seco_3_f),
        masa_agua_y: toOptionalNumber(merged.masa_agua_y),
        masa_recipiente_g: toOptionalNumber(merged.masa_recipiente_g),
        masa_suelo_seco_z: toOptionalNumber(merged.masa_suelo_seco_z),
        contenido_humedad_moldeo_w: toOptionalNumber(merged.contenido_humedad_moldeo_w),
        densidad_seca: toOptionalNumber(merged.densidad_seca),
    }
}

const normalizeSelect = <T extends string>(raw: unknown, options: readonly T[], fallback: T): T => {
    const text = String(raw || '').trim().toUpperCase()
    const match = options.find(option => option.toUpperCase() === text)
    return (match ?? fallback) as T
}

const DEFAULT_TAMIZ_METODO_A = 'INS-0053 (No 4)' as const
const DEFAULT_TAMIZ_METODO_B = 'INS-0052 (3/8in)' as const
const DEFAULT_TAMIZ_METODO_C = 'INS-0050 (3/4in)' as const

const inferTamizCodesFromLegacy = (raw: unknown): {
    a: (typeof TAMIZ_METODO_A_OPTIONS)[number]
    b: (typeof TAMIZ_METODO_B_OPTIONS)[number]
    c: (typeof TAMIZ_METODO_C_OPTIONS)[number]
} => {
    const text = String(raw || '').toUpperCase()
    if (!text.trim() || text.trim() === '-') {
        return {
            a: DEFAULT_TAMIZ_METODO_A,
            b: DEFAULT_TAMIZ_METODO_B,
            c: DEFAULT_TAMIZ_METODO_C,
        }
    }

    return {
        a: text.includes('INS-0053') ? DEFAULT_TAMIZ_METODO_A : '-',
        b: text.includes('INS-0052') ? DEFAULT_TAMIZ_METODO_B : '-',
        c: text.includes('INS-0050') ? DEFAULT_TAMIZ_METODO_C : '-',
    }
}

const composeTamizMetodoCodigo = (
    tamizMetodoA: string | null | undefined,
    tamizMetodoB: string | null | undefined,
    tamizMetodoC: string | null | undefined,
): string => {
    const parts = [tamizMetodoC, tamizMetodoA, tamizMetodoB]
        .map(value => String(value || '').trim())
        .filter(value => value && value !== '-')
    return parts.length ? parts.join(', ') : '-'
}

const hydrateProctorFormState = (candidate: Partial<ProctorPayload>): ProctorPayload => {
    const merged = { ...buildInitialState(), ...(candidate || {}) }
    const inferredTamiz = inferTamizCodesFromLegacy(merged.tamiz_utilizado_metodo_codigo)
    const tamizMetodoA = normalizeSelect(merged.tamiz_metodo_a_codigo, TAMIZ_METODO_A_OPTIONS, inferredTamiz.a)
    const tamizMetodoB = normalizeSelect(merged.tamiz_metodo_b_codigo, TAMIZ_METODO_B_OPTIONS, inferredTamiz.b)
    const tamizMetodoC = normalizeSelect(merged.tamiz_metodo_c_codigo, TAMIZ_METODO_C_OPTIONS, inferredTamiz.c)

    return {
        ...merged,
        puntos: Array.from({ length: 5 }, (_, idx) => normalizePoint(merged.puntos?.[idx], idx)),
        tamiz_masa_retenida_g: normalizeNumberArray(merged.tamiz_masa_retenida_g, 5),
        tamiz_porcentaje_retenido: normalizeNumberArray(merged.tamiz_porcentaje_retenido, 5),
        tamiz_porcentaje_retenido_acumulado: normalizeNumberArray(merged.tamiz_porcentaje_retenido_acumulado, 5),
        condicion_muestra: normalizeSelect(merged.condicion_muestra, CONDICION_MUESTRA_OPTIONS, '-'),
        metodo_ensayo: normalizeSelect(merged.metodo_ensayo, METODO_ENSAYO_OPTIONS, '-'),
        metodo_preparacion: normalizeSelect(merged.metodo_preparacion, METODO_PREPARACION_OPTIONS, '-'),
        tipo_apisonador: normalizeSelect(merged.tipo_apisonador, APISONADOR_OPTIONS, '-'),
        excluyo_material_muestra: normalizeSelect(merged.excluyo_material_muestra, SI_NO_OPTIONS, '-'),
        contenido_humedad_natural_pct: toOptionalNumber(merged.contenido_humedad_natural_pct),
        tamiz_metodo_a_codigo: tamizMetodoA,
        tamiz_metodo_b_codigo: tamizMetodoB,
        tamiz_metodo_c_codigo: tamizMetodoC,
        tamiz_utilizado_metodo_codigo: composeTamizMetodoCodigo(tamizMetodoA, tamizMetodoB, tamizMetodoC),
        balanza_1g_codigo: normalizeSelect(merged.balanza_1g_codigo, BALANZA_1G_OPTIONS, '-'),
        balanza_codigo: normalizeSelect(merged.balanza_codigo, BALANZA_01G_OPTIONS, '-'),
        horno_110_codigo: normalizeSelect(merged.horno_110_codigo, HORNO_110_OPTIONS, '-'),
        molde_codigo: normalizeSelect(merged.molde_codigo, MOLDE_OPTIONS, '-'),
        pison_codigo: normalizeSelect(merged.pison_codigo, PISON_OPTIONS, '-'),
    }
}

const normalizeTextValue = (value: unknown): string => String(value ?? '').trim()

const getComparableProctorFormState = (form: ProctorPayload): ProctorPayload => {
    const hydrated = hydrateProctorFormState(form)
    return {
        ...hydrated,
        muestra: normalizeTextValue(hydrated.muestra),
        numero_ot: normalizeTextValue(hydrated.numero_ot),
        fecha_ensayo: normalizeTextValue(hydrated.fecha_ensayo),
        realizado_por: normalizeTextValue(hydrated.realizado_por),
        tipo_muestra: normalizeTextValue(hydrated.tipo_muestra),
        condicion_muestra: normalizeSelect(hydrated.condicion_muestra, CONDICION_MUESTRA_OPTIONS, '-'),
        tamano_maximo_particula_in: normalizeTextValue(hydrated.tamano_maximo_particula_in),
        forma_particula: normalizeTextValue(hydrated.forma_particula),
        clasificacion_sucs_visual: normalizeTextValue(hydrated.clasificacion_sucs_visual),
        tamiz_metodo_a_codigo: normalizeSelect(hydrated.tamiz_metodo_a_codigo, TAMIZ_METODO_A_OPTIONS, DEFAULT_TAMIZ_METODO_A),
        tamiz_metodo_b_codigo: normalizeSelect(hydrated.tamiz_metodo_b_codigo, TAMIZ_METODO_B_OPTIONS, DEFAULT_TAMIZ_METODO_B),
        tamiz_metodo_c_codigo: normalizeSelect(hydrated.tamiz_metodo_c_codigo, TAMIZ_METODO_C_OPTIONS, DEFAULT_TAMIZ_METODO_C),
        tamiz_utilizado_metodo_codigo: composeTamizMetodoCodigo(
            normalizeSelect(hydrated.tamiz_metodo_a_codigo, TAMIZ_METODO_A_OPTIONS, DEFAULT_TAMIZ_METODO_A),
            normalizeSelect(hydrated.tamiz_metodo_b_codigo, TAMIZ_METODO_B_OPTIONS, DEFAULT_TAMIZ_METODO_B),
            normalizeSelect(hydrated.tamiz_metodo_c_codigo, TAMIZ_METODO_C_OPTIONS, DEFAULT_TAMIZ_METODO_C),
        ),
        balanza_1g_codigo: normalizeTextValue(hydrated.balanza_1g_codigo) || '-',
        balanza_codigo: normalizeTextValue(hydrated.balanza_codigo) || '-',
        horno_110_codigo: normalizeTextValue(hydrated.horno_110_codigo) || '-',
        molde_codigo: normalizeTextValue(hydrated.molde_codigo) || '-',
        pison_codigo: normalizeTextValue(hydrated.pison_codigo) || '-',
        observaciones: normalizeTextValue(hydrated.observaciones),
        revisado_por: normalizeTextValue(hydrated.revisado_por) || '-',
        revisado_fecha: normalizeTextValue(hydrated.revisado_fecha),
        aprobado_por: normalizeTextValue(hydrated.aprobado_por) || '-',
        aprobado_fecha: normalizeTextValue(hydrated.aprobado_fecha),
        puntos: hydrated.puntos.map((point, idx) => ({
            ...normalizePoint(point, idx),
            tara_numero: normalizeTextValue(point.tara_numero),
        })),
    }
}

const areFormsEquivalent = (left: ProctorPayload, right: ProctorPayload): boolean => {
    return JSON.stringify(getComparableProctorFormState(left)) === JSON.stringify(getComparableProctorFormState(right))
}

const isFormAtInitialState = (form: ProctorPayload): boolean => {
    return areFormsEquivalent(form, buildInitialState())
}

interface PointComputed {
    masa_suelo_compactado_c: number | null
    densidad_humeda_x: number | null
    masa_agua_y: number | null
    masa_suelo_seco_z: number | null
    contenido_humedad_moldeo_w: number | null
    densidad_seca: number | null
}

const computePoint = (point: ProctorPunto): PointComputed => {
    const masaHumedaMolde = toOptionalNumber(point.masa_suelo_humedo_molde_a)
    const masaMoldeCompactacion = toOptionalNumber(point.masa_molde_compactacion_b)
    const volumenMolde = toOptionalNumber(point.volumen_molde_compactacion_d)
    const masaRecipienteHumedo = toOptionalNumber(point.masa_recipiente_suelo_humedo_e)
    const masaRecipienteSeco = toOptionalNumber(point.masa_recipiente_suelo_seco_3_f)
    const masaRecipiente = toOptionalNumber(point.masa_recipiente_g)

    const storedMasaCompactado = toOptionalNumber(point.masa_suelo_compactado_c)
    const masaCompactado =
        masaHumedaMolde != null && masaMoldeCompactacion != null
            ? Number((masaHumedaMolde - masaMoldeCompactacion).toFixed(2))
            : storedMasaCompactado

    const storedDensidadHumeda = toOptionalNumber(point.densidad_humeda_x)
    const densidadHumeda =
        masaCompactado != null && volumenMolde != null && volumenMolde !== 0
            ? Number((masaCompactado / volumenMolde).toFixed(3))
            : storedDensidadHumeda

    const storedMasaAgua = toOptionalNumber(point.masa_agua_y)
    const masaAgua =
        masaRecipienteHumedo != null && masaRecipienteSeco != null
            ? Number((masaRecipienteHumedo - masaRecipienteSeco).toFixed(2))
            : storedMasaAgua

    const storedMasaSueloSeco = toOptionalNumber(point.masa_suelo_seco_z)
    const masaSueloSeco =
        masaRecipienteSeco != null && masaRecipiente != null
            ? Number((masaRecipienteSeco - masaRecipiente).toFixed(2))
            : storedMasaSueloSeco

    const storedContenidoHumedad = toOptionalNumber(point.contenido_humedad_moldeo_w)
    const contenidoHumedad =
        masaAgua != null && masaSueloSeco != null && masaSueloSeco !== 0
            ? Number(((masaAgua / masaSueloSeco) * 100).toFixed(2))
            : storedContenidoHumedad

    const storedDensidadSeca = toOptionalNumber(point.densidad_seca)
    const densidadSeca =
        densidadHumeda != null && contenidoHumedad != null
            ? Number((densidadHumeda / (1 + contenidoHumedad / 100)).toFixed(3))
            : storedDensidadSeca

    return {
        masa_suelo_compactado_c: masaCompactado,
        densidad_humeda_x: densidadHumeda,
        masa_agua_y: masaAgua,
        masa_suelo_seco_z: masaSueloSeco,
        contenido_humedad_moldeo_w: contenidoHumedad,
        densidad_seca: densidadSeca,
    }
}

const computeSievePreview = (form: ProctorPayload) => {
    const mass = [...form.tamiz_masa_retenida_g]
    const pct = Array.from({ length: mass.length }, () => null as number | null)
    const acc = Array.from({ length: mass.length }, () => null as number | null)

    const totalIndex = mass.length - 1
    const hasAllMassRows = mass.slice(0, totalIndex).every(v => v != null)
    mass[totalIndex] = hasAllMassRows
        ? Number((mass.slice(0, totalIndex).reduce<number>((sum, value) => sum + (value ?? 0), 0)).toFixed(2))
        : null

    const total = mass[totalIndex] && mass[totalIndex] !== 0 ? mass[totalIndex] : null
    if (total != null) {
        let running = 0
        for (let idx = 0; idx < totalIndex; idx += 1) {
            const value = mass[idx]
            if (value == null) continue
            const currentPct = Number(((value / total) * 100).toFixed(2))
            pct[idx] = currentPct
            running = Number((running + currentPct).toFixed(2))
            acc[idx] = running
        }
        pct[totalIndex] = running
        acc[totalIndex] = running
    }

    return { mass, pct, acc }
}

type PointNumberKey =
    | 'prueba_numero'
    | 'numero_capas'
    | 'numero_golpes'
    | 'masa_suelo_humedo_molde_a'
    | 'masa_molde_compactacion_b'
    | 'volumen_molde_compactacion_d'
    | 'masa_recipiente_suelo_humedo_e'
    | 'masa_recipiente_suelo_seco_1'
    | 'masa_recipiente_suelo_seco_2'
    | 'masa_recipiente_suelo_seco_3_f'
    | 'masa_recipiente_g'

type SieveArrayKey = 'tamiz_masa_retenida_g' | 'tamiz_porcentaje_retenido' | 'tamiz_porcentaje_retenido_acumulado'

export default function ProctorForm({
    editId,
    onClose,
    onSaveSuccess,
}: {
    editId?: number
    onClose?: () => void
    onSaveSuccess?: () => void
}) {
    const [form, setForm] = useState<ProctorPayload>(() => buildInitialState())
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
    const [loading, setLoading] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [showDraftBanner, setShowDraftBanner] = useState(false)
    const [draftData, setDraftData] = useState<ProctorPayload | null>(null)
    const [isClearDraftModalOpen, setIsClearDraftModalOpen] = useState(false)
    const hydratedFromServerRef = useRef<ProctorPayload | null>(null)
    const restoredDraftKeysRef = useRef<Set<string>>(new Set())
    const draftStorageKey = useMemo(() => getDraftStorageKey(editingEnsayoId), [editingEnsayoId])

    const set = useCallback(<K extends keyof ProctorPayload>(key: K, value: ProctorPayload[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }, [])

    const setNum = useCallback((key: keyof ProctorPayload, raw: string) => {
        const val = raw === '' ? null : Number(raw)
        setForm(prev => ({ ...prev, [key]: Number.isFinite(val) ? val : null }))
    }, [])

    const setPointNumber = useCallback((index: number, key: PointNumberKey, raw: string) => {
        const val = raw === '' ? null : Number(raw)
        const normalized = Number.isFinite(val) ? val : null
        setForm(prev => {
            if (key === 'masa_molde_compactacion_b' || key === 'volumen_molde_compactacion_d') {
                const next = prev.puntos.map((point) => ({
                    ...point,
                    [key]: normalized,
                }))
                return { ...prev, puntos: next }
            }

            const next = [...prev.puntos]
            const row = { ...next[index] } as any
            row[key] = normalized
            next[index] = row as ProctorPunto
            return { ...prev, puntos: next }
        })
    }, [])

    const setPointGolpes = useCallback((index: number, raw: string) => {
        const nextValue = raw === '-' ? null : Number(raw)
        setForm(prev => {
            const next = [...prev.puntos]
            const row = { ...next[index] }
            row.numero_golpes = nextValue === 25 || nextValue === 56 ? nextValue : null
            next[index] = row
            return { ...prev, puntos: next }
        })
    }, [])

    const setPointText = useCallback((index: number, key: 'tara_numero', raw: string) => {
        setForm(prev => {
            const next = [...prev.puntos]
            const row = { ...next[index] }
            row[key] = raw
            next[index] = row
            return { ...prev, puntos: next }
        })
    }, [])

    const setSieveValue = useCallback((key: SieveArrayKey, index: number, raw: string) => {
        const val = raw === '' ? null : Number(raw)
        setForm(prev => {
            const next = [...prev[key]]
            next[index] = Number.isFinite(val) ? val : null
            return { ...prev, [key]: next }
        })
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

    const computedPoints = useMemo(() => {
        return form.puntos.map((point) => computePoint(point))
    }, [form.puntos])

    const densidadSecaMaxima = useMemo(() => {
        const densidades = computedPoints
            .map((point) => point.densidad_seca)
            .filter((value): value is number => value != null)
        if (!densidades.length) return null
        return Math.max(...densidades)
    }, [computedPoints])

    const sievePreview = useMemo(() => computeSievePreview(form), [form])

    useEffect(() => {
        if (!editingEnsayoId) return

        let cancelled = false
        const loadForEdit = async () => {
            setLoadingEnsayo(true)
            try {
                const detail: ProctorEnsayoDetail = await getProctorEnsayoDetail(editingEnsayoId)
                if (!detail.payload) {
                    toast.error('El ensayo seleccionado no tiene payload guardado para edicion.')
                    return
                }

                if (!cancelled) {
                    const nextState = hydrateProctorFormState(detail.payload)
                    hydratedFromServerRef.current = nextState

                    // Compare with local draft
                    const rawDraft = localStorage.getItem(draftStorageKey)
                    if (rawDraft) {
                        try {
                            const parsed = JSON.parse(rawDraft) as ProctorDraftSnapshot
                            if (parsed && typeof parsed === 'object' && typeof parsed.form === 'object') {
                                const draftState = hydrateProctorFormState(parsed.form)
                                if (!areFormsEquivalent(draftState, nextState)) {
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
                const message = err instanceof Error ? err.message : 'Error desconocido'
                toast.error(`No se pudo cargar ensayo para edicion: ${message}`)
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
            const parsed = JSON.parse(raw) as ProctorDraftSnapshot
            if (!parsed || typeof parsed !== 'object' || typeof parsed.form !== 'object') {
                localStorage.removeItem(draftStorageKey)
                return
            }

            const hydratedDraft = hydrateProctorFormState(parsed.form)
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

            const snapshot: ProctorDraftSnapshot = {
                version: 1,
                updatedAt: new Date().toISOString(),
                form,
            }
            localStorage.setItem(draftStorageKey, JSON.stringify(snapshot))
        }, AUTOSAVE_DEBOUNCE_MS)

        return () => window.clearTimeout(timeoutId)
    }, [draftStorageKey, editingEnsayoId, form, loadingEnsayo])

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

    const buildPayload = useCallback((): ProctorPayload => {
        const mergedPoints = form.puntos.map((point, idx) => ({
            ...point,
            prueba_numero: toOptionalNumber(point.prueba_numero) ?? idx + 1,
            numero_capas: FIXED_NUMERO_CAPAS,
            numero_golpes: normalizeNumeroGolpes(point.numero_golpes),
            ...computedPoints[idx],
        }))

        return {
            ...form,
            puntos: mergedPoints,
            tamiz_masa_retenida_g: sievePreview.mass,
            tamiz_porcentaje_retenido: sievePreview.pct,
            tamiz_porcentaje_retenido_acumulado: sievePreview.acc,
            tamiz_utilizado_metodo_codigo: composeTamizMetodoCodigo(
                form.tamiz_metodo_a_codigo,
                form.tamiz_metodo_b_codigo,
                form.tamiz_metodo_c_codigo,
            ),
        }
    }, [computedPoints, form, sievePreview])

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

    const clearLocalDraft = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(draftStorageKey)
        }

        if (editingEnsayoId && hydratedFromServerRef.current) {
            setForm(hydratedFromServerRef.current)
            toast.success('Cambios locales limpiados. Se restauraron los datos guardados.')
            return
        }

        setForm(buildInitialState())
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
            toast.error('Complete los campos obligatorios: Muestra, N OT y Realizado por')
            return
        }
        if (form.excluyo_material_muestra === 'SI' && !(form.observaciones || '').trim()) {
            toast.error('Si marco SI en exclusion de material, detallelo en Observaciones.')
            return
        }

        setLoading(true)
        try {
            const payload = buildPayload()
            if (withDownload) {
                const { blob, filename } = await saveAndDownloadProctorExcel(payload, editingEnsayoId ?? undefined)
                downloadBlob(blob, filename || `${buildFormatPreview(form.muestra, 'SU', 'PROCTOR')}.xlsx`)
                toast.success(editingEnsayoId ? 'Formato Proctor actualizado y descargado.' : 'Formato Proctor guardado y descargado.')
            } else {
                await saveProctorEnsayo(payload, editingEnsayoId ?? undefined)
                toast.success(editingEnsayoId ? 'Formato Proctor actualizado correctamente.' : 'Formato Proctor guardado correctamente.')
            }

            if (typeof window !== 'undefined') {
                localStorage.removeItem(draftStorageKey)
            }
            hydratedFromServerRef.current = null
            setForm(buildInitialState())
            setEditingEnsayoId(null)
            if (onSaveSuccess) {
                onSaveSuccess()
            } else {
                closeParentModalIfEmbedded()
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido'
            toast.error(`Error guardando formato Proctor: ${msg}`)
        } finally {
            setLoading(false)
        }
    }, [buildPayload, closeParentModalIfEmbedded, downloadBlob, draftStorageKey, editingEnsayoId, form.excluyo_material_muestra, form.muestra, form.numero_ot, form.observaciones, form.realizado_por, onSaveSuccess])

    return (
        <div className="max-w-[1780px] mx-auto p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Beaker className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">
                            Proctor Modificado - ASTM D1557-12(2021)
                        </h1>
                        <p className="text-sm text-muted-foreground">Formulario operativo alineado al formato de hoja oficial</p>
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

            <div>
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

                <div className="space-y-5">
                <Section title="Encabezado" icon={<FlaskConical className="h-4 w-4" />}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                        <Input label="N OT *" value={form.numero_ot} onChange={v => set('numero_ot', v)} onBlur={() => applyFormattedField('numero_ot', normalizeNumeroOtCode)} placeholder="1234-26" />
                        <Input label="Fecha de ensayo" value={form.fecha_ensayo} onChange={v => set('fecha_ensayo', v)} onBlur={() => applyFormattedField('fecha_ensayo', normalizeFlexibleDate)} placeholder="YYYY/MM/DD" />
                        <Input label="Realizado por *" value={form.realizado_por} onChange={v => set('realizado_por', v)} placeholder="Iniciales o nombre" />
                    </div>
                </Section>

                <Section title="Densidad humeda">
                    <div className="overflow-x-auto rounded-md border border-slate-300 bg-slate-50 relative">
                        <table className="w-full min-w-[1180px] table-fixed text-sm">
                            <thead className="bg-slate-200">
                                <tr className="text-xs font-semibold text-slate-700">
                                    <th className={`${STICKY_DESC_WIDTH_CLASS} px-3 py-2 border-b border-r border-slate-300 text-left ${STICKY_DESC_TH_CLASS}`}>DESCRIPCION</th>
                                    <th className={`${STICKY_UNIT_WIDTH_CLASS} px-2 py-2 border-b border-r border-slate-300 text-center ${STICKY_UNIT_TH_CLASS}`}>UND</th>
                                    {POINT_COLUMNS.map((_, idx) => (
                                        <th key={`densidad-humeda-head-${idx}`} className="w-36 px-2 py-2 border-b border-r border-slate-300 text-center last:border-r-0">{idx + 1}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <TableRowNumber
                                    label="Prueba N"
                                    unit="--"
                                    values={form.puntos.map(point => point.prueba_numero)}
                                    onChange={(idx, raw) => setPointNumber(idx, 'prueba_numero', raw)}
                                />
                                <TableRowStatic label="Numero de capas" unit="--" values={POINT_COLUMNS.map(() => FIXED_NUMERO_CAPAS)} />
                                <TableRowSelectNumber label="Numero de golpes" unit="--" values={form.puntos.map(point => point.numero_golpes)} options={GOLPES_OPTIONS} onChange={setPointGolpes} />
                                <TableRowNumber label="Masa de suelo humedo y molde (A)" unit="g" values={form.puntos.map(point => point.masa_suelo_humedo_molde_a)} onChange={(idx, raw) => setPointNumber(idx, 'masa_suelo_humedo_molde_a', raw)} />
                                <TableRowNumber label="Masa del molde compactacion (B)" unit="g" values={form.puntos.map(point => point.masa_molde_compactacion_b)} onChange={(idx, raw) => setPointNumber(idx, 'masa_molde_compactacion_b', raw)} />
                                <TableRowComputed label="Masa suelo compactado (C=A-B)" unit="g" values={computedPoints.map(point => point.masa_suelo_compactado_c)} />
                                <TableRowNumber label="Volumen de molde compactacion (D)" unit="cm3" values={form.puntos.map(point => point.volumen_molde_compactacion_d)} onChange={(idx, raw) => setPointNumber(idx, 'volumen_molde_compactacion_d', raw)} />
                                <TableRowComputed label="Densidad humeda (X=C/D)" unit="g/cm3" values={computedPoints.map(point => point.densidad_humeda_x)} highlight />
                            </tbody>
                        </table>
                    </div>
                </Section>

                <Section title="Contenido humedad - Densidad seca">
                    <div className="overflow-x-auto rounded-md border border-slate-300 bg-slate-50 relative">
                        <table className="w-full min-w-[1180px] table-fixed text-sm">
                            <thead className="bg-slate-200">
                                <tr className="text-xs font-semibold text-slate-700">
                                    <th className={`${STICKY_DESC_WIDTH_CLASS} px-3 py-2 border-b border-r border-slate-300 text-left ${STICKY_DESC_TH_CLASS}`}>DESCRIPCION</th>
                                    <th className={`${STICKY_UNIT_WIDTH_CLASS} px-2 py-2 border-b border-r border-slate-300 text-center ${STICKY_UNIT_TH_CLASS}`}>UND</th>
                                    {POINT_COLUMNS.map((label) => (
                                        <th key={label} className="w-36 px-2 py-2 border-b border-r border-slate-300 text-center last:border-r-0">{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <TableRowText label="Tara N" unit="-" values={form.puntos.map(point => point.tara_numero || '')} onChange={(idx, raw) => setPointText(idx, 'tara_numero', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo humedo (E)" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_humedo_e)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_humedo_e', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo seco 1" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_seco_1)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_seco_1', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo seco 2" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_seco_2)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_seco_2', raw)} />
                                <TableRowNumber label="Masa recipiente y suelo seco 3 (F)" unit="g" values={form.puntos.map(point => point.masa_recipiente_suelo_seco_3_f)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_suelo_seco_3_f', raw)} />
                                <TableRowComputed label="Masa de agua (Y=E-F)" unit="g" values={computedPoints.map(point => point.masa_agua_y)} />
                                <TableRowNumber label="Masa de recipiente (G)" unit="g" values={form.puntos.map(point => point.masa_recipiente_g)} onChange={(idx, raw) => setPointNumber(idx, 'masa_recipiente_g', raw)} />
                                <TableRowComputed label="Masa de suelo seco (Z=F-G)" unit="g" values={computedPoints.map(point => point.masa_suelo_seco_z)} />
                                <TableRowComputed label="Contenido de humedad moldeo (W=Y/Z*100)" unit="%" values={computedPoints.map(point => point.contenido_humedad_moldeo_w)} />
                                <TableRowComputed label="Densidad seca" unit="g/cm3" values={computedPoints.map(point => point.densidad_seca)} highlight />
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Densidad seca maxima estimada: <span className="font-semibold text-foreground">{densidadSecaMaxima != null ? densidadSecaMaxima : '-'}</span>
                    </p>
                </Section>

                <Section title="Descripcion de la muestra y condiciones del ensayo">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <div className="rounded-md border border-border p-3 space-y-3">
                                <h3 className="text-sm font-semibold text-foreground">Descripcion de la muestra</h3>
                                <Input label="Tipo de muestra" value={form.tipo_muestra || ''} onChange={v => set('tipo_muestra', v)} />
                                <SelectField label="Condicion de la muestra" value={form.condicion_muestra || '-'} options={CONDICION_MUESTRA_OPTIONS} onChange={v => set('condicion_muestra', v as ProctorPayload['condicion_muestra'])} />
                                <Input label="Tamano maximo de la particula (in)" value={form.tamano_maximo_particula_in || ''} onChange={v => set('tamano_maximo_particula_in', v)} />
                                <Input label="Forma de la particula" value={form.forma_particula || ''} onChange={v => set('forma_particula', v)} />
                                <Input label="Clasificacion SUCS o visual" value={form.clasificacion_sucs_visual || ''} onChange={v => set('clasificacion_sucs_visual', v)} />
                            </div>

                            <div className="rounded-md border border-border p-3 space-y-3">
                                <h3 className="text-sm font-semibold text-foreground">Condiciones del ensayo</h3>
                                <p className="text-xs text-muted-foreground">
                                    Complete el texto y marque cada condicion. Si marca <span className="font-semibold">SI</span> en exclusion de material, debe detallar en observaciones.
                                </p>
                                <SelectField label="- Metodo de ensayo" value={form.metodo_ensayo || ''} options={METODO_ENSAYO_OPTIONS} onChange={v => set('metodo_ensayo', v as ProctorPayload['metodo_ensayo'])} />
                                <SelectField label="- Metodo de preparacion de la muestra" value={form.metodo_preparacion || ''} options={METODO_PREPARACION_OPTIONS} onChange={v => set('metodo_preparacion', v as ProctorPayload['metodo_preparacion'])} />
                                <SelectField label="- Tipo de apisonador" value={form.tipo_apisonador || ''} options={APISONADOR_OPTIONS} onChange={v => set('tipo_apisonador', v as ProctorPayload['tipo_apisonador'])} />
                                <NumberInput label="- Contenido de humedad natural (%)" value={form.contenido_humedad_natural_pct} onChange={v => setNum('contenido_humedad_natural_pct', v)} />
                                <SelectField label="- Se excluyo algun material de la muestra de prueba" value={form.excluyo_material_muestra || ''} options={SI_NO_OPTIONS} onChange={v => set('excluyo_material_muestra', v as ProctorPayload['excluyo_material_muestra'])} />
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Observaciones / detalle de material excluido</label>
                                    <textarea
                                        value={form.observaciones || ''}
                                        onChange={e => set('observaciones', e.target.value)}
                                        rows={3}
                                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                        placeholder="Observaciones del ensayo..."
                                    />
                                    {form.excluyo_material_muestra === 'SI' && !(form.observaciones || '').trim() ? (
                                        <p className="mt-1 text-xs text-rose-600">Pendiente: detalle el material excluido para resolver Condiciones.</p>
                                    ) : null}
                                </div>
                            </div>
                        </div>

                        <div>
                            <div className="overflow-hidden rounded-md border border-slate-300 bg-slate-50">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-200 text-xs font-semibold text-slate-700">
                                        <tr>
                                            <th className="px-3 py-2 border-b border-r border-slate-300 text-left">Designacion de tamices</th>
                                            <th className="px-3 py-2 border-b border-r border-slate-300 text-center">Masa retenida (g)</th>
                                            <th className="px-3 py-2 border-b border-r border-slate-300 text-center">% retenido</th>
                                            <th className="px-3 py-2 border-b border-slate-300 text-center">% retenido acumulado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {SIEVE_LABELS.map((label, idx) => (
                                            <tr key={label}>
                                                <td className="px-3 py-2 border-b border-r border-slate-200">{label}</td>
                                                <td className="px-2 py-2 border-b border-r border-slate-200">
                                                    {idx < 4 ? (
                                                        <TableNumInput value={form.tamiz_masa_retenida_g[idx]} onChange={raw => setSieveValue('tamiz_masa_retenida_g', idx, raw)} />
                                                    ) : (
                                                        <TableComputedValue value={sievePreview.mass[idx] ?? null} />
                                                    )}
                                                </td>
                                                <td className="px-2 py-2 border-b border-r border-slate-200">
                                                    <TableComputedValue value={sievePreview.pct[idx] ?? null} />
                                                </td>
                                                <td className="px-2 py-2 border-b border-slate-200">
                                                    <TableComputedValue value={sievePreview.acc[idx] ?? null} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">Los porcentajes y acumulados se calculan automaticamente en simultaneo a partir de la masa retenida.</p>
                        </div>
                    </div>
                </Section>

                <Section title="Equipo utilizado">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        <SelectField
                            label="Tamiz metodo A (No. 4)"
                            value={form.tamiz_metodo_a_codigo || '-'}
                            options={TAMIZ_METODO_A_OPTIONS}
                            onChange={v => set('tamiz_metodo_a_codigo', v)}
                        />
                        <SelectField
                            label="Tamiz metodo B (3/8in)"
                            value={form.tamiz_metodo_b_codigo || '-'}
                            options={TAMIZ_METODO_B_OPTIONS}
                            onChange={v => set('tamiz_metodo_b_codigo', v)}
                        />
                        <SelectField
                            label="Tamiz metodo C (3/4in)"
                            value={form.tamiz_metodo_c_codigo || '-'}
                            options={TAMIZ_METODO_C_OPTIONS}
                            onChange={v => set('tamiz_metodo_c_codigo', v)}
                        />
                        <SelectField
                            label="Balanza 1 g"
                            value={form.balanza_1g_codigo || '-'}
                            options={BALANZA_1G_OPTIONS}
                            onChange={v => set('balanza_1g_codigo', v)}
                        />
                        <SelectField
                            label="Balanza 0,1 g"
                            value={form.balanza_codigo || '-'}
                            options={BALANZA_01G_OPTIONS}
                            onChange={v => set('balanza_codigo', v)}
                        />
                        <SelectField
                            label="Horno 110 C"
                            value={form.horno_110_codigo || '-'}
                            options={HORNO_110_OPTIONS}
                            onChange={v => set('horno_110_codigo', v)}
                        />
                        <SelectField
                            label="Molde"
                            value={form.molde_codigo || '-'}
                            options={MOLDE_OPTIONS}
                            onChange={v => set('molde_codigo', v)}
                        />
                        <SelectField
                            label="Pison"
                            value={form.pison_codigo || '-'}
                            options={PISON_OPTIONS}
                            onChange={v => set('pison_codigo', v)}
                        />
                    </div>
                </Section>

                <Section title="Revisado / Aprobado">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <SelectField label="Revisado por" value={form.revisado_por || '-'} options={REVISADO_POR_OPTIONS} onChange={v => {
                            set('revisado_por', v)
                            if (v !== '-') {
                                set('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                            }
                        }} />
                        <Input label="Fecha revision" value={form.revisado_fecha || ''} onChange={v => set('revisado_fecha', v)} onBlur={() => applyFormattedField('revisado_fecha', normalizeFlexibleDate)} placeholder="YYYY/MM/DD" />
                        <SelectField label="Aprobado por" value={form.aprobado_por || '-'} options={APROBADO_POR_OPTIONS} onChange={v => {
                            set('aprobado_por', v)
                            if (v !== '-') {
                                set('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                            }
                        }} />
                        <Input label="Fecha aprobacion" value={form.aprobado_fecha || ''} onChange={v => set('aprobado_fecha', v)} onBlur={() => applyFormattedField('aprobado_fecha', normalizeFlexibleDate)} placeholder="YYYY/MM/DD" />
                    </div>
                </Section>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                        onClick={handleClearLocalData}
                        disabled={loading}
                        className="h-11 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Limpiar datos
                    </button>
                    <button onClick={() => setPendingFormatAction(false)} disabled={loading} className="h-11 rounded-lg bg-secondary text-secondary-foreground font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar'}
                    </button>
                    <button onClick={() => setPendingFormatAction(true)} disabled={loading} className="h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</> : <><Download className="h-4 w-4" /> Guardar y Descargar</>}
                    </button>
                </div>
            </div>
            </div>

            <FormatConfirmModal
                open={pendingFormatAction !== null}
                formatLabel={buildFormatPreview(form.muestra, muestraType, 'PROCTOR')}
                actionLabel={pendingFormatAction ? 'Guardar y Descargar' : 'Guardar'}
                onClose={() => setPendingFormatAction(null)}
                onConfirm={() => {
                    if (pendingFormatAction === null) return
                    const shouldDownload = pendingFormatAction
                    setPendingFormatAction(null)
                    void handleSave(shouldDownload)
                }}
            />

            <ConfirmActionModal
                isOpen={isClearDraftModalOpen}
                title="Limpiar datos no guardados"
                message="Se limpiarán los datos no guardados. ¿Deseas continuar?"
                confirmText="Sí, limpiar"
                cancelText="Cancelar"
                onConfirm={confirmClearLocalData}
                onCancel={() => setIsClearDraftModalOpen(false)}
            />
        </div>
    )
}

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

    return (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
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

function NumberInput({ label, value, onChange }: {
    label: string
    value: number | null | undefined
    onChange: (v: string) => void
}) {
    return (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
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
        </div>
    )
}

function SelectField({ label, value, options, onChange }: {
    label: string
    value: string
    options: readonly string[]
    onChange: (value: string) => void
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

function TableNumInput({ value, onChange }: {
    value: number | null | undefined
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
            className="w-full h-8 px-2 rounded-md border border-slate-300 bg-slate-50 text-slate-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-400/60"
        />
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
            onKeyDown={handleAdvanceOnEnter}
            autoComplete="off"
            data-lpignore="true"
            data-enter-nav="true"
            className="w-full h-8 px-2 rounded-md border border-slate-300 bg-slate-50 text-slate-800 text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-400/60"
        />
    )
}

function TableComputedValue({ value, highlight = false }: {
    value: number | null
    highlight?: boolean
}) {
    return (
        <div className={`h-8 px-2 rounded-md border text-sm flex items-center justify-center ${highlight && value != null ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-slate-300 bg-slate-100 text-slate-800'}`}>
            {value != null ? value : '-'}
        </div>
    )
}

function TableStaticValue({ value }: {
    value: string | number
}) {
    return (
        <div className="h-8 px-2 rounded-md border border-slate-300 bg-slate-100 text-sm text-slate-800 flex items-center justify-center">
            {value}
        </div>
    )
}

function TableRowNumber({
    label,
    unit,
    values,
    onChange,
}: {
    label: string
    unit: string
    values: Array<number | null | undefined>
    onChange: (index: number, raw: string) => void
}) {
    return (
        <tr>
            <td className={`px-3 py-2 border-b border-r border-slate-200 ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>{label}</td>
            <td className={`px-2 py-2 border-b border-r border-slate-200 text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-slate-200 last:border-r-0">
                    <TableNumInput value={value} onChange={raw => onChange(idx, raw)} />
                </td>
            ))}
        </tr>
    )
}

function TableRowStatic({
    label,
    unit,
    values,
}: {
    label: string
    unit: string
    values: Array<string | number>
}) {
    return (
        <tr>
            <td className={`px-3 py-2 border-b border-r border-slate-200 ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>{label}</td>
            <td className={`px-2 py-2 border-b border-r border-slate-200 text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-slate-200 last:border-r-0">
                    <TableStaticValue value={value} />
                </td>
            ))}
        </tr>
    )
}

function TableSelectInput({
    value,
    options,
    onChange,
}: {
    value: number | null | undefined
    options: readonly string[]
    onChange: (raw: string) => void
}) {
    const currentValue = value == null ? '-' : String(value)
    return (
        <div className="relative">
            <select
                value={currentValue}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleAdvanceOnEnter}
                data-enter-nav="true"
                className="w-full h-8 pl-2 pr-7 rounded-md border border-slate-300 bg-slate-50 text-slate-800 text-sm text-center appearance-none focus:outline-none focus:ring-2 focus:ring-slate-400/60"
            >
                {options.map(option => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        </div>
    )
}

function TableRowSelectNumber({
    label,
    unit,
    values,
    options,
    onChange,
}: {
    label: string
    unit: string
    values: Array<number | null | undefined>
    options: readonly string[]
    onChange: (index: number, raw: string) => void
}) {
    return (
        <tr>
            <td className={`px-3 py-2 border-b border-r border-slate-200 ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>{label}</td>
            <td className={`px-2 py-2 border-b border-r border-slate-200 text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-slate-200 last:border-r-0">
                    <TableSelectInput value={value} options={options} onChange={raw => onChange(idx, raw)} />
                </td>
            ))}
        </tr>
    )
}

function TableRowText({
    label,
    unit,
    values,
    onChange,
}: {
    label: string
    unit: string
    values: string[]
    onChange: (index: number, raw: string) => void
}) {
    return (
        <tr>
            <td className={`px-3 py-2 border-b border-r border-slate-200 ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>{label}</td>
            <td className={`px-2 py-2 border-b border-r border-slate-200 text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-slate-200 last:border-r-0">
                    <TableTextInput value={value} onChange={raw => onChange(idx, raw)} />
                </td>
            ))}
        </tr>
    )
}

function TableRowComputed({
    label,
    unit,
    values,
    highlight = false,
}: {
    label: string
    unit: string
    values: Array<number | null>
    highlight?: boolean
}) {
    return (
        <tr>
            <td className={`px-3 py-2 border-b border-r border-slate-200 ${STICKY_DESC_WIDTH_CLASS} ${STICKY_DESC_TD_CLASS}`}>{label}</td>
            <td className={`px-2 py-2 border-b border-r border-slate-200 text-center ${STICKY_UNIT_WIDTH_CLASS} ${STICKY_UNIT_TD_CLASS}`}>{unit}</td>
            {values.map((value, idx) => (
                <td key={`${label}-${idx}`} className="px-2 py-2 border-b border-r border-slate-200 last:border-r-0">
                    <TableComputedValue value={value} highlight={highlight} />
                </td>
            ))}
        </tr>
    )
}
