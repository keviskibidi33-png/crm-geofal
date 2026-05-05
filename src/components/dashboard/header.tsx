"use client"

import { startTransition, useState, useEffect, useRef, useCallback } from "react"
import { Bell, Search, Sun, Moon, Building2, FolderKanban, FileText, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTheme } from "@/components/theme-provider"
import { type User, type ModuleType } from "@/hooks/use-auth"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { authFetch } from "@/lib/api-auth"

interface HeaderProps {
  user: User
  setActiveModule: (module: ModuleType) => void
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
  created_at?: string | null
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

export function DashboardHeader({ user, setActiveModule }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const notificationsUnavailableRef = useRef(false)
  const isAdmin = user.role === "admin" || user.role === "admin_general"

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const fetchNotifications = useCallback(async () => {
    if (!isAdmin) {
      setNotifications([])
      return
    }
    if (notificationsUnavailableRef.current) {
      setNotifications([])
      return
    }

    setNotificationsLoading(true)
    try {
      const response = await authFetch(`${API_URL}/notifications`)
      if (response.status === 404) {
        notificationsUnavailableRef.current = true
        setNotifications([])
        return
      }
      if (!response.ok) {
        throw new Error(`Notifications fetch failed: ${response.status}`)
      }
      const payload = await response.json()
      setNotifications(Array.isArray(payload?.data) ? payload.data : [])
    } catch (error) {
      console.error("Error loading notifications:", error)
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }, [isAdmin])

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
    void fetchNotifications()
    if (!isAdmin) return

    const interval = window.setInterval(() => {
      void fetchNotifications()
    }, 60000)

    return () => window.clearInterval(interval)
  }, [fetchNotifications, isAdmin])

  const notificationCount = notifications.length

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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
              <span className="sr-only">Notificaciones</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 max-w-[calc(100vw-1rem)]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-sm">Notificaciones</h4>
                {notificationsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              {notificationCount > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {notifications.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-background px-3 py-2.5 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                            <span className="text-[10px] uppercase tracking-wide rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">
                              {item.severity}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-5">{item.message}</p>
                          {item.metadata?.full_name && (
                            <p className="text-[11px] text-muted-foreground/80 mt-1">
                              Usuario: <span className="font-medium">{String(item.metadata.full_name)}</span>
                            </p>
                          )}
                          {item.metadata?.reason && (
                            <p className="text-[11px] text-muted-foreground/80">
                              Motivo: <span className="font-medium">{String(item.metadata.reason)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-12 w-12 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No tienes notificaciones</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Te avisaremos cuando haya algo nuevo</p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

      </div>
    </header>
  )
}
