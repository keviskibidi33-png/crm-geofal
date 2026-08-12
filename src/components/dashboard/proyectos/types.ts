export interface Project {
  id: string
  nombre: string
  cliente: string
  clienteId: string
  cotizaciones: number
  estado:
    | "prospecto"
    | "en_negociacion"
    | "propuesta_enviada"
    | "venta_ganada"
    | "venta_perdida"
    | "en_ejecucion"
    | "completado"
    | "archivado"
  etapa: "pipeline" | "ventas" | "perdidas" | "archivados" | "ventas_archivadas"
  fechaInicio: string
  fechaFin: string
  fechaCierre?: string
  fechaCreacion: string
  presupuesto: number
  montoTotal: number
  montoAprobado: number
  montoFinal?: number
  progreso: number
  motivoPerdida?: "competencia" | "precio" | "timing" | "sin_respuesta" | "cancelado_cliente" | "otro"
  notasCierre?: string
  vendedor?: string
  responsable?: string
  descripcion?: string
  ubicacion?: string
  empresa?: string
  contactoNombre?: string
  contactoCargo?: string
  contactoEmail?: string
  contactoTelefono?: string
  contactoPrincipalId?: string
  ruc?: string
}

export interface DbProjectRow {
  id: string
  nombre: string
  descripcion: string | null
  cliente_id: string
  ubicacion: string | null
  direccion: string | null
  vendedor_id: string
  estado: string
  etapa: string
  presupuesto: number
  progreso: number
  fecha_inicio: string | null
  fecha_fin: string | null
  motivo_perdida: string | null
  created_at: string
  contacto_principal_id: string | null
  clientes?: { nombre: string; empresa: string; ruc: string }
  cotizaciones?: Array<{ total: number | null; estado: string | null }>
  contactos?: { nombre: string | null; cargo: string | null; email: string | null; telefono: string | null } | null
}

export type ProjectQuoteHistoryRow = {
  id: string
  numero: string
  year: number
  total: number | null
  estado: string | null
  fecha_emision: string | null
  created_at: string
  object_key: string | null
  proyecto: string | null
  proyecto_id: string | null
}
