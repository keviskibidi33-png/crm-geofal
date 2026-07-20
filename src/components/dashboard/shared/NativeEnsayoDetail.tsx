"use client"

import { useState, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { authFetch } from "@/lib/api-auth"
import type { EnsayoModuleConfig } from "./native-ensayo-config"

interface EnsayoDetail {
  id: number
  numero_ensayo?: string | null
  numero_ot?: string | null
  cliente?: string | null
  muestra?: string | null
  fecha_documento?: string | null
  estado?: string | null
  fecha_creacion?: string | null
  fecha_actualizacion?: string | null
  payload?: Record<string, unknown> | null
}

export interface NativeEnsayoDetailProps {
  ensayoId: number
  config: EnsayoModuleConfig
  apiUrl: string
  onClose: () => void
}

export function NativeEnsayoDetail({ ensayoId, config, apiUrl, onClose }: NativeEnsayoDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: [config.slug, "detail", ensayoId],
    queryFn: async () => {
      const res = await authFetch(`${apiUrl}/api/${config.slug}/${ensayoId}?_ts=${Date.now()}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load detail")
      return res.json() as Promise<EnsayoDetail>
    },
    enabled: !!ensayoId,
  })

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return "-"
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed)
  }, [])

  const formatBoolean = useCallback((value: unknown) => {
    if (value === true) return "Si"
    if (value === false) return "No"
    return "-"
  }, [])

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-xl">
        <DialogTitle>Detalle de Ensayo #{ensayoId ?? "-"}</DialogTitle>
        <DialogDescription>Informacion guardada del Ensayo {config.title}.</DialogDescription>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : data ? (
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Codigo de Muestra:</span> {data.muestra || data.cliente || "-"}</p>
            <p><span className="font-semibold">N OT:</span> {data.numero_ot || "-"}</p>
            <p><span className="font-semibold">N Ensayo:</span> {data.numero_ensayo || "-"}</p>
            <p><span className="font-semibold">Fecha:</span> {formatDate(data.fecha_documento)}</p>
            <p><span className="font-semibold">Estado:</span> {data.estado || "-"}</p>
            {data.payload && Object.entries(config.detailLabels).map(([key, label]) => {
              const value = data.payload?.[key]
              if (value === undefined || value === null) return null
              let displayValue: string
              if (typeof value === "boolean") displayValue = formatBoolean(value)
              else if (typeof value === "number") displayValue = String(value)
              else displayValue = String(value)
              return <p key={key}><span className="font-semibold">{label}:</span> {displayValue}</p>
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin detalle disponible.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
