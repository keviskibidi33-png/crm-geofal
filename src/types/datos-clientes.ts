export interface DatosCliente {
  id: number;
  cliente: string;
  ruc: string;
  domicilio_legal: string;
  persona_contacto?: string | null;
  email?: string | null;
  telefono?: string | null;
  solicitante: string;
  domicilio_solicitante: string;
  proyecto: string;
  ubicacion: string;
  estado: "COMPLETO" | "INCOMPLETO" | string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DatosClienteFormData {
  cliente: string;
  ruc: string;
  domicilio_legal: string;
  persona_contacto: string;
  email: string;
  telefono: string;
  solicitante: string;
  domicilio_solicitante: string;
  proyecto: string;
  ubicacion: string;
}

export interface DatosClienteListResponse {
  items: DatosCliente[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
