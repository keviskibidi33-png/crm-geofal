"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ExternalLink, FileUp, Loader2, Plus, Search, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { logActionClient as logAction } from "@/lib/audit-client"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { ensayosData, searchEnsayos, type EnsayoItem } from "@/data/ensayos-data"
import { CreateProjectDialog } from "./create-project-dialog"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

type QuoteItem = {
  codigo: string
  descripcion: string
  norma: string
  acreditado: string
  costo_unitario: number
  cantidad: number
  ensayoData?: EnsayoItem
}

type Condicion = { id: string; texto: string; categoria?: string; orden?: number }

type QuoteSource = {
  id?: string
  numero?: string | number
  year?: number
  cliente?: string
  clienteRuc?: string
  clienteContacto?: string
  clienteEmail?: string
  clienteTelefono?: string
  proyectoNombre?: string
  itemsJson?: any[]
  condicionesTextos?: string[]
  condicionesIds?: string[]
  plazoDias?: number
  condicionPago?: string
  correoVendedor?: string
  telefonoComercial?: string
  clienteId?: string
  proyectoId?: string
  ubicacion?: string
}

interface CreateQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: { id: string; name: string; email?: string; phone?: string }
  onSuccess?: () => void
  proyectoId?: string
  clienteId?: string
  quoteId?: string
  duplicateSourceQuote?: QuoteSource | null
}

const emptyItem = (): QuoteItem => ({
  codigo: "",
  descripcion: "",
  norma: "",
  acreditado: "SI",
  costo_unitario: 0,
  cantidad: 1,
})

const dragHandle = (
  <div className="grid grid-cols-2 gap-0.5 h-4 w-3 shrink-0 opacity-70">
    {Array.from({ length: 6 }).map((_, i) => (
      <span key={i} className="h-1 w-1 rounded-full bg-muted-foreground/80" />
    ))}
  </div>
)

const DRAFT_VERSION = 2

const makeDraftKey = (userId?: string, quoteId?: string) => `crm-geofal-cotizacion-draft:v${DRAFT_VERSION}:${userId || "anon"}:${quoteId || "new"}`

const randomNumericCode = (length = 3) => {
  const max = 10 ** length
  return String(Math.floor(Math.random() * max)).padStart(length, "0")
}

export function CreateQuoteDialog({ open, onOpenChange, user, onSuccess, proyectoId, clienteId, quoteId, duplicateSourceQuote }: CreateQuoteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importingExcel, setImportingExcel] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importNumero, setImportNumero] = useState("")
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [cliente, setCliente] = useState("")
  const [ruc, setRuc] = useState("")
  const [contacto, setContacto] = useState("")
  const [telefono, setTelefono] = useState("")
  const [correo, setCorreo] = useState("")
  const [proyecto, setProyecto] = useState("")
  const [ubicacion, setUbicacion] = useState("")
  const [numero, setNumero] = useState("")
  const [year, setYear] = useState(new Date().getFullYear())
  const [clienteSearch, setClienteSearch] = useState("")
  const [proyectoSearch, setProyectoSearch] = useState("")
  const [clientes, setClientes] = useState<any[]>([])
  const [proyectos, setProyectos] = useState<any[]>([])
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [showProyectoDropdown, setShowProyectoDropdown] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<any | null>(null)
  const [selectedProyecto, setSelectedProyecto] = useState<any | null>(null)
  const [condiciones, setCondiciones] = useState<Condicion[]>([])
  const [selectedCondiciones, setSelectedCondiciones] = useState<string[]>([])
  const [showCondicionesModal, setShowCondicionesModal] = useState(false)
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [hasHydratedSource, setHasHydratedSource] = useState(false)
  const [pendingConditionTexts, setPendingConditionTexts] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const draftKey = useMemo(() => makeDraftKey(user?.id, quoteId), [quoteId, user?.id])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.costo_unitario || 0) * Number(item.cantidad || 0), 0), [items])
  const igv = subtotal * 0.18
  const total = subtotal + igv

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.removeItem(draftKey)
  }, [draftKey])

  const formatQuoteNumber = useCallback((value: string, currentYear = year) => {
    const digits = value.replace(/\D/g, "")
    if (!digits) return ""
    const suffix = String(currentYear).slice(-2)
    return `COT-${digits}-${suffix}`
  }, [year])

  const hydrateQuote = useCallback((data: QuoteSource, opts?: { keepClientProject?: boolean; duplicate?: boolean }) => {
    const keepClientProject = opts?.keepClientProject ?? false
    const isDuplicate = opts?.duplicate ?? false
    const derivedNumero = String(data.numero || "").replace(/\D/g, "")
    const fallbackNumero = `${randomNumericCode(3)}`

    setNumero(isDuplicate ? formatQuoteNumber(fallbackNumero, Number(data.year || new Date().getFullYear())) : (derivedNumero ? formatQuoteNumber(derivedNumero, Number(data.year || new Date().getFullYear())) : ""))
    setYear(Number(data.year || new Date().getFullYear()))
    setCliente(keepClientProject ? (data.cliente || "") : (isDuplicate ? "" : (data.cliente || "")))
    setRuc(keepClientProject ? (data.clienteRuc || "") : (isDuplicate ? "" : (data.clienteRuc || "")))
    setContacto(keepClientProject ? (data.clienteContacto || "") : (isDuplicate ? "" : (data.clienteContacto || "")))
    setTelefono(keepClientProject ? (data.clienteTelefono || "") : (isDuplicate ? "" : (data.clienteTelefono || "")))
    setCorreo(keepClientProject ? (data.clienteEmail || "") : (isDuplicate ? "" : (data.clienteEmail || "")))
    setProyecto(keepClientProject ? (data.proyectoNombre || "") : (isDuplicate ? "" : (data.proyectoNombre || "")))
    setUbicacion(keepClientProject ? (data.ubicacion || "") : (isDuplicate ? "" : (data.ubicacion || "")))
    setClienteSearch(keepClientProject ? (data.cliente || "") : (isDuplicate ? "" : (data.cliente || "")))
    setProyectoSearch(keepClientProject ? (data.proyectoNombre || "") : (isDuplicate ? "" : (data.proyectoNombre || "")))
    setItems(Array.isArray(data.itemsJson) && data.itemsJson.length > 0 ? data.itemsJson.map((it: any) => ({
      codigo: String(it.codigo || ""),
      descripcion: String(it.descripcion || ""),
      norma: String(it.norma || ""),
      acreditado: String(it.acreditado || "SI"),
      costo_unitario: Number(it.costo_unitario || 0),
      cantidad: Number(it.cantidad || 1),
    })) : [emptyItem()])
    setSelectedCondiciones(Array.isArray(data.condicionesIds) ? data.condicionesIds.map(String) : [])
    setPendingConditionTexts(Array.isArray(data.condicionesTextos) ? data.condicionesTextos.map(String) : [])

    if (isDuplicate || !keepClientProject) {
      setSelectedCliente(null)
      setSelectedProyecto(null)
      setCliente("")
      setRuc("")
      setContacto("")
      setTelefono("")
      setCorreo("")
      setProyecto("")
      setUbicacion("")
      setClienteSearch("")
      setProyectoSearch("")
    }
  }, [])

  const loadQuote = useCallback(async () => {
    if (!quoteId) return
    setLoading(true)
    try {
      const resp = await authFetch(`${API_URL}/quotes/${quoteId}`)
      if (!resp.ok) throw new Error(await resp.text())
      const payload = await resp.json()
      const data = payload?.data ?? {}
      hydrateQuote({
        id: data.id,
        numero: data.numero,
        year: data.year,
        cliente: data.cliente,
        clienteRuc: data.ruc,
        clienteContacto: data.contacto,
        clienteEmail: data.email,
        clienteTelefono: data.telefono,
        proyectoNombre: data.proyecto,
        ubicacion: data.ubicacion,
        itemsJson: data.items_json,
        condicionesIds: data.condiciones_ids,
        plazoDias: data.plazo_dias,
        condicionPago: data.condicion_pago,
        correoVendedor: data.correo_vendedor,
        telefonoComercial: data.telefono_comercial,
        clienteId: data.cliente_id,
        proyectoId: data.proyecto_id,
      }, { keepClientProject: true })
    } catch (error: any) {
      toast.error("No se pudo cargar la cotización", { description: error?.message || "Error desconocido" })
    } finally {
      setLoading(false)
    }
  }, [hydrateQuote, quoteId])

  const searchClientes = useCallback(async (search: string) => {
    if (search.trim().length < 2) {
      setClientes([])
      setShowClienteDropdown(false)
      return
    }
    try {
      const resp = await authFetch(`${API_URL}/clientes?search=${encodeURIComponent(search)}`)
      const payload = await resp.json().catch(() => ({}))
      setClientes(Array.isArray(payload?.data) ? payload.data : [])
      setShowClienteDropdown(true)
    } catch {
      setClientes([])
    }
  }, [])

  const searchProyectos = useCallback(async (clienteId?: string, search?: string) => {
    const normalized = (search ?? proyectoSearch).trim()
    if (normalized.length < 2 && !clienteId) {
      setProyectos([])
      setShowProyectoDropdown(false)
      return
    }
    try {
      const params = new URLSearchParams()
      if (clienteId) params.set("cliente_id", clienteId)
      if (normalized) params.set("search", normalized)
      const resp = await authFetch(`${API_URL}/proyectos?${params.toString()}`)
      const payload = await resp.json().catch(() => ({}))
      setProyectos(Array.isArray(payload?.data) ? payload.data : [])
      setShowProyectoDropdown(true)
    } catch {
      setProyectos([])
    }
  }, [proyectoSearch])

  const loadCondiciones = useCallback(async () => {
    try {
      const resp = await authFetch(`${API_URL}/condiciones`)
      const payload = await resp.json().catch(() => ({}))
      setCondiciones(Array.isArray(payload?.data) ? payload.data : [])
    } catch {
      setCondiciones([])
    }
  }, [])

  const restoreDraft = useCallback(() => {
    if (quoteId || duplicateSourceQuote) return false
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return false
      const parsed = JSON.parse(raw)
      if (parsed?.version !== DRAFT_VERSION) return false
      if (parsed?.payload) {
        const shouldRestore = window.confirm("Se encontró un borrador guardado. ¿Deseas restaurarlo?")
        if (!shouldRestore) return false
        const payload = parsed.payload
        setNumero(payload.numero || "")
        setYear(Number(payload.year || new Date().getFullYear()))
        setCliente(payload.cliente || "")
        setRuc(payload.ruc || "")
        setContacto(payload.contacto || "")
        setTelefono(payload.telefono || "")
        setCorreo(payload.correo || "")
        setProyecto(payload.proyecto || "")
        setUbicacion(payload.ubicacion || "")
        setClienteSearch(payload.clienteSearch || payload.cliente || "")
        setProyectoSearch(payload.proyectoSearch || payload.proyecto || "")
        setItems(Array.isArray(payload.items) && payload.items.length > 0 ? payload.items : [emptyItem()])
        setSelectedCondiciones(Array.isArray(payload.selectedCondiciones) ? payload.selectedCondiciones : [])
        setSelectedCliente(payload.selectedCliente || null)
        setSelectedProyecto(payload.selectedProyecto || null)
        return true
      }
    } catch {
      return false
    }
    return false
  }, [draftKey, duplicateSourceQuote, quoteId])

  useEffect(() => {
    if (!open) {
      setHasHydratedSource(false)
      return
    }
    if (!open) return
    void loadQuote()
    void loadCondiciones()
    if (!quoteId && !duplicateSourceQuote) {
      restoreDraft()
    }
    if (duplicateSourceQuote && !hasHydratedSource) {
      hydrateQuote({
        ...duplicateSourceQuote,
        numero: `${randomNumericCode(3)}`,
      }, { duplicate: true })
      setHasHydratedSource(true)
    }
  }, [duplicateSourceQuote, hasHydratedSource, hydrateQuote, loadCondiciones, loadQuote, open, quoteId, restoreDraft])

  useEffect(() => {
    if (condiciones.length === 0 || pendingConditionTexts.length === 0 || selectedCondiciones.length > 0) return
    const normalized = (value: string) => value.trim().toLowerCase()
    const mapped = condiciones
      .filter((cond) => pendingConditionTexts.some((text) => normalized(text) === normalized(cond.texto)))
      .map((cond) => cond.id)
    if (mapped.length > 0) {
      setSelectedCondiciones(mapped)
    }
  }, [condiciones, pendingConditionTexts, selectedCondiciones.length])

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchClientes(clienteSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteSearch, searchClientes])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (proyectoSearch.trim().length >= 2 || selectedCliente) {
        void searchProyectos(selectedCliente?.id, proyectoSearch)
      } else {
        setProyectos([])
        setShowProyectoDropdown(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [proyectoSearch, searchProyectos, selectedCliente])

  const updateItem = (index: number, patch: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const addEnsayoWithRelated = (index: number, ensayo: EnsayoItem) => {
    const related = searchEnsayos(ensayo.codigo)
    const mainItem: QuoteItem = {
      codigo: ensayo.codigo,
      descripcion: ensayo.descripcion,
      norma: ensayo.norma,
      acreditado: ensayo.acreditado,
      costo_unitario: Number(ensayo.precio || 0),
      cantidad: 1,
      ensayoData: ensayo,
    }
    setItems((prev) => {
      const next = [...prev]
      next[index] = mainItem
      related.forEach((rel) => {
        if (rel.codigo === ensayo.codigo) return
        next.push({
          codigo: rel.codigo,
          descripcion: rel.descripcion,
          norma: rel.norma,
          acreditado: rel.acreditado,
          costo_unitario: Number(rel.precio || 0),
          cantidad: 1,
          ensayoData: rel,
        })
      })
      return next
    })
  }

  useEffect(() => {
    if (!open || quoteId || duplicateSourceQuote) return
    const timer = setTimeout(() => {
      const payload = {
        version: DRAFT_VERSION,
        savedAt: new Date().toISOString(),
        payload: {
          numero,
          year,
          cliente,
          ruc,
          contacto,
          telefono,
          correo,
          proyecto,
          ubicacion,
          clienteSearch,
          proyectoSearch,
          items,
          selectedCondiciones,
          selectedCliente,
          selectedProyecto,
        },
      }
      localStorage.setItem(draftKey, JSON.stringify(payload))
    }, 500)
    return () => clearTimeout(timer)
  }, [cliente, clienteSearch, correo, draftKey, duplicateSourceQuote, items, numero, open, proyecto, proyectoSearch, quoteId, ruc, selectedCliente, selectedCondiciones, selectedProyecto, telefono, ubicacion, year, contacto])

  const selectCliente = (clienteData: any) => {
    setSelectedCliente(clienteData)
    setCliente(clienteData?.nombre || "")
    setClienteSearch(clienteData?.nombre || "")
    setRuc(clienteData?.ruc || "")
    setContacto(clienteData?.contacto || "")
    setTelefono(clienteData?.telefono || "")
    setCorreo(clienteData?.email || "")
    setProyecto("")
    setProyectoSearch("")
    setUbicacion("")
    setSelectedProyecto(null)
    setShowClienteDropdown(false)
    setProyectos([])
    void searchProyectos(clienteData?.id, "")
  }

  const selectProyecto = (proyectoData: any) => {
    setSelectedProyecto(proyectoData)
    setProyecto(proyectoData?.nombre || "")
    setProyectoSearch(proyectoData?.nombre || "")
    setUbicacion(proyectoData?.ubicacion || proyectoData?.direccion || "")
    setShowProyectoDropdown(false)
  }

  const moveItem = (from: number, to: number) => {
    setItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((item, index) => ({
        ...item,
        codigo: item.codigo || `${String(index + 1).padStart(2, "0")}`,
      }))
    })
  }

  const handleNumeroChange = (value: string) => {
    const digits = value.replace(/\D/g, "")
    if (!digits) {
      setNumero("")
      return
    }
    setNumero(formatQuoteNumber(digits))
  }

  const handleImportFile = async (file: File) => {
    setLoadingPreview(true)
    setImportOpen(true)
    setImportFile(file)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const resp = await authFetch(`${API_URL}/import-excel/preview`, { method: "POST", body: formData })
      const payload = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(payload?.detail || payload?.message || `HTTP ${resp.status}`)
      setImportPreview(payload.preview || payload)
      const suggested = payload?.preview?.suggested_numero || payload?.suggested_numero || ""
      setImportNumero(String(suggested || ""))
      toast.success("Excel analizado")
    } catch (error: any) {
      toast.error("No se pudo analizar el Excel", { description: error?.message || "Error desconocido" })
      setImportOpen(false)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error("Agrega al menos un ítem")
      return
    }
    setSaving(true)
    try {
      const body = {
        cotizacion_numero: numero || undefined,
        fecha_emision: undefined,
        cliente: cliente || undefined,
        ruc: ruc || undefined,
        contacto: contacto || undefined,
        telefono_contacto: telefono || undefined,
        correo: correo || undefined,
        proyecto: proyecto || undefined,
        ubicacion: ubicacion || undefined,
        user_id: user?.id,
        proyecto_id: selectedProyecto?.id || proyectoId,
        cliente_id: selectedCliente?.id || clienteId,
        include_igv: true,
        condiciones_ids: selectedCondiciones,
        items: items.map((item) => ({
          codigo: item.codigo || "",
          descripcion: item.descripcion,
          norma: item.norma || null,
          acreditado: item.acreditado || null,
          costo_unitario: Number(item.costo_unitario || 0),
          cantidad: Number(item.cantidad || 1),
        })),
      }

      const resp = await authFetch(`${API_URL}/export/xlsx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "")
        throw new Error(errorText || `HTTP ${resp.status}`)
      }

      const blob = await resp.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `COT-${year}-${numero || "nuevo"}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

      if (user) {
        logAction({
          user_id: user.id,
          user_name: user.name,
          action: quoteId ? "Actualizó cotización nativa" : "Creó cotización nativa",
          module: "COTIZACIONES",
          details: { numero, year, items: items.length, total },
        })
      }

      toast.success("Cotización procesada correctamente")
      clearDraft()
      setPendingConditionTexts([])
      onSuccess?.()
      onOpenChange(false)
    } catch (error: any) {
      toast.error("No se pudo guardar la cotización", { description: error?.message || "Error desconocido" })
    } finally {
      setSaving(false)
    }
  }

  const handleImportConfirm = async () => {
    if (!importFile) return
    setImportingExcel(true)
    try {
      const formData = new FormData()
      formData.append("file", importFile)
      if (importNumero) formData.append("numero", importNumero)
      const resp = await authFetch(`${API_URL}/import-excel`, { method: "POST", body: formData })
      const payload = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(payload?.detail || payload?.message || `HTTP ${resp.status}`)
      toast.success("Excel importado")
      onSuccess?.()
      clearDraft()
      setPendingConditionTexts([])
      setImportOpen(false)
    } catch (error: any) {
      toast.error("No se pudo importar el Excel", { description: error?.message || "Error desconocido" })
    } finally {
      setImportingExcel(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[100vw] w-[100vw] h-[100vh] p-0 overflow-hidden rounded-none sm:rounded-none">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle>{quoteId ? "Editar cotización" : "Nueva cotización"}</DialogTitle>
                <DialogDescription>
                  Módulo nativo integrado en el CRM para cotizar, importar y reordenar ítems sin iframe.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Nativo</Badge>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Importar Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="h-full overflow-y-auto">
            <div className="p-6 space-y-6 max-w-7xl mx-auto">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Número de cotización</Label>
                      <Input value={numero} onChange={(e) => handleNumeroChange(e.target.value)} placeholder={`COT-23232-${String(year).slice(-2)}`} />
                    </div>
                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))} />
                    </div>
                    <div className="space-y-2 relative">
                      <Label className="flex items-center gap-2"><Search className="h-4 w-4" /> Cliente / Empresa</Label>
                      <Input
                        value={clienteSearch}
                        onChange={(e) => {
                          setClienteSearch(e.target.value)
                          setCliente(e.target.value)
                          setShowClienteDropdown(true)
                        }}
                        onFocus={() => setShowClienteDropdown(true)}
                        placeholder="Buscar cliente..."
                        autoComplete="off"
                      />
                      {showClienteDropdown && clientes.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto overscroll-contain rounded-md border bg-background shadow-lg">
                          {clientes.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                              onClick={() => selectCliente(c)}
                            >
                              <div className="font-medium">{c.nombre}</div>
                              {c.ruc ? <div className="text-xs text-muted-foreground">RUC: {c.ruc}</div> : null}
                            </button>
                          ))}
                          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
                            Selecciona un cliente para sugerir proyectos.
                          </div>
                        </div>
                      )}
                      {showClienteDropdown && clienteSearch.trim().length >= 2 && clientes.length === 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-md border bg-background p-3 shadow-lg text-sm">
                          <button
                            type="button"
                            className="text-primary"
                            onClick={() => {
                              setSelectedCliente(null)
                              setCliente(clienteSearch)
                              setShowClienteDropdown(false)
                            }}
                          >
                            <Plus className="inline h-3 w-3 mr-1" />
                            Crear "{clienteSearch}"
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>RUC</Label>
                      <Input value={ruc} onChange={(e) => setRuc(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Contacto</Label>
                      <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono</Label>
                      <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Correo</Label>
                      <Input value={correo} onChange={(e) => setCorreo(e.target.value)} />
                    </div>
                    <div className="space-y-2 relative">
                      <Label className="flex items-center gap-2"><Search className="h-4 w-4" /> Proyecto</Label>
                      <Input
                        value={proyectoSearch}
                        onChange={(e) => {
                          setProyectoSearch(e.target.value)
                          setProyecto(e.target.value)
                          setShowProyectoDropdown(true)
                        }}
                        onFocus={() => setShowProyectoDropdown(true)}
                        placeholder={selectedCliente ? "Buscar proyecto..." : "Busca proyecto o selecciona cliente"}
                        autoComplete="off"
                      />
                      {showProyectoDropdown && proyectos.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto overscroll-contain rounded-md border bg-background shadow-lg">
                          {proyectos.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                              onClick={() => selectProyecto(p)}
                            >
                              <div className="font-medium">{p.nombre}</div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span>{p.ubicacion || p.direccion || ""}</span>
                                {p.cliente_nombre ? <span>{p.cliente_nombre}</span> : null}
                              </div>
                            </button>
                          ))}
                          {selectedCliente ? (
                            <button
                              type="button"
                              className="w-full border-t px-3 py-2 text-left text-xs text-primary hover:bg-muted"
                          onClick={() => setShowCreateProjectDialog(true)}
                        >
                          <Plus className="inline h-3 w-3 mr-1" />
                          Crear nuevo proyecto para {selectedCliente.nombre}
                        </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Textarea value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} rows={2} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Condiciones específicas</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowCondicionesModal(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Gestionar
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-md border bg-background p-3 space-y-2">
                      {condiciones.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Cargando condiciones...</p>
                      ) : (
                        condiciones.map((cond) => (
                          <label key={cond.id} className="flex items-start gap-2 rounded p-2 hover:bg-muted cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={selectedCondiciones.includes(cond.id)}
                              onChange={(e) => {
                                setSelectedCondiciones((prev) =>
                                  e.target.checked ? [...prev, cond.id] : prev.filter((id) => id !== cond.id)
                                )
                              }}
                            />
                            <span className="text-xs text-foreground">{cond.texto}</span>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedCondiciones.length > 0 && (
                      <p className="text-xs text-primary">{selectedCondiciones.length} condición(es) seleccionada(s)</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-semibold">Ítems</h3>
                      <p className="text-sm text-muted-foreground">Arrastra con el handle de 3 puntitos para reordenar.</p>
                    </div>
                    <Button onClick={() => setItems((prev) => [...prev, emptyItem()])}>
                      <Plus className="mr-2 h-4 w-4" />
                      Agregar ítem
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10" />
                          <TableHead>Código</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead>Norma</TableHead>
                          <TableHead>Acreditado</TableHead>
                          <TableHead className="text-right">Costo unitario</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Parcial</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow
                            key={`${index}-${item.descripcion}`}
                            draggable
                            onDragStart={() => setDragIndex(index)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => dragIndex !== null && dragIndex !== index && moveItem(dragIndex, index)}
                          >
                            <TableCell className="align-top">{dragHandle}</TableCell>
                            <TableCell className="align-top">
                              <AutocompleteInput
                                value={item.codigo}
                                onChange={(value) => updateItem(index, { codigo: value })}
                                onSelect={(ensayo: EnsayoItem) => addEnsayoWithRelated(index, ensayo)}
                                suggestions={ensayosData}
                                placeholder="Código"
                                displayField="descripcion"
                                codeField="codigo"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <AutocompleteInput
                                value={item.descripcion}
                                onChange={(value) => updateItem(index, { descripcion: value })}
                                onSelect={(ensayo: EnsayoItem) => addEnsayoWithRelated(index, ensayo)}
                                suggestions={ensayosData}
                                placeholder="Descripción"
                                displayField="descripcion"
                                codeField="codigo"
                              />
                            </TableCell>
                            <TableCell className="align-top"><Input value={item.norma} onChange={(e) => updateItem(index, { norma: e.target.value })} /></TableCell>
                            <TableCell className="align-top"><Input value={item.acreditado} onChange={(e) => updateItem(index, { acreditado: e.target.value })} /></TableCell>
                            <TableCell className="align-top"><Input type="number" value={item.costo_unitario} onChange={(e) => updateItem(index, { costo_unitario: Number(e.target.value) })} className="text-right" /></TableCell>
                            <TableCell className="align-top"><Input type="number" value={item.cantidad} onChange={(e) => updateItem(index, { cantidad: Number(e.target.value) })} className="text-right" /></TableCell>
                            <TableCell className="align-top text-right font-medium">S/. {(item.costo_unitario * item.cantidad).toFixed(2)}</TableCell>
                            <TableCell className="align-top">
                              <Button variant="ghost" size="icon" onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Acciones rápidas</h3>
                  </div>
                  <Button className="w-full" onClick={handleSave} disabled={saving || loading}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                    {quoteId ? "Actualizar y exportar" : "Guardar y exportar"}
                  </Button>
                  <div className="rounded-xl bg-background p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><strong>S/. {subtotal.toFixed(2)}</strong></div>
                    <div className="flex justify-between"><span>IGV</span><strong>S/. {igv.toFixed(2)}</strong></div>
                    <div className="flex justify-between border-t pt-2"><span>Total</span><strong>S/. {total.toFixed(2)}</strong></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CreateProjectDialog
        open={showCreateProjectDialog}
        onOpenChange={setShowCreateProjectDialog}
        user={user as any}
        initialCliente={selectedCliente ? { id: selectedCliente.id, nombre: selectedCliente.nombre, ruc: selectedCliente.ruc } : null}
        onSuccess={() => {
          void searchProyectos(selectedCliente?.id, proyectoSearch)
        }}
      />

      <Dialog open={showCondicionesModal} onOpenChange={setShowCondicionesModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Condiciones específicas</DialogTitle>
            <DialogDescription>Selecciona las condiciones que formarán parte de la cotización.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {condiciones.map((cond) => (
              <label key={cond.id} className="flex items-start gap-2 rounded border p-3 cursor-pointer hover:bg-muted">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selectedCondiciones.includes(cond.id)}
                  onChange={(e) => {
                    setSelectedCondiciones((prev) =>
                      e.target.checked ? [...prev, cond.id] : prev.filter((id) => id !== cond.id)
                    )
                  }}
                />
                <span className="text-sm">{cond.texto}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCondicionesModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Importar cotización desde Excel</DialogTitle>
            <DialogDescription>{importFile ? importFile.name : "Procesando archivo..."}</DialogDescription>
          </DialogHeader>
          {loadingPreview ? (
            <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analizando archivo...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Número sugerido</Label>
                <Input value={importNumero} onChange={(e) => setImportNumero(e.target.value)} />
              </div>
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {JSON.stringify(importPreview?.cliente || importPreview || {}, null, 2)}
              </pre>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImportConfirm} disabled={importingExcel || loadingPreview}>
              {importingExcel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
              Confirmar importación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImportFile(file)
        }}
      />
    </>
  )
}
