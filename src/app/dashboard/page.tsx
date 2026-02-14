"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { verifySessionConsistencyAction } from "@/app/actions/verify-session"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { ClientesModule } from "@/components/dashboard/clientes-module"
import { CotizadoraModule } from "@/components/dashboard/cotizadora-module"
import { ConfiguracionModule } from "@/components/dashboard/configuracion-module"
import { UsuariosModule } from "@/components/dashboard/usuarios-module"
import { ProyectosModule } from "@/components/dashboard/proyectos-module"
import { AuditoriaModule } from "@/components/dashboard/auditoria-module"
import { ProgramacionModule } from "@/components/dashboard/programacion-module"
import { VerificacionMuestrasModule } from "@/components/dashboard/verificacion-muestras-module"
import { CompresionModule } from "@/components/dashboard/compresion-module"
import { LaboratorioModule } from "@/components/dashboard/laboratorio-module"
import { RecepcionModule } from "@/components/dashboard/recepcion-module"
import { ComercialModule } from "@/components/dashboard/comercial-module"
import { AdministracionModule } from "@/components/dashboard/administracion-module"
import { TracingModule } from "@/components/dashboard/tracing-module"
import { HumedadModule } from "@/components/dashboard/humedad-module"
import { RoleGuard } from "@/components/dashboard/role-guard"
import { PermisosModule } from "@/components/dashboard/permisos-module"
import { SessionTerminatedDialog } from "@/components/dashboard/session-terminated-dialog"
import { useAuth, type User, type UserRole, type ModuleType } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("crm-active-module") as ModuleType
      return saved || "clientes"
    }
    return "clientes"
  })
  const { user, loading, isSessionTerminated, signOut } = useAuth()
  const [securityViolation, setSecurityViolation] = useState(false)
  const router = useRouter()


  useEffect(() => {
    localStorage.setItem("crm-active-module", activeModule)
    // console.log('[CRM] Nuevo valor de activeModule:', activeModule) // Cleaned log
  }, [activeModule])

  useEffect(() => {
    // Only redirect if NOT loading, and NO user, and session is NOT terminated
    if (!loading && !user && !isSessionTerminated) {
      // Grace period: Wait 2s to see if a termination event comes in via Realtime
      const timer = setTimeout(() => {
        // Double check session status inside timeout
        if (!isSessionTerminated) {
          router.push("/login")
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [user, loading, router, isSessionTerminated])

  // Handle module authorization and security checks
  useEffect(() => {
    if (loading || !user) return;

    const role = user.role?.toLowerCase() || "";

    // 1. Administrators have absolute access - never redirect them
    if (role === 'admin' || role === 'admin_general') {
      return;
    }

    // 2. For other roles, check against their granted permissions
    const hasPermission = user.permissions && user.permissions[activeModule]?.read;

    if (!hasPermission) {
      // Choose a smart default based on role
      const getRoleDefault = (): ModuleType => {
        if (role.includes('laboratorio')) return 'laboratorio';
        if (role.includes('comercial') || role.includes('vendedor') || role.includes('vendor') || role.includes('asesor')) return 'comercial';
        if (role.includes('administracion')) return 'administracion';
        return 'clientes';
      }

      const defaultModule = getRoleDefault();

      // Only set if different to avoid potential state loops
      if (activeModule !== defaultModule) {
        console.log(`[Auth] Seguridad: Usuario rol "${role}" intentó acceder a "${activeModule}" sin permiso. Redirigiendo a "${defaultModule}".`);
        setActiveModule(defaultModule);
      }
    }
  }, [loading, user?.id, activeModule]); // Watch activeModule for security

  // Session Consistency Check (Security)
  useEffect(() => {
    if (!loading && user) {
      verifySessionConsistencyAction(user.id).then((result) => {
        if (result && !result.isValid) {
          // If mismatch is detected, show modal instead of redirecting immediately
          setSecurityViolation(true)
        }
      })
    }
  }, [loading, user])

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    )
  }

  if (!user && !isSessionTerminated) return null

  // If session is terminated but user is cleared, show ONLY the termination dialog (and maybe a blurred background)
  if (!user && isSessionTerminated) {
    return (
      <div className="h-screen w-full bg-background/90 backdrop-blur-sm flex items-center justify-center">
        <SessionTerminatedDialog
          open={true}
          onConfirm={signOut}
        />
      </div>
    )
  }

  if (!user) return null // Should be unreachable given prior checks, but satisfies TS

  const dashboardUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel,
    avatar: user.avatar || "/professional-man-avatar.png",
    phone: user.phone || "",
    permissions: user.permissions
  } as any

  const renderModule = () => {
    // console.log('[CRM] Renderizando módulo:', activeModule) // Cleaned log
    switch (activeModule) {
      case "clientes":
        return <ClientesModule user={dashboardUser} />
      case "proyectos":
        return <ProyectosModule user={dashboardUser} />
      case "cotizadora":
        return <CotizadoraModule user={dashboardUser} />
      case "programacion":
        return <ProgramacionModule user={dashboardUser} />
      case "laboratorio":
        return <LaboratorioModule user={dashboardUser} />
      case "recepcion":
        return <RecepcionModule />
      case "comercial":
        return <ComercialModule user={dashboardUser} />
      case "administracion":
        return <AdministracionModule user={dashboardUser} />
      case "usuarios":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin"]}>
            <UsuariosModule />
          </RoleGuard>
        )
      case "permisos":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin"]}>
            <PermisosModule />
          </RoleGuard>
        )
      case "auditoria":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin"]}>
            <AuditoriaModule user={dashboardUser} />
          </RoleGuard>
        )
      case "verificacion_muestras":
        return <VerificacionMuestrasModule />
      case "compresion":
        return <CompresionModule />
      case "configuracion":
        return <ConfiguracionModule />
      case "tracing":
        return <TracingModule />
      case "humedad":
        return <HumedadModule />
      default:
        console.warn('[CRM] Modulo no reconocido:', activeModule)
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <h2 className="text-xl font-bold">Módulo no encontrado</h2>
            <p>El módulo "{activeModule}" no está configurado o no existe.</p>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar activeModule={activeModule} setActiveModule={setActiveModule} user={dashboardUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={dashboardUser} setActiveModule={setActiveModule} />
        <main className="flex-1 overflow-auto p-6">{renderModule()}</main>
      </div>

      {/* Visual Indicator Removed to avoid Z-index conflict with Dialog */}

      {/* Session Termination Guard */}
      <SessionTerminatedDialog
        open={!!isSessionTerminated || securityViolation}
        onConfirm={() => {
          // console.log("Confirming force logout..."); // Cleaned log
          signOut().then(() => {
            window.location.href = "/login?error=force_logout"
          });
        }}
      />
    </div>
  )
}
