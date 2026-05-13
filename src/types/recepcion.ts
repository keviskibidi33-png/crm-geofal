export interface MuestraConcreto {
  id?: number;
  item_numero: number;
  codigo_muestra?: string;
  codigo_muestra_lem?: string;
  identificacion_muestra: string;
  estructura: string;
  fc_kg_cm2: number;
  fecha_moldeo: string;
  hora_moldeo?: string;
  edad: number;
  fecha_rotura: string;
  requiere_densidad: boolean;
}

export interface RecepcionMuestraData {
  id?: number;
  numero_ot: string;
  numero_recepcion: string;
  numero_cotizacion?: string;
  cliente: string;
  domicilio_legal: string;
  ruc: string;
  persona_contacto: string;
  email: string;
  telefono: string;
  solicitante: string;
  domicilio_solicitante: string;
  proyecto: string;
  ubicacion: string;
  fecha_recepcion?: string;
  fecha_estimada_culminacion?: string;
  emision_fisica: boolean;
  emision_digital: boolean;
  entregado_por?: string;
  recibido_por?: string;
  observaciones?: string;
  estado: string;
  muestras: MuestraConcreto[];
  fecha_creacion?: string;
}

export interface RecepcionFilters {
  termino: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  estado?: string;
}

export interface BackendValidationIssue {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
  ctx?: Record<string, unknown>;
}
