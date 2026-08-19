"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Plus, Trash2, Loader2, Calendar, FileText, UserCheck, Layers, Hash, Wand2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { ModernConfirmDialog } from "@/components/dashboard/modern-confirm-dialog"
import type { OTData, OTItem } from "./OTForm"

interface OTConcretoFormProps {
  initialData?: OTData | null
  initialNumeroRecepcion?: string | null
  onSuccess: () => void
  onCancel: () => void
  onDirtyChange?: (isDirty: boolean) => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

function toIsoDate(val?: string | null): string {
  if (!val) return ""
  const s = String(val).trim()
  if (!s || s === "-") return ""
  const clean = s.split("T")[0].split(" ")[0].replace(/\//g, "-")
  const parts = clean.split("-")
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
    if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    if (parts[2].length === 2) return `20${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
  }
  return clean
}

export function OTConcretoForm({
  initialData,
  initialNumeroRecepcion,
  onSuccess,
  onCancel,
  onDirtyChange,
}: OTConcretoFormProps) {
  const isEditing = !!initialData?.id
  const [loading, setLoading] = useState(false)
  const [prefilling, setPrefilling] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  const markDirty = () => {
    if (!isDirty) {
      setIsDirty(true)
      onDirtyChange?.(true)
    }
  }

  // 1. Identificación y Recepción
  const [numeroOt, setNumeroOt] = useState(initialData?.numero_ot || "")
  const [numeroRecepcion, setNumeroRecepcion] = useState(
    initialNumeroRecepcion || initialData?.numero_recepcion || ""
  )
  const [referencia, setReferencia] = useState(initialData?.referencia || "")
  const [cliente, setCliente] = useState(initialData?.cliente || "")
  const [proyecto, setProyecto] = useState(initialData?.proyecto || "")

  // 2. Probetas Concreto
  const [items, setItems] = useState<OTItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((it, idx) => ({
          item: it.item || idx + 1,
          codigo_muestra: it.codigo_muestra || "",
          descripcion: "COMPRESION PROBETAS ASTM C39/C39M",
          cantidad: 1,
          elemento: it.elemento || "-",
          fecha_rotura: toIsoDate(it.fecha_rotura),
          densidad: it.densidad === "SI" || it.densidad === "NO" ? it.densidad : "NO",
          edad: it.edad ?? "",
          fc_kg_cm2: it.fc_kg_cm2 ?? "",
        }))
      : [
          {
            item: 1,
            codigo_muestra: "",
            descripcion: "COMPRESION PROBETAS ASTM C39/C39M",
            cantidad: 1,
            elemento: "-",
            fecha_rotura: "",
            densidad: "NO",
            edad: "",
            fc_kg_cm2: "",
          },
        ]
  )

  // 3. Fechas y Control
  const [fechaRecepcion, setFechaRecepcion] = useState(toIsoDate(initialData?.fecha_recepcion))
  const [plazoEntregaDias, setPlazoEntregaDias] = useState(initialData?.plazo_entrega_dias || "")
  const [inicioProgramado, setInicioProgramado] = useState(toIsoDate(initialData?.inicio_programado))
  const [finProgramado, setFinProgramado] = useState(toIsoDate(initialData?.fin_programado))
  const [inicioReal, setInicioReal] = useState(toIsoDate(initialData?.inicio_real))
  const [finReal, setFinReal] = useState(toIsoDate(initialData?.fin_real))
  const [variacionInicio, setVariacionInicio] = useState(initialData?.variacion_inicio || "")
  const [variacionFin, setVariacionFin] = useState(initialData?.variacion_fin || "")
  const [duracionReal, setDuracionReal] = useState(initialData?.duracion_real_ejecucion_dias || "")

  // 4. Notas y Personal
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "")
  const [otAperturadaPor, setOtAperturadaPor] = useState(initialData?.ot_aperturada_por || "BETZABETH SARAVIA")
  const [otDesignadaA, setOtDesignadaA] = useState(initialData?.ot_designada_a || "")

  // Autocompletar automáticamente al abrir el modal desde recepción si es nueva OT
  useEffect(() => {
    if (initialNumeroRecepcion && !initialData?.id) {
      handlePrefill()
    }
  }, [initialNumeroRecepcion])

  // Autocompletar desde recepción
  const handlePrefill = async () => {
    const num = (numeroRecepcion || initialNumeroRecepcion || "").trim()
    if (!num) {
      toast.warning("Ingresa un N° de Recepción antes de autocompletar.")
      return
    }
    setPrefilling(true)
    setPrefilled(false)
    try {
      const res = await authFetch(`${API_URL}/api/ot/prefill/${encodeURIComponent(num)}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Recepción '${num}' no encontrada`)
      }
      const data = await res.json()

      setCliente(data.cliente || "")
      setProyecto(data.proyecto || "")
      if (data.fecha_recepcion) setFechaRecepcion(toIsoDate(data.fecha_recepcion))
      if (data.inicio_programado) setInicioProgramado(toIsoDate(data.inicio_programado))
      if (data.fin_programado) setFinProgramado(toIsoDate(data.fin_programado))
      if (data.observaciones) setObservaciones(data.observaciones)
      if (data.ot_aperturada_por) setOtAperturadaPor(data.ot_aperturada_por)
      if (data.ot_designada_a && data.ot_designada_a !== "-") {
        setOtDesignadaA(data.ot_designada_a)
      } else {
        setOtDesignadaA("")
      }

      if (Array.isArray(data.items) && data.items.length > 0) {
        setItems(
          data.items.map((it: any, idx: number) => ({
            item: idx + 1,
            codigo_muestra: it.codigo_muestra || `PROB-${String(idx + 1).padStart(2, "0")}`,
            descripcion: "COMPRESION PROBETAS ASTM C39/C39M",
            cantidad: 1,
            elemento: it.elemento || "-",
            fecha_rotura: toIsoDate(it.fecha_rotura),
            densidad: it.densidad === "SI" || it.densidad === "NO" ? it.densidad : "NO",
            edad: it.edad ?? "",
            fc_kg_cm2: it.fc_kg_cm2 ?? "",
          }))
        )
      }

      markDirty()
      setPrefilled(true)
      toast.success(`Datos de recepción '${num}' autocompletados con éxito.`)
    } catch (err: any) {
      toast.error(err.message || "Error al autocompletar datos.")
    } finally {
      setPrefilling(false)
    }
  }

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
      } catch {}
    }
  }, [inicioProgramado, finProgramado])

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        item: prev.length + 1,
        codigo_muestra: "",
        descripcion: "COMPRESION PROBETAS ASTM C39/C39M",
        cantidad: 1,
        elemento: "-",
        fecha_rotura: "",
        densidad: "NO",
        edad: "",
        fc_kg_cm2: "",
      },
    ])
    markDirty()
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("La OT debe tener al menos una probeta.")
      return
    }
    const newItems = items.filter((_, idx) => idx !== index)
    setItems(newItems.map((it, idx) => ({ ...it, item: idx + 1 })))
    markDirty()
  }

  const handleItemChange = (index: number, field: keyof OTItem, value: any) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
    markDirty()
  }

  const handleCancelClick = () => {
    if (isDirty) {
      setShowConfirmClose(true)
    } else {
      onCancel()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanOt = numeroOt.trim()
    if (!cleanOt) {
      toast.error("El N° de OT es obligatorio.")
      return
    }

    if (!items || items.length === 0) {
      toast.error("Debes registrar al menos una probeta en la Orden de Trabajo.")
      return
    }

    const itemInvalido = items.find((it) => !it.codigo_muestra?.trim())
    if (itemInvalido) {
      toast.error(`La probeta #${itemInvalido.item} no tiene código LEM.`)
      return
    }

    const payload = {
      numero_ot: cleanOt,
      numero_recepcion: numeroRecepcion.trim() || null,
      referencia: referencia.trim() || "-",
      cliente: cliente.trim() || null,
      proyecto: proyecto.trim() || null,
      fecha_recepcion: fechaRecepcion || null,
      plazo_entrega_dias: plazoEntregaDias ? Number(plazoEntregaDias) : null,
      inicio_programado: inicioProgramado || null,
      fin_programado: finProgramado || null,
      inicio_real: inicioReal || null,
      fin_real: finReal || null,
      variacion_inicio: variacionInicio || null,
      variacion_fin: variacionFin || null,
      duracion_real_ejecucion_dias: duracionReal ? Number(duracionReal) : null,
      observaciones: observaciones.trim() || null,
      ot_aperturada_por: otAperturadaPor || null,
      ot_designada_a: otDesignadaA || null,
      items: items.map((it) => ({
        item: it.item,
        codigo_muestra: it.codigo_muestra.trim(),
        descripcion: "COMPRESION PROBETAS ASTM C39/C39M",
        cantidad: 1,
        elemento: it.elemento || "-",
        fecha_rotura: it.fecha_rotura || null,
        densidad: it.densidad || "NO",
        edad: it.edad !== undefined && it.edad !== "" ? Number(it.edad) : null,
        fc_kg_cm2: it.fc_kg_cm2 !== undefined && it.fc_kg_cm2 !== "" ? Number(it.fc_kg_cm2) : null,
      })),
    }

    setLoading(true)
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

      toast.success(initialData?.id ? "OT Concreto actualizada" : "OT Concreto creada exitosamente")
      setIsDirty(false)
      onDirtyChange?.(false)
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Error al procesar la solicitud")
    } finally {
      setLoading(false)
    }
  }

  return (
    <DialogContent className="max-w-[95vw] w-full h-[92vh] flex flex-col p-6 sm:p-8 rounded-2xl overflow-hidden bg-white">
      <DialogHeader className="shrink-0 pb-2 border-b border-slate-200">
        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <FileText className="h-6 w-6 text-sky-600" />
          {initialData?.id ? `Editar OT Concreto: ${initialData.numero_ot}` : "Crear Nueva Orden de Trabajo — Concreto (F-LEM-P-02.01)"}
        </DialogTitle>
        <DialogDescription>
          Formulario estructurado exactamente según la plantilla oficial F-LEM-P-02.01 (MYP).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
          {/* SECCIÓN 1: ENCABEZADO */}
          <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-900 border-b border-sky-200/60 pb-2">
              <Hash className="h-4 w-4 text-sky-600" />
              1. Identificación y Recepción
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">N° OT</Label>
                <div className="relative mt-1">
                  {!numeroOt.toLowerCase().startsWith("ot") && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400 pointer-events-none select-none">
                      OT-
                    </span>
                  )}
                  <Input
                    placeholder="1968-26"
                    value={numeroOt}
                    onChange={(e) => {
                      setNumeroOt(e.target.value)
                      markDirty()
                    }}
                    onBlur={() => {
                      const val = numeroOt.trim()
                      if (val && !val.includes("-")) {
                        const year = new Date().getFullYear().toString().slice(-2)
                        setNumeroOt(`${val}-${year}`)
                        markDirty()
                      }
                    }}
                    className={`font-mono font-bold bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500 ${
                      !numeroOt.toLowerCase().startsWith("ot") ? "pl-9" : ""
                    }`}
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">N° RECEPCIÓN</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="ej. 1977-26"
                    value={numeroRecepcion}
                    onChange={(e) => {
                      setNumeroRecepcion(e.target.value)
                      setPrefilled(false)
                      markDirty()
                    }}
                    onBlur={() => {
                      const val = numeroRecepcion.trim()
                      if (val && !val.includes("-")) {
                        const year = new Date().getFullYear().toString().slice(-2)
                        setNumeroRecepcion(`${val}-${year}`)
                        markDirty()
                      }
                    }}
                    className="font-mono bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePrefill}
                    disabled={prefilling || !numeroRecepcion.trim()}
                    title="Autocompletar datos desde la recepción"
                    className="shrink-0 gap-1.5 border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-semibold cursor-pointer"
                  >
                    {prefilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Autocompletar
                  </Button>
                </div>
                {prefilled && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Datos cargados desde recepción
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">REFERENCIA</Label>
                <Input
                  placeholder="-"
                  value={referencia}
                  onChange={(e) => {
                    setReferencia(e.target.value)
                    markDirty()
                  }}
                  className="mt-1 bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-sky-200/60">
              <div>
                <Label className="text-xs font-semibold text-slate-700">CLIENTE</Label>
                <Input
                  placeholder="Nombre del cliente"
                  value={cliente}
                  onChange={(e) => {
                    setCliente(e.target.value)
                    markDirty()
                  }}
                  className="mt-1 bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">PROYECTO</Label>
                <Input
                  placeholder="Nombre del proyecto"
                  value={proyecto}
                  onChange={(e) => {
                    setProyecto(e.target.value)
                    markDirty()
                  }}
                  className="mt-1 bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: PROBETAS DE CONCRETO */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Layers className="h-4 w-4 text-sky-600" />
                2. Probetas de Concreto (F-LEM-P-02.01)
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="gap-1 text-xs border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Probeta
              </Button>
            </div>

            <div
              className="grid gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2"
              style={{ gridTemplateColumns: "28px 115px 1fr 115px 135px 65px 55px 65px 32px" }}
            >
              <span className="text-center">#</span>
              <span>CÓDIGO LEM</span>
              <span>DESCRIPCIÓN</span>
              <span className="text-center">ELEMENTO</span>
              <span className="text-center">F. ROTURA</span>
              <span className="text-center">DENSIDAD</span>
              <span className="text-center">EDAD</span>
              <span className="text-center">F’C</span>
              <span />
            </div>

            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid gap-1.5 items-center bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
                  style={{ gridTemplateColumns: "28px 115px 1fr 115px 135px 65px 55px 65px 32px" }}
                >
                  <div className="text-center font-bold text-slate-400 text-xs">{idx + 1}</div>

                  <Input
                    placeholder="15XXX-CO-26"
                    value={item.codigo_muestra}
                    onChange={(e) => handleItemChange(idx, "codigo_muestra", e.target.value)}
                    className="text-xs font-mono border-slate-300 focus-visible:ring-sky-500 h-7 px-2"
                  />

                  <div
                    className="text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-2 py-1 truncate"
                    title="COMPRESION PROBETAS ASTM C39/C39M"
                  >
                    COMPRESION PROBETAS ASTM C39/C39M
                  </div>

                  <select
                    value={item.elemento || "-"}
                    onChange={(e) => handleItemChange(idx, "elemento", e.target.value)}
                    className="text-[10px] border border-slate-300 rounded bg-white h-7 px-1 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                  >
                    {["-", "4 in x 8 in", "6 in x 12 in", "VIGA", "CUBO"].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>

                  <Input
                    type="date"
                    value={item.fecha_rotura || ""}
                    onChange={(e) => handleItemChange(idx, "fecha_rotura", e.target.value)}
                    className="text-[10px] border-slate-300 focus-visible:ring-sky-500 h-7 px-1"
                  />

                  <select
                    value={item.densidad || "NO"}
                    onChange={(e) => handleItemChange(idx, "densidad", e.target.value)}
                    className="text-[10px] border border-slate-300 rounded bg-white h-7 px-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SI</option>
                  </select>

                  <Input
                    type="number"
                    placeholder="0"
                    value={item.edad ?? ""}
                    onChange={(e) => handleItemChange(idx, "edad", e.target.value)}
                    className="text-[10px] text-center border-slate-300 focus-visible:ring-sky-500 h-7 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <Input
                    type="number"
                    placeholder="0"
                    value={item.fc_kg_cm2 ?? ""}
                    onChange={(e) => handleItemChange(idx, "fc_kg_cm2", e.target.value)}
                    className="text-[10px] text-center border-slate-300 focus-visible:ring-sky-500 h-7 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveItem(idx)}
                    className="h-7 w-7 text-rose-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* SECCIÓN 3: FECHAS DE PROGRAMACIÓN */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
              <Calendar className="h-4 w-4 text-sky-600" />
              3. Fechas de Programación y Ejecución
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">FECHA RECEPCIÓN</Label>
                <Input
                  type="date"
                  value={fechaRecepcion}
                  onChange={(e) => {
                    setFechaRecepcion(e.target.value)
                    markDirty()
                  }}
                  className="mt-1 bg-white font-medium"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">INICIO PROGRAMADO</Label>
                <Input
                  type="date"
                  value={inicioProgramado}
                  onChange={(e) => {
                    setInicioProgramado(e.target.value)
                    markDirty()
                  }}
                  className="mt-1 bg-white font-medium"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">FIN PROGRAMADO</Label>
                <Input
                  type="date"
                  value={finProgramado}
                  onChange={(e) => {
                    setFinProgramado(e.target.value)
                    markDirty()
                  }}
                  className="mt-1 bg-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: OBSERVACIONES Y RESPONSABLES */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
              <UserCheck className="h-4 w-4 text-sky-600" />
              4. Observaciones y Responsables
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600">Observaciones</Label>
              <Textarea
                placeholder="Indicar observaciones adicionales si las hubiera..."
                value={observaciones}
                onChange={(e) => {
                  setObservaciones(e.target.value)
                  markDirty()
                }}
                className="mt-1 bg-white min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-slate-600">OT Aperturada Por</Label>
                <select
                  value={otAperturadaPor}
                  onChange={(e) => {
                    setOtAperturadaPor(e.target.value)
                    markDirty()
                  }}
                  className="w-full mt-1 border border-slate-300 rounded-md bg-white h-9 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                >
                  <option value="BETZABETH SARAVIA">BETZABETH SARAVIA</option>
                  <option value="JESUS MEJIA">JESUS MEJIA</option>
                  <option value="LUIS MENDOZA">LUIS MENDOZA</option>
                  <option value="DANTE VALENTIN">DANTE VALENTIN</option>
                  <option value="CRISTHIAN ZAMUDIO">CRISTHIAN ZAMUDIO</option>
                  <option value="JORDY FLORES">JORDY FLORES</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-600">
                  OT Designada A (Técnico Responsable)
                </Label>
                <select
                  value={otDesignadaA}
                  onChange={(e) => {
                    setOtDesignadaA(e.target.value)
                    markDirty()
                  }}
                  className={`w-full mt-1 border rounded-md bg-white h-9 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium ${
                    !otDesignadaA ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-300"
                  }`}
                >
                  <option value="">-- Selecciona el técnico designado --</option>
                  <option value="JESUS MEJIA">JESUS MEJIA</option>
                  <option value="LUIS MENDOZA">LUIS MENDOZA</option>
                  <option value="DANTE VALENTIN">DANTE VALENTIN</option>
                  <option value="CRISTHIAN ZAMUDIO">CRISTHIAN ZAMUDIO</option>
                  <option value="JORDY FLORES">JORDY FLORES</option>
                  <option value="BETZABETH SARAVIA">BETZABETH SARAVIA</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t border-slate-200 flex justify-between sm:justify-between items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelClick}
            disabled={loading}
            className="cursor-pointer"
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...
              </>
            ) : isEditing ? (
              "Actualizar OT Concreto"
            ) : (
              "Guardar OT Concreto"
            )}
          </Button>
        </DialogFooter>
      </form>

      {/* Confirmación al cerrar con cambios sin guardar */}
      <ModernConfirmDialog
        open={showConfirmClose}
        onOpenChange={setShowConfirmClose}
        title="¿Descartar cambios sin guardar?"
        description="Has realizado modificaciones en la Orden de Trabajo. Si sales ahora, los cambios se perderán."
        confirmText="Descartar cambios"
        cancelText="Seguir editando"
        variant="warning"
        onConfirm={() => {
          setShowConfirmClose(false)
          setIsDirty(false)
          onDirtyChange?.(false)
          onCancel()
        }}
      />
    </DialogContent>
  )
}
