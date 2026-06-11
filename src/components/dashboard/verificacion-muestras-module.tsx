"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { RefreshCw, Plus, Search, FileText, Trash2, Eye, Pencil, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useVerificaciones, VerificacionMuestra } from "@/hooks/use-verificaciones"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import { EstadoDelTrabajoCard } from "@/components/dashboard/shared/EstadoDelTrabajoCard"
import { TimelineEtapas } from "@/components/dashboard/shared/TimelineEtapas"

// --- Smart Iframe Component with Retry Logic ---
interface SmartIframeProps {
    src: string;
    title: string;
}

interface VerificacionMuestrasModuleProps {
    focusVerificacionId?: number | null
    onFocusHandled?: () => void
}

function SmartIframe({ src, title }: SmartIframeProps) {
    const [key, setKey] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleLoad = () => {
        setIsLoading(false);
        setError(null);
        setRetryCount(0);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    const handleRetry = useCallback(() => {
        setIsLoading(true);
        setError(null);
        setKey(prev => prev + 1);
        setRetryCount(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!isLoading) return;

        const timeoutMs = 12000 + (retryCount * 6000); 
        
        timeoutRef.current = setTimeout(() => {
            if (retryCount < 2) {
                toast.loading(`El servidor tarda en responder. Reintentando... (Intento ${retryCount + 1}/3)`);
                setTimeout(() => {
                    toast.dismiss();
                    handleRetry();
                }, 1500);
            } else {
                setError(`El servicio no responde después de varios intentos (${timeoutMs/1000}s).`);
                setIsLoading(false);
            }
        }, timeoutMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [isLoading, retryCount, handleRetry]);

    const currentSrc = useMemo(() => {
        const url = new URL(src);
        url.searchParams.set('retry', retryCount.toString());
        url.searchParams.set('t', Date.now().toString());
        return url.toString();
    }, [src, retryCount]);

    return (
        <div className="w-full h-full relative bg-gray-50">
            {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10 backdrop-blur-sm transition-all duration-300">
                    <div className="relative">
                        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                        {retryCount > 0 && (
                            <div className="absolute top-0 right-0 -mr-2 -mt-2 h-5 w-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-bounce">
                                {retryCount}
                            </div>
                        )}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground animate-pulse text-center">
                        Conectando con el módulo... <br/>
                        <span className="text-xs opacity-75">Esto puede tardar unos segundos si el sistema está "frío".</span>
                    </p>
                </div>
            )}
            
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20 p-6 text-center animate-in fade-in zoom-in-95 duration-300">
                    <div className="h-20 w-20 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <AlertCircle className="h-10 w-10 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Conexión Interrumpida</h3>
                    <p className="text-sm text-gray-500 max-w-xs mb-8 leading-relaxed">
                        {error} <br/>
                        Es posible que el servicio esté reiniciándose o experimentando alta carga.
                    </p>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => window.location.reload()}>
                            Recargar Página
                        </Button>
                        <Button onClick={handleRetry} className="gap-2 shadow-md hover:shadow-lg transition-all">
                            <RefreshCw className="h-4 w-4" />
                            Reintentar Conexión
                        </Button>
                    </div>
                </div>
            )}

            <iframe
                key={key}
                src={currentSrc}
                className={`w-full h-full border-none transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                title={title}
                onLoad={handleLoad}
                onError={() => setError("Error al cargar el marco de contenido.")}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                loading="eager"
            />
        </div>
    );
}
export function VerificacionMuestrasModule({ focusVerificacionId, onFocusHandled }: VerificacionMuestrasModuleProps) {
    const { verificaciones, loading, fetchVerificaciones, deleteVerificacion } = useVerificaciones()
    const { user } = useAuth()
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [iframePath, setIframePath] = useState("/nuevo") // Default route for iframe
    const [selectedVerificacion, setSelectedVerificacion] = useState<VerificacionMuestra | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [tracingData, setTracingData] = useState<any>(null)
    const [loadingTracing, setLoadingTracing] = useState(false)
    const [token, setToken] = useState<string | null>(null)
    const tokenRef = useRef<string | null>(null)
    const isSyncingRef = useRef(false)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const lastFocusedVerificacionIdRef = useRef<number | null>(null)
    const [deleteConfirmText, setDeleteConfirmText] = useState("")
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const canWrite = user?.role === "admin" || user?.role === "oficina_tecnica" || user?.permissions?.verificacion_muestras?.write === true
    const canDelete = user?.role === "admin" || user?.role === "oficina_tecnica" || user?.permissions?.verificacion_muestras?.delete === true

    const syncIframeToken = async (): Promise<string | null> => {
    const getStoredAccessToken = (): string | null => {
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
    }

    const isTokenExpiringSoon = (jwt: string | null, skewMs = 60_000): boolean => {
      if (!jwt) return true

      try {
        const [, payload] = jwt.split(".")
        if (!payload) return true

        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
        const parsed = JSON.parse(window.atob(padded))
        const expMs = typeof parsed?.exp === "number" ? parsed.exp * 1000 : null

        if (!expMs) return true
        return expMs <= Date.now() + skewMs
      } catch {
        return true
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const sessionToken = session?.access_token ?? null
    const localToken = getStoredAccessToken()
    let freshToken = !isTokenExpiringSoon(sessionToken)
      ? sessionToken
      : !isTokenExpiringSoon(localToken)
        ? localToken
        : null

    if (!freshToken) {
      try {
        const { data } = await supabase.auth.refreshSession()
        freshToken = data?.session?.access_token ?? getStoredAccessToken()
      } catch {
        freshToken = getStoredAccessToken()
      }
    }

    if (freshToken && typeof window !== "undefined") {
      localStorage.setItem("token", freshToken)
    }

    tokenRef.current = freshToken
    setToken(freshToken)
    return freshToken
  }

    const FRONTEND_URL = process.env.NEXT_PUBLIC_VERIFICACION_FRONTEND_URL || "http://127.0.0.1:5174"

    useEffect(() => {
        fetchVerificaciones()

        // Get session token to pass to iframe
        syncIframeToken()
    }, [fetchVerificaciones])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                fetchVerificaciones()
            }
            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                if (isSyncingRef.current) return
                isSyncingRef.current = true
                syncIframeToken().then((freshToken) => {
                    if (freshToken && event.source) {
                        try {
                            ;(event.source as Window).postMessage(
                                {
                                    type: 'TOKEN_REFRESH',
                                    token: freshToken,
                                    requestId: typeof event.data?.requestId === 'string' ? event.data.requestId : undefined,
                                },
                                event.origin || '*',
                            )
                        } catch { /* noop */ }
                    }
                }).finally(() => { isSyncingRef.current = false })
            }
            // Handle REQUEST_TOKEN from iframe when it navigates internally (e.g., /importar)
            // and doesn't have the token available in its localStorage (cross-domain isolation)
            if (event.data?.type === 'REQUEST_TOKEN' && event.source) {
                const currentToken = tokenRef.current || localStorage.getItem('token')
                if (currentToken) {
                    try {
                        ;(event.source as Window).postMessage(
                            { type: 'SET_TOKEN', token: currentToken, source: 'crm-shell' },
                            event.origin || '*',
                        )
                    } catch {
                        // Ignore — source may have navigated away
                    }
                } else {
                    // Token not ready yet, sync and then respond
                    if (isSyncingRef.current) return
                    isSyncingRef.current = true
                    syncIframeToken().then((freshToken) => {
                        if (freshToken && event.source) {
                            try {
                                ;(event.source as Window).postMessage(
                                    { type: 'SET_TOKEN', token: freshToken, source: 'crm-shell' },
                                    event.origin || '*',
                                )
                            } catch { /* noop */ }
                        }
                    }).finally(() => { isSyncingRef.current = false })
                }
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [fetchVerificaciones])

    const handleOpenModal = async (path: string) => {
        if (!canWrite) {
            toast.error("Acceso denegado", { description: "No tienes permisos para editar verificaciones." })
            return
        }
        await syncIframeToken()
        setIframePath(path)
        setIsModalOpen(true)
    }

    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            if (iframePath.includes('/editar')) {
                // Editing → show confirmation before discarding
                setShowExitConfirm(true)
                return
            }
            // Creating new → close directly
            setIsModalOpen(false)
            fetchVerificaciones()
            return
        }
        setIsModalOpen(open)
    }

    const confirmCloseModal = () => {
        setShowExitConfirm(false)
        setIsModalOpen(false)
        fetchVerificaciones()
    }

    const openDetail = useCallback(async (item: VerificacionMuestra) => {
        setSelectedVerificacion(item)
        setTracingData(null)
        setIsDetailOpen(true)
        setLoadingTracing(true)

        // Fetch tracing data using numero_verificacion (same as numero_recepcion)
        if (item.numero_verificacion) {
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
                const traceRes = await authFetch(
                    `${API_URL}/api/tracing/flujo/${encodeURIComponent(item.numero_verificacion)}?_ts=${Date.now()}`,
                    { cache: "no-store" }
                )
                if (traceRes.ok) {
                    const traceData = await traceRes.json()
                    setTracingData(traceData)
                }
            } catch {
                // Ignore tracing errors
            } finally {
                setLoadingTracing(false)
            }
        } else {
            setLoadingTracing(false)
        }
    }, [])

    useEffect(() => {
        if (!focusVerificacionId || verificaciones.length === 0) return
        if (lastFocusedVerificacionIdRef.current === focusVerificacionId) return

        const target = verificaciones.find((item) => item.id === focusVerificacionId)
        if (!target) return

        lastFocusedVerificacionIdRef.current = focusVerificacionId
        openDetail(target)
        onFocusHandled?.()
    }, [focusVerificacionId, onFocusHandled, verificaciones])

    const handleDelete = async (id: number) => {
        if (!canDelete) {
            toast.error("Acceso denegado", { description: "No tienes permisos para eliminar verificaciones." })
            return
        }

        const success = await deleteVerificacion(id)
        if (success) {
            toast.success("Verificación eliminada correctamente")
        }
    }

    const handleDownloadExcel = async (id: number) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
        try {
            const response = await authFetch(`${API_URL}/api/verificacion/${id}/exportar`)
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                
                // Try to get filename from headers
                const contentDisposition = response.headers.get('Content-Disposition')
                let filename = `Verificacion-${id}.xlsx`
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?([^"]+)"?/)
                    if (match && match[1]) filename = match[1]
                }
                
                a.download = filename
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
            } else {
                toast.error("Error al descargar el archivo")
            }
        } catch (error) {
            console.error("Download error:", error)
            toast.error("Error de conexión al descargar")
        }
    }

    const filteredData = verificaciones.filter(item =>
        item.numero_verificacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.cliente && item.cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.codigo_documento.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="h-full min-h-0 flex flex-col gap-6 p-4 md:p-6 overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Verificación Probetas</h1>
                    <p className="text-muted-foreground">Gestión y control de verificaciones de muestras</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => fetchVerificaciones()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    {canWrite && (
                        <Button onClick={() => handleOpenModal("/nuevo")} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nueva Verificación
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por N° Verificación, Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Native Table */}
            <div className="rounded-md border bg-card flex-1 overflow-auto">
                <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[120px]">N° Verificación</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Verificado Por</TableHead>
                                <TableHead>Fecha Verificación</TableHead>
                                <TableHead className="text-center">Muestras</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && verificaciones.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">Cargando datos...</TableCell>
                                </TableRow>
                            ) : filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">No se encontraron resultados</TableCell>
                                </TableRow>
                            ) : (
                                filteredData.map((item) => (
                                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(item)}>
                                        <TableCell className="font-bold text-primary">{item.numero_verificacion}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={item.cliente}>{item.cliente || "-"}</TableCell>
                                        <TableCell>{item.verificado_por || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-medium">
                                                {item.fecha_verificacion || "-"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary">{item.muestras_verificadas?.length || 0}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end items-center gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openDetail(item)}>
                                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                                {canWrite && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(`/editar/${item.id}`)}>
                                                        <Pencil className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                )}

                                            {/* Delete */}
                                            {canDelete && (
                                                <AlertDialog open={isDeleteOpen && deleteTargetId === item.id} onOpenChange={(open) => {
                                                    setIsDeleteOpen(open)
                                                    if (open) {
                                                        setDeleteTargetId(item.id)
                                                        setDeleteConfirmText("")
                                                    } else {
                                                        setDeleteTargetId(null)
                                                        setDeleteConfirmText("")
                                                    }
                                                }}>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción no se puede deshacer. Escribe <strong>ELIMINAR</strong> para confirmar.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <div className="py-2">
                                                            <Input
                                                                value={deleteConfirmText}
                                                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                                                placeholder="Escribe ELIMINAR para confirmar"
                                                                autoComplete="off"
                                                                data-lpignore="true"
                                                            />
                                                        </div>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={() => {
                                                                    if (deleteConfirmText === "ELIMINAR") {
                                                                        handleDelete(item.id)
                                                                        setIsDeleteOpen(false)
                                                                        setDeleteConfirmText("")
                                                                    }
                                                                }}
                                                                disabled={deleteConfirmText !== "ELIMINAR"}
                                                                className="bg-destructive hover:bg-destructive/90"
                                                            >
                                                                Eliminar
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal Iframe for Creation/Editing */}
            <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background [&>button]:hidden">
                    <DialogHeader className="hidden">
                        <DialogTitle>Módulo Verificación</DialogTitle>
                        <DialogDescription>Crea o edita verificaciones</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <SmartIframe
                            src={`${FRONTEND_URL}${iframePath}${iframePath.includes('?') ? '&' : '?'}token=${token || ''}`}
                            title="Verificación Probetas Iframe"
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Unsaved changes confirmation */}
            <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Los datos ingresados no se han guardado. Si sales ahora, se perderán los cambios.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Seguir editando</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCloseModal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Salir sin guardar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Native Detail Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" />
                            Detalle de Verificación {selectedVerificacion?.numero_verificacion}
                        </DialogTitle>
                        <DialogDescription>
                            Información completa de la verificación realizada por {selectedVerificacion?.verificado_por}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedVerificacion && (
                        <div className="flex-1 min-h-0 overflow-auto">
                            <div className="p-6 space-y-6">
                                {/* Estado del Trabajo + Timeline */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <EstadoDelTrabajoCard
                                        status={
                                            tracingData?.stages?.[1]?.status === 'completado' ? 'completado' :
                                            tracingData?.stages?.[1]?.status === 'en_proceso' ? 'en_proceso' : 'pendiente'
                                        }
                                        fechaRecepcion={tracingData?.stages?.[0]?.date}
                                        fechaCulminacion={tracingData?.stages?.[0]?.data?.fecha_entrega}
                                        vencimiento={tracingData?.stages?.[0]?.data?.fecha_entrega}
                                        className="lg:col-span-1"
                                    />
                                    <TimelineEtapas
                                        stages={tracingData?.stages}
                                        loading={loadingTracing}
                                        className="lg:col-span-2"
                                    />
                                </div>

                                {/* Section: General Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                            Información General
                                        </h4>
                                        <div className="space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Cliente</p>
                                                    <p className="text-sm font-semibold text-slate-800">{selectedVerificacion.cliente || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">N° Verificación</p>
                                                    <p className="text-sm font-semibold text-indigo-600 font-mono">{selectedVerificacion.numero_verificacion}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Documento de Referencia</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedVerificacion.codigo_documento} (v{selectedVerificacion.version})</p>
                                                <p className="text-xs text-muted-foreground">Fecha Doc: {selectedVerificacion.fecha_documento} • Pág: {selectedVerificacion.pagina}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                            Fecha y Responsable
                                        </h4>
                                        <div className="space-y-2.5">
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Fecha de Verificación</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedVerificacion.fecha_verificacion || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Verificado Por</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedVerificacion.verificado_por || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Samples Table */}
                                <div>
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">
                                            {selectedVerificacion.muestras_verificadas?.length || 0}
                                        </span>
                                        Probetas Verificadas
                                    </h3>
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table className="min-w-[1800px]">
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 text-[10px] hover:bg-muted/50">
                                                    <TableHead className="w-[40px] text-center font-bold">Itm</TableHead>
                                                    <TableHead className="font-bold">Cód. LEM</TableHead>
                                                    <TableHead className="font-bold">Tipo</TableHead>
                                                    <TableHead className="text-center font-bold">Ø1 (mm)</TableHead>
                                                    <TableHead className="text-center font-bold">Ø2 (mm)</TableHead>
                                                    <TableHead className="text-center font-bold">Tol (%)</TableHead>
                                                    <TableHead className="text-center font-bold">Aceptación</TableHead>
                                                    <TableHead className="text-center font-bold">SUP 1</TableHead>
                                                    <TableHead className="text-center font-bold">SUP 2</TableHead>
                                                    <TableHead className="text-center font-bold">INF 1</TableHead>
                                                    <TableHead className="text-center font-bold">INF 2</TableHead>
                                                    <TableHead className="text-center font-bold">Med&lt;0.5 S</TableHead>
                                                    <TableHead className="text-center font-bold">Med&lt;0.5 I</TableHead>
                                                    <TableHead className="text-center font-bold">C.Sup &lt;0.05</TableHead>
                                                    <TableHead className="text-center font-bold">C.Inf &lt;0.05</TableHead>
                                                    <TableHead className="text-center font-bold">Depres ≤5mm</TableHead>
                                                    <TableHead className="text-center font-bold">Long 1</TableHead>
                                                    <TableHead className="text-center font-bold">Long 2</TableHead>
                                                    <TableHead className="text-center font-bold">Long 3</TableHead>
                                                    <TableHead className="text-center font-bold">Masa (g)</TableHead>
                                                    <TableHead className="text-center font-bold">Pesar</TableHead>
                                                    <TableHead className="font-bold">Acción</TableHead>
                                                    <TableHead className="font-bold">Conformidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="text-xs">
                                                {selectedVerificacion.muestras_verificadas?.map((m: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="text-center font-medium bg-muted/20">{m.item_numero}</TableCell>
                                                        <TableCell className="font-mono text-primary">{m.codigo_lem || "-"}</TableCell>
                                                        <TableCell className="uppercase">{m.tipo_testigo || "-"}</TableCell>
                                                        <TableCell className="text-center">{m.diametro_1_mm ?? "-"}</TableCell>
                                                        <TableCell className="text-center">{m.diametro_2_mm ?? "-"}</TableCell>
                                                        <TableCell className="text-center">{m.tolerancia_porcentaje != null ? `${m.tolerancia_porcentaje}%` : "-"}</TableCell>
                                                        <TableCell className="text-center">
                                                            {m.aceptacion_diametro ? (
                                                                <Badge variant="outline" className={m.aceptacion_diametro.toLowerCase().includes("cumple") && !m.aceptacion_diametro.toLowerCase().includes("no") ? "text-green-600 border-green-200 bg-green-50" : "text-destructive border-destructive/20 bg-destructive/5"}>
                                                                    {m.aceptacion_diametro}
                                                                </Badge>
                                                            ) : "-"}
                                                        </TableCell>
                                                        <TableCell className="text-center">{m.perpendicularidad_sup1 != null ? (m.perpendicularidad_sup1 ? "✓" : "✗") : "-"}</TableCell>
                                                        <TableCell className="text-center">{m.perpendicularidad_sup2 != null ? (m.perpendicularidad_sup2 ? "✓" : "✗") : "-"}</TableCell>
                                                        <TableCell className="text-center">{m.perpendicularidad_inf1 != null ? (m.perpendicularidad_inf1 ? "✓" : "✗") : "-"}</TableCell>
                                                        <TableCell className="text-center">{m.perpendicularidad_inf2 != null ? (m.perpendicularidad_inf2 ? "✓" : "✗") : "-"}</TableCell>
                                                        <TableCell className="text-center">{m.perpendicularidad_medida != null ? (m.perpendicularidad_medida ? "✓" : "✗") : "-"}</TableCell>
                                                        <TableCell className="text-center">{m.planitud_medida != null ? (m.planitud_medida ? "✓" : "✗") : "-"}</TableCell>
                                                        <TableCell className="text-center">{m.planitud_superior_aceptacion || "-"}</TableCell>
                                                        <TableCell className="text-center">{m.planitud_inferior_aceptacion || "-"}</TableCell>
                                                        <TableCell className="text-center">{m.planitud_depresiones_aceptacion || "-"}</TableCell>
                                                        <TableCell className="text-center">{m.longitud_1_mm ?? "-"}</TableCell>
                                                        <TableCell className="text-center">{m.longitud_2_mm ?? "-"}</TableCell>
                                                        <TableCell className="text-center">{m.longitud_3_mm ?? "-"}</TableCell>
                                                        <TableCell className="text-center">{m.masa_muestra_aire_g ?? "-"}</TableCell>
                                                        <TableCell className="text-center">{m.pesar || "-"}</TableCell>
                                                        <TableCell>{m.accion_realizar || "-"}</TableCell>
                                                        <TableCell>{m.conformidad || "-"}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!selectedVerificacion.muestras_verificadas || selectedVerificacion.muestras_verificadas.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={23} className="text-center text-muted-foreground py-8">
                                                            No hay probetas registradas en esta verificación.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="p-6 border-t shrink-0 bg-muted/5 gap-2 sm:gap-0">
                        <div className="flex-1 text-xs text-muted-foreground flex items-center">
                            ID Referencia: {selectedVerificacion?.id}
                        </div>
                        <Button variant="outline" onClick={() => selectedVerificacion && handleDownloadExcel(selectedVerificacion.id)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2 text-green-600" />
                            Descargar Excel
                        </Button>
                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
