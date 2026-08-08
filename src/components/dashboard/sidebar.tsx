"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { Users, FileText, Settings, ChevronRight, ChevronDown, FolderKanban, Shield, Activity, ClipboardList, LogOut, Sun, Moon, TestTube, Beaker, PanelLeftClose, PanelLeft, Eye, Calendar, BarChart3, FlaskConical, TrendingUp, Thermometer, Scale } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTheme } from "@/components/theme-provider"
import { useAuth, type ModuleType, type User } from "@/hooks/use-auth"
import { canAccessDashboardModule, isAdminDashboardRole } from "@/lib/control-module-access"

interface SidebarProps {
  activeModule: ModuleType
  setActiveModule: (module: ModuleType) => void
  user: User
  collapsed: boolean
  onToggleCollapse: () => void
}

const modules: { id: ModuleType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: "tracing", label: "Seguimiento", icon: Activity },
  { id: "ingenieria_archivos", label: "Control Informes", icon: FileText },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban },
  { id: "cotizadora", label: "Cotizadora", icon: FileText },
  { id: "recepcion", label: "Recepción Probetas", icon: TestTube, adminOnly: true },
  { id: "verificacion_muestras", label: "Verificación Probetas", icon: ClipboardList, adminOnly: true },
  { id: "compresion", label: "F. Probetas", icon: Beaker, adminOnly: true },
  { id: "control_probetas", label: "Control Probetas", icon: Calendar, adminOnly: true },
  { id: "huanta_probetas", label: "Laboratorio Huanta", icon: Beaker, adminOnly: true },
  { id: "humedad", label: "Humedad Suelo", icon: Beaker, adminOnly: true },
  { id: "cont_humedad", label: "Humedad AG", icon: Beaker, adminOnly: true },
  { id: "cbr", label: "CBR", icon: Beaker, adminOnly: true },
  { id: "proctor", label: "Proctor", icon: Beaker, adminOnly: true },
  { id: "llp", label: "Limite", icon: Beaker, adminOnly: true },
  { id: "gran_suelo", label: "Gran Suelo", icon: Beaker, adminOnly: true },
  { id: "gran_agregado", label: "Gran Agregado", icon: Beaker, adminOnly: true },
  { id: "cont_mat_organica", label: "M. Organica", icon: Beaker, adminOnly: true },
  { id: "terrones_fino_grueso", label: "Terrones", icon: Beaker, adminOnly: true },
  { id: "azul_metileno", label: "Azul Metileno", icon: Beaker, adminOnly: true },
  { id: "part_livianas", label: "Part. Livianas", icon: Beaker, adminOnly: true },
  { id: "imp_organicas", label: "Imp. Organicas", icon: Beaker, adminOnly: true },
  { id: "sul_magnesio", label: "Sulf. Magnesio", icon: Beaker, adminOnly: true },
  { id: "angularidad", label: "Angularidad", icon: Beaker, adminOnly: true },
  { id: "abra", label: "Abrasión Mayores", icon: Beaker, adminOnly: true },
  { id: "abrass", label: "Abrasión Menores", icon: Beaker, adminOnly: true },
  { id: "peso_unitario", label: "Peso Unitario", icon: Beaker, adminOnly: true },
  { id: "tamiz", label: "Malla 200", icon: Beaker, adminOnly: true },
  { id: "planas", label: "Planas", icon: Beaker, adminOnly: true },
  { id: "caras", label: "Caras", icon: Beaker, adminOnly: true },
  { id: "equi_arena", label: "E.Arena", icon: Beaker, adminOnly: true },
  { id: "ge_fino", label: "GE Fino", icon: Beaker, adminOnly: true },
  { id: "ge_grueso", label: "GE Grueso", icon: Beaker, adminOnly: true },
  { id: "cd", label: "Corte", icon: Beaker, adminOnly: true },
  { id: "ph", label: "PH Suelo", icon: Beaker, adminOnly: true },
  { id: "cloro_soluble", label: "Cloruro Suelo", icon: Beaker, adminOnly: true },
  { id: "sales_solubles", label: "Sales Suelo", icon: Beaker, adminOnly: true },
  { id: "sulfatos_solubles", label: "Sulfato Suelo", icon: Beaker, adminOnly: true },
  { id: "compresion_no_confinada", label: "C. No Confinada", icon: Beaker, adminOnly: true },
  { id: "laboratorio", label: "Control Laboratorio", icon: Activity },
  { id: "comercial", label: "Control Comercial", icon: ClipboardList },
  { id: "administracion", label: "Control Administración", icon: Shield },
  { id: "usuarios", label: "Usuarios", icon: Shield, adminOnly: true },
  { id: "permisos", label: "Permisos", icon: Shield, adminOnly: true },
  { id: "auditoria", label: "Auditoría", icon: Activity, adminOnly: true },
  { id: "configuracion", label: "Configuración", icon: Settings },
]

const kpiModules: { id: ModuleType; label: string; icon: React.ElementType; status?: string }[] = [
  { id: "estadistica_laboratorio", label: "Estadistica Laboratorio", icon: FlaskConical },
  { id: "estadistica_comercial", label: "Estadistica Comercial", icon: TrendingUp },
  { id: "estadistica_gerencia", label: "KPIs Administración", icon: Shield, status: "En desarrollo" },
  { id: "gerencia", label: "Gerencia", icon: BarChart3 },
]

export function DashboardSidebar({ activeModule, setActiveModule, user, collapsed, onToggleCollapse }: SidebarProps) {
  const brandRef = React.useRef<HTMLButtonElement | null>(null)
  const brandBubbleRef = React.useRef<HTMLDivElement | null>(null)
  const [brandBubbleOpen, setBrandBubbleOpen] = React.useState(false)
  const [brandBubblePos, setBrandBubblePos] = React.useState({ x: 0, y: 0 })
  const [viewport, setViewport] = React.useState({ width: 1280, height: 720 })

  const huantaSubmodules = React.useMemo(() => [
    { id: "huanta_probetas", label: "Control Probetas", icon: Calendar },
    { id: "huanta_compresion", label: "Compresión Huanta", icon: Beaker },
    { id: "densidad_huantar", label: "Densidad Huanta", icon: Beaker },
    { id: "huanta_seguimiento", label: "Seguimiento Huanta", icon: Activity },
  ], [])

  const isHuantaActive = React.useMemo(() =>
    ["huanta_probetas", "huanta_compresion", "huanta_seguimiento", "densidad_huantar"].includes(activeModule),
    [activeModule]
  )

  const [huantaExpanded, setHuantaExpanded] = React.useState(isHuantaActive)

  const ambientalSubmodules = React.useMemo(() => [
    { id: "control_ambiental",          label: "Temperatura / Humedad", icon: Thermometer },
    { id: "control_ambiental_balanzas", label: "Balanzas",               icon: Scale },
  ], [])

  const isAmbientalActive = React.useMemo(() =>
    ["control_ambiental", "control_ambiental_balanzas"].includes(activeModule),
    [activeModule]
  )

  const [ambientalExpanded, setAmbientalExpanded] = React.useState(isAmbientalActive)

  const accessibleKpiModules = React.useMemo(
    () => kpiModules.filter((module) => canAccessDashboardModule(module.id, user.role, user.permissions, user.email)),
    [user.email, user.permissions, user.role],
  )

  const isKpiActive = React.useMemo(
    () => accessibleKpiModules.some((module) => module.id === activeModule),
    [accessibleKpiModules, activeModule],
  )

  const [kpiExpanded, setKpiExpanded] = React.useState(isKpiActive)

  React.useEffect(() => {
    if (isHuantaActive) setHuantaExpanded(true)
  }, [isHuantaActive])

  React.useEffect(() => {
    if (isKpiActive) setKpiExpanded(true)
  }, [isKpiActive])

  React.useEffect(() => {
    if (isAmbientalActive) setAmbientalExpanded(true)
  }, [isAmbientalActive])

  const [isTabletLayout, setIsTabletLayout] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1100px)")
    const updateTabletLayout = () => setIsTabletLayout(mediaQuery.matches)
    updateTabletLayout()
    mediaQuery.addEventListener("change", updateTabletLayout)
    return () => mediaQuery.removeEventListener("change", updateTabletLayout)
  }, [])

  React.useEffect(() => {
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    updateViewport()
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

  // Use granular permissions for filtering
  // Admin maintains full access fallback, but ideally should have all permissions true in DB
  const filteredModules = modules.filter((module) => {
    const isAdmin = isAdminDashboardRole(user.role)

    if (isAdmin) return true
    if (module.id === "usuarios" || module.id === "auditoria") return false
    return canAccessDashboardModule(module.id, user.role, user.permissions, user.email)
  })

  const isModuleReadOnly = (moduleId: ModuleType): boolean => {
    const isAdmin = isAdminDashboardRole(user.role)
    if (isAdmin) return false
    const perm = user.permissions?.[moduleId]
    return perm?.read === true && perm?.write !== true
  }

  const { theme, setTheme } = useTheme()
  const { signOut } = useAuth()

  const handleModuleClick = (id: ModuleType) => {
    setActiveModule(id)
  }

  const handleBrandClick = () => {
    setActiveModule("home")
  }

  const handleBrandContextMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const rect = brandRef.current?.getBoundingClientRect()
    setBrandBubblePos({
      x: event.clientX || (rect ? rect.left + rect.width / 2 : 0),
      y: event.clientY || (rect ? rect.bottom + 8 : 0),
    })
    setBrandBubbleOpen(true)
  }

  const closeBrandBubble = React.useCallback(() => setBrandBubbleOpen(false), [])

  const openCrmInNewTab = React.useCallback(() => {
    if (typeof window === "undefined") return
    window.open(window.location.href, "_blank", "noopener,noreferrer")
    closeBrandBubble()
  }, [closeBrandBubble])

  const reloadWithoutCache = React.useCallback(() => {
    if (typeof window === "undefined") return
    const url = new URL(window.location.href)
    url.searchParams.set("__crm_reload", String(Date.now()))
    window.location.replace(url.toString())
  }, [])

  React.useEffect(() => {
    if (!brandBubbleOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (brandBubbleRef.current?.contains(target)) return
      if (brandRef.current?.contains(target)) return
      closeBrandBubble()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBrandBubble()
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [brandBubbleOpen, closeBrandBubble])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const getInitials = (name?: string | null) => {
    const value = String(name || "").trim()
    if (!value) return "?"
    return value
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("")
      .slice(0, 2)
  }

  const renderProfileDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-full flex items-center justify-center p-2 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors">
                <Avatar className="h-9 w-9 border-2 border-primary/30">
                  <AvatarImage src={user.avatar || ""} alt={user.name} />
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors text-left">
            <Avatar className="h-10 w-10 border-2 border-primary/30 shrink-0">
              <AvatarImage src={user.avatar || ""} alt={user.name} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] h-4 mt-1 px-1.5 text-center leading-none",
                  user.role === "admin" || user.role === "admin_general"
                    ? "border-primary/50 text-primary"
                    : "border-muted-foreground/50 text-muted-foreground",
                )}
              >
                {user.roleLabel || (
                  user.role === "admin"
                    ? "Administrador"
                    : user.role
                )}
              </Badge>
            </div>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-56 ml-2">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{user.name}</span>
            <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setActiveModule("configuracion")}>
          <Settings className="mr-2 h-4 w-4" />
          Mi Perfil y Preferencias
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <TooltipProvider delayDuration={0}>
    <aside className={cn(
      "h-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0",
      collapsed ? "w-17" : isTabletLayout ? "w-56" : "w-64"
    )}>
      {/* Logo + Collapse Toggle */}
      <div className="border-b border-sidebar-border shrink-0">
        <button
          ref={brandRef}
          type="button"
          onClick={handleBrandClick}
          onContextMenu={handleBrandContextMenu}
          className={cn(
            "group w-full flex items-center transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            collapsed ? "p-3 justify-center" : "p-6 gap-3 text-left",
          )}
          aria-label="Volver al último módulo abierto"
          title="Ir al último módulo abierto"
        >
          <Image
            src="/logo-geofal.svg"
            alt="Geofal CRM"
            width={160}
            height={40}
            className={cn(
              "shrink-0 transition-transform duration-200 ease-out group-hover:scale-105",
              collapsed ? "h-8 w-auto" : "h-10 w-auto",
            )}
            priority
          />
          {!collapsed && (
            <div className="min-w-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5">
              <h1 className="font-semibold text-sidebar-foreground truncate">Geofal CRM</h1>
              <p className="text-xs text-muted-foreground truncate">Panel Administrativo</p>
            </div>
          )}
        </button>
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-1.5 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors border-t border-sidebar-border"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        {brandBubbleOpen && (
          <div
            ref={brandBubbleRef}
            className="fixed z-80 min-w-52 rounded-2xl border border-sidebar-border bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              left: Math.min(brandBubblePos.x, Math.max(16, viewport.width - 220)),
              top: Math.min(brandBubblePos.y, Math.max(16, viewport.height - 152)),
            }}
          >
            <div className="px-3 py-2 border-b border-sidebar-border bg-linear-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-2.5">
                <Image src="/logo-geofal.svg" alt="Geofal CRM" width={30} height={30} className="h-7.5 w-7.5" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-foreground truncate leading-tight">Geofal CRM</p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">Acciones rápidas</p>
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              <button
                type="button"
                onClick={openCrmInNewTab}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-left hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-primary/10 text-primary text-xs">+</span>
                <span>Abrir otra pestaña del CRM</span>
              </button>
              <button
                type="button"
                onClick={reloadWithoutCache}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-left hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <span className="flex h-6.5 w-6.5 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 text-xs">↻</span>
                <span>Recargar sin caché</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Profile (Top on Tablet) */}
      {isTabletLayout && (
        <div className={cn("border-b border-sidebar-border", collapsed ? "p-2" : "p-4")}>
          {renderProfileDropdown()}
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 min-h-0 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent", collapsed ? "p-2" : "p-4")}>
        {/* KPIs Section - Collapsed */}
        {collapsed && accessibleKpiModules.length > 0 && (
          <Tooltip key="kpi_collapsed">
            <TooltipTrigger asChild>
              <button
                onClick={() => setKpiExpanded(true)}
                className={cn(
                  "w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 py-3",
                  isKpiActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>Estadisticas & KPIs</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* KPIs Section - Expanded */}
        {!collapsed && accessibleKpiModules.length > 0 && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setKpiExpanded(prev => !prev)}
              className={cn(
                "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-4 py-3",
                isKpiActive && !kpiExpanded
                  ? "bg-sidebar-accent/40 text-sidebar-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex-1 text-left truncate font-semibold">Estadisticas & KPIs</span>
              {kpiExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {kpiExpanded && (
              <div className="pl-4 space-y-1 border-l border-sidebar-border/60 ml-6">
                {accessibleKpiModules.map((sub) => {
                  const SubIcon = sub.icon
                  const isSubActive = activeModule === sub.id
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleModuleClick(sub.id)}
                      className={cn(
                        "w-full flex items-center rounded-lg text-xs font-medium transition-all duration-200 gap-2.5 px-3 py-2",
                        isSubActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                      )}
                    >
                      <SubIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left truncate">{sub.label}</span>
                      {sub.status ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-700">
                          {sub.status}
                        </span>
                      ) : null}
                      {isSubActive && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {filteredModules.map((module) => {
          // ── Laboratorio Huanta (grupo colapsable) ──────────────────────
          if (module.id === "huanta_probetas") {
            const hasAccess = canAccessDashboardModule("huanta_probetas", user.role, user.permissions, user.email)
            if (!hasAccess) return null

            const isHuantaActive = ["huanta_probetas", "huanta_compresion", "huanta_seguimiento", "densidad_huantar"].includes(activeModule)

            if (collapsed) {
              return (
                <Tooltip key="proyecto_huanta">
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleModuleClick("huanta_probetas")}
                      className={cn(
                        "w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 py-3",
                        isHuantaActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <Beaker className="h-5 w-5 shrink-0 text-primary" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}><p>Laboratorio Huanta</p></TooltipContent>
                </Tooltip>
              )
            }

            const filteredSubmodules = huantaSubmodules.filter((sub) => {
              const isAdmin = isAdminDashboardRole(user.role)
              if (isAdmin) return true
              return canAccessDashboardModule(sub.id as any, user.role, user.permissions, user.email)
            })

            return (
              <div key="proyecto_huanta" className="space-y-1">
                <button type="button" onClick={() => setHuantaExpanded(prev => !prev)}
                  className={cn(
                    "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-4 py-3",
                    isHuantaActive && !huantaExpanded
                      ? "bg-sidebar-accent/40 text-sidebar-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <Beaker className="h-5 w-5 shrink-0 text-primary" />
                  <span className="flex-1 text-left truncate font-semibold">Laboratorio Huanta</span>
                  {huantaExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                </button>
                {huantaExpanded && (
                  <div className="pl-4 space-y-1 border-l border-sidebar-border/60 ml-6">
                    {filteredSubmodules.map((sub) => {
                      const SubIcon = sub.icon
                      const isSubActive = activeModule === sub.id
                      const readOnly = isModuleReadOnly(sub.id as any)
                      return (
                        <button key={sub.id} type="button" onClick={() => handleModuleClick(sub.id as any)}
                          className={cn(
                            "w-full flex items-center rounded-lg text-xs font-medium transition-all duration-200 gap-2.5 px-3 py-2",
                            isSubActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                          )}
                        >
                          <SubIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 text-left truncate">{sub.label}</span>
                          {readOnly && <Eye className="h-3 w-3 text-amber-500/70 shrink-0" />}
                          {!readOnly && isSubActive && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          // ── Control Ambiental (grupo colapsable) ───────────────────────
          if (module.id === "laboratorio") {
            // render laboratorio normally first, then inject the ambiental group after it
            const hasAmbientalAccess = canAccessDashboardModule("control_ambiental", user.role, user.permissions, user.email)
            const Icon = module.icon
            const isActive = activeModule === module.id
            const readOnly = isModuleReadOnly(module.id)

            const labButton = collapsed ? (
              <Tooltip key={module.id}>
                <TooltipTrigger asChild>
                  <button onClick={() => handleModuleClick(module.id)}
                    className={cn(
                      "w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 py-3",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  ><Icon className="h-5 w-5 shrink-0" /></button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}><p>{module.label}</p></TooltipContent>
              </Tooltip>
            ) : (
              <button key={module.id} onClick={() => handleModuleClick(module.id)}
                className={cn(
                  "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-4 py-3",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left truncate">{module.label}</span>
                {readOnly && <Eye className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />}
                {!readOnly && isActive && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
              </button>
            )

            // If no ambiental access, render lab button alone
            if (!hasAmbientalAccess) return labButton

            // Render lab button + ambiental collapsible group
            return (
              <React.Fragment key="lab_and_ambiental">
                {labButton}
                {!collapsed && (
                  <div className="space-y-1">
                    <button type="button" onClick={() => setAmbientalExpanded(prev => !prev)}
                      className={cn(
                        "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-4 py-3",
                        isAmbientalActive && !ambientalExpanded
                          ? "bg-sidebar-accent/40 text-sidebar-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <FlaskConical className="h-5 w-5 shrink-0 text-emerald-500" />
                      <span className="flex-1 text-left truncate font-semibold">Control Ambiental</span>
                      {ambientalExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    {ambientalExpanded && (
                      <div className="pl-4 space-y-1 border-l border-sidebar-border/60 ml-6">
                        {ambientalSubmodules.map((sub) => {
                          const SubIcon = sub.icon
                          const isSubActive = activeModule === sub.id
                          return (
                            <button key={sub.id} type="button" onClick={() => handleModuleClick(sub.id as any)}
                              className={cn(
                                "w-full flex items-center rounded-lg text-xs font-medium transition-all duration-200 gap-2.5 px-3 py-2",
                                isSubActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                              )}
                            >
                              <SubIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="flex-1 text-left truncate">{sub.label}</span>
                              {isSubActive && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
                {collapsed && (
                  <Tooltip key="ambiental_collapsed">
                    <TooltipTrigger asChild>
                      <button onClick={() => handleModuleClick("control_ambiental")}
                        className={cn(
                          "w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 py-3",
                          isAmbientalActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        )}
                      ><FlaskConical className="h-5 w-5 shrink-0 text-emerald-500" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}><p>Control Ambiental</p></TooltipContent>
                  </Tooltip>
                )}
              </React.Fragment>
            )
          }

          const Icon = module.icon
          const isActive = activeModule === module.id

          const readOnly = isModuleReadOnly(module.id)

          const button = (
            <button
              key={module.id}
              onClick={() => handleModuleClick(module.id)}
              className={cn(
                "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-left truncate">{module.label}</span>}
              {!collapsed && readOnly && <Eye className="h-3.5 w-3.5 text-amber-500/70 shrink-0" />}
              {!collapsed && !readOnly && isActive && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
            </button>
          )

          if (collapsed) {
            return (
              <Tooltip key={module.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>{module.label}{readOnly ? " (Solo lectura)" : ""}</p>
                </TooltipContent>
              </Tooltip>
            )
          }

          return button
        })}
      </nav>

      {/* User Profile Dropdown */}
      {!isTabletLayout && (
        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-4")}>
          {renderProfileDropdown()}
        </div>
      )}
    </aside>
    </TooltipProvider>
  )
}
