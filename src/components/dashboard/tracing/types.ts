import type { TracingData as BaseTracingData, TracingSummary as BaseTracingSummary } from "@/hooks/use-tracing"

export interface ExtendedTracingData extends Partial<BaseTracingData> {
  numero_recepcion?: string
  cliente?: string
  proyecto?: string
  recepcion?: any
  verificacion?: any
  ensayo_compresion?: any
  ensayos?: any[]
}

export interface ExtendedTracingSummary extends Partial<BaseTracingSummary> {
  numero_recepcion: string
  cliente?: string
  proyecto?: string
  recepcion_completada?: boolean
  verificacion_completada?: boolean
  ensayo_compresion_completado?: boolean
  muestras_ensayadas_count?: number
}

export interface TracingRecord {
  numero_recepcion: string
  cliente?: string
  proyecto?: string
  fecha_recepcion?: string
  estado_general?: string
  muestras_count?: number
  ensayos_count?: number
}
