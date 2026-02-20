"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Plus, Droplets, Loader2, AlertCircle, RefreshCw, Search, Eye, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { authFetch } from "@/lib/api-auth"

// --- Smart Iframe Component with Retry Logic ---
interface SmartIframeProps {
    src: string;
    title: string;
}

interface HumedadEnsayoSummary {
    id: number
    numero_ensayo?: string | null
    numero_ot?: string | null
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado?: string | null
    contenido_humedad?: number | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

interface HumedadEnsayoDetail extends HumedadEnsayoSummary {
    payload?: {
        realizado_por?: string
        descripcion_material_excluido?: string
        observaciones?: string
    } | null
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

        const timeoutMs = 20000 * Math.pow(2, retryCount); 
        
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

export function HumedadModule() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [token, setToken] = useState<string | null>(null)
    const [ensayos, setEnsayos] = useState<HumedadEnsayoSummary[]>([])
    const [selectedDetail, setSelectedDetail] = useState<HumedadEnsayoDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [loading, setLoading] = useState(false)
    const [iframePath, setIframePath] = useState<string>('/')
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(null)
    const [search, setSearch] = useState('')

    const FRONTEND_URL = (
        process.env.NEXT_PUBLIC_HUMEDAD_FRONTEND_URL ||
        process.env.NEXT_PUBLIC_HUMEDAD_URL ||
        "https://humedad.geofal.com.pe"
    ).replace(/\/+$/, "")
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

    const syncIframeToken = async (): Promise<string | null> => {
        const { data: { session } } = await supabase.auth.getSession()
        const freshToken = session?.access_token ?? null
        setToken(freshToken)
        return freshToken
    }

    const fetchEnsayos = useCallback(async () => {
        setLoading(true)
        try {
            const res = await authFetch(`${API_URL}/api/humedad/`)
            if (res.ok) {
                const data: HumedadEnsayoSummary[] = await res.json()
                setEnsayos(data)
            }
        } catch (err) {
            console.error('Error fetching humedad ensayos', err)
        } finally {
            setLoading(false)
        }
    }, [API_URL])

    useEffect(() => {
        fetchEnsayos()
        void syncIframeToken()
    }, [fetchEnsayos])

    // Listen for close message from iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                fetchEnsayos()
            }
            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session && event.source) {
                        (event.source as Window).postMessage(
                            { type: 'TOKEN_REFRESH', token: session.access_token },
                            '*'
                        )
                    }
                })
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [fetchEnsayos])

    const openNewEnsayo = async () => {
        await syncIframeToken()
        setEditingEnsayoId(null)
        setIframePath('/')
        setIsModalOpen(true)
    }

    const openEditEnsayo = async (id: number) => {
        await syncIframeToken()
        setEditingEnsayoId(id)
        setIframePath('/')
        setIsModalOpen(true)
    }

    const openDetail = async (id: number) => {
        setDetailLoading(true)
        try {
            const res = await authFetch(`${API_URL}/api/humedad/${id}`)
            if (!res.ok) {
                throw new Error("No se pudo cargar el detalle.")
            }
            const data: HumedadEnsayoDetail = await res.json()
            setSelectedDetail(data)
            setIsDetailOpen(true)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error desconocido"
            toast.error(message)
        } finally {
            setDetailLoading(false)
        }
    }

    const filtered = ensayos.filter((e) => {
        const term = search.trim().toLowerCase()
        if (!term) return true
        return (
            (e.muestra || e.cliente || '').toLowerCase().includes(term) ||
            (e.numero_ot || '').toLowerCase().includes(term)
        )
    })

    const iframeSrc = useMemo(() => {
        const basePath = iframePath.startsWith('/') ? iframePath : `/${iframePath}`
        const url = new URL(`${FRONTEND_URL}${basePath}`)
        if (token) {
            url.searchParams.set('token', token)
        }
        if (editingEnsayoId) {
            url.searchParams.set('ensayo_id', String(editingEnsayoId))
        }
        return url.toString()
    }, [FRONTEND_URL, iframePath, token, editingEnsayoId])

    const formatDate = useCallback((value?: string | null) => {
        if (!value) return "-"
        const parsed = new Date(value)
        if (Number.isNaN(parsed.getTime())) return value
        return new Intl.DateTimeFormat("es-PE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }).format(parsed)
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Droplets className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Contenido de Humedad</h2>
                        <p className="text-muted-foreground">ASTM D2216-19 — Reportes</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Input
                            placeholder="Buscar codigo de muestra o N OT..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 w-64"
                        />
                        <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    </div>
                    <Button onClick={openNewEnsayo} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo Ensayo
                    </Button>
                </div>
            </div>

            <div className="border rounded-xl shadow-sm bg-white">
                <div className="px-4 py-3 border-b bg-slate-50/70 rounded-t-xl">
                    <h3 className="text-sm font-semibold text-slate-900">Historial de Humedad</h3>
                    <p className="text-xs text-muted-foreground">Registros guardados con acceso a ver detalle y edición.</p>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-40">Codigo de Muestra</TableHead>
                            <TableHead>N OT</TableHead>
                            <TableHead className="w-32">Estado</TableHead>
                            <TableHead className="w-64 text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                                    Cargando ensayos...
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                                    Sin resultados.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.map((ensayo) => (
                            <TableRow key={ensayo.id} className="hover:bg-slate-50">
                                <TableCell className="font-semibold">{ensayo.muestra || ensayo.cliente || 'S/N'}</TableCell>
                                <TableCell>{ensayo.numero_ot || '-'}</TableCell>
                                <TableCell>
                                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                        {ensayo.estado || 'Pendiente'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1"
                                            disabled={detailLoading}
                                            onClick={() => void openDetail(ensayo.id)}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            Ver detalle
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 gap-1"
                                            onClick={() => void openEditEnsayo(ensayo.id)}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Editar
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableCaption className="text-xs text-muted-foreground">Humedad — listado con búsqueda y acceso rápido.</TableCaption>
                </Table>
            </div>

            {/* Iframe modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background [&>button]:hidden">
                    <DialogHeader className="hidden">
                        <DialogTitle>Ensayo de Humedad</DialogTitle>
                        <DialogDescription>Formulario de contenido de humedad ASTM D2216</DialogDescription>
                    </DialogHeader>
                    <SmartIframe
                        src={iframeSrc}
                        title="Humedad CRM"
                    />
                </DialogContent>
            </Dialog>

            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Detalle de Ensayo #{selectedDetail?.id ?? "-"}</DialogTitle>
                        <DialogDescription>Información guardada del ensayo de humedad.</DialogDescription>
                    </DialogHeader>
                    {selectedDetail ? (
                        <div className="space-y-2 text-sm">
                            <p><span className="font-semibold">Codigo de Muestra:</span> {selectedDetail.muestra || selectedDetail.cliente || "-"}</p>
                            <p><span className="font-semibold">N OT:</span> {selectedDetail.numero_ot || "-"}</p>
                            <p><span className="font-semibold">N° Ensayo:</span> {selectedDetail.numero_ensayo || "-"}</p>
                            <p><span className="font-semibold">Fecha:</span> {formatDate(selectedDetail.fecha_documento)}</p>
                            <p><span className="font-semibold">Estado:</span> {selectedDetail.estado || "-"}</p>
                            <p><span className="font-semibold">Realizado por:</span> {selectedDetail.payload?.realizado_por || "-"}</p>
                            <p><span className="font-semibold">Descripción material excluido:</span> {selectedDetail.payload?.descripcion_material_excluido || "-"}</p>
                            <p><span className="font-semibold">Observaciones:</span> {selectedDetail.payload?.observaciones || "-"}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No hay detalle disponible.</p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
