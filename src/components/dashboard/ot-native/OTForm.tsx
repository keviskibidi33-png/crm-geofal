"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Plus, Trash2, Loader2, Calendar, FileText, UserCheck, Layers, Hash } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { useAuth } from "@/hooks/use-auth"

export interface OTItem {
  item: number
  codigo_muestra: string
  descripcion: string
  cantidad: number | string
}

export interface OTData {
  id?: number
  numero_ot: string
  numero_recepcion?: string | null
  referencia?: string | null
  cliente?: string | null
  proyecto?: string | null
  fecha_recepcion?: string | null
  plazo_entrega_dias?: string | null
  inicio_programado?: string | null
  fin_programado?: string | null
  inicio_real?: string | null
  fin_real?: string | null
  variacion_inicio?: string | null
  variacion_fin?: string | null
  duracion_real_ejecucion_dias?: string | null
  observaciones?: string | null
  ot_aperturada_por?: string | null
  ot_designada_a?: string | null
  items: OTItem[]
  estado?: string
}

interface OTFormProps {
  initialData?: OTData | null
  onSuccess: () => void
  onCancel: () => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function OTForm({ initialData, onSuccess, onCancel }: OTFormProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  // Encabezado
  const [numeroOt, setNumeroOt] = useState(initialData?.numero_ot || "")
  const [numeroRecepcion, setNumeroRecepcion] = useState(initialData?.numero_recepcion || "")
  const [referencia, setReferencia] = useState(initialData?.referencia || "-")

  // Tabla dinamica de ítems
  const [items, setItems] = useState<OTItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            item: 1,
            codigo_muestra: "",
            descripcion: "",
            cantidad: 1,
          },
        ]
  )

  // Fechas y Control de Ejecución
  const [fechaRecepcion, setFechaRecepcion] = useState(initialData?.fecha_recepcion || "")
  const [plazoEntregaDias, setPlazoEntregaDias] = useState(initialData?.plazo_entrega_dias || "")
  const [inicioProgramado, setInicioProgramado] = useState(initialData?.inicio_programado || "")
  const [finProgramado, setFinProgramado] = useState(initialData?.fin_programado || "")
  const [inicioReal, setInicioReal] = useState(initialData?.inicio_real || "")
  const [finReal, setFinReal] = useState(initialData?.fin_real || "")
  const [variacionInicio, setVariacionInicio] = useState(initialData?.variacion_inicio || "")
  const [variacionFin, setVariacionFin] = useState(initialData?.variacion_fin || "")
  const [duracionReal, setDuracionReal] = useState(initialData?.duracion_real_ejecucion_dias || "")

  // Notas y Personal
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "")
  const [otAperturadaPor, setOtAperturadaPor] = useState(
    initialData?.ot_aperturada_por || user?.name || "LABORATORIO"
  )
  const [otDesignadaA, setOtDesignadaA] = useState(initialData?.ot_designada_a || "")
  const [estado, setEstado] = useState(initialData?.estado || "PENDIENTE")

  // Auto-cálculo de plazo cuando cambian las fechas programadas
  useEffect(() => {
    if (inicioProgramado && finProgramado) {
      try {
        const start = new Date(inicioProgramado)
        const end = new Date(finProgramado)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diffTime = Math.abs(end.getTime() - start.getTime())
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
          setPlazoEntregaDias(diffDays.toString())
        }
      } catch {
        // Ignorar error si formato no es parseable directamente
      }
    }
  }, [inicioProgramado, finProgramado])

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item: prev.length + 1,
        codigo_muestra: "",
        descripcion: "",
        cantidad: 1,
      },
    ])
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("La Orden de Trabajo debe tener al menos un ítem.")
      return
    }
    const newItems = items.filter((_, idx) => idx !== index)
    // Re-indexar
    const reindexed = newItems.map((item, idx) => ({ ...item, item: idx + 1 }))
    setItems(reindexed)
  }

  const handleItemChange = (index: number, field: keyof OTItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!numeroOt.trim()) {
      toast.error("El N° OT es obligatorio.")
      return
    }

    setLoading(true)

    const payload: Partial<OTData> = {
      numero_ot: numeroOt.trim(),
      numero_recepcion: numeroRecepcion.trim() || null,
      referencia: referencia.trim() || "-",
      fecha_recepcion: fechaRecepcion || null,
      plazo_entrega_dias: plazoEntregaDias.toString() || null,
      inicio_programado: inicioProgramado || null,
      fin_programado: finProgramado || null,
      inicio_real: inicioReal || null,
      fin_real: finReal || null,
      variacion_inicio: variacionInicio || null,
      variacion_fin: variacionFin || null,
      duracion_real_ejecucion_dias: duracionReal || null,
      observaciones: observaciones.trim() || null,
      ot_aperturada_por: otAperturadaPor.trim() || null,
      ot_designada_a: otDesignadaA.trim() || null,
      items: items.map((it, idx) => ({
        item: idx + 1,
        codigo_muestra: it.codigo_muestra.trim(),
        descripcion: it.descripcion.trim(),
        cantidad: Number(it.cantidad) || 1,
      })),
      estado,
    }

    try {
      const url = initialData?.id ? `${API_URL}/api/ot/${initialData.id}` : `${API_URL}/api/ot`
      const method = initialData?.id ? "PUT" : "POST"

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || "Error al guardar la Orden de Trabajo")
      }

      toast.success(initialData?.id ? "Orden de Trabajo actualizada" : "Orden de Trabajo creada exitosamente")
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Error al procesar la solicitud")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-2xl">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <FileText className="h-6 w-6 text-amber-600" />
          {initialData?.id ? `Editar OT: ${initialData.numero_ot}` : "Crear Nueva Orden de Trabajo (OT)"}
        </DialogTitle>
        <DialogDescription>
          Formulario estructurado exactamente según la plantilla oficial F-LEM-P-02.01.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {/* SECCIÓN 1: ENCABEZADO */}
        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 border-b border-amber-200 pb-2">
            <Hash className="h-4 w-4 text-amber-600" />
            1. Encabezado de Orden de Trabajo
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">N° OT *</Label>
              <Input
                placeholder="ej. 001-26-LEM"
                value={numeroOt}
                onChange={(e) => setNumeroOt(e.target.value)}
                className="mt-1 font-mono font-bold bg-white"
                required
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">N° RECEPCIÓN</Label>
              <Input
                placeholder="ej. 001-26"
                value={numeroRecepcion}
                onChange={(e) => setNumeroRecepcion(e.target.value)}
                className="mt-1 font-mono bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">REFERENCIA</Label>
              <Input
                placeholder="-"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="mt-1 bg-white"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: TABLA DE ÍTEMS Y ENSAYOS */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Layers className="h-4 w-4 text-blue-600" />
              2. Muestras y Ensayos (Descripción)
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="gap-1 text-xs border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar Ítem
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
              >
                <div className="col-span-1 text-center font-bold text-slate-500 text-sm">
                  #{idx + 1}
                </div>
                <div className="col-span-3">
                  <Input
                    placeholder="Código muestra (ej. 001-SU-26)"
                    value={item.codigo_muestra}
                    onChange={(e) => handleItemChange(idx, "codigo_muestra", e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
                <div className="col-span-6">
                  <Input
                    placeholder="Descripción del Ensayo / Norma (ej. ANÁLISIS GRANULOMÉTRICO POR TAMIZADO)"
                    value={item.descripcion}
                    onChange={(e) => handleItemChange(idx, "descripcion", e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Cant."
                    value={item.cantidad}
                    onChange={(e) => handleItemChange(idx, "cantidad", e.target.value)}
                    className="text-xs text-center"
                  />
                </div>
                <div className="col-span-1 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(idx)}
                    className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECCIÓN 3: CONTROL DE FECHAS Y EJECUCIÓN */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            3. Fechas de Programación y Ejecución Real
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">FECHA DE RECEPCIÓN</Label>
              <Input
                type="date"
                value={fechaRecepcion}
                onChange={(e) => setFechaRecepcion(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">INICIO PROGRAMADO</Label>
              <Input
                type="date"
                value={inicioProgramado}
                onChange={(e) => setInicioProgramado(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">FIN PROGRAMADO</Label>
              <Input
                type="date"
                value={finProgramado}
                onChange={(e) => setFinProgramado(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">PLAZO DE ENTREGA (DÍAS)</Label>
              <Input
                placeholder="ej. 5"
                value={plazoEntregaDias}
                onChange={(e) => setPlazoEntregaDias(e.target.value)}
                className="mt-1 text-xs bg-white font-bold"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">INICIO REAL</Label>
              <Input
                type="date"
                value={inicioReal}
                onChange={(e) => setInicioReal(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">FIN REAL</Label>
              <Input
                type="date"
                value={finReal}
                onChange={(e) => setFinReal(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">VARIACIÓN DE INICIO</Label>
              <Input
                placeholder="-"
                value={variacionInicio}
                onChange={(e) => setVariacionInicio(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">VARIACIÓN DE FIN</Label>
              <Input
                placeholder="-"
                value={variacionFin}
                onChange={(e) => setVariacionFin(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">DURACIÓN REAL DE EJECUCIÓN (DÍAS)</Label>
              <Input
                placeholder="ej. 4"
                value={duracionReal}
                onChange={(e) => setDuracionReal(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: OBSERVACIONES Y PERSONAL */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
            <UserCheck className="h-4 w-4 text-violet-600" />
            4. Observaciones y Responsables
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">OBSERVACIONES</Label>
            <Textarea
              rows={2}
              placeholder="Escribe observaciones adicionales o requerimientos del área..."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="mt-1 text-xs bg-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">OT APERTURADA POR</Label>
              <Input
                placeholder="Nombre de quien apertura"
                value={otAperturadaPor}
                onChange={(e) => setOtAperturadaPor(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">OT DESIGNADA A (Técnicos)</Label>
              <Input
                placeholder="Nombre del técnico responsable"
                value={otDesignadaA}
                onChange={(e) => setOtDesignadaA(e.target.value)}
                className="mt-1 text-xs bg-white"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">ESTADO</Label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="EN PROCESO">EN PROCESO</option>
                <option value="COMPLETADO">COMPLETADO</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {initialData?.id ? "Actualizar OT" : "Guardar OT"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
