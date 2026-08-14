import type { ModuleType, RolePermissions } from "@/hooks/use-auth"
import { normalizeRoleId } from "@/lib/role-utils"

type ControlModuleType = Extract<ModuleType, "laboratorio" | "comercial" | "administracion">

const RESTRICTED_TECHNICAL_DASHBOARD_MODULES = new Set<ModuleType>([
  "clientes",
  "cotizadora",
  "programacion",
])

const COMMERCIAL_BUSINESS_MODULES = new Set<ModuleType>([
  "clientes",
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

export function isGerenciaDashboardRole(role: string | null | undefined) {
  return normalizeRole(role).includes("gerencia")
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

export function canAccessDashboardModule(
  module: ModuleType,
  role: string | null | undefined,
  permissions?: RolePermissions,
  email?: string,
) {
  if (module === "home") {
    return true
  }

  if ((module as string) === "proyectos") {
    return false
  }

  // Restricción por correo exacto para 'ejecutivocomercial2@geofal.com.pe' y alias
  const RESTRICTED_CLIENTES_EMAILS = [
    "ejecutivocomercial2@geofal.com.pe",
    "asesorcomercial2@geofal.com.pe",
  ]
  const normalizedUserEmail = (email || "").toLowerCase().trim()
  if (RESTRICTED_CLIENTES_EMAILS.includes(normalizedUserEmail) && module === "clientes") {
    return false
  }

  // Restrict specific user 'techuant@geofal.com.pe' to only Huanta modules and configuracion
  if (email && email.toLowerCase() === "techuant@geofal.com.pe") {
    const isHuantaModule = 
      module === "densidad_huantar" || 
      module === "huanta_probetas" || 
      module === "huanta_compresion" || 
      module === "huanta_seguimiento";
    
    if (module === "configuracion") return true;
    return isHuantaModule;
  }

  let activeCheckModule = module;
  if (module === "huanta_probetas" || module === "huanta_compresion" || module === "huanta_seguimiento") {
    activeCheckModule = "densidad_huantar";
  }

const KPI_AUTHORIZED_IDENTITIES = ["irma.coaquira", "irma", "fabian", "labprueba"]
const LAB_KPI_AUTHORIZED_IDENTITIES = ["bethazabet", "betha"]

function isKpiAuthorizedEmail(email?: string) {
  if (!email) return false
  const norm = email.toLowerCase().trim()
  return KPI_AUTHORIZED_IDENTITIES.some((id) => norm.includes(id))
}

function isLabKpiAuthorizedEmail(email?: string) {
  if (!email) return false
  const norm = email.toLowerCase().trim()
  return isKpiAuthorizedEmail(email) || LAB_KPI_AUTHORIZED_IDENTITIES.some((id) => norm.includes(id))
}

  if (activeCheckModule === "configuracion" || activeCheckModule === "comunicaciones") {
    return true
  }

  if (activeCheckModule === "control_ambiental" || activeCheckModule === "control_ambiental_balanzas") {
    if (email) {
      const normEmail = email.toLowerCase().trim()
      if (
        normEmail === "tecnico3@geofal.com.pe" ||
        normEmail === "sig@geofal.com.pe" ||
        normEmail.includes("beatriz")
      ) {
        return true
      }
    }
    const normalizedRole = normalizeRole(role)
    return normalizedRole === "admin" || normalizedRole === "admin_general" || normalizedRole === "jefe_laboratorio"
  }

  if (activeCheckModule === "estadistica_laboratorio") {
    if (isComercialDashboardRole(role)) return false
    const normRole = normalizeRole(role)
    return isAdminDashboardRole(role)
      || normRole === "jefe_laboratorio"
      || isLabKpiAuthorizedEmail(email)
      || permissions?.estadistica_laboratorio?.read === true
  }

  if (activeCheckModule === "estadistica_comercial") {
    if (isComercialDashboardRole(role)) return false
    const normRole = normalizeRole(role)
    if (normRole === "jefe_laboratorio") return false
    return isAdminDashboardRole(role)
      || isGerenciaDashboardRole(role)
      || isKpiAuthorizedEmail(email)
      || permissions?.estadistica_comercial?.read === true
  }

  if (activeCheckModule === "estadistica_gerencia") {
    if (isComercialDashboardRole(role)) return false
    const normRole = normalizeRole(role)
    if (normRole === "jefe_laboratorio") return false
    return isAdminDashboardRole(role)
      || isGerenciaDashboardRole(role)
      || isKpiAuthorizedEmail(email)
      || permissions?.estadistica_gerencia?.read === true
  }

  if (activeCheckModule === "gerencia") {
    if (isComercialDashboardRole(role)) return false
    const normRole = normalizeRole(role)
    if (normRole === "jefe_laboratorio") return false
    return isAdminDashboardRole(role)
      || isGerenciaDashboardRole(role)
      || isKpiAuthorizedEmail(email)
      || permissions?.gerencia?.read === true
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
