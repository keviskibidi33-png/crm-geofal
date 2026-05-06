"use client"

import { startTransition, useState, useEffect, useRef, useCallback } from "react"
import { Bell, Search, Sun, Moon, Building2, FolderKanban, FileText, Loader2, AlertTriangle, CheckCircle2, Clock3, UserRoundSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/components/theme-provider"
import { type User, type ModuleType } from "@/hooks/use-auth"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { authFetch } from "@/lib/api-auth"
import { supabase } from "@/lib/supabaseClient"
import { isAdminDashboardRole, isComercialDashboardRole, isLaboratoryNotificationsRole } from "@/lib/control-module-access"

interface HeaderProps {
  user: User
  setActiveModule: (module: ModuleType) => void
  onOpenAffectedUser?: (userId: string) => void
  onOpenLabNotification?: (target: { module: ModuleType; recordId: number }) => void
}

interface SearchResult {
  id: string
  type: "cliente" | "proyecto" | "cotizacion"
  title: string
  subtitle: string
}

interface DashboardNotification {
  id: string
  type: string
  severity: "info" | "warning" | "error" | "success"
  title: string
  message: string
  status?: "open" | "acknowledged" | "resolved"
  created_at?: string | null
  acknowledged_at?: string | null
  resolved_at?: string | null
  metadata?: Record<string, unknown>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

async function fetchDashboardSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const params = new URLSearchParams()
  if (query.trim()) {
    params.set("q", query.trim())
    params.set("limit", "10")
  } else {
    params.set("limit", "7")
  }

  const response = await authFetch(`${API_URL}/dashboard/search?${params.toString()}`, {
    method: "GET",
    signal,
  })

  if (!response.ok) {
    throw new Error(`Dashboard search failed: ${response.status}`)
  }

  const payload = await response.json()
  return Array.isArray(payload?.data) ? payload.data : []
}

export function DashboardHeader({ user, setActiveModule, onOpenAffectedUser }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [historyNotifications, setHistoryNotifications] = useState<DashboardNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [acknowledgingNotificationId, setAcknowledgingNotificationId] = useState<string | null>(null)
  const [bellPulseNonce, setBellPulseNonce] = useState(0)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const notificationsUnavailableRef = useRef(false)
  const notificationHistoryUnavailableRef = useRef(false)
  const notificationIdsRef = useRef<Set<string>>(new Set())
  const notificationsInitializedRef = useRef(false)
  const bellSoundRef = useRef<AudioContext | null>(null)
  const isAdmin = isAdminDashboardRole(user.role)
  const isCommercialNotificationsRole = isComercialDashboardRole(user.role)
  const isLaboratoryNotifications = isLaboratoryNotificationsRole(user.role)
  const showNotifications = isAdmin || isCommercialNotificationsRole || isLaboratoryNotifications

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const playBellChime = useCallback(async () => {
    if (typeof window === "undefined") return
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtor) return

    if (!bellSoundRef.current) {
      bellSoundRef.current = new AudioCtor()
    }

    const ctx = bellSoundRef.current
    if (!ctx || ctx.state === "closed") return

    if (ctx.state === "suspended") {
      try {
        await ctx.resume()
      } catch {
        return
      }
    }

    const startAt = ctx.currentTime + 0.02
    const pattern = [
      { frequency: 659.25, offset: 0 },
      { frequency: 783.99, offset: 0.11 },
      { frequency: 987.77, offset: 0.22 },
    ]

    pattern.forEach(({ frequency, offset }) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, startAt + offset)
      gain.gain.exponentialRampToValueAtTime(0.03, startAt + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.18)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(startAt + offset)
      oscillator.stop(startAt + offset + 0.2)
    })
  }, [])

  const triggerBellAlert = useCallback(() => {
    setBellPulseNonce((current) => current + 1)
    void playBellChime()
  }, [playBellChime])

  const extractNotificationIds = useCallback((items: DashboardNotification[]) => {
    const ids = new Set<string>()
    for (const item of items) {
      const id = String(item.id || "").trim()
      if (id) ids.add(id)
    }
    return ids
  }, [])

  const mergeNotifications = useCallback((items: DashboardNotification[]) => {
    const nextIds = extractNotificationIds(items)
    const previousIds = notificationIdsRef.current

    if (notificationsInitializedRef.current) {
      let hasNewItem = false
      for (const id of nextIds) {
        if (!previousIds.has(id)) {
          hasNewItem = true
          break
        }
      }
      if (hasNewItem) {
        triggerBellAlert()
      }
    } else {
      notificationsInitializedRef.current = true
    }

    notificationIdsRef.current = nextIds
    setNotifications(items)
  }, [extractNotificationIds, triggerBellAlert])

  const fetchNotifications = useCallback(async () => {
    if (!showNotifications) {
      setNotifications([])
      setHistoryNotifications([])
      return
    }
    if (notificationsUnavailableRef.current) {
      setNotifications([])
    }
    if (notificationHistoryUnavailableRef.current) {
      setHistoryNotifications([])
    }

    setNotificationsLoading(true)
    try {
      if (isAdmin) {
        const activeResponse = notificationsUnavailableRef.current
          ? null
          : await authFetch(`${API_URL}/notifications`)

        if (activeResponse?.status === 403 || activeResponse?.status === 404) {
          notificationsUnavailableRef.current = true
          setNotifications([])
        } else if (activeResponse && !activeResponse.ok) {
          throw new Error(`Notifications fetch failed: ${activeResponse.status}`)
        } else if (activeResponse) {
          const payload = await activeResponse.json()
          mergeNotifications(Array.isArray(payload?.data) ? payload.data : [])
        }

        const historyResponse = notificationHistoryUnavailableRef.current
          ? null
          : await authFetch(`${API_URL}/notifications/history?limit=12`)
        if (historyResponse?.status === 403 || historyResponse?.status === 404) {
          notificationHistoryUnavailableRef.current = true
          setHistoryNotifications([])
        } else if (historyResponse && !historyResponse.ok) {
          throw new Error(`Notification history fetch failed: ${historyResponse.status}`)
        } else if (historyResponse) {
          const payload = await historyResponse.json()
          setHistoryNotifications(Array.isArray(payload?.data) ? payload.data : [])
        }
      } else if (isCommercialNotificationsRole || isLaboratoryNotifications) {
        const feedResponse = notificationsUnavailableRef.current
          ? null
          : await authFetch(`${API_URL}/notifications/feed?limit=12`)

        if (feedResponse?.status === 403 || feedResponse?.status === 404) {
          notificationsUnavailableRef.current = true
          setNotifications([])
        } else if (feedResponse && !feedResponse.ok) {
          throw new Error(`Notification feed failed: ${feedResponse.status}`)
        } else if (feedResponse) {
          const payload = await feedResponse.json()
          mergeNotifications(Array.isArray(payload?.data) ? payload.data : [])
        }
        setHistoryNotifications([])
      } else {
        notificationsInitializedRef.current = true
        notificationIdsRef.current = new Set()
        setNotifications([])
        setHistoryNotifications([])
      }
    } catch (error) {
      console.error("Error loading notifications:", error)
      setNotifications([])
      setHistoryNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }, [isAdmin, isCommercialNotificationsRole, isLaboratoryNotifications, mergeNotifications, showNotifications])

  const acknowledgeNotification = useCallback(async (notificationId: string) => {
    if (!showNotifications || !notificationId) return

    setAcknowledgingNotificationId(notificationId)
    try {
      const response = await authFetch(`${API_URL}/notifications/${encodeURIComponent(notificationId)}/acknowledge`, {
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error(`Acknowledge notification failed: ${response.status}`)
      }

      await fetchNotifications()
    } catch (error) {
      console.error("Error acknowledging notification:", error)
    } finally {
      setAcknowledgingNotificationId((current) => (current === notificationId ? null : current))
    }
  }, [fetchNotifications, showNotifications])

  const openLabNotification = (item: DashboardNotification) => {
    if (!onOpenLabNotification) return

    const rawModule = String(item.metadata?.detail_module || item.metadata?.module || "").trim()
    const targetModule = (rawModule === "verificacion" ? "verificacion_muestras" : rawModule) as ModuleType
    const recordId = Number(item.metadata?.record_id || 0)

    if (!targetModule || !recordId) return
    onOpenLabNotification({ module: targetModule, recordId })
  }

  const openAffectedUser = useCallback((userId?: unknown) => {
    const normalizedUserId = String(userId || "").trim()
    if (!normalizedUserId || !onOpenAffectedUser) return
    onOpenAffectedUser(normalizedUserId)
  }, [onOpenAffectedUser])

  // Load top 3 most recent items when focusing empty search
  const loadTopSuggestions = useCallback(async () => {
    if (searchQuery.length > 0 || searchResults.length > 0) return

    setIsSearching(true)
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    try {
      const suggestions = await fetchDashboardSearch("", controller.signal)
      startTransition(() => {
        setSearchResults(suggestions)
        setShowResults(suggestions.length > 0)
      })
    } catch (error) {
      if (controller.signal.aborted) return
      console.error("Error loading suggestions:", error)
    } finally {
      if (searchAbortRef.current === controller) {
        setIsSearching(false)
      }
    }
  }, [searchQuery, searchResults.length])

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      searchAbortRef.current?.abort()
      setSearchResults([])
      setShowResults(false)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller

    try {
      const results = await fetchDashboardSearch(query, controller.signal)
      startTransition(() => {
        setSearchResults(results)
        setShowResults(results.length > 0)
      })
    } catch (error) {
      if (controller.signal.aborted) return
      console.error("Search error:", error)
    } finally {
      if (searchAbortRef.current === controller) {
        setIsSearching(false)
      }
    }
  }, [])

  // Handle search input with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)
  }

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setSearchQuery("")
    setShowResults(false)
    setSearchResults([])

    switch (result.type) {
      case "cliente":
        setActiveModule("clientes")
        break
      case "proyecto":
        setActiveModule("proyectos")
        break
      case "cotizacion":
        setActiveModule("cotizadora")
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      searchAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    notificationsUnavailableRef.current = false
    notificationHistoryUnavailableRef.current = false
    notificationsInitializedRef.current = false
    notificationIdsRef.current = new Set()
    void fetchNotifications()

    const channels: any[] = []

    if (isAdmin) {
      const adminChannel = supabase
        .channel(`notifications_admin_${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "perfiles" }, () => {
          void fetchNotifications()
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "role_definitions" }, () => {
          void fetchNotifications()
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "user_permission_overrides" }, () => {
          void fetchNotifications()
        })
        .subscribe()
      channels.push(adminChannel)
    }

    if (isCommercialNotificationsRole || isLaboratoryNotifications) {
      const commercialChannel = supabase
        .channel(`notifications_lab_${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "dashboard_notifications" }, (payload) => {
          const row = (payload as any)?.new as DashboardNotification | undefined
          const audienceRoles = Array.isArray(row?.metadata?.audience_roles)
            ? row?.metadata?.audience_roles.map((value) => String(value || "").trim().toLowerCase())
            : []
          const notificationType = String(row?.type || "")
          const isQuote = notificationType === "quote_created" && audienceRoles.includes("auxiliar_comercial")
          const isLabEssay = ["lab_essay_created", "lab_essay_updated"].includes(notificationType) &&
            (audienceRoles.includes("jefe_laboratorio") || audienceRoles.includes("laboratorio_tipificador"))
          if (!isQuote && !isLabEssay) return
          void fetchNotifications()
        })
        .subscribe()
      channels.push(commercialChannel)
    }

    return () => {
      for (const channel of channels) {
        void supabase.removeChannel(channel)
      }
    }
  }, [fetchNotifications, isAdmin, isCommercialNotificationsRole, isLaboratoryNotifications, user.id])

  const openNotificationCount = notifications.filter((item) => item.status === "open" || !item.status).length
  const acknowledgedNotificationCount = notifications.filter((item) => item.status === "acknowledged").length
  const resolvedNotificationCount = historyNotifications.length

  const getResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "cliente":
        return <Building2 className="h-4 w-4 text-blue-500" />
      case "proyecto":
        return <FolderKanban className="h-4 w-4 text-green-500" />
      case "cotizacion":
        return <FileText className="h-4 w-4 text-orange-500" />
    }
  }

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "cliente":
        return "Cliente"
      case "proyecto":
        return "Proyecto"
      case "cotizacion":
        return "Cotización"
    }
  }

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between gap-3 px-3 md:px-6">
      {/* Search with Autocomplete */}
      <div className="relative flex-1 min-w-0 max-w-xs sm:max-w-md lg:max-w-lg" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <Input
          placeholder="Buscar clientes, proyectos, cotizaciones..."
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => {
            if (searchResults.length > 0) {
              setShowResults(true)
            } else if (searchQuery.length === 0) {
              loadTopSuggestions()
            }
          }}
          className="pl-10 pr-10 bg-secondary/50 border-border focus:bg-secondary"
        />

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left transition-colors border-b border-border last:border-b-0"
              >
                {getResultIcon(result.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{result.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                </div>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                  {getTypeLabel(result.type)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* No results message */}
        {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 p-4">
            <p className="text-sm text-muted-foreground text-center">No se encontraron resultados</p>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Cambiar tema</span>
        </Button>

        {/* Notifications */}
        {showNotifications ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <span
                  key={bellPulseNonce}
                  className="relative inline-flex"
                  style={bellPulseNonce > 0 ? { animation: "bell-ring 650ms ease-in-out" } : undefined}
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </span>
                {openNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {openNotificationCount > 9 ? "9+" : openNotificationCount}
                  </span>
                )}
                <span className="sr-only">Notificaciones</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1rem)]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-sm">
                    {isLaboratoryNotifications
                      ? "Ensayos recientes"
                      : isCommercialNotificationsRole
                        ? "Cotizaciones recientes"
                        : "Notificaciones"}
                  </h4>
                  {notificationsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                    Pendientes: {openNotificationCount}
                  </span>
                  {isAdmin && (
                    <>
                      <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">
                        Vistas: {acknowledgedNotificationCount}
                      </span>
                      <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
                        Historial: {resolvedNotificationCount}
                      </span>
                    </>
                  )}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {isLaboratoryNotifications ? (
                    notifications.length > 0 ? (
                      <div className="space-y-2">
                        {notifications.map((item) => {
                          const moduleLabel = item.metadata?.module_label ? String(item.metadata.module_label) : "Ensayo"
                          const recordCode = item.metadata?.record_code ? String(item.metadata.record_code) : "Sin código"
                          const creator = item.metadata?.created_by ? String(item.metadata.created_by) : "Usuario"
                          const timestamp = item.created_at ? new Date(item.created_at).toLocaleString("es-PE") : ""
                          const action = String(item.metadata?.action || "created")
                          const isUpdate = action === "updated"
                          const canOpenDetail = Boolean(onOpenLabNotification)
                          return (
                            <button
                              type="button"
                              key={item.id}
                              className={`w-full rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm text-left transition-colors ${canOpenDetail ? "hover:bg-accent/40 cursor-pointer" : ""}`}
                              onClick={() => canOpenDetail && openLabNotification(item)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                  <FileText className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground truncate">
                                      {moduleLabel} {recordCode}
                                    </p>
                                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">
                                      {isUpdate ? "editado" : "nuevo"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 leading-5 truncate">
                                    {creator} {isUpdate ? "actualizó" : "creó"} este ensayo
                                  </p>
                                  {timestamp && (
                                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                                      {timestamp}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center rounded-lg border border-dashed border-border bg-muted/20">
                        <Bell className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">Sin ensayos nuevos</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Aquí aparecerán los registros de laboratorio en tiempo real</p>
                      </div>
                    )
                  ) : isCommercialNotificationsRole ? (
                    notifications.length > 0 ? (
                      notifications.map((item) => {
                        const creator = item.metadata?.created_by ? String(item.metadata.created_by) : "Usuario"
                        const client = item.metadata?.cliente ? String(item.metadata.cliente) : "cliente"
                        const quoteCode = item.metadata?.quote_code ? String(item.metadata.quote_code) : "Nueva cotización"
                        const timestamp = item.created_at ? new Date(item.created_at).toLocaleString("es-PE") : ""
                        return (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                <Bell className="h-4 w-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground truncate">{quoteCode}</p>
                                  <span className="text-[10px] uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">
                                    nueva
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 leading-5 truncate">
                                  {creator} creó una cotización para {client}
                                </p>
                                {timestamp && (
                                  <p className="text-[11px] text-muted-foreground/80 mt-1">
                                    {timestamp}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center rounded-lg border border-dashed border-border bg-muted/20">
                        <Bell className="h-10 w-10 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">Sin cotizaciones nuevas</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Aquí aparecerán las cotizaciones generadas en tiempo real</p>
                      </div>
                    )
                  ) : (
                    <>
                      <section className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            <h5 className="text-xs font-semibold uppercase tracking-wide text-foreground">Mini tickets activos</h5>
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {notifications.length} abiertos
                          </span>
                        </div>

                        {notifications.length > 0 ? (
                          <div className="space-y-2">
                            {notifications.map((item) => {
                              const fullName = item.metadata?.full_name ? String(item.metadata.full_name) : "Usuario no identificado"
                              const email = item.metadata?.email ? String(item.metadata.email) : ""
                              const role = item.metadata?.role ? String(item.metadata.role) : ""
                              const moduleName = item.metadata?.module ? String(item.metadata.module) : ""
                              const userId = item.metadata?.user_id
                              return (
                                <div
                                  key={item.id}
                                  className={`rounded-lg border px-3 py-2.5 shadow-sm ${
                                    item.status === "acknowledged"
                                      ? "border-blue-200 bg-blue-50/60"
                                      : "border-border bg-background"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                      <AlertTriangle className={`h-4 w-4 ${item.status === "acknowledged" ? "text-blue-500" : "text-amber-500"}`} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                                        <span
                                          className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 ${
                                            item.status === "acknowledged"
                                              ? "bg-blue-100 text-blue-700"
                                              : "bg-amber-100 text-amber-700"
                                          }`}
                                        >
                                          {item.status === "acknowledged" ? "Visto" : item.severity}
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1 leading-5">{item.message}</p>
                                      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground/85">
                                        <p>
                                          Usuario: <span className="font-medium text-foreground">{fullName}</span>
                                        </p>
                                        {email && (
                                          <p>
                                            Email: <span className="font-medium text-foreground">{email}</span>
                                          </p>
                                        )}
                                        {role && (
                                          <p>
                                            Rol: <span className="font-medium text-foreground">{role}</span>
                                          </p>
                                        )}
                                        {moduleName && (
                                          <p>
                                            Módulo: <span className="font-medium text-foreground">{moduleName}</span>
                                          </p>
                                        )}
                                        {item.metadata?.reason && (
                                          <p>
                                            Motivo: <span className="font-medium text-foreground">{String(item.metadata.reason)}</span>
                                          </p>
                                        )}
                                      </div>
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {userId && onOpenAffectedUser && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2.5 text-[11px]"
                                            onClick={() => openAffectedUser(userId)}
                                          >
                                            <UserRoundSearch className="mr-1 h-3.5 w-3.5" />
                                            Ver usuario
                                          </Button>
                                        )}
                                        {item.status !== "acknowledged" ? (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2.5 text-[11px]"
                                            onClick={() => void acknowledgeNotification(item.id)}
                                            disabled={acknowledgingNotificationId === item.id}
                                          >
                                            {acknowledgingNotificationId === item.id ? "Guardando..." : "Marcar como visto"}
                                          </Button>
                                        ) : (
                                          <span className="text-[11px] text-blue-700 font-medium">Ajuste revisado</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-center rounded-lg border border-dashed border-border bg-muted/20">
                            <Bell className="h-10 w-10 text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No hay alertas activas</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">Si aparece una inconsistencia, se mostrará aquí como mini ticket</p>
                          </div>
                        )}
                      </section>

                      <section className="space-y-2 border-t border-border/70 pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-emerald-500" />
                            <h5 className="text-xs font-semibold uppercase tracking-wide text-foreground">Historial reciente</h5>
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {historyNotifications.length} resueltas
                          </span>
                        </div>

                        {historyNotifications.length > 0 ? (
                          <div className="space-y-2">
                            {historyNotifications.map((item) => {
                              const fullName = item.metadata?.full_name ? String(item.metadata.full_name) : "Usuario no identificado"
                              const role = item.metadata?.role ? String(item.metadata.role) : ""
                              return (
                                <div
                                  key={`${item.id}-history`}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 shadow-sm"
                                >
                                  <div className="flex items-start gap-3">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">
                                          resuelta
                                        </span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1 leading-5">{item.message}</p>
                                      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground/85">
                                        <p>
                                          Usuario: <span className="font-medium text-foreground">{fullName}</span>
                                        </p>
                                        {role && (
                                          <p>
                                            Rol: <span className="font-medium text-foreground">{role}</span>
                                          </p>
                                        )}
                                        {item.resolved_at && (
                                          <p>
                                            Resuelta: <span className="font-medium text-foreground">{new Date(item.resolved_at).toLocaleString("es-PE")}</span>
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Sin historial reciente
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

      </div>
      <style jsx global>{`
        @keyframes bell-ring {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(-12deg); }
          30% { transform: rotate(12deg); }
          45% { transform: rotate(-9deg); }
          60% { transform: rotate(9deg); }
          75% { transform: rotate(-4deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
    </header>
  )
}
