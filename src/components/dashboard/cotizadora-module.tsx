"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { Plus, FileText, Clock, DollarSign, Loader2, RefreshCw, Search, Calendar, Building2, User2, Download, Eye, X, UploadCloud, FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateQuoteDialog } from "./create-quote-dialog"
import { ModernConfirmDialog } from "./modern-confirm-dialog"
import { QuotePreviewPanel } from "./quote-preview-panel"
import { User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, Trash2, AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isToday, isThisWeek, isThisMonth, parseISO, format } from "date-fns"
import { es } from "date-fns/locale"
import { logActionClient as logAction } from "@/lib/audit-client"

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
}

interface DbQuoteRow {
  id: string
  numero: string
  year: number
  cliente_nombre: string | null
  cliente_ruc: string | null
  cliente_email: string | null
  cliente_telefono: string | null
  cliente_contacto: string | null
  proyecto: string | null
  total: number
  estado: string
  vendedor_nombre: string | null
  user_created: string | null
  fecha_emision: string | null
  created_at: string
  items_count: number | null
  items_json: any[] | null
  object_key: string | null
}

const mapDbQuoteToUi = (row: any): Quote => ({
  id: row.id,
  numero: row.numero,
  year: row.year,
  cliente: row.cliente_nombre || "Cliente Sin Nombre",
  monto: Number(row.total),
  estado: (row.estado === "borrador" ? "pendiente" : row.estado) as Quote["estado"],
  owner: row.vendedor_nombre || "Sistema",
  ownerId: row.user_created || "",
  fecha: row.fecha_emision ? String(row.fecha_emision) : row.created_at.split("T")[0],
  itemsCount: row.items_count || (row.items_json ? row.items_json.length : 0),
  clienteRuc: row.cliente_ruc || "",
  clienteEmail: row.cliente_email || "",
  clienteTelefono: row.cliente_telefono || "",
  clienteContacto: row.cliente_contacto || "",
  proyectoNombre: row.proyecto || "Sin Proyecto",
  itemsJson: row.items_json || [],
  objectKey: row.object_key || "",
})

// Helper functions moved outside component for performance
const getStatusBadgeClass = (status: Quote["estado"]) => {
  const variants = {
    pendiente: "bg-amber-500/20 text-amber-600 border-amber-500/30",
    aprobada: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
    rechazada: "bg-red-500/20 text-red-600 border-red-500/30",
    borrador: "bg-slate-500/20 text-slate-600 border-slate-500/30",
  }
  return variants[status] || variants.pendiente
}

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  borrador: "Borrador",
}

interface CotizadoraModuleProps {
  user: User
}

export function CotizadoraModule({ user }: CotizadoraModuleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // Advanced Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [clienteFilter, setClienteFilter] = useState<string>("all")
  const [vendedorFilter, setVendedorFilter] = useState<string>("all")

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importFileInputRef = useRef<HTMLInputElement>(null)
  const [quoteToUpload, setQuoteToUpload] = useState<Quote | null>(null)
  // Import Excel states
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importingExcel, setImportingExcel] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importNumero, setImportNumero] = useState("")
  const [importNumeroExists, setImportNumeroExists] = useState<any>(null)
  const [checkingNumero, setCheckingNumero] = useState(false)
  const [importSelectedCondiciones, setImportSelectedCondiciones] = useState<string[]>([])
  const [importCondicionSearch, setImportCondicionSearch] = useState("")
  // const { toast } = useToast() // Replaced by Sonner
  const cotizadorUrl = process.env.NEXT_PUBLIC_COTIZADOR_URL ?? undefined

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("*")
        .eq("visibilidad", "visible")
        .order("created_at", { ascending: false })

      if (error) throw error
      setQuotes((data || []).map(mapDbQuoteToUi))
    } catch (err: any) {
      toast.error("Error al cargar cotizaciones", {
        description: err.message,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  // Derived data for filters
  const uniqueClientes = useMemo(() =>
    [...new Set(quotes.map(q => q.cliente))].sort(),
    [quotes]
  )

  const uniqueVendedores = useMemo(() =>
    [...new Set(quotes.map(q => q.owner))].sort(),
    [quotes]
  )

  // Advanced filtering logic
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const quoteDate = parseISO(q.fecha)

      // Search query (cliente, numero, proyecto)
      const matchesSearch = searchQuery === "" ||
        q.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.proyectoNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.clienteRuc.includes(searchQuery)

      // Status filter
      const matchesStatus = statusFilter === "all" || q.estado === statusFilter

      // Date filter
      let matchesDate = true
      if (dateFilter === "today") matchesDate = isToday(quoteDate)
      else if (dateFilter === "week") matchesDate = isThisWeek(quoteDate, { weekStartsOn: 1 })
      else if (dateFilter === "month") matchesDate = isThisMonth(quoteDate)

      // Cliente filter
      const matchesCliente = clienteFilter === "all" || q.cliente === clienteFilter

      // Vendedor filter (admin only)
      const matchesVendedor = vendedorFilter === "all" || q.owner === vendedorFilter

      return matchesSearch && matchesStatus && matchesDate && matchesCliente && matchesVendedor
    })
  }, [quotes, searchQuery, statusFilter, dateFilter, clienteFilter, vendedorFilter])

  // Stats calculations
  const stats = useMemo(() => {
    const filtered = filteredQuotes
    return {
      total: filtered.length,
      aprobadas: filtered.filter(q => q.estado === "aprobada").length,
      pendientes: filtered.filter(q => q.estado === "pendiente").length,
      montoAprobado: filtered.filter(q => q.estado === "aprobada").reduce((sum, q) => sum + q.monto, 0),
      montoTotal: filtered.reduce((sum, q) => sum + q.monto, 0),
    }
  }, [filteredQuotes])

  const canWrite = user.permissions?.cotizadora?.write === true || user.role === "admin"

  const changeQuoteStatus = async (quoteId: string, newStatus: Quote["estado"]) => {
    if (!canWrite) {
      toast.error("Acceso denegado", { description: "No tienes permisos para cambiar el estado de las cotizaciones." })
      return
    }
    setUpdatingStatus(true)
    try {
      const dbStatus = newStatus === 'pendiente' ? 'borrador' : newStatus

      const { error } = await supabase
        .from("cotizaciones")
        .update({ estado: dbStatus })
        .eq("id", quoteId)

      if (error) throw error

      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, estado: newStatus } : q))
      if (previewQuote?.id === quoteId) {
        setPreviewQuote({ ...previewQuote, estado: newStatus })
      }
      if (selectedQuote?.id === quoteId) {
        setSelectedQuote({ ...selectedQuote, estado: newStatus })
      }

      toast.success("Estado actualizado", {
        description: `La cotización ha sido marcada como ${statusLabels[newStatus]}.`,
      })

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Cambió estado de cotización a: ${statusLabels[newStatus] || newStatus}`,
        module: "COTIZACIONES",
        details: { cotizacion_id: quoteId }
      })
    } catch (err: any) {
      toast.error("Error al actualizar estado", {
        description: err.message,
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDownload = async (quote: Quote) => {
    if (!quote.objectKey) {
      toast.error("Error", {
        description: "No se encontró el archivo de la cotización.",
      })
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from("cotizaciones")
        .download(quote.objectKey)

      if (error) throw error

      const url = window.URL.createObjectURL(data)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `COT-${quote.numero}-${quote.year}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Descargó archivo de cotización COT-${quote.numero}-${quote.year}`,
        module: "COTIZACIONES",
        details: { cotizacion_id: quote.id }
      })
    } catch (err: any) {
      toast.error("Error al descargar", {
        description: err.message,
      })
    }
  }

  const handleDeleteQuote = async () => {
    if (!canWrite) {
      toast.error("Acceso denegado", { description: "No tienes permisos para eliminar cotizaciones." })
      return
    }
    const quoteToDelete = previewQuote || selectedQuote
    if (!quoteToDelete) return

    try {
      const { error } = await supabase
        .from("cotizaciones")
        .update({ visibilidad: "no_visible" })
        .eq("id", quoteToDelete.id)

      if (error) throw error

      const deletedId = quoteToDelete.id
      setQuotes(prev => prev.filter(q => q.id !== deletedId))
      setIsViewDialogOpen(false)
      setIsDeleteConfirmOpen(false)
      setSelectedQuote(null)
      setPreviewQuote(null)

      toast.success("Cotización eliminada exitosamente")

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Eliminó cotización`,
        module: "COTIZACIONES",
        severity: "warning",
        details: { cotizacion_id: deletedId }
      })
    } catch (err: any) {
      toast.error("Error al eliminar", {
        description: err.message,
      })
    }
  }

  const handleUploadClick = (quote: Quote) => {
    setQuoteToUpload(quote)
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !quoteToUpload) return

    // Validar tipo de archivo
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'pdf'].includes(ext || '')) {
      toast.error("Tipo de archivo no permitido", {
        description: "Solo se permiten archivos Excel (.xlsx, .xls) o PDF (.pdf)"
      })
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    setUploadingFile(true)
    const toastId = toast.loading("Subiendo archivo...")

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await fetch(`${baseUrl}/${quoteToUpload.id}/manual-upload`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Error al subir el archivo")
      }

      toast.success("Archivo reemplazado exitosamente", { id: toastId })
      
      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Reemplazó archivo de cotización COT-${quoteToUpload.numero}-${quoteToUpload.year}`,
        module: "COTIZACIONES",
        details: { cotizacion_id: quoteToUpload.id, archivo: file.name }
      })

      fetchQuotes() // Recargar la lista
    } catch (error: any) {
      toast.error("Error al subir archivo", {
        id: toastId,
        description: error.message
      })
    } finally {
      setUploadingFile(false)
      setQuoteToUpload(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const openViewDialog = (quote: Quote) => {
    setSelectedQuote(quote)
    setIsViewDialogOpen(true)
  }

  // --- Import Excel Handlers ---
  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx') {
      toast.error("Solo archivos .xlsx", { description: "Seleccione un archivo Excel (.xlsx) válido" })
      return
    }

    setImportFile(file)
    setLoadingPreview(true)
    setIsImportDialogOpen(true)

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`${baseUrl}/import-excel/preview`, {
        method: "POST",
        body: formData,
      })

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error("Error parsing JSON:", text)
        throw new Error(`Respuesta inválida del servidor (no es JSON). Posible error 500/404.`)
      }

      if (!res.ok) {
        throw new Error(data.detail || "Error al pre-visualizar")
      }

      setImportPreview(data.preview)
      setImportNumero(data.preview.suggested_numero || "")
      setImportNumeroExists(null)
      setImportSelectedCondiciones(data.preview.matched_condiciones_ids || [])
      setImportCondicionSearch("")
    } catch (err: any) {
      toast.error("Error al leer Excel", { description: err.message })
      setIsImportDialogOpen(false)
      setImportFile(null)
    } finally {
      setLoadingPreview(false)
      if (importFileInputRef.current) importFileInputRef.current.value = ""
    }
  }

  const confirmImportExcel = async () => {
    if (!importFile) return

    setImportingExcel(true)
    const toastId = toast.loading("Importando cotización...")

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const formData = new FormData()
      formData.append("file", importFile)
      formData.append("user_id", user.id)
      formData.append("user_name", user.name)

      const condicionesParam = importSelectedCondiciones.length > 0 ? `&condiciones_ids=${encodeURIComponent(importSelectedCondiciones.join(","))}` : ""
      const res = await fetch(`${baseUrl}/import-excel?user_id=${encodeURIComponent(user.id)}&user_name=${encodeURIComponent(user.name)}&custom_numero=${encodeURIComponent(importNumero)}${condicionesParam}`, {
        method: "POST",
        body: formData,
      })

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        console.error("Error parsing JSON:", text)
        throw new Error(`Respuesta inválida del servidor (no es JSON): ${text.substring(0, 50)}...`)
      }

      if (!res.ok) {
        throw new Error(data.detail || "Error al importar")
      }

      toast.success("Cotización importada exitosamente", {
        id: toastId,
        description: `COT-${data.year}-${data.numero} creada con ${data.parsed_data?.items_count || 0} items`,
      })

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Importó cotización desde Excel: COT-${data.year}-${data.numero}`,
        module: "COTIZACIONES",
        details: {
          cotizacion_id: data.quote_id,
          cliente: data.parsed_data?.cliente,
          items_count: data.parsed_data?.items_count,
          total: data.parsed_data?.total,
          archivo_original: importFile.name,
        }
      })

      fetchQuotes()
      setIsImportDialogOpen(false)
      setImportPreview(null)
      setImportFile(null)
      setImportNumero("")
      setImportNumeroExists(null)
      setImportSelectedCondiciones([])
      setImportCondicionSearch("")
    } catch (err: any) {
      toast.error("Error al importar", { id: toastId, description: err.message })
    } finally {
      setImportingExcel(false)
    }
  }

  const cancelImport = () => {
    setIsImportDialogOpen(false)
    setImportPreview(null)
    setImportFile(null)
    setImportNumero("")
    setImportNumeroExists(null)
    setImportSelectedCondiciones([])
    setImportCondicionSearch("")
  }

  const checkImportNumero = async (numero: string) => {
    setImportNumero(numero)
    setImportNumeroExists(null)
    
    if (!numero.trim()) return
    
    setCheckingNumero(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const year = new Date().getFullYear()
      const res = await fetch(`${baseUrl}/import-excel/check-number?numero=${encodeURIComponent(numero.trim())}&year=${year}`, {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        setImportNumeroExists(data.exists ? data.quote : null)
      }
    } catch {
      // silently fail
    } finally {
      setCheckingNumero(false)
    }
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setDateFilter("all")
    setClienteFilter("all")
    setVendedorFilter("all")
  }

  const hasActiveFilters = searchQuery || statusFilter !== "all" || dateFilter !== "all" || clienteFilter !== "all" || vendedorFilter !== "all"

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <div className="w-full h-full flex flex-col gap-4 min-w-0 overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Centro de Cotizaciones</h1>
            <p className="text-sm text-muted-foreground">Gestiona y filtra todas tus cotizaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchQuotes} title="Recargar" className="h-9 w-9">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="h-9 px-4 font-semibold"
              disabled={!canWrite}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva Cotización
            </Button>
            <Button
              variant="outline"
              onClick={() => importFileInputRef.current?.click()}
              className="h-9 px-4 font-semibold"
              disabled={!canWrite}
              title="Importar cotización desde Excel existente"
            >
              <FileUp className="h-4 w-4 mr-1.5" />
              Importar Excel
            </Button>
          </div>
        </div>

        {/* Stats Cards - Compact */}
        <div className="grid grid-cols-4 gap-3">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter("all")}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'aprobada' ? 'ring-2 ring-emerald-500' : ''}`}
            onClick={() => setStatusFilter("aprobada")}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.aprobadas}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Aprobadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pendiente' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => setStatusFilter("pendiente")}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.pendientes}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">
                    S/. {stats.montoAprobado.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">Aprobado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-card rounded-lg border border-border">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, RUC, proyecto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el tiempo</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
            </SelectContent>
          </Select>

          {/* Cliente Filter */}
          <Select value={clienteFilter} onValueChange={setClienteFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {uniqueClientes.slice(0, 20).map((cliente) => (
                <SelectItem key={cliente} value={cliente} className="text-xs">
                  {cliente.length > 25 ? cliente.substring(0, 25) + "..." : cliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vendedor Filter (Admin only) */}
          {user.role === "admin" && (
            <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <User2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueVendedores.map((vendedor) => (
                  <SelectItem key={vendedor} value={vendedor} className="text-xs">
                    {vendedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" />
              Limpiar
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {filteredQuotes.length} resultados
          </div>
        </div>

        {/* High-Density Table */}
        <Card className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-340px)]">
            {filteredQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <h3 className="text-base font-semibold text-muted-foreground mb-1">Sin resultados</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {hasActiveFilters ? "Intenta con otros filtros" : "No hay cotizaciones registradas"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[100px]">ID</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 max-w-[300px] xl:max-w-[400px]">Cliente / Proyecto</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[80px] text-center">Items</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[120px] text-right">Monto</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[100px]">Estado</TableHead>
                    {user.role === "admin" && <TableHead className="text-xs font-semibold px-4 py-3 w-[110px]">Vendedor</TableHead>}
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[90px]">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className={`cursor-pointer group transition-colors ${previewQuote?.id === quote.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/30'}`}
                      onClick={() => setPreviewQuote(quote)}
                    >
                      <TableCell className="px-4 py-2.5">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {quote.numero}-{String(quote.year).slice(-2)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 max-w-[300px] xl:max-w-[400px]">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm truncate" title={quote.cliente}>{quote.cliente}</span>
                          <span className="text-[10px] text-muted-foreground truncate" title={quote.proyectoNombre}>{quote.proyectoNombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-center">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                          {quote.itemsCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right">
                        <span className="font-bold text-sm">
                          S/. {quote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(quote.estado)}`}>
                          {statusLabels[quote.estado]}
                        </span>
                      </TableCell>
                      {user.role === "admin" && (
                        <TableCell className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                              {quote.owner.charAt(0)}
                            </div>
                            <span className="text-xs truncate max-w-[70px]">{quote.owner}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                        {quote.fecha}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); openViewDialog(quote) }}
                            title="Ver completo"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleDownload(quote) }}
                            title="Descargar"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleUploadClick(quote) }}
                            title="Reemplazar archivo (PDF/Excel)"
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuote(quote);
                              setIsDialogOpen(true);
                            }}
                            title="Editar"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>
      </div>

      <Sheet open={!!previewQuote} onOpenChange={(open) => !open && setPreviewQuote(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0 border-l border-border bg-card">
          <SheetHeader className="sr-only">
            <SheetTitle>Vista Previa de Cotización</SheetTitle>
            <SheetDescription>Detalles rápidos de la cotización seleccionada</SheetDescription>
          </SheetHeader>
          <QuotePreviewPanel
            quote={previewQuote}
            onDownload={handleDownload}
            onStatusChange={changeQuoteStatus}
            onViewFull={openViewDialog}
            onDelete={(quote) => { setPreviewQuote(quote); setIsDeleteConfirmOpen(true) }}
            onEdit={(quote) => { setSelectedQuote(quote); setIsDialogOpen(true) }}
            onUpload={handleUploadClick}
            isUpdating={updatingStatus || uploadingFile}
          />
        </SheetContent>
      </Sheet>

      <CreateQuoteDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedQuote(null); // Clear selection on close
        }}
        iframeUrl={cotizadorUrl}
        user={user}
        onSuccess={fetchQuotes}
        quoteId={selectedQuote?.id}
      />

      {/* Full View Dialog (for complete details) */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[650px] w-[95vw] max-h-[90vh] bg-card border-border p-0 flex flex-col overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 shrink-0 border-b border-border/50">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p>Cotización {selectedQuote?.numero}-{selectedQuote?.year}</p>
                <p className="text-sm font-normal text-muted-foreground">{selectedQuote?.proyectoNombre}</p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detalles completos de la cotización seleccionada.
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(selectedQuote.estado)}`}>
                      {statusLabels[selectedQuote.estado]}
                    </span>
                    <span className="text-sm text-muted-foreground">Emitida el {selectedQuote.fecha}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" disabled={updatingStatus}>
                          {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                          Cambiar Estado
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => changeQuoteStatus(selectedQuote.id, "aprobada")} className="gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aprobada
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => changeQuoteStatus(selectedQuote.id, "rechazada")} className="gap-2">
                          <XCircle className="h-4 w-4 text-red-500" /> Rechazada
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => changeQuoteStatus(selectedQuote.id, "pendiente")} className="gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" /> Pendiente
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="default" size="sm" className="gap-2" onClick={() => handleDownload(selectedQuote)}>
                      <Download className="h-4 w-4" />
                      Descargar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                      <Building2 className="h-4 w-4" />
                      Información del Cliente
                    </div>
                    <div className="space-y-2 bg-secondary/20 p-4 rounded-lg">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Empresa</p>
                        <p className="text-sm font-semibold">{selectedQuote.cliente}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">RUC</p>
                          <p className="text-sm">{selectedQuote.clienteRuc || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Contacto</p>
                          <p className="text-sm">{selectedQuote.clienteContacto || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                      <User2 className="h-4 w-4" />
                      Información Comercial
                    </div>
                    <div className="space-y-2 bg-secondary/20 p-4 rounded-lg">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vendedor</p>
                        <p className="text-sm font-semibold">{selectedQuote.owner}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monto Total</p>
                        <p className="text-xl font-bold text-primary">S/. {selectedQuote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                {selectedQuote.itemsJson && selectedQuote.itemsJson.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      Detalle de Items ({selectedQuote.itemsCount})
                    </h4>
                    <div className="border border-border rounded-lg bg-secondary/10 divide-y divide-border/50">
                      {selectedQuote.itemsJson.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-start text-sm p-3 hover:bg-background/50 transition-colors">
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <p className="font-medium line-clamp-2">{item.descripcion || item.item}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Cant: <strong>{item.cantidad || 1}</strong></span>
                              <span>P.U: S/. {Number(item.costo_unitario || item.precio_unitario || item.pu || 0).toFixed(2)}</span>
                            </div>
                          </div>
                          <p className="font-semibold shrink-0 ml-2">S/. {Number(item.total || item.total_item || (item.costo_unitario || item.precio_unitario || 0) * (item.cantidad || 1)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="border-t border-border p-4 shrink-0 flex items-center justify-between bg-secondary/5">
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModernConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        onConfirm={handleDeleteQuote}
        title="¿Eliminar cotización?"
        description="Esta acción eliminará el registro de la vista del CRM. ¿Deseas continuar?"
        confirmText="Sí, eliminar"
        cancelText="No, cancelar"
      />

      {/* Hidden File Input for Manual Upload */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".xlsx,.xls,.pdf"
        onChange={handleFileChange}
      />

      {/* Hidden File Input for Import Excel */}
      <input
        type="file"
        ref={importFileInputRef}
        className="hidden"
        accept=".xlsx"
        onChange={handleImportFileSelect}
      />

      {/* Import Excel Preview Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={(open) => { if (!open) cancelImport() }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              Importar Cotización desde Excel
            </DialogTitle>
            <DialogDescription>
              {importFile ? `Archivo: ${importFile.name}` : "Procesando archivo..."}
            </DialogDescription>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analizando Excel...</p>
            </div>
          ) : importPreview ? (
            <div className="space-y-4">
              {/* Número de Cotización (editable) */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <h4 className="font-semibold text-sm text-primary uppercase tracking-wide">Número de Cotización</h4>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">COT-{new Date().getFullYear()}-</span>
                  <Input
                    value={importNumero}
                    onChange={(e) => checkImportNumero(e.target.value)}
                    placeholder="Ej: 001"
                    className="w-28 font-mono font-bold text-center"
                  />
                  {checkingNumero && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {importNumeroExists && (
                  <div className="flex items-start gap-2 mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/30">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-amber-700 dark:text-amber-400">
                        Este número ya existe: COT-{importNumeroExists.year}-{importNumeroExists.numero}
                      </p>
                      <p className="text-muted-foreground">
                        Cliente: {importNumeroExists.cliente} · S/. {Number(importNumeroExists.total).toLocaleString("es-PE")} · {importNumeroExists.estado}
                      </p>
                      <p className="text-amber-600 dark:text-amber-400 mt-1">
                        Si continúa, se reemplazará la cotización existente.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Datos del Cliente */}
              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-semibold text-sm text-primary uppercase tracking-wide">Datos del Cliente</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium text-right">{importPreview.cliente || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RUC:</span>
                    <span className="font-medium text-right">{importPreview.ruc || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contacto:</span>
                    <span className="font-medium text-right">{importPreview.contacto || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Teléfono:</span>
                    <span className="font-medium text-right">{importPreview.telefono || "—"}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Proyecto:</span>
                    <span className="font-medium text-right">{importPreview.proyecto || "—"}</span>
                  </div>
                  {importPreview.titulo_original && (
                    <div className="flex justify-between col-span-2">
                      <span className="text-muted-foreground">Título Original:</span>
                      <span className="font-medium text-right text-xs">{importPreview.titulo_original}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Detectados */}
              <div className="rounded-lg border p-4 space-y-2">
                <h4 className="font-semibold text-sm text-primary uppercase tracking-wide">
                  Items Detectados ({importPreview.items_count})
                </h4>
                {importPreview.items?.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-8">#</TableHead>
                          <TableHead className="text-xs">Descripción</TableHead>
                          <TableHead className="text-xs text-right">P.U.</TableHead>
                          <TableHead className="text-xs text-right">Cant.</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.items.map((item: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs font-mono">{idx + 1}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate" title={item.descripcion}>
                              {item.descripcion}
                            </TableCell>
                            <TableCell className="text-xs text-right">
                              S/. {Number(item.costo_unitario).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs text-right">{item.cantidad}</TableCell>
                            <TableCell className="text-xs text-right font-medium">
                              S/. {(item.costo_unitario * item.cantidad).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No se detectaron items en el Excel
                  </p>
                )}
              </div>

              {/* Condiciones y Plazo */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-semibold text-sm text-primary uppercase tracking-wide">Condiciones Detectadas</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Plazo estimado:</span>
                    <p className="font-medium">
                      {importPreview.plazo_dias > 0 ? `${importPreview.plazo_dias} días hábiles` : "No especificado"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Condición de pago:</span>
                    <p className="font-medium">
                      {importPreview.condicion_pago_key ? ({
                        'valorizacion': 'Valorización mensual',
                        'adelantado': 'Adelantado',
                        '50_adelanto': '50% Adelanto + saldo',
                        'credito_7': 'Crédito 7 días',
                        'credito_15': 'Crédito 15 días',
                        'credito_30': 'Crédito 30 días',
                      } as Record<string, string>)[importPreview.condicion_pago_key] || importPreview.condicion_pago_key : "No detectada"}
                    </p>
                  </div>
                </div>
                {importPreview.condiciones_especificas_lista?.length > 0 && (
                  <div>
                    <span className="text-muted-foreground text-xs">Detectadas del Excel:</span>
                    <ul className="mt-1 space-y-0.5">
                      {importPreview.condiciones_especificas_lista.map((cond: string, idx: number) => (
                        <li key={idx} className="text-xs flex items-start gap-1.5 text-muted-foreground">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{cond}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Selección de condiciones desde la DB */}
                {importPreview.all_condiciones?.length > 0 && (
                  <div className="border-t pt-3 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                        Seleccionar Condiciones ({importSelectedCondiciones.length})
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Buscar condición..."
                      value={importCondicionSearch}
                      onChange={e => setImportCondicionSearch(e.target.value)}
                      autoComplete="off"
                      data-lpignore="true"
                      className="w-full text-xs px-2 py-1.5 border rounded mb-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {importPreview.all_condiciones
                        .filter((c: any) =>
                          !importCondicionSearch ||
                          c.texto.toLowerCase().includes(importCondicionSearch.toLowerCase())
                        )
                        .map((cond: any) => (
                          <label
                            key={cond.id}
                            className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 px-1.5 py-1 rounded text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={importSelectedCondiciones.includes(cond.id)}
                              onChange={() => {
                                setImportSelectedCondiciones(prev =>
                                  prev.includes(cond.id)
                                    ? prev.filter(id => id !== cond.id)
                                    : [...prev, cond.id]
                                )
                              }}
                              className="mt-0.5 accent-primary"
                            />
                            <span className={importSelectedCondiciones.includes(cond.id) ? "font-medium" : "text-muted-foreground"}>
                              {cond.texto}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Totales */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">S/. {importPreview.subtotal?.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IGV (18%):</span>
                  <span className="font-medium">S/. {importPreview.igv?.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold border-t pt-2 mt-2">
                  <span>Total:</span>
                  <span className="text-primary text-base">S/. {importPreview.total?.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelImport} disabled={importingExcel}>
              Cancelar
            </Button>
            <Button
              onClick={confirmImportExcel}
              disabled={importingExcel || loadingPreview || !importPreview || !importNumero.trim()}
              className="font-semibold"
            >
              {importingExcel ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-1.5" />
                  {importNumeroExists ? "Reemplazar y Confirmar" : "Confirmar Importación"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
