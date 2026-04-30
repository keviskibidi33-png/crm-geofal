"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Construction,
  FlaskConical,
  Grid,
  Loader2,
  Map,
  PlusCircle,
  RefreshCw,
  Search,
  Square,
  TimerReset,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/use-auth"
import { authFetch } from "@/lib/api-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type CatalogItem = {
  codigo: string
  nombre: string
  area?: string | null
  orden: number
  activo: boolean
}

type ResumenItem = {
  codigo: string
  nombre: string
  ultimo_informe: string
  total_anio?: number | null
  total_mes?: number | null
  total?: number | null
  ultimo_enviado: boolean
  ultimo_responsable: string
}

type TurnParticipant = {
  user_id: string
  user_name?: string | null
  estado: string
  joined_at: string
  activated_at?: string | null
  expires_at?: string | null
}

type TurnState = {
  user_id: string
  user_name?: string | null
  estado: string
  tiene_turno: boolean
  turno_activo_user_id?: string | null
  turno_activo_user_name?: string | null
  turno_activo_desde?: string | null
  turno_expira_en?: string | null
  segundos_restantes: number
  en_cola: number
  personas_esperando: number
  participantes: TurnParticipant[]
  mensaje?: string | null
}

type TabCategory = {
  id: string
  label: string
  icon: typeof FlaskConical
  queryAreas: string[]
  areaOrder: Record<string, number>
  categoryLabels?: Record<string, string>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

const TABS_CATEGORIES: TabCategory[] = [
  {
    id: "SUELO",
    label: "SUELO",
    icon: FlaskConical,
    queryAreas: ["SUELO", "HUMEDAD SUELO", "DENSIDAD SUELO"],
    areaOrder: {
      "SUELO": 0,
      "HUMEDAD SUELO": 1,
      "DENSIDAD SUELO": 2,
    },
    categoryLabels: {
      "SUELO": "SUELO",
      "HUMEDAD SUELO": "HUMEDAD",
      "DENSIDAD SUELO": "DENSIDAD",
    },
  },
  {
    id: "AGREGADO",
    label: "AGREGADO",
    icon: Grid,
    queryAreas: ["AGREGADO"],
    areaOrder: {
      "AGREGADO": 0,
    },
  },
  {
    id: "CONCRETO",
    label: "CONCRETO",
    icon: Construction,
    queryAreas: ["PROBETAS", "CONCRETO", "AGUA"],
    areaOrder: {
      "PROBETAS": 0,
      "CONCRETO": 1,
      "AGUA": 2,
    },
    categoryLabels: {
      "PROBETAS": "CONCRETO",
      "CONCRETO": "CONCRETO",
      "AGUA": "AGUA",
    },
  },
  {
    id: "ALBAÑILERIA",
    label: "ALBAÑILERIA",
    icon: Square,
    queryAreas: ["ALBAÑILERIA"],
    areaOrder: {
      "ALBAÑILERIA": 0,
    },
  },
  {
    id: "PAVIMENTO",
    label: "PAVIMENTO",
    icon: Map,
    queryAreas: ["PAVIMENTO"],
    areaOrder: {
      "PAVIMENTO": 0,
    },
  },
]

const getTabConfig = (tabId: string): TabCategory =>
  TABS_CATEGORIES.find((cat) => cat.id === tabId) ?? TABS_CATEGORIES[0]

const getAreaQuery = (tabId: string): string => getTabConfig(tabId).queryAreas.join(",")

const getCategoryLabel = (tab: TabCategory, area?: string | null): string => {
  const normalizedArea = (area || "").toUpperCase()
  return tab.categoryLabels?.[normalizedArea] || normalizedArea || tab.label
}

const formatSeconds = (seconds: number): string => {
  const safe = Math.max(0, Number(seconds || 0))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

export function ControlInformesModule() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueState, setQueueState] = useState<TurnState | null>(null)
  const [catalogo, setCatalogo] = useState<CatalogItem[]>([])
  const [resumen, setResumen] = useState<ResumenItem[]>([])
  const [activeTab, setActiveTab] = useState("SUELO")
  const [searchTerm, setSearchTerm] = useState("")
  const queueToastRef = useRef<string | null>(null)

  const activeTabConfig = useMemo(() => getTabConfig(activeTab), [activeTab])

  const apiCall = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (user?.id) headers.set("x-dev-user-id", user.id)
      if (user?.name) headers.set("x-dev-user-name", user.name)
      return authFetch(url, { ...init, headers })
    },
    [user?.id, user?.name],
  )

  const canEdit = Boolean(queueState?.tiene_turno && (queueState?.segundos_restantes ?? 0) > 0)

  const sortedResumen = useMemo(() => {
    const orderMap = new Map(
      catalogo.map((item) => [
        item.codigo,
        {
          area: (item.area || "").toUpperCase(),
          orden: Number(item.orden || 0),
          nombre: item.nombre,
        },
      ]),
    )

    return [...resumen].sort((a, b) => {
      const aMeta = orderMap.get(a.codigo)
      const bMeta = orderMap.get(b.codigo)
      const aArea = aMeta?.area || ""
      const bArea = bMeta?.area || ""
      const aPriority = activeTabConfig.areaOrder[aArea] ?? 999
      const bPriority = activeTabConfig.areaOrder[bArea] ?? 999

      if (aPriority !== bPriority) return aPriority - bPriority

      if (activeTabConfig.id === "CONCRETO") {
        if (a.codigo === "pb-res-prob" && b.codigo !== "pb-res-prob") return -1
        if (b.codigo === "pb-res-prob" && a.codigo !== "pb-res-prob") return 1
      }

      const aOrden = aMeta?.orden ?? 999
      const bOrden = bMeta?.orden ?? 999
      if (aOrden !== bOrden) return aOrden - bOrden

      return a.nombre.localeCompare(b.nombre)
    })
  }, [activeTabConfig, catalogo, resumen])

  const filteredResumen = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return sortedResumen

    return sortedResumen.filter((item) => {
      const catalogItem = catalogo.find((c) => c.codigo === item.codigo)
      const categoryLabel = getCategoryLabel(activeTabConfig, catalogItem?.area).toLowerCase()
      return (
        item.nombre.toLowerCase().includes(query) ||
        item.codigo.toLowerCase().includes(query) ||
        categoryLabel.includes(query)
      )
    })
  }, [activeTabConfig, catalogo, searchTerm, sortedResumen])

  const loadData = useCallback(
    async (area: string = getAreaQuery(activeTab)) => {
      setResumen([])
      setLoading(true)
      try {
        const [dashboardRes, resumenRes] = await Promise.all([
          apiCall(`${API_URL}/api/control-informes/dashboard`),
          apiCall(`${API_URL}/api/control-informes/resumen?area=${encodeURIComponent(area)}`),
        ])

        if (!dashboardRes.ok) throw new Error("No se pudo cargar el catálogo")
        if (!resumenRes.ok) throw new Error("No se pudo cargar el resumen")

        const dashboardData = await dashboardRes.json()
        const resumenData = await resumenRes.json()

        setCatalogo(Array.isArray(dashboardData?.catalogo) ? dashboardData.catalogo : [])
        setResumen(
          Array.isArray(resumenData?.items)
            ? resumenData.items.map((item: ResumenItem) => ({
                ...item,
                total_anio: Number(item.total_anio ?? item.total_mes ?? item.total ?? 0),
              }))
            : [],
        )
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Error al cargar datos")
      } finally {
        setLoading(false)
      }
    },
    [activeTab, apiCall],
  )

  const fetchQueueState = useCallback(async () => {
    if (!user?.id) return

    try {
      const response = await apiCall(`${API_URL}/api/control-informes/turno/estado`)
      if (!response.ok) throw new Error("No se pudo consultar la cola")
      const data = (await response.json()) as TurnState
      setQueueState(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo consultar la cola")
    }
  }, [apiCall, user?.id])

  const joinQueue = useCallback(
    async (showToast = false) => {
      if (!user?.id) return
      setQueueLoading(true)
      try {
        const response = await apiCall(`${API_URL}/api/control-informes/turno/entrar`, {
          method: "POST",
        })
        if (!response.ok) throw new Error("No se pudo entrar a la cola")
        const data = (await response.json()) as TurnState
        setQueueState(data)
        if (showToast) {
          toast.success(data.tiene_turno ? "Ya puedes editar Control de Informes." : "Te agregamos a la cola de edición.")
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo entrar a la cola")
      } finally {
        setQueueLoading(false)
      }
    },
    [apiCall, user?.id],
  )

  const leaveQueue = useCallback(
    async (showToast = true) => {
      if (!user?.id) return
      setQueueLoading(true)
      try {
        const response = await apiCall(`${API_URL}/api/control-informes/turno/salir`, {
          method: "POST",
        })
        if (!response.ok) throw new Error("No se pudo salir de la cola")
        const data = (await response.json()) as TurnState
        setQueueState(data)
        if (showToast) {
          toast.success("Tu turno fue liberado.")
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo salir de la cola")
      } finally {
        setQueueLoading(false)
      }
    },
    [apiCall, user?.id],
  )

  useEffect(() => {
    void loadData(getAreaQuery(activeTab))
  }, [activeTab, loadData])

  useEffect(() => {
    if (!user?.id) return
    void joinQueue(false)
  }, [joinQueue, user?.id])

  useEffect(() => {
    if (!user?.id) return
    const interval = window.setInterval(() => {
      void fetchQueueState()
    }, 5000)

    return () => window.clearInterval(interval)
  }, [fetchQueueState, user?.id])

  useEffect(() => {
    const message = queueState?.mensaje?.trim()
    if (!message) {
      queueToastRef.current = null
      return
    }

    if (queueState?.tiene_turno) {
      queueToastRef.current = null
      return
    }

    if (queueToastRef.current === message) return
    queueToastRef.current = message
    toast.info(message)
  }, [queueState?.mensaje, queueState?.tiene_turno])

  const quickRegister = async (codigo: string) => {
    if (!canEdit) {
      toast.error(queueState?.mensaje || "No es tu turno para editar Control de Informes.")
      return
    }

    setSaving(codigo)
    try {
      const res = await apiCall(`${API_URL}/api/control-informes`, {
        method: "POST",
        body: JSON.stringify({
          fecha: new Date().toISOString().slice(0, 10),
          archivo_nombre: "REGISTRO RÁPIDO",
          archivo_url: null,
          observaciones: "Incremento por acción rápida",
          ensayos: [codigo],
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409 && data?.turno) {
          setQueueState(data.turno as TurnState)
        }
        throw new Error(data?.message || data?.detail || "No se pudo registrar")
      }

      toast.success("Contador incrementado correctamente. Tu turno fue liberado.")
      await Promise.all([loadData(getAreaQuery(activeTab)), fetchQueueState()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al registrar")
    } finally {
      setSaving(null)
    }
  }

  const renderCategoryTable = (tab: TabCategory) => {
    const showCategoryColumn = tab.queryAreas.length > 1

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-300">
            <tr>
              <th className="px-6 py-4 text-sm uppercase tracking-wider">Tipo de Ensayo</th>
              <th className="px-6 py-4 border-l border-slate-200 text-center text-sm uppercase tracking-wider">Último Informe</th>
              <th className="px-6 py-4 border-l border-slate-200 text-center text-slate-950 text-sm uppercase tracking-wider">Total</th>
              {showCategoryColumn && <th className="px-6 py-4 border-l border-slate-200 text-center text-sm uppercase tracking-wider">Categoría</th>}
              <th className="px-6 py-4 border-l border-slate-200 text-center text-sm uppercase tracking-wider">Acción Rápida</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={showCategoryColumn ? 5 : 4} className="px-6 py-8 text-center text-slate-300">
                    Cargando datos...
                  </td>
                </tr>
              ))
            ) : filteredResumen.length === 0 ? (
              <tr>
                <td colSpan={showCategoryColumn ? 5 : 4} className="px-6 py-12 text-center text-slate-400 italic">
                  {searchTerm.trim() ? "No hay ensayos que coincidan con la búsqueda." : "No se encontraron ensayos registrados en esta área."}
                </td>
              </tr>
            ) : (
              filteredResumen.map((item) => {
                const catalogItem = catalogo.find((c) => c.codigo === item.codigo)
                const isAgua = (catalogItem?.area || "").toUpperCase() === "AGUA"
                const categoryLabel = getCategoryLabel(tab, catalogItem?.area)

                return (
                  <tr
                    key={item.codigo}
                    className={`group hover:bg-slate-50 transition-colors ${isAgua ? "bg-sky-50/50 hover:bg-sky-100/50" : ""}`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-base font-bold text-slate-900 leading-tight">{item.nombre}</span>
                        <span className="text-xs text-slate-400 uppercase tracking-wide">{item.codigo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 border-l border-slate-200 text-center">
                      <Badge
                        variant="outline"
                        className={`text-sm font-mono border-slate-300 px-3 py-1 mx-auto ${
                          item.ultimo_informe !== "-" ? "bg-slate-50 text-slate-950 font-bold" : "text-slate-400"
                        }`}
                      >
                        {item.ultimo_informe}
                      </Badge>
                    </td>
                    <td className="px-6 py-5 border-l border-slate-200 text-center">
                      <span className={`text-lg font-bold block ${(Number(item.total_anio) || 0) > 0 ? "text-slate-950" : "text-slate-400"}`}>
                        {Number(item.total_anio ?? item.total_mes ?? item.total ?? 0)}
                      </span>
                    </td>

                    {showCategoryColumn && (
                      <td className="px-6 py-5 border-l border-slate-200 text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs font-bold ${
                            isAgua ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-50 text-slate-700 border-slate-300"
                          }`}
                        >
                          {categoryLabel}
                        </Badge>
                      </td>
                    )}

                    <td className="px-6 py-5 text-center border-l border-slate-200">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="outline"
                              className={`h-9 w-9 rounded-xl transition-all border-slate-200 shadow-sm ${
                                canEdit
                                  ? "text-slate-600 hover:bg-slate-900 hover:text-white"
                                  : "text-slate-400 bg-slate-50 hover:bg-slate-100"
                              }`}
                              onClick={() => void quickRegister(item.codigo)}
                              disabled={saving === item.codigo}
                            >
                              {saving === item.codigo ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-5 w-5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {canEdit ? "Registro Rápido (+1)" : "No es tu turno para registrar"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 px-4 md:px-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Control de Informes</h1>
          <p className="text-slate-500 text-sm font-medium">Gestión dinámica de correlativos por área técnica con control de cola por usuario.</p>
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar ensayo por nombre, código o categoría..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
                  <TimerReset className="h-5 w-5" />
                  Sesión de edición
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Cada usuario tiene 1 minuto para registrar cambios. Si no es tu turno, entras automáticamente a la cola.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={canEdit ? "default" : "outline"} className={canEdit ? "bg-emerald-600" : ""}>
                  {canEdit ? `Tu turno · ${formatSeconds(queueState?.segundos_restantes ?? 0)}` : queueState?.estado === "waiting" ? `En cola #${queueState?.en_cola || 0}` : "Sin turno"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => void fetchQueueState()} disabled={queueLoading}>
                  {queueLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Actualizar cola
                </Button>
                {queueState?.estado === "sin_turno" ? (
                  <Button size="sm" onClick={() => void joinQueue(true)} disabled={queueLoading}>
                    Entrar a la cola
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => void leaveQueue(true)} disabled={queueLoading}>
                    Ceder turno
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              canEdit ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"
            }`}>
              {queueState?.mensaje || "Ingresa a la cola para empezar a editar."}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Turno activo</div>
                <div className="mt-2 text-sm font-bold text-slate-900">
                  {queueState?.turno_activo_user_name || queueState?.turno_activo_user_id || "Nadie"}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tiempo restante</div>
                <div className="mt-2 text-sm font-bold text-slate-900">{formatSeconds(queueState?.segundos_restantes ?? 0)}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Personas esperando</div>
                <div className="mt-2 text-sm font-bold text-slate-900">{queueState?.personas_esperando ?? 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
              <Users className="h-5 w-5" />
              Vista de colas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {queueState?.participantes?.length ? (
              queueState.participantes.map((participant, index) => {
                const waitingPosition =
                  participant.estado === "waiting"
                    ? queueState.participantes
                        .slice(0, index + 1)
                        .filter((item) => item.estado === "waiting").length
                    : 0

                return (
                  <div key={`${participant.user_id}-${index}`} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {participant.user_name || participant.user_id}
                        </p>
                        <p className="text-xs text-slate-500">
                          {participant.estado === "active" ? "Turno activo" : `En cola #${waitingPosition}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={participant.estado === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                        {participant.estado === "active" ? "ACTIVO" : "COLA"}
                      </Badge>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                Todavía no hay usuarios en cola.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
        <div className="overflow-x-auto pb-2 scrollbar-none">
          <TabsList className="bg-slate-100 border border-slate-200 p-1 h-auto flex-nowrap w-max min-w-full justify-start md:justify-center">
            {TABS_CATEGORIES.map((cat) => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm transition-all whitespace-nowrap"
              >
                <cat.icon className="h-4 w-4" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TABS_CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-0 outline-none">
            <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg">
                      <cat.icon className="h-5 w-5 text-slate-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-slate-900 font-bold uppercase tracking-tight">
                        Control — {cat.label}
                      </CardTitle>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void loadData(getAreaQuery(cat.id))}
                    className="border-slate-200 hover:bg-slate-50 text-slate-500"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">{renderCategoryTable(cat)}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
