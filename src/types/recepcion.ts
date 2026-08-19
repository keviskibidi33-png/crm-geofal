export interface MuestraConcreto {
  id?: number;
  item_numero: number;
  codigo_muestra?: string;
  codigo_muestra_lem?: string;
  identificacion_muestra: string;
  estructura?: string;
  fc_kg_cm2?: number | null;
  fecha_moldeo?: string;
  hora_moldeo?: string;
  edad?: number | null;
  fecha_rotura?: string;
  requiere_densidad?: boolean;
  tamano_peso?: string;
  procedencia?: string;
  cantera?: string;
  descripcion_muestra?: string;
  cantidad?: string;
  codigo_ensayo?: string;
  ensayos_requeridos?: string;
  norma_requerida?: string;
  ensayos_json?: string;
  ensayos_lista?: Array<{ codigo?: string; descripcion?: string; norma?: string }>;
}

export interface RecepcionMuestraData {
  id?: number;
  numero_ot: string;
  numero_recepcion: string;
  numero_cotizacion?: string;
  tipo_recepcion?: string;
  codigo_laboratorio?: string;
  version?: string;
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
  tipo_recepcion?: string;
}

export interface BackendValidationIssue {
  loc?: (string | number)[];
  msg?: string;
  type?: string;
  ctx?: Record<string, unknown>;
}

export const TIPO_RECEPCION_CONFIG: Record<string, { label: string; codigo: string; version: string; template: string }> = {
  CONCRETO: {
    label: "CONCRETO (F-LEM-P-01.02 V07)",
    codigo: "F-LEM-P-01.02",
    version: "07",
    template: "F-LEM-P-01.02 V07 RECEPCIÓN CONCRETO.xls",
  },
  ROCA: {
    label: "ROCA (F-LEM-P-01.04 V05)",
    codigo: "F-LEM-P-01.04",
    version: "05",
    template: "F-LEM-P-01.04 V05 RECEPCIÓN DE MUESTRAS DE ROCA.XLSX",
  },
  ALBANILERIA: {
    label: "ALBAÑILERÍA (F-LEM-P-01.05 V04)",
    codigo: "F-LEM-P-01.05",
    version: "04",
    template: "F-LEM-P-01.05 V04 RECEPCIÓN DE MUESTRAS DE ALBAÑILERIA.xlsx",
  },
  AGUA: {
    label: "AGUA (F-LEM-P-01.06 V04)",
    codigo: "F-LEM-P-01.06",
    version: "04",
    template: "F-LEM-P-01.06 V04 RECEPCIÓN DE MUESTRAS DE AGUA.xlsx",
  },
  SUELO_AGREGADO: {
    label: "SUELO Y AGREGADO (F-LEM-P-01.13 V01)",
    codigo: "F-LEM-P-01.13",
    version: "01",
    template: "F-LEM-P-01.13 V01 RECEP. SU Y AG.XLSX",
  },
};
