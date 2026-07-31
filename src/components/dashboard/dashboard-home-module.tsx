"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowUpRight, Clock3, LayoutGrid, Sparkles } from "lucide-react"
import type { ModuleType, User } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { canAccessDashboardModule } from "@/lib/control-module-access"
import { PERMISSION_MODULE_CATALOG } from "@/lib/permission-modules"

interface DashboardHomeModuleProps {
  user: User
  onNavigateModule: (module: ModuleType) => void
}

const quickAccessByRole: Record<string, { label: string; module: ModuleType }[]> = {
  admin: [
    { label: "Clientes", module: "clientes" },
    { label: "Seguimiento", module: "tracing" },
    { label: "Control Informes", module: "ingenieria_archivos" },
  ],
  admin_general: [
    { label: "Clientes", module: "clientes" },
    { label: "Seguimiento", module: "tracing" },
    { label: "Control Comercial", module: "comercial" },
  ],
  comercial: [
    { label: "Clientes", module: "clientes" },
    { label: "Cotizadora", module: "cotizadora" },
    { label: "Control Comercial", module: "comercial" },
  ],
  auxiliar_comercial: [
    { label: "Clientes", module: "clientes" },
    { label: "Cotizadora", module: "cotizadora" },
    { label: "Control Comercial", module: "comercial" },
  ],
  administrativo: [
    { label: "Clientes", module: "clientes" },
    { label: "Proyectos", module: "proyectos" },
    { label: "Control Administración", module: "administracion" },
  ],
  laboratorio: [
    { label: "Seguimiento", module: "tracing" },
    { label: "Recepción", module: "recepcion" },
    { label: "Control Laboratorio", module: "laboratorio" },
  ],
  jefe_laboratorio: [
    { label: "Seguimiento", module: "tracing" },
    { label: "Laboratorio", module: "laboratorio" },
    { label: "Control Informes", module: "ingenieria_archivos" },
  ],
  laboratorio_tipificador: [
    { label: "Seguimiento", module: "tracing" },
    { label: "Recepción", module: "recepcion" },
    { label: "Verificación", module: "verificacion_muestras" },
  ],
  laboratorio_lector: [
    { label: "Seguimiento", module: "tracing" },
    { label: "Verificación", module: "verificacion_muestras" },
    { label: "Control Informes", module: "ingenieria_archivos" },
  ],
  tecnico: [
    { label: "Seguimiento", module: "tracing" },
    { label: "Recepción", module: "recepcion" },
    { label: "Verificación", module: "verificacion_muestras" },
  ],
  tecnico_suelos: [
    { label: "Seguimiento", module: "tracing" },
    { label: "Recepción", module: "recepcion" },
    { label: "Verificación", module: "verificacion_muestras" },
  ],
}

export function DashboardHomeModule({ user, onNavigateModule }: DashboardHomeModuleProps) {
  const roleKey = String(user.role || "").toLowerCase()
  const greetingStorageKey = `crm-home-greeting-state-${user.id}`
  const moduleLabelMap = useMemo(() => {
    return new Map(PERMISSION_MODULE_CATALOG.map((item) => [item.id, item.label]))
  }, [])
  const canAccess = useCallback((module: ModuleType) => {
    return canAccessDashboardModule(module, user.role, user.permissions, user.email)
  }, [user.email, user.permissions, user.role])
  const [greeting, setGreeting] = useState("Bienvenido de nuevo")

  const greetingPool = useMemo(() => {
    const firstEntryMessages = [
      "Bienvenido de nuevo",
      "Tu panel está listo",
      "Todo listo para seguir",
    ]
    const repeatMessages = [
      "Qué gusto verte de nuevo",
      "Vamos con un gran día",
      "CRM listo, café opcional",
    ]

    const sensitiveRole = [
      "admin",
      "admin_general",
      "administrativo",
      "laboratorio_lector",
    ].includes(roleKey)

    return {
      firstEntry: sensitiveRole ? firstEntryMessages : [...firstEntryMessages, ...repeatMessages],
      repeat: sensitiveRole
        ? [...firstEntryMessages, "Bienvenido de nuevo"]
        : [...repeatMessages, "Bienvenido de nuevo"],
    }
  }, [roleKey])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const today = new Date().toISOString().slice(0, 10)
      const saved = localStorage.getItem(greetingStorageKey)
      const state = saved ? JSON.parse(saved) as { date?: string; count?: number } : null
      const isSameDay = state?.date === today
      const nextCount = isSameDay ? (state?.count || 0) + 1 : 1
      const source = nextCount === 1 ? greetingPool.firstEntry : greetingPool.repeat
      const phrase = source[Math.floor(Math.random() * source.length)] || "Bienvenido de nuevo"
      setGreeting(phrase)
      localStorage.setItem(greetingStorageKey, JSON.stringify({ date: today, count: nextCount }))
    } catch {
      setGreeting("Bienvenido de nuevo")
    }
  }, [greetingPool, greetingStorageKey])
  const shortcuts = useMemo(() => {
    const roleShortcuts = quickAccessByRole[roleKey] || []
    const fallbackShortcuts = canAccess("laboratorio") ? quickAccessByRole.laboratorio : quickAccessByRole.administrativo
    return (roleShortcuts.length > 0 ? roleShortcuts : fallbackShortcuts).filter((shortcut) => canAccess(shortcut.module))
  }, [canAccess, roleKey])

  const recentModules = useMemo<Array<{ module: ModuleType; count: number }>>(() => {
    if (typeof window === "undefined") return []
    try {
      const freq = JSON.parse(localStorage.getItem("crm-module-frequency") || "{}") as Record<string, number>
      return Object.entries(freq)
        .filter(([module]) => module !== "home" && canAccess(module as ModuleType))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([module, count]) => ({ module: module as ModuleType, count }))
    } catch {
      return []
    }
  }, [canAccess])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="grid gap-8">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardContent className="p-6 sm:p-8">
            <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em]">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Centro de inicio
                  </Badge>
                  <Badge variant="outline" className="rounded-full px-4 py-1.5 text-[11px] font-medium bg-white">
                    {user.roleLabel || user.role}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl leading-[1.05]">
                    {greeting}, {user.name}
                  </h1>
                  <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                    Este es tu punto de partida en Geofal CRM: accede rápido a lo que usas más, revisa tu rol y entra al flujo de trabajo sin perder tiempo.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {shortcuts.map((shortcut) => (
                    <Button key={shortcut.module} onClick={() => onNavigateModule(shortcut.module)} className="rounded-full px-5">
                      {shortcut.label}
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-muted/10 p-6">
                <h2 className="text-lg font-semibold text-foreground">Acceso rápido</h2>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between rounded-full bg-background px-5 py-4 shadow-sm">
                    <span className="text-sm text-muted-foreground">Usuario</span>
                    <span className="max-w-[55%] truncate text-sm font-semibold text-foreground">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-full bg-background px-5 py-4 shadow-sm">
                    <span className="text-sm text-muted-foreground">Rol</span>
                    <span className="max-w-[55%] truncate text-sm font-semibold text-foreground">{user.roleLabel || "Sin definir"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-full bg-background px-5 py-4 shadow-sm">
                    <span className="text-sm text-muted-foreground">Última entrada</span>
                    <span className="text-sm font-semibold text-foreground">
                      {new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4 text-primary" />
              Lo más usado por ti
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentModules.length > 0 ? recentModules.map((item) => (
              <button
                key={item.module}
                onClick={() => onNavigateModule(item.module)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium text-foreground">{moduleLabelMap.get(item.module) || item.module}</p>
                  <p className="text-xs text-muted-foreground">{item.count} aperturas recientes</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )) : (
              <p className="text-sm text-muted-foreground">Aún no hay historial suficiente. Cuando uses módulos, aparecerán aquí.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" />
              Lo más usado por tu rol
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shortcuts.filter((shortcut) => canAccess(shortcut.module)).map((shortcut) => (
              <button
                key={shortcut.module}
                onClick={() => onNavigateModule(shortcut.module)}
                className="flex w-full items-center justify-between rounded-2xl border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium text-foreground">{shortcut.label}</p>
                  <p className="text-xs text-muted-foreground">Acceso recomendado para tu flujo de trabajo</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </section>

    </div>
  )
}
