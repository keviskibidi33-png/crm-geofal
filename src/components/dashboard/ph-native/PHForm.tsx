import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Beaker, Download, Loader2, Save, Trash2, X } from 'lucide-react'
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

const MODULE_TITLE = 'pH'
const DRAFT_KEY = 'ph_form_draft_v2'
const DEBOUNCE_MS = 700
const SECADO_OPTIONS = ['', 'X'] as const
const REVISORES = ['-', 'FABIAN LA ROSA'] as const
const APROBADORES = ['-', 'IRMA COAQUIRA'] as const
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

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

export type PhPayload = {
    muestra: string
    numero_ot: string
    cliente?: string | null
    fecha_ensayo: string
    realizado_por: string
    condicion_secado_aire: string
    condicion_secado_horno: string
    temperatura_ensayo_c: number | null
    ph_resultado: number | null
    observaciones: string
    equipo_horno_codigo: string
    equipo_balanza_001_codigo: string
    equipo_ph_metro_codigo: string
    revisado_por: string
    revisado_fecha: string
    aprobado_por: string
    aprobado_fecha: string
}

const initialState = (): PhPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    condicion_secado_aire: '',
    condicion_secado_horno: '',
    temperatura_ensayo_c: null,
    ph_resultado: null,
    observaciones: '',
    equipo_horno_codigo: '',
    equipo_balanza_001_codigo: '',
    equipo_ph_metro_codigo: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const hydrateForm = (payload?: Partial<PhPayload>): PhPayload => {
    const base = initialState()
    if (!payload) return base

    return {
        ...base,
        ...payload,
        condicion_secado_aire: payload.condicion_secado_aire ?? base.condicion_secado_aire,
        condicion_secado_horno: payload.condicion_secado_horno ?? base.condicion_secado_horno,
        temperatura_ensayo_c: payload.temperatura_ensayo_c ?? base.temperatura_ensayo_c,
        ph_resultado: payload.ph_resultado ?? base.ph_resultado,
        observaciones: payload.observaciones ?? base.observaciones,
        equipo_horno_codigo: payload.equipo_horno_codigo ?? base.equipo_horno_codigo,
        equipo_balanza_001_codigo: payload.equipo_balanza_001_codigo ?? base.equipo_balanza_001_codigo,
        equipo_ph_metro_codigo: payload.equipo_ph_metro_codigo ?? base.equipo_ph_metro_codigo,
        revisado_por: payload.revisado_por ?? base.revisado_por,
        revisado_fecha: payload.revisado_fecha ?? base.revisado_fecha,
        aprobado_por: payload.aprobado_por ?? base.aprobado_por,
        aprobado_fecha: payload.aprobado_fecha ?? base.aprobado_fecha,
    }
}

export interface PHFormProps {
    editId?: number | null
    onClose?: () => void
    onSaved?: () => void
}

export default function PHForm({ editId, onClose, onSaved }: PHFormProps) {
    const [form, setForm] = useState<PhPayload>(() => initialState())
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

    useEffect(() => {
        setEditingEnsayoId(editId ?? null)
    }, [editId])

    useEffect(() => {
        if (editingEnsayoId) return
        const raw = localStorage.getItem(`${DRAFT_KEY}:new`)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as Partial<PhPayload>
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
                const res = await authFetch(`${API_URL}/api/ph/${editingEnsayoId}`)
                if (!res.ok) throw new Error('Error al cargar')
                const detail = await res.json()
                if (!cancel && detail) {
                    const payload = detail.payload || (detail as any)
                    const merged: PhPayload = {
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
                toast.error('No se pudo cargar ensayo de pH.')
            } finally {
                if (!cancel) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancel = true
        }
    }, [editingEnsayoId])

    const setField = useCallback(<K extends keyof PhPayload>(key: K, value: PhPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }, [])

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
            if (!form.muestra || !form.numero_ot || !form.fecha_ensayo) {
                toast.error('Complete Muestra, N OT y Fecha de ensayo.')
                return
            }
            setLoading(true)
            try {
                const payload: PhPayload = {
                    ...form,
                }

                let savedId = editingEnsayoId

                if (download) {
                    const url = `${API_URL}/api/ph/excel?download=true${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
                    const res = await authFetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    })
                    if (!res.ok) throw new Error('Error al generar Excel')
                    const blob = await res.blob()
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `${buildFormatPreview(form.muestra, 'SU', 'PH')}.xlsx`
                    link.click()
                    URL.revokeObjectURL(link.href)

                    localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                    toast.success('pH guardado y descargado.')
                    onSaved?.()
                    onClose?.()
                } else {
                    const url = `${API_URL}/api/ph/excel?download=false${editingEnsayoId ? `&ensayo_id=${editingEnsayoId}` : ''}`
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
                    toast.success('pH guardado. Puedes seguir editando.')
                    onSaved?.()
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'Error al guardar ensayo pH'
                toast.error(msg)
            } finally {
                setLoading(false)
            }
        },
        [editingEnsayoId, form, onClose, onSaved],
    )

    const denseInputClass =
        'h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35'

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
                                Determinación del pH — NTP 339.176
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">Formato Oficial F-LEM-P-SU-03.01</p>
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

                {loadingEdit ? (
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando ensayo...
                    </div>
                ) : null}

                <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                    <div className="border-b border-slate-300 bg-slate-50 px-4 py-4 text-center">
                        <p className="text-[24px] font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                        <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-SU-03.01</p>
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
                        <p className="text-[14px] font-semibold leading-tight text-slate-900">
                            MÉTODO DE ENSAYO NORMALIZADO PARA LA DETERMINACIÓN DEL VALOR PH EN SUELOS Y AGUA SUBTERRÁNEA
                        </p>
                        <p className="text-[13px] font-semibold text-slate-900">NORMA NTP 339.176</p>
                    </div>

                    <div className="p-3">
                        <div className="mx-auto mb-5 w-full max-w-85 overflow-hidden rounded-lg border border-slate-300">
                            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 text-center">
                                CONDICIONES DE SECADO
                            </div>
                            <table className="w-full table-fixed text-sm">
                                <tbody>
                                    {[
                                        { label: 'SECADO AL AIRE', key: 'condicion_secado_aire' as const },
                                        { label: 'SECADO EN HORNO 60°C', key: 'condicion_secado_horno' as const },
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

                        <div className="mx-auto mb-6 w-full max-w-132.5 overflow-hidden rounded-lg border border-slate-300">
                            <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 text-center">
                                RESULTADOS DE ENSAYO
                            </div>
                            <table className="w-full table-fixed text-sm">
                                <tbody>
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">Temperatura de Ensayo</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs">(°C)</td>
                                        <td className="border-t border-slate-300 p-1">
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.temperatura_ensayo_c ?? ''}
                                                onChange={(e) => setField('temperatura_ensayo_c', parseNum(e.target.value))}
                                            />
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">PH</td>
                                        <td className="border-t border-r border-slate-300 px-2 py-1 text-center text-xs"></td>
                                        <td className="border-t border-slate-300 p-1">
                                            <input
                                                type="number"
                                                step="any"
                                                className={denseInputClass}
                                                value={form.ph_resultado ?? ''}
                                                onChange={(e) => setField('ph_resultado', parseNum(e.target.value))}
                                            />
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="mx-auto mb-5 w-full max-w-190 rounded-lg border border-slate-300 bg-white p-3">
                            <div className="mb-2 text-xs font-semibold text-slate-800">Observaciones:</div>
                            <textarea
                                className="w-full resize-none rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/35"
                                rows={2}
                                value={form.observaciones}
                                onChange={(e) => setField('observaciones', e.target.value)}
                                autoComplete="off"
                                data-lpignore="true"
                            />
                        </div>

                        <div className="mx-auto mb-5 w-full max-w-107.5 overflow-hidden rounded-lg border border-slate-300">
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
                                        { label: 'PH-Metro', key: 'equipo_ph_metro_codigo' as const },
                                    ].map((row) => (
                                        <tr key={row.key}>
                                            <td className="border-t border-r border-slate-300 px-2 py-1 text-xs">{row.label}</td>
                                            <td className="border-t border-slate-300 p-1">
                                                <input
                                                    className={denseInputClass}
                                                    value={form[row.key]}
                                                    onChange={(e) => setField(row.key, e.target.value)}
                                                    autoComplete="off"
                                                    data-lpignore="true"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mx-auto mt-6 grid max-w-190 grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="rounded-lg border border-slate-300 bg-white p-3">
                                <div className="mb-3 text-xl leading-none text-slate-900">Revisado:</div>
                                <select
                                    className={denseInputClass}
                                    value={form.revisado_por || '-'}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        setField('revisado_por', v)
                                        if (v !== '-') {
                                            setField('revisado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                        }
                                    }}
                                    autoComplete="off"
                                    data-lpignore="true"
                                >
                                    {REVISORES.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                                <div className="mb-3 mt-4 text-xl leading-none text-slate-900">Fecha:</div>
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
                            <div className="rounded-lg border border-slate-300 bg-white p-3">
                                <div className="mb-3 text-xl leading-none text-slate-900">Aprobado:</div>
                                <select
                                    className={denseInputClass}
                                    value={form.aprobado_por || '-'}
                                    onChange={(e) => {
                                        const v = e.target.value
                                        setField('aprobado_por', v)
                                        if (v !== '-') {
                                            setField('aprobado_fecha', normalizeFlexibleDate(new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })))
                                        }
                                    }}
                                    autoComplete="off"
                                    data-lpignore="true"
                                >
                                    {APROBADORES.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                                <div className="mb-3 mt-4 text-xl leading-none text-slate-900">Fecha:</div>
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
