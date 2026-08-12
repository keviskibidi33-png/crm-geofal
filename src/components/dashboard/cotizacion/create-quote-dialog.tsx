"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { FileUp, Loader2, Trash2, FolderOpen } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { logActionClient as logAction } from "@/lib/audit-client"
import { AutocompleteInput } from "@/components/ui/autocomplete-input"
import { ensayosData, type EnsayoItem } from "@/data/ensayos-data"
import { CreateProjectDialog } from "../proyectos/create-project-dialog"

import type { QuoteItem, QuoteSource } from "./types"
export type { QuoteItem, Condicion, QuoteSource } from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  initialData?: QuoteSource | null
  user?: { id: string; name: string; role?: string; email?: string }
  proyectoId?: string
  clienteId?: string
}

type PlantillaEnsayoRow = {
  id: string
  nombre: string
  descripcion: string | null
  items_count: number
  condicion_pago: string | null
  plazo_dias: number | null
  created_at: string
}

type PlantillaEnsayoDetail = PlantillaEnsayoRow & {
  items_json: any[]
  condiciones_ids: string[]
}

export function CreateQuoteDialog({ open, onOpenChange, onSuccess, initialData = null, user, proyectoId, clienteId }: Props) {
  const [numero, setNumero] = useState("")
  const [year, setYear] = useState(new Date().getFullYear())
  const [cliente, setCliente] = useState("")
  const [, setClienteIdState] = useState<string | null>(clienteId || null)
  const [clienteRuc, setClienteRuc] = useState("")
  const [clienteContacto, setClienteContacto] = useState("")
  const [clienteEmail, setClienteEmail] = useState("")
  const [clienteTelefono, setClienteTelefono] = useState("")
  const [proyectoNombre, setProyectoNombre] = useState("")
  const [, setProyectoIdState] = useState<string | null>(proyectoId || null)
  const [ubicacion, setUbicacion] = useState("")
  const [proyectosList, setProyectosList] = useState<Array<{ id: string; nombre: string; ubicacion?: string }>>([])
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false)
  const [plazoDias, setPlazoDias] = useState<number | "">(15)
  const [condicionPago, setCondicionPago] = useState<string>("50% adelanto y saldo contra entrega")

  const [selectedCondiciones, setSelectedCondiciones] = useState<string[]>([])

  const [items, setItems] = useState<QuoteItem[]>([])
  const [searchEnsayoText, setSearchEnsayoText] = useState("")
  const [plantillas, setPlantillas] = useState<PlantillaEnsayoRow[]>([])
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string | null>(null)
  const [selectedPlantilla, setSelectedPlantilla] = useState<PlantillaEnsayoDetail | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAutoGeneratingNumber, setIsAutoGeneratingNumber] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [clientesSugerencias, setClientesSugerencias] = useState<Array<{ id: string; empresa: string; ruc: string; nombre: string }>>([])

  const fetchClientesSugerencias = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setClientesSugerencias([])
      return
    }
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/clientes-search?q=${encodeURIComponent(query.trim())}`)
      if (res.ok) {
        const data = await res.json()
        setClientesSugerencias(data.clientes || [])
      }
    } catch {
      // Ignore search error
    }
  }, [])

  const fetchProyectosCliente = useCallback(async (cId: string) => {
    if (!cId) {
      setProyectosList([])
      return
    }
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/proyectos-cliente/${cId}`)
      if (res.ok) {
        const data = await res.json()
        setProyectosList(data.proyectos || [])
      }
    } catch {
      setProyectosList([])
    }
  }, [])

  const fetchContactosCliente = useCallback(async (cId: string) => {
    if (!cId) return
    try {
      await authFetch(`${API_URL}/api/cotizador/contactos-cliente/${cId}`)
    } catch {
      // Ignore error
    }
  }, [])

  const fetchNextQuoteNumber = useCallback(async (targetYear: number) => {
    setIsAutoGeneratingNumber(true)
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/siguiente-numero?year=${targetYear}`)
      if (res.ok) {
        const data = await res.json()
        if (data.numero) {
          setNumero(String(data.numero))
        }
      }
    } catch {
      // Auto number failed
    } finally {
      setIsAutoGeneratingNumber(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      if (!initialData?.numero) {
        void fetchNextQuoteNumber(year)
      }
    }
  }, [open, year, initialData?.numero, fetchNextQuoteNumber])

  useEffect(() => {
    if (open && initialData) {
      setNumero(initialData.numero ? String(initialData.numero) : "")
      setYear(initialData.year || new Date().getFullYear())
      setCliente(initialData.cliente || "")
      setClienteRuc(initialData.clienteRuc || "")
      setClienteContacto(initialData.clienteContacto || "")
      setClienteEmail(initialData.clienteEmail || "")
      setClienteTelefono(initialData.clienteTelefono || "")
      setProyectoNombre(initialData.proyectoNombre || "")
      setPlazoDias(initialData.plazoDias || 15)
      setCondicionPago(initialData.condicionPago || "50% adelanto y saldo contra entrega")
      setClienteIdState(initialData.clienteId || clienteId || null)
      setProyectoIdState(initialData.proyectoId || proyectoId || null)
      setUbicacion(initialData.ubicacion || "")

      if (initialData.clienteId) {
        void fetchProyectosCliente(initialData.clienteId)
        void fetchContactosCliente(initialData.clienteId)
      }

      if (Array.isArray(initialData.itemsJson) && initialData.itemsJson.length > 0) {
        setItems(
          initialData.itemsJson.map((it: any) => ({
            codigo: it.codigo || it.code || "",
            descripcion: it.descripcion || it.ensayo || "",
            norma: it.norma || "",
            acreditado: it.acreditado || "NO",
            costo_unitario: Number(it.costo_unitario ?? it.precio ?? 0),
            cantidad: Number(it.cantidad || 1),
          }))
        )
      }

      if (Array.isArray(initialData.condicionesIds)) {
        setSelectedCondiciones(initialData.condicionesIds)
      }
    } else if (open && !initialData) {
      setNumero("")
      setCliente("")
      setClienteIdState(clienteId || null)
      setProyectoIdState(proyectoId || null)
      setClienteRuc("")
      setClienteContacto("")
      setClienteEmail("")
      setClienteTelefono("")
      setProyectoNombre("")
      setUbicacion("")
      setItems([])
      setSelectedCondiciones([])
      setPlazoDias(15)
      setCondicionPago("50% adelanto y saldo contra entrega")
    }
  }, [open, initialData, clienteId, proyectoId, fetchProyectosCliente, fetchContactosCliente])

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.costo_unitario * item.cantidad), 0)
  }, [items])

  const igv = useMemo(() => subtotal * 0.18, [subtotal])
  const total = useMemo(() => subtotal + igv, [subtotal, igv])

  const handleAddItem = (ensayo: EnsayoItem) => {
    const existingIndex = items.findIndex((it) => it.codigo === ensayo.codigo)
    if (existingIndex >= 0) {
      const updated = [...items]
      updated[existingIndex].cantidad += 1
      setItems(updated)
    } else {
      setItems([
        ...items,
        {
          codigo: ensayo.codigo,
          descripcion: ensayo.descripcion,
          norma: ensayo.norma,
          acreditado: ensayo.acreditado || "NO",
          costo_unitario: ensayo.precio,
          cantidad: 1,
          ensayoData: ensayo,
        },
      ])
    }
    toast.success(`Agregado: ${ensayo.codigo}`)
  }

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index)
    setItems(updated)
  }

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...items]
    updated[index].cantidad = Math.max(1, qty)
    setItems(updated)
  }

  const handlePriceChange = (index: number, price: number) => {
    const updated = [...items]
    updated[index].costo_unitario = Math.max(0, price)
    setItems(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!numero || !cliente || items.length === 0) {
      toast.error("Por favor completa los campos obligatorios", {
        description: "El número, cliente y al menos un ítem son obligatorios.",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        numero: parseInt(numero, 10),
        year,
        fecha: new Date().toISOString().split("T")[0],
        cliente,
        cliente_ruc: clienteRuc,
        cliente_contacto: clienteContacto,
        cliente_email: clienteEmail,
        cliente_telefono: clienteTelefono,
        proyecto_nombre: proyectoNombre,
        ubicacion,
        subtotal,
        igv,
        total,
        estado: "Borrador",
        plazo_dias: typeof plazoDias === "number" ? plazoDias : 15,
        condicion_pago: condicionPago,
        items: items.map((it) => ({
          codigo: it.codigo,
          descripcion: it.descripcion,
          norma: it.norma,
          acreditado: it.acreditado,
          costo_unitario: it.costo_unitario,
          cantidad: it.cantidad,
        })),
        condiciones_ids: selectedCondiciones,
      }

      const res = await authFetch(`${API_URL}/api/cotizador/cotizaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.detail || "Error al guardar la cotización")
      }

      await res.json()

      toast.success("✅ Cotización Generada Exitosamente", {
        description: `COT-${numero}-${year} guardada correctamente.`,
      })

      logAction({
        user_id: user?.id || "anonymous",
        user_name: user?.name || "Usuario",
        action: `Creó/Actualizó cotización COT-${numero}-${year} para ${cliente}`,
        module: "COTIZACIONES",
      })

      onSuccess?.()
      onOpenChange(false)
    } catch (err: any) {
      toast.error("Error", {
        description: err.message || "No se pudo guardar la cotización.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Plantillas state
  const [showPlantillasModal, setShowPlantillasModal] = useState(false)
  const [loadingPlantillaId, setLoadingPlantillaId] = useState<string | null>(null)
  const [showPlantillaFormModal, setShowPlantillaFormModal] = useState(false)
  const [plantillaFormMode, setPlantillaFormMode] = useState<"create" | "edit">("create")
  const [plantillaForm, setPlantillaForm] = useState({ nombre: "", descripcion: "" })
  const [savingPlantilla, setSavingPlantilla] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<any>(null)
  const [importNumero, setImportNumero] = useState("")
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importingExcel, setImportingExcel] = useState(false)

  const openPlantillasModal = async () => {
    setShowPlantillasModal(true)
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/plantillas-ensayos`)
      if (res.ok) {
        const data = await res.json()
        setPlantillas(data.plantillas || [])
      }
    } catch {
      toast.error("Error al cargar plantillas")
    }
  }

  const loadPlantillaDetail = async (pId: string) => {
    setSelectedPlantillaId(pId)
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/plantillas-ensayos/${pId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedPlantilla(data)
      }
    } catch {
      toast.error("Error al cargar detalle de plantilla")
    }
  }

  const applyPlantilla = async (pId: string) => {
    setLoadingPlantillaId(pId)
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/plantillas-ensayos/${pId}`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.items_json)) {
          setItems(
            data.items_json.map((it: any) => ({
              codigo: it.codigo || it.code || "",
              descripcion: it.descripcion || it.ensayo || "",
              norma: it.norma || "",
              acreditado: it.acreditado || "NO",
              costo_unitario: Number(it.costo_unitario ?? it.precio ?? 0),
              cantidad: Number(it.cantidad || 1),
            }))
          )
        }
        if (Array.isArray(data.condiciones_ids)) {
          setSelectedCondiciones(data.condiciones_ids)
        }
        if (data.plazo_dias) setPlazoDias(data.plazo_dias)
        if (data.condicion_pago) setCondicionPago(data.condicion_pago)

        toast.success(`Plantilla "${data.nombre}" aplicada.`)
        setShowPlantillasModal(false)
      }
    } catch {
      toast.error("Error al aplicar la plantilla")
    } finally {
      setLoadingPlantillaId(null)
    }
  }

  const openSavePlantillaForm = () => {
    if (items.length === 0) {
      toast.error("Agrega al menos un ítem a la cotización antes de guardar como plantilla.")
      return
    }
    setPlantillaFormMode("create")
    setPlantillaForm({
      nombre: `Plantilla ${cliente ? `- ${cliente}` : ""}`,
      descripcion: `Creada con ${items.length} ítems`,
    })
    setShowPlantillaFormModal(true)
  }

  const openEditPlantillaForm = () => {
    if (!selectedPlantilla) return
    setPlantillaFormMode("edit")
    setPlantillaForm({
      nombre: selectedPlantilla.nombre,
      descripcion: selectedPlantilla.descripcion || "",
    })
    setShowPlantillaFormModal(true)
  }

  const submitPlantillaForm = async () => {
    if (!plantillaForm.nombre.trim()) {
      toast.error("El nombre de la plantilla es obligatorio.")
      return
    }

    setSavingPlantilla(true)
    try {
      if (plantillaFormMode === "create") {
        const payload = {
          nombre: plantillaForm.nombre.trim(),
          descripcion: plantillaForm.descripcion.trim(),
          items: items.map((it) => ({
            codigo: it.codigo,
            descripcion: it.descripcion,
            norma: it.norma,
            acreditado: it.acreditado,
            costo_unitario: it.costo_unitario,
            cantidad: it.cantidad,
          })),
          condiciones_ids: selectedCondiciones,
          plazo_dias: typeof plazoDias === "number" ? plazoDias : 15,
          condicion_pago: condicionPago,
        }

        const res = await authFetch(`${API_URL}/api/cotizador/plantillas-ensayos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error("Error al guardar la plantilla")
        toast.success("Plantilla guardada con éxito")
      } else if (selectedPlantillaId) {
        const payload = {
          nombre: plantillaForm.nombre.trim(),
          descripcion: plantillaForm.descripcion.trim(),
          items: items.map((it) => ({
            codigo: it.codigo,
            descripcion: it.descripcion,
            norma: it.norma,
            acreditado: it.acreditado,
            costo_unitario: it.costo_unitario,
            cantidad: it.cantidad,
          })),
          condiciones_ids: selectedCondiciones,
          plazo_dias: typeof plazoDias === "number" ? plazoDias : 15,
          condicion_pago: condicionPago,
        }

        const res = await authFetch(`${API_URL}/api/cotizador/plantillas-ensayos/${selectedPlantillaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error("Error al actualizar la plantilla")
        toast.success("Plantilla actualizada con éxito")
      }

      setShowPlantillaFormModal(false)
      if (showPlantillasModal) {
        void openPlantillasModal()
      }
    } catch (err: any) {
      toast.error(err.message || "Error al procesar plantilla")
    } finally {
      setSavingPlantilla(false)
    }
  }

  const deleteSelectedPlantilla = async () => {
    if (!selectedPlantillaId) return
    if (!confirm("¿Deseas eliminar esta plantilla permanente?")) return

    setSavingPlantilla(true)
    try {
      const res = await authFetch(`${API_URL}/api/cotizador/plantillas-ensayos/${selectedPlantillaId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("No se pudo eliminar la plantilla")

      toast.success("Plantilla eliminada")
      setSelectedPlantillaId(null)
      setSelectedPlantilla(null)
      setShowPlantillaFormModal(false)
      void openPlantillasModal()
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar plantilla")
    } finally {
      setSavingPlantilla(false)
    }
  }

  const handleImportFile = async (file: File) => {
    setImportFile(file)
    setImportOpen(true)
    setLoadingPreview(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await authFetch(`${API_URL}/api/cotizador/preview-import-excel`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setImportPreview(data)
        if (data.numero_sugerido) {
          setImportNumero(String(data.numero_sugerido))
        }
      }
    } catch {
      toast.error("Error al previsualizar el archivo Excel")
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleImportConfirm = async () => {
    if (!importFile) return

    setImportingExcel(true)
    try {
      const formData = new FormData()
      formData.append("file", importFile)
      if (importNumero) {
        formData.append("numero_cotizacion", importNumero)
      }

      const res = await authFetch(`${API_URL}/api/cotizador/importar-excel`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Error en la importación")
      }

      const data = await res.json()
      toast.success(`Cotización COT-${data.numero}-${data.year} importada con éxito.`)

      onSuccess?.()
      setImportOpen(false)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Error al importar cotización")
    } finally {
      setImportingExcel(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <span>{initialData ? "Editar Cotización" : "Nueva Cotización"}</span>
              {isAutoGeneratingNumber && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </DialogTitle>
            <DialogDescription>
              Completa los datos del cliente, vincula un proyecto y añade los ensayos geotécnicos/químicos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 py-2">
            {/* CABECERA DE COTIZACIÓN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
              <div>
                <Label htmlFor="num-cot font-semibold">Número de Cotización *</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-bold text-muted-foreground">COT-</span>
                  <Input
                    id="num-cot"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="1001"
                    className="font-mono font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="year-cot font-semibold">Año *</Label>
                <Input
                  id="year-cot"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                  className="mt-1 font-mono text-sm font-semibold"
                />
              </div>

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchNextQuoteNumber(year)}
                  disabled={isAutoGeneratingNumber}
                  className="w-full text-xs font-semibold"
                >
                  {isAutoGeneratingNumber ? "Generando..." : "Autogenerar N°"}
                </Button>
              </div>
            </div>

            {/* SECCIÓN CLIENTE Y PROYECTO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3 p-4 bg-card rounded-xl border border-border/50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Datos de la Empresa / Cliente</h4>
                
                <div>
                  <Label className="text-xs">Razon Social / Empresa *</Label>
                  <AutocompleteInput
                    value={cliente}
                    onChange={(val) => {
                      setCliente(val)
                      fetchClientesSugerencias(val)
                    }}
                    onSelect={(item) => {
                      setCliente(item.label)
                      if (item.data) {
                        setClienteRuc(item.data.ruc || "")
                        setClienteIdState(item.data.id || null)
                        fetchProyectosCliente(item.data.id)
                        fetchContactosCliente(item.data.id)
                      }
                    }}
                    items={clientesSugerencias.map((c) => ({
                      id: c.id,
                      label: c.empresa || c.nombre,
                      sublabel: `RUC: ${c.ruc}`,
                      data: c,
                    }))}
                    placeholder="Escribe para buscar empresa..."
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">RUC</Label>
                    <Input
                      value={clienteRuc}
                      onChange={(e) => setClienteRuc(e.target.value)}
                      placeholder="20123456789"
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Persona de Contacto</Label>
                    <Input
                      value={clienteContacto}
                      onChange={(e) => setClienteContacto(e.target.value)}
                      placeholder="Ing. Carlos Pérez"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Correo Contacto</Label>
                    <Input
                      type="email"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                      placeholder="contacto@empresa.com"
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Teléfono</Label>
                    <Input
                      value={clienteTelefono}
                      onChange={(e) => setClienteTelefono(e.target.value)}
                      placeholder="999888777"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-card rounded-xl border border-border/50 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Proyecto / Obra</h4>
                    {user && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCreateProjectDialogOpen(true)}
                        className="h-6 text-[10px] font-bold text-primary hover:underline px-1"
                      >
                        + Nuevo Proyecto
                      </Button>
                    )}
                  </div>

                  <div>
                    <Label className="text-xs">Nombre del Proyecto / Servicio</Label>
                    <AutocompleteInput
                      value={proyectoNombre}
                      onChange={setProyectoNombre}
                      onSelect={(item) => {
                        setProyectoNombre(item.label)
                        if (item.data) {
                          setProyectoIdState(item.data.id)
                          if (item.data.ubicacion) setUbicacion(item.data.ubicacion)
                        }
                      }}
                      items={proyectosList.map((p) => ({
                        id: p.id,
                        label: p.nombre,
                        sublabel: p.ubicacion ? `Ubicación: ${p.ubicacion}` : undefined,
                        data: p,
                      }))}
                      placeholder="Nombre de la obra o servicio..."
                      className="mt-1 text-xs"
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Ubicación de la Obra</Label>
                    <Input
                      value={ubicacion}
                      onChange={(e) => setUbicacion(e.target.value)}
                      placeholder="Ej: Planta Industrial, Callao"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                  <div>
                    <Label className="text-xs">Plazo de Entrega (Días)</Label>
                    <Input
                      type="number"
                      value={plazoDias}
                      onChange={(e) => setPlazoDias(parseInt(e.target.value, 10) || "")}
                      className="mt-1 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Condición de Pago</Label>
                    <Input
                      value={condicionPago}
                      onChange={(e) => setCondicionPago(e.target.value)}
                      placeholder="Ej: 50% adelanto"
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* TABLA DE ENSAYOS Y CATÁLOGO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Ítems / Ensayos Solicitados</h4>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        void handleImportFile(file)
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs font-bold gap-1.5"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Importar Excel
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openPlantillasModal}
                    className="h-8 text-xs font-bold gap-1.5"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Plantillas
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openSavePlantillaForm}
                    disabled={items.length === 0}
                    className="h-8 text-xs font-bold"
                  >
                    Guardar como Plantilla
                  </Button>
                </div>
              </div>

              {/* Búsqueda rápida de catálogo */}
              <div className="p-3 bg-muted/20 rounded-xl border border-border/50 space-y-2">
                <Label className="text-xs font-bold text-muted-foreground">Agregar Ensayo del Catálogo</Label>
                <AutocompleteInput
                  value={searchEnsayoText}
                  onChange={setSearchEnsayoText}
                  onSelect={(item) => {
                    if (item.data) {
                      handleAddItem(item.data)
                      setSearchEnsayoText("")
                    }
                  }}
                  items={ensayosData.map((ens) => ({
                    id: ens.codigo,
                    label: `${ens.codigo} - ${ens.descripcion}`,
                    sublabel: `Norma: ${ens.norma} | S/. ${ens.precio.toFixed(2)}`,
                    data: ens,
                  }))}
                  placeholder="Buscar por código (ej: SU-01) o nombre del ensayo..."
                  className="text-xs font-medium"
                />
              </div>

              {/* Tabla de Items */}
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-24 text-xs font-bold">Código</TableHead>
                      <TableHead className="text-xs font-bold">Descripción del Ensayo</TableHead>
                      <TableHead className="w-32 text-xs font-bold">Norma</TableHead>
                      <TableHead className="w-20 text-xs font-bold text-center">Acred.</TableHead>
                      <TableHead className="w-28 text-xs font-bold text-right">Precio Unit.</TableHead>
                      <TableHead className="w-20 text-xs font-bold text-center">Cant.</TableHead>
                      <TableHead className="w-28 text-xs font-bold text-right">Total</TableHead>
                      <TableHead className="w-12 text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                          No hay ensayos agregados. Busca en el catálogo arriba para añadir ítems.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-xs font-bold text-primary">{item.codigo}</TableCell>
                          <TableCell className="text-xs font-medium">{item.descripcion}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.norma || "-"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={item.acreditado === "SI" ? "default" : "secondary"} className="text-[10px]">
                              {item.acreditado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.10"
                              value={item.costo_unitario}
                              onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs text-right font-mono font-bold w-24 ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="1"
                              value={item.cantidad}
                              onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10) || 1)}
                              className="h-7 text-xs text-center font-bold w-16 mx-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs">
                            S/. {(item.costo_unitario * item.cantidad).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* TOTALES */}
              <div className="flex flex-col items-end gap-1.5 pt-2">
                <div className="flex items-center justify-between w-64 text-xs">
                  <span className="text-muted-foreground font-medium">Subtotal:</span>
                  <span className="font-mono font-bold">S/. {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between w-64 text-xs">
                  <span className="text-muted-foreground font-medium">IGV (18%):</span>
                  <span className="font-mono font-bold">S/. {igv.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between w-64 text-sm font-black border-t border-border pt-1">
                  <span className="text-primary">Total Oferta:</span>
                  <span className="font-mono text-primary text-base">S/. {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || items.length === 0} className="font-bold">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cotización
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGOS DE APOYO */}
      {user && (
        <CreateProjectDialog
          open={createProjectDialogOpen}
          onOpenChange={setCreateProjectDialogOpen}
          user={user as any}
          compact
          onSuccess={(proj) => {
            if (proj) {
              setProyectoNombre(proj.nombre || "")
              setProyectoIdState(proj.id || null)
              if (proj.ubicacion) setUbicacion(proj.ubicacion)
            }
          }}
        />
      )}

      {/* DIÁLOGO PLANTILLAS */}
      <Dialog open={showPlantillasModal} onOpenChange={setShowPlantillasModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Plantillas de Cotización</DialogTitle>
            <DialogDescription>Selecciona una plantilla para cargar ensayos y condiciones preconfigurados.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 flex-1 min-h-0 divide-x overflow-hidden">
            <div className="p-4 space-y-2 overflow-y-auto">
              {plantillas.map((p) => (
                <div
                  key={p.id}
                  onClick={() => loadPlantillaDetail(p.id)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    selectedPlantillaId === p.id ? "border-primary bg-primary/5 font-bold" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-bold text-foreground">{p.nombre}</p>
                  <p className="text-muted-foreground mt-0.5">{p.items_count} ensayos · {p.plazo_dias || 15} días</p>
                </div>
              ))}
            </div>

            <div className="col-span-2 p-6 flex flex-col justify-between overflow-y-auto">
              {selectedPlantilla ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{selectedPlantilla.nombre}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{selectedPlantilla.descripcion || "Sin descripción"}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" onClick={openEditPlantillaForm} className="h-7 px-2 text-xs">
                        Editar
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={deleteSelectedPlantilla} className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10">
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary">Ensayos Incluidos ({selectedPlantilla.items_json.length})</p>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Código</TableHead>
                              <TableHead className="text-xs">Ensayo</TableHead>
                              <TableHead className="text-xs text-right">Precio</TableHead>
                              <TableHead className="text-xs text-right">Cant.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedPlantilla.items_json.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-mono text-xs font-bold">{item.codigo || item.code}</TableCell>
                                <TableCell className="text-xs">{item.descripcion || item.ensayo}</TableCell>
                                <TableCell className="text-right text-xs">S/. {Number(item.costo_unitario ?? item.precio ?? 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs">{Number(item.cantidad || 1)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Selecciona una plantilla para ver sus detalles.
                </div>
              )}

              <DialogFooter className="mt-auto pt-4 border-t">
                <Button variant="outline" onClick={() => setShowPlantillasModal(false)}>Cancelar</Button>
                <Button onClick={() => selectedPlantillaId && applyPlantilla(selectedPlantillaId)} disabled={!selectedPlantillaId || loadingPlantillaId !== null}>
                  {loadingPlantillaId !== null && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Usar Plantilla
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO GUARDAR/EDITAR PLANTILLA */}
      <Dialog open={showPlantillaFormModal} onOpenChange={setShowPlantillaFormModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{plantillaFormMode === "create" ? "Guardar como Plantilla" : "Editar Plantilla"}</DialogTitle>
            <DialogDescription>
              Guarda el listado actual de ensayos y condiciones como plantilla reutilizable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Nombre de la Plantilla *</Label>
              <Input
                value={plantillaForm.nombre}
                onChange={(e) => setPlantillaForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Ensayos Estándar Concreto"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descripción</Label>
              <Input
                value={plantillaForm.descripcion}
                onChange={(e) => setPlantillaForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Ej. Incluye compresión y flexión..."
                className="mt-1 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowPlantillaFormModal(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submitPlantillaForm} disabled={savingPlantilla || !plantillaForm.nombre.trim()}>
              {savingPlantilla && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {plantillaFormMode === "create" ? "Guardar Plantilla" : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO IMPORTAR EXCEL */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Cotización desde Excel</DialogTitle>
            <DialogDescription>
              Confirma la importación del archivo seleccionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : importPreview ? (
              <div className="space-y-2">
                <p className="font-semibold text-foreground">Vista previa del archivo:</p>
                <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                  <p><strong>Cliente:</strong> {importPreview.cliente || "N/A"}</p>
                  <p><strong>Items encontrados:</strong> {importPreview.items?.length || 0}</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">Número Cotización</Label>
                  <Input
                    value={importNumero}
                    onChange={(e) => setImportNumero(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Procesando archivo...</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleImportConfirm} disabled={importingExcel || loadingPreview}>
              {importingExcel && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Confirmar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
