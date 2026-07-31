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

const favoriteDefaultsByRole: Record<string, { label: string; module: ModuleType }[]> = {
  admin: quickAccessByRole.admin,
  admin_general: quickAccessByRole.admin_general,
  comercial: quickAccessByRole.comercial,
  auxiliar_comercial: quickAccessByRole.auxiliar_comercial,
  administrativo: quickAccessByRole.administrativo,
  laboratorio: quickAccessByRole.laboratorio,
  jefe_laboratorio: quickAccessByRole.jefe_laboratorio,
  laboratorio_tipificador: quickAccessByRole.laboratorio_tipificador,
  laboratorio_lector: quickAccessByRole.laboratorio_lector,
  tecnico: quickAccessByRole.tecnico,
  tecnico_suelos: quickAccessByRole.tecnico_suelos,
}

export function DashboardHomeModule({ user, onNavigateModule }: DashboardHomeModuleProps) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches"
  const roleKey = String(user.role || "").toLowerCase()
  const shortcuts = quickAccessByRole[roleKey] || (canAccess("laboratorio") ? quickAccessByRole.laboratorio : quickAccessByRole.administrativo)
  const favoriteDefaults = favoriteDefaultsByRole[roleKey] || shortcuts
  const favoriteStorageKey = `crm-home-favorites-${roleKey || "default"}`
  const [favorites, setFavorites] = useState<ModuleType[]>(() => favoriteDefaults.map((item) => item.module))
  const moduleLabelMap = useMemo(() => {
    return new Map(PERMISSION_MODULE_CATALOG.map((item) => [item.id, item.label]))
  }, [])
  const canAccess = useCallback((module: ModuleType) => {
    return canAccessDashboardModule(module, user.role, user.permissions, user.email)
  }, [user.email, user.permissions, user.role])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(favoriteStorageKey)
      if (!saved) {
        setFavorites(favoriteDefaults.map((item) => item.module))
        return
      }
      const parsed = JSON.parse(saved) as ModuleType[]
      const allowed = parsed.filter((module) => favoriteDefaults.some((item) => item.module === module))
      setFavorites(allowed.length > 0 ? allowed : favoriteDefaults.map((item) => item.module))
    } catch {
      setFavorites(favoriteDefaults.map((item) => item.module))
    }
  }, [favoriteStorageKey, favoriteDefaults])

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(favoriteStorageKey, JSON.stringify(favorites))
  }, [favoriteStorageKey, favorites])

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

  const favoriteChoices = favoriteDefaults.filter((item) => favorites.includes(item.module) && canAccess(item.module))

  const toggleFavorite = (module: ModuleType) => {
    setFavorites((current) => {
      if (current.includes(module)) {
        const next = current.filter((item) => item !== module)
        return next.length > 0 ? next : [module]
      }
      return [...current, module]
    })
  }

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
            {shortcuts.filter((shortcut) => canAccess(shortcut.module)).map((shortcut) => (
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

      <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">Tus módulos favoritos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Personaliza estos accesos según tu rol. Puedes elegir los que más uses y dejar siempre visible lo importante.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {favoriteDefaults.filter((item) => canAccess(item.module)).map((item) => {
            const active = favorites.includes(item.module)
            return (
              <Button
                key={item.module}
                type="button"
                variant={active ? "default" : "outline"}
                className={[
                  "rounded-full border-dashed bg-white",
                  active ? "" : "text-foreground hover:bg-muted/40",
                ].join(" ")}
                onClick={() => toggleFavorite(item.module)}
              >
                {item.label}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            )
          })}

          <Button
            type="button"
            variant="outline"
            className="rounded-full border-dashed bg-white text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => {
            const next = favoriteDefaults.filter((item) => canAccess(item.module)).map((item) => item.module).find((module) => !favorites.includes(module))
              if (next) toggleFavorite(next)
            }}
          >
            Agregar módulo personalizado (+)
          </Button>
        </div>

        {favoriteChoices.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Favoritos activos
            </p>
            <div className="flex flex-wrap gap-3">
              {favoriteChoices.map((item) => (
                <Button key={item.module} onClick={() => onNavigateModule(item.module)} className="rounded-full">
                  {item.label}
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
