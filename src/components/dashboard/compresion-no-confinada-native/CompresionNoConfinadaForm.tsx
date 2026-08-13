import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Beaker, Download, Loader2, Save, Trash2, X } from 'lucide-react'
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

const DRAFT_KEY = 'compresion_no_confinada_form_draft_v1'
const DEBOUNCE_MS = 700
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const
const SPECIMEN_COUNT = 3
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

type TableFieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
type TableNavigationGroup = 'header' | 'contenido' | 'lectura' | 'revisado' | 'aprobado'
const getTableFieldKey = (table: TableNavigationGroup, row: number, col: number) => `${table}:${row}:${col}`

const TIME_SERIES = [
    '0:00',
    '0:15',
    '0:46',
    '1:16',
    '1:47',
    '2:17',
    '2:48',
    '3:19',
    '3:49',
    '4:20',
    '4:50',
    '5:21',
    '5:51',
    '6:22',
    '6:52',
    '7:23',
    '7:53',
    '8:24',
    '8:55',
    '9:25',
    '9:56',
    '10:26',
    '10:56',
    '11:27',
] as const

const DEFORMACION_MM_BASE: number[] = [
    0,
    0.4123376623376623,
    1.2370129870129871,
    2.061688311688312,
    2.886363636363636,
    3.7110389610389607,
    4.5357142857142865,
    5.3603896103896105,
    6.1850649350649345,
    7.0097402597402585,
    7.834415584415583,
    8.65909090909091,
    9.483766233766232,
    10.308441558441558,
    11.133116883116884,
    11.957792207792206,
    12.782467532467534,
    13.607142857142856,
    14.431818181818182,
    15.25649350649351,
    16.08116883116883,
]

const DEFORMACION_MM: number[] = (() => {
    const values = [...DEFORMACION_MM_BASE]
    while (values.length < TIME_SERIES.length) {
        const prev = values[values.length - 1]
        values.push(prev + 0.82)
    }
    return values
})()

const round = (value: number, decimals = 4) => {
    const factor = 10 ** decimals
    return Math.round(value * factor) / factor
}

const parseNum = (value: string) => {
    if (value.trim() == '') return null
    const normalized = value
        .trim()
        .replace(/\s+/g, '')
        .replace(/,/g, '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
}

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

const normalizeArray = <T,>(value: T[] | undefined, length: number, fallback: T): T[] => {
    const result = Array.from({ length }, () => fallback)
    if (!value) return result
    value.slice(0, length).forEach((item, idx) => {
        result[idx] = item
    })
    return result
}

export type CompresionNoConfinadaPayload = {
    muestra: string
    numero_ot: string
    cliente?: string | null
    fecha_ensayo: string
    realizado_por: string
    tara_numero: string
    tara_suelo_humedo_g: number | null
    tara_suelo_seco_g: number | null
    peso_agua_g?: number | null
    peso_tara_g: number | null
    peso_suelo_seco_g?: number | null
    humedad_pct?: number | null
    diametro_cm: Array<number | null>
    altura_cm: Array<number | null>
    area_cm2: Array<number | null>
    volumen_cm3: Array<number | null>
    peso_gr: Array<number | null>
    p_unitario_humedo: Array<number | null>
    p_unitario_seco: Array<number | null>
    deformacion_tiempo?: string[]
    deformacion_pulg_001?: number[]
    deformacion_mm?: number[]
    lectura_carga_kg: Array<number | null>
    observaciones: string
    revisado_por: string
    revisado_fecha: string
    aprobado_por: string
    aprobado_fecha: string
}

const initialState = (): CompresionNoConfinadaPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    tara_numero: '',
    tara_suelo_humedo_g: null,
    tara_suelo_seco_g: null,
    peso_tara_g: null,
    diametro_cm: Array.from({ length: SPECIMEN_COUNT }, () => null),
    altura_cm: Array.from({ length: SPECIMEN_COUNT }, () => null),
    area_cm2: Array.from({ length: SPECIMEN_COUNT }, () => null),
    volumen_cm3: Array.from({ length: SPECIMEN_COUNT }, () => null),
    peso_gr: Array.from({ length: SPECIMEN_COUNT }, () => null),
    p_unitario_humedo: Array.from({ length: SPECIMEN_COUNT }, () => null),
    p_unitario_seco: Array.from({ length: SPECIMEN_COUNT }, () => null),
    lectura_carga_kg: Array.from({ length: TIME_SERIES.length }, () => null),
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const hydrateForm = (payload?: Partial<CompresionNoConfinadaPayload>): CompresionNoConfinadaPayload => {
    const base = initialState()
    if (!payload) return base

    return {
        ...base,
        ...payload,
        tara_numero: payload.tara_numero ?? base.tara_numero,
        tara_suelo_humedo_g: payload.tara_suelo_humedo_g ?? base.tara_suelo_humedo_g,
        tara_suelo_seco_g: payload.tara_suelo_seco_g ?? base.tara_suelo_seco_g,
        peso_tara_g: payload.peso_tara_g ?? base.peso_tara_g,
        diametro_cm: normalizeArray(payload.diametro_cm, SPECIMEN_COUNT, null),
        altura_cm: normalizeArray(payload.altura_cm, SPECIMEN_COUNT, null),
        area_cm2: normalizeArray(payload.area_cm2, SPECIMEN_COUNT, null),
        volumen_cm3: normalizeArray(payload.volumen_cm3, SPECIMEN_COUNT, null),
        peso_gr: normalizeArray(payload.peso_gr, SPECIMEN_COUNT, null),
        p_unitario_humedo: normalizeArray(payload.p_unitario_humedo, SPECIMEN_COUNT, null),
        p_unitario_seco: normalizeArray(payload.p_unitario_seco, SPECIMEN_COUNT, null),
        lectura_carga_kg: normalizeArray(payload.lectura_carga_kg, TIME_SERIES.length, null),
    }
}

export interface CompresionNoConfinadaFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function CompresionNoConfinadaForm({ editId, onClose, onSaved }: CompresionNoConfinadaFormProps) {
    const [form, setForm] = useState<CompresionNoConfinadaPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(editId ?? null)
    const tableFieldRefs = useRef<Record<string, TableFieldElement | null>>({})

    useEffect(() => {
        setEditingEnsayoId(editId ?? null)
    }, [editId])

    useEffect(() => {
        if (editingEnsayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as Partial<CompresionNoConfinadaPayload>
            setForm(hydrateForm(parsed))
        } catch {
            localStorage.removeItem(`${DRAFT_KEY}:new`)
        }
    }, [editingEnsayoId])

    useEffect(() => {
        if (loadingEdit) return
        const t = window.setTimeout(() => {
            localStorage.setItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`, JSON.stringify(form))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(t)
    }, [form, editingEnsayoId, loadingEdit])

    const justSavedRef = useRef(false)

    useEffect(() => {
        if (!editingEnsayoId) return
        if (justSavedRef.current) {
            justSavedRef.current = false
            return
        }
        let cancel = false
        const run = async () => {
            setLoadingEdit(true)
            try {
                const res = await authFetch(`${API_URL}/api/compresion-no-confinada/${editingEnsayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!cancel && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged: CompresionNoConfinadaPayload = {
                        ...hydrateForm(payload),
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
                toast.error('No se pudo cargar ensayo Compresion No Confinada.')
            } finally {
                if (!cancel) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancel = true
        }
    }, [editingEnsayoId])

    const setField = useCallback(<K extends keyof CompresionNoConfinadaPayload>(key: K, value: CompresionNoConfinadaPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }, [])

    const setArrayField = useCallback(<K extends keyof CompresionNoConfinadaPayload>(key: K, index: number, value: number | null) => {
        setForm((prev) => {
            const arr = Array.isArray(prev[key]) ? [...(prev[key] as Array<number | null>)] : []
            arr[index] = value
            return { ...prev, [key]: arr as CompresionNoConfinadaPayload[K] }
        })
    }, [])

    const focusTableElement = useCallback((element: TableFieldElement | null) => {
        if (!element) return false
        element.focus()
        if (element instanceof HTMLInputElement && element.type !== 'checkbox' && element.type !== 'radio') {
            element.select()
        }
        return true
    }, [])

    const focusTableField = useCallback(
        (table: TableNavigationGroup, row: number, col: number) => {
            const target = tableFieldRefs.current[getTableFieldKey(table, row, col)]
            return focusTableElement(target)
        },
        [focusTableElement],
    )

    const focusNextTableField = useCallback(
        (table: TableNavigationGroup, row: number, col: number) => {
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
            return focusTableElement(nextField?.element ?? null)
        },
        [focusTableElement],
    )

    const handleTableEnter = useCallback(
        (event: ReactKeyboardEvent<TableFieldElement>, table: TableNavigationGroup, row: number, col: number) => {
            if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
            if (event.currentTarget instanceof HTMLTextAreaElement) return

            event.preventDefault()
            if (focusTableField(table, row + 1, col)) return
            focusNextTableField(table, row, col)
        },
        [focusNextTableField, focusTableField],
    )

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const pesoAgua = useMemo(() => {
        if (form.tara_suelo_humedo_g == null || form.tara_suelo_seco_g == null) return null
        return round(form.tara_suelo_humedo_g - form.tara_suelo_seco_g)
    }, [form.tara_suelo_humedo_g, form.tara_suelo_seco_g])

    const pesoSueloSeco = useMemo(() => {
        if (form.tara_suelo_seco_g == null || form.peso_tara_g == null) return null
        return round(form.tara_suelo_seco_g - form.peso_tara_g)
    }, [form.tara_suelo_seco_g, form.peso_tara_g])

    const humedadPct = useMemo(() => {
        if (pesoAgua == null || pesoSueloSeco == null || pesoSueloSeco === 0) return null
        return round((pesoAgua / pesoSueloSeco) * 100, 3)
    }, [pesoAgua, pesoSueloSeco])

    const computedArea = useMemo(() => {
        return form.diametro_cm.map((diam) => (diam == null ? null : round((Math.PI * diam * diam) / 4, 4)))
    }, [form.diametro_cm])

    const computedVolume = useMemo(() => {
        return form.altura_cm.map((altura, idx) => {
            const area = form.area_cm2[idx] ?? computedArea[idx]
            if (altura == null || area == null) return null
            return round(area * altura, 4)
        })
    }, [form.altura_cm, form.area_cm2, computedArea])

    const computedUnitWet = useMemo(() => {
        return form.peso_gr.map((peso, idx) => {
            const volumen = form.volumen_cm3[idx] ?? computedVolume[idx]
            if (peso == null || volumen == null || volumen === 0) return null
            return round(peso / volumen, 4)
        })
    }, [form.peso_gr, form.volumen_cm3, computedVolume])

    const computedUnitDry = useMemo(() => {
        if (humedadPct == null) return Array.from({ length: SPECIMEN_COUNT }, () => null)
        return computedUnitWet.map((pu) => {
            if (pu == null) return null
            return round(pu / (1 + humedadPct / 100), 4)
        })
    }, [computedUnitWet, humedadPct])

    const deformacionPulg = useMemo(() => DEFORMACION_MM.map((mm) => round(mm / 2.54, 3)), [])

    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.fecha_ensayo) {
                toast.error('Complete Muestra, N OT y Fecha de ensayo.')
                return
            }
            setLoading(true)
            try {
                const resolvedArea = form.area_cm2.map((val, idx) => val ?? computedArea[idx] ?? null)
                const resolvedVolume = form.volumen_cm3.map((val, idx) => val ?? computedVolume[idx] ?? null)
                const resolvedUnitWet = form.p_unitario_humedo.map((val, idx) => val ?? computedUnitWet[idx] ?? null)
                const resolvedUnitDry = form.p_unitario_seco.map((val, idx) => val ?? computedUnitDry[idx] ?? null)

                const payload: CompresionNoConfinadaPayload = {
                    ...form,
                    peso_agua_g: pesoAgua,
                    peso_suelo_seco_g: pesoSueloSeco,
                    humedad_pct: humedadPct,
                    area_cm2: resolvedArea,
                    volumen_cm3: resolvedVolume,
                    p_unitario_humedo: resolvedUnitWet,
                    p_unitario_seco: resolvedUnitDry,
                    deformacion_tiempo: [...TIME_SERIES],
                    deformacion_mm: [...DEFORMACION_MM],
                    deformacion_pulg_001: [...deformacionPulg],
                }

                let savedId = editingEnsayoId

                if (download) {
                    const url = `${API_URL}/api/compresion-no-confinada/excel?download=true${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    if (!res.ok) throw new Error('Error al generar Excel')
                    const blob = await res.blob()
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `${buildFormatPreview(form.muestra, 'SU', 'COMPRESION NO CONFINADA')}.xlsx`
                    link.click()
                    URL.revokeObjectURL(link.href)

                    localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                    toast.success('Compresión No Confinada guardada y descargada.')
                    onSaved?.()
                    onClose?.()
                } else {
                    const url = `${API_URL}/api/compresion-no-confinada/excel?download=false${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
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
                    toast.success('Compresión No Confinada guardada. Puedes seguir editando.')
                    onSaved?.()
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Error al guardar ensayo'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [
            computedArea,
            computedUnitDry,
            computedUnitWet,
            computedVolume,
            deformacionPulg,
            editingEnsayoId,
            form,
            humedadPct,
            onClose,
            onSaved,
            pesoAgua,
            pesoSueloSeco,
        ],
    )

    const denseInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

    const readOnlyInputClass =
        'h-8 w-full rounded-md border border-slate-200 bg-slate-100 px-2 text-sm text-slate-800'

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
                                Compresión No Confinada — NTP 339.167
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-SU-33.01</p>
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

                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                    <div className="border-b border-slate-300 bg-slate-50 px-4 py-4 text-center">
                        <p className="text-[26px] font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                        <p className="text-xl font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-SU-33.01</p>
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
                                            onKeyDown={(e) => handleTableEnter(e, 'header', 0, 0)}
                                            ref={(element) => {
                                                tableFieldRefs.current[getTableFieldKey('header', 0, 0)] = element
                                            }}
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
                                            onKeyDown={(e) => handleTableEnter(e, 'header', 0, 1)}
                                            ref={(element) => {
                                                tableFieldRefs.current[getTableFieldKey('header', 0, 1)] = element
                                            }}
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
                                            onKeyDown={(e) => handleTableEnter(e, 'header', 0, 2)}
                                            ref={(element) => {
                                                tableFieldRefs.current[getTableFieldKey('header', 0, 2)] = element
                                            }}
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
                                            onKeyDown={(e) => handleTableEnter(e, 'header', 0, 3)}
                                            ref={(element) => {
                                                tableFieldRefs.current[getTableFieldKey('header', 0, 3)] = element
                                            }}
                                            autoComplete="off"
                                            data-lpignore="true"
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center">
                        <p className="text-[18px] font-semibold leading-tight text-slate-900">
                            MÉTODO DE ENSAYO NORMALIZADO PARA LA RESISTENCIA A LA COMPRESIÓN NO CONFINADA DE SUELO COHESIVOS
                        </p>
                        <p className="text-[16px] font-semibold text-slate-900">NORMA NTP 339.167 - 2002 (revisadado el 2015)</p>
                    </div>

                    <div className="p-3">
                        <table className="w-full table-fixed border border-slate-300 text-sm">
                            <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                <tr>
                                    <th className="border-r border-slate-300 py-2" colSpan={3}>Contenido de Humedad</th>
                                    <th className="border-r border-slate-300 py-2" colSpan={5}>Datos Muestra de Ensayo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    {
                                        label: '(a) Tara N°',
                                        unit: 'N°',
                                        value: (
                                            <input
                                                className={denseInputClass}
                                                value={form.tara_numero}
                                                onChange={(e) => setField('tara_numero', e.target.value)}
                                                onKeyDown={(e) => handleTableEnter(e, 'contenido', 0, 0)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('contenido', 0, 0)] = element
                                                }}
                                                autoComplete="off"
                                                data-lpignore="true"
                                            />
                                        ),
                                    },
                                    {
                                        label: '(b) Tara+suelo humedo',
                                        unit: 'gr',
                                        value: (
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.tara_suelo_humedo_g ?? ''}
                                                onChange={(e) => setField('tara_suelo_humedo_g', parseNum(e.target.value))}
                                                onKeyDown={(e) => handleTableEnter(e, 'contenido', 1, 0)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('contenido', 1, 0)] = element
                                                }}
                                            />
                                        ),
                                    },
                                    {
                                        label: '(c) Tara+suelo seco',
                                        unit: 'gr',
                                        value: (
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.tara_suelo_seco_g ?? ''}
                                                onChange={(e) => setField('tara_suelo_seco_g', parseNum(e.target.value))}
                                                onKeyDown={(e) => handleTableEnter(e, 'contenido', 2, 0)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('contenido', 2, 0)] = element
                                                }}
                                            />
                                        ),
                                    },
                                    {
                                        label: '(d) Peso de agua (b-c)',
                                        unit: 'gr',
                                        value: <input className={readOnlyInputClass} value={pesoAgua ?? ''} readOnly />,
                                    },
                                    {
                                        label: '(e) Peso de tara',
                                        unit: 'gr',
                                        value: (
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.peso_tara_g ?? ''}
                                                onChange={(e) => setField('peso_tara_g', parseNum(e.target.value))}
                                                onKeyDown={(e) => handleTableEnter(e, 'contenido', 4, 0)}
                                                ref={(element) => {
                                                    tableFieldRefs.current[getTableFieldKey('contenido', 4, 0)] = element
                                                }}
                                            />
                                        ),
                                    },
                                    {
                                        label: '(f) Peso de suelo seco (c-e)',
                                        unit: 'gr',
                                        value: <input className={readOnlyInputClass} value={pesoSueloSeco ?? ''} readOnly />,
                                    },
                                    {
                                        label: '(g) Humedad (d/f*100)',
                                        unit: '%',
                                        value: <input className={readOnlyInputClass} value={humedadPct ?? ''} readOnly />,
                                    },
                                ].map((row, idx) => (
                                    <tr key={row.label}>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{row.unit}</td>
                                        <td className="border-t border-r border-slate-300 p-1">{row.value}</td>

                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">
                                            {[
                                                'Diametro',
                                                'Altura (Lo)',
                                                'Area (Ao)',
                                                'Volumen',
                                                'Peso',
                                                'P. Unitario Humedo',
                                                'P. Unitario Seco',
                                            ][idx]}
                                        </td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">
                                            {['cm', 'cm', 'cm2', 'cm3', 'gr', 'gr/cm3', 'gr/cm3'][idx]}
                                        </td>
                                        {idx === 0 ? (
                                            [0, 1, 2].map((specimenIdx) => {
                                                const fieldKey = 'diametro_cm' as keyof CompresionNoConfinadaPayload
                                                const valueArray = form[fieldKey] as Array<number | null>
                                                const displayValue = valueArray[specimenIdx] ?? ''
                                                return (
                                                    <td key={`${row.label}-${specimenIdx}`} className="border-t border-r border-slate-300 p-1">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className={denseInputClass}
                                                            value={displayValue}
                                                            onChange={(e) => {
                                                                const parsed = parseNum(e.target.value)
                                                                setArrayField(fieldKey, specimenIdx, parsed)
                                                            }}
                                                            onKeyDown={(e) => handleTableEnter(e, 'contenido', idx, specimenIdx + 1)}
                                                            ref={(element) => {
                                                                tableFieldRefs.current[getTableFieldKey('contenido', idx, specimenIdx + 1)] = element
                                                            }}
                                                        />
                                                    </td>
                                                )
                                            })
                                        ) : (
                                            (() => {
                                                const fieldKey = [
                                                    'diametro_cm',
                                                    'altura_cm',
                                                    'area_cm2',
                                                    'volumen_cm3',
                                                    'peso_gr',
                                                    'p_unitario_humedo',
                                                    'p_unitario_seco',
                                                ][idx] as keyof CompresionNoConfinadaPayload
                                                const valueArray = form[fieldKey] as Array<number | null>
                                                const computedValue = [
                                                    null,
                                                    null,
                                                    computedArea[0],
                                                    computedVolume[0],
                                                    null,
                                                    computedUnitWet[0],
                                                    computedUnitDry[0],
                                                ][idx]
                                                const displayValue = valueArray[0] ?? computedValue ?? ''
                                                return (
                                                    <td colSpan={3} className="border-t border-r border-slate-300 p-1">
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            className={denseInputClass}
                                                            value={displayValue}
                                                            onChange={(e) => {
                                                                const parsed = parseNum(e.target.value)
                                                                setArrayField(fieldKey, 0, parsed)
                                                            }}
                                                            onKeyDown={(e) => handleTableEnter(e, 'contenido', idx, 1)}
                                                            ref={(element) => {
                                                                tableFieldRefs.current[getTableFieldKey('contenido', idx, 1)] = element
                                                            }}
                                                        />
                                                    </td>
                                                )
                                            })()
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="mt-4 overflow-hidden rounded-lg border border-slate-300">
                            <table className="w-full table-fixed text-sm">
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                    <tr>
                                        <th className="border-b border-r border-slate-300 py-1">tiempo</th>
                                        <th className="border-b border-r border-slate-300 py-1">Deformacion ΔL</th>
                                        <th className="border-b border-r border-slate-300 py-1"></th>
                                        <th className="border-b border-slate-300 py-1">Lectura Carga</th>
                                    </tr>
                                    <tr>
                                        <th className="border-b border-r border-slate-300 py-1">(segundos)</th>
                                        <th className="border-b border-r border-slate-300 py-1">(0,01 Pulg.)</th>
                                        <th className="border-b border-r border-slate-300 py-1">(mm.)</th>
                                        <th className="border-b border-slate-300 py-1">Kg</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {TIME_SERIES.map((time, idx) => (
                                        <tr key={time}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{time}</td>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">
                                                {deformacionPulg[idx].toFixed(3)}
                                            </td>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">
                                                {DEFORMACION_MM[idx].toFixed(3)}
                                            </td>
                                            <td className="border-t border-slate-300 p-1">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={denseInputClass}
                                                    value={form.lectura_carga_kg[idx] ?? ''}
                                                    onChange={(e) => setArrayField('lectura_carga_kg', idx, parseNum(e.target.value))}
                                                    onKeyDown={(e) => handleTableEnter(e, 'lectura', idx, 0)}
                                                    ref={(element) => {
                                                        tableFieldRefs.current[getTableFieldKey('lectura', idx, 0)] = element
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

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
                                        onKeyDown={(e) => handleTableEnter(e, 'revisado', 0, 0)}
                                        ref={(element) => {
                                            tableFieldRefs.current[getTableFieldKey('revisado', 0, 0)] = element
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
                                        onKeyDown={(e) => handleTableEnter(e, 'revisado', 1, 0)}
                                        ref={(element) => {
                                            tableFieldRefs.current[getTableFieldKey('revisado', 1, 0)] = element
                                        }}
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
                                        onKeyDown={(e) => handleTableEnter(e, 'aprobado', 0, 0)}
                                        ref={(element) => {
                                            tableFieldRefs.current[getTableFieldKey('aprobado', 0, 0)] = element
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
                                        onKeyDown={(e) => handleTableEnter(e, 'aprobado', 1, 0)}
                                        ref={(element) => {
                                            tableFieldRefs.current[getTableFieldKey('aprobado', 1, 0)] = element
                                        }}
                                        autoComplete="off"
                                        data-lpignore="true"
                                        placeholder="YYYY/MM/DD"
                                    />
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
