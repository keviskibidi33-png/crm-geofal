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
import { useAuth } from "@/hooks/use-auth"

export interface OTItem {
  item: number
  codigo_muestra: string
  codigo_ensayo?: string | null
  descripcion: string
  norma?: string | null
  cantidad: number | string
  // Columnas específicas de OT Concreto
  elemento?: string | null
  fecha_rotura?: string | null
  densidad?: string | null
  edad?: number | string | null
  fc_kg_cm2?: number | string | null
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
  initialNumeroRecepcion?: string | null
  tipo?: "CONCRETO" | "MUESTRAS" | "AUTO"
  onSuccess: () => void
  onCancel: () => void
  /** Callback para notificar al padre si hay cambios no guardados */
  onDirtyChange?: (isDirty: boolean) => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

function toIsoDate(val?: string | null): string {
  if (!val) return ""
  const s = String(val).trim()
  if (!s || s === "-") return ""
  // Si ya viene como YYYY-MM-DD o ISO string
  const clean = s.split("T")[0].split(" ")[0].replace(/\//g, "-")
  const parts = clean.split("-")
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    } else if (parts[2].length === 2) {
      // DD-MM-YY -> 20YY-MM-DD
      return `20${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    }
  }
  return clean
}

export function OTForm({ initialData, initialNumeroRecepcion, tipo = "AUTO", onSuccess, onCancel, onDirtyChange }: OTFormProps) {
  const { user } = useAuth()
  const isEditing = !!initialData?.id
  const [loading, setLoading] = useState(false)
  const [prefilling, setPrefilling] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  // Dirty state: true si hay cambios no guardados
  const [isDirty, setIsDirty] = useState(false)

  const markDirty = () => {
    if (!isDirty) {
      setIsDirty(true)
      onDirtyChange?.(true)
    }
  }

  // Encabezado
  const [numeroOt, setNumeroOt] = useState(initialData?.numero_ot || (initialNumeroRecepcion ? (initialNumeroRecepcion.toUpperCase().startsWith("OT-") ? initialNumeroRecepcion : `${initialNumeroRecepcion}`) : ""))
  const [numeroRecepcion, setNumeroRecepcion] = useState(initialData?.numero_recepcion || initialNumeroRecepcion || "")
  const [referencia, setReferencia] = useState(initialData?.referencia || "-")

  // Auto-prefill si viene initialNumeroRecepcion en modo nuevo
  useEffect(() => {
    if (initialNumeroRecepcion && !initialData?.id) {
      const runPrefill = async () => {
        setPrefilling(true)
        try {
          const res = await authFetch(`${API_URL}/api/ot/prefill/${encodeURIComponent(initialNumeroRecepcion.trim())}`)
          if (res.ok) {
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
              toast.warning("⚠️ No se encontró técnico en Verificación de Muestras. Por favor selecciona el técnico designado manualmente.")
            }
            if (Array.isArray(data.items) && data.items.length > 0) {
              const hasConcreteFields = data.items.some(
                (it: any) =>
                  (it.fc_kg_cm2 !== undefined && it.fc_kg_cm2 !== null && it.fc_kg_cm2 !== "") ||
                  (it.elemento && it.elemento !== "-") ||
                  String(it.codigo_muestra || "").toUpperCase().includes("CO") ||
                  String(it.descripcion || "").toUpperCase().includes("COMPRESION")
              )
              setItems(
                data.items.map((it: any, idx: number) => ({
                  item: idx + 1,
                  codigo_muestra: it.codigo_muestra || `M-${String(idx + 1).padStart(2, "0")}`,
                  codigo_ensayo: it.codigo_ensayo || "",
                  descripcion: it.descripcion || (hasConcreteFields ? "COMPRESION PROBETAS ASTM C39/C39M" : ""),
                  norma: it.norma || "",
                  cantidad: it.cantidad ?? 1,
                  elemento: it.elemento || "-",
                  fecha_rotura: toIsoDate(it.fecha_rotura),
                  densidad: (it.densidad === "SI" || it.densidad === "NO") ? it.densidad : "NO",
                  edad: it.edad ?? "",
                  fc_kg_cm2: it.fc_kg_cm2 ?? "",
                }))
              )
            }
            setPrefilled(true)
            markDirty()
          }
        } catch {
          // non-blocking
        } finally {
          setPrefilling(false)
        }
      }
      runPrefill()
    }
  }, [initialNumeroRecepcion])

  // Datos del cliente (auto-fill desde recepción)
  const [cliente, setCliente] = useState(initialData?.cliente || "")
  const [proyecto, setProyecto] = useState(initialData?.proyecto || "")

  // Tabla dinamica de ítems
  const [items, setItems] = useState<OTItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items.map((it, idx) => ({
          item: idx + 1,
          codigo_muestra: it.codigo_muestra || "",
          codigo_ensayo: it.codigo_ensayo || "",
          descripcion: it.descripcion || "",
          norma: it.norma || "",
          cantidad: it.cantidad ?? 1,
          elemento: it.elemento || "-",
          fecha_rotura: toIsoDate(it.fecha_rotura),
          densidad: (it.densidad === "SI" || it.densidad === "NO") ? it.densidad : "NO",
          edad: it.edad ?? "",
          fc_kg_cm2: it.fc_kg_cm2 ?? "",
        }))
      : [
          {
            item: 1,
            codigo_muestra: "",
            codigo_ensayo: "",
            descripcion: "",
            norma: "",
            cantidad: 1,
          },
        ]
  )

  // Detección del tipo de OT: explícito por prop tipo o inferido por items
  const isConcreto = tipo === "CONCRETO" ? true : tipo === "MUESTRAS" ? false : items.some(
    (it) =>
      (it.fc_kg_cm2 !== undefined && it.fc_kg_cm2 !== null && it.fc_kg_cm2 !== "") ||
      (it.elemento && it.elemento !== "-") ||
      String(it.codigo_muestra || "").toUpperCase().includes("CO") ||
      (it.descripcion && String(it.descripcion).toUpperCase().includes("COMPRESION"))
  )

  // Fechas y Control de Ejecución (formato ISO para input[type=date])
  const [fechaRecepcion, setFechaRecepcion] = useState(toIsoDate(initialData?.fecha_recepcion))
  const [plazoEntregaDias, setPlazoEntregaDias] = useState(initialData?.plazo_entrega_dias || "")
  const [inicioProgramado, setInicioProgramado] = useState(toIsoDate(initialData?.inicio_programado))
  const [finProgramado, setFinProgramado] = useState(toIsoDate(initialData?.fin_programado))
  const [inicioReal, setInicioReal] = useState(toIsoDate(initialData?.inicio_real))
  const [finReal, setFinReal] = useState(toIsoDate(initialData?.fin_real))
  const [variacionInicio, setVariacionInicio] = useState(initialData?.variacion_inicio || "")
  const [variacionFin, setVariacionFin] = useState(initialData?.variacion_fin || "")
  const [duracionReal, setDuracionReal] = useState(initialData?.duracion_real_ejecucion_dias || "")

  // Notas y Personal
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "")
  // Default a BETZABETH ZARABIA si no se especifica
  const [otAperturadaPor, setOtAperturadaPor] = useState(initialData?.ot_aperturada_por || "BETZABETH SARAVIA")
  const [otDesignadaA, setOtDesignadaA] = useState(initialData?.ot_designada_a || "")

  /**
   * Auto-fill desde recepción: consulta el endpoint prefill y rellena
   * cliente, proyecto, fecha, responsables y lista de probetas automáticamente.
   */
  const handlePrefill = async () => {
    const num = numeroRecepcion.trim()
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

      // Rellenar campos del encabezado y fechas programadas
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
        toast.warning("⚠️ No se encontró técnico en Verificación de Muestras. Por favor selecciona el técnico designado manualmente.")
      }

      // Rellenar ítems con trazabilidad completa
      if (Array.isArray(data.items) && data.items.length > 0) {
        const hasConcreteFields = data.items.some(
          (it: any) =>
            (it.fc_kg_cm2 !== undefined && it.fc_kg_cm2 !== null && it.fc_kg_cm2 !== "") ||
            (it.elemento && it.elemento !== "-") ||
            String(it.codigo_muestra || "").toUpperCase().includes("CO") ||
            String(it.descripcion || "").toUpperCase().includes("COMPRESION")
        )

        setItems(
          data.items.map((it: any, idx: number) => ({
            item: idx + 1,
            codigo_muestra: it.codigo_muestra || `M-${String(idx + 1).padStart(2, "0")}`,
            codigo_ensayo: it.codigo_ensayo || "",
            descripcion: it.descripcion || (hasConcreteFields ? "COMPRESION PROBETAS ASTM C39/C39M" : ""),
            norma: it.norma || "",
            cantidad: it.cantidad ?? 1,
            elemento: it.elemento || "-",
            fecha_rotura: toIsoDate(it.fecha_rotura),
            densidad: (it.densidad === "SI" || it.densidad === "NO") ? it.densidad : "NO",
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

  // Recalcular días de plazo si cambian inicio o fin programado
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
    if (isConcreto) {
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
    } else {
      setItems((prev) => [
        ...prev,
        {
          item: prev.length + 1,
          codigo_muestra: "",
          codigo_ensayo: "",
          descripcion: "",
          norma: "",
          cantidad: 1,
        },
      ])
    }
    markDirty()
  }

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.warning("La Orden de Trabajo debe tener al menos un ítem.")
      return
    }
    const newItems = items.filter((_, idx) => idx !== index)
    // Reenumerar correlativos
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

  /**
   * Envío del formulario
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanOt = numeroOt.trim()
    if (!cleanOt) {
      toast.error("El N° de OT es obligatorio.")
      return
    }

    if (!items || items.length === 0) {
      toast.error("Debes registrar al menos un ítem o muestra en la Orden de Trabajo.")
      return
    }

    // Validar que no haya códigos de muestra vacíos
    const itemInvalido = items.find((it) => !it.codigo_muestra?.trim())
    if (itemInvalido) {
      toast.error(`El ítem #${itemInvalido.item} no tiene código de muestra.`)
      return
    }

    // Payload de envío
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
        codigo_ensayo: it.codigo_ensayo?.trim() || null,
        descripcion: it.descripcion.trim(),
        norma: it.norma?.trim() || null,
        cantidad: it.cantidad ?? 1,
        elemento: it.elemento || "-",
        fecha_rotura: it.fecha_rotura || null,
        densidad: it.densidad || "-",
        edad: it.edad !== undefined && it.edad !== "" ? Number(it.edad) : null,
        fc_kg_cm2: it.fc_kg_cm2 !== undefined && it.fc_kg_cm2 !== "" ? Number(it.fc_kg_cm2) : null,
      })),
      // estado es automático — no se envía desde el formulario
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

      toast.success(initialData?.id ? "Orden de Trabajo actualizada" : "Orden de Trabajo creada exitosamente")
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
          {initialData?.id
            ? `Editar OT: ${initialData.numero_ot}`
            : isConcreto
              ? "Crear Nueva Orden de Trabajo — Concreto (Probetas)"
              : "Crear Nueva Orden de Trabajo — Suelo y Agregado / Ensayos"}
        </DialogTitle>
        <DialogDescription>
          {isConcreto
            ? "Formulario estructurado exactamente según la plantilla oficial F-LEM-P-02.01 (MYP)."
            : "Formulario estructurado exactamente según la plantilla oficial F-LEM-P-02.03 (HOJA 1 (2))."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} onInput={markDirty} className="flex-1 flex flex-col min-h-0 space-y-6 pt-4">
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* SECCIÓN 1: ENCABEZADO */}
          <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-200/80 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-900 border-b border-sky-200 pb-2">
              <Hash className="h-4 w-4 text-sky-600" />
              1. Encabezado de Orden de Trabajo
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">N° OT *</Label>
                <div className="relative flex items-center mt-1">
                  {numeroOt.trim() !== "" && !/^ot/i.test(numeroOt.trim()) && (
                    <span className="absolute left-3 font-mono font-bold text-slate-400 pointer-events-none select-none text-sm">
                      OT-
                    </span>
                  )}
                  <Input
                    placeholder="ej. 1981-26"
                    value={numeroOt}
                    onChange={(e) => { setNumeroOt(e.target.value); markDirty() }}
                    onBlur={() => {
                      const val = numeroOt.trim()
                      if (val && !val.includes("-")) {
                        const year = new Date().getFullYear().toString().slice(-2)
                        setNumeroOt(`${val}-${year}`)
                        markDirty()
                      }
                    }}
                    className={`font-mono font-bold bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500 ${
                      numeroOt.trim() !== "" && !/^ot/i.test(numeroOt.trim()) ? "pl-10" : ""
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
                    onChange={(e) => { setNumeroRecepcion(e.target.value); setPrefilled(false) }}
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
                    {prefilling ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
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
                  onChange={(e) => setReferencia(e.target.value)}
                  className="mt-1 bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                />
              </div>
            </div>

            {/* CLIENTE Y PROYECTO — auto-llenados desde recepción */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-sky-200/60">
              <div>
                <Label className="text-xs font-semibold text-slate-700">CLIENTE</Label>
                <Input
                  placeholder="Nombre del cliente"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className="mt-1 bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">PROYECTO</Label>
                <Input
                  placeholder="Nombre del proyecto"
                  value={proyecto}
                  onChange={(e) => setProyecto(e.target.value)}
                  className="mt-1 bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: TABLA DE MUESTRAS / ENSAYOS (Adaptable a Concreto o Suelo y Agregado) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Layers className="h-4 w-4 text-sky-600" />
                {isConcreto ? "2. Probetas de Concreto" : "2. Ensayos y Muestras de Laboratorio"}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="gap-1 text-xs border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 font-medium cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar Fila
              </Button>
            </div>

            {isConcreto ? (
              <>
                {/* Cabecera de columnas Concreto */}
                <div className="grid gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2" style={{gridTemplateColumns: '28px 115px 1fr 115px 135px 65px 55px 65px 32px'}}>
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
                      style={{gridTemplateColumns: '28px 115px 1fr 115px 135px 65px 55px 65px 32px'}}
                    >
                      <div className="text-center font-bold text-slate-400 text-xs">{idx + 1}</div>

                      <Input
                        placeholder="15XXX-CO-26"
                        value={item.codigo_muestra}
                        onChange={(e) => handleItemChange(idx, "codigo_muestra", e.target.value)}
                        className="text-xs font-mono border-slate-300 focus-visible:ring-sky-500 h-7 px-2"
                      />

                      {/* Descripción FIJA — no editable */}
                      <div className="text-[10px] font-medium text-slate-600 bg-slate-100 rounded px-2 py-1 truncate" title="COMPRESION PROBETAS ASTM C39/C39M">
                        COMPRESION PROBETAS ASTM C39/C39M
                      </div>

                      <select
                        value={item.elemento || "-"}
                        onChange={(e) => handleItemChange(idx, "elemento", e.target.value)}
                        className="text-[10px] border border-slate-300 rounded bg-white h-7 px-1 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                      >
                        {(Array.from(new Set(["-", "4 in x 8 in", "6 in x 12 in", "VIGA", "CUBO", item.elemento || "-"])) as string[]).map((opt) => (
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
                        value={item.densidad || "-"}
                        onChange={(e) => handleItemChange(idx, "densidad", e.target.value)}
                        className="text-[10px] border border-slate-300 rounded bg-white h-7 px-1 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="-">-</option>
                        <option value="SI">SI</option>
                        <option value="NO">NO</option>
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
              </>
            ) : (
              <>
                {/* Cabecera de columnas Suelo y Agregado */}
                <div className="grid gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide px-2" style={{gridTemplateColumns: '28px 130px 100px 1fr 140px 65px 32px'}}>
                  <span className="text-center">#</span>
                  <span>CÓDIGO MUESTRA</span>
                  <span>CÓD. ENSAYO</span>
                  <span>DESCRIPCIÓN</span>
                  <span>NORMA</span>
                  <span className="text-center">CANTIDAD</span>
                  <span />
                </div>

                <div className="space-y-1.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid gap-1.5 items-center bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
                      style={{gridTemplateColumns: '28px 130px 100px 1fr 140px 65px 32px'}}
                    >
                      <div className="text-center font-bold text-slate-400 text-xs">{idx + 1}</div>

                      <Input
                        placeholder="ej. 3386"
                        value={item.codigo_muestra}
                        onChange={(e) => handleItemChange(idx, "codigo_muestra", e.target.value)}
                        className="text-xs font-mono font-medium border-slate-300 focus-visible:ring-sky-500 h-7 px-2"
                      />

                      <Input
                        placeholder="ej. SU24"
                        value={item.codigo_ensayo || ""}
                        onChange={(e) => handleItemChange(idx, "codigo_ensayo", e.target.value)}
                        className="text-xs font-mono font-bold text-sky-700 border-slate-300 focus-visible:ring-sky-500 h-7 px-2"
                      />

                      <Input
                        placeholder="Descripción del ensayo"
                        value={item.descripcion}
                        onChange={(e) => handleItemChange(idx, "descripcion", e.target.value)}
                        className="text-xs font-medium border-slate-300 focus-visible:ring-sky-500 h-7 px-2"
                      />

                      <Input
                        placeholder="ej. ASTM D6913"
                        value={item.norma || ""}
                        onChange={(e) => handleItemChange(idx, "norma", e.target.value)}
                        className="text-xs text-slate-600 border-slate-300 focus-visible:ring-sky-500 h-7 px-2"
                      />

                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={item.cantidad ?? 1}
                        onChange={(e) => handleItemChange(idx, "cantidad", e.target.value)}
                        className="text-xs text-center font-bold border-slate-300 focus-visible:ring-sky-500 h-7 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
              </>
            )}
          </div>

          {/* SECCIÓN 3: FECHAS (solo las 3 columnas del Excel OT-CONCRETO fila 24) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
              <Calendar className="h-4 w-4 text-emerald-600" />
              3. Fechas de Programación
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">FECHA DE RECEPCIÓN</Label>
                <Input
                  type="date"
                  value={fechaRecepcion}
                  onChange={(e) => setFechaRecepcion(e.target.value)}
                  className="mt-1 text-xs bg-white border-slate-300 focus-visible:ring-sky-500"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">INICIO PROGRAMADO</Label>
                <Input
                  type="date"
                  value={inicioProgramado}
                  onChange={(e) => setInicioProgramado(e.target.value)}
                  className="mt-1 text-xs bg-white border-slate-300 focus-visible:ring-sky-500"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">FIN PROGRAMADO</Label>
                <Input
                  type="date"
                  value={finProgramado}
                  onChange={(e) => setFinProgramado(e.target.value)}
                  className="mt-1 text-xs bg-white border-slate-300 focus-visible:ring-sky-500"
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
                className="mt-1 text-xs bg-white border-slate-300 focus-visible:ring-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">OT APERTURADA POR</Label>
                <select
                  value={otAperturadaPor || "BETZABETH ZARABIA"}
                  onChange={(e) => setOtAperturadaPor(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">— Seleccionar —</option>
                  {(Array.from(new Set(["BETZABETH ZARABIA", otAperturadaPor].filter(Boolean))) as string[]).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">OT DESIGNADA A (Técnicos)</Label>
                <select
                  value={otDesignadaA}
                  onChange={(e) => setOtDesignadaA(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">— Seleccionar —</option>
                  {(Array.from(new Set(["DEIVI INFANSON", "IVAN CHACON", otDesignadaA].filter(Boolean))) as string[]).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4 border-t border-slate-200 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="bg-sky-600 hover:bg-sky-700 text-white gap-2 px-6 font-semibold shadow-md">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {initialData?.id ? "Actualizar OT" : "Guardar OT"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
