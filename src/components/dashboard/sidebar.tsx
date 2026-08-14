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
  Pin,
  GripVertical,
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

const PINNED_STORAGE_KEY = "geofal_sidebar_pinned_panels"
const GROUPS_ORDER_STORAGE_KEY = "geofal_sidebar_groups_order"

const DEFAULT_GROUPS_ORDER = [
  "comercial",
  "concretos",
  "lab_lima",
  "kanban",
  "huanta",
  "kpi",
  "admin",
]

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

  // ── Estado de paneles fijados (Pin) con persistencia en localStorage ────────
  const [pinnedGroups, setPinnedGroups] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(PINNED_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed === "object" && parsed !== null) {
          setPinnedGroups(parsed)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const togglePinGroup = React.useCallback(
    (groupId: string, setExpandedFn: React.Dispatch<React.SetStateAction<boolean>>) => {
      setPinnedGroups((prev) => {
        const nextState = !prev[groupId]
        const updated = { ...prev, [groupId]: nextState }
        try {
          localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(updated))
        } catch {
          // ignore
        }
        if (nextState) {
          setExpandedFn(true)
        }
        return updated
      })
    },
    []
  )

  // ── Orden de grupos con soporte Drag & Drop ─────────────────────────────────
  const [groupOrder, setGroupOrder] = React.useState<string[]>(DEFAULT_GROUPS_ORDER)
  const [draggedGroupId, setDraggedGroupId] = React.useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = React.useState<string | null>(null)

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(GROUPS_ORDER_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((id) => DEFAULT_GROUPS_ORDER.includes(id))
          const missing = DEFAULT_GROUPS_ORDER.filter((id) => !valid.includes(id))
          setGroupOrder([...valid, ...missing])
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const handleDragStart = (e: React.DragEvent, groupId: string) => {
    e.dataTransfer.setData("text/plain", groupId)
    e.dataTransfer.effectAllowed = "move"
    setDraggedGroupId(groupId)
  }

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragOverGroupId !== groupId) {
      setDragOverGroupId(groupId)
    }
  }

  const handleDrop = (e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault()
    if (!draggedGroupId || draggedGroupId === targetGroupId) {
      setDraggedGroupId(null)
      setDragOverGroupId(null)
      return
    }

    setGroupOrder((prev) => {
      const newOrder = [...prev]
      const fromIndex = newOrder.indexOf(draggedGroupId)
      const toIndex = newOrder.indexOf(targetGroupId)
      if (fromIndex !== -1 && toIndex !== -1) {
        newOrder.splice(fromIndex, 1)
        newOrder.splice(toIndex, 0, draggedGroupId)
        try {
          localStorage.setItem(GROUPS_ORDER_STORAGE_KEY, JSON.stringify(newOrder))
        } catch {
          // ignore
        }
      }
      return newOrder
    })

    setDraggedGroupId(null)
    setDragOverGroupId(null)
  }

  const handleDragEnd = () => {
    setDraggedGroupId(null)
    setDragOverGroupId(null)
  }

  // ── Estados de acordeones colapsables ───────────────────────────────────────
  const [comercialExpanded, setComercialExpanded] = React.useState(isComercialActive || false)
  const [concretosExpanded, setConcretosExpanded] = React.useState(isConcretosActive || false)
  const [labLimaExpanded, setLabLimaExpanded] = React.useState(isLabLimaActive || false)
  const [ensayosExpanded, setEnsayosExpanded] = React.useState(isEnsayosActive || false)
  const [huantaExpanded, setHuantaExpanded] = React.useState(isHuantaActive || false)
  const [kpiExpanded, setKpiExpanded] = React.useState(isKpiActive || false)
  const [adminExpanded, setAdminExpanded] = React.useState(isAdminActive || false)

  // Auto-expansión cuando el módulo activo cambia o cuando el grupo está fijado
  React.useEffect(() => {
    if (isComercialActive || pinnedGroups.comercial) setComercialExpanded(true)
    if (isConcretosActive || pinnedGroups.concretos) setConcretosExpanded(true)
    if (isLabLimaActive || pinnedGroups.lab_lima) setLabLimaExpanded(true)
    if (isEnsayosActive || pinnedGroups.ensayos) setEnsayosExpanded(true)
    if (isHuantaActive || pinnedGroups.huanta) setHuantaExpanded(true)
    if (isKpiActive || pinnedGroups.kpi) setKpiExpanded(true)
    if (isAdminActive || pinnedGroups.admin) setAdminExpanded(true)
  }, [
    isComercialActive,
    isConcretosActive,
    isLabLimaActive,
    isEnsayosActive,
    isHuantaActive,
    isKpiActive,
    isAdminActive,
    pinnedGroups,
  ])

  // Helper para renderizar el botón de Pin pequeño junto al título (solo cuando está desplegado o fijado)
  const renderPinButton = (
    groupId: string,
    setExpandedFn: React.Dispatch<React.SetStateAction<boolean>>,
    label: string,
    isExpanded: boolean
  ) => {
    const isPinned = !!pinnedGroups[groupId]
    if (!isExpanded && !isPinned) return null

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          togglePinGroup(groupId, setExpandedFn)
        }}
        title={isPinned ? `Desfijar ${label}` : `Fijar ${label} abierto`}
        className={cn(
          "flex h-5.5 w-5.5 items-center justify-center rounded-md transition-all text-xs shrink-0 mr-1 animate-in fade-in-0 zoom-in-95 duration-150",
          isPinned
            ? "text-blue-600 bg-blue-50/90 border border-blue-200/80 shadow-2xs dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800 opacity-100"
            : "text-muted-foreground/40 hover:text-blue-600 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 opacity-80"
        )}
        aria-label={isPinned ? `Desfijar ${label}` : `Fijar ${label}`}
      >
        <Pin className={cn("h-3 w-3 transition-transform", isPinned ? "fill-current" : "")} />
      </button>
    )
  }

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

  // ── Renderizador dinámico de grupos de módulos por ID ──────────────────────
  const renderSidebarGroup = (groupId: string) => {
    switch (groupId) {
      case "comercial": {
        if (accessibleComercial.length === 0) return null
        if (accessibleComercial.length === 1) return renderSingleModuleItem(accessibleComercial[0], "text-blue-500")
        if (collapsed) {
          return renderCollapsedGroupButton(
            "comercial_collapsed",
            "Comercial",
            Briefcase,
            isComercialActive,
            accessibleComercial[0]?.id,
          )
        }
        return (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setComercialExpanded((prev) => !prev)}
              className={cn(
                "group/header w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 cursor-pointer",
                isComercialActive && !comercialExpanded
                  ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              <Briefcase className={cn("h-4.5 w-4.5 shrink-0", isComercialActive ? "text-primary" : "text-blue-500")} />
              <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Comercial</span>
              {renderPinButton("comercial", setComercialExpanded, "Comercial", comercialExpanded)}
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
        )
      }

      case "concretos": {
        if (accessibleConcretos.length === 0) return null
        if (accessibleConcretos.length === 1) return renderSingleModuleItem(accessibleConcretos[0], "text-amber-500")
        if (collapsed) {
          return renderCollapsedGroupButton(
            "concretos_collapsed",
            "Concretos",
            TestTube,
            isConcretosActive,
            accessibleConcretos[0]?.id,
          )
        }
        return (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setConcretosExpanded((prev) => !prev)}
              className={cn(
                "group/header w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 cursor-pointer",
                isConcretosActive && !concretosExpanded
                  ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              <TestTube className={cn("h-4.5 w-4.5 shrink-0", isConcretosActive ? "text-primary" : "text-amber-500")} />
              <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Concretos</span>
              {renderPinButton("concretos", setConcretosExpanded, "Concretos", concretosExpanded)}
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
        )
      }

      case "lab_lima": {
        if (labLimaTotalCount === 0) return null
        if (labLimaTotalCount === 1 && singleLabLimaItem) return renderSingleModuleItem(singleLabLimaItem, "text-emerald-500")
        if (collapsed) {
          return renderCollapsedGroupButton(
            "lab_lima_collapsed",
            "Lab. Lima",
            FlaskConical,
            isLabLimaActive,
            accessibleLabLimaMain[0]?.id || accessibleLabLimaEnsayos[0]?.id,
          )
        }
        return (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setLabLimaExpanded((prev) => !prev)}
              className={cn(
                "group/header w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 cursor-pointer",
                isLabLimaActive && !labLimaExpanded
                  ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              <FlaskConical className={cn("h-4.5 w-4.5 shrink-0", isLabLimaActive ? "text-primary" : "text-emerald-500")} />
              <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Lab. Lima</span>
              {renderPinButton("lab_lima", setLabLimaExpanded, "Lab. Lima", labLimaExpanded)}
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
                        "group/header w-full flex items-center rounded-lg text-xs font-semibold transition-all duration-200 gap-2 px-2.5 py-1.5 text-left cursor-pointer",
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
                      {renderPinButton("ensayos", setEnsayosExpanded, "Ensayos & Suelos", ensayosExpanded)}
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
        )
      }

      case "kanban": {
        if (!hasKanbanAccess) return null
        if (collapsed) {
          return (
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
          )
        }
        return (
          <button
            type="button"
            onClick={() => handleModuleClick("kanban")}
            className={cn(
              "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 cursor-pointer",
              activeModule === "kanban"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
            )}
          >
            <FolderKanban className={cn("h-4.5 w-4.5 shrink-0", activeModule === "kanban" ? "text-primary" : "text-indigo-500")} />
            <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Tableros Kanban</span>
            {activeModule === "kanban" && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
          </button>
        )
      }

      case "huanta": {
        if (accessibleHuanta.length === 0) return null
        if (accessibleHuanta.length === 1) return renderSingleModuleItem(accessibleHuanta[0], "text-rose-500")
        if (collapsed) {
          return renderCollapsedGroupButton(
            "lab_huanta_collapsed",
            "Lab. Huanta",
            MapPin,
            isHuantaActive,
            accessibleHuanta[0]?.id,
          )
        }
        return (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setHuantaExpanded((prev) => !prev)}
              className={cn(
                "group/header w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 cursor-pointer",
                isHuantaActive && !huantaExpanded
                  ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              <MapPin className={cn("h-4.5 w-4.5 shrink-0", isHuantaActive ? "text-primary" : "text-rose-500")} />
              <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Lab. Huanta</span>
              {renderPinButton("huanta", setHuantaExpanded, "Lab. Huanta", huantaExpanded)}
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
        )
      }

      case "kpi": {
        if (accessibleKpis.length === 0) return null
        if (accessibleKpis.length === 1) return renderSingleModuleItem(accessibleKpis[0], "text-violet-500")
        if (collapsed) {
          return renderCollapsedGroupButton(
            "kpi_collapsed",
            "Estadísticas & KPIs",
            BarChart3,
            isKpiActive,
            accessibleKpis[0]?.id,
          )
        }
        return (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setKpiExpanded((prev) => !prev)}
              className={cn(
                "group/header w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 cursor-pointer",
                isKpiActive && !kpiExpanded
                  ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              <BarChart3 className={cn("h-4.5 w-4.5 shrink-0", isKpiActive ? "text-primary" : "text-violet-500")} />
              <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Estadísticas & KPIs</span>
              {renderPinButton("kpi", setKpiExpanded, "Estadísticas & KPIs", kpiExpanded)}
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
        )
      }

      case "admin": {
        if (accessibleAdmin.length === 0) return null
        if (accessibleAdmin.length === 1) return renderSingleModuleItem(accessibleAdmin[0], "text-slate-500")
        if (collapsed) {
          return renderCollapsedGroupButton(
            "admin_collapsed",
            "Administración",
            Shield,
            isAdminActive,
            accessibleAdmin[0]?.id,
          )
        }
        return (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setAdminExpanded((prev) => !prev)}
              className={cn(
                "group/header w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 gap-3 px-3 py-2.5 cursor-pointer",
                isAdminActive && !adminExpanded
                  ? "bg-sidebar-accent/50 text-sidebar-foreground font-semibold"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              <Shield className={cn("h-4.5 w-4.5 shrink-0", isAdminActive ? "text-primary" : "text-slate-500")} />
              <span className="flex-1 text-left truncate font-semibold text-xs tracking-wide uppercase">Administración</span>
              {renderPinButton("admin", setAdminExpanded, "Administración", adminExpanded)}
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
        )
      }

      default:
        return null
    }
  }

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

        {/* Navigation con Drag & Drop Reordenable */}
        <nav
          className={cn(
            "flex-1 min-h-0 space-y-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent",
            collapsed ? "p-2" : "p-3",
          )}
        >
          {groupOrder.map((groupId) => {
            const groupContent = renderSidebarGroup(groupId)
            if (!groupContent) return null

            return (
              <div
                key={groupId}
                draggable={!collapsed}
                onDragStart={(e) => handleDragStart(e, groupId)}
                onDragOver={(e) => handleDragOver(e, groupId)}
                onDragLeave={() => {
                  if (dragOverGroupId === groupId) setDragOverGroupId(null)
                }}
                onDrop={(e) => handleDrop(e, groupId)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "transition-all duration-200 rounded-xl",
                  draggedGroupId === groupId && "opacity-40 scale-[0.98] border border-dashed border-primary/50",
                  dragOverGroupId === groupId && draggedGroupId !== groupId && "border-t-2 border-primary bg-primary/5 pt-1",
                )}
              >
                {groupContent}
              </div>
            )
          })}
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
