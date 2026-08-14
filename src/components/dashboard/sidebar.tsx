"use client"

import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import {
  Settings,
  ChevronRight,
  ChevronDown,
  FolderKanban,
  Shield,
  LogOut,
  Sun,
  Moon,
  TestTube,
  Beaker,
  PanelLeftClose,
  PanelLeft,
  Eye,
  BarChart3,
  FlaskConical,
  Briefcase,
  MapPin,
} from "lucide-react"
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
import {
  COMERCIAL_MODULES,
  CONCRETOS_MODULES,
  LAB_LIMA_MAIN_MODULES,
  LAB_LIMA_ENSAYOS_MODULES,
  LAB_HUANTA_MODULES,
  SIDEBAR_KPI_MODULES,
  ADMIN_MODULES,
  type SidebarModuleItem,
} from "@/lib/sidebar-modules"

interface SidebarProps {
  activeModule: ModuleType
  setActiveModule: (module: ModuleType) => void
  user: User
  collapsed: boolean
  onToggleCollapse: () => void
}

export function DashboardSidebar({ activeModule, setActiveModule, user, collapsed, onToggleCollapse }: SidebarProps) {
  const brandRef = React.useRef<HTMLButtonElement | null>(null)
  const brandBubbleRef = React.useRef<HTMLDivElement | null>(null)
  const [brandBubbleOpen, setBrandBubbleOpen] = React.useState(false)
  const [brandBubblePos, setBrandBubblePos] = React.useState({ x: 0, y: 0 })
  const [viewport, setViewport] = React.useState({ width: 1280, height: 720 })

  // ── Helper de filtrado por permisos ─────────────────────────────────────────
  const filterByAccess = React.useCallback(
    (items: SidebarModuleItem[]) => {
      const isAdmin = isAdminDashboardRole(user.role)
      return items.filter((item) => {
        if (isAdmin) return true
        if (item.id === "usuarios" || item.id === "auditoria") return false
        return canAccessDashboardModule(item.id, user.role, user.permissions, user.email)
      })
    },
    [user.email, user.permissions, user.role]
  )

  const isModuleReadOnly = React.useCallback(
    (moduleId: ModuleType): boolean => {
      const isAdmin = isAdminDashboardRole(user.role)
      if (isAdmin) return false
      const perm = user.permissions?.[moduleId]
      return perm?.read === true && perm?.write !== true
    },
    [user.permissions, user.role]
  )

  // ── Listas accesibles por categoría ─────────────────────────────────────────
  const accessibleComercial = React.useMemo(() => filterByAccess(COMERCIAL_MODULES), [filterByAccess])
  const accessibleConcretos = React.useMemo(() => filterByAccess(CONCRETOS_MODULES), [filterByAccess])
  const accessibleLabLimaMain = React.useMemo(() => filterByAccess(LAB_LIMA_MAIN_MODULES), [filterByAccess])
  const accessibleLabLimaEnsayos = React.useMemo(() => filterByAccess(LAB_LIMA_ENSAYOS_MODULES), [filterByAccess])
  const accessibleHuanta = React.useMemo(() => filterByAccess(LAB_HUANTA_MODULES), [filterByAccess])
  const accessibleKpis = React.useMemo(() => filterByAccess(SIDEBAR_KPI_MODULES), [filterByAccess])
  const accessibleAdmin = React.useMemo(() => filterByAccess(ADMIN_MODULES), [filterByAccess])
  const hasKanbanAccess = React.useMemo(() => {
    const isAdmin = isAdminDashboardRole(user.role)
    if (isAdmin) return true
    return canAccessDashboardModule("kanban", user.role, user.permissions, user.email)
  }, [user.email, user.permissions, user.role])

  // ── Detección de módulo activo por grupo ────────────────────────────────────
  const isComercialActive = React.useMemo(
    () => accessibleComercial.some((m) => m.id === activeModule),
    [accessibleComercial, activeModule]
  )
  const isConcretosActive = React.useMemo(
    () => accessibleConcretos.some((m) => m.id === activeModule),
    [accessibleConcretos, activeModule]
  )
  const isEnsayosActive = React.useMemo(
    () => accessibleLabLimaEnsayos.some((m) => m.id === activeModule),
    [accessibleLabLimaEnsayos, activeModule]
  )
  const isLabLimaActive = React.useMemo(
    () => accessibleLabLimaMain.some((m) => m.id === activeModule) || isEnsayosActive,
    [accessibleLabLimaMain, isEnsayosActive, activeModule]
  )
  const isHuantaActive = React.useMemo(
    () => accessibleHuanta.some((m) => m.id === activeModule),
    [accessibleHuanta, activeModule]
  )
  const isKpiActive = React.useMemo(
    () => accessibleKpis.some((m) => m.id === activeModule),
    [accessibleKpis, activeModule]
  )
  const isAdminActive = React.useMemo(
    () => accessibleAdmin.some((m) => m.id === activeModule),
    [accessibleAdmin, activeModule]
  )

  // ── Estados de acordeones colapsables ───────────────────────────────────────
  const [comercialExpanded, setComercialExpanded] = React.useState(isComercialActive || false)
  const [concretosExpanded, setConcretosExpanded] = React.useState(isConcretosActive || false)
  const [labLimaExpanded, setLabLimaExpanded] = React.useState(isLabLimaActive || false)
  const [ensayosExpanded, setEnsayosExpanded] = React.useState(isEnsayosActive || false)
  const [huantaExpanded, setHuantaExpanded] = React.useState(isHuantaActive || false)
  const [kpiExpanded, setKpiExpanded] = React.useState(isKpiActive || false)
  const [adminExpanded, setAdminExpanded] = React.useState(isAdminActive || false)

  // Auto-expansión cuando el módulo activo cambia
  React.useEffect(() => {
    if (isComercialActive) setComercialExpanded(true)
    if (isConcretosActive) setConcretosExpanded(true)
    if (isLabLimaActive) setLabLimaExpanded(true)
    if (isEnsayosActive) setEnsayosExpanded(true)
    if (isHuantaActive) setHuantaExpanded(true)
    if (isKpiActive) setKpiExpanded(true)
    if (isAdminActive) setAdminExpanded(true)
  }, [isComercialActive, isConcretosActive, isLabLimaActive, isEnsayosActive, isHuantaActive, isKpiActive, isAdminActive])

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
                {user.roleLabel || (user.role === "admin" ? "Administrador" : user.role)}
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

  // ── Renderizador de ítem de submódulo individual ───────────────────────────
  const renderSubmoduleButton = (sub: SidebarModuleItem) => {
    const SubIcon = sub.icon
    const isSubActive = activeModule === sub.id
    const readOnly = isModuleReadOnly(sub.id)

    return (
      <button
        key={sub.id}
        type="button"
        onClick={() => handleModuleClick(sub.id)}
        className={cn(
          "w-full flex items-center rounded-lg text-xs font-medium transition-all duration-200 gap-2.5 px-3 py-2 text-left",
          isSubActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
        )}
      >
        <SubIcon className={cn("h-4 w-4 shrink-0", isSubActive ? "text-primary" : "text-muted-foreground")} />
        <span className="flex-1 truncate">{sub.label}</span>
        {sub.status ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-700">
            {sub.status}
          </span>
        ) : null}
        {readOnly && <Eye className="h-3 w-3 text-amber-500/70 shrink-0" />}
        {!readOnly && isSubActive && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
      </button>
    )
  }

  // ── Renderizador de ítem individual de nivel superior ─────────────────────
  const renderSingleModuleItem = (item: SidebarModuleItem, defaultColorClass = "text-primary") => {
    const ItemIcon = item.icon
    const isActive = activeModule === item.id
    const readOnly = isModuleReadOnly(item.id)

    if (collapsed) {
      return renderCollapsedGroupButton(
        `${item.id}_collapsed`,
        item.label,
        ItemIcon,
        isActive,
        item.id,
      )
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleModuleClick(item.id)}
        className={cn(
          "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 text-left",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
        )}
      >
        <ItemIcon className={cn("h-4.5 w-4.5 shrink-0", isActive ? "text-primary" : defaultColorClass)} />
        <span className="flex-1 truncate font-semibold text-xs tracking-wide">{item.label}</span>
        {item.status ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-700">
            {item.status}
          </span>
        ) : null}
        {readOnly && <Eye className="h-3 w-3 text-amber-500/70 shrink-0" />}
        {!readOnly && isActive && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
      </button>
    )
  }

  // ── Renderizador de botón colapsado con tooltip ────────────────────────────
  const renderCollapsedGroupButton = (
    key: string,
    label: string,
    Icon: React.ElementType,
    isActive: boolean,
    firstAccessibleModuleId?: ModuleType,
  ) => (
    <Tooltip key={key}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => firstAccessibleModuleId && handleModuleClick(firstAccessibleModuleId)}
          className={cn(
            "w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 py-3",
            isActive
              ? "bg-sidebar-accent text-primary shadow-xs"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        <p className="font-semibold">{label}</p>
      </TooltipContent>
    </Tooltip>
  )

  const labLimaTotalCount = accessibleLabLimaMain.length + accessibleLabLimaEnsayos.length
  const singleLabLimaItem = accessibleLabLimaMain[0] || accessibleLabLimaEnsayos[0]

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "h-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden transition-all duration-300 ease-in-out shrink-0",
          collapsed ? "w-17" : isTabletLayout ? "w-56" : "w-64",
        )}
      >
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
            aria-label="Volver al inicio"
            title="Ir a inicio del CRM"
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
                <p className="text-xs text-muted-foreground truncate">Panel Central</p>
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
        <nav
          className={cn(
            "flex-1 min-h-0 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent",
            collapsed ? "p-2" : "p-3",
          )}
        >
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 1. GRUPO COMERCIAL                                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {accessibleComercial.length === 1 && renderSingleModuleItem(accessibleComercial[0], "text-blue-500")}
          {accessibleComercial.length > 1 && (
            <>
              {collapsed ? (
                renderCollapsedGroupButton(
                  "comercial_collapsed",
                  "Comercial",
                  Briefcase,
                  isComercialActive,
                  accessibleComercial[0]?.id,
                )
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setComercialExpanded((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                      isComercialActive && !comercialExpanded
                        ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <Briefcase className={cn("h-4.5 w-4.5 shrink-0", isComercialActive ? "text-primary" : "text-blue-500")} />
                    <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Comercial</span>
                    {comercialExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {comercialExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-blue-500/30 ml-4.5 my-1">
                      {accessibleComercial.map(renderSubmoduleButton)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 2. GRUPO CONCRETOS                                             */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {accessibleConcretos.length === 1 && renderSingleModuleItem(accessibleConcretos[0], "text-amber-500")}
          {accessibleConcretos.length > 1 && (
            <>
              {collapsed ? (
                renderCollapsedGroupButton(
                  "concretos_collapsed",
                  "Concretos",
                  TestTube,
                  isConcretosActive,
                  accessibleConcretos[0]?.id,
                )
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setConcretosExpanded((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                      isConcretosActive && !concretosExpanded
                        ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <TestTube className={cn("h-4.5 w-4.5 shrink-0", isConcretosActive ? "text-primary" : "text-amber-500")} />
                    <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Concretos</span>
                    {concretosExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {concretosExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-amber-500/30 ml-4.5 my-1">
                      {accessibleConcretos.map(renderSubmoduleButton)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 3. GRUPO LAB. LIMA (Control + Ensayos)                         */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {labLimaTotalCount === 1 && singleLabLimaItem && renderSingleModuleItem(singleLabLimaItem, "text-emerald-500")}
          {labLimaTotalCount > 1 && (
            <>
              {collapsed ? (
                renderCollapsedGroupButton(
                  "lab_lima_collapsed",
                  "Lab. Lima",
                  FlaskConical,
                  isLabLimaActive,
                  accessibleLabLimaMain[0]?.id || accessibleLabLimaEnsayos[0]?.id,
                )
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setLabLimaExpanded((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                      isLabLimaActive && !labLimaExpanded
                        ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <FlaskConical className={cn("h-4.5 w-4.5 shrink-0", isLabLimaActive ? "text-primary" : "text-emerald-500")} />
                    <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Lab. Lima</span>
                    {labLimaExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {labLimaExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-emerald-500/30 ml-4.5 my-1">
                      {/* Módulos Principales de Control */}
                      {accessibleLabLimaMain.map(renderSubmoduleButton)}

                      {/* Sub-acordeón de Ensayos si hay más de 1, o botón directo si es solo 1 */}
                      {accessibleLabLimaEnsayos.length === 1 && renderSubmoduleButton(accessibleLabLimaEnsayos[0])}
                      {accessibleLabLimaEnsayos.length > 1 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setEnsayosExpanded((prev) => !prev)}
                            className={cn(
                              "w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-200 gap-2 px-2.5 py-1.5 text-left",
                              isEnsayosActive && !ensayosExpanded
                                ? "bg-sidebar-accent/60 text-primary font-bold"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                            )}
                          >
                            <Beaker className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span className="flex-1 truncate">Ensayos & Suelos</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sidebar-accent text-muted-foreground">
                              {accessibleLabLimaEnsayos.length}
                            </span>
                            {ensayosExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                          </button>

                          {ensayosExpanded && (
                            <div className="pl-2.5 space-y-0.5 border-l border-emerald-500/20 ml-3.5 my-1 max-h-80 overflow-y-auto scrollbar-thin">
                              {accessibleLabLimaEnsayos.map(renderSubmoduleButton)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 4. TABLEROS KANBAN                                              */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {hasKanbanAccess && (
            <>
              {collapsed ? (
                <Tooltip key="kanban_collapsed">
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleModuleClick("kanban")}
                      className={cn(
                        "w-full flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-200 py-3",
                        activeModule === "kanban"
                          ? "bg-sidebar-accent text-primary shadow-xs"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <FolderKanban className="h-5 w-5 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    <p className="font-semibold">Tableros Kanban</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  onClick={() => handleModuleClick("kanban")}
                  className={cn(
                    "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                    activeModule === "kanban"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                >
                  <FolderKanban className={cn("h-4.5 w-4.5 shrink-0", activeModule === "kanban" ? "text-primary" : "text-indigo-500")} />
                  <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Tableros Kanban</span>
                  {activeModule === "kanban" && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
                </button>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 5. LAB. HUANTA                                                 */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {accessibleHuanta.length === 1 && renderSingleModuleItem(accessibleHuanta[0], "text-rose-500")}
          {accessibleHuanta.length > 1 && (
            <>
              {collapsed ? (
                renderCollapsedGroupButton(
                  "lab_huanta_collapsed",
                  "Lab. Huanta",
                  MapPin,
                  isHuantaActive,
                  accessibleHuanta[0]?.id,
                )
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setHuantaExpanded((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                      isHuantaActive && !huantaExpanded
                        ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <MapPin className={cn("h-4.5 w-4.5 shrink-0", isHuantaActive ? "text-primary" : "text-rose-500")} />
                    <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Lab. Huanta</span>
                    {huantaExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {huantaExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-rose-500/30 ml-4.5 my-1">
                      {accessibleHuanta.map(renderSubmoduleButton)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 6. ESTADÍSTICAS & KPIS                                         */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {accessibleKpis.length === 1 && renderSingleModuleItem(accessibleKpis[0], "text-violet-500")}
          {accessibleKpis.length > 1 && (
            <>
              {collapsed ? (
                renderCollapsedGroupButton(
                  "kpi_collapsed",
                  "Estadísticas & KPIs",
                  BarChart3,
                  isKpiActive,
                  accessibleKpis[0]?.id,
                )
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setKpiExpanded((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                      isKpiActive && !kpiExpanded
                        ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <BarChart3 className={cn("h-4.5 w-4.5 shrink-0", isKpiActive ? "text-primary" : "text-violet-500")} />
                    <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Estadísticas & KPIs</span>
                    {kpiExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {kpiExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-violet-500/30 ml-4.5 my-1">
                      {accessibleKpis.map(renderSubmoduleButton)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* 7. ADMINISTRACIÓN & SISTEMA                                    */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {accessibleAdmin.length === 1 && renderSingleModuleItem(accessibleAdmin[0], "text-slate-500")}
          {accessibleAdmin.length > 1 && (
            <>
              {collapsed ? (
                renderCollapsedGroupButton(
                  "admin_collapsed",
                  "Administración",
                  Shield,
                  isAdminActive,
                  accessibleAdmin[0]?.id,
                )
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setAdminExpanded((prev) => !prev)}
                    className={cn(
                      "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5",
                      isAdminActive && !adminExpanded
                        ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                    )}
                  >
                    <Shield className={cn("h-4.5 w-4.5 shrink-0", isAdminActive ? "text-primary" : "text-slate-500")} />
                    <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Administración</span>
                    {adminExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {adminExpanded && (
                    <div className="pl-3 space-y-1 border-l-2 border-slate-500/30 ml-4.5 my-1">
                      {accessibleAdmin.map(renderSubmoduleButton)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </nav>

        {/* User Profile Dropdown */}
        {!isTabletLayout && (
          <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
            {renderProfileDropdown()}
          </div>
        )}
      </aside>
    </TooltipProvider>
  )
}
