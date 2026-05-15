"use client"

import { CheckCircle2, Clock, Calendar } from "lucide-react"

interface EstadoDelTrabajoCardProps {
  status: "completado" | "en_proceso" | "pendiente"
  fechaRecepcion?: string
  fechaCulminacion?: string
  vencimiento?: string
  className?: string
}

export function EstadoDelTrabajoCard({
  status,
  fechaRecepcion,
  fechaCulminacion,
  vencimiento,
  className = "",
}: EstadoDelTrabajoCardProps) {
  const isCompletado = status === "completado"
  const isEnProceso = status === "en_proceso"

  const estadoTexto = isCompletado ? "COMPLETADA" : isEnProceso ? "EN PROCESO" : "PENDIENTE"

  return (
    <div className={`bg-card rounded-2xl border p-6 ${className}`}>
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
        Estado del Trabajo
      </h3>

      <div className="flex items-center gap-4 p-5 rounded-2xl bg-muted/50 border">
        {isCompletado ? (
          <CheckCircle2 className="h-10 w-10 text-green-500" />
        ) : (
          <Clock className={`h-10 w-10 text-primary ${isEnProceso ? "animate-pulse" : ""}`} />
        )}
        <div>
          <p className="text-sm font-black uppercase">{estadoTexto}</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">
            Vencimiento: {vencimiento || "---"}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Recepción
          </span>
          <span>{fechaRecepcion || "---"}</span>
        </div>
        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Est. Culminación
          </span>
          <span>{fechaCulminacion || "---"}</span>
        </div>
      </div>
    </div>
  )
}
