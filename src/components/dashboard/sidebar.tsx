"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Users, FileText, Settings, ChevronRight, FolderKanban, Shield, User as UserIcon, Activity, ClipboardList, LogOut, Sun, Moon } from "lucide-react"
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
import { useTheme } from "@/components/theme-provider"
import { useAuth, type ModuleType, type User } from "@/hooks/use-auth"

interface SidebarProps {
  activeModule: ModuleType
  setActiveModule: (module: ModuleType) => void
  user: User
}

const modules: { id: ModuleType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban },
  { id: "cotizadora", label: "Cotizadora", icon: FileText },
  { id: "laboratorio", label: "Control Laboratorio", icon: Activity },
  { id: "comercial", label: "Control Comercial", icon: ClipboardList },
  { id: "administracion", label: "Control Administración", icon: Shield },
  { id: "usuarios", label: "Usuarios", icon: Shield, adminOnly: true },
  { id: "permisos", label: "Permisos", icon: Shield, adminOnly: true },
  { id: "auditoria", label: "Auditoría", icon: Activity, adminOnly: true },
  { id: "configuracion", label: "Configuración", icon: Settings },
]


export function DashboardSidebar({ activeModule, setActiveModule, user }: SidebarProps) {
  // Use granular permissions for filtering
  // Admin maintains full access fallback, but ideally should have all permissions true in DB
  const filteredModules = modules.filter((module) => {
    // 1. If user is admin, show everything
    if (user.role === "admin") return true

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

  return (
    <aside className="w-64 h-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/logo-geofal.svg"
            alt="Geofal CRM"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="font-semibold text-sidebar-foreground">Geofal CRM</h1>
            <p className="text-xs text-muted-foreground">Panel Administrativo</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-sidebar-accent">
        {filteredModules.map((module) => {
          const Icon = module.icon
          const isActive = activeModule === module.id

          return (
            <button
              key={module.id}
              onClick={() => handleModuleClick(module.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-left">{module.label}</span>
              {isActive && <ChevronRight className="h-4 w-4 text-primary" />}
            </button>
          )
        })}
      </nav>

      {/* User Profile Dropdown */}
      <div className="p-4 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 transition-colors text-left">
              <Avatar className="h-10 w-10 border-2 border-primary/30">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <AvatarFallback className="bg-primary/20 text-primary">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-4 mt-1 px-1.5 text-center leading-none",
                    user.role === "admin"
                      ? "border-primary/50 text-primary"
                      : "border-muted-foreground/50 text-muted-foreground",
                  )}
                >
                  {user.roleLabel || (user.role === "admin" ? "Administrador" : user.role === "asesor comercial" ? "Asesor Comercial" : user.role)}
                </Badge>
              </div>
            </button>
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
      </div>
    </aside>
  )
}
