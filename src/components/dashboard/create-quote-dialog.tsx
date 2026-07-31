"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ArrowUpDown, ExternalLink, FileUp, Loader2, Plus, Trash2, X } from "lucide-react"
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

type QuoteItem = {
  codigo: string
  descripcion: string
  norma: string
  acreditado: string
  costo_unitario: number
  cantidad: number
}

interface CreateQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: { id: string; name: string; email?: string; phone?: string }
  onSuccess?: () => void
  proyectoId?: string
  clienteId?: string
  quoteId?: string
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

export function CreateQuoteDialog({ open, onOpenChange, user, onSuccess, proyectoId, clienteId, quoteId }: CreateQuoteDialogProps) {
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.costo_unitario || 0) * Number(item.cantidad || 0), 0), [items])
  const igv = subtotal * 0.18
  const total = subtotal + igv

  const loadQuote = useCallback(async () => {
    if (!quoteId) return
    setLoading(true)
    try {
      const resp = await authFetch(`${API_URL}/quotes/${quoteId}`)
      if (!resp.ok) throw new Error(await resp.text())
      const payload = await resp.json()
      const data = payload?.data ?? {}
      setNumero(data.numero || "")
      setYear(Number(data.year || new Date().getFullYear()))
      setCliente(data.cliente || "")
      setRuc(data.ruc || "")
      setContacto(data.contacto || "")
      setTelefono(data.telefono || "")
      setCorreo(data.email || "")
      setProyecto(data.proyecto || "")
      setUbicacion(data.ubicacion || "")
      setItems(Array.isArray(data.items_json) && data.items_json.length > 0 ? data.items_json.map((it: any) => ({
        codigo: String(it.codigo || ""),
        descripcion: String(it.descripcion || ""),
        norma: String(it.norma || ""),
        acreditado: String(it.acreditado || "SI"),
        costo_unitario: Number(it.costo_unitario || 0),
        cantidad: Number(it.cantidad || 1),
      })) : [emptyItem()])
    } catch (error: any) {
      toast.error("No se pudo cargar la cotización", { description: error?.message || "Error desconocido" })
    } finally {
      setLoading(false)
    }
  }, [quoteId])

  useEffect(() => {
    if (!open) return
    void loadQuote()
  }, [open, loadQuote])

  const updateItem = (index: number, patch: Partial<QuoteItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
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
        proyecto_id: proyectoId,
        cliente_id: clienteId,
        include_igv: true,
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
        <DialogContent className="max-w-[96vw] w-full h-[92vh] p-0 overflow-hidden">
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

          <div className="grid h-full grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-0">
            <div className="p-6 overflow-y-auto space-y-6">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Número de cotización</Label>
                      <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder={`COT-${year}-001`} />
                    </div>
                    <div className="space-y-2">
                      <Label>Año</Label>
                      <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cliente</Label>
                      <Input value={cliente} onChange={(e) => setCliente(e.target.value)} />
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
                      <Label>Proyecto</Label>
                      <Input value={proyecto} onChange={(e) => setProyecto(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Textarea value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} rows={2} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
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
                            <TableCell className="align-top"><Input value={item.codigo} onChange={(e) => updateItem(index, { codigo: e.target.value })} /></TableCell>
                            <TableCell className="align-top"><Input value={item.descripcion} onChange={(e) => updateItem(index, { descripcion: e.target.value })} /></TableCell>
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
            </div>

            <div className="border-l bg-muted/20 p-6 space-y-6">
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
