"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Beaker, Eye, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type SpecialModuleConfig = {
  apiSlug: string
  frontendUrl?: string
  routePath: string
  title: string
  historyTitle: string
}

interface EnsayoSummary {
  id: number
  numero_ensayo?: string | null
  numero_ot?: string | null
  cliente?: string | null
  muestra?: string | null
  fecha_documento?: string | null
  estado?: string | null
}

interface EnsayoDetail extends EnsayoSummary {
  payload?: {
    realizado_por?: string
    observaciones?: string
  } | null
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/g, "")

const SHARED_SPECIAL_MODULE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_ENSAYOS_ESPECIALES_URL || "https://ensayos-especiales.geofal.com.pe",
)

const resolveModuleFrontendUrl = (routePath: string, specificUrl?: string, fallbackUrl?: string) => {
  const customUrl = specificUrl?.trim()
  if (customUrl) return normalizeBaseUrl(customUrl)
  if (fallbackUrl) return normalizeBaseUrl(fallbackUrl)
  return `${SHARED_SPECIAL_MODULE_URL}${routePath}`
}

function SmartIframe({ src, title }: { src: string; title: string }) {
  const [key, setKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const completeLoad = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setRetryCount(0)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const handleRetry = useCallback(() => {
    setIsLoading(true)
    setError(null)
    setKey((prev) => prev + 1)
    setRetryCount((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!isLoading) return

    const timeoutMs = 20000 * Math.pow(2, retryCount)
    timeoutRef.current = setTimeout(() => {
      if (retryCount < 2) {
        toast.loading(`El servidor tarda en responder. Reintentando... (Intento ${retryCount + 1}/3)`)
        setTimeout(() => {
          toast.dismiss()
          handleRetry()
        }, 1500)
      } else {
        setError(`El servicio no responde despues de varios intentos (${timeoutMs / 1000}s).`)
        setIsLoading(false)
      }
    }, timeoutMs)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [handleRetry, isLoading, retryCount])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "IFRAME_READY") return
      if (event.source !== iframeRef.current?.contentWindow) return
      completeLoad()
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [completeLoad])

  const currentSrc = useMemo(() => {
    const url = new URL(src)
    url.searchParams.set("retry", retryCount.toString())
    url.searchParams.set("t", Date.now().toString())
    return url.toString()
  }, [retryCount, src])

  return (
    <div className="relative h-full w-full bg-gray-50">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm transition-all duration-300">
          <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
          <p className="text-center text-sm font-medium text-muted-foreground animate-pulse">Conectando con el modulo...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white p-6 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 shadow-sm">
            <AlertCircle className="h-10 w-10 text-red-500" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-gray-900">Conexion interrumpida</h3>
          <p className="mb-8 max-w-xs text-sm leading-relaxed text-gray-500">{error}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recargar pagina
            </Button>
            <Button onClick={handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar conexion
            </Button>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={key}
        src={currentSrc}
        className={`h-full w-full border-none transition-opacity duration-700 ${isLoading ? "opacity-0" : "opacity-100"}`}
        title={title}
        onLoad={completeLoad}
        onError={() => setError("Error al cargar el iframe.")}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        loading="eager"
      />
    </div>
  )
}

function SpecialLabModule({ config }: { config: SpecialModuleConfig }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [ensayos, setEnsayos] = useState<EnsayoSummary[]>([])
  const [selectedDetail, setSelectedDetail] = useState<EnsayoDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshingTable, setRefreshingTable] = useState(false)
  const [deletingEnsayoId, setDeletingEnsayoId] = useState<number | null>(null)
  const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(null)
  const [search, setSearch] = useState("")
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

  const syncIframeToken = async (): Promise<string | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const freshToken = session?.access_token ?? null
    setToken(freshToken)
    return freshToken
  }

  const fetchEnsayos = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/${config.apiSlug}/?_ts=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) return false
      const data: EnsayoSummary[] = await res.json()
      setEnsayos(data)
      return true
    } catch (error) {
      console.error(`Error fetching ${config.title} ensayos`, error)
      return false
    } finally {
      setLoading(false)
    }
  }, [API_URL, config.apiSlug, config.title])

  useEffect(() => {
    void fetchEnsayos()
    void syncIframeToken()
  }, [fetchEnsayos])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "CLOSE_MODAL") {
        setIsModalOpen(false)
        void fetchEnsayos()
      }
      if (event.data?.type === "TOKEN_REFRESH_REQUEST" && event.source) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session && event.source) {
            ;(event.source as Window).postMessage({ type: "TOKEN_REFRESH", token: session.access_token }, "*")
          }
        })
      }
    }
    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [fetchEnsayos])

  const openNewEnsayo = async () => {
    await syncIframeToken()
    setEditingEnsayoId(null)
    setIsModalOpen(true)
  }

  const openEditEnsayo = async (id: number) => {
    await syncIframeToken()
    setEditingEnsayoId(id)
    setIsModalOpen(true)
  }

  const openDetail = async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/${config.apiSlug}/${id}?_ts=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("No se pudo cargar el detalle.")
      const data: EnsayoDetail = await res.json()
      setSelectedDetail(data)
      setIsDetailOpen(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      toast.error(message)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleRefreshTable = useCallback(async () => {
    if (loading || refreshingTable) return
    setRefreshingTable(true)
    try {
      const ok = await fetchEnsayos()
      toast[ok ? "success" : "error"](
        ok ? `Tabla de ${config.title} actualizada.` : `No se pudo actualizar la tabla de ${config.title}.`,
      )
    } finally {
      setRefreshingTable(false)
    }
  }, [config.title, fetchEnsayos, loading, refreshingTable])

  const handleDeleteEnsayo = useCallback(async (id: number) => {
    const ensayo = ensayos.find((item) => item.id === id)
    const ensayoLabel = ensayo?.muestra || ensayo?.cliente || `#${id}`
    if (!window.confirm(`Enviar a papelera el ensayo de ${config.title} ${ensayoLabel}? Se puede recuperar luego.`)) return

    setDeletingEnsayoId(id)
    try {
      const res = await authFetch(`${API_URL}/api/${config.apiSlug}/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("No se pudo enviar a papelera el ensayo.")
      setEnsayos((prev) => prev.filter((row) => row.id !== id))
      toast.success(`Ensayo de ${config.title} enviado a papelera.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido"
      toast.error(message)
    } finally {
      setDeletingEnsayoId(null)
    }
  }, [API_URL, config.apiSlug, config.title, ensayos])

  const filtered = ensayos.filter((ensayo) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    return (ensayo.muestra || ensayo.cliente || "").toLowerCase().includes(term) || (ensayo.numero_ot || "").toLowerCase().includes(term)
  })

  const iframeSrc = useMemo(() => {
    const url = new URL(config.frontendUrl || resolveModuleFrontendUrl(config.routePath))
    if (token) url.searchParams.set("token", token)
    if (editingEnsayoId) url.searchParams.set("ensayo_id", String(editingEnsayoId))
    return url.toString()
  }, [config.frontendUrl, config.routePath, editingEnsayoId, token])

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return "-"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
  }, [])

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="shrink-0 rounded-lg bg-primary/10 p-2">
            <Beaker className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="wrap-break-word text-xl font-bold leading-tight tracking-tight sm:text-2xl">{config.title}</h2>
            <p className="text-sm text-muted-foreground sm:text-base">Registro y exportacion de ensayos.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
          <div className="relative w-full sm:min-w-[260px] sm:flex-1 lg:w-80 lg:flex-none">
            <Input
              placeholder="Buscar codigo de muestra o N OT..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full pl-10"
            />
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button variant="outline" className="gap-2" onClick={() => void handleRefreshTable()} disabled={loading || refreshingTable}>
            {refreshingTable ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
          <Button onClick={openNewEnsayo} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Ensayo
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="rounded-t-xl border-b bg-slate-50/70 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{config.historyTitle}</h3>
          <p className="text-xs text-muted-foreground">Registros guardados con acceso a detalle y edicion.</p>
        </div>
        <Table className="min-w-[860px]">
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
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Cargando ensayos...</TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">Sin resultados.</TableCell>
              </TableRow>
            )}
            {!loading && filtered.map((ensayo) => (
              <TableRow key={ensayo.id} className="hover:bg-slate-50">
                <TableCell className="font-semibold">{ensayo.muestra || ensayo.cliente || "S/N"}</TableCell>
                <TableCell>{ensayo.numero_ot || "-"}</TableCell>
                <TableCell>
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">{ensayo.estado || "Pendiente"}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1" disabled={detailLoading} onClick={() => void openDetail(ensayo.id)}>
                      <Eye className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Ver detalle</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => void openEditEnsayo(ensayo.id)}>
                      <Pencil className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Editar</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => void handleDeleteEnsayo(ensayo.id)}
                      disabled={deletingEnsayoId === ensayo.id}
                    >
                      {deletingEnsayoId === ensayo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      <span className="hidden xl:inline">Eliminar</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableCaption className="text-xs text-muted-foreground">{config.title} - listado con busqueda y acceso rapido.</TableCaption>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="h-[95vh] w-full max-w-[95vw] overflow-hidden bg-background p-0 [&>button]:hidden">
          <DialogHeader className="hidden">
            <DialogTitle>Ensayo {config.title}</DialogTitle>
            <DialogDescription>Formulario {config.title}</DialogDescription>
          </DialogHeader>
          <SmartIframe src={iframeSrc} title={`${config.title} CRM`} />
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle de Ensayo #{selectedDetail?.id ?? "-"}</DialogTitle>
            <DialogDescription>Informacion guardada del ensayo {config.title}.</DialogDescription>
          </DialogHeader>
          {selectedDetail ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Codigo de Muestra:</span> {selectedDetail.muestra || selectedDetail.cliente || "-"}</p>
              <p><span className="font-semibold">N OT:</span> {selectedDetail.numero_ot || "-"}</p>
              <p><span className="font-semibold">N Ensayo:</span> {selectedDetail.numero_ensayo || "-"}</p>
              <p><span className="font-semibold">Estado:</span> {selectedDetail.estado || "-"}</p>
              <p><span className="font-semibold">Fecha Documento:</span> {formatDate(selectedDetail.fecha_documento)}</p>
              <p><span className="font-semibold">Realizado por:</span> {selectedDetail.payload?.realizado_por || "-"}</p>
              <p><span className="font-semibold">Observaciones:</span> {selectedDetail.payload?.observaciones || "-"}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin detalle disponible.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function ContMatOrganicaModule() {
  return <SpecialLabModule config={{ apiSlug: "cont-mat-organica", frontendUrl: resolveModuleFrontendUrl("/cont-mat-organica", process.env.NEXT_PUBLIC_CONT_MAT_ORGANICA_URL, "https://cont.mat.organicas.geofal.com.pe"), routePath: "/cont-mat-organica", title: "Contenido Materia Organica", historyTitle: "Historial Contenido Materia Organica" }} />
}

export function TerronesFinoGruesoModule() {
  return <SpecialLabModule config={{ apiSlug: "terrones-fino-grueso", frontendUrl: resolveModuleFrontendUrl("/terrones-fino-grueso", process.env.NEXT_PUBLIC_TERRONES_FINO_GRUESO_URL, "https://terrones.finogrueso.geofal.com.pe"), routePath: "/terrones-fino-grueso", title: "Terrones Fino Grueso", historyTitle: "Historial Terrones Fino Grueso" }} />
}

export function AzulMetilenoModule() {
  return <SpecialLabModule config={{ apiSlug: "azul-metileno", frontendUrl: resolveModuleFrontendUrl("/azul-metileno", process.env.NEXT_PUBLIC_AZUL_METILENO_URL, "https://azul.metileno.geofal.com.pe"), routePath: "/azul-metileno", title: "Azul Metileno", historyTitle: "Historial Azul Metileno" }} />
}

export function PartLivianasModule() {
  return <SpecialLabModule config={{ apiSlug: "part-livianas", frontendUrl: resolveModuleFrontendUrl("/part-livianas", process.env.NEXT_PUBLIC_PART_LIVIANAS_URL, "https://part.livianasfinasgrueso.geofal.com.pe"), routePath: "/part-livianas", title: "Particulas Livianas", historyTitle: "Historial Particulas Livianas" }} />
}

export function ImpOrganicasModule() {
  return <SpecialLabModule config={{ apiSlug: "imp-organicas", frontendUrl: resolveModuleFrontendUrl("/imp-organicas", process.env.NEXT_PUBLIC_IMP_ORGANICAS_URL, "https://imp.organicas.geofal.com.pe"), routePath: "/imp-organicas", title: "Impurezas Organicas", historyTitle: "Historial Impurezas Organicas" }} />
}

export function SulMagnesioModule() {
  return <SpecialLabModule config={{ apiSlug: "sul-magnesio", frontendUrl: resolveModuleFrontendUrl("/sul-magnesio", process.env.NEXT_PUBLIC_SUL_MAGNESIO_URL, "https://sul.magnesio.geofal.com.pe"), routePath: "/sul-magnesio", title: "Sulfato de Magnesio", historyTitle: "Historial Sulfato de Magnesio" }} />
}

export function AngularidadModule() {
  return <SpecialLabModule config={{ apiSlug: "angularidad", frontendUrl: resolveModuleFrontendUrl("/angularidad", process.env.NEXT_PUBLIC_ANGULARIDAD_URL, "https://angularidad.geofal.com.pe"), routePath: "/angularidad", title: "Angularidad", historyTitle: "Historial Angularidad" }} />
}
