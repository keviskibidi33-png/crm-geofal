"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowUpRight, Clock3, LayoutGrid, Sparkles } from "lucide-react"
import type { ModuleType, User } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  administrativo: [
    { label: "Clientes", module: "clientes" },
    { label: "Proyectos", module: "proyectos" },
    { label: "Control Administración", module: "administracion" },
  ],
  tecnico: [
    { label: "Seguimiento", module: "tracing" },
    { label: "Recepción", module: "recepcion" },
    { label: "Verificación", module: "verificacion_muestras" },
  ],
}

export function DashboardHomeModule({ user, onNavigateModule }: DashboardHomeModuleProps) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"
  const roleKey = String(user.role || "").toLowerCase()
  const shortcuts = quickAccessByRole[roleKey] || quickAccessByRole.administrativo
  const moduleLabelMap = useMemo(() => {
    return new Map(PERMISSION_MODULE_CATALOG.map((item) => [item.id, item.label]))
  }, [])

  const recentModules = useMemo<Array<{ module: ModuleType; count: number }>>(() => {
    if (typeof window === "undefined") return []
    try {
      const freq = JSON.parse(localStorage.getItem("crm-module-frequency") || "{}") as Record<string, number>
      return Object.entries(freq)
        .filter(([module]) => module !== "home")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([module, count]) => ({ module: module as ModuleType, count }))
    } catch {
      return []
    }
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 xl:gap-8">
      <section className="grid gap-6 rounded-3xl border border-border bg-gradient-to-br from-white via-white to-slate-50 p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Centro de inicio
            </Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] font-medium">
              {user.roleLabel || user.role}
            </Badge>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {greeting}, {user.name}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Este es tu punto de partida en Geofal CRM: accede rápido a lo que usas más, revisa tu rol y entra al flujo de trabajo sin perder tiempo.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {shortcuts.map((shortcut) => (
              <Button key={shortcut.module} onClick={() => onNavigateModule(shortcut.module)} className="rounded-full">
                {shortcut.label}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>

        <Card className="border-border/70 bg-white/70 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acceso rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
              <span className="text-muted-foreground">Usuario</span>
              <span className="font-medium text-foreground">{user.email}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
              <span className="text-muted-foreground">Rol</span>
              <span className="font-medium text-foreground">{user.roleLabel || "Sin definir"}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-muted/40 px-4 py-3">
              <span className="text-muted-foreground">Última entrada</span>
              <span className="font-medium text-foreground">{new Date().toLocaleDateString("es-PE", { day: "2-digit", month: "long", year: "numeric" })}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70">
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

        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary" />
              Lo más usado por tu rol
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shortcuts.map((shortcut) => (
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

      <div className="flex justify-end">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          Ir al panel completo
        </Link>
      </div>
    </div>
  )
}
