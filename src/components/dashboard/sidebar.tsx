"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Users, FileText, Settings, ChevronRight, ChevronLeft, FolderKanban, Shield, User as UserIcon, Activity, ClipboardList, LogOut, Sun, Moon, TestTube, Beaker, PanelLeftClose, PanelLeft } from "lucide-react"
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

interface SidebarProps {
  activeModule: ModuleType
  setActiveModule: (module: ModuleType) => void
  user: User
  collapsed: boolean
  onToggleCollapse: () => void
}

const modules: { id: ModuleType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban },
  { id: "cotizadora", label: "Cotizadora", icon: FileText },
  { id: "recepcion", label: "Recepción", icon: TestTube, adminOnly: true },
  { id: "verificacion_muestras", label: "Verificación Muestras", icon: ClipboardList, adminOnly: true },
  { id: "compresion", label: "Formato", icon: Beaker, adminOnly: true },
  { id: "humedad", label: "Humedad", icon: Beaker, adminOnly: true },
  { id: "cbr", label: "CBR", icon: Beaker, adminOnly: true },
  { id: "proctor", label: "Proctor", icon: Beaker, adminOnly: true },
  { id: "laboratorio", label: "Control Laboratorio", icon: Activity },
  { id: "comercial", label: "Control Comercial", icon: ClipboardList },
  { id: "administracion", label: "Control Administración", icon: Shield },
  { id: "usuarios", label: "Usuarios", icon: Shield, adminOnly: true },
  { id: "permisos", label: "Permisos", icon: Shield, adminOnly: true },
  { id: "auditoria", label: "Auditoría", icon: Activity, adminOnly: true },
  { id: "configuracion", label: "Configuración", icon: Settings },
  { id: "tracing", label: "Seguimiento (Tracing)", icon: Activity },
]


export function DashboardSidebar({ activeModule, setActiveModule, user, collapsed, onToggleCollapse }: SidebarProps) {
  const [isTabletLayout, setIsTabletLayout] = React.useState(false)

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1100px)")
    const updateTabletLayout = () => setIsTabletLayout(mediaQuery.matches)
    updateTabletLayout()
    mediaQuery.addEventListener("change", updateTabletLayout)
    return () => mediaQuery.removeEventListener("change", updateTabletLayout)
  }, [])

  // Use granular permissions for filtering
  // Admin maintains full access fallback, but ideally should have all permissions true in DB
  const filteredModules = modules.filter((module) => {
    const isAdmin = user.role === "admin" || user.role === "admin_general"

    // CBR is restricted: only Admin/Gerencia
    if (module.id === "cbr") {
      return isAdmin
    }

    // 1. If user is admin, show everything
    if (isAdmin) return true

    // 2. If module has specific permission key, check it
    if (user.permissions && user.permissions[module.id]) {
      return user.permissions[module.id].read === true
    }

    return false
  })

  const { theme, setTheme } = useTheme()
  const { signOut } = useAuth()

  const handleModuleClick = (id: ModuleType) => {
    setActiveModule(id)
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const renderProfileDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-full flex items-center justify-center p-2 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors">
                <Avatar className="h-9 w-9 border-2 border-primary/30">
                  <div className="h-full w-full rounded-full bg-primary/20 flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-primary" />
                  </div>
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {user.name?.split(" ").map((n) => n[0]).join("")}
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
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <UserIcon className="h-4 w-4 text-primary" />
              </div>
              <AvatarFallback className="bg-primary/20 text-primary">
                {user.name?.split(" ").map((n) => n[0]).join("")}
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
                {user.roleLabel || (user.role === "admin" ? "Administrador" : user.role === "asesor comercial" ? "Asesor Comercial" : user.role)}
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
      collapsed ? "w-[68px]" : isTabletLayout ? "w-56" : "w-64"
    )}>
      {/* Logo + Collapse Toggle */}
      <div className="border-b border-sidebar-border shrink-0">
        <div className={cn("flex items-center", collapsed ? "p-3 justify-center" : "p-6 gap-3")}>
          <img
            src="/logo-geofal.svg"
            alt="Geofal CRM"
            className={cn("shrink-0 transition-all duration-300", collapsed ? "h-8 w-auto" : "h-10 w-auto")}
          />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-semibold text-sidebar-foreground truncate">Geofal CRM</h1>
              <p className="text-xs text-muted-foreground truncate">Panel Administrativo</p>
            </div>
          )}
        </div>
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-1.5 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors border-t border-sidebar-border"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* User Profile (Top on Tablet) */}
      {isTabletLayout && (
        <div className={cn("border-b border-sidebar-border", collapsed ? "p-2" : "p-4")}>
          {renderProfileDropdown()}
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 min-h-0 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent", collapsed ? "p-2" : "p-4")}>
        {filteredModules.map((module) => {
          const Icon = module.icon
          const isActive = activeModule === module.id

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
              {!collapsed && isActive && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
            </button>
          )

          if (collapsed) {
            return (
              <Tooltip key={module.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>{module.label}</p>
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
