"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/api-auth";
import type { RecepcionMuestraData } from "@/types/recepcion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { OrdenDetailHeader } from "./detail/OrdenDetailHeader";
import { OrdenDetailInfoCard } from "./detail/OrdenDetailInfoCard";
import { OrdenDetailSamplesTable } from "./detail/OrdenDetailSamplesTable";
import { OrdenDetailSidebar } from "./detail/OrdenDetailSidebar";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export interface OrdenDetailProps {
  recepcionId: number;
  onEdit?: () => void;
  onClose?: () => void;
  onOpenOT?: (numeroRecepcion: string, numeroOt?: string) => void;
}

export function OrdenDetail({
  recepcionId,
  onEdit,
  onClose,
  onOpenOT,
}: OrdenDetailProps) {
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

  const { data: tracingData } = useQuery({
    queryKey: ["recepcion-tracing", orden?.numero_recepcion],
    queryFn: async () => {
      if (!orden?.numero_recepcion) return null;
      const res = await authFetch(
        `${API_URL}/api/tracing/flujo/${encodeURIComponent(
          orden.numero_recepcion
        )}?_ts=${Date.now()}`,
        { cache: "no-store" }
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!orden?.numero_recepcion,
    staleTime: 0,
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
      let filename = `REC N-${
        orden.numero_recepcion || orden.numero_ot || orden.id
      } ${orden.cliente || ""}.xlsx`.trim();
      if (disposition) {
        const filenameMatch = disposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      }
      link.setAttribute("download", filename);
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
      <OrdenDetailHeader
        orden={orden}
        isDownloading={isDownloading}
        onDownloadExcel={handleDownloadExcel}
        onEdit={onEdit}
        onOpenOT={onOpenOT}
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <OrdenDetailInfoCard orden={orden} />
            <OrdenDetailSamplesTable muestras={orden.muestras} />
          </div>

          <OrdenDetailSidebar orden={orden} tracingData={tracingData} />
        </div>
      </div>
    </div>
  );
}
