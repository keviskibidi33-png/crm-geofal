"use client";

import React from "react";
import { Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EstadoDelTrabajoCard } from "@/components/dashboard/shared/EstadoDelTrabajoCard";
import { TimelineEtapas } from "@/components/dashboard/shared/TimelineEtapas";
import type { RecepcionMuestraData } from "@/types/recepcion";

interface OrdenDetailSidebarProps {
  orden: RecepcionMuestraData;
  tracingData: any;
}

export function OrdenDetailSidebar({
  orden,
  tracingData,
}: OrdenDetailSidebarProps) {
  const currentStatus = tracingData?.stages?.every(
    (s: any) => s.status === "completado"
  )
    ? "completado"
    : tracingData?.stages?.some(
        (s: any) => s.status === "en_proceso" || s.status === "completado"
      )
    ? "en_proceso"
    : "pendiente";

  return (
    <div className="space-y-6">
      <EstadoDelTrabajoCard
        status={currentStatus}
        fechaRecepcion={orden.fecha_recepcion}
        fechaCulminacion={orden.fecha_estimada_culminacion}
        vencimiento={orden.fecha_estimada_culminacion}
      />

      <TimelineEtapas stages={tracingData?.stages} />

      <div className="bg-card rounded-2xl border p-6 space-y-6">
        <div>
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">
            Personal Responsable
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-black text-xs">
                EP
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">
                  Entregado por
                </p>
                <p className="text-sm font-black uppercase">
                  {orden.entregado_por || "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                RP
              </div>
              <div>
                <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">
                  Recibido por
                </p>
                <p className="text-sm font-black uppercase">
                  {orden.recibido_por || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t">
          <h3 className="text-[10px] font-black uppercase tracking-widest mb-3">
            Canales de Informe
          </h3>
          <div className="flex flex-wrap gap-2">
            {orden.emision_digital && (
              <Badge variant="secondary" className="gap-1">
                <Download className="h-3 w-3" /> Digital
              </Badge>
            )}
            {orden.emision_fisica && (
              <Badge variant="outline" className="gap-1">
                <Printer className="h-3 w-3" /> Físico
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
