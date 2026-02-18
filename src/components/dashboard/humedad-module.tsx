"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Plus, Droplets, Loader2, AlertCircle, RefreshCw, Search, FileSpreadsheet, Eye } from "lucide-react"
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
    const [token, setToken] = useState<string | null>(null)
    const [ensayos, setEnsayos] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [iframePath, setIframePath] = useState<string>('/')
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

    const fetchEnsayos = async () => {
        setLoading(true)
        try {
            const res = await authFetch(`${API_URL}/api/humedad/`)
            if (res.ok) {
                const data = await res.json()
                setEnsayos(data)
            }
        } catch (err) {
            console.error('Error fetching humedad ensayos', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEnsayos()
        syncIframeToken()
    }, [])

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
    }, [])

    const openNewEnsayo = async () => {
        await syncIframeToken()
        setIframePath('/')
        setIsModalOpen(true)
    }

    const openDetail = async (id: number) => {
        await syncIframeToken()
        setIframePath(`/detalle/${id}`)
        setIsModalOpen(true)
    }

    const filtered = ensayos.filter((e) => {
        const term = search.trim().toLowerCase()
        if (!term) return true
        return (
            (e.numero_ensayo || '').toLowerCase().includes(term) ||
            (e.cliente || '').toLowerCase().includes(term)
        )
    })

    const iframeSrc = useMemo(() => {
        const basePath = iframePath.startsWith('/') ? iframePath : `/${iframePath}`
        const url = new URL(`${FRONTEND_URL}${basePath}`)
        if (token) {
            url.searchParams.set('token', token)
        }
        return url.toString()
    }, [FRONTEND_URL, iframePath, token])

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
                            placeholder="Buscar ensayo o cliente..."
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-40">N° Ensayo</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="w-36">Fecha</TableHead>
                            <TableHead className="w-32">Estado</TableHead>
                            <TableHead className="w-24 text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                                    Cargando ensayos...
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                                    Sin resultados.
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.map((ensayo) => (
                            <TableRow key={ensayo.id} className="hover:bg-slate-50">
                                <TableCell className="font-semibold">{ensayo.numero_ensayo || 'S/N'}</TableCell>
                                <TableCell>{ensayo.cliente || '-'}</TableCell>
                                <TableCell>{ensayo.fecha_documento || '-'}</TableCell>
                                <TableCell>
                                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                        {ensayo.estado || 'Pendiente'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => openDetail(ensayo.id)}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
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
        </div>
    )
}
