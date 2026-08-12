"use client"

import { useState, useMemo, useCallback, useEffect, useDeferredValue } from "react"
import {
  Plus,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Pencil,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { authFetch } from "@/lib/api-auth"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CreateQuoteDialog } from "./create-quote-dialog"
import { QuotePreviewPanel } from "./quote-preview-panel"
import { type User } from "@/hooks/use-auth"

import type { Quote } from "./types"
export type { Quote } from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

interface CotizadoraModuleProps {
  user: User
}

const DEFAULT_ITEMS_PER_PAGE = 10

export function CotizadoraModule({ user }: CotizadoraModuleProps) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [updatingQuoteId, setUpdatingQuoteId] = useState<string | null>(null)

  // Upload Replace file dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadQuoteTarget, setUploadQuoteTarget] = useState<Quote | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/mis-cotizaciones`)
      if (!res.ok) throw new Error("Error al obtener cotizaciones")
      const data = await res.json()

      const mappedQuotes: Quote[] = (data.cotizaciones || []).map((q: any) => ({
        id: String(q.id),
        numero: String(q.numero),
        year: q.year || new Date().getFullYear(),
        cliente: q.cliente || "Sin cliente",
        monto: Number(q.monto || q.total || 0),
        estado: q.estado || "pendiente",
        owner: q.vendedor_nombre || q.correo_vendedor || "Sistema",
        ownerId: q.vendedor_id || "",
        fecha: q.fecha_emision || (q.created_at ? q.created_at.split("T")[0] : ""),
        itemsCount: Array.isArray(q.items_json) ? q.items_json.length : 0,
        clienteRuc: q.cliente_ruc || "",
        clienteEmail: q.cliente_email || "",
        clienteTelefono: q.cliente_telefono || "",
        clienteContacto: q.cliente_contacto || "",
        proyectoNombre: q.proyecto_nombre || "",
        itemsJson: q.items_json || [],
        objectKey: q.object_key || "",
        correoVendedor: q.correo_vendedor,
        telefonoComercial: q.telefono_comercial,
        plazoDias: q.plazo_dias,
        condicionPago: q.condicion_pago,
        condicionesTextos: q.condiciones_textos,
        condicionesIds: q.condiciones_ids,
        clienteId: q.cliente_id,
        proyectoId: q.proyecto_id,
        ubicacion: q.ubicacion,
      }))

      setQuotes(mappedQuotes)
    } catch (err: any) {
      toast.error("Error al cargar cotizaciones", {
        description: err.message || "No se pudo sincronizar con la API backend.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchQuotes()
  }, [fetchQuotes])

  const handleStatusChange = async (quoteId: string, newEstado: Quote["estado"]) => {
    setUpdatingQuoteId(quoteId)
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/actualizar-estado/${quoteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: newEstado }),
      })

      if (!res.ok) throw new Error("Error al cambiar estado")

      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, estado: newEstado } : q))
      )
      if (selectedQuote && selectedQuote.id === quoteId) {
        setSelectedQuote((prev) => (prev ? { ...prev, estado: newEstado } : null))
      }

      toast.success("Estado actualizado", {
        description: `Cotización cambiada a ${newEstado}.`,
      })
    } catch (err: any) {
      toast.error("Error", { description: err.message || "No se pudo actualizar el estado" })
    } finally {
      setUpdatingQuoteId(null)
    }
  }

  const handleDownloadExcel = async (quote: Quote) => {
    if (!quote.objectKey) {
      toast.error("Sin archivo asociado", {
        description: "Esta cotización no tiene un documento Excel/PDF guardado.",
      })
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from("cotizaciones")
        .createSignedUrl(quote.objectKey, 60)

      if (error) throw error

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank")
      }
    } catch (err: any) {
      toast.error("Error de descarga", {
        description: err.message || "No se pudo obtener el archivo firmado de Supabase.",
      })
    }
  }

  const handleDeleteQuote = async (quote: Quote) => {
    if (!confirm(`¿Eliminar la cotización COT-${quote.numero}-${quote.year}?`)) return

    try {
      const res = await authFetch(`${API_URL}/api/cotizador/eliminar/${quote.id}`, {
        method: "DELETE",
      })

      if (!res.ok) throw new Error("Error al eliminar cotización")

      setQuotes((prev) => prev.filter((q) => q.id !== quote.id))
      if (selectedQuote?.id === quote.id) setSelectedQuote(null)

      toast.success("Cotización eliminada exitosamente")
    } catch (err: any) {
      toast.error("Error", { description: err.message || "No se pudo eliminar la cotización" })
    }
  }

  const handleDuplicateQuote = (quote: Quote) => {
    setEditingQuote({
      ...quote,
      id: "",
      numero: "",
      fecha: new Date().toISOString().split("T")[0],
    })
    setCreateDialogOpen(true)
  }

  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote)
    setCreateDialogOpen(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      void handleUploadFile(file)
    }
  }

  const handleUploadFile = async (file: File) => {
    if (!uploadQuoteTarget) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("quote_id", uploadQuoteTarget.id)

      const res = await authFetch(`${API_URL}/api/cotizador/reemplazar-archivo`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Error al subir archivo")
      await res.json()

      toast.success("Archivo subido con éxito", {
        description: `Se actualizó el documento para COT-${uploadQuoteTarget.numero}.`,
      })

      fetchQuotes()
      setUploadDialogOpen(false)
    } catch (err: any) {
      toast.error("Error al reemplazar archivo", { description: err.message })
    } finally {
      setIsUploading(false)
    }
  }

  const uniqueClientes = useMemo(() => {
    const clientesSet = new Set<string>()
    quotes.forEach((q) => {
      if (q.cliente) clientesSet.add(q.cliente)
    })
    return Array.from(clientesSet).sort()
  }, [quotes])

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const query = deferredSearchQuery.toLowerCase()
      const matchesSearch =
        q.numero.toLowerCase().includes(query) ||
        q.cliente.toLowerCase().includes(query) ||
        (q.proyectoNombre && q.proyectoNombre.toLowerCase().includes(query)) ||
        (q.clienteRuc && q.clienteRuc.toLowerCase().includes(query))

      const matchesEstado = estadoFilter === "todos" || q.estado === estadoFilter
      const matchesCliente = clienteFilter === "todos" || q.cliente === clienteFilter

      return matchesSearch && matchesEstado && matchesCliente
    })
  }, [quotes, deferredSearchQuery, estadoFilter, clienteFilter])

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage)
  const paginatedQuotes = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredQuotes.slice(start, start + itemsPerPage)
  }, [filteredQuotes, currentPage, itemsPerPage])

  const getStatusBadge = (estado: Quote["estado"]) => {
    const styles: Record<Quote["estado"], { bg: string; text: string; label: string }> = {
      pendiente: { bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300", label: "Pendiente" },
      aprobada: { bg: "bg-emerald-100 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-300", label: "Aprobada" },
      rechazada: { bg: "bg-rose-100 dark:bg-rose-950", text: "text-rose-700 dark:text-rose-300", label: "Rechazada" },
      borrador: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Borrador" },
    }
    const style = styles[estado] || styles.pendiente
    return (
      <Badge className={`${style.bg} ${style.text} hover:${style.bg} border-0 text-[10px] font-bold uppercase tracking-wider`}>
        {style.label}
      </Badge>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border border-border/50 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight text-foreground">Gestión de Cotizaciones</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Módulo comercial para emisión de propuestas, plantillas y sincronización en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setEditingQuote(null)
              setCreateDialogOpen(true)
            }}
            disabled={isUploading}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md hover:shadow-lg transition-all rounded-xl text-xs h-10 px-5"
          >
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Nueva Cotización
          </Button>
        </div>
      </div>

      {/* Grid layout with Main table + Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Controls */}
          <div className="bg-card p-4 rounded-2xl border border-border/50 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por N° COT, cliente, proyecto, RUC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9 bg-background rounded-xl"
                />
              </div>

              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-36 text-xs h-9 bg-background rounded-xl">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="aprobada">Aprobada</SelectItem>
                  <SelectItem value="rechazada">Rechazada</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                </SelectContent>
              </Select>

              <Select value={clienteFilter} onValueChange={setClienteFilter}>
                <SelectTrigger className="w-40 text-xs h-9 bg-background rounded-xl">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="todos">Todas las empresas</SelectItem>
                  {uniqueClientes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchQuotes()}
                disabled={loading}
                className="h-9 w-9 rounded-xl"
                title="Recargar"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border/50 overflow-hidden shadow-xs">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-xs text-muted-foreground font-medium">Cargando cotizaciones...</p>
              </div>
            ) : filteredQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-bold text-foreground">No se encontraron cotizaciones</p>
                <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros o crea una nueva cotización.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-bold text-xs">N° Cotización</TableHead>
                    <TableHead className="font-bold text-xs">Empresa / Cliente</TableHead>
                    <TableHead className="font-bold text-xs">Proyecto / Obra</TableHead>
                    <TableHead className="font-bold text-xs">Estado</TableHead>
                    <TableHead className="font-bold text-xs text-right">Monto Total</TableHead>
                    <TableHead className="font-bold text-xs text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedQuotes.map((quote) => {
                    const isSelected = selectedQuote?.id === quote.id
                    return (
                      <TableRow
                        key={quote.id}
                        onClick={() => setSelectedQuote(quote)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10 hover:bg-primary/15 font-semibold" : "hover:bg-muted/40"
                        }`}
                      >
                        <TableCell className="font-bold text-xs">
                          <span className="text-primary font-mono">COT-{quote.numero}-{quote.year}</span>
                          <span className="text-[10px] text-muted-foreground block font-normal">{quote.fecha}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="font-bold text-foreground block truncate max-w-45">{quote.cliente}</span>
                          {quote.clienteRuc && (
                            <span className="text-[10px] text-muted-foreground font-mono">RUC: {quote.clienteRuc}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="text-foreground truncate max-w-45 block">{quote.proyectoNombre || "Sin proyecto especificad."}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(quote.estado)}</TableCell>
                        <TableCell className="text-right font-black text-xs">
                          {formatCurrency(quote.monto)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadExcel(quote)}
                              className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary"
                              title="Descargar Excel/PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditQuote(quote)}
                              className="h-7 w-7 rounded-lg hover:bg-blue-500/10 hover:text-blue-600"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteQuote(quote)}
                              className="h-7 w-7 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {filteredQuotes.length > 0 && (
              <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Página {currentPage} de {totalPages || 1} ({filteredQuotes.length} cotizaciones)
                </span>
                <div className="flex items-center gap-2">
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
          </div>
        </div>

        {/* Panel lateral derecho (Vista Rápida) */}
        <div className="lg:col-span-1 border border-border/50 rounded-2xl overflow-hidden shadow-xs h-187.5 sticky top-6">
          <QuotePreviewPanel
            quote={selectedQuote}
            onDownload={handleDownloadExcel}
            onStatusChange={handleStatusChange}
            onViewFull={handleEditQuote}
            onEdit={handleEditQuote}
            onDuplicate={handleDuplicateQuote}
            onDelete={handleDeleteQuote}
            onUpload={(q) => {
              setUploadQuoteTarget(q)
              setUploadDialogOpen(true)
            }}
            isUpdating={updatingQuoteId === selectedQuote?.id}
          />
        </div>
      </div>

      {/* DIÁLOGOS DE APOYO */}
      <CreateQuoteDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        user={user}
        initialData={editingQuote}
        onSuccess={() => fetchQuotes()}
      />

      {/* Diálogo para reemplazar archivo */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reemplazar Documento Excel/PDF</DialogTitle>
            <DialogDescription>
              Sube el archivo final que sustituirá al documento actual de COT-{uploadQuoteTarget?.numero}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <Input type="file" accept=".xlsx,.xls,.pdf" disabled={isUploading} onChange={handleFileSelect} className="text-xs" />
            {isUploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo documento...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
