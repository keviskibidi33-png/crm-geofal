"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, CheckCircle2, Clock3, Eye, FileText, Filter, RefreshCw, Search, UserRoundSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authFetch } from "@/lib/api-auth"
import { type ModuleType } from "@/hooks/use-auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

type LabNotificationStatus = "open" | "acknowledged" | "resolved"

interface LabNotificationItem {
  id: string
  type: string
  severity?: string
  title: string
  message: string
  status?: LabNotificationStatus
  created_at?: string | null
  acknowledged_at?: string | null
  resolved_at?: string | null
  metadata?: Record<string, unknown>
}

interface LabNotificationDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenLabNotification?: (target: { module: ModuleType; recordId: number }) => void
  onAcknowledgeNotification: (notificationId: string) => Promise<void>
}

type StatusFilter = "pendientes" | "vistas"
type DaysPreset = "all" | "1" | "7" | "30"

const dateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const dateOnlyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function formatTimestamp(value?: string | null) {
  if (!value) return "Sin fecha"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return dateFormatter.format(date)
}

function deriveNotificationTarget(item: LabNotificationItem) {
  const rawModule = normalizeText(item.metadata?.detail_module || item.metadata?.module)
  const recordId = Number(item.metadata?.record_id || 0)
  const targetModule = (rawModule === "verificacion" ? "verificacion_muestras" : rawModule) as ModuleType
  if (!targetModule || !recordId) {
    return null
  }
  return { module: targetModule, recordId }
}

export function LabNotificationDetailDialog({
  open,
  onOpenChange,
  onOpenLabNotification,
  onAcknowledgeNotification,
}: LabNotificationDetailDialogProps) {
  const [items, setItems] = useState<LabNotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pendientes")
  const [searchTerm, setSearchTerm] = useState("")
  const [creatorFilter, setCreatorFilter] = useState("all")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!open) return

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)
    try {
      const response = await authFetch(`${API_URL}/notifications/feed?limit=100`)
      if (!response.ok) {
        throw new Error(`Feed notifications failed: ${response.status}`)
      }

      const payload = await response.json()
      setItems(Array.isArray(payload?.data) ? payload.data : [])
    } catch (fetchError) {
      console.error("Error loading lab notification detail:", fetchError)
      setItems([])
      setError("No pudimos cargar el detalle de notificaciones.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    void loadNotifications(false)
  }, [loadNotifications, open])

  const creators = useMemo(() => {
    const uniqueCreators = new Set<string>()
    for (const item of items) {
      const creator = String(item.metadata?.created_by || item.metadata?.full_name || item.metadata?.user_name || "Usuario").trim()
      if (creator) uniqueCreators.add(creator)
    }
    return Array.from(uniqueCreators).sort((left, right) => left.localeCompare(right, "es"))
  }, [items])

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const createdDateStart = fromDate ? new Date(`${fromDate}T00:00:00`) : null
    const createdDateEnd = toDate ? new Date(`${toDate}T23:59:59.999`) : null

    return items
      .slice()
      .sort((left, right) => {
        const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0
        const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0
        return rightTime - leftTime
      })
      .filter((item) => {
        const isAcknowledged = item.status === "acknowledged"
        if (statusFilter === "pendientes" && isAcknowledged) return false
        if (statusFilter === "vistas" && !isAcknowledged) return false

        const creator = String(item.metadata?.created_by || item.metadata?.full_name || item.metadata?.user_name || "").trim()
        if (creatorFilter !== "all" && creator !== creatorFilter) {
          return false
        }

        if (createdDateStart || createdDateEnd) {
          const createdAt = item.created_at ? new Date(item.created_at) : null
          if (!createdAt || Number.isNaN(createdAt.getTime())) return false
          if (createdDateStart && createdAt < createdDateStart) return false
          if (createdDateEnd && createdAt > createdDateEnd) return false
        }

        if (query.length > 0) {
          const haystack = [
            item.title,
            item.message,
            item.type,
            item.metadata?.module_label,
            item.metadata?.record_code,
            item.metadata?.created_by,
            item.metadata?.full_name,
            item.metadata?.user_name,
            item.metadata?.detail_module,
            item.metadata?.module,
            item.metadata?.client_name,
            item.metadata?.cliente,
          ]
            .map(normalizeText)
            .join(" ")

          if (!haystack.includes(query)) {
            return false
          }
        }

        return true
      })
  }, [creatorFilter, fromDate, items, searchTerm, statusFilter, toDate])

  const counts = useMemo(() => {
    let pending = 0
    let seen = 0
    for (const item of items) {
      if (item.status === "acknowledged") {
        seen += 1
      } else {
        pending += 1
      }
    }
    return { pending, seen }
  }, [items])

  const applyPreset = (preset: DaysPreset) => {
    const today = new Date()
    const to = dateOnlyFormatter.format(today)

    if (preset === "all") {
      setFromDate("")
      setToDate("")
      return
    }

    const days = preset === "1" ? 1 : preset === "7" ? 7 : 30
    const from = new Date(today)
    from.setDate(from.getDate() - (days - 1))

    setFromDate(dateOnlyFormatter.format(from))
    setToDate(to)
  }

  const handleMarkAndOpen = useCallback(async (item: LabNotificationItem) => {
    const isPending = item.status !== "acknowledged"

    if (isPending) {
      setItems((current) => current.map((currentItem) => (
        currentItem.id === item.id
          ? { ...currentItem, status: "acknowledged", acknowledged_at: currentItem.acknowledged_at || new Date().toISOString() }
          : currentItem
      )))
      try {
        await onAcknowledgeNotification(item.id)
      } catch (ackError) {
        console.error("Error acknowledging lab notification:", ackError)
        await loadNotifications(true)
        return
      }
      setStatusFilter("vistas")
    }

    const target = deriveNotificationTarget(item)
    if (target && onOpenLabNotification) {
      onOpenChange(false)
      onOpenLabNotification(target)
    }
  }, [loadNotifications, onAcknowledgeNotification, onOpenChange, onOpenLabNotification])

  const resetFilters = () => {
    setStatusFilter("pendientes")
    setSearchTerm("")
    setCreatorFilter("all")
    setFromDate("")
    setToDate("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[92vh] p-0 overflow-hidden bg-background border-border [&>button]:hidden">
        <DialogHeader className="hidden">
          <DialogTitle>Detalle de notificaciones de laboratorio</DialogTitle>
          <DialogDescription>Panel extendido con filtros por fechas, días y usuarios.</DialogDescription>
        </DialogHeader>

        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Detalle de ensayos recientes</h2>
                  <p className="text-sm text-muted-foreground">
                    Revisa notificaciones de laboratorio con filtros por fecha, días y usuario.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
                  Pendientes: {counts.pending}
                </span>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">
                  Vistas: {counts.seen}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                  Total: {items.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void loadNotifications(true)} disabled={loading || refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>

          <div className="border-b border-border/70 px-6 py-4">
            <div className="grid gap-3 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Search className="h-3.5 w-3.5" />
                  Buscar
                </div>
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar por ensayo, código, usuario o módulo..."
                  className="bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <UserRoundSearch className="h-3.5 w-3.5" />
                  Usuario
                </div>
                <Select value={creatorFilter} onValueChange={setCreatorFilter}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Todos los usuarios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los usuarios</SelectItem>
                    {creators.map((creator) => (
                      <SelectItem key={creator} value={creator}>
                        {creator}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  Rango de fechas
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="bg-background"
                  />
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="bg-background"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-border bg-muted/30 p-1">
                <Button
                  type="button"
                  variant={statusFilter === "pendientes" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 rounded-full px-4 text-xs"
                  onClick={() => setStatusFilter("pendientes")}
                >
                  Pendientes
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "vistas" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 rounded-full px-4 text-xs"
                  onClick={() => setStatusFilter("vistas")}
                >
                  Vistas
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => applyPreset("1")}>
                  Hoy
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => applyPreset("7")}>
                  7 días
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => applyPreset("30")}>
                  30 días
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={() => applyPreset("all")}>
                  Todo
                </Button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-xs" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-muted/10">
            <ScrollArea className="h-full">
              <div className="px-6 py-5">
                {loading ? (
                  <div className="flex h-[calc(92vh-210px)] items-center justify-center">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Cargando notificaciones...
                    </div>
                  </div>
                ) : error ? (
                  <div className="flex h-[calc(92vh-210px)] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-background">
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button variant="outline" onClick={() => void loadNotifications(true)}>
                      Reintentar
                    </Button>
                  </div>
                ) : filteredItems.length > 0 ? (
                  <div className="grid gap-3 xl:grid-cols-2 2xl:grid-cols-3">
                    {filteredItems.map((item) => {
                      const isAcknowledged = item.status === "acknowledged"
                      const moduleLabel = String(item.metadata?.module_label || item.metadata?.detail_module || "Ensayo")
                      const recordCode = String(item.metadata?.record_code || "Sin código")
                      const creator = String(item.metadata?.created_by || item.metadata?.full_name || item.metadata?.user_name || "Usuario")
                      const moduleCode = String(item.metadata?.module || "")
                      const action = String(item.metadata?.action || (isAcknowledged ? "viewed" : "created"))
                      const detail = String(item.message || "")
                      const timestamp = formatTimestamp(item.created_at)
                      const target = deriveNotificationTarget(item)

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void handleMarkAndOpen(item)}
                          className={`group w-full rounded-2xl border bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                            isAcknowledged ? "border-blue-200 hover:border-blue-300" : "border-primary/30 hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isAcknowledged ? "bg-blue-100 text-blue-700" : "bg-primary/10 text-primary"}`}>
                                {isAcknowledged ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                              </div>
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {moduleLabel} {recordCode}
                                  </p>
                                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${
                                    isAcknowledged ? "bg-blue-100 text-blue-700" : "bg-primary/10 text-primary"
                                  }`}>
                                    {isAcknowledged ? "visto" : "nuevo"}
                                  </span>
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {action === "updated" ? "editado" : "creado"}
                                  </span>
                                </div>

                                <p className="text-sm text-muted-foreground leading-6">
                                  {creator} {action === "updated" ? "actualizó" : "creó"} este ensayo
                                </p>

                                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                                  <p className="flex items-center gap-1.5">
                                    <Clock3 className="h-3.5 w-3.5 text-muted-foreground/70" />
                                    {timestamp}
                                  </p>
                                  {moduleCode && (
                                    <p className="truncate">
                                      Módulo: <span className="font-medium text-foreground">{moduleCode}</span>
                                    </p>
                                  )}
                                </div>

                                <div className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
                                  {detail}
                                </div>

                                {target && (
                                  <div className="flex items-center gap-2 text-xs text-primary">
                                    <Eye className="h-3.5 w-3.5" />
                                    Haz clic para abrir el ensayo y marcarlo como visto.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {!isAcknowledged && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 text-[11px]"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void handleMarkAndOpen(item)
                                  }}
                                >
                                  Marcar visto
                                </Button>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 px-3 text-[11px]"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleMarkAndOpen(item)
                                }}
                              >
                                Abrir
                              </Button>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex h-[calc(92vh-210px)] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background">
                    <Bell className="mb-3 h-11 w-11 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">No hay notificaciones para estos filtros</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ajusta el rango, usuario o pestaña para ver más ensayos.
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
