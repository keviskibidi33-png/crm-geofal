"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Loader2, Calendar, FileText, UserCheck, Layers, Hash, Wand2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { ModernConfirmDialog } from "@/components/dashboard/modern-confirm-dialog"
import { OTMuestrasItemList, itemsToCards, cardsToItems, type OTMuestraCard } from "./OTMuestrasItemList"
import type { OTData } from "./OTForm"

const RESPONSABLES_APERTURA = [
  "-",
  "BETZABETH SARAVIA",
]

const RESPONSABLES_DESIGNADOS = [
  "BEATRIZ PARINANGO GARCÍA",
  "DEYVI INFANZÓN",
  "IVAN CHACON",
]

interface OTSueloAgregadoFormProps {
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

export function OTSueloAgregadoForm({
  initialData,
  initialNumeroRecepcion,
  onSuccess,
  onCancel,
  onDirtyChange,
}: OTSueloAgregadoFormProps) {
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
  const [referencia] = useState(initialData?.referencia || "-")
  const [cliente] = useState(initialData?.cliente || "")
  const [proyecto] = useState(initialData?.proyecto || "")

  // 2. Tarjetas de Muestras con Sub-tabla de Ensayos
  const [cards, setCards] = useState<OTMuestraCard[]>(() =>
    initialData?.items && initialData.items.length > 0
      ? itemsToCards(initialData.items)
      : [
          {
            codigo_muestra: "",
            ensayos: [{ codigo: "", descripcion: "", norma: "", cantidad: 1 }],
          },
        ]
  )

  // 3. Fechas y Control
  const [fechaRecepcion, setFechaRecepcion] = useState(toIsoDate(initialData?.fecha_recepcion))
  const [plazoEntregaDias, setPlazoEntregaDias] = useState(initialData?.plazo_entrega_dias || "")
  const [inicioProgramado, setInicioProgramado] = useState(toIsoDate(initialData?.inicio_programado))
  const [finProgramado, setFinProgramado] = useState(toIsoDate(initialData?.fin_programado))
  const inicioReal = toIsoDate(initialData?.inicio_real)
  const finReal = toIsoDate(initialData?.fin_real)
  const variacionInicio = initialData?.variacion_inicio || ""
  const variacionFin = initialData?.variacion_fin || ""
  const duracionReal = initialData?.duracion_real_ejecucion_dias || ""

  // 4. Notas y Personal
  const [observaciones, setObservaciones] = useState(initialData?.observaciones || "")
  const [otAperturadaPor, setOtAperturadaPor] = useState(initialData?.ot_aperturada_por || "BETZABETH SARAVIA")
  const [otDesignadaA, setOtDesignadaA] = useState(initialData?.ot_designada_a || "")

  const opcionesApertura = Array.from(
    new Set([
      ...RESPONSABLES_APERTURA,
      ...(otAperturadaPor ? [otAperturadaPor.trim()] : []),
    ])
  )

  const opcionesDesignadas = Array.from(
    new Set([
      ...RESPONSABLES_DESIGNADOS,
      ...(otDesignadaA && otDesignadaA !== "-" ? [otDesignadaA.trim()] : []),
    ])
  )

  // Autocompletar automáticamente al abrir el modal desde recepción si es nueva OT o si los items son de concreto/inválidos
  useEffect(() => {
    const hasValidEnsayoItems =
      initialData?.items &&
      initialData.items.length > 0 &&
      initialData.items.some(
        (it) => it.codigo_ensayo || (it.descripcion && !it.descripcion.toUpperCase().includes("COMPRESION"))
      )
    if (initialNumeroRecepcion && (!initialData?.id || !hasValidEnsayoItems)) {
      void handlePrefill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      if (data.numero_ot) setNumeroOt(data.numero_ot)
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

      // Convertir items devueltos por el backend en tarjetas agrupadas por muestra
      if (Array.isArray(data.items) && data.items.length > 0) {
        const rawItems = data.items.map((it: any, idx: number) => ({
          item: idx + 1,
          codigo_muestra: it.codigo_muestra || "",
          codigo_ensayo: it.codigo_ensayo || "",
          descripcion: it.descripcion || "",
          norma: it.norma || "",
          cantidad: 1,
        }))
        const generatedCards = itemsToCards(rawItems)
        setCards(generatedCards)
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

    const flattenedItems = cardsToItems(cards)

    if (!flattenedItems || flattenedItems.length === 0) {
      toast.error("Debes registrar al menos una muestra y un ensayo en la Orden de Trabajo.")
      return
    }

    // Validar códigos de muestra y descripciones
    const itemInvalido = flattenedItems.find((it) => !it.codigo_muestra?.trim() || !it.descripcion?.trim())
    if (itemInvalido) {
      toast.error(`El ítem #${itemInvalido.item} tiene campos requeridos vacíos (código de muestra o descripción).`)
      return
    }

    const payload = {
      numero_ot: cleanOt,
      numero_recepcion: numeroRecepcion.trim() || null,
      referencia: referencia?.trim() || "-",
      cliente: cliente?.trim() || null,
      proyecto: proyecto?.trim() || null,
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
      items: flattenedItems,
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
        const errorMsg = typeof errorData.detail === "string"
          ? errorData.detail
          : Array.isArray(errorData.detail)
            ? errorData.detail.map((e: any) => `${e.loc ? e.loc.slice(-1)[0] : "campo"}: ${e.msg}`).join("; ")
            : (errorData.message || "Error al guardar la Orden de Trabajo")
        throw new Error(errorMsg)
      }

      toast.success(initialData?.id ? "OT Suelo y Agregado actualizada" : "OT Suelo y Agregado creada exitosamente")
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
            ? `Editar OT Suelo y Agregado: ${initialData.numero_ot}`
            : "Crear Nueva Orden de Trabajo — Suelo y Agregado / Ensayos"}
        </DialogTitle>
        <DialogDescription>
          Formulario estructurado exactamente según la plantilla oficial F-LEM-P-02.03 (HOJA 1 (2)).
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
          {/* SECCIÓN 1: ENCABEZADO (Solo N° OT y N° RECEPCIÓN) */}
          <div className="bg-sky-50/50 p-4 rounded-xl border border-sky-100 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-900 border-b border-sky-200/60 pb-2">
              <Hash className="h-4 w-4 text-sky-600" />
              1. Identificación y Recepción
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">N° OT</Label>
                <div className="mt-1">
                  <Input
                    placeholder="193-26"
                    value={numeroOt}
                    onChange={(e) => {
                      setNumeroOt(e.target.value)
                      markDirty()
                    }}
                    onBlur={() => {
                      const val = numeroOt.trim()
                      if (val && val !== "-" && !val.includes("-") && /^\d+$/.test(val)) {
                        const year = new Date().getFullYear().toString().slice(-2)
                        setNumeroOt(`${val}-${year}`)
                        markDirty()
                      }
                    }}
                    className="font-mono font-bold bg-white border-slate-300 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">N° RECEPCIÓN</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="193-26"
                    value={numeroRecepcion}
                    onChange={(e) => {
                      setNumeroRecepcion(e.target.value)
                      setPrefilled(false)
                      markDirty()
                    }}
                    onBlur={() => {
                      const val = numeroRecepcion.trim()
                      if (val && val !== "-" && !val.includes("-") && /^\d+$/.test(val)) {
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
            </div>
          </div>

          {/* SECCIÓN 2: TARJETAS DE MUESTRAS CON SUB-TABLA DE ENSAYOS (F-LEM-P-02.03) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
              <Layers className="h-4 w-4 text-sky-600" />
              2. Muestras y Ensayos de Laboratorio (F-LEM-P-02.03)
            </div>

            <OTMuestrasItemList
              cards={cards}
              onChange={(newCards) => {
                setCards(newCards)
                markDirty()
              }}
              markDirty={markDirty}
            />
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

          {/* SECCIÓN 4: NOTAS Y RESPONSABLES */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
              <UserCheck className="h-4 w-4 text-sky-600" />
              4. Notas y Personal Designado
            </div>

            <div>
              <Label className="text-xs font-medium text-slate-600">Notas</Label>
              <Textarea
                placeholder="Indicar notas adicionales si las hubiera..."
                value={observaciones}
                onChange={(e) => {
                  setObservaciones(e.target.value)
                  markDirty()
                }}
                className="mt-1 bg-white min-h-15"
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
                  className="w-full mt-1 border border-slate-300 rounded-md bg-white h-9 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium cursor-pointer"
                >
                  {opcionesApertura.map((resp) => (
                    <option key={resp} value={resp}>
                      {resp}
                    </option>
                  ))}
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
                  className={`w-full mt-1 border rounded-md bg-white h-9 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium cursor-pointer ${
                    !otDesignadaA || otDesignadaA === "-" ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-300"
                  }`}
                >
                  <option value="">-- Selecciona el técnico designado --</option>
                  {opcionesDesignadas.map((tec) => (
                    <option key={tec} value={tec}>
                      {tec}
                    </option>
                  ))}
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
              "Actualizar OT Suelo y Agregado"
            ) : (
              "Crear Nueva Orden de Trabajo"
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
