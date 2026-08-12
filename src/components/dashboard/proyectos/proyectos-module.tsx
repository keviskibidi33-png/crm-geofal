"use client"

import { useState, useMemo, useCallback, useEffect, useDeferredValue } from "react"
import {
  Plus,
  FolderKanban,
  Search,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Check,
  X,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  MoreVertical,
  Trash2,
  Loader2,
  Building,
  MapPin,
  Download,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { getSafeErrorMessage } from "@/lib/error-message"
import { deleteProjectAction } from "@/app/actions/delete-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CreateProjectDialog } from "./create-project-dialog"
import { CloseProjectDialog } from "./close-project-dialog"
import { CreateQuoteDialog } from "../create-quote-dialog"
import { type User } from "@/hooks/use-auth"
import { logActionClient as logAction } from "@/lib/audit-client"

import type { Project, DbProjectRow, ProjectQuoteHistoryRow } from "./types"
export type { Project, DbProjectRow, ProjectQuoteHistoryRow } from "./types"

const initialProjects: Project[] = []

const mapDbProjectToUi = (row: DbProjectRow): Project => {
  let etapa = row.etapa as Project["etapa"]
  if (row.estado === "completado") {
    etapa = "ventas_archivadas"
  } else if (row.estado === "archivado") {
    etapa = "archivados"
  } else if (row.estado === "venta_perdida") {
    etapa = "perdidas"
  } else if (["venta_ganada", "en_ejecucion"].includes(row.estado)) {
    etapa = "ventas"
  } else if (["prospecto", "en_negociacion", "propuesta_enviada"].includes(row.estado)) {
    etapa = "pipeline"
  }

  const quotes = row.cotizaciones || []
  const montoTotal = quotes.reduce((sum: number, q: any) => sum + Number(q.total || 0), 0)
  const montoAprobado = quotes.filter((q: any) => q.estado === "aprobada")
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0)

  const contacto = row.contactos || null

  return {
    id: row.id,
    nombre: row.nombre,
    cliente: row.clientes?.nombre || "Cliente Desconocido",
    empresa: row.clientes?.empresa || "",
    responsable: row.clientes?.nombre || "",
    clienteId: row.cliente_id,
    cotizaciones: quotes.length,
    estado: row.estado as Project["estado"],
    etapa,
    fechaInicio: row.fecha_inicio || "",
    fechaFin: row.fecha_fin || "",
    fechaCreacion: row.created_at,
    presupuesto: row.presupuesto || 0,
    montoTotal: montoTotal > 0 ? montoTotal : (row.presupuesto || 0),
    montoAprobado,
    montoFinal: montoAprobado,
    progreso: row.progreso,
    motivoPerdida: row.motivo_perdida as Project["motivoPerdida"],
    descripcion: row.descripcion || "",
    ubicacion: row.ubicacion || row.direccion || "",
    contactoNombre: contacto?.nombre || undefined,
    contactoCargo: contacto?.cargo || undefined,
    contactoEmail: contacto?.email || undefined,
    contactoTelefono: contacto?.telefono || undefined,
    contactoPrincipalId: row.contacto_principal_id || undefined,
    ruc: row.clientes?.ruc || "",
  }
}

interface ProyectosModuleProps {
  user: User
}

const DEFAULT_ITEMS_PER_PAGE = 10

export function ProyectosModule({ user }: ProyectosModuleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('proyectosViewMode') as "grid" | "list") || "grid"
    }
    return "grid"
  })

  useEffect(() => {
    localStorage.setItem('proyectosViewMode', viewMode)
  }, [viewMode])
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [currentPage, setCurrentPage] = useState(1)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("proyectosItemsPerPage")) || DEFAULT_ITEMS_PER_PAGE
    }
    return DEFAULT_ITEMS_PER_PAGE
  })

  useEffect(() => {
    localStorage.setItem("proyectosItemsPerPage", itemsPerPage.toString())
  }, [itemsPerPage])

  const [isGrouped, setIsGrouped] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("proyectosGrouped") === "true"
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem("proyectosGrouped", isGrouped.toString())
  }, [isGrouped])

  const [loading, setLoading] = useState(false)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("proyectos")
        .select(`
          id,
          nombre,
          descripcion,
          cliente_id,
          ubicacion,
          direccion,
          vendedor_id,
          estado,
          etapa,
          presupuesto,
          progreso,
          fecha_inicio,
          fecha_fin,
          motivo_perdida,
          created_at,
          contacto_principal_id,
          clientes (nombre, empresa, ruc),
          cotizaciones (total, estado),
          contactos!proyectos_contacto_principal_id_fkey (nombre, cargo, email, telefono)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (error) throw error
      setProjects(((data as unknown as DbProjectRow[] | null) || []).map(mapDbProjectToUi))
    } catch (err: any) {
      toast.error("Error cargando proyectos", {
        description: err.message || "No se pudo conectar a la base de datos.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  const updateProjectProgress = async (id: string, newProgreso: number) => {
    const p = projects.find((x) => x.id === id)
    if (!p) return

    setProjects((prev) => prev.map((pr) => (pr.id === id ? { ...pr, progreso: newProgreso } : pr)))

    try {
      const { error } = await supabase
        .from("proyectos")
        .update({ progreso: newProgreso })
        .eq("id", id)

      if (error) throw error

      toast.success("Progreso actualizado", {
        description: `El avance de "${p.nombre}" es ahora ${newProgreso}%.`,
      })

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Actualizó progreso del proyecto '${p.nombre}' a ${newProgreso}%`,
        module: "PROYECTOS",
      })
    } catch (err: any) {
      fetchProjects()
      toast.error("Error", {
        description: err.message || "No se pudo guardar el progreso en el servidor.",
      })
    } finally {
      setEditingProgressId(null)
    }
  }

  const changeProjectStatus = async (
    id: string,
    newEstado: Project["estado"],
    newEtapa?: Project["etapa"]
  ) => {
    const p = projects.find((x) => x.id === id)
    if (!p) return

    const targetEtapa = newEtapa || (
      newEstado === "completado"
        ? "ventas_archivadas"
        : newEstado === "archivado"
          ? "archivados"
          : newEstado === "venta_perdida"
            ? "perdidas"
            : ["venta_ganada", "en_ejecucion"].includes(newEstado)
              ? "ventas"
              : "pipeline"
    )

    setProjects((prev) =>
      prev.map((pr) => (pr.id === id ? { ...pr, estado: newEstado, etapa: targetEtapa } : pr))
    )

    try {
      const { error } = await supabase
        .from("proyectos")
        .update({
          estado: newEstado,
          etapa: targetEtapa,
        })
        .eq("id", id)

      if (error) throw error

      toast.success("Estado actualizado", {
        description: `"${p.nombre}" cambió a ${newEstado.replace("_", " ")}.`,
      })

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Cambió estado de proyecto '${p.nombre}' a '${newEstado}' (Etapa: ${targetEtapa})`,
        module: "PROYECTOS",
      })
    } catch (err: any) {
      fetchProjects()
      toast.error("Error", {
        description: err.message || "No se pudo actualizar el estado.",
      })
    }
  }

  const handleDeleteProject = async (id: string, nombre: string) => {
    if (!confirm(`¿Estás seguro de eliminar el proyecto "${nombre}"?`)) return

    try {
      const result = await deleteProjectAction(id)

      if (!result.success) {
        throw new Error(result.error)
      }

      setProjects((prev) => prev.filter((p) => p.id !== id))
      toast.success("Proyecto eliminado", {
        description: `El proyecto "${nombre}" ha sido eliminado exitosamente.`,
      })
    } catch (err) {
      toast.error("Error al eliminar", {
        description: getSafeErrorMessage(err),
      })
    }
  }

  const handleCloseProjectResult = async (
    projectId: string,
    resultado: "venta_ganada" | "venta_perdida" | "archivado",
    montoFinal?: number,
    motivoPerdida?: Project["motivoPerdida"],
    notasCierre?: string
  ) => {
    const newEstado: Project["estado"] = resultado
    await changeProjectStatus(projectId, newEstado)

    if (montoFinal !== undefined || motivoPerdida || notasCierre) {
      await supabase
        .from("proyectos")
        .update({
          monto_final: montoFinal,
          motivo_perdida: motivoPerdida,
          notas_cierre: notasCierre,
        })
        .eq("id", projectId)
    }

    setIsCloseDialogOpen(false)
    setSelectedProject(null)
  }

  const uniqueClientes = useMemo(() => {
    const clientesMap = new Map<string, { id: string; nombre: string; empresa: string }>()
    projects.forEach((p) => {
      if (p.clienteId && !clientesMap.has(p.clienteId)) {
        clientesMap.set(p.clienteId, {
          id: p.clienteId,
          nombre: p.cliente,
          empresa: p.empresa || p.cliente,
        })
      }
    })
    return Array.from(clientesMap.values()).sort((a, b) => a.empresa.localeCompare(b.empresa))
  }, [projects])

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        p.nombre.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        p.cliente.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        (p.empresa && p.empresa.toLowerCase().includes(deferredSearchQuery.toLowerCase())) ||
        (p.ubicacion && p.ubicacion.toLowerCase().includes(deferredSearchQuery.toLowerCase()))

      const matchesEstado = estadoFilter === "todos" || p.estado === estadoFilter
      const matchesCliente = clienteFilter === "todos" || p.clienteId === clienteFilter

      return matchesSearch && matchesEstado && matchesCliente
    })
  }, [projects, deferredSearchQuery, estadoFilter, clienteFilter])

  const projectsByEtapa = useMemo(() => {
    const pipeline = filteredProjects.filter((p) => p.etapa === "pipeline")
    const ventas = filteredProjects.filter((p) => p.etapa === "ventas")
    const perdidas = filteredProjects.filter((p) => p.etapa === "perdidas")
    const archivados = filteredProjects.filter((p) => p.etapa === "archivados" || p.etapa === "ventas_archivadas")

    return { pipeline, ventas, perdidas, archivados }
  }, [filteredProjects])

  const pipelineSummary = useMemo(() => {
    const totalMonto = projectsByEtapa.pipeline.reduce((acc, p) => acc + (p.montoTotal || p.presupuesto), 0)
    const count = projectsByEtapa.pipeline.length
    return { count, totalMonto }
  }, [projectsByEtapa.pipeline])

  const ventasSummary = useMemo(() => {
    const totalMonto = projectsByEtapa.ventas.reduce((acc, p) => acc + (p.montoAprobado || p.montoTotal || p.presupuesto), 0)
    const count = projectsByEtapa.ventas.length
    return { count, totalMonto }
  }, [projectsByEtapa.ventas])

  const perdidasSummary = useMemo(() => {
    const totalMonto = projectsByEtapa.perdidas.reduce((acc, p) => acc + (p.montoTotal || p.presupuesto), 0)
    const count = projectsByEtapa.perdidas.length
    return { count, totalMonto }
  }, [projectsByEtapa.perdidas])

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredProjects.slice(start, start + itemsPerPage)
  }, [filteredProjects, currentPage, itemsPerPage])

  const getStatusBadge = (estado: Project["estado"]) => {
    const styles: Record<Project["estado"], { bg: string; text: string; label: string }> = {
      prospecto: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Prospecto" },
      en_negociacion: { bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", label: "En Negociación" },
      propuesta_enviada: { bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300", label: "Propuesta Enviada" },
      venta_ganada: { bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", label: "Venta Ganada" },
      en_ejecucion: { bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", label: "En Ejecución" },
      completado: { bg: "bg-teal-100 dark:bg-teal-950", text: "text-teal-700 dark:text-teal-300", label: "Completado" },
      venta_perdida: { bg: "bg-rose-100 dark:bg-rose-950", text: "text-rose-700 dark:text-rose-300", label: "Venta Perdida" },
      archivado: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-700 dark:text-gray-300", label: "Archivado" },
    }
    const style = styles[estado] || styles.prospecto
    return (
      <Badge className={`${style.bg} ${style.text} hover:${style.bg} border-0 text-[10px] font-bold uppercase tracking-wider`}>
        {style.label}
      </Badge>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount)
  }

  const groupedProjects = useMemo(() => {
    if (!isGrouped) return null
    const groups = new Map<string, { clienteNombre: string; empresa: string; projects: Project[] }>()
    filteredProjects.forEach((p) => {
      const key = p.clienteId || "unknown"
      if (!groups.has(key)) {
        groups.set(key, {
          clienteNombre: p.cliente,
          empresa: p.empresa || p.cliente,
          projects: [],
        })
      }
      groups.get(key)!.projects.push(p)
    })
    return Array.from(groups.values()).sort((a, b) => a.empresa.localeCompare(b.empresa))
  }, [filteredProjects, isGrouped])

  const [breakdownType, setBreakdownType] = useState<'pipeline' | 'ventas' | 'perdidas' | null>(null)
  const [projectQuotes, setProjectQuotes] = useState<ProjectQuoteHistoryRow[]>([])
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const handleOpenQuotesHistory = async (project: Project) => {
    setSelectedProject(project)
    setIsHistoryDialogOpen(true)
    setLoadingHistory(true)

    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("id, numero, year, total, estado, fecha_emision, created_at, object_key, proyecto, proyecto_id")
        .or(`proyecto_id.eq.${project.id},proyecto.ilike.%${project.nombre}%`)
        .order("created_at", { ascending: false })

      if (error) throw error
      setProjectQuotes(data || [])
    } catch (err: any) {
      toast.error("Error al cargar historial", {
        description: err.message || "No se pudo obtener las cotizaciones del proyecto.",
      })
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleDownloadQuote = async (quote: ProjectQuoteHistoryRow) => {
    if (!quote.object_key) {
      toast.error("Sin archivo adjunto", {
        description: "Esta cotización no tiene un documento Excel asociado.",
      })
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from("cotizaciones")
        .createSignedUrl(quote.object_key, 60)

      if (error) throw error

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank")
      }
    } catch (err: any) {
      toast.error("Error de descarga", {
        description: err.message || "No se pudo generar el enlace de descarga.",
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border/50 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight text-foreground">Proyectos y Pipeline B2B</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Gestión comercial de obras, contratos y servicios en ejecución
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all rounded-xl text-xs h-10 px-5"
          >
            <Plus className="mr-2 h-4 w-4" /> Nuevo Proyecto
          </Button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:border-blue-500/50 transition-all duration-200 bg-linear-to-br from-blue-500/5 to-transparent border-blue-500/20"
          onClick={() => setBreakdownType('pipeline')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              En Pipeline / Negociación
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatCurrency(pipelineSummary.totalMonto)}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <span className="font-bold text-blue-600 dark:text-blue-400">{pipelineSummary.count}</span> proyectos activos en propuesta
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-emerald-500/50 transition-all duration-200 bg-linear-to-br from-emerald-500/5 to-transparent border-emerald-500/20"
          onClick={() => setBreakdownType('ventas')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Ventas Ganadas / En Ejecución
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {formatCurrency(ventasSummary.totalMonto)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{ventasSummary.count}</span> contratos cerrados / en obra
            </p>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:border-rose-500/50 transition-all duration-200 bg-linear-to-br from-rose-500/5 to-transparent border-rose-500/20"
          onClick={() => setBreakdownType('perdidas')}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Ventas Perdidas
            </span>
            <div className="h-8 w-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {formatCurrency(perdidasSummary.totalMonto)}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1">
              <span className="font-bold text-rose-600 dark:text-rose-400">{perdidasSummary.count}</span> propuestas no concretadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <div className="bg-card p-4 rounded-2xl border border-border/50 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por obra, cliente, RUC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 bg-background rounded-xl border-border"
            />
          </div>

          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-full sm:w-44 text-xs h-9 bg-background rounded-xl">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los Estados</SelectItem>
              <SelectItem value="prospecto">Prospecto</SelectItem>
              <SelectItem value="en_negociacion">En Negociación</SelectItem>
              <SelectItem value="propuesta_enviada">Propuesta Enviada</SelectItem>
              <SelectItem value="venta_ganada">Venta Ganada</SelectItem>
              <SelectItem value="en_ejecucion">En Ejecución</SelectItem>
              <SelectItem value="completado">Completado</SelectItem>
              <SelectItem value="venta_perdida">Venta Perdida</SelectItem>
              <SelectItem value="archivado">Archivado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={clienteFilter} onValueChange={setClienteFilter}>
            <SelectTrigger className="w-full sm:w-48 text-xs h-9 bg-background rounded-xl">
              <SelectValue placeholder="Filtrar por Empresa" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="todos">Todas las Empresas</SelectItem>
              {uniqueClientes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.empresa}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button
            variant={isGrouped ? "default" : "outline"}
            size="sm"
            onClick={() => setIsGrouped(!isGrouped)}
            className="text-xs h-9 rounded-xl font-bold gap-1.5"
            title="Agrupar proyectos por empresa / cliente"
          >
            <Building className="h-3.5 w-3.5" />
            <span>{isGrouped ? "Agrupado" : "Agrupar"}</span>
          </Button>

          <div className="flex items-center bg-muted p-1 rounded-xl border border-border/50">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="h-7 w-7 rounded-lg"
              title="Vista de Tarjetas"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="h-7 w-7 rounded-lg"
              title="Vista de Tabla"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchProjects()}
            disabled={loading}
            className="h-9 w-9 rounded-xl hover:bg-muted"
            title="Recargar Proyectos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-xs text-muted-foreground font-medium">Cargando proyectos desde el servidor...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed border-border text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No se encontraron proyectos</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Intenta ajustar los filtros de búsqueda o registra un nuevo proyecto para comenzar.
          </p>
          <Button
            onClick={() => setIsDialogOpen(true)}
            variant="outline"
            className="mt-4 text-xs font-bold rounded-xl"
          >
            <Plus className="mr-2 h-4 w-4" /> Crear Proyecto
          </Button>
        </div>
      ) : isGrouped && groupedProjects ? (
        /* VISTA AGRUPADA POR CLIENTE / EMPRESA */
        <div className="space-y-4">
          <Accordion type="multiple" defaultValue={groupedProjects.map((g) => g.empresa)} className="space-y-4">
            {groupedProjects.map((group) => (
              <AccordionItem
                key={group.empresa}
                value={group.empresa}
                className="bg-card border border-border/60 rounded-2xl overflow-hidden px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        <Building className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-sm font-bold text-foreground">{group.empresa}</h3>
                        <p className="text-[11px] text-muted-foreground">{group.clienteNombre}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="text-xs font-bold rounded-lg px-2 py-0.5">
                        {group.projects.length} {group.projects.length === 1 ? "proyecto" : "proyectos"}
                      </Badge>
                      <span className="text-xs font-black text-primary">
                        {formatCurrency(group.projects.reduce((acc, p) => acc + (p.montoTotal || p.presupuesto), 0))}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.projects.map((project) => (
                      <Card
                        key={project.id}
                        className="bg-background border-border/50 hover:border-primary/40 transition-all shadow-xs group"
                      >
                        <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                              {project.nombre}
                            </h4>
                            {project.ubicacion && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>{project.ubicacion}</span>
                              </p>
                            )}
                          </div>
                          {getStatusBadge(project.estado)}
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3">
                          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                            <span className="text-muted-foreground text-[10px]">Presupuesto / Total:</span>
                            <span className="font-bold text-foreground">
                              {formatCurrency(project.montoTotal || project.presupuesto)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground font-medium">Avance</span>
                              <span className="font-bold text-primary">{project.progreso}%</span>
                            </div>
                            <Progress value={project.progreso} className="h-1.5" />
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenQuotesHistory(project)}
                              className="text-[10px] h-7 px-2 font-bold text-muted-foreground hover:text-primary gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              <span>{project.cotizaciones} Cotizaciones</span>
                            </Button>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedProject(project)
                                  setIsCloseDialogOpen(true)
                                }}
                                className="text-[10px] h-7 px-2 rounded-lg font-bold"
                              >
                                Cerrar / Cambiar
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      ) : viewMode === "grid" ? (
        /* VISTA DE TARJETAS (GRID) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProjects.map((project) => (
            <Card
              key={project.id}
              className="bg-card border-border/60 hover:border-primary/40 transition-all duration-200 shadow-xs flex flex-col justify-between group"
            >
              <CardHeader className="p-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Building className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-[11px] font-bold text-muted-foreground truncate" title={project.empresa || project.cliente}>
                        {project.empresa || project.cliente}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {project.nombre}
                    </h3>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleOpenQuotesHistory(project)}>
                        <FileText className="mr-2 h-4 w-4" /> Ver Cotizaciones ({project.cotizaciones})
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedProject(project)
                          setIsQuoteDialogOpen(true)
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" /> Nueva Cotización
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedProject(project)
                          setIsCloseDialogOpen(true)
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Registrar Resultado
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDeleteProject(project.id, project.nombre)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar Proyecto
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {project.ubicacion && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-2">
                    <MapPin className="h-3 w-3 shrink-0 text-emerald-500" />
                    <span className="truncate">{project.ubicacion}</span>
                  </p>
                )}
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-4">
                <div className="flex items-center justify-between pt-3 border-t border-border/40">
                  {getStatusBadge(project.estado)}
                  <div className="text-right">
                    <span className="text-[10px] text-muted-foreground block">Presupuesto</span>
                    <span className="text-sm font-black text-foreground">
                      {formatCurrency(project.montoTotal || project.presupuesto)}
                    </span>
                  </div>
                </div>

                {/* Progress bar and inline edit */}
                <div className="space-y-1.5 bg-muted/30 p-3 rounded-xl border border-border/30">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-medium">Avance de Obra</span>
                    {editingProgressId === project.id ? (
                      <span className="font-bold text-primary">{project.progreso}%</span>
                    ) : (
                      <button
                        onClick={() => setEditingProgressId(project.id)}
                        className="font-bold text-primary hover:underline flex items-center gap-1"
                        title="Haz clic para editar avance"
                      >
                        <span>{project.progreso}%</span>
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>

                  {editingProgressId === project.id ? (
                    <div className="space-y-2 pt-1">
                      <Slider
                        value={[project.progreso]}
                        min={0}
                        max={100}
                        step={5}
                        onValueChange={([val]) => {
                          setProjects((prev) =>
                            prev.map((pr) => (pr.id === project.id ? { ...pr, progreso: val } : pr))
                          )
                        }}
                      />
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => setEditingProgressId(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="default"
                          className="h-6 w-6"
                          onClick={() => updateProjectProgress(project.id, project.progreso)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Progress value={project.progreso} className="h-1.5" />
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenQuotesHistory(project)}
                    className="text-[11px] h-8 rounded-xl font-bold flex-1 gap-1 bg-background"
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span>{project.cotizaciones} Cotizaciones</span>
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSelectedProject(project)
                      setIsQuoteDialogOpen(true)
                    }}
                    className="text-[11px] h-8 rounded-xl font-bold bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 shadow-none transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* VISTA DE TABLA (LIST) */
        <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-bold text-xs">Proyecto / Obra</TableHead>
                <TableHead className="font-bold text-xs">Empresa / Cliente</TableHead>
                <TableHead className="font-bold text-xs">Estado</TableHead>
                <TableHead className="font-bold text-xs text-center">Avance</TableHead>
                <TableHead className="font-bold text-xs text-right">Presupuesto</TableHead>
                <TableHead className="font-bold text-xs text-center">Cotizaciones</TableHead>
                <TableHead className="font-bold text-xs text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedProjects.map((project) => (
                <TableRow key={project.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold text-xs">
                    <div>
                      <span className="text-foreground block">{project.nombre}</span>
                      {project.ubicacion && (
                        <span className="text-[10px] text-muted-foreground font-normal flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5 text-emerald-500" />
                          {project.ubicacion}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-semibold text-foreground">{project.empresa || project.cliente}</span>
                    {project.contactoNombre && (
                      <span className="text-[10px] text-muted-foreground block">Contacto: {project.contactoNombre}</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(project.estado)}</TableCell>
                  <TableCell className="text-center">
                    <div className="w-24 mx-auto space-y-1">
                      <span className="text-[10px] font-bold text-primary">{project.progreso}%</span>
                      <Progress value={project.progreso} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black text-xs">
                    {formatCurrency(project.montoTotal || project.presupuesto)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenQuotesHistory(project)}
                      className="text-xs h-7 px-2 font-bold hover:text-primary gap-1"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>{project.cotizaciones}</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedProject(project)
                          setIsCloseDialogOpen(true)
                        }}
                        className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500"
                        title="Registrar Resultado / Cerrar"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteProject(project.id, project.nombre)}
                        className="h-8 w-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Bar */}
      {filteredProjects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border/50 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Mostrar</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(v) => {
                setItemsPerPage(Number(v))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-16 text-xs h-8 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span>proyectos por página</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-2">
              Página {currentPage} de {totalPages || 1} ({filteredProjects.length} total)
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="h-8 w-8 rounded-xl"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateProjectDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        user={user}
        onSuccess={() => fetchProjects()}
      />

      {selectedProject && (
        <CloseProjectDialog
          open={isCloseDialogOpen}
          onOpenChange={setIsCloseDialogOpen}
          project={selectedProject}
          onClose={handleCloseProjectResult}
        />
      )}

      {/* Breakdown Dialog for Cards */}
      <Dialog open={breakdownType !== null} onOpenChange={(open) => !open && setBreakdownType(null)}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl w-[95vw] bg-card border-border p-0 overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="p-4 sm:p-6 border-b border-border/50 bg-slate-50/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${breakdownType === 'ventas' ? 'bg-emerald-500/10 text-emerald-600' : breakdownType === 'perdidas' ? 'bg-rose-500/10 text-rose-600' : 'bg-blue-500/10 text-blue-600'}`}>
                <FolderKanban className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {breakdownType === 'pipeline' && 'Desglose: En Pipeline / Negociación'}
                  {breakdownType === 'ventas' && 'Desglose: Ventas Ganadas / En Ejecución'}
                  {breakdownType === 'perdidas' && 'Desglose: Ventas Perdidas'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Proyectos filtrados por esta etapa comercial
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-100">
              <div className="p-4">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="text-xs font-bold text-muted-foreground uppercase">Proyecto / Cliente</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground uppercase text-center">Cotizaciones</TableHead>
                      <TableHead className="text-xs font-bold text-muted-foreground uppercase text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects
                      .filter((p) => p.etapa === breakdownType)
                      .map((project) => (
                        <TableRow
                          key={project.id}
                          className="hover:bg-muted/50 border-border/40 transition-colors cursor-pointer group"
                          onClick={() => {
                            setBreakdownType(null)
                            handleOpenQuotesHistory(project)
                          }}
                        >
                          <TableCell className="py-2.5 px-3 sm:px-4">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <FolderKanban className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1 max-w-70 sm:max-w-87.5 md:max-w-100">
                                <span className="font-semibold text-xs sm:text-sm group-hover:text-primary transition-colors line-clamp-2" title={project.nombre}>
                                  {project.nombre}
                                </span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate" title={project.cliente}>
                                  {project.cliente}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary border-primary/20">
                              {project.cotizaciones}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs sm:text-sm text-primary py-2.5 px-3 sm:px-4 whitespace-nowrap">
                            {formatCurrency(breakdownType === 'ventas' ? project.montoAprobado : project.montoTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>

          <div className="p-3 sm:p-4 border-t border-border shrink-0 space-y-3">
            <div className="bg-primary/5 p-3 sm:p-4 rounded-lg flex items-center justify-between border border-primary/10">
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Acumulado</span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-primary">
                {formatCurrency(
                  projects
                    .filter((p) => p.etapa === breakdownType)
                    .reduce((sum, p) => sum + (breakdownType === 'ventas' ? p.montoAprobado : p.montoTotal), 0)
                )}
              </span>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setBreakdownType(null)}>Cerrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CreateQuoteDialog
        open={isQuoteDialogOpen}
        onOpenChange={setIsQuoteDialogOpen}
        user={user}
        proyectoId={selectedProject?.id}
        clienteId={selectedProject?.clienteId}
        onSuccess={() => {
          fetchProjects()
        }}
      />
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl w-[95vw] bg-card border-border p-0 overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="p-4 sm:p-6 border-b border-border/50 bg-slate-50/30 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-bold">Historial de Cotizaciones</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate" title={selectedProject?.nombre}>
                  {selectedProject?.nombre}
                </DialogDescription>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {projectQuotes.length} docs
              </Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-50 max-h-[50vh]">
            <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  <p className="text-xs text-muted-foreground animate-pulse">Obteniendo documentos...</p>
                </div>
              ) : projectQuotes.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-400">No se encontraron cotizaciones</p>
                </div>
              ) : (
                projectQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-3 sm:p-4 bg-white border border-slate-100 rounded-xl sm:rounded-2xl hover:border-primary/20 hover:shadow-md transition-all group gap-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors shrink-0">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">COT-{quote.numero}-{quote.year}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{quote.fecha_emision || quote.created_at.split('T')[0]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">S/. {Number(quote.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                        <Badge variant="outline" className="text-[9px] h-4 font-bold uppercase tracking-wider py-0 px-1.5 border-slate-200 text-slate-400">
                          {quote.estado}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleDownloadQuote(quote)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-slate-50/50 border-t border-border/40 shrink-0">
            <Button
              className="w-full h-10 sm:h-11 font-bold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-[0.98]"
              onClick={() => setIsHistoryDialogOpen(false)}
            >
              Cerrar Historial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
