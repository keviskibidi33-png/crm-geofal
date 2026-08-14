import * as React from "react"
import {
  Users,
  FileText,
  Settings,
  FolderKanban,
  Shield,
  Activity,
  ClipboardList,
  Calendar,
  BarChart3,
  FlaskConical,
  TrendingUp,
  Thermometer,
  Scale,
  TestTube,
  Beaker,
} from "lucide-react"
import type { ModuleType } from "@/hooks/use-auth"
import { PERMISSION_MODULE_CATALOG } from "@/lib/permission-modules"

export interface SidebarModuleItem {
  id: ModuleType
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  status?: string
}

export const SIDEBAR_MODULES: SidebarModuleItem[] = [
  { id: "tracing", label: "Seguimiento", icon: Activity },
  // { id: "comunicaciones", label: "Comunicaciones", icon: MessageSquare }, // Desactivado temporalmente hasta nuevo aviso
  { id: "kanban", label: "Tableros Kanban", icon: FolderKanban },
  { id: "ingenieria_archivos", label: "Control Informes", icon: FileText },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban },
  { id: "cotizadora", label: "Cotizadora", icon: FileText },
  { id: "ot", label: "Orden de Trabajo (OT)", icon: FileText },
  { id: "recepcion", label: "Recepciones Generales", icon: TestTube, adminOnly: true },
  { id: "verificacion_muestras", label: "Verificación Probetas", icon: ClipboardList, adminOnly: true },
  { id: "compresion", label: "F. Probetas", icon: Beaker, adminOnly: true },
  { id: "control_probetas", label: "Control Probetas", icon: Calendar, adminOnly: true },
  { id: "huanta_probetas", label: "Laboratorio Huanta", icon: Beaker, adminOnly: true },
  { id: "humedad", label: "Humedad Suelo", icon: Beaker, adminOnly: true },
  { id: "cont_humedad", label: "Humedad AG", icon: Beaker, adminOnly: true },
  { id: "cbr", label: "CBR", icon: Beaker, adminOnly: true },
  { id: "proctor", label: "Proctor", icon: Beaker, adminOnly: true },
  { id: "llp", label: "Limite", icon: Beaker, adminOnly: true },
  { id: "gran_suelo", label: "Gran Suelo", icon: Beaker, adminOnly: true },
  { id: "gran_agregado", label: "Gran Agregado", icon: Beaker, adminOnly: true },
  { id: "cont_mat_organica", label: "M. Organica", icon: Beaker, adminOnly: true },
  { id: "terrones_fino_grueso", label: "Terrones", icon: Beaker, adminOnly: true },
  { id: "azul_metileno", label: "Azul Metileno", icon: Beaker, adminOnly: true },
  { id: "part_livianas", label: "Part. Livianas", icon: Beaker, adminOnly: true },
  { id: "imp_organicas", label: "Imp. Organicas", icon: Beaker, adminOnly: true },
  { id: "sul_magnesio", label: "Sulf. Magnesio", icon: Beaker, adminOnly: true },
  { id: "angularidad", label: "Angularidad", icon: Beaker, adminOnly: true },
  { id: "abra", label: "Abrasión Mayores", icon: Beaker, adminOnly: true },
  { id: "abrass", label: "Abrasión Menores", icon: Beaker, adminOnly: true },
  { id: "peso_unitario", label: "Peso Unitario", icon: Beaker, adminOnly: true },
  { id: "tamiz", label: "Malla 200", icon: Beaker, adminOnly: true },
  { id: "planas", label: "Planas", icon: Beaker, adminOnly: true },
  { id: "caras", label: "Caras", icon: Beaker, adminOnly: true },
  { id: "equi_arena", label: "E.Arena", icon: Beaker, adminOnly: true },
  { id: "ge_fino", label: "GE Fino", icon: Beaker, adminOnly: true },
  { id: "ge_grueso", label: "GE Grueso", icon: Beaker, adminOnly: true },
  { id: "cd", label: "Corte", icon: Beaker, adminOnly: true },
  { id: "ph", label: "PH Suelo", icon: Beaker, adminOnly: true },
  { id: "cloro_soluble", label: "Cloruro Suelo", icon: Beaker, adminOnly: true },
  { id: "sales_solubles", label: "Sales Suelo", icon: Beaker, adminOnly: true },
  { id: "sulfatos_solubles", label: "Sulfato Suelo", icon: Beaker, adminOnly: true },
  { id: "compresion_no_confinada", label: "C. No Confinada", icon: Beaker, adminOnly: true },
  { id: "laboratorio", label: "Control Laboratorio", icon: Activity },
  { id: "control_ambiental", label: "Control Ambiental — Temperatura y Humedad", icon: Thermometer },
  { id: "control_ambiental_balanzas", label: "Control Ambiental — Verificación Balanzas", icon: Scale },
  { id: "comercial", label: "Control Comercial", icon: ClipboardList },
  { id: "administracion", label: "Control Administración", icon: Shield },
  { id: "usuarios", label: "Usuarios", icon: Shield, adminOnly: true },
  { id: "permisos", label: "Permisos", icon: Shield, adminOnly: true },
  { id: "auditoria", label: "Auditoría", icon: Activity, adminOnly: true },
  { id: "configuracion", label: "Configuración", icon: Settings },
]

export const SIDEBAR_KPI_MODULES: SidebarModuleItem[] = [
  { id: "estadistica_laboratorio", label: "Estadistica Laboratorio", icon: FlaskConical },
  { id: "estadistica_comercial", label: "Estadistica Comercial", icon: TrendingUp },
  { id: "estadistica_gerencia", label: "KPIs Administración", icon: Shield, status: "En desarrollo" },
  { id: "gerencia", label: "Gerencia", icon: BarChart3 },
]

/**
 * Retorna de forma dinámica TODOS los módulos disponibles en la aplicación.
 * Combina los módulos explícitos del Sidebar y auto-descubre cualquier módulo
 * registrado en PERMISSION_MODULE_CATALOG que no haya sido agregado manualmente.
 */
export function getAllAppModules(): SidebarModuleItem[] {
  const registeredMap = new Map<string, SidebarModuleItem>()

  // 1. Agregar módulos del Sidebar principales
  for (const m of SIDEBAR_MODULES) {
    registeredMap.set(m.id, m)
  }

  // 2. Agregar módulos KPI
  for (const m of SIDEBAR_KPI_MODULES) {
    registeredMap.set(m.id, m)
  }

  // 3. Auto-descubrir cualquier nuevo módulo presente en PERMISSION_MODULE_CATALOG
  for (const catItem of PERMISSION_MODULE_CATALOG) {
    const moduleId = catItem.id as ModuleType
    if (!registeredMap.has(moduleId)) {
      registeredMap.set(moduleId, {
        id: moduleId,
        label: catItem.label,
        icon: FileText, // Icono dinámico por defecto
      })
    }
  }

  return Array.from(registeredMap.values())
}
