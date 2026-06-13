import { useCallback, useEffect, useMemo, useState } from 'react'
import { Beaker, Download, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import FormatConfirmModal from '../shared/FormatConfirmModal'

// --- Local Types ---
export interface SulfatosSolublesPayload {
    muestra?: string
    numero_ot?: string
    fecha_ensayo?: string
    realizado_por?: string
    condicion_secado_aire?: string
    condicion_secado_horno?: string
    capsula_numero?: string
    volumen_agua_ml?: number | null
    peso_suelo_seco_g?: number | null
    alicuota_tomada_ml?: number | null
    titulacion_suelo_g?: number | null
    solucion_cloruro_bario?: string
    peso_crisol_g?: number | null
    peso_crisol_residuos_g?: number | null
    residuo_sulfatos_g?: number | null
    contenido_sulfatos_ppm?: number | null
    observaciones?: string
    equipo_horno_codigo?: string
    equipo_mufla_codigo?: string
    equipo_balanza_001_codigo?: string
    equipo_balanza_codigo?: string
    revisado_por?: string
    revisado_fecha?: string
    aprobado_por?: string
    aprobado_fecha?: string
}

export interface SulfatosSolublesDetail {
    id: number
    payload?: SulfatosSolublesPayload | null
}

export interface SulfatosSolublesSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

async function getEnsayoDetail(ensayoId: number): Promise<SulfatosSolublesDetail> {
    const url = `${API_URL}/api/sulfatos-solubles/${ensayoId}`
    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error('No se pudo cargar el ensayo de Sulfatos Solubles.')
    }
    return response.json()
}

async function saveEnsayo(payload: SulfatosSolublesPayload, ensayoId?: number): Promise<SulfatosSolublesSaveResponse> {
    const url = `${API_URL}/api/sulfatos-solubles/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || 'Error al guardar el ensayo de Sulfatos.')
    }
    return response.json()
}

async function saveAndDownload(payload: SulfatosSolublesPayload, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/sulfatos-solubles/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || 'Error al descargar el excel de Sulfatos.')
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


const MODULE_TITLE = 'Sulfatos Solubles'
// const FILE_PREFIX = 'SULFATOS_SOLUBLES'
const DRAFT_KEY = 'sulfatos-solubles_form_draft_v2'
const DEBOUNCE_MS = 700
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const
const SECADO_OPTIONS = ['', 'X'] as const

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
    capsula_numero: string
    volumen_agua_ml: number | null
    peso_suelo_seco_g: number | null
    alicuota_tomada_ml: number | null
    titulacion_suelo_g: number | null
    solucion_cloruro_bario: string
    peso_crisol_g: number | null
    peso_crisol_residuos_g: number | null
    residuo_sulfatos_g: number | null
    contenido_sulfatos_ppm: number | null
    observaciones: string
    equipo_horno_codigo: string
    equipo_mufla_codigo: string
    equipo_balanza_001_codigo: string
    equipo_balanza_codigo: string
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
    capsula_numero: '',
    volumen_agua_ml: null,
    peso_suelo_seco_g: null,
    alicuota_tomada_ml: null,
    titulacion_suelo_g: null,
    solucion_cloruro_bario: '',
    peso_crisol_g: null,
    peso_crisol_residuos_g: null,
    residuo_sulfatos_g: null,
    contenido_sulfatos_ppm: null,
    observaciones: '',
    equipo_horno_codigo: '',
    equipo_mufla_codigo: '',
    equipo_balanza_001_codigo: '',
    equipo_balanza_codigo: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const hydrateForm = (payload?: Partial<SulfatosSolublesPayload>): FormState => {
    const base = initialState()
    if (!payload) return base

    return {
        ...base,
        ...payload,
        condicion_secado_aire: payload.condicion_secado_aire ?? base.condicion_secado_aire,
        condicion_secado_horno: payload.condicion_secado_horno ?? base.condicion_secado_horno,
        capsula_numero: payload.capsula_numero ?? base.capsula_numero,
        volumen_agua_ml: payload.volumen_agua_ml ?? base.volumen_agua_ml,
        peso_suelo_seco_g: payload.peso_suelo_seco_g ?? base.peso_suelo_seco_g,
        alicuota_tomada_ml: payload.alicuota_tomada_ml ?? base.alicuota_tomada_ml,
        titulacion_suelo_g: payload.titulacion_suelo_g ?? base.titulacion_suelo_g,
        solucion_cloruro_bario: payload.solucion_cloruro_bario ?? base.solucion_cloruro_bario,
        peso_crisol_g: payload.peso_crisol_g ?? base.peso_crisol_g,
        peso_crisol_residuos_g: payload.peso_crisol_residuos_g ?? base.peso_crisol_residuos_g,
        residuo_sulfatos_g: payload.residuo_sulfatos_g ?? base.residuo_sulfatos_g,
        contenido_sulfatos_ppm: payload.contenido_sulfatos_ppm ?? base.contenido_sulfatos_ppm,
        equipo_horno_codigo: payload.equipo_horno_codigo ?? base.equipo_horno_codigo,
        equipo_mufla_codigo: payload.equipo_mufla_codigo ?? base.equipo_mufla_codigo,
        equipo_balanza_001_codigo: payload.equipo_balanza_001_codigo ?? base.equipo_balanza_001_codigo,
        equipo_balanza_codigo: payload.equipo_balanza_codigo ?? base.equipo_balanza_codigo,
    }
}

export interface SulfatosSolublesFormProps {
    ensayoId?: number | null
    onClose?: () => void
    onSaveSuccess?: () => void
}

export default function SulfatosSolublesForm({ ensayoId: initialEnsayoId, onClose, onSaveSuccess }: SulfatosSolublesFormProps) {
    const [form, setForm] = useState<FormState>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [ensayoId, setEnsayoId] = useState<number | null>(initialEnsayoId ?? null)
    const [showDraftBanner, setShowDraftBanner] = useState(false)
    const [draftData, setDraftData] = useState<FormState | null>(null)

    useEffect(() => {
        if (ensayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as Partial<SulfatosSolublesPayload>
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
                            const parsedDraft = JSON.parse(rawDraft) as Partial<SulfatosSolublesPayload>
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
                toast.error('No se pudo cargar ensayo de sulfatos solubles.')
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

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
        setForm(initialState())
    }, [ensayoId])

    const computedTitulacion = useMemo(() => {
        if (form.volumen_agua_ml == null || form.peso_suelo_seco_g == null || form.alicuota_tomada_ml == null) return null
        if (form.volumen_agua_ml === 0 || form.alicuota_tomada_ml === 0) return null
        return round(form.peso_suelo_seco_g / (form.volumen_agua_ml / form.alicuota_tomada_ml), 4)
    }, [form.volumen_agua_ml, form.peso_suelo_seco_g, form.alicuota_tomada_ml])

    const resolvedTitulacion = form.titulacion_suelo_g ?? computedTitulacion

    const computedResiduo = useMemo(() => {
        if (form.peso_crisol_g == null || form.peso_crisol_residuos_g == null) return null
        return round(form.peso_crisol_residuos_g - form.peso_crisol_g, 4)
    }, [form.peso_crisol_g, form.peso_crisol_residuos_g])

    const resolvedResiduo = form.residuo_sulfatos_g ?? computedResiduo

    const computedContenido = useMemo(() => {
        if (resolvedResiduo == null || resolvedTitulacion == null || resolvedTitulacion === 0) return null
        return round((resolvedResiduo * 411500) / resolvedTitulacion, 3)
    }, [resolvedResiduo, resolvedTitulacion])

    const resolvedContenido = form.contenido_sulfatos_ppm ?? computedContenido
    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)


    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.fecha_ensayo) {
                toast.error('Complete Muestra, N OT y Fecha de ensayo.')
                return
            }
            setLoading(true)
            try {
                const payload: SulfatosSolublesPayload = {
                    ...form,
                    titulacion_suelo_g: resolvedTitulacion,
                    residuo_sulfatos_g: resolvedResiduo,
                    contenido_sulfatos_ppm: resolvedContenido,
                }

                if (download) {
                    const downloadResult = await saveAndDownload(payload, ensayoId ?? undefined)
                    const blob = downloadResult instanceof Blob ? downloadResult : downloadResult.blob
                    const filename = downloadResult instanceof Blob ? undefined : downloadResult.filename
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = filename || `${buildFormatPreview(form.muestra, 'SU', 'SULFATOS SOLUBLES')}.xlsx`
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
                toast.success(download ? 'Sulfatos solubles guardado y descargado.' : 'Sulfatos solubles guardado.')
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'No se pudo generar Sulfatos Solubles.'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [
            ensayoId,
            form,
            resolvedContenido,
            resolvedResiduo,
            resolvedTitulacion,
        ],
    )

    const denseInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

    const readOnlyInputClass = 'h-8 w-full rounded-md border border-slate-200 bg-slate-100 px-2 text-sm text-slate-800'

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
                        <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-SU-15.01</p>
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
                            METODO DE ENSAYONORMALIZADO PARA LA DETERMINACION CUANTITATIVA DE SULFATOS SOLUBLES EN SUELOS Y AGUA SUBTERRANEA
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900">NORMA NTP 339.178</p>
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
                                        { label: 'SECADO EN HORNO 80°C', key: 'condicion_secado_horno' as const },
                                    ].map((row) => (
                                        <tr key={row.key}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                            <td className="border-t border-slate-300 p-1 w-20">
                                                <select
                                                    className={denseInputClass}
                                                    value={form[row.key]}
                                                    onChange={(e) => setField(row.key, e.target.value)}
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
                            </colgroup>
                            <tbody>
                                <tr className="bg-slate-50 text-xs font-semibold text-slate-800">
                                    <td className="border-r border-slate-300 py-1" colSpan={2}>Capsula</td>
                                    <td className="border-r border-slate-300 py-1 text-center">N°</td>
                                    <td className="py-1">
                                        <input
                                            className={denseInputClass}
                                            value={form.capsula_numero}
                                            onChange={(e) => setField('capsula_numero', e.target.value)}
                                            autoComplete="off"
                                            data-lpignore="true"
                                        />
                                    </td>
                                </tr>
                                {[
                                    {
                                        key: 'a',
                                        label: 'Volumen de agua destilada',
                                        unit: '(ml)',
                                        field: 'volumen_agua_ml' as const,
                                        value: form.volumen_agua_ml,
                                        readonly: false,
                                    },
                                    {
                                        key: 'b',
                                        label: 'Peso de suelo seco',
                                        unit: '(g)',
                                        field: 'peso_suelo_seco_g' as const,
                                        value: form.peso_suelo_seco_g,
                                        readonly: false,
                                    },
                                    {
                                        key: 'c',
                                        label: 'Alicuota Tomada',
                                        unit: '(ml)',
                                        field: 'alicuota_tomada_ml' as const,
                                        value: form.alicuota_tomada_ml,
                                        readonly: false,
                                    },
                                    {
                                        key: 'd',
                                        label: 'Titulacion del suelo (b/(a/c))',
                                        unit: '(g)',
                                        field: 'titulacion_suelo_g' as const,
                                        value: resolvedTitulacion,
                                        readonly: true,
                                    },
                                    {
                                        key: 'e',
                                        label: 'Solucion de Cloruro de Bario',
                                        unit: '(BaCl₂)',
                                        field: 'solucion_cloruro_bario' as const,
                                        value: form.solucion_cloruro_bario,
                                        readonly: false,
                                        isText: true,
                                    },
                                    {
                                        key: 'f',
                                        label: 'Peso del Crisol',
                                        unit: '(g)',
                                        field: 'peso_crisol_g' as const,
                                        value: form.peso_crisol_g,
                                        readonly: false,
                                    },
                                    {
                                        key: 'g',
                                        label: 'Peso del Crisol + Residuos de Sulfatos',
                                        unit: '(g)',
                                        field: 'peso_crisol_residuos_g' as const,
                                        value: form.peso_crisol_residuos_g,
                                        readonly: false,
                                    },
                                    {
                                        key: 'h',
                                        label: 'Residuo de Sulfatos (g-f)',
                                        unit: '(g)',
                                        field: 'residuo_sulfatos_g' as const,
                                        value: resolvedResiduo,
                                        readonly: true,
                                    },
                                    {
                                        key: 'i',
                                        label: 'Contenido de Sulfatos ((h*411500)/d)',
                                        unit: '(ppm)',
                                        field: 'contenido_sulfatos_ppm' as const,
                                        value: resolvedContenido,
                                        readonly: true,
                                    },
                                ].map((row) => (
                                    <tr key={row.key}>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs font-semibold">{row.key}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">{row.unit}</td>
                                        <td className="border-t border-slate-300 p-1">
                                            {row.isText ? (
                                                <input
                                                    className={denseInputClass}
                                                    value={row.value as string}
                                                    onChange={(e) => setField(row.field, e.target.value)}
                                                />
                                            ) : (
                                                <input
                                                    type="number"
                                                    step="any"
                                                    className={row.readonly ? readOnlyInputClass : denseInputClass}
                                                    value={row.value ?? ''}
                                                    onChange={(e) => {
                                                        if (row.readonly) return
                                                        setField(row.field, parseNum(e.target.value))
                                                    }}
                                                    readOnly={row.readonly}
                                                />
                                            )}
                                        </td>
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
                                        { label: 'Mufla', key: 'equipo_mufla_codigo' as const },
                                        { label: 'Balanza 0.01', key: 'equipo_balanza_001_codigo' as const },
                                        { label: 'Balanza', key: 'equipo_balanza_codigo' as const },
                                    ].map((row) => (
                                        <tr key={row.key}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                            <td className="border-t border-slate-300 p-1">
                                                <input
                                                    className={denseInputClass}
                                                    value={form[row.key]}
                                                    onChange={(e) => setField(row.key, e.target.value)}
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
                formatLabel={buildFormatPreview(form.muestra, 'SU', 'SULFATOS SOLUBLES')}
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
