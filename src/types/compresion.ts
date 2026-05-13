export interface CompresionItem {
  id?: number
  item: number
  codigo_lem: string
  fecha_ensayo_programado?: string | null // ISO yyyy-mm-dd
  fecha_ensayo?: string | null
  hora_ensayo?: string | null
  carga_maxima?: number | null
  tipo_fractura?: string | null
  defectos?: string | null
  defectos_custom?: string | null
  diametro?: number | null
  area?: number | null
  realizado?: string | null
  revisado?: string | null
  fecha_revisado?: string | null
  aprobado?: string | null
  fecha_aprobado?: string | null
}

export interface CompresionEnsayo {
  id?: number
  numero_ot: string
  numero_recepcion: string
  recepcion_id?: number | null
  codigo_equipo?: string | null
  otros?: string | null
  nota?: string | null
  estado?: string
  realizado_por?: string | null
  revisado_por?: string | null
  aprobado_por?: string | null
  items: CompresionItem[]
  fecha_creacion?: string
  fecha_actualizacion?: string
}

export interface CompresionEnsayoListItem {
  id: number
  numero_ot: string
  numero_recepcion: string
  recepcion_id?: number
  estado: string
  fecha_creacion: string
  items_count?: number
}
