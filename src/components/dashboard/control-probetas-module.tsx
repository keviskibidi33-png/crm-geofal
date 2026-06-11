"use client"

import { useMemo } from "react"
import { BarChart3, Calendar, ArrowRight, CheckCircle2, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ControlProbetasModuleProps {
  user: any
  onNavigateModule: (module: any, recordId: number | null) => void
}

export function ControlProbetasModule({ onNavigateModule }: ControlProbetasModuleProps) {
  const stats = useMemo(
    () => [
      { label: "Recepciones activas", value: "—", icon: ClipboardList },
      { label: "Probetas ensayadas", value: "—", icon: CheckCircle2 },
      { label: "Informes listos", value: "—", icon: BarChart3 },
    ],
    []
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-[#f8fafc] p-6">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Control de Probetas</h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Dashboard previo de control y trazabilidad de probetas con recepción como eje central.
          </p>
        </div>
        <Button
          onClick={() => onNavigateModule("control_probetas_nativo", null)}
          className="h-10 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-700"
        >
          Abrir Nativo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.label} className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{card.label}</p>
                  <p className="mt-1 text-2xl font-black text-slate-900">{card.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-900">Vista previa del módulo</p>
            <p className="text-xs text-slate-500">
              Aquí luego podemos poner filtros, KPIs y acceso rápido antes de entrar a la grilla operativa.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => onNavigateModule("control_probetas_nativo", null)}
            className="h-9 border-slate-200 bg-white text-xs font-bold"
          >
            Ir a tabla nativa
            <Calendar className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
