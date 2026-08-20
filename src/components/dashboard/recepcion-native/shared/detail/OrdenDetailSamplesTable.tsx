"use client";

import React from "react";
import { FileText } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { RecepcionMuestraData } from "@/types/recepcion";

interface OrdenDetailSamplesTableProps {
  muestras: RecepcionMuestraData["muestras"];
}

export function OrdenDetailSamplesTable({
  muestras,
}: OrdenDetailSamplesTableProps) {
  return (
    <div className="bg-card rounded-2xl border overflow-hidden">
      <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="font-black uppercase">
          Muestras Registradas ({muestras?.length || 0})
        </h3>
      </div>
      <div className="overflow-x-auto max-h-100 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-[10px] uppercase font-black tracking-widest">
              <TableHead className="text-center w-12">N°</TableHead>
              <TableHead>Código LEM</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Estructura</TableHead>
              <TableHead className="text-center">F&apos;c</TableHead>
              <TableHead className="text-center">Fecha Moldeo</TableHead>
              <TableHead className="text-center">Hora Moldeo</TableHead>
              <TableHead className="text-center">Edad</TableHead>
              <TableHead className="text-center">Fecha Rotura</TableHead>
              <TableHead className="text-center">Densidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {muestras?.map((muestra, idx) => (
              <TableRow key={muestra.id || idx} className="hover:bg-muted/30">
                <TableCell className="text-center text-xs font-black text-muted-foreground">
                  {idx + 1}
                </TableCell>
                <TableCell className="text-xs font-black text-primary uppercase">
                  {muestra.codigo_muestra_lem || "-"}
                </TableCell>
                <TableCell className="text-xs font-black uppercase whitespace-pre-wrap">
                  {muestra.identificacion_muestra}
                </TableCell>
                <TableCell className="text-xs font-bold uppercase whitespace-pre-wrap">
                  {muestra.estructura}
                </TableCell>
                <TableCell className="text-center text-xs">
                  <span className="font-black text-amber-600">
                    {muestra.fc_kg_cm2}
                  </span>
                </TableCell>
                <TableCell className="text-center text-xs font-bold">
                  {muestra.fecha_moldeo || "-"}
                </TableCell>
                <TableCell className="text-center text-xs font-bold text-muted-foreground">
                  {muestra.hora_moldeo || "-"}
                </TableCell>
                <TableCell className="text-center text-xs font-black">
                  {muestra.edad || "-"}
                </TableCell>
                <TableCell className="text-center text-xs font-bold">
                  {muestra.fecha_rotura || "-"}
                </TableCell>
                <TableCell className="text-center text-xs font-black uppercase">
                  {muestra.requiere_densidad ? "SÍ" : "NO"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
