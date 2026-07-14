"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { FlaskConical, Beaker, Loader2, Download, Trash2, X, Search, AlertCircle, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { createPortal } from "react-dom"

interface DensidadHuantarPuntoState {
    punto_numero: number
    ubicacion: string
    progresiva: string
    tipo_muestra: string
    espesor_capa: number | undefined
    tamano_maximo: string
    tamiz_sobretamano: string
    descripcion_visual: string
    condiciones_entorno: string
    
    // Mediciones
    masa_inicial_cono: number | undefined
    masa_residual_cono: number | undefined
    masa_humeda_orificio: number | undefined
    masa_sobretamano: number | undefined
    criterio_aceptacion: number | undefined
    humedad_speedy: number | undefined
    humedad_astm: number | undefined
}

interface DensidadHuantarFormState {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string
    cliente: string
    proyecto: string
    ubicacion: string
    cono_codigo: string
    masa_arena_embudo: number | undefined
    densidad_arena: number | undefined
    volumen_cono: number | undefined
    proctor_norma: string
    proctor_metodo: string
    peso_unitario_seco_lab: number | undefined
    humedad_optima: number | undefined
    gravedad_especifica: number | undefined
    observaciones: string
    revisado_por: string
    revisado_fecha: string
    aprobado_por: string
    aprobado_fecha: string
    puntos: DensidadHuantarPuntoState[]
}

const INITIAL_PUNTOS: DensidadHuantarPuntoState[] = Array.from({ length: 4 }, (_, i) => ({
    punto_numero: i + 1,
    ubicacion: "",
    progresiva: "",
    tipo_muestra: "",
    espesor_capa: undefined,
    tamano_maximo: "",
    tamiz_sobretamano: "",
    descripcion_visual: "",
    condiciones_entorno: "",
    masa_inicial_cono: undefined,
    masa_residual_cono: undefined,
    masa_humeda_orificio: undefined,
    masa_sobretamano: undefined,
    criterio_aceptacion: undefined,
    humedad_speedy: undefined,
    humedad_astm: undefined
}))

const INITIAL_STATE: DensidadHuantarFormState = {
    muestra: "",
    numero_ot: "",
    fecha_ensayo: "",
    realizado_por: "",
    cliente: "",
    proyecto: "",
    ubicacion: "",
    cono_codigo: "",
    masa_arena_embudo: undefined,
    densidad_arena: undefined,
    volumen_cono: undefined,
    proctor_norma: "-",
    proctor_metodo: "-",
    peso_unitario_seco_lab: undefined,
    humedad_optima: undefined,
    gravedad_especifica: undefined,
    observaciones: "",
    revisado_por: "-",
    revisado_fecha: "",
    aprobado_por: "-",
    aprobado_fecha: "",
    puntos: INITIAL_PUNTOS
}

const PROCTOR_NORMA_OPTIONS = ["-", "ASTM D1557", "MTC E 115", "ASTM D698"]
const PROCTOR_METODO_OPTIONS = ["-", "A", "B", "C"]
const REVISADO_POR_OPTIONS = ["-", "FABIAN LA ROSA"]
const APROBADO_POR_OPTIONS = ["-", "IRMA COAQUIRA"]

const DRAFT_PREFIX = "densidad_huantar_draft_v1"
const AUTOSAVE_DEBOUNCE_MS = 1000
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

const getDraftStorageKey = (ensayoId: number | undefined) => 
    `${DRAFT_PREFIX}:${ensayoId ?? "new"}`

export default function DensidadHuantarForm({
    ensayoId,
    onClose,
    onSaveSuccess
}: {
    ensayoId?: number
    onClose?: () => void
    onSaveSuccess?: () => void
}) {
    const [form, setForm] = useState<DensidadHuantarFormState>(INITIAL_STATE)
    const [loading, setLoading] = useState(false)
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [showDraftBanner, setShowDraftBanner] = useState(false)
    const [draftData, setDraftData] = useState<DensidadHuantarFormState | null>(null)
    const [isClearDraftModalOpen, setIsClearDraftModalOpen] = useState(false)
    const [pendingFormatAction, setPendingFormatAction] = useState<boolean | null>(null)
    
    // Autocomplete state
    const [searchQuery, setSearchQuery] = useState("")
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const [showSearchDropdown, setShowSearchDropdown] = useState(false)
    
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
    const hydratedFromServerRef = useRef<DensidadHuantarFormState | null>(null)
    const draftStorageKey = useMemo(() => getDraftStorageKey(ensayoId), [ensayoId])

    // Load data for edit or draft check
    useEffect(() => {
        let active = true
        
        const load = async () => {
            if (!ensayoId) {
                // Check local draft for new record
                const rawDraft = localStorage.getItem(draftStorageKey)
                if (rawDraft) {
                    try {
                        const parsed = JSON.parse(rawDraft)
                        if (parsed && parsed.form) {
                            setForm(parsed.form)
                            toast.success("Se restauró un borrador local no guardado.")
                        }
                    } catch (e) {
                        localStorage.removeItem(draftStorageKey)
                    }
                }
                return
            }

            setLoadingEnsayo(true)
            try {
                const res = await authFetch(`${API_URL}/api/densidad-huantar/${ensayoId}`)
                if (!res.ok) throw new Error("No se pudo cargar el ensayo")
                const data = await res.json()
                
                if (data.payload && active) {
                    const serverState: DensidadHuantarFormState = {
                        ...INITIAL_STATE,
                        ...data.payload,
                        puntos: (data.payload.puntos || []).map((p: any, i: number) => ({
                            ...INITIAL_PUNTOS[i],
                            ...p
                        }))
                    }
                    hydratedFromServerRef.current = serverState
                    
                    // Check local draft
                    const rawDraft = localStorage.getItem(draftStorageKey)
                    if (rawDraft) {
                        try {
                            const parsed = JSON.parse(rawDraft)
                            if (parsed && parsed.form && JSON.stringify(parsed.form) !== JSON.stringify(serverState)) {
                                setDraftData(parsed.form)
                                setShowDraftBanner(true)
                            }
                        } catch (e) {
                            localStorage.removeItem(draftStorageKey)
                        }
                    }
                    
                    setForm(serverState)
                    setSearchQuery(serverState.muestra || "")
                }
            } catch (err: any) {
                toast.error(err.message || "Error al cargar los datos.")
            } finally {
                if (active) setLoadingEnsayo(false)
            }
        }

        void load()
        return () => {
            active = false
        }
    }, [ensayoId, draftStorageKey])

    // Autosave draft effect
    useEffect(() => {
        if (loadingEnsayo) return
        
        const timer = setTimeout(() => {
            const isInitial = JSON.stringify(form) === JSON.stringify(INITIAL_STATE)
            const sameAsServer = hydratedFromServerRef.current && JSON.stringify(form) === JSON.stringify(hydratedFromServerRef.current)
            
            if (isInitial || sameAsServer) {
                localStorage.removeItem(draftStorageKey)
                return
            }
            
            localStorage.setItem(draftStorageKey, JSON.stringify({
                version: 1,
                updatedAt: new Date().toISOString(),
                form
            }))
        }, AUTOSAVE_DEBOUNCE_MS)

        return () => clearTimeout(timer)
    }, [form, draftStorageKey, loadingEnsayo])

    const setField = useCallback(<K extends keyof DensidadHuantarFormState>(key: K, val: DensidadHuantarFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: val }))
    }, [])

    const setPointField = useCallback((index: number, key: keyof DensidadHuantarPuntoState, val: any) => {
        setForm(prev => {
            const nextPuntos = [...prev.puntos]
            nextPuntos[index] = { ...nextPuntos[index], [key]: val }
            return { ...prev, puntos: nextPuntos }
        })
    }, [])

    // Autocomplete Handler
    const handleSearchChange = (val: string) => {
        setSearchQuery(val)
        setField("muestra", val)
        
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        
        const term = val.trim()
        if (!term) {
            setSearchResults([])
            setShowSearchDropdown(false)
            return
        }

        searchDebounceRef.current = setTimeout(async () => {
            setSearchLoading(true)
            try {
                const res = await authFetch(`${API_URL}/api/tracing/suggest?q=${encodeURIComponent(term)}`)
                if (res.ok) {
                    const data = await res.json()
                    setSearchResults(data || [])
                    setShowSearchDropdown((data || []).length > 0)
                }
            } catch {
                // ignore
            } finally {
                setSearchLoading(false)
            }
        }, 300)
    }

    // Select Autocomplete result (Proactive Date Sync)
    const selectSuggestion = async (item: any) => {
        setShowSearchDropdown(false)
        setSearchResults([])
        
        const code = item.numero_recepcion || ""
        setSearchQuery(code)
        setField("muestra", code)
        if (item.numero_ot) setField("numero_ot", item.numero_ot)
        if (item.cliente) setField("cliente", item.cliente)
        
        // Sync dates: Parse and format date if present
        if (item.fecha_recepcion) {
            try {
                const dateObj = new Date(item.fecha_recepcion)
                const formattedDate = dateObj.toLocaleDateString("sv-SE", { timeZone: "America/Lima" }).replace(/-/g, "/")
                setField("fecha_ensayo", formattedDate)
            } catch {
                // fallback
            }
        }

        // Fetch full reception to get client/project metadata
        try {
            const res = await authFetch(`${API_URL}/api/recepcion/${item.recepcion_id || item.id}`)
            if (res.ok) {
                const rec = await res.json()
                if (rec.cliente) setField("cliente", rec.cliente)
                if (rec.proyecto) setField("proyecto", rec.proyecto)
                if (rec.ubicacion) setField("ubicacion", rec.ubicacion)
                toast.success("Metadata de muestra importada correctamente.")
            }
        } catch {
            // ignore
        }
    }

    const handleClearLocalData = () => {
        setIsClearDraftModalOpen(true)
    }

    const confirmClearDraft = () => {
        localStorage.removeItem(draftStorageKey)
        setForm(hydratedFromServerRef.current || INITIAL_STATE)
        setSearchQuery(hydratedFromServerRef.current?.muestra || "")
        setIsClearDraftModalOpen(false)
        toast.success("Borrador local limpiado.")
    }

    const handleSave = async (withDownload: boolean) => {
        if (!form.muestra || !form.numero_ot || !form.realizado_por) {
            toast.error("Complete los campos obligatorios: Muestra, N° OT y Realizado por")
            return
        }

        setLoading(true)
        try {
            const url = `${API_URL}/api/densidad-huantar/excel?download=${withDownload}${ensayoId ? `&ensayo_id=${ensayoId}` : ""}`
            const res = await authFetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form)
            })

            if (!res.ok) {
                const errText = await res.text()
                throw new Error(errText || "Error al procesar la solicitud")
            }

            if (withDownload) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `INF-SU-DEN-HUANTAR_${form.muestra}.xlsx`
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
                toast.success("Ensayo guardado y archivo Excel descargado con éxito.")
            } else {
                toast.success("Ensayo guardado con éxito.")
            }

            localStorage.removeItem(draftStorageKey)
            if (onSaveSuccess) onSaveSuccess()
        } catch (err: any) {
            toast.error(err.message || "Error al guardar el ensayo.")
        } finally {
            setLoading(false)
        }
    }

    // Live Calculations Preview
    const computedPuntos = useMemo(() => {
        return form.puntos.map(punto => {
            const masaInicial = punto.masa_inicial_cono
            const masaResidual = punto.masa_residual_cono
            const conoEmbudo = form.masa_arena_embudo
            const densidadArena = form.densidad_arena
            const masaHumeda = punto.masa_humeda_orificio
            const masaSobretamano = punto.masa_sobretamano
            
            let masaArena = null
            let volOrificio = null
            let wUsada = null
            let masaSeca = null
            let densHumeda = null
            let densSeca = null
            let puSeco = null
            let puCorregido = null
            let compactacion = null
            let cumple = null
            let minVol = null

            if (masaInicial != null && masaResidual != null) {
                masaArena = Math.round((masaInicial - masaResidual) * 100) / 100
                
                if (conoEmbudo != null && densidadArena && densidadArena > 0) {
                    volOrificio = Math.round(((masaArena - conoEmbudo) / densidadArena) * 1000) / 1000
                }
            }

            // Determine volume min requirement
            const tMax = (punto.tamano_maximo || "").trim().toLowerCase()
            if (tMax.includes("2 in") || tMax.includes("1 1/2 in") || tMax.includes("1.5")) {
                minVol = 2830
            } else if (tMax.includes("1 in") || tMax.includes("3/4 in") || tMax.includes("0.75")) {
                minVol = 2120
            } else {
                minVol = 1420
            }

            if (volOrificio != null) {
                cumple = volOrificio >= minVol ? "Cumple" : "Justificar"
            }

            if (punto.humedad_speedy != null) {
                wUsada = punto.humedad_speedy
            } else if (punto.humedad_astm != null) {
                wUsada = punto.humedad_astm
            }

            if (masaHumeda != null && wUsada != null && volOrificio) {
                masaSeca = Math.round((100 * masaHumeda / (100 + wUsada)) * 100) / 100
                densHumeda = Math.round((masaHumeda / volOrificio) * 1000) / 1000
                densSeca = Math.round((masaSeca / volOrificio) * 1000) / 1000
                puSeco = Math.round((densSeca * 9.802) * 1000) / 1000
                
                // Sobretamaño correction
                let pctSobretamano = 0
                if (masaSobretamano != null && masaHumeda > 0) {
                    pctSobretamano = (masaSobretamano * 100) / masaHumeda
                }

                const gs = form.gravedad_especifica
                if (!gs || gs === 0) {
                    puCorregido = puSeco
                } else {
                    const num = puSeco * gs * 9.802 * (100 - pctSobretamano)
                    const den = (100 * gs * 9.802) - (puSeco * pctSobretamano)
                    if (den !== 0) {
                        puCorregido = Math.round((num / den) * 1000) / 1000
                    }
                }

                if (puCorregido != null && form.peso_unitario_seco_lab) {
                    compactacion = Math.round((puCorregido * 100 / form.peso_unitario_seco_lab) * 10) / 10
                }
            }

            return {
                masaArena,
                volOrificio,
                minVol,
                cumple,
                densHumeda,
                densSeca,
                puSeco,
                puCorregido,
                compactacion
            }
        })
    }, [form])

    return (
        <div className="max-w-[1780px] mx-auto p-4 md:p-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                        <FlaskConical className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Densidad Huantar — Cono de Arena</h1>
                        <p className="text-sm text-slate-500">Módulo nativo de control de compactación</p>
                        {ensayoId && <p className="text-xs text-indigo-600 font-semibold mt-1">Editando Ensayo #{ensayoId}</p>}
                    </div>
                </div>
                {onClose && (
                    <button 
                        onClick={onClose}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 shadow-sm transition"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Draft banner */}
            {showDraftBanner && draftData && (
                <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm transition animate-in slide-in-from-top-2">
                    <div className="flex gap-2.5 text-amber-800 text-sm">
                        <span className="text-base">⚠️</span>
                        <div>
                            <p className="font-semibold text-amber-900">Borrador local no guardado detectado</p>
                            <p className="text-xs text-amber-700">Hay diferencias entre tu borrador guardado en este navegador y el servidor.</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                setForm(draftData)
                                setShowDraftBanner(false)
                                toast.success("Borrador recuperado.")
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs transition"
                        >
                            Recuperar Borrador
                        </button>
                        <button 
                            onClick={() => {
                                localStorage.removeItem(draftStorageKey)
                                setShowDraftBanner(false)
                                setDraftData(null)
                                toast.success("Borrador descartado.")
                            }}
                            className="border border-amber-300 bg-white text-amber-800 hover:bg-amber-50 px-3.5 py-1.5 rounded-lg text-xs transition"
                        >
                            Descartar
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* Section 1: Encabezado */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                    <div className="border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                        <span className="text-indigo-600">⚡</span>
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Encabezado General</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                        {/* Autocomplete Input Container - MUST USE overflow-visible parent */}
                        <div className="relative overflow-visible">
                            <label className="block text-xs font-bold text-slate-600 mb-1">Muestra *</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    placeholder="Buscar o escribir código..."
                                    autoComplete="off"
                                    data-lpignore="true"
                                    className="w-full h-9 pl-3 pr-8 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            </div>
                            
                            {/* Suggestions drop-down menu */}
                            {showSearchDropdown && searchResults.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                    {searchResults.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => void selectSuggestion(item)}
                                            className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-b-0 text-left transition-colors"
                                        >
                                            <p className="text-xs font-bold text-slate-900">{item.numero_recepcion}</p>
                                            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{item.cliente} • {item.proyecto}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Número OT *</label>
                            <input
                                type="text"
                                value={form.numero_ot}
                                onChange={(e) => setField("numero_ot", e.target.value.toUpperCase())}
                                placeholder="Ej: 1234-26"
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Cliente</label>
                            <input
                                type="text"
                                value={form.cliente || ""}
                                onChange={(e) => setField("cliente", e.target.value)}
                                placeholder="Cliente"
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Proyecto</label>
                            <input
                                type="text"
                                value={form.proyecto || ""}
                                onChange={(e) => setField("proyecto", e.target.value)}
                                placeholder="Proyecto"
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Fecha Ensayo</label>
                            <input
                                type="text"
                                value={form.fecha_ensayo}
                                onChange={(e) => setField("fecha_ensayo", e.target.value)}
                                placeholder="YYYY/MM/DD"
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Realizado por *</label>
                            <input
                                type="text"
                                value={form.realizado_por}
                                onChange={(e) => setField("realizado_por", e.target.value.toUpperCase())}
                                placeholder="Nombre de operador"
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 2: Calibración y Proctor */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                    <div className="border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                        <span className="text-indigo-600">📐</span>
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Parámetros del Cono y Proctor (Calibración)</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Identificación Cono N°</label>
                            <input
                                type="text"
                                value={form.cono_codigo || ""}
                                onChange={(e) => setField("cono_codigo", e.target.value)}
                                placeholder="Ej: CONO-01"
                                autoComplete="off"
                                data-lpignore="true"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Masa arena embudo (g)</label>
                            <input
                                type="number"
                                step="any"
                                value={form.masa_arena_embudo ?? ""}
                                onChange={(e) => setField("masa_arena_embudo", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                placeholder="1530"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Densidad arena (g/cm3)</label>
                            <input
                                type="number"
                                step="any"
                                value={form.densidad_arena ?? ""}
                                onChange={(e) => setField("densidad_arena", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                placeholder="1.45"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Volumen cono (cm3)</label>
                            <input
                                type="number"
                                step="any"
                                value={form.volumen_cono ?? ""}
                                onChange={(e) => setField("volumen_cono", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                placeholder="1420"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Proctor Norma</label>
                            <select
                                value={form.proctor_norma}
                                onChange={(e) => setField("proctor_norma", e.target.value)}
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 select-wrapper"
                            >
                                {PROCTOR_NORMA_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Proctor Método</label>
                            <select
                                value={form.proctor_metodo}
                                onChange={(e) => setField("proctor_metodo", e.target.value)}
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 select-wrapper"
                            >
                                {PROCTOR_METODO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">P.U. Seco Max. Lab (kN/m3)</label>
                            <input
                                type="number"
                                step="any"
                                value={form.peso_unitario_seco_lab ?? ""}
                                onChange={(e) => setField("peso_unitario_seco_lab", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                placeholder="21.20"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Humedad Óptima (%)</label>
                            <input
                                type="number"
                                step="any"
                                value={form.humedad_optima ?? ""}
                                onChange={(e) => setField("humedad_optima", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                placeholder="10.5"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-505 mb-1">Gs Proctor (P)</label>
                            <input
                                type="number"
                                step="any"
                                value={form.gravedad_especifica ?? ""}
                                onChange={(e) => setField("gravedad_especifica", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                placeholder="2.68"
                                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Section 3: Puntos de Ensayo (1 al 4) */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 overflow-visible">
                    <div className="border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
                        <span className="text-indigo-600">📊</span>
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Puntos del Ensayo (Mediciones y Cálculos)</h2>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full min-w-[800px] table-fixed text-sm border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-200">
                                    <th className="w-64 px-4 py-3 text-left border-r border-slate-200">DESCRIPCIÓN</th>
                                    <th className="w-20 px-2 py-3 text-center border-r border-slate-200">UND</th>
                                    {form.puntos.map((p, idx) => (
                                        <th key={idx} className="px-3 py-3 text-center border-r border-slate-200 last:border-r-0 bg-indigo-50/40 text-indigo-900 font-extrabold">
                                            PUNTO {p.punto_numero}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Ubicación */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">Ubicación</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">—</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="text"
                                                value={p.ubicacion}
                                                onChange={(e) => setPointField(idx, "ubicacion", e.target.value)}
                                                placeholder="Ej: Eje B-C"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* Progresiva */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">Progresiva / Cota / Lado</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">—</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="text"
                                                value={p.progresiva}
                                                onChange={(e) => setPointField(idx, "progresiva", e.target.value)}
                                                placeholder="Ej: Km 0+150"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* Tipo de muestra */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">Tipo de muestra</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">—</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="text"
                                                value={p.tipo_muestra}
                                                onChange={(e) => setPointField(idx, "tipo_muestra", e.target.value)}
                                                placeholder="Ej: Suelo afirmado"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* Espesor de capa */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">Espesor de capa</td>
                                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200">cm</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.espesor_capa ?? ""}
                                                onChange={(e) => setPointField(idx, "espesor_capa", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="15.0"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* Tamaño máximo */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200 font-semibold text-slate-800">Tamaño máximo identificado</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">—</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="text"
                                                value={p.tamano_maximo}
                                                onChange={(e) => setPointField(idx, "tamano_maximo", e.target.value)}
                                                placeholder="Ej: 3/4 in"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* Tamiz sobretamaño */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">Tamiz del sobretamaño</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">—</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="text"
                                                value={p.tamiz_sobretamano}
                                                onChange={(e) => setPointField(idx, "tamiz_sobretamano", e.target.value)}
                                                placeholder="Ej: 3/4 in"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* Descripción visual */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">Descripción visual</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">—</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="text"
                                                value={p.descripcion_visual}
                                                onChange={(e) => setPointField(idx, "descripcion_visual", e.target.value)}
                                                placeholder="Ej: Grava limosa"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* Condiciones entorno */}
                                <tr className="border-b border-slate-205 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">Condiciones de entorno</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">—</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="text"
                                                value={p.condiciones_entorno}
                                                onChange={(e) => setPointField(idx, "condiciones_entorno", e.target.value)}
                                                placeholder="Ej: Soleado"
                                                autoComplete="off"
                                                data-lpignore="true"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* MEDICIONES (F LEM2) */}
                                <tr className="bg-indigo-50/20 border-b border-slate-200">
                                    <td colSpan={6} className="px-4 py-2.5 text-xs font-bold text-indigo-900">
                                        MEDICIONES OPERATIVAS (F LEM2)
                                    </td>
                                </tr>

                                {/* (A) Masa inicial del cono */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">(A) Masa inicial del cono más arena</td>
                                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200">g</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.masa_inicial_cono ?? ""}
                                                onChange={(e) => setPointField(idx, "masa_inicial_cono", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="e.g. 7000"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* (B) Masa residual del cono */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">(B) Masa residual del cono más arena</td>
                                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200">g</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.masa_residual_cono ?? ""}
                                                onChange={(e) => setPointField(idx, "masa_residual_cono", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="e.g. 3500"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* (F) Masa húmeda del orificio */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">(F) Masa húmeda del material del orificio</td>
                                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200">g</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.masa_humeda_orificio ?? ""}
                                                onChange={(e) => setPointField(idx, "masa_humeda_orificio", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="e.g. 4200"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* (H) Masa de sobretamaño */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">(H) Masa de sobretamaño</td>
                                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200">g</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.masa_sobretamano ?? ""}
                                                onChange={(e) => setPointField(idx, "masa_sobretamano", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="0.0"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* CRITERIO DE ACEPTACIÓN (*) */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-semibold text-slate-700 border-r border-slate-200">CRITERIO DE ACEPTACIÓN (*)</td>
                                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200">%</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.criterio_aceptacion ?? ""}
                                                onChange={(e) => setPointField(idx, "criterio_aceptacion", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="95.0"
                                                className="w-full h-8 px-2 border border-indigo-200 rounded text-xs bg-indigo-50/20 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* (w*) Contenido de agua SPEEDY (***) */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">(w*) Contenido de agua SPEEDY (***)</td>
                                    <td className="px-2 py-2 text-center text-slate-505 border-r border-slate-200">%</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.humedad_speedy ?? ""}
                                                onChange={(e) => setPointField(idx, "humedad_speedy", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="e.g. 9.2"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* (w) Contenido de agua ASTM D2216 */}
                                <tr className="border-b border-slate-205 hover:bg-slate-50/30">
                                    <td className="px-4 py-2 font-medium text-slate-700 border-r border-slate-200">(w) Contenido de agua (ASTM D2216)</td>
                                    <td className="px-2 py-2 text-center text-slate-505 border-r border-slate-200">%</td>
                                    {form.puntos.map((p, idx) => (
                                        <td key={idx} className="px-2 py-1.5 border-r border-slate-200 last:border-r-0">
                                            <input
                                                type="number"
                                                step="any"
                                                value={p.humedad_astm ?? ""}
                                                onChange={(e) => setPointField(idx, "humedad_astm", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                                                placeholder="e.g. 9.4"
                                                className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </td>
                                    ))}
                                </tr>

                                {/* CÁLCULOS PREVISTOS EN VIVO */}
                                <tr className="bg-emerald-50/30 border-b border-slate-200">
                                    <td colSpan={6} className="px-4 py-2.5 text-xs font-bold text-emerald-950">
                                        CÁLCULOS E INFERENCIAS EN VIVO (PREVIAS)
                                    </td>
                                </tr>

                                {/* Masa arena utilizada */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30 text-xs">
                                    <td className="px-4 py-2 text-slate-600 border-r border-slate-200">Masa arena utilizada</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">g</td>
                                    {computedPuntos.map((cp, idx) => (
                                        <td key={idx} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0 text-slate-500 bg-slate-50/50">
                                            {cp.masaArena ?? "—"}
                                        </td>
                                    ))}
                                </tr>

                                {/* Volumen orificio */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30 text-xs">
                                    <td className="px-4 py-2 text-slate-600 border-r border-slate-200">Volumen del orificio</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">cm3</td>
                                    {computedPuntos.map((cp, idx) => (
                                        <td key={idx} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0 text-slate-500 bg-slate-50/50">
                                            {cp.volOrificio ?? "—"}
                                        </td>
                                    ))}
                                </tr>

                                {/* Cumple Volumen */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30 text-xs">
                                    <td className="px-4 py-2 text-slate-600 border-r border-slate-200">Volumen mínimo MTC</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">cm3</td>
                                    {computedPuntos.map((cp, idx) => (
                                        <td key={idx} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0 text-slate-500 bg-slate-50/50">
                                            {cp.minVol ? `${cp.minVol} (${cp.cumple || "—"})` : "—"}
                                        </td>
                                    ))}
                                </tr>

                                {/* Peso Unitario Seco */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30 text-xs">
                                    <td className="px-4 py-2 text-slate-600 border-r border-slate-200">Peso Unitario Seco</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">g/cm3</td>
                                    {computedPuntos.map((cp, idx) => (
                                        <td key={idx} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0 text-slate-500 bg-slate-50/50">
                                            {cp.puSeco ?? "—"}
                                        </td>
                                    ))}
                                </tr>

                                {/* Peso Unitario Corregido */}
                                <tr className="border-b border-slate-100 hover:bg-slate-50/30 text-xs">
                                    <td className="px-4 py-2 text-slate-600 border-r border-slate-200 font-semibold">Peso Unitario Corregido (ASTM D4718)</td>
                                    <td className="px-2 py-2 text-center text-slate-400 border-r border-slate-200">kN/m3</td>
                                    {computedPuntos.map((cp, idx) => (
                                        <td key={idx} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0 font-semibold text-slate-700 bg-slate-50/50">
                                            {cp.puCorregido ?? "—"}
                                        </td>
                                    ))}
                                </tr>

                                {/* Porcentaje compactación */}
                                <tr className="hover:bg-slate-50/30 text-xs border-b border-slate-200">
                                    <td className="px-4 py-2 text-emerald-900 font-bold border-r border-slate-200 bg-emerald-50/10">Compactación Obtenida</td>
                                    <td className="px-2 py-2 text-center text-slate-500 border-r border-slate-200 bg-emerald-50/10">%</td>
                                    {computedPuntos.map((cp, idx) => (
                                        <td key={idx} className="px-3 py-2 text-center border-r border-slate-200 last:border-r-0 font-extrabold text-emerald-700 bg-emerald-50/20">
                                            {cp.compactacion != null ? `${cp.compactacion}%` : "—"}
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Section 4: Observaciones y Footer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <div className="border-b border-slate-100 pb-3 mb-4">
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Observaciones</h2>
                        </div>
                        <textarea
                            value={form.observaciones}
                            onChange={(e) => setField("observaciones", e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 bg-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            placeholder="Ingrese observaciones sobre el ensayo..."
                        />
                    </div>

                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                        <div className="border-b border-slate-100 pb-3 mb-4">
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Revisado y Aprobado</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Revisado por</label>
                                <select
                                    value={form.revisado_por}
                                    onChange={(e) => {
                                        setField("revisado_por", e.target.value)
                                        if (e.target.value !== "-") {
                                            setField("revisado_fecha", new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" }).replace(/-/g, "/"))
                                        }
                                    }}
                                    className="w-full h-9 px-3 border border-slate-200 bg-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 select-wrapper"
                                >
                                    {REVISADO_POR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-505 mb-1">Fecha revisión</label>
                                <input
                                    type="text"
                                    value={form.revisado_fecha}
                                    onChange={(e) => setField("revisado_fecha", e.target.value)}
                                    placeholder="YYYY/MM/DD"
                                    className="w-full h-9 px-3 border border-slate-200 bg-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Aprobado por</label>
                                <select
                                    value={form.aprobado_por}
                                    onChange={(e) => {
                                        setField("aprobado_por", e.target.value)
                                        if (e.target.value !== "-") {
                                            setField("aprobado_fecha", new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" }).replace(/-/g, "/"))
                                        }
                                    }}
                                    className="w-full h-9 px-3 border border-slate-200 bg-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 select-wrapper"
                                >
                                    {APROBADO_POR_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-505 mb-1">Fecha aprobación</label>
                                <input
                                    type="text"
                                    value={form.aprobado_fecha}
                                    onChange={(e) => setField("aprobado_fecha", e.target.value)}
                                    placeholder="YYYY/MM/DD"
                                    className="w-full h-9 px-3 border border-slate-200 bg-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200">
                    <button
                        onClick={handleClearLocalData}
                        disabled={loading}
                        className="h-11 px-6 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Limpiar Datos
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={() => setPendingFormatAction(false)}
                        disabled={loading}
                        className="h-11 px-6 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-lg shadow-sm transition flex items-center justify-center gap-2"
                    >
                        {loading && pendingFormatAction === false ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
                        ) : (
                            "Guardar Borrador"
                        )}
                    </button>
                    <button
                        onClick={() => setPendingFormatAction(true)}
                        disabled={loading}
                        className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                        {loading && pendingFormatAction === true ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> Procesando...</>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                Guardar y Descargar Excel
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Clear Draft Confirm Modal */}
            <ConfirmActionModal
                isOpen={isClearDraftModalOpen}
                title="Limpiar datos no guardados"
                message="Se limpiarán todos los datos locales no guardados de este ensayo. Esta acción no se puede deshacer. ¿Deseas continuar?"
                confirmText="Sí, limpiar"
                cancelText="Cancelar"
                onConfirm={confirmClearDraft}
                onCancel={() => setIsClearDraftModalOpen(false)}
            />

            {/* Format Confirm Modal */}
            {pendingFormatAction !== null && (
                <FormatConfirmModal
                    open={pendingFormatAction !== null}
                    formatLabel={`INF-SU-DEN-HUANTAR_${form.muestra || "MUESTRA"}`}
                    actionLabel={pendingFormatAction ? "Guardar y Descargar" : "Guardar"}
                    onClose={() => setPendingFormatAction(null)}
                    onConfirm={() => {
                        const download = pendingFormatAction!
                        setPendingFormatAction(null)
                        void handleSave(download)
                    }}
                />
            )}
        </div>
    )
}

// Reusable Confirm Modal
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}

// Format Confirm Modal
function FormatConfirmModal({
    open,
    formatLabel,
    actionLabel,
    onClose,
    onConfirm
}: {
    open: boolean
    formatLabel: string
    actionLabel: string
    onClose: () => void
    onConfirm: () => void
}) {
    if (!open) return null

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-slate-900">Confirmar Acción</h3>
                <p className="text-sm text-slate-500 mt-2">
                    Se procederá a realizar la acción: <strong className="text-slate-800">{actionLabel}</strong> para el reporte:
                </p>
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 text-center font-semibold">
                    {formatLabel}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition"
                    >
                        Aceptar
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    )
}
