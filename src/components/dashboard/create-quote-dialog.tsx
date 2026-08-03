"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ExternalLink, FileUp, Loader2, Plus, Search, Trash2, FolderOpen, ChevronRight, ListFilter, Pencil } from "lucide-react"
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
import { ensayosData, getEnsayosRequeridos, searchEnsayos, type EnsayoItem } from "@/data/ensayos-data"
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
  fechaSolicitud?: string
  fechaEmision?: string
  personalComercial?: string
  includeIgv?: boolean
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

function DragHandle() {
  return (
  <div className="grid grid-cols-2 gap-0.5 h-4 w-3 shrink-0 opacity-70">
    {Array.from({ length: 6 }).map((_, i) => (
      <span key={i} className="h-1 w-1 rounded-full bg-muted-foreground/80" />
    ))}
  </div>
  )
}

const DRAFT_VERSION = 2

const makeDraftKey = (userId?: string, quoteId?: string) => `crm-geofal-cotizacion-draft:v${DRAFT_VERSION}:${userId || "anon"}:${quoteId || "new"}`

const randomNumericCode = (length = 3) => {
  const max = 10 ** length
  return String(Math.floor(Math.random() * max)).padStart(length, "0")
}

const extractQuoteSequence = (value: string, currentYear: number) => {
  const suffix = String(currentYear).slice(-2)
  const withoutPrefix = value.trim().replace(/^(?:COT|OT)-?/i, "")
  const withoutYear = withoutPrefix.replace(new RegExp(`-${suffix}$`), "")
  return withoutYear.replace(/\D/g, "")
}

const formatQuoteNumber = (value: string, currentYear: number) => {
  const digits = extractQuoteSequence(value, currentYear)
  return digits ? `COT-${digits}-${String(currentYear).slice(-2)}` : ""
}

const getSuggestedQuoteSequence = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "")
  return digits || ""
}

const toApiQuoteDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

const getTodayPeru = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

const PAYMENT_OPTIONS = [
  { value: "valorizacion", label: "Valorización mensual" },
  { value: "adelantado", label: "Adelantado" },
  { value: "50_adelanto", label: "50% Adelanto y saldo previo a entrega" },
  { value: "credito_7", label: "Crédito a 7 días" },
  { value: "credito_15", label: "Crédito a 15 días" },
  { value: "credito_30", label: "Crédito a 30 días" },
]

type ConditionItem = { id: string; texto: string; categoria?: string; orden?: number }
type PlantillaCotizacion = {
  id: string
  nombre: string
  descripcion?: string | null
  items_json?: unknown
  condiciones_ids?: unknown
  plazo_dias?: number | null
  condicion_pago?: string | null
  veces_usada?: number | null
  vendedor_id?: string | null
  es_propia?: boolean
  created_at?: string | null
}

const parseArrayValue = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (typeof value !== "string" || !value.trim()) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed as T[] : []
  } catch {
    return []
  }
}

const parseStringArrayValue = (value: unknown) => {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== "string" || !value.trim()) return []

  const trimmed = value.trim()
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseArrayValue<unknown>(trimmed).map(String)
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed.slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^"|"$/g, ""))
      .filter(Boolean)
  }
  return [trimmed]
}

const getPlantillaItems = (plantilla: PlantillaCotizacion) => parseArrayValue<any>(plantilla.items_json)
const getPlantillaConditionIds = (plantilla: PlantillaCotizacion) => parseStringArrayValue(plantilla.condiciones_ids)

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
  const [fechaSolicitud, setFechaSolicitud] = useState(getTodayPeru())
  const [fechaEmision, setFechaEmision] = useState(getTodayPeru())
  const [personalComercial, setPersonalComercial] = useState(user?.name || "")
  const [telefonoComercial, setTelefonoComercial] = useState(user?.phone || "")
  const [correoVendedor, setCorreoVendedor] = useState(user?.email || "")
  const [plazoDias, setPlazoDias] = useState(0)
  const [condicionPago, setCondicionPago] = useState("")
  const [includeIgv, setIncludeIgv] = useState(true)
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
  const [showCreateConditionModal, setShowCreateConditionModal] = useState(false)
  const [conditionSearch, setConditionSearch] = useState("")
  const [newConditionText, setNewConditionText] = useState("")
  const [creatingCondition, setCreatingCondition] = useState(false)
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [hasHydratedSource, setHasHydratedSource] = useState(false)
  const [pendingConditionTexts, setPendingConditionTexts] = useState<string[]>([])
  const [showPlantillasModal, setShowPlantillasModal] = useState(false)
  const [loadingPlantillas, setLoadingPlantillas] = useState(false)
  const [loadingPlantillaId, setLoadingPlantillaId] = useState<string | null>(null)
  const [savingPlantilla, setSavingPlantilla] = useState(false)
  const [plantillas, setPlantillas] = useState<PlantillaCotizacion[]>([])
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string | null>(null)
  const [plantillaSearch, setPlantillaSearch] = useState("")
  const [showPlantillaFormModal, setShowPlantillaFormModal] = useState(false)
  const [plantillaFormMode, setPlantillaFormMode] = useState<"create" | "edit">("create")
  const [plantillaForm, setPlantillaForm] = useState({ nombre: "", descripcion: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skipNextDraftSaveRef = useRef(false)
  const draftKey = useMemo(() => makeDraftKey(user?.id, quoteId), [quoteId, user?.id])

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.costo_unitario || 0) * Number(item.cantidad || 0), 0), [items])
  const igv = includeIgv ? subtotal * 0.18 : 0
  const total = subtotal + igv

  const filteredConditions = useMemo(() => {
    const query = conditionSearch.trim().toLowerCase()
    if (!query) return condiciones
    return condiciones.filter((cond) =>
      `${cond.texto} ${cond.categoria || ""}`.toLowerCase().includes(query)
    )
  }, [conditionSearch, condiciones])

  const filteredPlantillas = useMemo(() => {
    const query = plantillaSearch.trim().toLowerCase()
    if (!query) return plantillas
    return plantillas.filter((plantilla) =>
      `${plantilla.nombre} ${plantilla.descripcion || ""} ${getPlantillaItems(plantilla)
        .map((item: any) => `${item.codigo || ""} ${item.descripcion || ""}`).join(" ")}`
        .toLowerCase()
        .includes(query)
    )
  }, [plantillaSearch, plantillas])

  const selectedPlantilla = useMemo(
    () => plantillas.find((plantilla) => plantilla.id === selectedPlantillaId) || null,
    [plantillas, selectedPlantillaId]
  )
  const selectedPlantillaItems = selectedPlantilla ? getPlantillaItems(selectedPlantilla) : []
  const selectedPlantillaConditionIds = selectedPlantilla ? getPlantillaConditionIds(selectedPlantilla) : []

  const currentPlantillaPayload = useMemo(() => ({
    nombre: plantillaForm.nombre.trim(),
    descripcion: plantillaForm.descripcion.trim(),
    vendedor_id: user?.id,
    items: items.map((item) => ({
      codigo: item.codigo || "",
      descripcion: item.descripcion || "",
      norma: item.norma || "",
      acreditado: item.acreditado || "SI",
      costo_unitario: Number(item.costo_unitario || 0),
      cantidad: Number(item.cantidad || 1),
    })),
    condiciones_ids: selectedCondiciones,
    plazo_dias: plazoDias || 0,
    condicion_pago: condicionPago || "",
  }), [condicionPago, items, plazoDias, plantillaForm.descripcion, plantillaForm.nombre, selectedCondiciones, user?.id])

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return
    localStorage.removeItem(draftKey)
  }, [draftKey])

  const loadPlantillas = useCallback(async () => {
    if (!user?.id) return
    setLoadingPlantillas(true)
    try {
      const resp = await authFetch(
        `${API_URL}/plantillas?vendedor_id=${encodeURIComponent(user.id)}&incluir_compartidas=true`
      )
      const payload = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(payload?.detail || "No se pudieron cargar las plantillas")
      const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
      setPlantillas(data)
      setSelectedPlantillaId((current) => current || data[0]?.id || null)
    } catch (error: any) {
      toast.error("No se pudieron cargar las plantillas", {
        description: error?.message || "Error desconocido",
      })
      setPlantillas([])
      setSelectedPlantillaId(null)
    } finally {
      setLoadingPlantillas(false)
    }
  }, [user?.id])

  const applyPlantilla = useCallback(async (plantillaId: string) => {
    setLoadingPlantillaId(plantillaId)
    try {
      const resp = await authFetch(`${API_URL}/plantillas/${plantillaId}`)
      const payload = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(payload?.detail || "No se pudo recuperar la plantilla")

      const templateItems = parseArrayValue<any>(payload.items_json)
      const itemsFromTemplate = templateItems.length > 0
        ? templateItems.map((item: any) => ({
            codigo: String(item.codigo || ""),
            descripcion: String(item.descripcion || ""),
            norma: String(item.norma || ""),
            acreditado: String(item.acreditado || "SI"),
            costo_unitario: Number(item.costo_unitario ?? item.precio ?? 0),
            cantidad: Number(item.cantidad || 1),
            ensayoData: item.ensayoData,
          }))
        : [emptyItem()]

      setItems(itemsFromTemplate)
      setSelectedCondiciones(parseStringArrayValue(payload.condiciones_ids))
      setPendingConditionTexts([])
      setPlazoDias(Number(payload.plazo_dias || 0))
      setCondicionPago(payload.condicion_pago || "")
      setShowPlantillasModal(false)
      toast.success(`Plantilla "${payload.nombre}" cargada`)
    } catch (error: any) {
      toast.error("No se pudo cargar la plantilla", {
        description: error?.message || "Error desconocido",
      })
    } finally {
      setLoadingPlantillaId(null)
    }
  }, [])

  const openCreatePlantillaForm = useCallback(() => {
    setPlantillaFormMode("create")
    setPlantillaForm({
      nombre: `Plantilla ${new Date().getFullYear()}`,
      descripcion: "",
    })
    setShowPlantillaFormModal(true)
  }, [])

  const openEditPlantillaForm = useCallback(() => {
    if (!selectedPlantilla) return
    setPlantillaFormMode("edit")
    setPlantillaForm({
      nombre: selectedPlantilla.nombre || "",
      descripcion: selectedPlantilla.descripcion || "",
    })
    setShowPlantillaFormModal(true)
  }, [selectedPlantilla])

  const submitPlantillaForm = useCallback(async () => {
    if (!user?.id) return
    if (!currentPlantillaPayload.nombre) {
      toast.error("Escribe un nombre para la plantilla")
      return
    }

    const isEdit = plantillaFormMode === "edit" && selectedPlantillaId
    const url = isEdit ? `${API_URL}/plantillas/${selectedPlantillaId}` : `${API_URL}/plantillas`
    const method = isEdit ? "PUT" : "POST"
    setSavingPlantilla(true)
    try {
      const resp = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPlantillaPayload),
      })
      const payload = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(payload?.detail || "No se pudo guardar la plantilla")

      toast.success(isEdit ? "Plantilla actualizada" : "Plantilla guardada")
      setShowPlantillaFormModal(false)
      await loadPlantillas()
    } catch (error: any) {
      toast.error("No se pudo guardar la plantilla", {
        description: error?.message || "Error desconocido",
      })
    } finally {
      setSavingPlantilla(false)
    }
  }, [API_URL, currentPlantillaPayload, loadPlantillas, plantillaFormMode, selectedPlantillaId, user?.id])

  const deleteSelectedPlantilla = useCallback(async () => {
    if (!selectedPlantillaId) return
    const target = selectedPlantilla?.nombre || "esta plantilla"
    if (!window.confirm(`¿Eliminar ${target}?`)) return
    setLoadingPlantillaId(selectedPlantillaId)
    try {
      const resp = await authFetch(`${API_URL}/plantillas/${selectedPlantillaId}`, { method: "DELETE" })
      const payload = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(payload?.detail || "No se pudo eliminar la plantilla")
      toast.success("Plantilla eliminada")
      setSelectedPlantillaId(null)
      await loadPlantillas()
    } catch (error: any) {
      toast.error("No se pudo eliminar la plantilla", {
        description: error?.message || "Error desconocido",
      })
    } finally {
      setLoadingPlantillaId(null)
    }
  }, [loadPlantillas, selectedPlantilla, selectedPlantillaId])

  const hydrateQuote = useCallback((data: QuoteSource, opts?: { keepClientProject?: boolean; duplicate?: boolean }) => {
    const keepClientProject = opts?.keepClientProject ?? false
    const isDuplicate = opts?.duplicate ?? false
    const derivedNumero = extractQuoteSequence(String(data.numero || ""), Number(data.year || new Date().getFullYear()))
    const fallbackNumero = `${randomNumericCode(3)}`

    setNumero(isDuplicate ? (derivedNumero || fallbackNumero) : derivedNumero)
    setYear(Number(data.year || new Date().getFullYear()))
    setCliente(keepClientProject ? (data.cliente || "") : "")
    setRuc(keepClientProject ? (data.clienteRuc || "") : "")
    setContacto(keepClientProject ? (data.clienteContacto || "") : "")
    setTelefono(keepClientProject ? (data.clienteTelefono || "") : "")
    setCorreo(keepClientProject ? (data.clienteEmail || "") : "")
    setProyecto(keepClientProject ? (data.proyectoNombre || "") : "")
    setUbicacion(keepClientProject ? (data.ubicacion || "") : "")
    setClienteSearch(keepClientProject ? (data.cliente || "") : "")
    setProyectoSearch(keepClientProject ? (data.proyectoNombre || "") : "")
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
    setPlazoDias(Number(data.plazoDias || 0))
    setCondicionPago(data.condicionPago || "")
    setCorreoVendedor(data.correoVendedor || user?.email || "")
    setTelefonoComercial(data.telefonoComercial || user?.phone || "")
    setPersonalComercial(data.personalComercial || user?.name || "")
    setFechaSolicitud(data.fechaSolicitud || getTodayPeru())
    setFechaEmision(data.fechaEmision || getTodayPeru())
    setIncludeIgv(typeof data.includeIgv === "boolean" ? data.includeIgv : true)

    setSelectedCliente(keepClientProject && data.clienteId ? {
      id: data.clienteId,
      nombre: data.cliente || "",
      ruc: data.clienteRuc || "",
      contacto: data.clienteContacto || "",
      telefono: data.clienteTelefono || "",
      email: data.clienteEmail || "",
    } : null)
    setSelectedProyecto(keepClientProject && data.proyectoId ? {
      id: data.proyectoId,
      nombre: data.proyectoNombre || "",
      ubicacion: data.ubicacion || "",
    } : null)
  }, [user?.email, user?.name, user?.phone])

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
        fechaSolicitud: data.fecha_solicitud,
        fechaEmision: data.fecha_emision,
        personalComercial: data.personal_comercial,
        includeIgv: data.include_igv,
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
        const payload = parsed.payload
        const draftYear = Number(payload.year || new Date().getFullYear())
        setNumero(extractQuoteSequence(String(payload.numero || ""), draftYear))
        setYear(draftYear)
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
        setFechaSolicitud(payload.fechaSolicitud || getTodayPeru())
        setFechaEmision(payload.fechaEmision || getTodayPeru())
        setPersonalComercial(payload.personalComercial || user?.name || "")
        setTelefonoComercial(payload.telefonoComercial || user?.phone || "")
        setCorreoVendedor(payload.correoVendedor || user?.email || "")
        setPlazoDias(Number(payload.plazoDias || 0))
        setCondicionPago(payload.condicionPago || "")
        setIncludeIgv(typeof payload.includeIgv === "boolean" ? payload.includeIgv : true)
        return true
      }
    } catch {
      return false
    }
    return false
  }, [draftKey, duplicateSourceQuote, quoteId, user?.email, user?.name, user?.phone])

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
      hydrateQuote(duplicateSourceQuote, { duplicate: true, keepClientProject: true })
      setHasHydratedSource(true)
    }
  }, [duplicateSourceQuote, hasHydratedSource, hydrateQuote, loadCondiciones, loadQuote, open, quoteId, restoreDraft])

  useEffect(() => {
    if (fechaEmision) {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaEmision)
      if (match) {
        setYear(Number(match[1]))
      } else {
        const matchSlash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fechaEmision)
        if (matchSlash) {
          setYear(Number(matchSlash[3]))
        }
      }
    }
  }, [fechaEmision])

  const openPlantillasModal = useCallback(() => {
    setShowPlantillasModal(true)
    void loadPlantillas()
  }, [loadPlantillas])

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
    const related = getEnsayosRequeridos(ensayo.codigo)
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
    if (skipNextDraftSaveRef.current) {
      skipNextDraftSaveRef.current = false
      return
    }
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
          fechaSolicitud,
          fechaEmision,
          personalComercial,
          telefonoComercial,
          correoVendedor,
          plazoDias,
          condicionPago,
          includeIgv,
        },
      }
      localStorage.setItem(draftKey, JSON.stringify(payload))
    }, 500)
    return () => clearTimeout(timer)
  }, [cliente, clienteSearch, correo, correoVendedor, draftKey, duplicateSourceQuote, fechaEmision, fechaSolicitud, includeIgv, items, numero, open, personalComercial, plazoDias, proyecto, proyectoSearch, quoteId, ruc, selectedCliente, selectedCondiciones, selectedProyecto, telefono, telefonoComercial, ubicacion, year, contacto, condicionPago])

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
    setNumero(value.replace(/\D/g, ""))
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
      const suggested = getSuggestedQuoteSequence(payload?.preview?.suggested_numero || payload?.suggested_numero || "")
      setImportNumero(String(suggested || ""))
      toast.success("Excel analizado")
      void loadSuggestedImportNumber()
    } catch (error: any) {
      toast.error("No se pudo analizar el Excel", { description: error?.message || "Error desconocido" })
      setImportOpen(false)
    } finally {
      setLoadingPreview(false)
    }
  }

  const createCondition = async () => {
    const texto = newConditionText.trim()
    if (!texto) {
      toast.error("Escribe el texto de la condición")
      return
    }
    setCreatingCondition(true)
    try {
      const response = await authFetch(`${API_URL}/condiciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, categoria: "Cotización", vendedor_id: user?.id }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.detail || payload?.message || `HTTP ${response.status}`)
      }

      const created = (payload?.data ?? payload) as ConditionItem
      if (!created?.id) throw new Error("El servidor no devolvió la condición creada")
      setCondiciones((prev) => [...prev, created])
      setSelectedCondiciones((prev) => [...prev, created.id])
      setNewConditionText("")
      setShowCreateConditionModal(false)
      toast.success("Condición creada y seleccionada")
    } catch (err: any) {
      toast.error("No se pudo crear la condición", {
        description: err?.message || "Error desconocido",
      })
    } finally {
      setCreatingCondition(false)
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
    // The backend stores only the sequence and adds the year in the Excel.
    // Sending the visual COT-... value duplicated prefixes/suffixes downstream.
        cotizacion_numero: numero || undefined,
        cliente: cliente || undefined,
        ruc: ruc || undefined,
        contacto: contacto || undefined,
        telefono_contacto: telefono || undefined,
        correo: correo || undefined,
        proyecto: proyecto || undefined,
        ubicacion: ubicacion || undefined,
        fecha_solicitud: fechaSolicitud ? toApiQuoteDate(fechaSolicitud) : undefined,
        fecha_emision: fechaEmision ? toApiQuoteDate(fechaEmision) : undefined,
        plazo_dias: plazoDias || undefined,
        condicion_pago: condicionPago || undefined,
        personal_comercial: personalComercial || user?.name || undefined,
        telefono_comercial: telefonoComercial || user?.phone || undefined,
        correo_vendedor: correoVendedor || user?.email || undefined,
        user_id: user?.id,
        proyecto_id: selectedProyecto?.id || proyectoId,
        cliente_id: selectedCliente?.id || clienteId,
        include_igv: includeIgv,
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

      const url = quoteId ? `${API_URL}/quotes/${quoteId}` : `${API_URL}/export/xlsx`
      const method = quoteId ? "PUT" : "POST"

      const resp = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => "")
        throw new Error(errorText || `HTTP ${resp.status}`)
      }

      let blob: Blob
      if (quoteId) {
        const downloadResp = await authFetch(`${API_URL}/quotes/${quoteId}/download`)
        if (!downloadResp.ok) throw new Error("No se pudo descargar el Excel actualizado")
        blob = await downloadResp.blob()
      } else {
        blob = await resp.blob()
      }

      const urlBlob = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = urlBlob
    a.download = `${numero ? formatQuoteNumber(numero, year) : `COT-nuevo-${String(year).slice(-2)}`}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(urlBlob)

      if (user) {
        logAction({
          user_id: user.id,
          user_name: user.name,
          action: quoteId ? "Actualizó cotización nativa" : "Creó cotización nativa",
          module: "COTIZACIONES",
          details: { numero: numero ? formatQuoteNumber(numero, year) : null, year, items: items.length, total },
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

  const handleClearDraft = useCallback(() => {
    if (!quoteId && !duplicateSourceQuote) {
      skipNextDraftSaveRef.current = true
    }
    clearDraft()
    setNumero("")
    setYear(new Date().getFullYear())
    setCliente("")
    setRuc("")
    setContacto("")
    setTelefono("")
    setCorreo("")
    setProyecto("")
    setUbicacion("")
    setFechaSolicitud(getTodayPeru())
    setFechaEmision(getTodayPeru())
    setPersonalComercial(user?.name || "")
    setTelefonoComercial(user?.phone || "")
    setCorreoVendedor(user?.email || "")
    setPlazoDias(0)
    setCondicionPago("")
    setIncludeIgv(true)
    setClienteSearch("")
    setProyectoSearch("")
    setClientes([])
    setProyectos([])
    setShowClienteDropdown(false)
    setShowProyectoDropdown(false)
    setSelectedCliente(null)
    setSelectedProyecto(null)
    setItems([emptyItem()])
    setSelectedCondiciones([])
    setPendingConditionTexts([])
    toast.success("Datos actuales y autoguardado local limpiados")
  }, [clearDraft, duplicateSourceQuote, quoteId, user?.email, user?.name, user?.phone])

  const loadSuggestedImportNumber = useCallback(async () => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      const res = await authFetch(`${baseUrl}/quote/next-number`, { method: "POST" })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const suggested = getSuggestedQuoteSequence(data?.number || data?.token || data?.suggested_numero || "")
      if (suggested) {
        setImportNumero(suggested)
      }
    } catch {
      // keep preview suggestion if available
    }
  }, [])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[100vw] w-[100vw] h-[100vh] p-0 overflow-hidden rounded-none sm:rounded-none"
        onPointerDownOutside={(event) => {
            const target = event.detail.originalEvent.target
            if (target instanceof Element && target.closest('[data-autocomplete-dropdown="true"]')) {
              event.preventDefault()
            }
          }}
        >
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
                <Button variant="outline" size="sm" onClick={openPlantillasModal}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Plantillas
                </Button>
                <Button variant="outline" size="sm" onClick={openCreatePlantillaForm}>
                  <Plus className="mr-2 h-4 w-4" />
                  Guardar plantilla
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearDraft}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Limpiar local
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
                    <div className="space-y-2 col-span-2">
                      <Label>Número de cotización</Label>
                      <div className="flex h-10 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <span className="pl-3 text-sm text-muted-foreground">COT-</span>
                        <Input
                          value={numero}
                          onChange={(e) => handleNumeroChange(e.target.value)}
                          placeholder="23232"
                          inputMode="numeric"
                          autoComplete="off"
                          className="h-9 min-w-0 flex-1 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                        <span className="pr-3 text-sm text-muted-foreground">-{String(year).slice(-2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
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
                    <div className="space-y-2">
                      <Label>Fecha de solicitud</Label>
                      <Input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)} />
                    </div>
                    <div className="space-y-2 md:order-[9]">
                      <Label>Fecha de emisión</Label>
                      <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
                    </div>
                    <div className="space-y-2 relative md:order-[7]">
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
                    <div className="space-y-2 md:order-[8]">
                      <Label>Ubicación</Label>
                      <Input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Personal comercial</Label>
                      <Input value={personalComercial} onChange={(e) => setPersonalComercial(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono comercial</Label>
                      <Input value={telefonoComercial} onChange={(e) => setTelefonoComercial(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Correo vendedor</Label>
                      <Input value={correoVendedor} onChange={(e) => setCorreoVendedor(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Plazo estimado (días)</Label>
                      <Input type="number" min={0} value={plazoDias} onChange={(e) => setPlazoDias(Number(e.target.value || 0))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Condiciones de pago</Label>
                      <select
                        value={condicionPago}
                        onChange={(e) => setCondicionPago(e.target.value)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="" disabled>
                          Seleccionar...
                        </option>
                        {PAYMENT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <Label>Condiciones Específicas</Label>
                        <span className="text-xs text-muted-foreground">{selectedCondiciones.length} seleccionada(s)</span>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowCondicionesModal(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Gestionar Condiciones Específicas
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
                  </div>

                  <div className="flex items-center justify-between rounded-md border bg-background p-4">
                    <div>
                      <Label className="text-sm font-semibold">IGV</Label>
                      <p className="text-xs text-muted-foreground">{includeIgv ? "Activado" : "Desactivado"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIncludeIgv((prev) => !prev)}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${includeIgv ? "bg-blue-500" : "bg-muted"}`}
                      aria-pressed={includeIgv}
                      aria-label="Activar / desactivar IGV"
                    >
                      <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${includeIgv ? "translate-x-7" : "translate-x-1"}`} />
                    </button>
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
                            <TableCell className="align-top"><DragHandle /></TableCell>
                            <TableCell className="align-top">
                              <AutocompleteInput
                                value={item.codigo}
                                onChange={(value) => updateItem(index, { codigo: value })}
                                onSelect={(ensayo: EnsayoItem) => addEnsayoWithRelated(index, ensayo)}
                                suggestions={ensayosData}
                                placeholder="Código"
                                displayField="descripcion"
                                codeField="codigo"
                                minChars={0}
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
                                minChars={0}
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
        compact
        initialCliente={selectedCliente ? { id: selectedCliente.id, nombre: selectedCliente.nombre, ruc: selectedCliente.ruc } : null}
        onSuccess={(project) => {
          if (project?.nombre) {
            setProyecto(project.nombre)
            setProyectoSearch(project.nombre)
            setSelectedProyecto(project)
          }
          if (project?.ubicacion) {
            setUbicacion(project.ubicacion)
          }
          void searchProyectos(selectedCliente?.id, project?.nombre || proyectoSearch)
        }}
      />

      <Dialog open={showCondicionesModal} onOpenChange={setShowCondicionesModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Condiciones específicas</DialogTitle>
            <DialogDescription>Selecciona las condiciones que formarán parte de la cotización.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={conditionSearch}
                onChange={(e) => setConditionSearch(e.target.value)}
                placeholder="Buscar condiciones..."
                autoComplete="off"
              />
              <Button type="button" variant="outline" onClick={() => setShowCreateConditionModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva
              </Button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
              {filteredConditions.map((cond) => (
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
              {filteredConditions.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">No se encontraron condiciones.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowCondicionesModal(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateConditionModal} onOpenChange={setShowCreateConditionModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Condición</DialogTitle>
            <DialogDescription>Crea una condición rápida para reutilizarla en cotizaciones.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Texto de la condición</Label>
              <Textarea
                value={newConditionText}
                onChange={(e) => setNewConditionText(e.target.value)}
                placeholder="Ej: El cliente deberá..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateConditionModal(false)}>Cancelar</Button>
            <Button onClick={createCondition} disabled={creatingCondition || !newConditionText.trim()}>
              {creatingCondition ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Crear Condición
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlantillasModal} onOpenChange={setShowPlantillasModal}>
        <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <ListFilter className="h-5 w-5 text-primary" />
              Plantillas de cotización
            </DialogTitle>
            <DialogDescription>
              Revisa, previsualiza y carga una plantilla guardada del vendedor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[360px_1fr] gap-0">
            <div className="border-r bg-muted/20 p-4 min-h-0 flex flex-col">
              <Input
                value={plantillaSearch}
                onChange={(e) => setPlantillaSearch(e.target.value)}
                placeholder="Buscar plantilla..."
                autoComplete="off"
                className="mb-3"
              />
              <div className="min-h-0 flex-1 max-h-[calc(92vh-190px)] overflow-y-auto space-y-2 pr-2">
                {loadingPlantillas ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando plantillas...
                  </div>
                ) : filteredPlantillas.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No hay plantillas guardadas.
                  </div>
                ) : (
                  filteredPlantillas.map((plantilla) => {
                    const isSelected = plantilla.id === selectedPlantillaId
                    const plantillaItems = getPlantillaItems(plantilla)
                    const plantillaConditionIds = getPlantillaConditionIds(plantilla)
                    return (
                      <button
                        key={plantilla.id}
                        type="button"
                        onClick={() => setSelectedPlantillaId(plantilla.id)}
                        className={`w-full rounded-xl border p-3 text-left transition-colors ${
                          isSelected ? "border-primary bg-primary/5" : "hover:bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{plantilla.nombre}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {plantilla.descripcion || "Sin descripción"}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-background px-2 py-0.5 border">
                            {plantillaItems.length} ítems
                          </span>
                          <span className="rounded-full bg-background px-2 py-0.5 border">
                            {plantillaConditionIds.length} condiciones
                          </span>
                          {plantilla.es_propia === false ? (
                            <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 border border-amber-200">
                              Recuperada
                            </span>
                          ) : null}
                          <span className="rounded-full bg-background px-2 py-0.5 border">
                            Uso: {plantilla.veces_usada || 0}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="min-h-0 p-4 flex flex-col">
              {selectedPlantilla ? (
                <div className="min-h-0 flex-1 overflow-y-auto space-y-4">
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedPlantilla.nombre}</h3>
                          <p className="text-sm text-muted-foreground">
                            {selectedPlantilla.descripcion || "Sin descripción"}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {selectedPlantilla.es_propia === false ? "Recuperada" : "Propia"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border px-2 py-1 bg-background">
                          Ítems: {selectedPlantillaItems.length}
                        </span>
                        <span className="rounded-full border px-2 py-1 bg-background">
                          Condiciones: {selectedPlantillaConditionIds.length}
                        </span>
                        <span className="rounded-full border px-2 py-1 bg-background">
                          Uso: {selectedPlantilla.veces_usada || 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Vista previa de ítems</h4>
                        <span className="text-xs text-muted-foreground">
                          {selectedPlantillaItems.length} filas
                        </span>
                      </div>
                      <div className="max-h-72 overflow-y-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Código</TableHead>
                              <TableHead>Descripción</TableHead>
                              <TableHead className="text-right">P.U.</TableHead>
                              <TableHead className="text-right">Cant.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedPlantillaItems.map((item: any, index: number) => (
                              <TableRow key={`${selectedPlantilla.id}-${index}`}>
                                <TableCell className="font-mono text-xs">{item.codigo || "—"}</TableCell>
                                <TableCell className="max-w-[280px] truncate">{item.descripcion || "—"}</TableCell>
                                <TableCell className="text-right">
                                  S/. {Number(item.costo_unitario ?? item.precio ?? 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">{Number(item.cantidad || 1)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Condiciones</p>
                          <p className="mt-1 text-sm">
                            {selectedPlantillaConditionIds.length > 0
                              ? `${selectedPlantillaConditionIds.length} condiciones vinculadas`
                              : "Sin condiciones vinculadas"}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Pago / Plazo</p>
                          <p className="mt-1 text-sm">
                            {selectedPlantilla.condicion_pago || "Sin condición de pago"} ·{" "}
                            {selectedPlantilla.plazo_dias ? `${selectedPlantilla.plazo_dias} días` : "Sin plazo"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Selecciona una plantilla para verla.
                </div>
              )}

              <DialogFooter className="pt-4 border-t mt-4">
                <Button variant="outline" onClick={() => setShowPlantillasModal(false)}>
                  Cerrar
                </Button>
                <Button variant="outline" onClick={openEditPlantillaForm} disabled={!selectedPlantillaId}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <Button
                  onClick={() => selectedPlantillaId && void applyPlantilla(selectedPlantillaId)}
                  disabled={!selectedPlantillaId || loadingPlantillaId === selectedPlantillaId}
                >
                  {loadingPlantillaId === selectedPlantillaId ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FolderOpen className="mr-2 h-4 w-4" />
                  )}
                  Usar plantilla
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPlantillaFormModal} onOpenChange={setShowPlantillaFormModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{plantillaFormMode === "edit" ? "Editar plantilla" : "Guardar plantilla"}</DialogTitle>
            <DialogDescription>
              {plantillaFormMode === "edit"
                ? "Actualiza el nombre o descripción de la plantilla seleccionada."
                : "Guarda la cotización actual como una plantilla reutilizable."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={plantillaForm.nombre}
                onChange={(e) => setPlantillaForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: COT Probetas - Base"
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={plantillaForm.descripcion}
                onChange={(e) => setPlantillaForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Notas o uso recomendado"
                rows={4}
              />
            </div>
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Se guardará:</p>
              <p>{items.length} ítems</p>
              <p>{selectedCondiciones.length} condiciones</p>
              <p>{plazoDias || 0} días de plazo</p>
              <p>{condicionPago || "Sin condición de pago"}</p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPlantillaFormModal(false)}>
                Cancelar
              </Button>
              {plantillaFormMode === "edit" && (
                <Button variant="destructive" onClick={deleteSelectedPlantilla} disabled={savingPlantilla || !selectedPlantillaId}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
            <Button onClick={submitPlantillaForm} disabled={savingPlantilla}>
              {savingPlantilla ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {plantillaFormMode === "edit" ? "Actualizar plantilla" : "Guardar plantilla"}
            </Button>
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
                <div className="flex h-10 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                  <span className="pl-3 text-sm text-muted-foreground">COT-</span>
                  <Input
                    value={importNumero}
                    onChange={(e) => setImportNumero(e.target.value.replace(/\D/g, ""))}
                    inputMode="numeric"
                    autoComplete="off"
                    className="h-9 min-w-0 flex-1 border-0 px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <span className="pr-3 text-sm text-muted-foreground">-{String(year).slice(-2)}</span>
                </div>
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
