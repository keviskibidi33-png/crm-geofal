"use client";

import React from "react";
import { FileSpreadsheet, Pencil, FileText } from "lucide-react";
import { formatOtDisplay } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RecepcionMuestraData } from "@/types/recepcion";

interface OrdenDetailHeaderProps {
  orden: RecepcionMuestraData;
  isDownloading: boolean;
  onDownloadExcel: () => void;
  onEdit?: () => void;
  onOpenOT?: (numeroRecepcion: string, numeroOt?: string) => void;
}

export function OrdenDetailHeader({
  orden,
  isDownloading,
  onDownloadExcel,
  onEdit,
  onOpenOT,
}: OrdenDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30 shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-black text-primary uppercase tracking-tight">
            OT: {formatOtDisplay(orden.numero_ot)}
          </h1>
          <Badge
            variant={orden.estado === "COMPLETADA" ? "default" : "secondary"}
            className="text-[10px] font-black uppercase tracking-widest"
          >
            {orden.estado}
          </Badge>
        </div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
          Recepción: {orden.numero_recepcion}
        </p>
      </div>
      <div className="flex gap-2">
        {onOpenOT && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenOT(orden.numero_recepcion, orden.numero_ot)}
            className="gap-1.5 border-sky-300 text-sky-700 bg-sky-50 hover:bg-sky-100 font-bold cursor-pointer"
          >
            <FileText className="h-4 w-4 text-sky-600" />
            {orden.numero_ot
              ? `Ver/Editar OT (${formatOtDisplay(orden.numero_ot)})`
              : "Crear OT"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onDownloadExcel}
          disabled={isDownloading}
          className="gap-1 cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          {isDownloading ? "Generando..." : "Exportar Excel"}
        </Button>
        {onEdit && (
          <Button variant="default" size="sm" onClick={onEdit} className="gap-1 cursor-pointer">
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}
