import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Loader2, RotateCcw, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-auth'
import { getModuleConfigBySlug } from './config'
import {
    DEFAULT_DENSE_INPUT_CLASS,
    DEFAULT_READONLY_INPUT_CLASS,
    DEFAULT_SELECT_CLASS,
    DEFAULT_TEXTAREA_CLASS,
    buildFormatPreview,
    cloneWithDerive,
    downloadBlob,
    getByPath,
    normalizeFlexibleDate,
    normalizeMuestraCode,
    normalizeNumeroOtCode,
} from './helpers'
import type { InputOptions, ModuleConfig, ModuleFormState, RenderTools } from './types'

const DEBOUNCE_MS = 700
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.geofal.com.pe'

interface EnsayoDetail {
    id: number
    payload?: Record<string, unknown> | null
}

interface EnsayoSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
}

async function getEnsayoDetail(apiSlug: string, ensayoId: number): Promise<EnsayoDetail> {
    const url = `${API_URL}/api/${apiSlug}/${ensayoId}`
    const response = await authFetch(url)
    if (!response.ok) {
        throw new Error(`No se pudo cargar el ensayo de ${apiSlug}.`)
    }
    return response.json()
}

async function saveEnsayo(apiSlug: string, payload: Record<string, unknown>, ensayoId?: number): Promise<EnsayoSaveResponse> {
    const url = `${API_URL}/api/${apiSlug}/excel?download=false${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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

async function saveAndDownload(apiSlug: string, payload: Record<string, unknown>, ensayoId?: number): Promise<{ blob: Blob; filename?: string }> {
    const url = `${API_URL}/api/${apiSlug}/excel?download=true${ensayoId ? `&ensayo_id=${ensayoId}` : ''}`
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
        throw new Error(errorData.detail || 'Error al descargar el excel.')
    }
    const blob = await response.blob()
    const contentDisposition = response.headers.get('content-disposition')
    const match = contentDisposition ? contentDisposition.match(/filename="?([^";]+)"?/i) : null
    const filename = match?.[1]
    return { blob, filename }
}

const alignmentClass = (align?: InputOptions['align']) => {
    if (align === 'center') return 'text-center'
    if (align === 'right') return 'text-right'
    return 'text-left'
}

const SHEET_META_INPUT_CLASS =
    '!h-8 !rounded-none !border-0 !bg-transparent !px-2 !text-[13px] !font-medium !text-black !shadow-none focus:!ring-0'

export interface EnsayosEspecialesFormProps {
    ensayoId?: number | null
    moduleSlug: string
    onClose?: () => void
    onSaveSuccess?: () => void
}

export default function EnsayosEspecialesForm({ ensayoId: initialEnsayoId, moduleSlug, onClose, onSaveSuccess }: EnsayosEspecialesFormProps) {
    const [moduleConfig, setModuleConfig] = useState<ModuleConfig | null>(() => getModuleConfigBySlug(moduleSlug))
    const [ensayoId, setEnsayoId] = useState<number | null>(initialEnsayoId ?? null)
    const [form, setForm] = useState<ModuleFormState>({})
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const draftKeyRef = useRef<string | null>(null)

    useEffect(() => {
        const config = getModuleConfigBySlug(moduleSlug)
        setModuleConfig(config)
        if (config) {
            setForm(config.derive(config.defaultState()))
        }
    }, [moduleSlug])

    useEffect(() => {
        if (!moduleConfig) return
        const draftKey = `${moduleConfig.draftKey}:${ensayoId ?? 'new'}`
        draftKeyRef.current = draftKey
        const raw = localStorage.getItem(draftKey)
        if (!raw) return
        try {
            const parsed = JSON.parse(raw) as ModuleFormState
            setForm(moduleConfig.derive({ ...moduleConfig.defaultState(), ...parsed }))
        } catch {
            localStorage.removeItem(draftKey)
        }
    }, [moduleConfig, ensayoId])

    useEffect(() => {
        if (!moduleConfig || !draftKeyRef.current) return
        const timeout = window.setTimeout(() => {
            localStorage.setItem(draftKeyRef.current as string, JSON.stringify(form))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(timeout)
    }, [form, moduleConfig])

    useEffect(() => {
        if (!moduleConfig || !ensayoId) return
        let cancelled = false
        const run = async () => {
            setLoadingEdit(true)
            try {
                const detail = await getEnsayoDetail(moduleConfig.apiSlug, ensayoId)
                if (!cancelled && detail.payload) {
                    setForm(moduleConfig.derive({ ...moduleConfig.defaultState(), ...detail.payload }))
                }
            } catch {
                toast.error(`No se pudo cargar ensayo de ${moduleConfig.title.toLowerCase()}.`)
            } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [ensayoId, moduleConfig])

    const setField = useCallback(
        (path: string, value: unknown) => {
            if (!moduleConfig) return
            setForm((prev) => cloneWithDerive(prev, path, value, moduleConfig.derive))
        },
        [moduleConfig],
    )

    const stringValue = useCallback((path: string) => {
        const value = getByPath(form, path)
        return value === null || value === undefined ? '' : String(value)
    }, [form])

    const numberValue = useCallback((path: string) => {
        const value = getByPath(form, path)
        return typeof value === 'number' && Number.isFinite(value) ? value : null
    }, [form])

    const value = useCallback((path: string) => getByPath(form, path), [form])

    const renderText = useCallback((path: string, options: InputOptions = {}) => (
        <input
            className={`${DEFAULT_DENSE_INPUT_CLASS} ${alignmentClass(options.align)} ${options.className || ''}`.trim()}
            value={stringValue(path)}
            onChange={(event) => setField(path, event.target.value)}
            onBlur={() => {
                if (!options.normalizeOnBlur) return
                setField(path, options.normalizeOnBlur(stringValue(path)))
            }}
            placeholder={options.placeholder}
            autoComplete="off"
            data-lpignore="true"
        />
    ), [setField, stringValue])

    const renderNumber = useCallback((path: string, options: InputOptions = {}) => (
        <input
            type="number"
            className={`${DEFAULT_DENSE_INPUT_CLASS} ${alignmentClass(options.align ?? 'center')} ${options.className || ''}`.trim()}
            value={numberValue(path) ?? ''}
            onChange={(event) => {
                const raw = event.target.value
                setField(path, raw === '' ? null : Number(raw))
            }}
            placeholder={options.placeholder}
            step={options.step || 'any'}
            min={options.min}
            max={options.max}
            autoComplete="off"
            data-lpignore="true"
        />
    ), [numberValue, setField])

    const renderReadonly = useCallback((path: string, options: InputOptions = {}) => (
        <input
            className={`${DEFAULT_READONLY_INPUT_CLASS} ${alignmentClass(options.align ?? 'center')} ${options.className || ''}`.trim()}
            value={stringValue(path)}
            readOnly
            tabIndex={-1}
        />
    ), [stringValue])

    const renderSelect = useCallback((path: string, options: InputOptions & { values: Array<{ label: string; value: string }> }) => (
        <select
            className={`${DEFAULT_SELECT_CLASS} ${alignmentClass(options.align)} ${options.className || ''}`.trim()}
            value={stringValue(path)}
            onChange={(event) => setField(path, event.target.value === '' ? null : event.target.value)}
            autoComplete="off"
            data-lpignore="true"
        >
            {options.values.map((item) => (
                <option key={`${path}-${item.value || 'empty'}`} value={item.value}>
                    {item.label}
                </option>
            ))}
        </select>
    ), [setField, stringValue])

    const renderTextarea = useCallback((path: string, options: InputOptions = {}) => (
        <textarea
            className={`${DEFAULT_TEXTAREA_CLASS} ${options.className || ''}`.trim()}
            value={stringValue(path)}
            onChange={(event) => setField(path, event.target.value)}
            rows={options.rows || 4}
            placeholder={options.placeholder}
            autoComplete="off"
            data-lpignore="true"
        />
    ), [setField, stringValue])

    const tools: RenderTools = {
        text: renderText,
        number: renderNumber,
        readonly: renderReadonly,
        select: renderSelect,
        textarea: renderTextarea,
        value,
        stringValue,
        numberValue,
    }

    const clearAll = useCallback(() => {
        if (!moduleConfig) return
        if (!window.confirm('Se limpiaran los datos no guardados. Deseas continuar?')) return
        localStorage.removeItem(`${moduleConfig.draftKey}:${ensayoId ?? 'new'}`)
        setForm(moduleConfig.derive(moduleConfig.defaultState()))
    }, [ensayoId, moduleConfig])

    const save = useCallback(async (download: boolean) => {
        if (!moduleConfig) return
        const payload = moduleConfig.derive(form) as Record<string, unknown>
        if (!payload.muestra || !payload.numero_ot || !payload.fecha_ensayo || !payload.realizado_por) {
            toast.error('Complete Muestra, N OT, Fecha de ensayo y Realizado.')
            return
        }

        setLoading(true)
        try {
            if (download) {
                const { blob, filename } = await saveAndDownload(moduleConfig.apiSlug, payload, ensayoId ?? undefined)
                downloadBlob(
                    blob,
                    filename || `${buildFormatPreview(String(payload.muestra), moduleConfig.materialCode, moduleConfig.downloadLabel)}.xlsx`,
                )
            } else {
                await saveEnsayo(moduleConfig.apiSlug, payload, ensayoId ?? undefined)
            }

            localStorage.removeItem(`${moduleConfig.draftKey}:${ensayoId ?? 'new'}`)
            setForm(moduleConfig.derive(moduleConfig.defaultState()))
            setEnsayoId(null)
            
            if (onSaveSuccess) {
                onSaveSuccess()
            } else if (onClose) {
                onClose()
            } else {
                if (window.parent !== window) window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
            }
            toast.success(download ? `${moduleConfig.title} guardado y descargado.` : `${moduleConfig.title} guardado.`)
        } catch (error) {
            const message = error instanceof Error ? error.message : `No se pudo generar ${moduleConfig.title}.`
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }, [ensayoId, form, moduleConfig, onClose, onSaveSuccess])

    if (!moduleConfig) {
        return (
            <div className="min-h-screen bg-[#eef1f5] p-6">
                <div className="mx-auto max-w-3xl border border-red-300 bg-white p-6 text-center shadow-sm">
                    <h1 className="text-xl font-bold text-slate-900">Modulo no encontrado</h1>
                    <p className="mt-2 text-sm text-slate-600">La configuracion para el slug {moduleSlug} no fue encontrada.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#eef1f5] p-4 md:p-6">
            <div className="mx-auto max-w-[1280px] space-y-4">
                <div className="flex items-center justify-between gap-3 border border-slate-300 bg-white px-4 py-3 shadow-sm">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Modulo de Laboratorio</p>
                        <h1 className="mt-1 text-base font-semibold text-slate-900 md:text-lg">{moduleConfig.title.toUpperCase()}</h1>
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

                {loadingEdit ? (
                    <div className="flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm text-slate-600 shadow-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando ensayo...
                    </div>
                ) : null}

                <div className="overflow-hidden border border-black bg-white shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
                    <div className="border-b border-black px-4 py-5 text-center">
                        <p className="text-[24px] font-semibold leading-tight tracking-[0.04em] text-black">LABORATORIO DE ENSAYO DE MATERIALES</p>
                        <p className="mt-1 text-lg font-semibold leading-tight text-black">FORMATO N° {moduleConfig.formatCode}</p>
                    </div>

                    <div className="border-b border-black px-3 py-3">
                        <table className="w-full table-fixed border-collapse text-[13px] text-black">
                            <thead className="text-[13px] font-semibold">
                                <tr>
                                    <th className="border border-black px-2 py-1.5">MUESTRA</th>
                                    <th className="border border-black px-2 py-1.5">No OT</th>
                                    <th className="border border-black px-2 py-1.5">FECHA DE ENSAYO</th>
                                    <th className="border border-black px-2 py-1.5">REALIZADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-0">{renderText('muestra', { align: 'center', normalizeOnBlur: normalizeMuestraCode, className: SHEET_META_INPUT_CLASS })}</td>
                                    <td className="border border-black p-0">{renderText('numero_ot', { align: 'center', normalizeOnBlur: normalizeNumeroOtCode, className: SHEET_META_INPUT_CLASS })}</td>
                                    <td className="border border-black p-0">{renderText('fecha_ensayo', { align: 'center', placeholder: 'YYYY/MM/DD', normalizeOnBlur: normalizeFlexibleDate, className: SHEET_META_INPUT_CLASS })}</td>
                                    <td className="border border-black p-0">{renderText('realizado_por', { align: 'center', className: SHEET_META_INPUT_CLASS })}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="border-b border-black px-6 py-4 text-center">
                        <p className="text-[15px] font-semibold leading-tight text-black">{moduleConfig.heading}</p>
                        <p className="mt-1 text-[14px] font-semibold text-black">{moduleConfig.standard}</p>
                    </div>

                    <div className="space-y-4 p-3 md:p-4">{moduleConfig.renderBody(tools)}</div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        onClick={clearAll}
                        disabled={loading}
                    >
                        <RotateCcw className="h-4 w-4" />
                        Limpiar formulario
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 border border-slate-300 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                        onClick={() => void save(false)}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 border border-blue-600 bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                        onClick={() => void save(true)}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Guardar y descargar Excel
                    </button>
                </div>
            </div>
        </div>
    )
}
