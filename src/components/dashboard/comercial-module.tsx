"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { User, ModuleType } from "@/hooks/use-auth"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { DialogFullscreen as Dialog, DialogFullscreenContent as DialogContent } from "@/components/ui/dialog-fullscreen"
import { Button } from "@/components/ui/button"
import {
    Clock,
    CheckCircle2,
    AlertTriangle,
    ExternalLink,
    X,
    Briefcase,
    BarChart3,
    Loader2,
    Zap,
    History,
    Shield,
    FileSearch,
    Users,
    FolderKanban,
    FileText
} from "lucide-react"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabaseClient"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { toast } from "sonner"
import { resolveFrontendModuleUrl } from "@/lib/frontend-url"

interface ComercialModuleProps {
    user: User
    onNavigateModule?: (module: ModuleType) => void
}

const TOKEN_BRIDGE_TRACE_PREFIX = "[ComercialTokenBridge]"
const BRIDGE_DEBUG_LOGS = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEBUG_IFRAME_BRIDGE === "true"

const bridgeInfo = (message: string, payload?: unknown) => {
    if (BRIDGE_DEBUG_LOGS) {
        console.info(`${TOKEN_BRIDGE_TRACE_PREFIX} ${message}`, payload)
    }
}

const bridgeWarn = (message: string, payload?: unknown) => {
    if (BRIDGE_DEBUG_LOGS) {
        console.warn(`${TOKEN_BRIDGE_TRACE_PREFIX} ${message}`, payload)
    }
}

export function ComercialModule({ user, onNavigateModule }: ComercialModuleProps) {
    const { kpis, recentChanges, isLoading, realtimeStatus } = useProgramacionData()
    const [isOpen, setIsOpen] = useState(false)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [iframeToken, setIframeToken] = useState<string | null>(null)
    const [iframeReloadKey, setIframeReloadKey] = useState(0)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    // KPIs come pre-computed from the hook (lightweight count queries)
    const stats = { total: kpis.total, atrasados: kpis.atrasados, pendientesEnvio: 0, totalMes: kpis.total }

    const canWrite = user.permissions?.comercial?.write === true || user.role === "admin"

    const getStoredAccessToken = useCallback((): string | null => {
        if (typeof window === "undefined") return null
        const direct = localStorage.getItem("token")
        if (direct) return direct

        const extractToken = (parsed: any): string | null => {
            if (!parsed) return null
            if (typeof parsed?.access_token === "string" && parsed.access_token) return parsed.access_token
            if (typeof parsed?.currentSession?.access_token === "string" && parsed.currentSession.access_token) return parsed.currentSession.access_token
            if (typeof parsed?.session?.access_token === "string" && parsed.session.access_token) return parsed.session.access_token
            if (Array.isArray(parsed) && typeof parsed[0]?.access_token === "string" && parsed[0].access_token) return parsed[0].access_token
            return null
        }

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue
            const raw = localStorage.getItem(key)
            if (!raw) continue
            try {
                const parsed = JSON.parse(raw)
                const token = extractToken(parsed)
                if (token) return token
            } catch {
                // ignore malformed entries
            }
        }
        return null
    }, [])

    const syncIframeToken = useCallback(async (reason = "generic"): Promise<string | null> => {
        const startedAt = Date.now()
        const { data: { session } } = await supabase.auth.getSession()
        const sessionToken = session?.access_token ?? null
        const localToken = getStoredAccessToken()
        let freshToken = sessionToken ?? localToken

        if (!freshToken) {
            try {
                const { data } = await supabase.auth.refreshSession()
                freshToken = data?.session?.access_token ?? getStoredAccessToken()
            } catch {
                // ignore refresh failures; fallback chain continues
            }
        }

        if (freshToken && typeof window !== "undefined") {
            localStorage.setItem("token", freshToken)
        }
        setAccessToken(freshToken)
        bridgeInfo("syncIframeToken", {
            reason,
            session: !!sessionToken,
            local: !!localToken,
            resolved: !!freshToken,
            elapsedMs: Date.now() - startedAt,
        })
        return freshToken
    }, [getStoredAccessToken])

    useEffect(() => {
        syncIframeToken("mount")
    }, [syncIframeToken])

    const handleIframeSessionFailure = useCallback((reason: string) => {
        bridgeWarn("preserving shell session after iframe auth failure", {
            reason,
        })
        setIsOpen(false)
        setIframeToken(null)
        setIframeReloadKey((current) => current + 1)
        toast.error("No se pudo renovar la sesión del módulo. Vuelve a abrirlo.")
    }, [])

    const iframeUrl = useMemo(() => {
        const fallbackUrl = process.env.NODE_ENV === "production"
            ? "https://comercial.geofal.com.pe"
            : "http://localhost:8474"
        return resolveFrontendModuleUrl(
            process.env.NEXT_PUBLIC_PROGRAMACION_COMERCIAL_URL || process.env.NEXT_PUBLIC_PROGRAMACION_URL,
            fallbackUrl,
            "programacion-comercial",
        )
    }, [])

    const iframeOrigin = useMemo(() => {
        try {
            return new URL(iframeUrl).origin
        } catch {
            return null
        }
    }, [iframeUrl])

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!isOpen || !event.source) return
            if (iframeOrigin && event.origin !== iframeOrigin) return
            if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return

            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                const requestId = typeof event.data?.requestId === "string" ? event.data.requestId : undefined
                const immediateToken = accessToken || getStoredAccessToken()
                if (immediateToken) {
                    ;(event.source as Window).postMessage(
                        { type: 'TOKEN_REFRESH', token: immediateToken, requestId, source: 'comercial_module_immediate' },
                        event.origin
                    )
                    bridgeInfo("immediate token response", {
                        requestId,
                        origin: event.origin,
                    })
                }

                syncIframeToken(`request:${requestId || "none"}`).then((freshToken) => {
                    if (freshToken && event.source) {
                        (event.source as Window).postMessage(
                            { type: 'TOKEN_REFRESH', token: freshToken, requestId, source: 'comercial_module_sync' },
                            event.origin
                        )
                        bridgeInfo("refreshed token response", {
                            requestId,
                            origin: event.origin,
                        })
                    } else {
                        console.error(`${TOKEN_BRIDGE_TRACE_PREFIX} token refresh failed for iframe request`, {
                            requestId,
                            origin: event.origin,
                        })
                    }
                })
            }

            if (event.data?.type === 'AUTH_REQUIRED') {
                console.error(`${TOKEN_BRIDGE_TRACE_PREFIX} AUTH_REQUIRED received from iframe`, {
                    requestId: event.data?.requestId,
                    debug: event.data?.debug,
                    origin: event.origin,
                })
                syncIframeToken(`auth-required:${event.data?.requestId || "none"}`).then((freshToken) => {
                    if (freshToken && event.source) {
                        (event.source as Window).postMessage(
                            { type: 'TOKEN_REFRESH', token: freshToken, requestId: event.data?.requestId, source: 'comercial_module_recovery' },
                            event.origin
                        )
                        return
                    }
                    handleIframeSessionFailure(`auth_required:${event.data?.requestId || "none"}`)
                })
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [accessToken, getStoredAccessToken, handleIframeSessionFailure, iframeOrigin, isOpen, syncIframeToken])

    const isAdmin = user.role === "admin"
    const fullUrl = useMemo(() => {
        const url = new URL(iframeUrl)
        url.searchParams.set("mode", "comercial")
        url.searchParams.set("userId", user.id)
        url.searchParams.set("role", user.role)
        url.searchParams.set("canWrite", String(canWrite))
        url.searchParams.set("isAdmin", String(isAdmin))
        if (iframeToken) {
            url.searchParams.set("token", iframeToken)
        } else {
            url.searchParams.delete("token")
        }
        if (iframeReloadKey > 0) {
            url.searchParams.set("retry", String(iframeReloadKey))
        } else {
            url.searchParams.delete("retry")
        }
        return url.toString()
    }, [canWrite, iframeReloadKey, iframeToken, iframeUrl, isAdmin, user.id, user.role])

    const openModule = useCallback(async () => {
        const token = await syncIframeToken("open")
        if (!token) {
            handleIframeSessionFailure("open:comercial")
            return
        }
        setIframeToken(token)
        setIsOpen(true)
    }, [handleIframeSessionFailure, syncIframeToken])

    const quickLinks: Array<{ id: ModuleType; label: string; icon: typeof Users }> = [
        { id: "clientes", label: "Clientes", icon: Users },
        { id: "proyectos", label: "Proyectos", icon: FolderKanban },
        { id: "cotizadora", label: "Cotizadora", icon: FileText },
    ]

    const handleQuickNavigate = useCallback(
        (module: ModuleType) => {
            if (onNavigateModule) {
                onNavigateModule(module)
            }
        },
        [onNavigateModule]
    )

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-full bg-[#F8FAFC] p-8 space-y-8 font-sans antialiased">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Control Comercial</h1>
                    <p className="text-slate-500 font-medium mt-1">Seguimiento de entregas, clientes y cotizaciones</p>
                </div>
                <div className="flex items-center gap-3">
                    {!canWrite && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                            <Shield className="w-4 h-4 text-amber-600 animate-pulse" />
                            <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                                Modo Solo Lectura
                            </span>
                        </div>
                    )}
                    {realtimeStatus === "SUBSCRIBED" ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-250 rounded-xl">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest">
                                Conexión Comercial Activa
                            </span>
                        </div>
                    ) : realtimeStatus === "CONNECTING" ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                            <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                            <span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest animate-pulse">
                                Conectando...
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl">
                            <span className="relative flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 animate-pulse"></span>
                            </span>
                            <span className="text-[10px] text-red-800 font-bold uppercase tracking-widest">
                                Desconectado
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Accesos Comerciales + Tabla */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <Accordion type="single" collapsible defaultValue="accesos-comercial" className="w-full">
                    <AccordionItem value="accesos-comercial" className="border-b-0">
                        <AccordionTrigger className="px-6 py-4 hover:no-underline border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-600">
                                    <FileSearch className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-sm font-bold text-slate-800">Accesos Directos del Módulo</h4>
                                    <p className="text-xs text-slate-500 font-medium">Clientes, proyectos, cotizaciones y matriz comercial.</p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* Action Buttons Grid */}
                                <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {quickLinks.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleQuickNavigate(item.id)}
                                                className="group flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all duration-200 text-slate-700 hover:text-indigo-700 shadow-sm hover:shadow"
                                            >
                                                <div className="p-3 bg-white text-slate-500 group-hover:text-indigo-600 rounded-2xl border border-slate-100 group-hover:border-indigo-100 transition-colors shadow-inner">
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider mt-3">{item.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Control Table Call-to-action */}
                                <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50 p-5 gap-4">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-slate-800">Tabla Comercial Unificada</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            Seguimiento de fechas de entrega de informes a clientes y registro de evidencias de despacho.
                                        </p>
                                    </div>
                                    <button
                                        onClick={openModule}
                                        className="flex items-center gap-3 px-5 py-3 bg-[#0070F3] text-white rounded-xl font-bold hover:bg-blue-650 transition-all shadow-md shadow-blue-500/20 active:scale-95"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        ABRIR TABLA COMERCIAL
                                    </button>
                                </div>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>

            {/* Dashboard Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL ORDENES</p>
                        <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{kpis.total}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-650">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EN PROCESO</p>
                        <p className="text-2xl font-black text-indigo-650 mt-1 tabular-nums">{kpis.proceso}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Clock className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PENDIENTES</p>
                        <p className="text-2xl font-black text-amber-600 mt-1 tabular-nums">{kpis.pendientes}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                        <Clock className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all group flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PLANES ATRASADOS</p>
                        <p className="text-2xl font-black text-red-650 mt-1 tabular-nums">{kpis.atrasados}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Recent Comercial Activities */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" />
                        Actividad Comercial Reciente (En Vivo)
                    </h3>
                    <span className="text-[10px] bg-slate-100 text-slate-650 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Últimos 3 cambios
                    </span>
                </div>
                <div className="p-0">
                    {recentChanges.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {recentChanges.map((item, idx) => (
                                <div key={idx} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs uppercase">
                                            {item.ot ? item.ot.slice(-2) : "OT"}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-slate-800">
                                                    OT: {item.ot || "SIN OT"}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">|</span>
                                                <span className="text-xs text-slate-600 font-semibold truncate max-w-[250px]" title={item.cliente_nombre}>
                                                    {item.cliente_nombre || "Cliente no especificado"}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-500">
                                                <div className="sm:col-span-2">
                                                    Proyecto: <span className="font-bold text-slate-700 truncate max-w-[300px]" title={item.proyecto}>{item.proyecto || "-"}</span>
                                                </div>
                                                <div>
                                                    Entrega: <span className="font-bold text-indigo-650">{item.fecha_entrega_com || "Por Definir"}</span>
                                                </div>
                                                <div className="sm:col-span-3">
                                                    Servicio: <span className="font-medium text-slate-600">{item.descripcion_servicio || "No especificado"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-200`}>
                                                ESTADO: {item.estado_trabajo || "PENDIENTE"}
                                            </span>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-400 tabular-nums">
                                            {item.updated_at ? new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "N/A"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-sm text-slate-400 font-medium italic">
                            No hay actividad comercial reciente detectada.
                        </div>
                    )}
                </div>
            </div>

            {/* Footer / System Status Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <Zap className="w-4 h-4 text-indigo-500" />
                        Métricas de Atención
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-405 font-bold uppercase tracking-wider">Base de Datos</span>
                            <span className="text-slate-700 font-semibold">CRM Comercial Core</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-410 font-bold uppercase tracking-wider">Canal Realtime</span>
                            <span className="text-indigo-650 font-extrabold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[10px]">ESTABLE</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                        <Shield className="w-4 h-4 text-indigo-500" />
                        Privacidad de Datos
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        La información de clientes, cotizaciones y proyectos es de uso exclusivo para gestión comercial y despacho.
                    </p>
                </div>

                <div className="bg-indigo-50 border border-indigo-105 rounded-2xl p-6 flex items-start gap-4 md:col-span-2 lg:col-span-1 shadow-sm">
                    <div className="p-3 bg-white text-indigo-600 rounded-full border border-indigo-100 flex-shrink-0">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">Auditoría Habilitada</h4>
                        <p className="text-xs text-indigo-750 mt-1 leading-relaxed">
                            Cualquier cambio sobre el despacho de cotizaciones y el estado comercial de las órdenes es auditado automáticamente en la base de datos.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal Fullscreen */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent
                    style={{ backgroundColor: '#fff' }}
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={() => setIsOpen(false)}
                >
                    <div className="flex-none flex items-center justify-between px-6 py-2 bg-white border-b border-zinc-200">
                        <div className="flex items-center gap-3">
                            <Briefcase className="w-4 h-4 text-indigo-600" />
                            <DialogTitle className="font-bold text-zinc-900 text-xs uppercase tracking-widest">
                                Seguimiento Comercial - Geofal CRM
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Módulo comercial de programación para seguimiento de entregas y evidencias.
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <DialogPrimitive.Close asChild>
                                <Button variant="ghost" size="icon" className="w-8 h-8 hover:bg-red-50 hover:text-red-500">
                                    <X className="w-4 h-4" />
                                </Button>
                            </DialogPrimitive.Close>
                        </div>
                    </div>

                    <div className="flex-1 min-h-0 relative bg-zinc-50">
                        <iframe
                            ref={iframeRef}
                            data-programacion-iframe
                            src={fullUrl}
                            className="w-full h-full border-0 relative z-10"
                            title="Comercial"
                            allow="clipboard-write; clipboard-read"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
