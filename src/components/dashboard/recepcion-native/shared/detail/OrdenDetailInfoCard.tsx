"use client";

import React from "react";
import { MapPin, Building2, User, Mail, Phone } from "lucide-react";
import type { RecepcionMuestraData } from "@/types/recepcion";

interface OrdenDetailInfoCardProps {
  orden: RecepcionMuestraData;
}

export function OrdenDetailInfoCard({ orden }: OrdenDetailInfoCardProps) {
  return (
    <div className="bg-card rounded-2xl border p-6 space-y-6">
      <div>
        <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
          Proyecto & Ubicación
        </h3>
        <h2 className="text-xl font-black uppercase leading-tight mb-2">
          {orden.proyecto}
        </h2>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold">{orden.ubicacion}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t">
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Building2 className="h-3 w-3" /> Datos de Facturación
          </h4>
          <p className="text-sm font-black uppercase">{orden.cliente}</p>
          <p className="text-xs font-bold text-muted-foreground uppercase">
            RUC: {orden.ruc}
          </p>
          <p className="text-xs font-bold text-muted-foreground uppercase leading-relaxed">
            {orden.domicilio_legal}
          </p>
        </div>
        <div className="space-y-3">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <User className="h-3 w-3" /> Contacto Principal
          </h4>
          <p className="text-sm font-black uppercase">
            {orden.persona_contacto || "-"}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-2 text-xs font-bold text-muted-foreground uppercase">
              <Mail className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap break-all">
                {(orden.email || "")
                  .split(/[\s,;]+/)
                  .filter(Boolean)
                  .join("\n")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
              <Phone className="h-3 w-3 text-muted-foreground" />{" "}
              {orden.telefono || "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
