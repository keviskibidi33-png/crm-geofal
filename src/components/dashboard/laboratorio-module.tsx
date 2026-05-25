"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { User } from "@/hooks/use-auth"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { DialogFullscreen as Dialog, DialogFullscreenContent as DialogContent } from "@/components/ui/dialog-fullscreen"
import { Button } from "@/components/ui/button"
import {
    Activity,
    Clock,
    CheckCircle2,
    AlertTriangle,
    ExternalLink,
    X,
    FlaskConical,
    BarChart3,
    Database,
    Loader2,
    Zap,
    History,
    Shield
} from "lucide-react"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { resolveFrontendModuleUrl } from "@/lib/frontend-url"

interface LaboratorioModuleProps {
    user: User
}

const TOKEN_BRIDGE_TRACE_PREFIX = "[LaboratorioTokenBridge]"
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

export function LaboratorioModule({ user }: LaboratorioModuleProps) {
    const { kpis, recentChanges, isLoading, realtimeStatus } = useProgramacionData()
    const [isOpen, setIsOpen] = useState(false)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [iframeToken, setIframeToken] = useState<string | null>(null)
    const [iframeReloadKey, setIframeReloadKey] = useState(0)
    const iframeRef = useRef<HTMLIFrameElement | null>(null)

    // KPIs come pre-computed from the hook (lightweight count queries)
    const stats = { total: kpis.total, pend: kpis.pendientes, proce: kpis.proceso, compl: kpis.finalizados }

    const canWrite = user.permissions?.laboratorio?.write === true || user.role === "admin"

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
            ? "https://programacion.geofal.com.pe"
            : "http://localhost:8472"
        return resolveFrontendModuleUrl(
            process.env.NEXT_PUBLIC_PROGRAMACION_LABORATORIO_URL || process.env.NEXT_PUBLIC_PROGRAMACION_URL,
            fallbackUrl,
            "programacion-laboratorio",
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
        if (!isOpen) return

        const handleMessage = (event: MessageEvent) => {
            if (!event.source) return
            if (iframeOrigin && event.origin !== iframeOrigin) return
            if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) return

            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                const requestId = typeof event.data?.requestId === "string" ? event.data.requestId : undefined
                const immediateToken = accessToken || getStoredAccessToken()
                if (immediateToken) {
                    ;(event.source as Window).postMessage(
                        { type: 'TOKEN_REFRESH', token: immediateToken, requestId, source: 'laboratorio_module_immediate' },
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
                            { type: 'TOKEN_REFRESH', token: freshToken, requestId, source: 'laboratorio_module_sync' },
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
                            { type: 'TOKEN_REFRESH', token: freshToken, requestId: event.data?.requestId, source: 'laboratorio_module_recovery' },
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
        url.searchParams.set("mode", "lab")
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
            handleIframeSessionFailure("open:laboratorio")
            return
        }
        setIframeToken(token)
        setIsOpen(true)
    }, [handleIframeSessionFailure, syncIframeToken])

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        )
    }
    return (
        <div className="flex flex-col h-full space-y-6 p-6 bg-gradient-to-br from-slate-50 via-white to-blue-50/15 overflow-y-auto">
            {/* Header Compacto */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
                        <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
                            <FlaskConical className="w-5 h-5" />
                        </div>
                        Control Laboratorio
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gestión técnica y operativa de ensayos de laboratorio.</p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center">
                    {!canWrite && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full shadow-sm">
                            <Shield className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                            <span className="text-[10px] text-amber-700 font-black uppercase tracking-wider">
                                SÓLO LECTURA
                            </span>
                        </div>
                    )}
                    {/* Dynamic Real-time Connection Status */}
                    {realtimeStatus === "SUBSCRIBED" ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-[10px] text-emerald-800 font-black tracking-wider uppercase">
                                CONEXIÓN EN VIVO ACTIVA
                            </span>
                        </div>
                    ) : realtimeStatus === "CONNECTING" ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full shadow-sm">
                            <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
                            <span className="text-[10px] text-amber-800 font-black tracking-wider uppercase animate-pulse">
                                CONECTANDO...
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 animate-pulse"></span>
                            </span>
                            <span className="text-[10px] text-red-800 font-black tracking-wider uppercase">
                                DESCONECTADO
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Access Block */}
            <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm p-6 transition-all duration-300 hover:shadow-md hover:border-slate-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-5 -mt-5" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100 shadow-inner">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className="text-base font-bold text-slate-900">Matriz Técnica de Datos</h4>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Acceso directo al registro, asignación y validación de ensayos operativos.
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={openModule}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-4 rounded-xl flex items-center gap-2 tracking-wider shadow transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <ExternalLink className="w-4 h-4" />
                        ABRIR TABLA DE CONTROL
                    </Button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="group relative overflow-hidden bg-white border-slate-200 shadow-sm rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-slate-300">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-900 group-hover:bg-slate-700 transition-colors" />
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL ENSAYOS</p>
                            <p className="text-2xl font-black text-slate-800 mt-1 tabular-nums">{kpis.total}</p>
                        </div>
                        <div className="p-3 bg-slate-50 text-slate-650 rounded-xl group-hover:bg-slate-100 transition-colors">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden bg-white border-slate-200 shadow-sm rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-blue-300">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 group-hover:bg-blue-600 transition-colors" />
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">EN PROCESO</p>
                            <p className="text-2xl font-black text-blue-600 mt-1 tabular-nums">{kpis.proceso}</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors">
                            <Clock className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden bg-white border-slate-200 shadow-sm rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-red-300">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500 group-hover:bg-red-600 transition-colors" />
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PENDIENTES</p>
                            <p className="text-2xl font-black text-red-600 mt-1 tabular-nums">{kpis.pendientes}</p>
                        </div>
                        <div className="p-3 bg-red-50 text-red-650 rounded-xl group-hover:bg-red-100 transition-colors">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="group relative overflow-hidden bg-white border-slate-200 shadow-sm rounded-2xl transition-all duration-300 hover:shadow-md hover:-translate-y-1 hover:border-emerald-300">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 group-hover:bg-emerald-600 transition-colors" />
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COMPLETADOS</p>
                            <p className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">{kpis.finalizados}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Lab Modifications */}
            <Card className="border border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <CardTitle className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-500" />
                        Últimas Modificaciones en Sistema (En Vivo)
                    </CardTitle>
                    <span className="text-[10px] bg-slate-150 text-slate-650 px-2 py-0.5 rounded-full font-semibold">
                        Últimos 3 cambios
                    </span>
                </CardHeader>
                <CardContent className="p-0">
                    {recentChanges.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {recentChanges.map((item, idx) => (
                                <div key={idx} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start gap-4 min-w-0 flex-1">
                                        <div className="mt-1 flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs uppercase">
                                            {item.ot ? item.ot.slice(-2) : "OT"}
                                        </div>
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-bold text-slate-800">
                                                    OT: {item.ot || "SIN OT"}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium">|</span>
                                                <span className="text-xs text-slate-600 font-semibold truncate block max-w-full" title={item.cliente_nombre || item.proyecto}>
                                                    {item.cliente_nombre || item.proyecto || "Cliente no especificado"}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-500">
                                                <div className="sm:col-span-2 truncate">
                                                    Servicio: <span className="font-bold text-slate-700">{item.descripcion_servicio || "No especificado"}</span>
                                                </div>
                                                <div className="truncate">
                                                    Muestra: <span className="font-bold text-blue-650">{item.codigo_muestra || "-"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between md:justify-end gap-3 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider bg-slate-50 text-slate-700 border-slate-250`}>
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
                            Sin cambios recientes detectados.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Footer / System Status Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="p-4 pb-2 border-b border-slate-100">
                        <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-blue-500" />
                            Estatus Operativo
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-3 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Sincronización</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <Activity className="w-3.5 h-3.5 animate-pulse" />
                                ACTIVA
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Database</span>
                            <span className="text-slate-700 font-semibold italic">Supabase Realtime Cloud</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="p-4 pb-2 border-b border-slate-100">
                        <CardTitle className="text-xs font-bold text-slate-700 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-500" />
                            Cumplimiento Técnico
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-3">
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Todos los registros del laboratorio son trazables y están sujetos a estrictas auditorías normativas.
                        </p>
                    </CardContent>
                </Card>

                <Card className="border border-blue-100 bg-blue-50/20 rounded-2xl p-5 flex items-start gap-4 md:col-span-2 lg:col-span-1">
                    <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">Auditoría Habilitada</h4>
                        <p className="text-xs text-blue-700/90 mt-1 leading-relaxed">
                            Cualquier cambio sobre el despacho de cotizaciones y el estado comercial de las órdenes es auditado automáticamente.
                        </p>
                    </div>
                </Card>
            </div>
            
            {/* Modal de Tabla Laboratorio (Fullscreen) */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent
                    style={{ backgroundColor: '#fff' }}
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={() => setIsOpen(false)}
                >
                    <div className="flex-none flex items-center justify-between px-6 py-2 bg-white border-b border-zinc-200">
                        <div className="flex items-center gap-3">
                            <Activity className="w-4 h-4 text-blue-600" />
                            <DialogTitle className="font-bold text-zinc-900 text-xs uppercase tracking-widest">
                                Control Laboratorio - Matriz de Datos
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Módulo de laboratorio de programación para control de estados y ensayos.
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100 text-[9px] font-black uppercase">
                                <div className="h-1 w-1 bg-emerald-500 rounded-full animate-pulse" />
                                Online
                            </div>
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
                            title="Laboratorio"
                            allow="clipboard-write; clipboard-read"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
