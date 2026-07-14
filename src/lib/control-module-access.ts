import type { ModuleType, RolePermissions } from "@/hooks/use-auth"
import { normalizeRoleId } from "@/lib/role-utils"

type ControlModuleType = Extract<ModuleType, "laboratorio" | "comercial" | "administracion">

const RESTRICTED_TECHNICAL_DASHBOARD_MODULES = new Set<ModuleType>([
  "clientes",
  "proyectos",
  "cotizadora",
  "programacion",
])

const COMMERCIAL_BUSINESS_MODULES = new Set<ModuleType>([
  "clientes",
  "proyectos",
  "cotizadora",
])

function normalizeRole(value: string | null | undefined) {
  return normalizeRoleId(value)
}

export function isAdminDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === "admin" || normalizedRole === "admin_general"
}

export function isLaboratorioDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return (normalizedRole.includes("laboratorio") || normalizedRole.includes("tipificador")) && !normalizedRole.includes("oficina_tecnica")
}

export function isComercialDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === "auxiliar_comercial"
}

export function isLaboratoryNotificationsRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === "jefe_laboratorio" || normalizedRole === "laboratorio_tipificador"
}

export function isAdministracionDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole.includes("administracion") || normalizedRole.includes("administrativo")
}

const CONTROL_ACCESS_BLOCKED_ROLES = new Set(["tecnico", "tecnico_suelos"])

export function isRestrictedTechnicalRole(role: string | null | undefined) {
  return CONTROL_ACCESS_BLOCKED_ROLES.has(normalizeRole(role))
}

export function isControlModule(module: ModuleType): module is ControlModuleType {
  return module === "laboratorio" || module === "comercial" || module === "administracion"
}

export function canAccessControlModule(
  module: ControlModuleType,
  role: string | null | undefined,
  permissions?: RolePermissions,
) {
  if (isRestrictedTechnicalRole(role)) {
    return false
  }

  if (isAdminDashboardRole(role)) {
    return true
  }

  if (module === "laboratorio" && isComercialDashboardRole(role)) {
    return false
  }

  switch (module) {
    case "laboratorio":
      return isLaboratorioDashboardRole(role) || permissions?.laboratorio?.read === true
    case "comercial":
      return isComercialDashboardRole(role)
    case "administracion":
      return isAdministracionDashboardRole(role)
    default:
      return false
  }
}

export function getPreferredControlModule(role: string | null | undefined, permissions?: RolePermissions): ControlModuleType | null {
  if (isRestrictedTechnicalRole(role)) {
    return null
  }

  if (isComercialDashboardRole(role)) return "comercial"
  if (isLaboratorioDashboardRole(role) || permissions?.laboratorio?.read === true) return "laboratorio"
  if (permissions?.comercial?.read === true) return "comercial"
  if (isAdministracionDashboardRole(role) || permissions?.administracion?.read === true) return "administracion"
  if (isAdminDashboardRole(role)) return "laboratorio"
  return null
}

export function canAccessDashboardModule(module: ModuleType, role: string | null | undefined, permissions?: RolePermissions) {
  let activeCheckModule = module;
  if (module === "huanta_probetas" || module === "huanta_compresion" || module === "huanta_seguimiento") {
    activeCheckModule = "densidad_huantar";
  }

  if (activeCheckModule === "configuracion") {
    return true
  }

  if (activeCheckModule === "permisos") {
    return isAdminDashboardRole(role)
  }

  if (activeCheckModule === "laboratorio" && isComercialDashboardRole(role)) {
    return false
  }

  const explicitRead = permissions?.[activeCheckModule]?.read === true
  if (explicitRead) {
    return true
  }

  if (isRestrictedTechnicalRole(role) && RESTRICTED_TECHNICAL_DASHBOARD_MODULES.has(activeCheckModule)) {
    return false
  }

  if (isControlModule(activeCheckModule)) {
    return canAccessControlModule(activeCheckModule, role, permissions)
  }

  if (COMMERCIAL_BUSINESS_MODULES.has(activeCheckModule)) {
    return isAdminDashboardRole(role) || isComercialDashboardRole(role)
  }

  return false
}
