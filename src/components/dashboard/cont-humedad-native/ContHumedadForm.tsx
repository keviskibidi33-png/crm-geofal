import { useCallback, useEffect, useMemo, useState } from 'react'
import { Beaker, Download, Loader2, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import FormActionDock from '../shared/FormActionDock'
import UnsavedChangesModal from '../shared/UnsavedChangesModal'

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

const DRAFT_KEY = 'cont_humedad_form_draft_v1'
const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const

const EQUIPO_OPTIONS = {
    balanza_01g_codigo: ['-', 'EQP-0046'],
    horno_110c_codigo: ['-', 'EQP-0150', 'EQP-0049'],
} as const

type SiNoSelect = 'SI' | 'NO' | '-'

interface ContHumedadPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    numero_ensayo?: number | null
    recipiente_numero?: string | null
    masa_recipiente_muestra_humedo_g?: number | null
    masa_recipiente_muestra_seco_g?: number | null
    masa_recipiente_muestra_seco_constante_g?: number | null
    masa_agua_g?: number | null
    masa_recipiente_g?: number | null
    masa_muestra_seco_g?: number | null
    contenido_humedad_pct?: number | null

    tipo_muestra?: string | null
    tamano_maximo_muestra_visual_in?: string | null
    cumple_masa_minima_norma?: SiNoSelect | null
    se_excluyo_material?: SiNoSelect | null
    descripcion_material_excluido?: string | null

    balanza_01g_codigo?: string | null
    horno_110c_codigo?: string | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

const withCurrentOption = (value: string | null | undefined, base: readonly string[]) => {
    const current = (value ?? '').trim()
    if (!current || base.includes(current)) return base
    return [...base, current]
}

const parseNum = (value: string) => {
    if (value.trim() === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

const yy = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestra = (raw: string) => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''
    const compact = value.replace(/\s+/g, '')
    const match = compact.match(/^(\d+)(?:-(?:SU|AG))?(?:-(\d{2}))?$/)
    return match ? `${match[1]}-AG-${match[2] || yy()}` : value
}

const normalizeOt = (raw: string) => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''
    const compact = value.replace(/\s+/g, '')
    const patterns = [/^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/, /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/]
    for (const pattern of patterns) {
        const match = compact.match(pattern)
        if (match) return `${match[1]}-${match[2] || yy()}`
    }
    return value
}

const normalizeDate = (raw: string): string => {
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

const initialState = (): ContHumedadPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    numero_ensayo: 1,
    recipiente_numero: '',
    masa_recipiente_muestra_humedo_g: null,
    masa_recipiente_muestra_seco_g: null,
    masa_recipiente_muestra_seco_constante_g: null,
    masa_agua_g: null,
    masa_recipiente_g: null,
    masa_muestra_seco_g: null,
    contenido_humedad_pct: null,
    tipo_muestra: '',
    tamano_maximo_muestra_visual_in: '',
    cumple_masa_minima_norma: '-',
    se_excluyo_material: '-',
    descripcion_material_excluido: '',
    balanza_01g_codigo: '-',
    horno_110c_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const hydrateForm = (payload?: Partial<ContHumedadPayload> | null): ContHumedadPayload => ({
    ...initialState(),
    ...payload,
    muestra: normalizeMuestra(payload?.muestra ?? ''),
})

const n = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const computePayload = (payload: ContHumedadPayload): ContHumedadPayload => {
    const next = { ...payload }
    const row3 = n(next.masa_recipiente_muestra_humedo_g)
    const row4 = n(next.masa_recipiente_muestra_seco_g)
    const row5 = n(next.masa_recipiente_muestra_seco_constante_g)
    const row7 = n(next.masa_recipiente_g)

    if (row3 != null && row4 != null) next.masa_agua_g = Number((row3 - row4).toFixed(1))
    if (row5 != null && row7 != null) next.masa_muestra_seco_g = Number((row5 - row7).toFixed(1))
    if (n(next.masa_agua_g) != null && n(next.masa_muestra_seco_g) != null && next.masa_muestra_seco_g !== 0) {
        next.contenido_humedad_pct = Number(((next.masa_agua_g! / next.masa_muestra_seco_g!) * 100).toFixed(1))
    }

    return next
}

export interface ContHumedadFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function ContHumedadForm({ editId, onClose, onSaved }: ContHumedadFormProps) {
    const [form, setForm] = useState<ContHumedadPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [ensayoId, setEnsayoId] = useState<number | null>(editId ?? null)
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

    useEffect(() => {
        setEnsayoId(editId ?? null)
    }, [editId])

    useEffect(() => {
        if (ensayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            setForm(hydrateForm(JSON.parse(raw)))
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
        let disposed = false
        const run = async () => {
            setLoadingEdit(true)
            try {
                const res = await authFetch(`${API_URL}/api/cont-humedad/${ensayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!disposed && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged = {
                        ...initialState(),
                        muestra: detail.muestra || payload.muestra || '',
                        numero_ot: detail.numero_ot || payload.numero_ot || '',
                        cliente: detail.cliente || payload.cliente || '',
                        fecha_ensayo: detail.fecha_documento || payload.fecha_ensayo || payload.fecha_documento || '',
                        realizado_por: payload.realizado_por || 'OPERADOR',
                        ...payload,
                    }
                    setForm(hydrateForm(merged))
                }
            } catch {
                toast.error('No se pudo cargar ensayo de Contenido Humedad.')
            } finally {
                if (!disposed) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            disposed = true
        }
    }, [ensayoId])

    const computed = useMemo(() => computePayload(form), [form])

    const setField = useCallback(<K extends keyof ContHumedadPayload>(k: K, v: ContHumedadPayload[K]) => {
        setForm((prev) => ({ ...prev, [k]: v }))
    }, [])

    const setSelect = useCallback((k: 'cumple_masa_minima_norma' | 'se_excluyo_material', v: SiNoSelect) => {
        setForm((prev) => ({ ...prev, [k]: v }))
    }, [])

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
        setForm(initialState())
    }, [ensayoId])

    const save = useCallback(async (download: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.fecha_ensayo || !form.realizado_por) {
            return toast.error('Complete Muestra, N OT, Fecha y Realizado por.')
        }

        setLoading(true)
        try {
            const payload = computePayload(form)
            let savedId = ensayoId

            if (download) {
                const url = `${API_URL}/api/cont-humedad/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
                const res = await authFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error('Error al generar Excel')
                const blob = await res.blob()
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = `${buildFormatPreview(form.muestra, 'AG', 'CONT. HUMEDAD')}.xlsx`
                link.click()
                URL.revokeObjectURL(link.href)

                localStorage.removeItem(`${DRAFT_KEY}:${ensayoId ?? 'new'}`)
                toast.success('Contenido de Humedad guardado y descargado.')
                onSaved?.()
                onClose?.()
            } else {
                const url = `${API_URL}/api/cont-humedad/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
                const res = await authFetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                })
                if (!res.ok) throw new Error('Error al guardar ensayo')
                const saved = await res.json()
                savedId = saved.id || saved.ensayoId || ensayoId
                if (savedId) setEnsayoId(savedId)
                localStorage.removeItem(`${DRAFT_KEY}:new`)
                toast.success('Contenido de Humedad guardado. Puedes seguir editando.')
                onSaved?.()
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'No se pudo generar Contenido de Humedad.'
            toast.error(msg)
        } finally {
            setLoading(false)
        }
    }, [ensayoId, form, onClose, onSaved])

    const inputClass = 'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'
    const roInputClass = `${inputClass} bg-slate-100`

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
                                Contenido de Humedad — ASTM C566-25
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-AG-20.01</p>
                            {ensayoId && (
                                <p className="text-xs text-blue-600 font-semibold mt-0.5">
                                    Editando ensayo #{ensayoId}
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

                {loadingEdit && (
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Cargando ensayo...
                    </div>
                )}

                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                    <div className="border-b border-slate-300 bg-slate-50 px-4 py-4 text-center">
                        <p className="text-2xl font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                        <p className="text-xl font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-AG-20.01</p>
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
                                    <td className="border-r border-t border-slate-300 p-1"><input className={`${inputClass} text-center`} value={form.muestra} onChange={(e) => setField('muestra', e.target.value)} onBlur={() => setField('muestra', normalizeMuestra(form.muestra))} autoComplete="off" data-lpignore="true" /></td>
                                    <td className="border-r border-t border-slate-300 p-1"><input className={`${inputClass} text-center`} value={form.numero_ot} onChange={(e) => setField('numero_ot', e.target.value)} onBlur={() => setField('numero_ot', normalizeOt(form.numero_ot))} autoComplete="off" data-lpignore="true" /></td>
                                    <td className="border-r border-t border-slate-300 p-1"><input className={`${inputClass} text-center`} value={form.fecha_ensayo} onChange={(e) => setField('fecha_ensayo', e.target.value)} onBlur={() => setField('fecha_ensayo', normalizeDate(form.fecha_ensayo))} autoComplete="off" data-lpignore="true" placeholder="YYYY/MM/DD" /></td>
                                    <td className="border-t border-slate-300 p-1"><input className={`${inputClass} text-center`} value={form.realizado_por} onChange={(e) => setField('realizado_por', e.target.value)} autoComplete="off" data-lpignore="true" /></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center">
                        <p className="text-2xl font-semibold leading-tight text-slate-900">Standard Test Method for Total Evaporable Moisture Content of Aggregate by Drying</p>
                        <p className="text-2xl font-semibold text-slate-900">ASTM C566-25</p>
                    </div>

                    <div className="space-y-3 p-3">
                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_340px]">
                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full table-fixed text-sm">
                                    <thead className="bg-slate-100 text-xs font-semibold text-slate-800">
                                        <tr>
                                            <th className="w-10 border-b border-r border-slate-300 py-1">#</th>
                                            <th className="border-b border-r border-slate-300 px-2 py-1 text-left">DESCRIPCION</th>
                                            <th className="w-20 border-b border-r border-slate-300 py-1">UND</th>
                                            <th className="w-56 border-b border-slate-300 py-1">ENSAYO</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">1</td><td className="border-t border-r border-slate-300 px-2 py-1">N° de ensayo</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">N°</td><td className="border-t border-slate-300 p-1"><input type="number" step="1" className={inputClass} value={computed.numero_ensayo ?? ''} onChange={(e) => setField('numero_ensayo', parseNum(e.target.value))} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">2</td><td className="border-t border-r border-slate-300 px-2 py-1">Recipiente N°</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">N°</td><td className="border-t border-slate-300 p-1"><input className={inputClass} value={form.recipiente_numero ?? ''} onChange={(e) => setField('recipiente_numero', e.target.value)} autoComplete="off" data-lpignore="true" /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">3</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa de recipiente + muestra humedo</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">g</td><td className="border-t border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={computed.masa_recipiente_muestra_humedo_g ?? ''} onChange={(e) => setField('masa_recipiente_muestra_humedo_g', parseNum(e.target.value))} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">4</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa de recipiente + muestra seco</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">g</td><td className="border-t border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={computed.masa_recipiente_muestra_seco_g ?? ''} onChange={(e) => setField('masa_recipiente_muestra_seco_g', parseNum(e.target.value))} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">5</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa de recipiente + muestra seco (constante)</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">g</td><td className="border-t border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={computed.masa_recipiente_muestra_seco_constante_g ?? ''} onChange={(e) => setField('masa_recipiente_muestra_seco_constante_g', parseNum(e.target.value))} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">6</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa de agua (3-4)</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">g</td><td className="border-t border-slate-300 p-1"><input type="number" step="any" readOnly className={roInputClass} value={computed.masa_agua_g ?? ''} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">7</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa de recipiente</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">g</td><td className="border-t border-slate-300 p-1"><input type="number" step="any" className={inputClass} value={computed.masa_recipiente_g ?? ''} onChange={(e) => setField('masa_recipiente_g', parseNum(e.target.value))} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">8</td><td className="border-t border-r border-slate-300 px-2 py-1">Masa de muestra seco (5-7)</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">g</td><td className="border-t border-slate-300 p-1"><input type="number" step="any" readOnly className={roInputClass} value={computed.masa_muestra_seco_g ?? ''} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1 text-center">9</td><td className="border-t border-r border-slate-300 px-2 py-1">Contenido de Humedad de la muestra (6/8*100)</td><td className="border-t border-r border-slate-300 px-2 py-1 text-center">%</td><td className="border-t border-slate-300 p-1"><input type="number" step="any" readOnly className={roInputClass} value={computed.contenido_humedad_pct ?? ''} /></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1"></td><td colSpan={3} className="border-t border-r border-slate-300 px-2 py-1 text-xs text-slate-600">Fuente: Elaboracion propia basada en la Norma ASTM C566-25. * Reporte al 0.1%.</td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white p-2">
                                <img
                                    src="/cont-humedad-masa-minima.png"
                                    alt="Tabla de masa minima ASTM C566-25"
                                    className="w-full h-auto"
                                    loading="lazy"
                                />
                                <div className="border-t border-slate-300 px-2 py-1 text-[10px] text-slate-600">Fuente: Elaboracion propia basada en la Norma ASTM C566-25.</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_420px]">
                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr><td className="w-[58%] border-b border-r border-slate-300 px-2 py-1">* Tipo de muestra</td><td className="border-b border-slate-300 p-1"><input className={inputClass} value={form.tipo_muestra ?? ''} onChange={(e) => setField('tipo_muestra', e.target.value)} autoComplete="off" data-lpignore="true" /></td></tr>
                                        <tr><td className="border-b border-r border-slate-300 px-2 py-1">* Tamano maximo de la muestra (Visual) (in)</td><td className="border-b border-slate-300 p-1"><input className={inputClass} value={form.tamano_maximo_muestra_visual_in ?? ''} onChange={(e) => setField('tamano_maximo_muestra_visual_in', e.target.value)} autoComplete="off" data-lpignore="true" /></td></tr>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-1">* La masa de la muestra cumple con lo requerido por la norma</td>
                                            <td className="border-b border-slate-300 px-1 py-1">
                                                <select
                                                    className={inputClass}
                                                    value={form.cumple_masa_minima_norma ?? '-'}
                                                    onChange={(e) => setSelect('cumple_masa_minima_norma', e.target.value as SiNoSelect)}
                                                    autoComplete="off"
                                                    data-lpignore="true"
                                                >
                                                    {(['-', 'SI', 'NO'] as const).map((value) => (
                                                        <option key={value} value={value}>{value}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-1">* Se excluyo algun material de la muestra de ensayo</td>
                                            <td className="border-b border-slate-300 px-1 py-1">
                                                <select
                                                    className={inputClass}
                                                    value={form.se_excluyo_material ?? '-'}
                                                    onChange={(e) => setSelect('se_excluyo_material', e.target.value as SiNoSelect)}
                                                    autoComplete="off"
                                                    data-lpignore="true"
                                                >
                                                    {(['-', 'SI', 'NO'] as const).map((value) => (
                                                        <option key={value} value={value}>{value}</option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                        <tr><td className="border-r border-slate-300 px-2 py-1">Descripcion del material excluido</td><td className="p-1"><input className={inputClass} value={form.descripcion_material_excluido ?? ''} onChange={(e) => setField('descripcion_material_excluido', e.target.value)} autoComplete="off" data-lpignore="true" /></td></tr>
                                    </tbody>
                                </table>
                            </div>

                            <div className="overflow-hidden rounded-lg border border-slate-300">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-xs font-semibold text-slate-800"><tr><th className="border-b border-r border-slate-300 py-1">Equipos utilizados</th><th className="border-b border-slate-300 py-1">Codigos</th></tr></thead>
                                    <tbody>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1">Balanza 0.1 g</td><td className="border-t border-slate-300 p-1"><select className={inputClass} value={form.balanza_01g_codigo ?? '-'} onChange={(e) => setField('balanza_01g_codigo', e.target.value)}>{withCurrentOption(form.balanza_01g_codigo, EQUIPO_OPTIONS.balanza_01g_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td></tr>
                                        <tr><td className="border-t border-r border-slate-300 px-2 py-1">Horno 110°C</td><td className="border-t border-slate-300 p-1"><select className={inputClass} value={form.horno_110c_codigo ?? '-'} onChange={(e) => setField('horno_110c_codigo', e.target.value)}>{withCurrentOption(form.horno_110c_codigo, EQUIPO_OPTIONS.horno_110c_codigo).map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-lg border border-slate-300">
                            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">Observaciones</div>
                            <div className="p-2"><textarea className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35" rows={3} value={form.observaciones ?? ''} onChange={(e) => setField('observaciones', e.target.value)} autoComplete="off" data-lpignore="true" /></div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_280px] xl:justify-end">
                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Revisado</div>
                                <div className="space-y-2 p-2">
                                    <select className={inputClass} value={form.revisado_por ?? '-'} onChange={(e) => { const v = e.target.value; setField('revisado_por', v); if (v !== '-') { setField('revisado_fecha', normalizeDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }))) } }}>
                                        {REVISORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <input className={inputClass} value={form.revisado_fecha ?? ''} onChange={(e) => setField('revisado_fecha', e.target.value)} onBlur={() => setField('revisado_fecha', normalizeDate(form.revisado_fecha ?? ''))} autoComplete="off" data-lpignore="true" placeholder="Fecha" />
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
                                <div className="border-b border-slate-300 px-2 py-1 text-sm font-semibold">Aprobado</div>
                                <div className="space-y-2 p-2">
                                    <select className={inputClass} value={form.aprobado_por ?? '-'} onChange={(e) => { const v = e.target.value; setField('aprobado_por', v); if (v !== '-') { setField('aprobado_fecha', normalizeDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }))) } }}>
                                        {APROBADORES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                    <input className={inputClass} value={form.aprobado_fecha ?? ''} onChange={(e) => setField('aprobado_fecha', e.target.value)} onBlur={() => setField('aprobado_fecha', normalizeDate(form.aprobado_fecha ?? ''))} autoComplete="off" data-lpignore="true" placeholder="Fecha" />
                                </div>
                            </div>
                        </div>

                        <div className="border-t-2 border-blue-900 px-3 py-2 text-center text-[11px] leading-tight text-slate-700">
                            <p>WEB: www.geofal.com.pe E-MAIL: laboratorio@geofal.com.pe / geofal.sac@gmail.com</p>
                            <p>Av. Maranon 763, Los Olivos-Lima / Telefono 01 522-1851</p>
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
