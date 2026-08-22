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
  Briefcase,
  MapPin,
  Boxes,
  Building2,
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

export interface SidebarModuleGroup {
  id: string
  label: string
  icon: React.ElementType
  badge?: string
  items: SidebarModuleItem[]
  subgroups?: {
    id: string
    label: string
    icon: React.ElementType
    items: SidebarModuleItem[]
  }[]
}

// ── 1. Comercial ──────────────────────────────────────────────────
export const COMERCIAL_MODULES: SidebarModuleItem[] = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "cotizadora", label: "Cotizadora", icon: FileText },
  { id: "comercial", label: "Control Comercial", icon: ClipboardList },
]

// ── 2. Concretos ──────────────────────────────────────────────────
export const CONCRETOS_MODULES: SidebarModuleItem[] = [
  { id: "recepcion", label: "Recepción Probetas", icon: TestTube, adminOnly: true },
  { id: "ot_concreto", label: "OT Concreto", icon: FileText, adminOnly: true },
  { id: "verificacion_muestras", label: "Verificación Probetas", icon: ClipboardList, adminOnly: true },
  { id: "control_probetas", label: "Control Probetas", icon: Calendar, adminOnly: true },
  { id: "compresion", label: "F. Compresión", icon: Beaker, adminOnly: true },
  { id: "tracing", label: "Seguimiento", icon: Activity },
]

// ── 3. Lab. Lima (Control + Ensayos) ──────────────────────────────
export const LAB_LIMA_MAIN_MODULES: SidebarModuleItem[] = [
  { id: "recepcion_lima", label: "Recepción Muestras", icon: Boxes, adminOnly: true },
  { id: "datos_clientes", label: "Datos Clientes", icon: Building2 },
  { id: "ingenieria_archivos", label: "Control Informes", icon: FileText },
  { id: "laboratorio", label: "Control Laboratorio", icon: Activity },
  { id: "ot", label: "OT Muestras", icon: FileText },
  { id: "control_ambiental", label: "Temperatura / Humedad", icon: Thermometer },
  { id: "control_ambiental_balanzas", label: "Balanzas", icon: Scale },
]

export const LAB_LIMA_ENSAYOS_MODULES: SidebarModuleItem[] = [
  { id: "humedad", label: "Humedad Suelo", icon: Beaker, adminOnly: true },
  { id: "cont_humedad", label: "Humedad AG", icon: Beaker, adminOnly: true },
  { id: "cbr", label: "CBR", icon: Beaker, adminOnly: true },
  { id: "proctor", label: "Proctor", icon: Beaker, adminOnly: true },
  { id: "llp", label: "Límite", icon: Beaker, adminOnly: true },
  { id: "gran_suelo", label: "Gran Suelo", icon: Beaker, adminOnly: true },
  { id: "gran_agregado", label: "Gran Agregado", icon: Beaker, adminOnly: true },
  { id: "tamiz", label: "Malla 200", icon: Beaker, adminOnly: true },
  { id: "abra", label: "Abrasión Mayores", icon: Beaker, adminOnly: true },
  { id: "abrass", label: "Abrasión Menores", icon: Beaker, adminOnly: true },
  { id: "equi_arena", label: "E. Arena", icon: Beaker, adminOnly: true },
  { id: "caras", label: "Caras Fracturadas", icon: Beaker, adminOnly: true },
  { id: "planas", label: "Planas y Alargadas", icon: Beaker, adminOnly: true },
  { id: "angularidad", label: "Angularidad", icon: Beaker, adminOnly: true },
  { id: "peso_unitario", label: "Peso Unitario", icon: Beaker, adminOnly: true },
  { id: "ge_fino", label: "GE Fino", icon: Beaker, adminOnly: true },
  { id: "ge_grueso", label: "GE Grueso", icon: Beaker, adminOnly: true },
  { id: "cd", label: "Corte Directo", icon: Beaker, adminOnly: true },
  { id: "compresion_no_confinada", label: "C. No Confinada", icon: Beaker, adminOnly: true },
  { id: "ph", label: "PH Suelo", icon: Beaker, adminOnly: true },
  { id: "cloro_soluble", label: "Cloruro Suelo", icon: Beaker, adminOnly: true },
  { id: "sales_solubles", label: "Sales Suelo", icon: Beaker, adminOnly: true },
  { id: "sulfatos_solubles", label: "Sulfato Suelo", icon: Beaker, adminOnly: true },
  { id: "cont_mat_organica", label: "M. Orgánica", icon: Beaker, adminOnly: true },
  { id: "terrones_fino_grueso", label: "Terrones", icon: Beaker, adminOnly: true },
  { id: "azul_metileno", label: "Azul Metileno", icon: Beaker, adminOnly: true },
  { id: "part_livianas", label: "Part. Livianas", icon: Beaker, adminOnly: true },
  { id: "imp_organicas", label: "Imp. Orgánicas", icon: Beaker, adminOnly: true },
  { id: "sul_magnesio", label: "Sulf. Magnesio", icon: Beaker, adminOnly: true },
]

// ── 4. Lab. Huanta ────────────────────────────────────────────────
export const LAB_HUANTA_MODULES: SidebarModuleItem[] = [
  { id: "huanta_probetas", label: "Control Probetas", icon: Calendar },
  { id: "huanta_compresion", label: "Compresión Huanta", icon: Beaker },
  { id: "densidad_huantar", label: "Densidad Huanta", icon: Beaker },
  { id: "huanta_seguimiento", label: "Seguimiento Huanta", icon: Activity },
]

// ── 5. Estadísticas & KPIs ────────────────────────────────────────
export const SIDEBAR_KPI_MODULES: SidebarModuleItem[] = [
  { id: "estadistica_laboratorio", label: "Estadística Laboratorio", icon: FlaskConical },
  { id: "estadistica_comercial", label: "Estadística Comercial", icon: TrendingUp },
  { id: "estadistica_gerencia", label: "KPIs Administración", icon: Shield, status: "En desarrollo" },
  { id: "gerencia", label: "Gerencia", icon: BarChart3 },
]

// ── 6. Administración & Sistema ───────────────────────────────────
export const ADMIN_MODULES: SidebarModuleItem[] = [
  { id: "administracion", label: "Control Administración", icon: Shield },
  { id: "usuarios", label: "Usuarios", icon: Users, adminOnly: true },
  { id: "permisos", label: "Matriz de Permisos", icon: Shield, adminOnly: true },
  { id: "auditoria", label: "Auditoría", icon: Activity, adminOnly: true },
  { id: "configuracion", label: "Configuración", icon: Settings },
]

// ── Agrupación estructurada principal ─────────────────────────────
export const SIDEBAR_MODULE_GROUPS: SidebarModuleGroup[] = [
  {
    id: "comercial_group",
    label: "Comercial",
    icon: Briefcase,
    items: COMERCIAL_MODULES,
  },
  {
    id: "concretos_group",
    label: "Concretos",
    icon: TestTube,
    items: CONCRETOS_MODULES,
  },
  {
    id: "lab_lima_group",
    label: "Lab. Lima",
    icon: FlaskConical,
    items: LAB_LIMA_MAIN_MODULES,
    subgroups: [
      {
        id: "ensayos_subgroup",
        label: "Ensayos & Suelos",
        icon: Beaker,
        items: LAB_LIMA_ENSAYOS_MODULES,
      },
    ],
  },
  {
    id: "lab_huanta_group",
    label: "Lab. Huanta",
    icon: MapPin,
    items: LAB_HUANTA_MODULES,
  },
  {
    id: "kpi_group",
    label: "Estadísticas & KPIs",
    icon: BarChart3,
    items: SIDEBAR_KPI_MODULES,
  },
  {
    id: "admin_group",
    label: "Administración",
    icon: Shield,
    items: ADMIN_MODULES,
  },
]

// Lista plana para compatibilidad con código existente
export const SIDEBAR_MODULES: SidebarModuleItem[] = [
  ...COMERCIAL_MODULES,
  ...CONCRETOS_MODULES,
  ...LAB_LIMA_MAIN_MODULES,
  ...LAB_LIMA_ENSAYOS_MODULES,
  { id: "kanban", label: "Tableros Kanban", icon: FolderKanban },
  ...LAB_HUANTA_MODULES,
  ...ADMIN_MODULES,
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
    if (moduleId === "proyectos") continue
    if (!registeredMap.has(moduleId)) {
      registeredMap.set(moduleId, {
        id: moduleId,
        label: catItem.label,
        icon: FileText,
      })
    }
  }

  return Array.from(registeredMap.values())
}
