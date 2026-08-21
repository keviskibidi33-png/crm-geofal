"use client"

import { useState, useCallback, useEffect, useMemo, useRef, useDeferredValue } from "react"
import { Plus, FileText, Clock, DollarSign, Loader2, RefreshCw, Search, Calendar, Building2, User2, Download, Eye, X, UploadCloud, FileUp, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateQuoteDialog } from "./create-quote-dialog"
import { ModernConfirmDialog } from "./modern-confirm-dialog"
import { QuotePreviewPanel } from "./quote-preview-panel"
import { User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { getSafeErrorMessage } from "@/lib/error-message"
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
import { isToday, isThisWeek, isThisMonth, parseISO } from "date-fns"
import { logActionClient as logAction } from "@/lib/audit-client"
import { authFetch } from "@/lib/api-auth"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { ensayosData, getEnsayosRequeridos, searchEnsayos, type EnsayoItem } from "@/data/ensayos-data"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

function DragHandle() {
  return (
    <div className="grid h-4 w-3 shrink-0 grid-cols-2 gap-0.5 opacity-70" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} className="h-1 w-1 rounded-full bg-muted-foreground/80" />
      ))}
    </div>
  )
}

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
  fechaSolicitud?: string
  fechaEmision?: string
  personalComercial?: string
  includeIgv?: boolean
  detailsLoaded?: boolean
}

interface DbQuoteListRow {
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
  object_key: string | null
}

interface DbQuoteDetailRow {
  id: string
  cliente_email: string | null
  cliente_telefono: string | null
  cliente_contacto: string | null
  items_json: any[] | null
  correo_vendedor: string | null
  telefono_comercial: string | null
  plazo_dias: number | null
  condicion_pago: string | null
  condiciones_textos: string[] | null
  condiciones_ids: string[] | null
  cliente_id: string | null
  proyecto_id: string | null
  ubicacion: string | null
  fecha_solicitud: string | null
  fecha_emision: string | null
  personal_comercial: string | null
  include_igv: boolean | null
}

const mapDbQuoteToUi = (row: DbQuoteListRow): Quote => ({
  id: row.id,
  numero: row.numero,
  year: row.year,
  cliente: row.cliente_nombre || "Cliente Sin Nombre",
  monto: Number(row.total),
  estado: (row.estado === "borrador" ? "pendiente" : row.estado) as Quote["estado"],
  owner: row.vendedor_nombre || "Sistema",
  ownerId: row.user_created || "",
  fecha: row.fecha_emision ? String(row.fecha_emision) : row.created_at.split("T")[0],
  itemsCount: row.items_count || 0,
  clienteRuc: row.cliente_ruc || "",
  clienteEmail: "",
  clienteTelefono: "",
  clienteContacto: "",
  proyectoNombre: row.proyecto || "Sin Proyecto",
  itemsJson: [],
  objectKey: row.object_key || "",
  detailsLoaded: false,
})

const mergeQuoteDetails = (quote: Quote, row: DbQuoteDetailRow): Quote => ({
  ...quote,
  clienteEmail: row.cliente_email || "",
  clienteTelefono: row.cliente_telefono || "",
  clienteContacto: row.cliente_contacto || "",
  itemsJson: row.items_json || [],
  correoVendedor: row.correo_vendedor || "",
  telefonoComercial: row.telefono_comercial || "",
  plazoDias: row.plazo_dias ?? undefined,
  condicionPago: row.condicion_pago || "",
  condicionesTextos: row.condiciones_textos || [],
  condicionesIds: row.condiciones_ids || [],
  clienteId: row.cliente_id || undefined,
  proyectoId: row.proyecto_id || undefined,
  ubicacion: row.ubicacion || "",
  fechaSolicitud: row.fecha_solicitud || undefined,
  fechaEmision: row.fecha_emision || undefined,
  personalComercial: row.personal_comercial || undefined,
  includeIgv: typeof row.include_igv === "boolean" ? row.include_igv : true,
  detailsLoaded: true,
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

const DEFAULT_QUOTES_PER_PAGE = 20

const createSuggestedQuoteCode = () => ({
  numero: "",
  year: new Date().getFullYear(),
})

export function CotizadoraModule({ user }: CotizadoraModuleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [duplicateSourceQuote, setDuplicateSourceQuote] = useState<Quote | null>(null)
  const [duplicateDraftOpen, setDuplicateDraftOpen] = useState(false)
  const [duplicateDraftLoading, setDuplicateDraftLoading] = useState(false)
  const [duplicateDraft, setDuplicateDraft] = useState<any>(null)
  const [duplicateClienteQuery, setDuplicateClienteQuery] = useState("")
  const [duplicateProyectoQuery, setDuplicateProyectoQuery] = useState("")
  const [duplicateClientes, setDuplicateClientes] = useState<any[]>([])
  const [duplicateProyectos, setDuplicateProyectos] = useState<any[]>([])
  const [duplicateSelectedCliente, setDuplicateSelectedCliente] = useState<any | null>(null)
  const [duplicateSelectedProyecto, setDuplicateSelectedProyecto] = useState<any | null>(null)
  const [duplicateCondiciones, setDuplicateCondiciones] = useState<any[]>([])
  const [duplicateSelectedCondiciones, setDuplicateSelectedCondiciones] = useState<string[]>([])
  const [duplicateConditionTexts, setDuplicateConditionTexts] = useState<string[]>([])
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // Advanced Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [clienteFilter, setClienteFilter] = useState<string>("all")
  const [vendedorFilter, setVendedorFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("cotizadoraItemsPerPage")) || DEFAULT_QUOTES_PER_PAGE
    }
    return DEFAULT_QUOTES_PER_PAGE
  })

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingQuoteDetailsId, setLoadingQuoteDetailsId] = useState<string | null>(null)
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
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const quotesRef = useRef<Quote[]>([])
  const detailRequestsRef = useRef<Map<string, Promise<Quote>>>(new Map())

  useEffect(() => {
    quotesRef.current = quotes
  }, [quotes])

  useEffect(() => {
    localStorage.setItem("cotizadoraItemsPerPage", itemsPerPage.toString())
  }, [itemsPerPage])

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      let allQuotes: any[] = []
      let from = 0
      const step = 1000
      let hasMore = true

      while (hasMore) {
        const { data, error } = await supabase
          .from("cotizaciones")
          .select("id, numero, year, cliente_nombre, cliente_ruc, proyecto, total, estado, vendedor_nombre, user_created, fecha_emision, created_at, items_count, object_key")
          .eq("visibilidad", "visible")
          .order("created_at", { ascending: false })
          .range(from, from + step - 1)

        if (error) throw error

        if (data && data.length > 0) {
          allQuotes = allQuotes.concat(data)
          if (data.length < step) {
            hasMore = false
          } else {
            from += step
          }
        } else {
          hasMore = false
        }
      }

      setQuotes(allQuotes.map((row) => mapDbQuoteToUi(row as DbQuoteListRow)))
    } catch (err: any) {
      toast.error("Error al cargar cotizaciones", {
        description: getSafeErrorMessage(err, "No se pudieron cargar las cotizaciones"),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadQuoteDetails = useCallback(async (quoteId: string) => {
    const cachedQuote = quotesRef.current.find((quote) => quote.id === quoteId)
    if (!cachedQuote) {
      throw new Error("No se encontró la cotización seleccionada.")
    }

    if (cachedQuote.detailsLoaded) {
      return cachedQuote
    }

    const pendingRequest = detailRequestsRef.current.get(quoteId)
    if (pendingRequest) {
      return pendingRequest
    }

    const request = (async () => {
      setLoadingQuoteDetailsId(quoteId)

      const response = await authFetch(`${API_URL}/quotes/${quoteId}`)
      if (!response.ok) {
        const message = await response.text().catch(() => "")
        throw new Error(message || `Error HTTP ${response.status}`)
      }

      const payload = await response.json()
      const data = payload?.data
      if (!data) {
        throw new Error("No se encontró el detalle de la cotización.")
      }

      const detailedQuote = mergeQuoteDetails(cachedQuote, data as DbQuoteDetailRow)
      setQuotes((previous) => previous.map((quote) => quote.id === quoteId ? detailedQuote : quote))

      return detailedQuote
    })()
      .finally(() => {
        detailRequestsRef.current.delete(quoteId)
        setLoadingQuoteDetailsId((current) => current === quoteId ? null : current)
      })

    detailRequestsRef.current.set(quoteId, request)

    return request
  }, [])

  const openPreview = useCallback((quote: Quote) => {
    setPreviewQuote(quote)

    if (quote.detailsLoaded) {
      return
    }

    void loadQuoteDetails(quote.id)
      .then((detailedQuote) => {
        setPreviewQuote((current) => current?.id === detailedQuote.id ? detailedQuote : current)
        setSelectedQuote((current) => current?.id === detailedQuote.id ? detailedQuote : current)
      })
      .catch((err: any) => {
        toast.error("No se pudo cargar el detalle", {
          description: err.message,
        })
      })
  }, [loadQuoteDetails])

  const openDuplicateDialog = useCallback(async (quote: Quote) => {
    setDuplicateDraftLoading(true)
    try {
      const detailed = await loadQuoteDetails(quote.id)
      let suggestedNumero = ""
      let suggestedYear = new Date().getFullYear()
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        const resp = await authFetch(`${baseUrl}/quote/next-number`, { method: "POST" })
        if (resp.ok) {
          const nextData = await resp.json().catch(() => ({}))
          suggestedNumero = String(nextData?.number || "").replace(/\D/g, "")
          suggestedYear = Number(nextData?.year || suggestedYear)
        }
      } catch {
        suggestedNumero = ""
      }
      const source = {
        id: detailed.id,
        numero: suggestedNumero,
        year: suggestedYear,
        cliente: "",
        clienteRuc: "",
        clienteContacto: "",
        clienteEmail: "",
        clienteTelefono: "",
        proyectoNombre: "",
        itemsJson: detailed.itemsJson || [],
        condicionesTextos: detailed.condicionesTextos || [],
        condicionesIds: detailed.condicionesIds || [],
        plazoDias: detailed.plazoDias,
        condicionPago: detailed.condicionPago,
        correoVendedor: detailed.correoVendedor,
        telefonoComercial: detailed.telefonoComercial,
        clienteId: undefined,
        proyectoId: undefined,
        ubicacion: "",
      }
      setDuplicateDraft(source)
      setDuplicateClienteQuery("")
      setDuplicateProyectoQuery("")
      setDuplicateClientes([])
      setDuplicateProyectos([])
      setDuplicateSelectedCliente(null)
      setDuplicateSelectedProyecto(null)
      setDuplicateSelectedCondiciones(source.condicionesIds)
      setDuplicateConditionTexts(source.condicionesTextos)
      setDuplicateDraftOpen(true)
    } catch (err: any) {
      toast.error("No se pudo preparar la duplicación", {
        description: err?.message || "Intenta nuevamente",
      })
    } finally {
      setDuplicateDraftLoading(false)
    }
  }, [loadQuoteDetails])

  const confirmDuplicateDraft = useCallback(() => {
    if (!duplicateDraft) return
    setDuplicateSourceQuote({
      ...duplicateDraft,
      clienteId: duplicateSelectedCliente?.id || duplicateDraft.clienteId || "",
      proyectoId: duplicateSelectedProyecto?.id || duplicateDraft.proyectoId || "",
      condicionesIds: duplicateSelectedCondiciones,
    })
    setSelectedQuote(null)
    setDuplicateDraftOpen(false)
    setIsDialogOpen(true)
  }, [duplicateDraft, duplicateSelectedCliente?.id, duplicateSelectedCondiciones, duplicateSelectedProyecto?.id])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  useEffect(() => {
    if (!duplicateDraftOpen) return
    const load = async () => {
      try {
        const resp = await authFetch(`${API_URL}/condiciones`)
        const json = await resp.json().catch(() => ({}))
        setDuplicateCondiciones(Array.isArray(json?.data) ? json.data : [])
      } catch {
        setDuplicateCondiciones([])
      }
    }
    void load()
  }, [duplicateDraftOpen])

  useEffect(() => {
    if (duplicateCondiciones.length === 0 || duplicateConditionTexts.length === 0 || duplicateSelectedCondiciones.length > 0) return
    const norm = (v: string) => v.trim().toLowerCase()
    const mapped = duplicateCondiciones
      .filter((cond) => duplicateConditionTexts.some((text) => norm(text) === norm(cond.texto)))
      .map((cond) => cond.id)
    if (mapped.length > 0) setDuplicateSelectedCondiciones(mapped)
  }, [duplicateCondiciones, duplicateConditionTexts, duplicateSelectedCondiciones.length])

  useEffect(() => {
    if (!duplicateDraftOpen) return
    const timer = setTimeout(async () => {
      const q = duplicateClienteQuery.trim()
      if (q.length < 2) {
        setDuplicateClientes([])
        return
      }
      try {
        const resp = await authFetch(`${API_URL}/clientes?search=${encodeURIComponent(q)}`)
        const json = await resp.json().catch(() => ({}))
        setDuplicateClientes(Array.isArray(json?.data) ? json.data : [])
      } catch {
        setDuplicateClientes([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [duplicateClienteQuery, duplicateDraftOpen])

  useEffect(() => {
    if (!duplicateDraftOpen) return
    const timer = setTimeout(async () => {
      const q = duplicateProyectoQuery.trim()
      if (q.length < 2 && !duplicateSelectedCliente) {
        setDuplicateProyectos([])
        return
      }
      try {
        const params = new URLSearchParams()
        if (duplicateSelectedCliente?.id) params.set("cliente_id", duplicateSelectedCliente.id)
        if (q) params.set("search", q)
        const resp = await authFetch(`${API_URL}/proyectos?${params.toString()}`)
        const json = await resp.json().catch(() => ({}))
        setDuplicateProyectos(Array.isArray(json?.data) ? json.data : [])
      } catch {
        setDuplicateProyectos([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [duplicateDraftOpen, duplicateProyectoQuery, duplicateSelectedCliente])

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
      const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase()

      // Search query (cliente, numero, proyecto)
      const matchesSearch = normalizedSearchQuery === "" ||
        q.cliente.toLowerCase().includes(normalizedSearchQuery) ||
        q.numero.toLowerCase().includes(normalizedSearchQuery) ||
        q.proyectoNombre.toLowerCase().includes(normalizedSearchQuery) ||
        q.clienteRuc.includes(deferredSearchQuery.trim())

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
  }, [quotes, deferredSearchQuery, statusFilter, dateFilter, clienteFilter, vendedorFilter])

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / itemsPerPage))

  const paginatedQuotes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredQuotes.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredQuotes, currentPage, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [deferredSearchQuery, statusFilter, dateFilter, clienteFilter, vendedorFilter, itemsPerPage])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

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
        description: getSafeErrorMessage(err, "No se pudo actualizar el estado"),
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDownload = async (quote: Quote) => {
    try {
      const isLegacy = !quote.objectKey || quote.year < 2026
      const toastId = toast.loading(isLegacy ? "Buscando o reconstruyendo fichero antiguo..." : "Buscando fichero...", {
        description: isLegacy ? "Esto podría tardar un momento si es una cotización antigua." : undefined
      })
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
      
      const resp = await authFetch(`${baseUrl}/quotes/${quote.id}/download`)
      
      if (resp.ok) {
        const blob = await resp.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", `COT-${quote.numero}-${quote.year}.xlsx`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        toast.success("Cotización lista", { id: toastId })
      } else {
        if (!quote.objectKey) {
          toast.error("Error", {
            id: toastId,
            description: "No se encontraron los datos para reconstruir la cotización.",
          })
          return
        }
        
        const { data, error } = await supabase.storage
          .from("cotizaciones")
          .download(quote.objectKey)

        if (error) {
           toast.error("Error", { id: toastId, description: "No se encontró el archivo ni pudo ser reconstruido." })
           throw error
        }

        const url = window.URL.createObjectURL(data)
        const link = document.createElement("a")
        link.href = url
        link.setAttribute("download", `COT-${quote.numero}-${quote.year}.xlsx`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        toast.success("Cotización recuperada de la nube", { id: toastId })
      }

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Descargó archivo de cotización COT-${quote.numero}-${quote.year}`,
        module: "COTIZACIONES",
        details: { cotizacion_id: quote.id }
      })
    } catch (err: any) {
      toast.error("Error al descargar", {
        description: getSafeErrorMessage(err, "No se pudo descargar el archivo"),
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
        description: getSafeErrorMessage(err, "No se pudo eliminar la cotización"),
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

    if (quote.detailsLoaded) {
      return
    }

    void loadQuoteDetails(quote.id)
      .then((detailedQuote) => {
        setSelectedQuote((current) => current?.id === detailedQuote.id ? detailedQuote : current)
        setPreviewQuote((current) => current?.id === detailedQuote.id ? detailedQuote : current)
      })
      .catch((err: any) => {
        toast.error("No se pudo cargar el detalle", {
          description: err.message,
        })
      })
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

      const res = await authFetch(`${baseUrl}/import-excel/preview`, {
        method: "POST",
        body: formData,
      })

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
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
      toast.error("Error al leer Excel", { description: getSafeErrorMessage(err, "No se pudo leer el archivo") })
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
      const res = await authFetch(`${baseUrl}/import-excel?user_id=${encodeURIComponent(user.id)}&user_name=${encodeURIComponent(user.name)}&custom_numero=${encodeURIComponent(importNumero)}${condicionesParam}`, {
        method: "POST",
        body: formData,
      })

      const text = await res.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
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
      toast.error("Error al importar", { id: toastId, description: getSafeErrorMessage(err, "No se pudo importar la cotización") })
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
      const res = await authFetch(`${baseUrl}/import-excel/check-number?numero=${encodeURIComponent(numero.trim())}&year=${year}`, {
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
    setCurrentPage(1)
  }

  const hasActiveFilters = searchQuery || statusFilter !== "all" || dateFilter !== "all" || clienteFilter !== "all" || vendedorFilter !== "all"

  return (
    <div className="flex min-h-[calc(100vh-120px)] gap-4">
      <div className="flex w-full min-w-0 flex-col gap-4">
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

          <Card className="bg-linear-to-br from-primary/10 to-primary/5 border-primary/20">
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
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, RUC, proyecto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Date Filter */}
          <Select value={dateFilter || "all"} onValueChange={(v: any) => setDateFilter(v)}>
            <SelectTrigger className="w-32.5 h-9 text-xs">
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
          <Select value={statusFilter || "all"} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-30 h-9 text-xs">
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
          <Select value={clienteFilter || "all"} onValueChange={setClienteFilter}>
            <SelectTrigger className="w-40 h-9 text-xs">
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

          <Select value={String(itemsPerPage)} onValueChange={(value) => setItemsPerPage(Number(value))}>
            <SelectTrigger className="w-32.5 h-9 text-xs">
              <SelectValue placeholder="Filas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 filas</SelectItem>
              <SelectItem value="20">20 filas</SelectItem>
              <SelectItem value="50">50 filas</SelectItem>
              <SelectItem value="100">100 filas</SelectItem>
            </SelectContent>
          </Select>

          {/* Vendedor Filter (Admin only) */}
          {user.role === "admin" && (
            <Select value={vendedorFilter || "all"} onValueChange={setVendedorFilter}>
              <SelectTrigger className="w-35 h-9 text-xs">
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
            {filteredQuotes.length > 0 ? ` • Página ${currentPage} de ${totalPages}` : ""}
          </div>
        </div>

        {/* High-Density Table */}
        <Card className="overflow-hidden">
          <div className="flex flex-col">
            <div className="overflow-x-auto">
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
                <TableHeader className="bg-card">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="text-xs font-semibold px-4 py-3 w-25">ID</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 max-w-75 xl:max-w-100">Cliente / Proyecto</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-20 text-center">Items</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-30 text-right">Monto</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-25">Estado</TableHead>
                    {user.role === "admin" && <TableHead className="text-xs font-semibold px-4 py-3 w-27.5">Vendedor</TableHead>}
                    <TableHead className="text-xs font-semibold px-4 py-3 w-22.5">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQuotes.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className={`cursor-pointer group transition-colors ${previewQuote?.id === quote.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/30'}`}
                      onClick={() => openPreview(quote)}
                    >
                      <TableCell className="px-4 py-2.5">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {quote.numero}-{String(quote.year).slice(-2)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 max-w-75 xl:max-w-100">
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
                            <span className="text-xs truncate max-w-17.5">{quote.owner}</span>
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
            </div>

            {filteredQuotes.length > itemsPerPage && (
              <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
                  {Math.min(currentPage * itemsPerPage, filteredQuotes.length)} de {filteredQuotes.length} cotizaciones
                </p>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {(() => {
                    const pages: Array<number | "ellipsis-start" | "ellipsis-end"> = []
                    const showEllipsis = totalPages > 7

                    if (!showEllipsis) {
                      for (let page = 1; page <= totalPages; page += 1) pages.push(page)
                    } else if (currentPage <= 4) {
                      for (let page = 1; page <= 5; page += 1) pages.push(page)
                      pages.push("ellipsis-end", totalPages)
                    } else if (currentPage >= totalPages - 3) {
                      pages.push(1, "ellipsis-start")
                      for (let page = totalPages - 4; page <= totalPages; page += 1) pages.push(page)
                    } else {
                      pages.push(1, "ellipsis-start")
                      for (let page = currentPage - 1; page <= currentPage + 1; page += 1) pages.push(page)
                      pages.push("ellipsis-end", totalPages)
                    }

                    return pages.map((page, index) => {
                      if (page === "ellipsis-start" || page === "ellipsis-end") {
                        return (
                          <span key={`${page}-${index}`} className="px-2 text-sm text-muted-foreground">
                            ...
                          </span>
                        )
                      }

                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="h-8 w-8 p-0"
                        >
                          {page}
                        </Button>
                      )
                    })
                  })()}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Sheet open={!!previewQuote} onOpenChange={(open) => !open && setPreviewQuote(null)}>
        <SheetContent side="right" className="w-100 sm:w-135 p-0 border-l border-border bg-card">
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
            onDuplicate={openDuplicateDialog}
            onUpload={handleUploadClick}
            isUpdating={updatingStatus || uploadingFile || loadingQuoteDetailsId === previewQuote?.id || duplicateDraftLoading}
          />
        </SheetContent>
      </Sheet>

      <CreateQuoteDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedQuote(null)
            setDuplicateSourceQuote(null)
          }
        }}
        user={user}
        onSuccess={fetchQuotes}
        quoteId={selectedQuote?.id}
        duplicateSourceQuote={duplicateSourceQuote}
      />

      <Dialog open={duplicateDraftOpen} onOpenChange={(open) => {
        setDuplicateDraftOpen(open)
        if (!open) {
          setDuplicateDraft(null)
          setDuplicateClienteQuery("")
          setDuplicateProyectoQuery("")
          setDuplicateClientes([])
          setDuplicateProyectos([])
          setDuplicateSelectedCliente(null)
          setDuplicateSelectedProyecto(null)
          setDuplicateSelectedCondiciones([])
          setDuplicateConditionTexts([])
        }
      }}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[96vw] w-[96vw] h-[92vh] max-h-[92vh] overflow-hidden p-0 flex flex-col"
          onPointerDownOutside={(event) => {
            const target = event.detail.originalEvent.target
            if (target instanceof Element && target.closest('[data-autocomplete-dropdown="true"]')) {
              event.preventDefault()
            }
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Duplicar cotización
            </DialogTitle>
            <DialogDescription>
              Ajusta los datos generales y los ítems antes de crear la nueva cotización.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-6">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 col-span-2">
                      <Label>Número sugerido</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <span className="pl-3 text-sm text-muted-foreground">COT-</span>
                        <Input
                          value={duplicateDraft?.numero || ""}
                          onChange={(e) => setDuplicateDraft((prev: any) => ({ ...prev, numero: e.target.value.replace(/\D/g, "") }))}
                          inputMode="numeric"
                          autoComplete="off"
                          className="h-9 min-w-0 flex-1 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <span className="pr-3 text-sm text-muted-foreground">-{String(duplicateDraft?.year || new Date().getFullYear()).slice(-2)}</span>
                      </div>
                    </div>
                    <div className="space-y-2 relative">
                      <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Cliente / Empresa</Label>
                      <Input
                        value={duplicateClienteQuery}
                        onChange={(e) => {
                          const value = e.target.value
                          setDuplicateClienteQuery(value)
                          setDuplicateDraft((prev: any) => ({
                            ...prev,
                            cliente: value,
                            clienteId: "",
                            proyectoId: "",
                            proyectoNombre: "",
                            ubicacion: "",
                          }))
                          setDuplicateSelectedCliente(null)
                          setDuplicateSelectedProyecto(null)
                          setDuplicateProyectoQuery("")
                        }}
                        placeholder="Buscar cliente..."
                        autoComplete="off"
                      />
                      {duplicateClienteQuery.trim().length >= 2 && duplicateClientes.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-background shadow-lg">
                          {duplicateClientes.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                              onClick={() => {
                                setDuplicateSelectedCliente(c)
                                setDuplicateClienteQuery(c.nombre || "")
                                setDuplicateDraft((prev: any) => ({
                                  ...prev,
                                  cliente: c.nombre || "",
                                  clienteRuc: c.ruc || "",
                                  clienteContacto: c.contacto || "",
                                  clienteEmail: c.email || "",
                                  clienteTelefono: c.telefono || "",
                                  clienteId: c.id,
                                  proyectoId: "",
                                  proyectoNombre: "",
                                  ubicacion: "",
                                }))
                                setDuplicateSelectedProyecto(null)
                                setDuplicateProyectoQuery("")
                                setDuplicateProyectos([])
                              }}
                            >
                              <div className="font-medium">{c.nombre}</div>
                              {c.ruc ? <div className="text-xs text-muted-foreground">RUC: {c.ruc}</div> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 relative">
                      <Label className="flex items-center gap-2"><Search className="h-4 w-4" /> Proyecto</Label>
                      <Input
                        value={duplicateProyectoQuery}
                        onChange={(e) => {
                          const value = e.target.value
                          setDuplicateProyectoQuery(value)
                          setDuplicateDraft((prev: any) => ({ ...prev, proyectoNombre: value, proyectoId: "" }))
                          setDuplicateSelectedProyecto(null)
                        }}
                        placeholder={duplicateSelectedCliente ? "Buscar proyecto..." : "Busca proyecto o selecciona cliente"}
                        autoComplete="off"
                      />
                      {duplicateProyectoQuery.trim().length >= 2 && duplicateProyectos.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border bg-background shadow-lg">
                          {duplicateProyectos.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                              onClick={() => {
                                setDuplicateSelectedProyecto(p)
                                setDuplicateProyectoQuery(p.nombre || "")
                                setDuplicateDraft((prev: any) => ({
                                  ...prev,
                                  proyectoNombre: p.nombre || "",
                                  ubicacion: p.ubicacion || p.direccion || "",
                                  proyectoId: p.id,
                                }))
                              }}
                            >
                              <div className="font-medium">{p.nombre}</div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>{p.ubicacion || p.direccion || ""}</span>
                                {p.cliente_nombre ? <span>{p.cliente_nombre}</span> : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>RUC</Label>
                      <Input
                        value={duplicateDraft?.clienteRuc || ""}
                        onChange={(e) => setDuplicateDraft((prev: any) => ({ ...prev, clienteRuc: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contacto</Label>
                      <Input
                        value={duplicateDraft?.clienteContacto || ""}
                        onChange={(e) => setDuplicateDraft((prev: any) => ({ ...prev, clienteContacto: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Condiciones específicas</Label>
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-md p-3 space-y-2 bg-background">
                      {duplicateCondiciones.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Cargando condiciones...</p>
                      ) : (
                        duplicateCondiciones.map((cond) => (
                          <label key={cond.id} className="flex items-start gap-2 cursor-pointer hover:bg-muted p-2 rounded">
                            <input
                              type="checkbox"
                              checked={duplicateSelectedCondiciones.includes(cond.id)}
                              onChange={(e) => {
                                setDuplicateSelectedCondiciones((prev) =>
                                  e.target.checked ? [...prev, cond.id] : prev.filter((id) => id !== cond.id)
                                )
                              }}
                              className="mt-0.5"
                            />
                            <span className="text-xs">{cond.texto}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-semibold">Ítems a duplicar</h3>
                      <p className="text-sm text-muted-foreground">Revisa y ajusta el contenido antes de crear la nueva cotización.</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setDuplicateDraft((prev: any) => ({
                        ...prev,
                        itemsJson: [...(prev?.itemsJson || []), { codigo: "", descripcion: "", norma: "", acreditado: "SI", costo_unitario: 0, cantidad: 1 }],
                      }))}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar ítem
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(duplicateDraft?.itemsJson || []).map((item: any, idx: number) => (
                      <div key={`${idx}-${item.codigo || "item"}`} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[40px_120px_1fr_140px_120px_120px_auto] items-start">
                        <div className="flex items-center justify-center pt-2"><DragHandle /></div>
                        <AutocompleteInput
                          value={item.codigo || ""}
                          onChange={(value) => {
                            setDuplicateDraft((prev: any) => ({
                              ...prev,
                              itemsJson: prev.itemsJson.map((it: any, i: number) => i === idx ? { ...it, codigo: value } : it),
                            }))
                          }}
                          onSelect={(ensayo: EnsayoItem) => {
                            const related = getEnsayosRequeridos(ensayo.codigo)
                            setDuplicateDraft((prev: any) => {
                              const next = [...prev.itemsJson]
                              next[idx] = {
                                codigo: ensayo.codigo,
                                descripcion: ensayo.descripcion,
                                norma: ensayo.norma,
                                acreditado: ensayo.acreditado,
                                costo_unitario: Number(ensayo.precio || 0),
                                cantidad: 1,
                              }
                              related.forEach((rel) => {
                                if (rel.codigo === ensayo.codigo) return
                                const customPrice = (ensayo.preciosRelacionados && ensayo.preciosRelacionados[rel.codigo] !== undefined)
                                  ? ensayo.preciosRelacionados[rel.codigo]
                                  : Number(rel.precio || 0);
                                next.push({
                                  codigo: rel.codigo,
                                  descripcion: rel.descripcion,
                                  norma: rel.norma,
                                  acreditado: rel.acreditado,
                                  costo_unitario: customPrice,
                                  cantidad: 1,
                                })
                              })
                              return { ...prev, itemsJson: next }
                            })
                          }}
                          suggestions={ensayosData}
                          placeholder="Código"
                          displayField="descripcion"
                          codeField="codigo"
                          minChars={0}
                        />
                        <AutocompleteInput
                          value={item.descripcion || ""}
                          onChange={(value) => {
                            setDuplicateDraft((prev: any) => ({
                              ...prev,
                              itemsJson: prev.itemsJson.map((it: any, i: number) => i === idx ? { ...it, descripcion: value } : it),
                            }))
                          }}
                          onSelect={(ensayo: EnsayoItem) => {
                            const related = getEnsayosRequeridos(ensayo.codigo)
                            setDuplicateDraft((prev: any) => {
                              const next = [...prev.itemsJson]
                              next[idx] = {
                                codigo: ensayo.codigo,
                                descripcion: ensayo.descripcion,
                                norma: ensayo.norma,
                                acreditado: ensayo.acreditado,
                                costo_unitario: Number(ensayo.precio || 0),
                                cantidad: 1,
                              }
                              related.forEach((rel) => {
                                if (rel.codigo === ensayo.codigo) return
                                const customPrice = (ensayo.preciosRelacionados && ensayo.preciosRelacionados[rel.codigo] !== undefined)
                                  ? ensayo.preciosRelacionados[rel.codigo]
                                  : Number(rel.precio || 0);
                                next.push({
                                  codigo: rel.codigo,
                                  descripcion: rel.descripcion,
                                  norma: rel.norma,
                                  acreditado: rel.acreditado,
                                  costo_unitario: customPrice,
                                  cantidad: 1,
                                })
                              })
                              return { ...prev, itemsJson: next }
                            })
                          }}
                          suggestions={ensayosData}
                          placeholder="Descripción"
                          displayField="descripcion"
                          codeField="codigo"
                          minChars={0}
                        />
                        <Input value={item.norma || ""} onChange={(e) => {
                          const value = e.target.value
                          setDuplicateDraft((prev: any) => ({
                            ...prev,
                            itemsJson: prev.itemsJson.map((it: any, i: number) => i === idx ? { ...it, norma: value } : it),
                          }))
                        }} placeholder="Norma" />
                        <Input value={item.acreditado || "SI"} onChange={(e) => {
                          const value = e.target.value
                          setDuplicateDraft((prev: any) => ({
                            ...prev,
                            itemsJson: prev.itemsJson.map((it: any, i: number) => i === idx ? { ...it, acreditado: value } : it),
                          }))
                        }} placeholder="Acreditado" />
                        <Input type="number" value={item.costo_unitario ?? 0} onChange={(e) => {
                          const value = Number(e.target.value)
                          setDuplicateDraft((prev: any) => ({
                            ...prev,
                            itemsJson: prev.itemsJson.map((it: any, i: number) => i === idx ? { ...it, costo_unitario: value } : it),
                          }))
                        }} placeholder="Costo" />
                        <Button variant="ghost" size="icon" onClick={() => setDuplicateDraft((prev: any) => ({
                          ...prev,
                          itemsJson: prev.itemsJson.filter((_: any, i: number) => i !== idx),
                        }))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t p-4">
            <Button variant="outline" onClick={() => setDuplicateDraftOpen(false)}>Cancelar</Button>
            <Button onClick={confirmDuplicateDraft}>
              Duplicar y abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full View Dialog (for complete details) */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-162.5 w-[95vw] max-h-[90vh] bg-card border-border p-0 flex flex-col overflow-hidden rounded-2xl">
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
                      Resumen comercial
                    </div>
                    <div className="space-y-2 bg-secondary/20 p-4 rounded-lg">
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
                            <TableCell className="text-xs max-w-50 truncate" title={item.descripcion}>
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
