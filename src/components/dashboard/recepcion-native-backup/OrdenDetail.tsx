"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSpreadsheet,
  Pencil,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Building2,
  Mail,
  Phone,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/api-auth";
import type { RecepcionMuestraData } from "@/types/recepcion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface OrdenDetailProps {
  recepcionId: number;
  onEdit?: () => void;
  onClose?: () => void;
}

export function OrdenDetail({ recepcionId, onEdit, onClose }: OrdenDetailProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    data: orden,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["recepcion-detail", recepcionId],
    queryFn: async (): Promise<RecepcionMuestraData> => {
      const res = await authFetch(`${API_URL}/api/recepcion/${recepcionId}`);
      if (!res.ok) throw new Error("Error cargando recepción");
      return res.json();
    },
    enabled: !!recepcionId,
  });

  const handleDownloadExcel = async () => {
    if (!orden || !orden.id) return;
    setIsDownloading(true);
    try {
      const res = await authFetch(`${API_URL}/api/recepcion/${orden.id}/excel`);
      if (!res.ok) throw new Error("Error al descargar Excel");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      link.setAttribute("download", filenameMatch?.[1] || `Recepcion_${orden.numero_ot}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel descargado correctamente");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error descargando Excel");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading)
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );

  if (error || !orden)
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="bg-destructive/10 text-destructive h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold mb-2">Error al cargar datos</h2>
          <p className="text-muted-foreground mb-4">
            No pudimos encontrar la recepción solicitada.
          </p>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-primary uppercase tracking-tight">
              OT: {orden.numero_ot}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExcel}
            disabled={isDownloading}
            className="gap-1"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            {isDownloading ? "Generando..." : "Exportar Excel"}
          </Button>
          {onEdit && (
            <Button variant="default" size="sm" onClick={onEdit} className="gap-1">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
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

            {/* Samples Table */}
            <div className="bg-card rounded-2xl border overflow-hidden">
              <div className="px-6 py-4 border-b bg-muted/30 flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-black uppercase">
                  Muestras Registradas ({orden.muestras?.length || 0})
                </h3>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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
                    {orden.muestras?.map((muestra, idx) => (
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border p-6">
              <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">
                Estado del Trabajo
              </h3>
              <div className="flex items-center gap-4 p-5 rounded-2xl bg-muted/50 border">
                {orden.estado === "COMPLETADA" ? (
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                ) : (
                  <Clock className="h-10 w-10 text-primary animate-pulse" />
                )}
                <div>
                  <p className="text-sm font-black uppercase">{orden.estado}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">
                    Vencimiento: {orden.fecha_estimada_culminacion || "---"}
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" /> Recepción
                  </span>
                  <span>{orden.fecha_recepcion || "---"}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" /> Est. Culminación
                  </span>
                  <span>{orden.fecha_estimada_culminacion || "---"}</span>
                </div>
              </div>
            </div>

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
                        {orden.entregado_por || "---"}
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
                        {orden.recibido_por || "---"}
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
        </div>
      </div>
    </div>
  );
}
