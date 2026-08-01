"use client"

import { ArrowRight, BarChart3, Construction, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"

interface AdministracionKpisDevelopmentProps {
  onOpenGerencia: () => void
}

const MIGRATED_DASHBOARDS = [
  "Ingreso de trabajo por recepción",
  "Evidencia de recepciones",
  "Número de clientes",
  "KPI ticket promedio",
]

export function AdministracionKpisDevelopment({ onOpenGerencia }: AdministracionKpisDevelopmentProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">KPIs Administración</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Vista conservada para el desarrollo de futuros indicadores administrativos.
        </p>
      </div>

      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            <Construction className="size-8" />
          </div>
          <span className="mt-5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700">
            En desarrollo
          </span>
          <h3 className="mt-4 text-2xl font-bold text-slate-950">Panel administrativo en preparación</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Los indicadores gerenciales ya fueron organizados en el nuevo módulo Gerencia. Esta vista permanece disponible para incorporar exclusivamente los próximos KPIs de Administración.
          </p>

          <div className="mt-6 grid w-full gap-3 text-left sm:grid-cols-2">
            {MIGRATED_DASHBOARDS.map((dashboard) => (
              <div key={dashboard} className="flex items-center gap-3 rounded-lg border bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <BarChart3 className="size-4 shrink-0 text-blue-600" />
                {dashboard}
              </div>
            ))}
          </div>

          <Button type="button" className="mt-7 gap-2" onClick={onOpenGerencia}>
            <Shield className="size-4" />
            Abrir Gerencia
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>
    </div>
  )
}
