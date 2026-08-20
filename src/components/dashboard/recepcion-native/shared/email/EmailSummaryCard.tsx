"use client";

import React from "react";
import { Hash, Calendar, Building2, FolderKanban } from "lucide-react";
import { formatOtDisplay } from "@/lib/utils";
import { Recepcion } from "@/hooks/use-recepciones";

interface EmailSummaryCardProps {
  recepcion: Recepcion;
}

export function EmailSummaryCard({ recepcion }: EmailSummaryCardProps) {
  const muestrasCount =
    recepcion.muestras_count ??
    (Array.isArray(recepcion.muestras) ? recepcion.muestras.length : 0);

  return (
    <div className="p-3.5 rounded-lg border bg-card/60 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 shadow-xs">
      <div className="space-y-0.5">
        <span className="text-muted-foreground flex items-center gap-1">
          <Hash className="h-3 w-3" /> N° Recepción
        </span>
        <span className="font-bold text-foreground text-sm block">
          {recepcion.numero_recepcion || "-"}
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-muted-foreground flex items-center gap-1">
          <Hash className="h-3 w-3" /> N° OT
        </span>
        <span className="font-bold text-foreground text-sm block">
          {recepcion.numero_ot ? formatOtDisplay(recepcion.numero_ot) : "-"}
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" /> F. Recepción
        </span>
        <span className="font-medium text-foreground block">
          {recepcion.fecha_recepcion || "-"}
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Muestras
        </span>
        <span className="font-bold text-blue-600 block">
          {muestrasCount} muestras
        </span>
      </div>
      <div className="col-span-2 space-y-0.5 pt-1 border-t">
        <span className="text-muted-foreground flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Cliente
        </span>
        <span className="font-bold text-foreground truncate block">
          {recepcion.cliente || "-"}
        </span>
      </div>
      <div className="col-span-2 space-y-0.5 pt-1 border-t">
        <span className="text-muted-foreground flex items-center gap-1">
          <FolderKanban className="h-3 w-3" /> Proyecto
        </span>
        <span className="font-medium text-foreground truncate block">
          {recepcion.proyecto || "-"}
        </span>
      </div>
    </div>
  );
}
