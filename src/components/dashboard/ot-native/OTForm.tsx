"use client"

import { OTConcretoForm } from "./OTConcretoForm"
import { OTSueloAgregadoForm } from "./OTSueloAgregadoForm"

export { OTConcretoForm } from "./OTConcretoForm"
export { OTSueloAgregadoForm } from "./OTSueloAgregadoForm"
export { OTMuestrasItemList, itemsToCards, cardsToItems, type OTMuestraCard } from "./OTMuestrasItemList"

export interface OTItem {
  item: number
  codigo_muestra: string
  codigo_ensayo?: string | null
  descripcion: string
  norma?: string | null
  cantidad: number | string
  // Columnas específicas de OT Concreto
  elemento?: string | null
  fecha_rotura?: string | null
  densidad?: string | null
  edad?: number | string | null
  fc_kg_cm2?: number | string | null
  // Metadatos de muestra
  identificacion?: string | null
  procedencia?: string | null
  cantera?: string | null
  cantidad_kg?: string | null
}

export interface OTData {
  id?: number
  numero_ot: string
  numero_recepcion?: string | null
  referencia?: string | null
  cliente?: string | null
  proyecto?: string | null
  fecha_recepcion?: string | null
  plazo_entrega_dias?: string | null
  inicio_programado?: string | null
  fin_programado?: string | null
  inicio_real?: string | null
  fin_real?: string | null
  variacion_inicio?: string | null
  variacion_fin?: string | null
  duracion_real_ejecucion_dias?: string | null
  observaciones?: string | null
  ot_aperturada_por?: string | null
  ot_designada_a?: string | null
  items: OTItem[]
  estado?: string
  tipo?: string | null
}

export interface OTFormProps {
  initialData?: OTData | null
  initialNumeroRecepcion?: string | null
  tipo?: "CONCRETO" | "MUESTRAS" | "AUTO"
  onSuccess: () => void
  onCancel: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

/**
 * Componente despachador de Orden de Trabajo (OT).
 * Enruta automáticamente al formulario dedicado según el tipo:
 * - OTConcretoForm (F-LEM-P-02.01, MYP) para Concreto / Probetas
 * - OTSueloAgregadoForm (F-LEM-P-02.03, HOJA 1 (2)) para Suelo y Agregado / Ensayos
 */
export function OTForm({
  initialData,
  initialNumeroRecepcion,
  tipo = "AUTO",
  onSuccess,
  onCancel,
  onDirtyChange,
}: OTFormProps) {
  // Determinar si es Concreto
  const isConcreto =
    tipo === "CONCRETO"
      ? true
      : tipo === "MUESTRAS"
      ? false
      : initialData?.items?.some(
          (it) =>
            (it.fc_kg_cm2 !== undefined && it.fc_kg_cm2 !== null && it.fc_kg_cm2 !== "") ||
            (it.elemento && it.elemento !== "-") ||
            String(it.codigo_muestra || "").toUpperCase().includes("CO") ||
            (it.descripcion && String(it.descripcion).toUpperCase().includes("COMPRESION"))
        ) ?? true

  const formKey = `${initialData?.id ?? "new"}-${initialNumeroRecepcion ?? ""}`

  if (isConcreto) {
    return (
      <OTConcretoForm
        key={formKey}
        initialData={initialData}
        initialNumeroRecepcion={initialNumeroRecepcion}
        onSuccess={onSuccess}
        onCancel={onCancel}
        onDirtyChange={onDirtyChange}
      />
    )
  }

  return (
    <OTSueloAgregadoForm
      key={formKey}
      initialData={initialData}
      initialNumeroRecepcion={initialNumeroRecepcion}
      onSuccess={onSuccess}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  )
}
