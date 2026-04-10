import type { ModuleType, RolePermissions } from "@/hooks/use-auth"

type ControlModuleType = Extract<ModuleType, "laboratorio" | "oficina_tecnica" | "comercial" | "administracion">

function normalizeRole(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function isAdminDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === "admin" || normalizedRole === "admin_general"
}

export function isOficinaTecnicaDashboardRole(role: string | null | undefined) {
  return normalizeRole(role).includes("oficina_tecnica")
}

export function isLaboratorioDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return (normalizedRole.includes("laboratorio") || normalizedRole.includes("tipificador")) && !normalizedRole.includes("oficina_tecnica")
}

export function isComercialDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return (
    normalizedRole.includes("comercial") ||
    normalizedRole.includes("vendor") ||
    normalizedRole.includes("vendedor") ||
    normalizedRole.includes("asesor") ||
    normalizedRole.includes("auxiliar_comercial")
  )
}

export function isAdministracionDashboardRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role)
  return normalizedRole.includes("administracion") || normalizedRole.includes("administrativo")
}

export function isControlModule(module: ModuleType): module is ControlModuleType {
  return module === "laboratorio" || module === "oficina_tecnica" || module === "comercial" || module === "administracion"
}

export function canAccessControlModule(
  module: ControlModuleType,
  role: string | null | undefined,
  permissions?: RolePermissions,
) {
  if (isAdminDashboardRole(role)) {
    return true
  }

  switch (module) {
    case "oficina_tecnica":
      return isOficinaTecnicaDashboardRole(role)
    case "laboratorio":
      return isLaboratorioDashboardRole(role)
    case "comercial":
      return isComercialDashboardRole(role) || permissions?.comercial?.read === true
    case "administracion":
      return isAdministracionDashboardRole(role) || permissions?.administracion?.read === true
    default:
      return false
  }
}

export function getPreferredControlModule(role: string | null | undefined, permissions?: RolePermissions): ControlModuleType | null {
  if (isOficinaTecnicaDashboardRole(role)) return "oficina_tecnica"
  if (isLaboratorioDashboardRole(role)) return "laboratorio"
  if (isComercialDashboardRole(role) || permissions?.comercial?.read === true) return "comercial"
  if (isAdministracionDashboardRole(role) || permissions?.administracion?.read === true) return "administracion"
  if (isAdminDashboardRole(role)) return "laboratorio"
  return null
}

export function canAccessDashboardModule(module: ModuleType, role: string | null | undefined, permissions?: RolePermissions) {
  if (module === "permisos") {
    return isAdminDashboardRole(role)
  }

  if (isControlModule(module)) {
    return canAccessControlModule(module, role, permissions)
  }

  return permissions?.[module]?.read === true
}
