"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { User } from "@/hooks/use-auth"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { DialogFullscreen as Dialog, DialogFullscreenContent as DialogContent } from "@/components/ui/dialog-fullscreen"
import { Button } from "@/components/ui/button"
import {
    CheckCircle2,
    ExternalLink,
    X,
    Building2,
    Loader2,
    Zap,
    History,
    Shield,
    Receipt,
    Wallet
} from "lucide-react"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabaseClient"

interface AdministracionModuleProps {
    user: User
}

const TOKEN_BRIDGE_TRACE_PREFIX = "[AdministracionTokenBridge]"

export function AdministracionModule({ user }: AdministracionModuleProps) {
    const { kpis, recentChanges, isLoading, realtimeStatus } = useProgramacionData()
    const [isOpen, setIsOpen] = useState(false)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [iframeNonce, setIframeNonce] = useState<number>(() => Date.now())

    // KPIs come pre-computed from the hook (lightweight count queries)
    const stats = { total: kpis.total, porFacturar: kpis.finalizados, facturados: 0, pendientesPago: 0, pagados: 0 }

    const canWrite = user.permissions?.administracion?.write === true || user.role === "admin"

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
        console.info(`${TOKEN_BRIDGE_TRACE_PREFIX} syncIframeToken`, {
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

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                const requestId = typeof event.data?.requestId === "string" ? event.data.requestId : undefined
                const immediateToken = accessToken || getStoredAccessToken()
                if (immediateToken) {
                    ;(event.source as Window).postMessage(
                        { type: 'TOKEN_REFRESH', token: immediateToken, requestId, source: 'administracion_module_immediate' },
                        '*'
                    )
                    console.info(`${TOKEN_BRIDGE_TRACE_PREFIX} immediate token response`, {
                        requestId,
                        origin: event.origin,
                    })
                }

                syncIframeToken(`request:${requestId || "none"}`).then((freshToken) => {
                    if (freshToken && event.source) {
                        (event.source as Window).postMessage(
                            { type: 'TOKEN_REFRESH', token: freshToken, requestId, source: 'administracion_module_sync' },
                            '*'
                        )
                        console.info(`${TOKEN_BRIDGE_TRACE_PREFIX} refreshed token response`, {
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
                window.location.href = "/login?error=session_expired"
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [accessToken, getStoredAccessToken, syncIframeToken])

    const iframeUrl = process.env.NEXT_PUBLIC_PROGRAMACION_URL ||
        (typeof window !== 'undefined' && window.location.hostname === 'crm.geofal.com.pe'
            ? 'https://programacion.geofal.com.pe'
            : 'http://localhost:8472')

    const isAdmin = user.role === "admin"
    const encodedRole = encodeURIComponent(user.role)
    const resolvedAccessToken = useMemo(
        () => accessToken || (typeof window !== "undefined" ? getStoredAccessToken() : null),
        [accessToken, getStoredAccessToken]
    )
    const tokenParam = resolvedAccessToken ? `&token=${encodeURIComponent(resolvedAccessToken)}` : ""

    // Admin view is a specific mode - include ALL required params
    const fullUrl = `${iframeUrl}?mode=admin&userId=${user.id}&role=${encodedRole}&canWrite=${canWrite}&isAdmin=${isAdmin}${tokenParam}&v=${iframeNonce}`

    const openModule = useCallback(async () => {
        const token = await syncIframeToken("open")
        if (!token) {
            window.location.href = "/login?error=session_expired"
            return
        }
        setIframeNonce(Date.now())
        setIsOpen(true)
    }, [syncIframeToken])

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full space-y-4 p-4 bg-zinc-50/50 overflow-y-auto">
            {/* Header Compacto */}
            <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-emerald-600" />
                        Control Administración
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium">Gestión de facturación, tesorería y estados de pago.</p>
                </div>
                <div className="flex items-center gap-2">
                    {!canWrite && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
                            <Shield className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider">
                                Modo Solo Lectura
                            </span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-sm">
                        <span className={`h-2 w-2 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                            {realtimeStatus === 'SUBSCRIBED' ? 'Gateway Admin Online' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Fila superior: Tabla Acceso Directo */}
            <div className="flex items-center justify-between bg-white px-6 py-3 rounded-xl border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                        <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-zinc-900">Panel Central de Facturación</h4>
                        <p className="text-[11px] text-zinc-500 font-medium">Control de correlativos y estados financieros.</p>
                    </div>
                </div>
                <Button
                    onClick={openModule}
                    variant="outline"
                    className="border-emerald-200 text-emerald-600 hover:bg-emerald-50 font-bold text-xs px-6 py-4 rounded-lg flex items-center gap-2"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    ABRIR MATRIZ ADMINISTRATIVA
                </Button>
            </div>

            {/* Cuadro de Últimos Cambios */}
            <Card className="border border-zinc-200 shadow-sm bg-zinc-50/50">
                <CardHeader className="px-4 py-2 border-b border-zinc-200 bg-white">
                    <CardTitle className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-3.5 h-3.5" />
                        Movimientos Financieros Recientes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {recentChanges.length > 0 ? (
                        <div className="divide-y divide-zinc-200">
                            {recentChanges.map((item, idx) => (
                                <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-white transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-6 w-1 bg-emerald-500 rounded-full" />
                                        <div>
                                            <p className="text-xs font-bold text-zinc-800">
                                                Factura: {item.numero_factura || 'PEN. EMISIÓN'} • {item.cliente_nombre}
                                            </p>
                                            <p className="text-[10px] text-zinc-500">
                                                Pago: <span className="font-bold text-emerald-600">{item.estado_pago || 'PENDIENTE'}</span> • OT: {item.ot || 'S/N'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-medium text-zinc-400 tabular-nums">
                                        {item.updated_at ? new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-xs text-zinc-400 font-medium italic">
                            No hay movimientos administrativos recientes.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dashboard Stats Compacto */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                        <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Por Facturar</p>
                        <p className="text-lg font-black text-blue-600">{stats.porFacturar}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Facturados</p>
                        <p className="text-lg font-black text-emerald-600">{stats.facturados}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg text-red-600">
                        <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Pte. de Pago</p>
                        <p className="text-lg font-black text-red-600">{stats.pendientesPago}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-zinc-900 rounded-lg text-white">
                        <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Pagados</p>
                        <p className="text-lg font-black text-zinc-900">{stats.pagados}</p>
                    </div>
                </div>
            </div>

            {/* Footer compact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border border-zinc-200 shadow-sm">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-emerald-500" />
                            Control de Tesorería
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-2 space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-zinc-400 font-bold uppercase">Base de Datos</span>
                            <span className="text-zinc-700 font-semibold italic">ERP Financiero Sync</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-zinc-400 font-bold uppercase">Protocolo Cloud</span>
                            <span className="text-emerald-600 font-bold">ACTIVO</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-emerald-100 shadow-sm bg-emerald-50/30">
                    <CardContent className="p-3 flex items-start gap-3">
                        <Shield className="w-4 h-4 text-emerald-500 mt-1" />
                        <div>
                            <h4 className="text-xs font-bold text-emerald-900">Seguridad Financiera</h4>
                            <p className="text-[10px] text-emerald-700/80 leading-snug">
                                Todas las transacciones y facturas registradas cumplen con los estándares tributarios vigentes.
                            </p>
                        </div>
                    </CardContent>
                </Card>
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
                            <Building2 className="w-4 h-4 text-emerald-600" />
                            <DialogTitle className="font-bold text-zinc-900 text-xs uppercase tracking-widest">
                                Gestión Administrativa - Geofal CRM
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Módulo administrativo de programación para facturación, autorización y estados de pago.
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
                            data-programacion-iframe
                            src={fullUrl}
                            className="w-full h-full border-0 relative z-10"
                            title="Administracion"
                            allow="clipboard-write; clipboard-read"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
