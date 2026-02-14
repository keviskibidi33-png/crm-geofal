"use client"

import { useState } from "react"
import { User } from "@/hooks/use-auth"
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
    FileSearch
} from "lucide-react"
import { DialogTitle } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ComercialModuleProps {
    user: User
}

export function ComercialModule({ user }: ComercialModuleProps) {
    const { kpis, recentChanges, isLoading, realtimeStatus } = useProgramacionData()
    const [isOpen, setIsOpen] = useState(false)

    // KPIs come pre-computed from the hook (lightweight count queries)
    const stats = { total: kpis.total, atrasados: kpis.atrasados, pendientesEnvio: 0, totalMes: kpis.total }

    const canWrite = user.permissions?.comercial?.write === true || user.role === "admin"

    const iframeUrl = process.env.NEXT_PUBLIC_PROGRAMACION_URL ||
        (typeof window !== 'undefined' && window.location.hostname === 'crm.geofal.com.pe'
            ? 'https://programacion.geofal.com.pe'
            : 'http://localhost:8472')

    const isAdmin = user.role === "admin"
    const encodedRole = encodeURIComponent(user.role)

    // Comercial view - include ALL required params
    const fullUrl = `${iframeUrl}?mode=comercial&userId=${user.id}&role=${encodedRole}&canWrite=${canWrite}&isAdmin=${isAdmin}&v=${Date.now()}`

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
                        <Briefcase className="w-5 h-5 text-indigo-600" />
                        Control Comercial
                    </h1>
                    <p className="text-zinc-500 text-sm font-medium">Seguimiento de entregas y atención al cliente.</p>
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
                            {realtimeStatus === 'SUBSCRIBED' ? 'Conexión Comercial Activa' : 'Offline'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Fila superior: Tabla Acceso Directo */}
            <div className="flex items-center justify-between bg-white px-6 py-3 rounded-xl border border-zinc-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-zinc-100 rounded-lg text-zinc-600">
                        <FileSearch className="w-4 h-4" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-zinc-900">Matriz de Seguimiento Comercial</h4>
                        <p className="text-[11px] text-zinc-500 font-medium">Gestión de fechas de entrega y evidencias.</p>
                    </div>
                </div>
                <Button
                    onClick={() => setIsOpen(true)}
                    variant="outline"
                    className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold text-xs px-6 py-4 rounded-lg flex items-center gap-2"
                >
                    <ExternalLink className="w-3.5 h-3.5" />
                    ABRIR TABLA COMERCIAL
                </Button>
            </div>

            {/* Cuadro de Últimos Cambios */}
            <Card className="border border-zinc-200 shadow-sm bg-zinc-50/50">
                <CardHeader className="px-4 py-2 border-b border-zinc-200 bg-white">
                    <CardTitle className="text-[11px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-3.5 h-3.5" />
                        Actividad Comercial Reciente
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {recentChanges.length > 0 ? (
                        <div className="divide-y divide-zinc-200">
                            {recentChanges.map((item, idx) => (
                                <div key={idx} className="px-4 py-2 flex items-center justify-between hover:bg-white transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-6 w-1 bg-indigo-500 rounded-full" />
                                        <div>
                                            <p className="text-xs font-bold text-zinc-800">
                                                OT {item.ot || 'S/N'} - {item.cliente_nombre}
                                            </p>
                                            <p className="text-[10px] text-zinc-500">
                                                Cierre: <span className="font-bold text-indigo-600">{item.fecha_entrega_com || 'Por definir'}</span> • Ref: {item.descripcion_servicio || 'N/A'}
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
                            Esperando actualizaciones comerciales...
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dashboard Stats Compacto */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Total OTs</p>
                        <p className="text-lg font-black text-indigo-900">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-red-50 rounded-lg text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Atrasos</p>
                        <p className="text-lg font-black text-red-600">{stats.atrasados}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                        <Clock className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Pte. Envío</p>
                        <p className="text-lg font-black text-amber-600">{stats.pendientesEnvio}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Total Mes</p>
                        <p className="text-lg font-black text-emerald-600">{stats.totalMes}</p>
                    </div>
                </div>
            </div>

            {/* Footer compact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border border-zinc-200 shadow-sm">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-indigo-500" />
                            Métricas de Atención
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-2 space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-zinc-400 font-bold uppercase">Base de Datos</span>
                            <span className="text-zinc-700 font-semibold">CRM Comercial Core</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-zinc-400 font-bold uppercase">Canal Realtime</span>
                            <span className="text-indigo-600 font-bold">ESTABLE</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-indigo-100 shadow-sm bg-indigo-50/30">
                    <CardContent className="p-3 flex items-start gap-3">
                        <Shield className="w-4 h-4 text-indigo-500 mt-1" />
                        <div>
                            <h4 className="text-xs font-bold text-indigo-900">Privacidad de Datos</h4>
                            <p className="text-[10px] text-indigo-700/80 leading-snug">
                                La información de proyectos y contactos es de uso exclusivo para gestión comercial interna.
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
                            <Briefcase className="w-4 h-4 text-indigo-600" />
                            <DialogTitle className="font-bold text-zinc-900 text-xs uppercase tracking-widest">
                                Seguimiento Comercial - Geofal CRM
                            </DialogTitle>
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
