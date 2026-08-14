import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Beaker, ChevronDown, Download, Loader2, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import { ConfirmActionModal, FormActionDock, UnsavedChangesModal, useConfirmDialog } from '../shared'

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

const DRAFT_KEY = 'equi_arena_form_draft_v1'
const DEBOUNCE_MS = 700
const TRIAL_COUNT = 3
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

const TIPO_MUESTRA = ['-', 'SUELO', 'AGREGADO FINO'] as const
const METODO_AGITACION = ['-', 'MANUAL', 'MECÁNICO'] as const
const PREPARACION = ['-', 'PROCEDIMIENTO A', 'PROCEDIMIENTO B'] as const
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const

type EquipoField =
    | 'equipo_balanza_01g_codigo'
    | 'equipo_horno_110_codigo'
    | 'equipo_equivalente_arena_codigo'
    | 'equipo_agitador_ea_codigo'
    | 'equipo_termometro_codigo'
    | 'equipo_tamiz_no4_codigo'

const EQUIPO_OPTIONS: Record<EquipoField, readonly string[]> = {
    equipo_balanza_01g_codigo: ['-', 'EQP-0046'],
    equipo_horno_110_codigo: ['-', 'EQP-0150', 'EQP-0049'],
    equipo_equivalente_arena_codigo: ['-', 'EQP-0028'],
    equipo_agitador_ea_codigo: ['-', 'EQP-0047'],
    equipo_termometro_codigo: ['-', 'INS-0153'],
    equipo_tamiz_no4_codigo: ['-', 'INS-0053'],
}

const EQUIPO_LABELS: Record<EquipoField, string> = {
    equipo_balanza_01g_codigo: 'Balanza 0.1 g',
    equipo_horno_110_codigo: 'Horno 110°C',
    equipo_equivalente_arena_codigo: 'Equipo Equivalente Arena',
    equipo_agitador_ea_codigo: 'Agitador EA',
    equipo_termometro_codigo: 'Termómetro',
    equipo_tamiz_no4_codigo: 'Tamiz No. 4',
}

const EQUIPO_FIELDS = Object.keys(EQUIPO_OPTIONS) as EquipoField[]

const withCurrentOption = (value: string | null | undefined, base: readonly string[]) => {
    const current = (value ?? '').trim()
    if (!current || base.includes(current)) return base
    return [...base, current]
}

const isValidEquipmentCode = (field: EquipoField, value: string | null | undefined) => {
    const current = (value ?? '-').trim() || '-'
    return EQUIPO_OPTIONS[field].includes(current)
}

export interface EquiArenaPayload {
    muestra: string
    numero_ot: string
    cliente?: string | null
    fecha_ensayo: string
    realizado_por: string

    tipo_muestra: '-' | 'SUELO' | 'AGREGADO FINO'
    metodo_agitacion: '-' | 'MANUAL' | 'MECÁNICO'
    preparacion_muestra: '-' | 'PROCEDIMIENTO A' | 'PROCEDIMIENTO B'
    temperatura_solucion_c?: number | null
    masa_4_medidas_g?: number | null

    cronometro_entrada_saturacion_hmin: Array<string | null>
    cronometro_salida_saturacion_hmin: Array<string | null>
    tiempo_saturacion_min: Array<number | null>
    tiempo_agitacion_seg: Array<number | null>
    cronometro_entrada_decantacion_hmin: Array<string | null>
    cronometro_salida_decantacion_hmin: Array<string | null>
    tiempo_decantacion_min: Array<number | null>
    lectura_arcilla_in: Array<number | null>
    lectura_arena_in: Array<number | null>
    equivalente_arena_promedio_pct?: number | null

    equipo_balanza_01g_codigo?: string | null
    equipo_horno_110_codigo?: string | null
    equipo_equivalente_arena_codigo?: string | null
    equipo_agitador_ea_codigo?: string | null
    equipo_termometro_codigo?: string | null
    equipo_tamiz_no4_codigo?: string | null
    observaciones?: string | null

    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const initialState = (): EquiArenaPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    tipo_muestra: '-',
    metodo_agitacion: '-',
    preparacion_muestra: '-',
    temperatura_solucion_c: null,
    masa_4_medidas_g: null,
    cronometro_entrada_saturacion_hmin: [null, null, null],
    cronometro_salida_saturacion_hmin: [null, null, null],
    tiempo_saturacion_min: [10, 10, 10],
    tiempo_agitacion_seg: [45, 45, 45],
    cronometro_entrada_decantacion_hmin: [null, null, null],
    cronometro_salida_decantacion_hmin: [null, null, null],
    tiempo_decantacion_min: [20, 20, 20],
    lectura_arcilla_in: [null, null, null],
    lectura_arena_in: [null, null, null],
    equivalente_arena_promedio_pct: null,
    equipo_balanza_01g_codigo: '-',
    equipo_horno_110_codigo: '-',
    equipo_equivalente_arena_codigo: '-',
    equipo_agitador_ea_codigo: '-',
    equipo_termometro_codigo: '-',
    equipo_tamiz_no4_codigo: '-',
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

    const filteredParts = parts.filter((p) => p !== 'SU' && p !== 'AG')

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

const normalizeFlexibleTime = (raw: string): string => {
    const value = raw.trim()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '').replace(/[.]/g, ':')
    const split = compact.split(':')
    if (split.length >= 2 && split[0] && split[1]) {
        const hours = split[0].padStart(2, '0').slice(-2)
        const minutes = split[1].padStart(2, '0').slice(-2)
        const seconds = split[2] ? split[2].padStart(2, '0').slice(-2) : '00'
        return `${hours}:${minutes}:${seconds}`
    }

    const digits = compact.replace(/\D/g, '')
    if (digits.length === 1) return `0${digits}:00:00`
    if (digits.length === 2) return `${digits.padStart(2, '0')}:00:00`
    if (digits.length === 3) return `0${digits[0]}:${digits.slice(1, 3)}:00`
    if (digits.length === 4) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:00`
    if (digits.length === 5) return `0${digits[0]}:${digits.slice(1, 3)}:${digits.slice(3, 5)}`
    if (digits.length === 6) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4, 6)}`

    return value
}

type FormattedFieldKey = 'muestra' | 'numero_ot' | 'fecha_ensayo' | 'revisado_fecha' | 'aprobado_fecha'
type TrialFieldKey = 'tiempo_saturacion_min' | 'tiempo_agitacion_seg' | 'tiempo_decantacion_min' | 'lectura_arcilla_in' | 'lectura_arena_in'
type TrialTextFieldKey =
    | 'cronometro_entrada_saturacion_hmin'
    | 'cronometro_salida_saturacion_hmin'
    | 'cronometro_entrada_decantacion_hmin'
    | 'cronometro_salida_decantacion_hmin'

export interface EquiArenaFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function EquiArenaForm({ editId, onClose, onSaved }: EquiArenaFormProps) {
    const [form, setForm] = useState<EquiArenaPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)
    const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = useState(false)

    const isDirty = useMemo(() => {
        return JSON.stringify(form) !== JSON.stringify(initialState())
    }, [form])

    const handleRequestClose = useCallback(() => {
        if (isDirty) {
            setIsUnsavedChangesModalOpen(true)
        } else {
            onClose?.()
        }
    }, [isDirty, onClose])

    const [muestraInput, setMuestraInput] = useState('')
    const [muestraType, setMuestraType] = useState<'SU' | 'AG'>('SU')
    const [muestraYear, setMuestraYear] = useState(() => new Date().getFullYear().toString().slice(-2))

    useEffect(() => {
        setEditingEnsayoId(editId ?? null)
    }, [editId])

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

    const equivalentByTrial = useMemo(() => {
        return Array.from({ length: TRIAL_COUNT }, (_, idx) => {
            const arcilla = form.lectura_arcilla_in[idx]
            const arena = form.lectura_arena_in[idx]
            if (arcilla == null || arena == null || arcilla <= 0) return null
            return Math.ceil((arena / arcilla) * 100)
        })
    }, [form.lectura_arcilla_in, form.lectura_arena_in])

    const equivalentAverage = useMemo(() => {
        const valid = equivalentByTrial.filter((v): v is number => v != null)
        if (!valid.length) return null
        return Math.ceil(valid.reduce((sum, item) => sum + item, 0) / valid.length)
    }, [equivalentByTrial])

    const setField = useCallback(<K extends keyof EquiArenaPayload>(key: K, value: EquiArenaPayload[K]) => {
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

    const setTrialValue = useCallback((key: TrialFieldKey, index: number, raw: string) => {
        setForm((prev) => {
            const next = [...prev[key]]
            next[index] = parseNum(raw)
            return { ...prev, [key]: next }
        })
    }, [])

    const setTrialTextValue = useCallback((key: TrialTextFieldKey, index: number, raw: string) => {
        setForm((prev) => {
            const next = [...prev[key]]
            next[index] = raw ? raw : null
            return { ...prev, [key]: next }
        })
    }, [])

    const normalizeTextTrialArray = useCallback((values: Array<string | null | undefined> | undefined | null) => {
        const source = Array.isArray(values) ? values : []
        return Array.from({ length: TRIAL_COUNT }, (_, idx) => {
            const normalized = normalizeFlexibleTime(String(source[idx] ?? ''))
            return normalized || null
        })
    }, [])

    const normalizeNumberTrialArray = useCallback((values: Array<number | null | undefined> | undefined | null, fallback: Array<number | null>) => {
        const source = Array.isArray(values) ? values : []
        return Array.from({ length: TRIAL_COUNT }, (_, idx) => {
            const value = source[idx]
            if (value === null || value === undefined || (value as unknown) === '') return fallback[idx] ?? null
            const numeric = Number(value)
            return Number.isFinite(numeric) ? numeric : fallback[idx] ?? null
        })
    }, [])

    useEffect(() => {
        if (editingEnsayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw)
            setForm({
                ...initialState(),
                ...parsed,
                cronometro_entrada_saturacion_hmin: normalizeTextTrialArray(parsed.cronometro_entrada_saturacion_hmin),
                cronometro_salida_saturacion_hmin: normalizeTextTrialArray(parsed.cronometro_salida_saturacion_hmin),
                tiempo_saturacion_min: normalizeNumberTrialArray(parsed.tiempo_saturacion_min, [10, 10, 10]),
                tiempo_agitacion_seg: normalizeNumberTrialArray(parsed.tiempo_agitacion_seg, [45, 45, 45]),
                cronometro_entrada_decantacion_hmin: normalizeTextTrialArray(parsed.cronometro_entrada_decantacion_hmin),
                cronometro_salida_decantacion_hmin: normalizeTextTrialArray(parsed.cronometro_salida_decantacion_hmin),
                tiempo_decantacion_min: normalizeNumberTrialArray(parsed.tiempo_decantacion_min, [20, 20, 20]),
                lectura_arcilla_in: normalizeNumberTrialArray(parsed.lectura_arcilla_in, [null, null, null]),
                lectura_arena_in: normalizeNumberTrialArray(parsed.lectura_arena_in, [null, null, null]),
            })
        } catch {
            localStorage.removeItem(`${DRAFT_KEY}:new`)
        }
    }, [editingEnsayoId, normalizeNumberTrialArray, normalizeTextTrialArray])

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
                const res = await authFetch(`${API_URL}/api/equi-arena/${editingEnsayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!cancelled && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged: EquiArenaPayload = {
                        ...initialState(),
                        muestra: detail.muestra || payload.muestra || '',
                        numero_ot: detail.numero_ot || payload.numero_ot || '',
                        cliente: detail.cliente || payload.cliente || '',
                        fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || '',
                        realizado_por: payload.realizado_por || 'OPERADOR',
                        ...payload,
                        cronometro_entrada_saturacion_hmin: normalizeTextTrialArray(payload.cronometro_entrada_saturacion_hmin),
                        cronometro_salida_saturacion_hmin: normalizeTextTrialArray(payload.cronometro_salida_saturacion_hmin),
                        tiempo_saturacion_min: normalizeNumberTrialArray(payload.tiempo_saturacion_min, [10, 10, 10]),
                        tiempo_agitacion_seg: normalizeNumberTrialArray(payload.tiempo_agitacion_seg, [45, 45, 45]),
                        cronometro_entrada_decantacion_hmin: normalizeTextTrialArray(payload.cronometro_entrada_decantacion_hmin),
                        cronometro_salida_decantacion_hmin: normalizeTextTrialArray(payload.cronometro_salida_decantacion_hmin),
                        tiempo_decantacion_min: normalizeNumberTrialArray(payload.tiempo_decantacion_min, [20, 20, 20]),
                        lectura_arcilla_in: normalizeNumberTrialArray(payload.lectura_arcilla_in, [null, null, null]),
                        lectura_arena_in: normalizeNumberTrialArray(payload.lectura_arena_in, [null, null, null]),
                    }
                    merged.fecha_ensayo = normalizeFlexibleDate(merged.fecha_ensayo || '')
                    setForm(merged)
                }
            } catch {
                toast.error('No se pudo cargar ensayo EquiArena para edición.')
            } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [editingEnsayoId, normalizeNumberTrialArray, normalizeTextTrialArray])

    const confirmReset = useCallback(() => {
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const {
        isOpen: isClearDraftModalOpen,
        openDialog: handleRequestClear,
        closeDialog: handleCancelClear,
        handleConfirm: handleConfirmClear,
    } = useConfirmDialog(confirmReset)

    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.realizado_por) {
                toast.error('Complete Muestra, N OT y Realizado por.')
                return
            }

            const invalidEquipmentField = EQUIPO_FIELDS.find((field) => !isValidEquipmentCode(field, form[field]))
            if (invalidEquipmentField) {
                toast.error(`Seleccione un código válido para ${EQUIPO_LABELS[invalidEquipmentField]}.`)
                return
            }

            setLoading(true)
            try {
                const payload: EquiArenaPayload = {
                    ...form,
                    equivalente_arena_promedio_pct: equivalentAverage,
                }
                let savedId = editingEnsayoId

                if (download) {
                    const url = `${API_URL}/api/equi-arena/excel?download=true${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    if (!res.ok) throw new Error('Error al generar Excel')
                    const blob = await res.blob()
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `${buildFormatPreview(form.muestra, muestraType, 'EQUI. ARENA')}.xlsx`
                    link.click()
                    URL.revokeObjectURL(link.href)

                    localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                    toast.success('EquiArena guardado y descargado.')
                    onSaved?.()
                    onClose?.()
                } else {
                    const url = `${API_URL}/api/equi-arena/excel?download=false${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
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
                    toast.success('EquiArena guardado. Puedes seguir editando.')
                    onSaved?.()
                }
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : 'Error al guardar EquiArena'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [editingEnsayoId, equivalentAverage, form, muestraType, onClose, onSaved],
    )

    const renderText = (label: string, value: string | undefined | null, onChange: (v: string) => void, placeholder?: string, onBlur?: () => void) => (
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
                    {options.map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 pointer-events-none" />
            </div>
        </div>
    )

    const trialHeader = ['Prueba 1', 'Prueba 2', 'Prueba 3']
    const officialTrialRows = [
        { key: 'cronometro_entrada_saturacion_hmin' as const, label: 'Lectura cronómetro de entrada a saturación', kind: 'text' as const },
        { key: 'cronometro_salida_saturacion_hmin' as const, label: 'Lectura cronómetro: salida de saturación', kind: 'text' as const },
        { key: 'tiempo_saturacion_min' as const, label: 'Tiempo saturación (min)', kind: 'number' as const },
        { key: 'tiempo_agitacion_seg' as const, label: 'Tiempo agitación (seg)', kind: 'number' as const },
        { key: 'cronometro_entrada_decantacion_hmin' as const, label: 'Lectura cronómetro: entrada a decantación', kind: 'text' as const },
        { key: 'cronometro_salida_decantacion_hmin' as const, label: 'Lectura cronómetro: salida de decantación', kind: 'text' as const },
        { key: 'tiempo_decantacion_min' as const, label: 'Tiempo decantación (min)', kind: 'number' as const },
        { key: 'lectura_arcilla_in' as const, label: 'Lectura de arcilla (in)', kind: 'number' as const },
        { key: 'lectura_arena_in' as const, label: 'Lectura de arena (in)', kind: 'number' as const },
    ]

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
                                Equivalente de Arena — ASTM D2419-22
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-AG-22.01</p>
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
                            onClick={handleRequestClose}
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
                            <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO EQUI ARENA</p>
                        </div>
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center">
                            <p className="text-sm font-semibold text-slate-900">Standard Test Method for Sand Equivalent Value of Soils and Fine Aggregate</p>
                            <p className="text-sm font-semibold text-slate-900">ASTM D2419-22</p>
                        </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Encabezado</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Muestra</label>
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={muestraInput}
                                        onChange={(e) => handleMuestraInputChange(e.target.value)}
                                        placeholder="1234"
                                        autoComplete="off"
                                        data-lpignore="true"
                                        className="min-w-0 flex-1 h-9 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                            {renderText('N° OT', form.numero_ot, (v) => setField('numero_ot', v), '4567-26', () =>
                                applyFormattedField('numero_ot', normalizeNumeroOtCode),
                            )}
                            {renderText('Fecha ensayo', form.fecha_ensayo, (v) => setField('fecha_ensayo', v), 'YYYY/MM/DD', () =>
                                applyFormattedField('fecha_ensayo', normalizeFlexibleDate),
                            )}
                            {renderText('Realizado por', form.realizado_por, (v) => setField('realizado_por', v))}
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Condiciones de ensayo</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            {renderSelect('Tipo de muestra', form.tipo_muestra, TIPO_MUESTRA, (v) => setField('tipo_muestra', v as EquiArenaPayload['tipo_muestra']))}
                            {renderSelect('Método de agitación', form.metodo_agitacion, METODO_AGITACION, (v) =>
                                setField('metodo_agitacion', v as EquiArenaPayload['metodo_agitacion']),
                            )}
                            {renderSelect('Preparación de muestra', form.preparacion_muestra, PREPARACION, (v) =>
                                setField('preparacion_muestra', v as EquiArenaPayload['preparacion_muestra']),
                            )}
                            {renderNum('Temperatura solución (°C)', form.temperatura_solucion_c, (v) => setField('temperatura_solucion_c', parseNum(v)))}
                            {renderNum('Masa de las 4 medidas (g)', form.masa_4_medidas_g, (v) => setField('masa_4_medidas_g', parseNum(v)))}
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Pruebas oficiales (A-J)</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[1020px] text-sm border border-slate-300 rounded-lg overflow-hidden">
                                <thead className="bg-slate-100">
                                    <tr>
                                        <th className="text-left px-3 py-2 border-b border-slate-300">Campo</th>
                                        {trialHeader.map((label) => (
                                            <th key={label} className="px-3 py-2 border-b border-slate-300 text-center">
                                                {label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {officialTrialRows.map((row) => (
                                        <tr key={row.key} className="border-b border-slate-300 last:border-none">
                                            <td className="px-3 py-2 font-medium">{row.label}</td>
                                            {Array.from({ length: TRIAL_COUNT }, (_, idx) => (
                                                <td key={idx} className="px-2 py-2">
                                                    {row.kind === 'number' ? (
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={(form[row.key as TrialFieldKey][idx] as number | null) ?? ''}
                                                            onChange={(e) => setTrialValue(row.key as TrialFieldKey, idx, e.target.value)}
                                                            className="w-full h-8 px-2 rounded border border-input bg-white text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={(form[row.key as TrialTextFieldKey][idx] as string | null) ?? ''}
                                                            onChange={(e) => setTrialTextValue(row.key as TrialTextFieldKey, idx, e.target.value)}
                                                            onBlur={(e) => {
                                                                const normalized = normalizeFlexibleTime(e.target.value)
                                                                setTrialTextValue(row.key as TrialTextFieldKey, idx, normalized)
                                                            }}
                                                            placeholder="08:00:00"
                                                            autoComplete="off"
                                                            data-lpignore="true"
                                                            className="w-full h-8 px-2 rounded border border-input bg-white text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                                        />
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    <tr>
                                        <td className="px-3 py-2 font-medium bg-slate-100">EA por prueba (%)</td>
                                        {equivalentByTrial.map((value, idx) => (
                                            <td key={idx} className="px-2 py-2 text-center font-semibold bg-slate-50">
                                                {value ?? '-'}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-medium">EA promedio (%)</td>
                                        <td className="px-2 py-2" colSpan={3}>
                                            <div className="flex h-8 items-center justify-center rounded border border-slate-300 bg-slate-100 text-sm font-semibold text-slate-900">
                                                {equivalentAverage ?? '-'}
                                            </div>
                                            <p className="mt-1 text-center text-[11px] text-slate-600">Calculado por sistema y bloqueado para edición.</p>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="mt-3 text-xs text-slate-600">EA por prueba y EA promedio se generan automáticamente a partir de las lecturas de arcilla y arena.</p>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Equipos y observaciones</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            {renderSelect(
                                'Balanza 0.1 g',
                                form.equipo_balanza_01g_codigo || '-',
                                withCurrentOption(form.equipo_balanza_01g_codigo, EQUIPO_OPTIONS.equipo_balanza_01g_codigo),
                                (v) => setField('equipo_balanza_01g_codigo', v),
                            )}
                            {renderSelect(
                                'Horno 110°C',
                                form.equipo_horno_110_codigo || '-',
                                withCurrentOption(form.equipo_horno_110_codigo, EQUIPO_OPTIONS.equipo_horno_110_codigo),
                                (v) => setField('equipo_horno_110_codigo', v),
                            )}
                            {renderSelect(
                                'Equipo Equivalente Arena',
                                form.equipo_equivalente_arena_codigo || '-',
                                withCurrentOption(form.equipo_equivalente_arena_codigo, EQUIPO_OPTIONS.equipo_equivalente_arena_codigo),
                                (v) => setField('equipo_equivalente_arena_codigo', v),
                            )}
                            {renderSelect(
                                'Agitador EA',
                                form.equipo_agitador_ea_codigo || '-',
                                withCurrentOption(form.equipo_agitador_ea_codigo, EQUIPO_OPTIONS.equipo_agitador_ea_codigo),
                                (v) => setField('equipo_agitador_ea_codigo', v),
                            )}
                            {renderSelect(
                                'Termómetro',
                                form.equipo_termometro_codigo || '-',
                                withCurrentOption(form.equipo_termometro_codigo, EQUIPO_OPTIONS.equipo_termometro_codigo),
                                (v) => setField('equipo_termometro_codigo', v),
                            )}
                            {renderSelect(
                                'Tamiz No. 4',
                                form.equipo_tamiz_no4_codigo || '-',
                                withCurrentOption(form.equipo_tamiz_no4_codigo, EQUIPO_OPTIONS.equipo_tamiz_no4_codigo),
                                (v) => setField('equipo_tamiz_no4_codigo', v),
                            )}
                            <div className="md:col-span-2">
                                {renderText('Observaciones', form.observaciones, (v) => setField('observaciones', v))}
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Cierre</h2>
                        </div>
                        <div className="p-4 grid md:grid-cols-2 gap-3">
                            {renderSelect('Revisado por', form.revisado_por || '-', REVISORES, (v) => {
                                setField('revisado_por', v)
                                if (v !== '-') {
                                    setField('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                }
                            })}
                            {renderText('Fecha revisión', form.revisado_fecha, (v) => setField('revisado_fecha', v), 'YYYY/MM/DD', () =>
                                applyFormattedField('revisado_fecha', normalizeFlexibleDate),
                            )}
                            {renderSelect('Aprobado por', form.aprobado_por || '-', APROBADORES, (v) => {
                                setField('aprobado_por', v)
                                if (v !== '-') {
                                    setField('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                }
                            })}
                            {renderText('Fecha aprobación', form.aprobado_fecha, (v) => setField('aprobado_fecha', v), 'YYYY/MM/DD', () =>
                                applyFormattedField('aprobado_fecha', normalizeFlexibleDate),
                            )}
                        </div>
                    </div>
                    <div className="border border-slate-300 bg-white p-3">
                        <table className="w-full text-xs">
                            <tbody>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">EA prueba 1</td>
                                    <td className="px-2 py-2 text-right font-semibold">{equivalentByTrial[0] ?? '-'}</td>
                                </tr>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">EA prueba 2</td>
                                    <td className="px-2 py-2 text-right font-semibold">{equivalentByTrial[1] ?? '-'}</td>
                                </tr>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">EA prueba 3</td>
                                    <td className="px-2 py-2 text-right font-semibold">{equivalentByTrial[2] ?? '-'}</td>
                                </tr>
                                <tr>
                                    <td className="px-2 py-2">EA promedio</td>
                                    <td className="px-2 py-2 text-right font-semibold">{equivalentAverage ?? '-'}</td>
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
                onClear={handleRequestClear}
                loading={loading}
            />
            <ConfirmActionModal
                isOpen={isClearDraftModalOpen}
                title="Limpiar datos no guardados"
                message="Se limpiarán los datos no guardados. ¿Deseas continuar?"
                confirmText="Sí, limpiar"
                cancelText="Cancelar"
                onConfirm={handleConfirmClear}
                onCancel={handleCancelClear}
            />
            <UnsavedChangesModal
                open={isUnsavedChangesModalOpen}
                onClose={() => setIsUnsavedChangesModalOpen(false)}
                onDiscard={() => {
                    setIsUnsavedChangesModalOpen(false)
                    onClose?.()
                }}
                onSave={() => {
                    void save(false).then(() => {
                        setIsUnsavedChangesModalOpen(false)
                        onClose?.()
                    })
                }}
                isSaving={loading}
            />
        </div>
    )
}
