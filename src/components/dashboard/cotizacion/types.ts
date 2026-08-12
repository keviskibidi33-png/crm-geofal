import type { EnsayoItem } from "@/data/ensayos-data"

export interface Quote {
  id: string
  numero: string
  year: number
  cliente: string
  monto: number
  estado: "pendiente" | "aprobada" | "rechazada" | "borrador"
  owner: string
  ownerId: string
  fecha: string
  itemsCount: number
  clienteRuc: string
  clienteEmail: string
  clienteTelefono: string
  clienteContacto: string
  proyectoNombre: string
  itemsJson: any[]
  objectKey: string
  correoVendedor?: string
  telefonoComercial?: string
  plazoDias?: number
  condicionPago?: string
  condicionesTextos?: string[]
  condicionesIds?: string[]
  clienteId?: string
  proyectoId?: string
  ubicacion?: string
}

export type QuoteItem = {
  codigo: string
  descripcion: string
  norma: string
  acreditado: string
  costo_unitario: number
  cantidad: number
  ensayoData?: EnsayoItem
}

export type Condicion = { id: string; texto: string; categoria?: string; orden?: number }

export type QuoteSource = {
  id?: string
  numero?: string | number
  year?: number
  cliente?: string
  clienteRuc?: string
  clienteContacto?: string
  clienteEmail?: string
  clienteTelefono?: string
  proyectoNombre?: string
  plazoDias?: number
  condicionPago?: string
  itemsJson?: any[]
  condicionesIds?: string[]
  condicionesTextos?: string[]
  correoVendedor?: string
  telefonoComercial?: string
  clienteId?: string
  proyectoId?: string
  ubicacion?: string
}
