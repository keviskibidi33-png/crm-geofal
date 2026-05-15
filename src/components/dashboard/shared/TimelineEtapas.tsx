"use client"

import { CheckCircle2, Clock } from "lucide-react"

interface Stage {
  name: string
  key: string
  status: "pendiente" | "en_proceso" | "completado" | "por_implementar"
  message?: string
  date?: string
}

interface TimelineEtapasProps {
  stages?: Stage[]
  loading?: boolean
  className?: string
}

export function TimelineEtapas({ stages, loading = false, className = "" }: TimelineEtapasProps) {
  return (
    <div className={`bg-card rounded-2xl border p-6 ${className}`}>
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
        Seguimiento de Etapas
      </h3>

      <div className="relative">
        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200" />

        <div className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-4">Cargando seguimiento...</div>
          ) : stages && stages.length > 0 ? (
            stages.map((stage, index) => (
              <div key={stage.key || index} className="flex items-start gap-4 relative">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                    stage.status === "completado"
                      ? "bg-green-100 text-green-600"
                      : stage.status === "en_proceso"
                      ? "bg-yellow-100 text-yellow-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {stage.status === "completado" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : stage.status === "en_proceso" ? (
                    <Clock className="h-5 w-5" />
                  ) : (
                    <div className="h-3 w-3 rounded-full bg-current" />
                  )}
                </div>
                <div className="flex-1 pt-1.5">
                  <p className="text-sm font-semibold">{stage.name}</p>
                  {stage.message && (
                    <p className="text-xs text-muted-foreground">{stage.message}</p>
                  )}
                  {stage.date && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stage.date}</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              No hay información de seguimiento disponible
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
