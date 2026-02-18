"use client"

import { useState, useCallback, useEffect } from "react"
import { User } from "@/hooks/use-auth"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { useProgramacionIframe } from "@/hooks/use-programacion-iframe"
import { DialogFullscreen as Dialog, DialogFullscreenContent as DialogContent } from "@/components/ui/dialog-fullscreen"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, AlertTriangle, FlaskConical, Briefcase, Building2, ChevronRight, BarChart3, X } from "lucide-react"
import { DialogTitle, DialogDescription } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { supabase } from "@/lib/supabaseClient"

interface ProgramacionModuleProps {
    user: User
}

type ViewMode = 'LAB' | 'COMERCIAL' | 'ADMIN'

export function ProgramacionModule({ user }: ProgramacionModuleProps) {
    const { kpis, isLoading, realtimeStatus } = useProgramacionData()
    const [isOpen, setIsOpen] = useState(false)
    const [accessToken, setAccessToken] = useState<string | null>(null)
    const [iframeNonce, setIframeNonce] = useState<number>(() => Date.now())
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

    const syncIframeToken = useCallback(async (): Promise<string | null> => {
        const { data: { session } } = await supabase.auth.getSession()
        let freshToken = session?.access_token ?? getStoredAccessToken()

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
        return freshToken
    }, [getStoredAccessToken])

    // === AUTO-SELECT VIEW BASED ON ROLE ===
    const roleToViewMap: Record<string, ViewMode> = {
        'admin': 'ADMIN',
        'administrativo': 'ADMIN',
        'vendor': 'COMERCIAL',
        'laboratorio_lector': 'LAB',
        'laboratorio_tipificador': 'LAB'
    }

    const rNorm = user.role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    const getInitialMode = (): ViewMode => {
        if (roleToViewMap[rNorm]) return roleToViewMap[rNorm]
        if (rNorm.includes('admin') || rNorm.includes('geren') || rNorm.includes('direc') || rNorm.includes('jefe')) return 'ADMIN'
        if (rNorm.includes('comercial') || rNorm.includes('vendedor') || rNorm.includes('asesor') || rNorm.includes('vendor') || rNorm.includes('ventas')) return 'COMERCIAL'
        return 'LAB'
    }

    const [currentMode, setCurrentMode] = useState<ViewMode>(getInitialMode)

    const handleIframeUpdate = useCallback(() => {
        // No-op: shell KPIs auto-refresh via their own realtime subscription
    }, [])

    useProgramacionIframe(handleIframeUpdate)
    
    useEffect(() => {
        syncIframeToken()
    }, [syncIframeToken])

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                syncIframeToken().then((freshToken) => {
                    if (freshToken && event.source) {
                        (event.source as Window).postMessage(
                            { type: 'TOKEN_REFRESH', token: freshToken },
                            '*'
                        )
                    }
                })
            }
        }

        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [syncIframeToken])

    const getModuleConfig = (mode: ViewMode) => {
        switch (mode) {
            case 'LAB':
                return {
                    title: 'Laboratorio', icon: FlaskConical, metrics: [
                        { label: 'En Proceso', value: kpis.proceso, color: 'text-amber-600' },
                        { label: 'Pendientes', value: kpis.pendientes, color: 'text-zinc-600' }
                    ]
                }
            case 'COMERCIAL':
                return {
                    title: 'Comercial', icon: Briefcase, metrics: [
                        { label: 'Con Atraso', value: kpis.atrasados, color: 'text-red-600' },
                        { label: 'Total OTs', value: kpis.total, color: 'text-zinc-600' }
                    ]
                }
            case 'ADMIN':
                return {
                    title: 'Administración', icon: Building2, metrics: [
                        { label: 'Por Facturar', value: kpis.finalizados, color: 'text-emerald-600' },
                        { label: 'Total Mes', value: kpis.total, color: 'text-zinc-600' }
                    ]
                }
        }
    }

    const openModule = async (mode: ViewMode) => {
        setCurrentMode(mode)
        const token = await syncIframeToken()
        if (!token) {
            window.location.href = "/login?error=session_expired"
            return
        }
        setIframeNonce(Date.now())
        setIsOpen(true)
    }

    const ModuleRow = ({ mode }: { mode: ViewMode }) => {
        const config = getModuleConfig(mode)
        const { title, icon: Icon, metrics } = config

        return (
            <div
                onClick={() => openModule(mode)}
                className="group flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-zinc-100 rounded-md group-hover:bg-blue-50 text-zinc-600 group-hover:text-blue-600 transition-colors">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-900 group-hover:text-blue-700 transition-colors">{title}</h3>
                        <p className="text-xs text-zinc-500">Vista detallada y gestión</p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-6 mr-4">
                        {metrics.map((m, i) => (
                            <div key={i} className="flex flex-col items-end">
                                <span className={`font-bold text-lg ${m.color}`}>{m.value}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">{m.label}</span>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" size="icon" className="text-zinc-400 group-hover:text-blue-600">
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        )
    }

    const currentConfig = getModuleConfig(currentMode)
    const { title, icon: Icon } = currentConfig
    const iframeUrl = process.env.NEXT_PUBLIC_PROGRAMACION_URL ||
        (typeof window !== 'undefined' && window.location.hostname === 'crm.geofal.com.pe'
            ? 'https://programacion.geofal.com.pe'
            : 'http://127.0.0.1:3001')

    const isAdmin = rNorm.includes('admin') || rNorm.includes('geren') || rNorm.includes('administra') || rNorm.includes('direc') || rNorm.includes('jefe')

    const modeToPermissionKey: Record<string, string> = {
        'LAB': 'laboratorio',
        'COMERCIAL': 'comercial',
        'ADMIN': 'administracion'
    }
    const permissionKey = modeToPermissionKey[currentMode] || 'programacion'

    const isLabEdit = currentMode === 'LAB' && rNorm.includes('laboratorio') && !rNorm.includes('lector')
    const isSuperAdmin = rNorm === 'admin'

    // Final write permission: 
    // - Superadmins always can write
    // - Other admins can write to non-LAB views
    // - Lab staff can write to LAB
    // - Other roles follow their explicit permissions
    let canWrite = isSuperAdmin || isLabEdit

    if (!canWrite) {
        if (currentMode === 'LAB') {
            // Strict block for LAB for everyone else
            canWrite = user.permissions?.[permissionKey]?.write || false
        } else {
            // Normal admin/explicit logic for COM/ADMIN
            canWrite = isAdmin ||
                user.permissions?.[permissionKey]?.write ||
                user.permissions?.['programacion']?.write || false
        }
    }

    const encodedRole = encodeURIComponent(user.role)
    const tokenParam = accessToken ? `&token=${encodeURIComponent(accessToken)}` : ""
    const fullUrl = `${iframeUrl}?mode=${currentMode.toLowerCase()}&userId=${user.id}&role=${encodedRole}&canWrite=${canWrite}&isAdmin=${isAdmin}${tokenParam}&v=${iframeNonce}`

    return (
        <>
            <div className="flex flex-col h-full space-y-6 p-6 bg-zinc-50/50 overflow-y-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard de Operaciones</h1>
                        <p className="text-sm text-zinc-500">Resumen general y accesos directos.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-zinc-200 rounded-full shadow-sm">
                        <span className={`h-2 w-2 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs text-zinc-600 font-medium uppercase tracking-wide">
                            {realtimeStatus === 'SUBSCRIBED' ? 'Sistema Online' : 'Desconectado'}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Activos</p>
                            <p className="text-2xl font-bold text-zinc-900">{kpis.total}</p>
                        </div>
                        <BarChart3 className="w-8 h-8 text-zinc-100" />
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Pendientes</p>
                            <p className="text-2xl font-bold text-zinc-700">{kpis.pendientes}</p>
                        </div>
                        <Clock className="w-8 h-8 text-zinc-100" />
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Atrasados</p>
                            <p className="text-2xl font-bold text-red-600">{kpis.atrasados}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-50" />
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Completados</p>
                            <p className="text-2xl font-bold text-emerald-600">{kpis.finalizados}</p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-50" />
                    </div>
                </div>

                <div className="h-px bg-zinc-200" />

                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4">Módulos de Gestión</h2>
                    <ModuleRow mode="LAB" />
                    <ModuleRow mode="COMERCIAL" />
                    <ModuleRow mode="ADMIN" />
                </div>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent
                    style={{ backgroundColor: '#fff' }}
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={() => setIsOpen(false)}
                >
                    <div className="flex-none flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200">
                        <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5 text-blue-600" />
                            <DialogTitle className="font-semibold text-zinc-900 text-base m-0">{title}</DialogTitle>
                        </div>
                        <DialogDescription className="sr-only">
                            Módulo de gestión de programación: {title}
                        </DialogDescription>
                        <DialogPrimitive.Close asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                                <X className="w-4 h-4" />
                            </Button>
                        </DialogPrimitive.Close>
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        <iframe
                            data-programacion-iframe
                            src={fullUrl}
                            className="w-full h-full border-0"
                            title="Programación"
                            allow="clipboard-write; clipboard-read"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
