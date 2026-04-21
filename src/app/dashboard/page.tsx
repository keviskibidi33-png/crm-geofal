"use client"

import { useState, useEffect, useRef, type ComponentType } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { RoleGuard } from "@/components/dashboard/role-guard"
import { SessionTerminatedDialog } from "@/components/dashboard/session-terminated-dialog"
import { Button } from "@/components/ui/button"
import { resetAuthCache, useAuth, type ModuleType } from "@/hooks/use-auth"
import { verifyServerSessionConsistency } from "@/lib/session-api"
import { supabase } from "@/lib/supabaseClient"
import { canAccessDashboardModule, getPreferredControlModule } from "@/lib/control-module-access"
import { Loader2, Eye } from "lucide-react"
import { toast } from "sonner"

function DashboardModuleFallback() {
  return (
    <div className="flex min-h-[320px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm">
      <div className="flex items-center gap-3 text-sm font-medium">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando módulo...
      </div>
    </div>
  )
}

function dashboardDynamic<TProps>(loader: () => Promise<ComponentType<TProps>>) {
  return dynamic<TProps>(
    async () => {
      const component = await loader()
      return { default: component }
    },
    {
      loading: () => <DashboardModuleFallback />,
      ssr: false,
    },
  )
}

const ClientesModule = dashboardDynamic(async () => (await import("@/components/dashboard/clientes-module")).ClientesModule)
const CotizadoraModule = dashboardDynamic(async () => (await import("@/components/dashboard/cotizadora-module")).CotizadoraModule)
const ConfiguracionModule = dashboardDynamic(async () => (await import("@/components/dashboard/configuracion-module")).ConfiguracionModule)
const UsuariosModule = dashboardDynamic(async () => (await import("@/components/dashboard/usuarios-module")).UsuariosModule)
const ProyectosModule = dashboardDynamic(async () => (await import("@/components/dashboard/proyectos-module")).ProyectosModule)
const AuditoriaModule = dashboardDynamic(async () => (await import("@/components/dashboard/auditoria-module")).AuditoriaModule)
const ProgramacionModule = dashboardDynamic(async () => (await import("@/components/dashboard/programacion-module")).ProgramacionModule)
const VerificacionMuestrasModule = dashboardDynamic(async () => (await import("@/components/dashboard/verificacion-muestras-module")).VerificacionMuestrasModule)
const CompresionModule = dashboardDynamic(async () => (await import("@/components/dashboard/compresion-module")).CompresionModule)
const LaboratorioModule = dashboardDynamic(async () => (await import("@/components/dashboard/laboratorio-module")).LaboratorioModule)
const OficinaTecnicaModule = dashboardDynamic(async () => (await import("@/components/dashboard/oficina-tecnica-module")).OficinaTecnicaModule)
const RecepcionModule = dashboardDynamic(async () => (await import("@/components/dashboard/recepcion-module")).RecepcionModule)
const ComercialModule = dashboardDynamic(async () => (await import("@/components/dashboard/comercial-module")).ComercialModule)
const AdministracionModule = dashboardDynamic(async () => (await import("@/components/dashboard/administracion-module")).AdministracionModule)
const TracingModule = dashboardDynamic(async () => (await import("@/components/dashboard/tracing-module")).TracingModule)
const CorrelativosModule = dashboardDynamic(async () => (await import("@/components/dashboard/correlativos-module")).CorrelativosModule)
const HumedadModule = dashboardDynamic(async () => (await import("@/components/dashboard/humedad-module")).HumedadModule)
const ContHumedadModule = dashboardDynamic(async () => (await import("@/components/dashboard/cont-humedad-module")).ContHumedadModule)
const CBRModule = dashboardDynamic(async () => (await import("@/components/dashboard/cbr-module")).CBRModule)
const ProctorModule = dashboardDynamic(async () => (await import("@/components/dashboard/proctor-module")).ProctorModule)
const LLPModule = dashboardDynamic(async () => (await import("@/components/dashboard/llp-module")).LLPModule)
const GranSueloModule = dashboardDynamic(async () => (await import("@/components/dashboard/gran-suelo-module")).GranSueloModule)
const GranAgregadoModule = dashboardDynamic(async () => (await import("@/components/dashboard/gran-agregado-module")).GranAgregadoModule)
const AbraModule = dashboardDynamic(async () => (await import("@/components/dashboard/abra-module")).AbraModule)
const AbrassModule = dashboardDynamic(async () => (await import("@/components/dashboard/abrass-module")).AbrassModule)
const PesoUnitarioModule = dashboardDynamic(async () => (await import("@/components/dashboard/peso-unitario-module")).PesoUnitarioModule)
const TamizModule = dashboardDynamic(async () => (await import("@/components/dashboard/tamiz-module")).TamizModule)
const PlanasModule = dashboardDynamic(async () => (await import("@/components/dashboard/planas-module")).PlanasModule)
const CarasModule = dashboardDynamic(async () => (await import("@/components/dashboard/caras-module")).CarasModule)
const EquiArenaModule = dashboardDynamic(async () => (await import("@/components/dashboard/equi-arena-module")).EquiArenaModule)
const GeFinoModule = dashboardDynamic(async () => (await import("@/components/dashboard/ge-fino-module")).GeFinoModule)
const GeGruesoModule = dashboardDynamic(async () => (await import("@/components/dashboard/ge-grueso-module")).GeGruesoModule)
const CDModule = dashboardDynamic(async () => (await import("@/components/dashboard/cd-module")).CDModule)
const PHModule = dashboardDynamic(async () => (await import("@/components/dashboard/ph-module")).PHModule)
const CloroSolubleModule = dashboardDynamic(async () => (await import("@/components/dashboard/cloro-soluble-module")).CloroSolubleModule)
const SalesSolublesModule = dashboardDynamic(async () => (await import("@/components/dashboard/sales-solubles-module")).SalesSolublesModule)
const SulfatosSolublesModule = dashboardDynamic(async () => (await import("@/components/dashboard/sulfatos-solubles-module")).SulfatosSolublesModule)
const CompresionNoConfinadaModule = dashboardDynamic(async () => (await import("@/components/dashboard/compresion-no-confinada-module")).CompresionNoConfinadaModule)
const ContMatOrganicaModule = dashboardDynamic(async () => (await import("@/components/dashboard/special-lab-iframe-modules")).ContMatOrganicaModule)
const TerronesFinoGruesoModule = dashboardDynamic(async () => (await import("@/components/dashboard/special-lab-iframe-modules")).TerronesFinoGruesoModule)
const AzulMetilenoModule = dashboardDynamic(async () => (await import("@/components/dashboard/special-lab-iframe-modules")).AzulMetilenoModule)
const PartLivianasModule = dashboardDynamic(async () => (await import("@/components/dashboard/special-lab-iframe-modules")).PartLivianasModule)
const ImpOrganicasModule = dashboardDynamic(async () => (await import("@/components/dashboard/special-lab-iframe-modules")).ImpOrganicasModule)
const SulMagnesioModule = dashboardDynamic(async () => (await import("@/components/dashboard/special-lab-iframe-modules")).SulMagnesioModule)
const AngularidadModule = dashboardDynamic(async () => (await import("@/components/dashboard/special-lab-iframe-modules")).AngularidadModule)
const PermisosModule = dashboardDynamic(async () => (await import("@/components/dashboard/permisos-module")).PermisosModule)

export default function DashboardPage() {
  const initRedirectedRef = useRef(false)
  const [activeModule, setActiveModule] = useState<ModuleType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("crm-active-module") as ModuleType
      return saved || "clientes"
    }
    return "clientes"
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("crm-sidebar-collapsed") === 'true'
    }
    return false
  })
  const { user, loading, isSessionTerminated, signOut, bootstrapError, retryBootstrap } = useAuth()
  const [securityViolation, setSecurityViolation] = useState(false)
  const router = useRouter()

  const clearLocalSessionState = () => {
    if (typeof window !== "undefined") {
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith("sb-") || key.includes("supabase") || key === "token" || key === "crm_is_terminated")) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))
    }

    resetAuthCache()

    void supabase.auth.signOut().catch((error) => {
      console.error("[AuthBootstrap]", {
        stage: "buildUser",
        message: error instanceof Error ? error.message : "No se pudo limpiar la sesión local.",
      })
    })

    router.replace("/login")
  }


  useEffect(() => {
    localStorage.setItem("crm-active-module", activeModule)
    // console.log('[CRM] Nuevo valor de activeModule:', activeModule) // Cleaned log
  }, [activeModule])

  useEffect(() => {
    localStorage.setItem("crm-sidebar-collapsed", String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Force initial landing to control modules for specific roles
  useEffect(() => {
    if (loading || !user || initRedirectedRef.current) return

    const controlDefault = getPreferredControlModule(user.role, user.permissions)
    initRedirectedRef.current = true
    if (controlDefault && activeModule !== controlDefault) {
      setActiveModule(controlDefault)
    }
  }, [loading, user, activeModule])

  useEffect(() => {
    // Only redirect if NOT loading, and NO user, and session is NOT terminated
    if (!loading && !user && !isSessionTerminated && !bootstrapError) {
      // Grace period: Wait 2s to see if a termination event comes in via Realtime
      const timer = setTimeout(() => {
        // Double check session status inside timeout
        if (!isSessionTerminated) {
          router.push("/login")
        }
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [user, loading, router, isSessionTerminated, bootstrapError])

  // Handle module authorization and security checks
  useEffect(() => {
    if (loading || !user) return;

    const role = user.role?.toLowerCase() || "";
    const isAdmin = role === "admin" || role === "admin_general";
    const isAdminOnlyModule = activeModule === "permisos";

    // 1. Administrators have absolute access - never redirect them
    if (isAdmin) {
      return;
    }

    // 2. For other roles, check against their granted permissions
    const hasPermission = !isAdminOnlyModule && canAccessDashboardModule(activeModule, user.role, user.permissions);

    if (!hasPermission) {
      // Choose a smart default based on role
      const getRoleDefault = (): ModuleType => {
        if (role === 'tecnico') return 'tracing';
        const preferredControl = getPreferredControlModule(user.role, user.permissions);
        if (preferredControl) return preferredControl;
        return 'clientes';
      }

      const defaultModule = getRoleDefault();

      // Only set if different to avoid potential state loops
      if (activeModule !== defaultModule) {
        console.log(`[Auth] Seguridad: Usuario rol "${role}" intentó acceder a "${activeModule}" sin permiso. Redirigiendo a "${defaultModule}".`);
        setActiveModule(defaultModule);
      }
    }
  }, [loading, user, activeModule]); // Watch activeModule for security

  // Show read-only notification when entering a module without write access
  useEffect(() => {
    if (loading || !user) return;
    const role = user.role?.toLowerCase() || "";
    const isAdmin = role === "admin" || role === "admin_general";
    if (isAdmin) return;

    const perm = user.permissions?.[activeModule];
    if (perm?.read === true && perm?.write !== true) {
      toast.info("Solo lectura", {
        description: "Tienes acceso de visualización en este módulo. No puedes crear, editar ni eliminar registros.",
        icon: <Eye className="h-4 w-4" />,
        duration: 4000,
      });
    }
  }, [loading, user, activeModule]);

  // Session Consistency Check (Security)
  useEffect(() => {
    if (!loading && user) {
      verifyServerSessionConsistency(user.id).then((result) => {
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

  if (bootstrapError && !user) {
    return (
      <div className="h-screen w-full bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/80 p-8 shadow-2xl">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">Arranque del CRM</p>
            <h1 className="text-2xl font-semibold text-white">No se pudo cargar tu sesión</h1>
            <p className="text-sm leading-6 text-zinc-300">{bootstrapError}</p>
            <p className="text-sm leading-6 text-zinc-400">
              Puedes reintentar el arranque o volver al login para limpiar la sesión local antes de ingresar de nuevo.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button className="sm:flex-1" onClick={() => void retryBootstrap()}>
              Reintentar
            </Button>
            <Button
              variant="outline"
              className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-800 sm:flex-1"
              onClick={clearLocalSessionState}
            >
              Ir a login
            </Button>
          </div>
        </div>
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
      case "oficina_tecnica":
        return <OficinaTecnicaModule user={dashboardUser} />
      case "recepcion":
        return <RecepcionModule />
      case "comercial":
        return <ComercialModule user={dashboardUser} onNavigateModule={setActiveModule} />
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
          <RoleGuard user={dashboardUser} allowedRoles={["admin", "admin_general"]}>
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
      case "ingenieria_archivos":
        return <CorrelativosModule />
      case "humedad":
        return <HumedadModule />
      case "cont_humedad":
        return <ContHumedadModule />
      case "cbr":
        return <CBRModule />
      case "proctor":
        return <ProctorModule />
      case "llp":
        return <LLPModule />
      case "gran_suelo":
        return <GranSueloModule />
      case "gran_agregado":
        return <GranAgregadoModule />
      case "abra":
        return <AbraModule />
      case "abrass":
        return <AbrassModule />
      case "peso_unitario":
        return <PesoUnitarioModule />
      case "tamiz":
        return <TamizModule />
      case "planas":
        return <PlanasModule />
      case "caras":
        return <CarasModule />
      case "equi_arena":
        return <EquiArenaModule />
      case "ge_fino":
        return <GeFinoModule />
      case "ge_grueso":
        return <GeGruesoModule />
      case "cd":
        return <CDModule />
      case "ph":
        return <PHModule />
      case "cloro_soluble":
        return <CloroSolubleModule />
      case "sales_solubles":
        return <SalesSolublesModule />
      case "sulfatos_solubles":
        return <SulfatosSolublesModule />
      case "compresion_no_confinada":
        return <CompresionNoConfinadaModule />
      case "cont_mat_organica":
        return <ContMatOrganicaModule />
      case "terrones_fino_grueso":
        return <TerronesFinoGruesoModule />
      case "azul_metileno":
        return <AzulMetilenoModule />
      case "part_livianas":
        return <PartLivianasModule />
      case "imp_organicas":
        return <ImpOrganicasModule />
      case "sul_magnesio":
        return <SulMagnesioModule />
      case "angularidad":
        return <AngularidadModule />
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
      <DashboardSidebar activeModule={activeModule} setActiveModule={setActiveModule} user={dashboardUser} collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={dashboardUser} setActiveModule={setActiveModule} />
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6">{renderModule()}</main>
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
