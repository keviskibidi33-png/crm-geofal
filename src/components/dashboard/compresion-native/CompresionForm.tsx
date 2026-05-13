"use client"

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"
import { getSafeErrorMessage } from "@/lib/error-message"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { DatePickerSmart } from "@/components/ui/date-picker-smart"
import { useFormPersistCompression } from "@/hooks/use-form-persist-compresion"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Loader2,
  Search,
  Trash2,
  Plus,
  Download,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

function getTodayPeruIso(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === "year")?.value ?? ""
  const m = parts.find((p) => p.type === "month")?.value ?? ""
  const d = parts.find((p) => p.type === "day")?.value ?? ""
  return `${y}-${m}-${d}`
}

function formatRecepcionNumber(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^REC-/i.test(trimmed)) return trimmed.toUpperCase()
  const currentYear = new Date().getFullYear().toString().slice(-2)
  return `REC-${trimmed}-${currentYear}`
}

function formatOtNumber(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^OT-/i.test(trimmed)) return trimmed.toUpperCase()
  const currentYear = new Date().getFullYear().toString().slice(-2)
  return `OT-${trimmed}-${currentYear}`
}

const REALIZADO_OPTIONS = ["Andres Sanchez", "Deyvi Infanzon", "Ivan Chancon"]
const REVISADO_OPTIONS = ["Fabian la Rosa"]
const APROBADO_OPTIONS = ["Irma Coaquira"]
const DEFECTOS_OPTIONS = ["Ninguno", "A", "B", "C", "D", "E"]
const TIPO_FRACTURA_OPTIONS = ["1", "2", "3", "4", "5", "6"]
const EQUIPO_NOMBRES: Record<string, string> = {
  "EQP-0023": "PRENSA CONCRETO",
}
const EQUIPO_OPTIONS = Object.entries(EQUIPO_NOMBRES).map(([codigo, nombre]) => ({
  codigo,
  nombre,
  label: `${codigo} - ${nombre}`,
}))

// Zod schema
const itemSchema = z.object({
  item: z.number().min(1),
  codigo_lem: z.string().min(1, "Requerido"),
  fecha_ensayo_programado: z.string().nullable().optional(),
  fecha_ensayo: z.string().nullable().optional(),
  hora_ensayo: z.string().nullable().optional(),
  carga_maxima: z.number().nullable().optional(),
  tipo_fractura: z.string().nullable().optional(),
  defectos: z.string().nullable().optional(),
  defectos_custom: z.string().nullable().optional(),
  diametro: z.number().nullable().optional(),
  area: z.number().nullable().optional(),
  realizado: z.string().nullable().optional(),
  revisado: z.string().nullable().optional(),
  fecha_revisado: z.string().nullable().optional(),
  aprobado: z.string().nullable().optional(),
  fecha_aprobado: z.string().nullable().optional(),
})

const formSchema = z.object({
  recepcion_numero: z.string().min(1, "Número de recepción requerido"),
  ot_numero: z.string().min(1, "Número OT requerido"),
  recepcion_id: z.number().nullable().optional(),
  codigo_equipo: z.string().nullable().optional(),
  otros: z.string().nullable().optional(),
  nota: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, "Debe tener al menos un item"),
})

type FormData = z.infer<typeof formSchema>

function formatLemCode(value: string): string {
  if (!value) return ""
  const currentYear = new Date().getFullYear().toString().slice(-2)
  const suffix = `-CO-${currentYear}`
  let clean = value.trim().toUpperCase()
  if (/^\d+$/.test(clean)) return `${clean}${suffix}`
  if (clean.endsWith("-CO") || clean.endsWith("-CO-")) {
    const base = clean.replace(/-CO-?$/, "")
    return `${base}${suffix}`
  }
  if (clean.endsWith(suffix)) return clean
  return clean
}

function hasItemData(item: any): boolean {
  if (!item) return false
  const codigoLem = String(item.codigo_lem || "").trim().toUpperCase()
  const codigoEsPlaceholder =
    codigoLem === "" ||
    codigoLem === "-" ||
    /^X{2,}(?:-CO(?:-\d{2})?)?$/.test(codigoLem)
  const tieneCodigoUtil = !codigoEsPlaceholder
  const textFields = [
    item.hora_ensayo,
    item.tipo_fractura,
    item.defectos,
    item.defectos_custom,
    item.realizado,
    item.revisado,
    item.aprobado,
  ]
  if (tieneCodigoUtil || textFields.some((v) => typeof v === "string" && v.trim() !== ""))
    return true
  const numericFields = [item.carga_maxima, item.diametro, item.area]
  return numericFields.some((v) => v !== undefined && v !== null && String(v).trim() !== "")
}

function sanitizeItems(items: any[]): any[] {
  const source = Array.isArray(items) ? items : []
  const filtered = source.filter((item) => hasItemData(item))
  return filtered.map((item, index) => {
    const parsedItem = Number(item.item)
    const normalizedItem = Number.isFinite(parsedItem) && parsedItem > 0 ? parsedItem : index + 1
    return {
      ...item,
      item: normalizedItem,
      codigo_lem: String(item.codigo_lem || "").trim().toUpperCase(),
    }
  })
}

function createItemTemplate(itemNum: number): any {
  return {
    item: itemNum,
    codigo_lem: "",
    fecha_ensayo_programado: null,
    fecha_ensayo: null,
    hora_ensayo: null,
    carga_maxima: null,
    tipo_fractura: null,
    defectos: null,
    defectos_custom: null,
    diametro: null,
    area: null,
    realizado: null,
    revisado: null,
    fecha_revisado: null,
    aprobado: null,
    fecha_aprobado: null,
  }
}

interface CompresionFormProps {
  editId?: number | null
  importedData?: any
  onClose?: () => void
  onSaved?: () => void
}

export default function CompresionForm({ editId, importedData, onClose, onSaved }: CompresionFormProps) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      recepcion_numero: "",
      ot_numero: "",
      recepcion_id: null,
      codigo_equipo: "EQP-0023",
      otros: "",
      nota: "",
      items: Array.from({ length: 4 }, (_, i) => createItemTemplate(i + 1)),
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const { clearSavedData, hasSavedData } = useFormPersistCompression(
    editId ? `compresion-edit-${editId}` : "compresion-create",
    { watch, reset } as any,
    !editId
  )

  const [loadingEdit, setLoadingEdit] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [traceStatus, setTraceStatus] = useState<any>(null)
  const [sourceLockField, setSourceLockField] = useState<"codigo_lem" | "fecha_ensayo_programado" | null>(null)
  const [sourceLockMessage, setSourceLockMessage] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Confirm modals
  const [showClearDraftConfirm, setShowClearDraftConfirm] = useState(false)
  const [deleteItemTarget, setDeleteItemTarget] = useState<{ index: number; code: string } | null>(null)
  const [deleteItemConfirmText, setDeleteItemConfirmText] = useState("")

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Load edit data
  useEffect(() => {
    if (!editId) return
    setLoadingEdit(true)
    authFetch(`${API_URL}/api/compresion/${editId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Error al cargar")
        const data = await res.json()
        reset({
          recepcion_numero: data.numero_recepcion || "",
          ot_numero: data.numero_ot || "",
          recepcion_id: data.recepcion_id || null,
          codigo_equipo: data.codigo_equipo || "EQP-0023",
          otros: data.otros || "",
          nota: data.nota || "",
          items:
            data.items?.map((item: any, idx: number) => ({
              item: item.item || idx + 1,
              codigo_lem: item.codigo_lem || "",
              fecha_ensayo_programado: item.fecha_ensayo_programado
                ? String(item.fecha_ensayo_programado).split("T")[0]
                : null,
              fecha_ensayo: item.fecha_ensayo
                ? String(item.fecha_ensayo).split("T")[0]
                : null,
              hora_ensayo: item.hora_ensayo || null,
              carga_maxima: item.carga_maxima ?? null,
              tipo_fractura: item.tipo_fractura || null,
              defectos: item.defectos || null,
              defectos_custom: item.defectos_custom || null,
              diametro: item.diametro ?? null,
              area: item.area ?? null,
              realizado: item.realizado || null,
              revisado: item.revisado || null,
              fecha_revisado: item.fecha_revisado
                ? String(item.fecha_revisado).split("T")[0]
                : null,
              aprobado: item.aprobado || null,
              fecha_aprobado: item.fecha_aprobado
                ? String(item.fecha_aprobado).split("T")[0]
                : null,
            })) || Array.from({ length: 4 }, (_, i) => createItemTemplate(i + 1)),
        })
        if (data.numero_recepcion) {
          checkTraceStatus(data.numero_recepcion)
        }
      })
      .catch(() => toast.error("Error al cargar el ensayo"))
      .finally(() => setLoadingEdit(false))
  }, [editId, reset])

  // Handle imported data
  useEffect(() => {
    if (!importedData) return
    // Populate header if available
    if (importedData.recepcion_numero) {
      setValue("recepcion_numero", importedData.recepcion_numero)
      setSearchQuery(importedData.recepcion_numero)
      checkTraceStatus(importedData.recepcion_numero)
    }
    if (importedData.recepcion_id) setValue("recepcion_id", importedData.recepcion_id)
    if (importedData.ot_numero) setValue("ot_numero", importedData.ot_numero)
    if (importedData.codigo_equipo) setValue("codigo_equipo", importedData.codigo_equipo)
    if (importedData.items?.length) {
      setValue(
        "items",
        importedData.items.map((item: any, idx: number) => ({
          item: idx + 1,
          codigo_lem: item.codigo_lem || "",
          fecha_ensayo_programado: item.fecha_ensayo_programado || null,
          fecha_ensayo: item.fecha_ensayo || null,
          hora_ensayo: item.hora_ensayo || null,
          carga_maxima: item.carga_maxima ?? null,
          tipo_fractura: item.tipo_fractura || null,
          defectos: item.defectos || null,
          defectos_custom: item.defectos_custom || null,
          diametro: item.diametro ?? null,
          area: item.area ?? null,
          realizado: item.realizado || null,
          revisado: item.revisado || null,
          fecha_revisado: item.fecha_revisado || null,
          aprobado: item.aprobado || null,
          fecha_aprobado: item.fecha_aprobado || null,
        }))
      )
    }
  }, [importedData, setValue])

  const checkTraceStatus = async (numero: string) => {
    try {
      const res = await authFetch(`${API_URL}/api/tracing/validate/${encodeURIComponent(numero)}`)
      if (res.ok) {
        const data = await res.json()
        setTraceStatus(data)
      }
    } catch {
      // ignore
    }
  }

  const handleSearch = useCallback(async (query?: string) => {
    const term = (query ?? searchQuery).trim()
    if (!term) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    setSearchLoading(true)
    try {
      const res = await authFetch(
        `${API_URL}/api/tracing/suggest?q=${encodeURIComponent(term)}`
      )
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data || [])
        setShowSearchDropdown((data || []).length > 0)
      }
    } catch {
      toast.error("Error de búsqueda")
    } finally {
      setSearchLoading(false)
    }
  }, [API_URL, searchQuery])

  const showSourceLock = useCallback((field: "codigo_lem" | "fecha_ensayo_programado") => {
    const messages = {
      codigo_lem: "El Cód. LEM proviene de Recepción y no puede modificarse desde Compresión.",
      fecha_ensayo_programado: "La F. Programado proviene de Recepción y no puede modificarse desde Compresión.",
    }
    setSourceLockField(field)
    setSourceLockMessage(messages[field])
  }, [])

  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    const term = searchQuery.trim()
    if (!term) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }

    searchDebounceRef.current = setTimeout(() => {
      void handleSearch(term)
    }, 250)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [searchQuery, handleSearch])

  const selectRecepcion = async (item: any) => {
    setShowSearchDropdown(false)
    setSearchResults([])
    const numeroRecepcion = item.numero_recepcion || item.numero || ""
    setSearchQuery(numeroRecepcion)
    setValue("recepcion_numero", numeroRecepcion)
    setValue("recepcion_id", item.recepcion_id || item.id || null)
    if (item.numero_ot) setValue("ot_numero", item.numero_ot)
    setTraceStatus({
      exists: true,
      recepcion: { status: item.estados?.recepcion || "pendiente", id: item.recepcion_id || item.id || null, numero_ot: item.numero_ot || "" },
      verificacion: { status: item.estados?.verificacion || "pendiente" },
      compresion: { status: item.estados?.compresion || "pendiente" },
      cliente: item.cliente || "",
      datos: {
        id: item.recepcion_id || item.id || null,
        numero_ot: item.numero_ot || "",
        cliente: item.cliente || "",
        fecha_recepcion: item.fecha_recepcion || null,
        muestras: [],
      },
    })

    // Try to fetch full recepcion to import samples
    try {
      const recepcionId = item.recepcion_id || item.id
      const res = await authFetch(`${API_URL}/api/recepcion/${recepcionId}`)
      if (res.ok) {
        const recepcion = await res.json()
        if (recepcion.muestras?.length) {
          const mapped = recepcion.muestras.map((m: any, idx: number) => ({
            item: idx + 1,
            codigo_lem: m.identificacion_muestra || "",
            fecha_ensayo_programado: m.fecha_rotura
              ? String(m.fecha_rotura).split("T")[0]
              : null,
            fecha_ensayo: m.fecha_rotura
              ? String(m.fecha_rotura).split("T")[0]
              : null,
            hora_ensayo: null,
            carga_maxima: null,
            tipo_fractura: null,
            defectos: null,
            defectos_custom: null,
            diametro: null,
            area: null,
            realizado: null,
            revisado: null,
            fecha_revisado: null,
            aprobado: null,
            fecha_aprobado: null,
          }))
          setValue("items", mapped)
          toast.success(`${mapped.length} muestras importadas de recepción`)
        }
      }
    } catch {
      // ignore
    }

    if (numeroRecepcion) {
      checkTraceStatus(numeroRecepcion)
    }
  }

  const handleSourceFieldInteraction = (field: "codigo_lem" | "fecha_ensayo_programado") => {
    showSourceLock(field)
  }

  const onSubmit = async (data: FormData) => {
    const sanitized = sanitizeItems(data.items)
    if (sanitized.length === 0) {
      toast.error("Debe completar al menos una fila válida")
      return
    }

    const payload = {
      numero_ot: data.ot_numero,
      numero_recepcion: data.recepcion_numero,
      recepcion_id: data.recepcion_id,
      codigo_equipo: data.codigo_equipo,
      otros: data.otros,
      nota: data.nota,
      items: sanitized.map((item) => ({
        ...item,
        fecha_ensayo_programado: item.fecha_ensayo_programado || undefined,
        fecha_ensayo: item.fecha_ensayo || undefined,
        fecha_revisado: item.fecha_revisado || undefined,
        fecha_aprobado: item.fecha_aprobado || undefined,
      })),
    }

    try {
      const url = editId
        ? `${API_URL}/api/compresion/${editId}`
        : `${API_URL}/api/compresion/`
      const method = editId ? "PUT" : "POST"
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        toast.success(editId ? "Ensayo actualizado correctamente" : "Ensayo creado correctamente")
        clearSavedData()
        onSaved?.()
        onClose?.()
      } else {
        let errMsg = `Error ${res.status}: ${res.statusText}`
        try {
          const err = await res.json().catch(() => null)
          errMsg = getSafeErrorMessage(err, errMsg)
        } catch {
          errMsg = `Error ${res.status}: ${res.statusText}`
        }
        toast.error("Error al guardar", { description: errMsg })
      }
    } catch {
      toast.error("Error de conexión")
    }
  }

  const handleDownloadExcel = async () => {
    if (!editId) {
      toast.error("Guarde primero el ensayo")
      return
    }
    setDownloading(true)
    try {
      const res = await authFetch(`${API_URL}/api/compresion/${editId}/excel`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const cd = res.headers.get("Content-Disposition")
        let filename = `Compresion-${editId}.xlsx`
        if (cd) {
          const match = cd.match(/filename="?([^"]+)"?/)
          if (match?.[1]) filename = match[1]
        }
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } else {
        toast.error("Error al descargar")
      }
    } catch {
      toast.error("Error de conexión")
    } finally {
      setDownloading(false)
    }
  }

  const handleReset = () => {
    reset({
      recepcion_numero: "",
      ot_numero: "",
      recepcion_id: null,
      codigo_equipo: "EQP-0023",
      otros: "",
      nota: "",
      items: Array.from({ length: 4 }, (_, i) => createItemTemplate(i + 1)),
    })
    clearSavedData()
    setTraceStatus(null)
  }

  const items = watch("items")

  if (loadingEdit) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b bg-muted/30 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {editId ? "Editar F. Probetas" : "Nuevo F. Probetas"}
          </h2>
          <div className="flex items-center gap-2">
            {editId ? (
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 font-bold text-xs">
                ✎ EDITANDO
              </Badge>
            ) : hasSavedData ? (
              <Badge variant="secondary" className="text-xs">
                Borrador guardado
              </Badge>
            ) : null}
            {traceStatus?.exists && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Traza:</span>
                <div className="flex items-center gap-1">
                  {[
                    { key: "recepcion", label: "REC" },
                    { key: "verificacion", label: "VER" },
                    { key: "compresion", label: "COM" },
                  ].map((stage) => {
                    const status = traceStatus[stage.key]?.status || "pendiente"
                    return (
                      <Badge
                        key={stage.key}
                        variant="outline"
                        className={`text-[9px] font-black uppercase ${
                          status === "completado"
                            ? "border-green-300 text-green-700 bg-green-50"
                            : status === "en_proceso"
                            ? "border-yellow-300 text-yellow-700 bg-yellow-50"
                            : "border-slate-300 text-slate-600 bg-slate-50"
                        }`}
                      >
                        {stage.label}: {status}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search recepcion */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative" ref={searchRef}>
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              N° Recepción
            </Label>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                   onChange={(e) => {
                     setSearchQuery(e.target.value)
                     setValue("recepcion_numero", e.target.value)
                   }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleSearch()
                    }
                  }}
                   onBlur={(e) => {
                     const formatted = formatRecepcionNumber(e.target.value)
                     if (formatted) {
                       setValue("recepcion_numero", formatted)
                       checkTraceStatus(formatted)
                       setSearchQuery(formatted)
                       void handleSearch(formatted)
                     }
                   }}
                  placeholder="Buscar recepción..."
                  className="pl-8"
                  autoComplete="off"
                  data-lpignore="true"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void handleSearch()}
                disabled={searchLoading}
              >
                {searchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-72 overflow-auto">
                {searchResults.map((item: any) => {
                  const recStatus = item.estados?.recepcion || item.recepcion_status || "pendiente"
                  const verStatus = item.estados?.verificacion || item.verificacion_status || "pendiente"
                  const comStatus = item.estados?.compresion || item.compresion_status || "pendiente"
                  const hasExistingCompresion = comStatus === "completado"
                  const faltaRecepcion = recStatus !== "completado"
                  const faltaVerificacion = verStatus !== "completado"

                  return (
                    <button
                      key={item.recepcion_id || item.id || item.numero_recepcion}
                      type="button"
                      className={`w-full text-left px-3 py-2.5 hover:bg-muted text-sm border-b last:border-b-0 ${
                        hasExistingCompresion ? "bg-red-50/50" : ""
                      }`}
                      onClick={() => selectRecepcion(item)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">
                          {item.numero || item.numero_recepcion}
                        </span>
                        {hasExistingCompresion && (
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] font-bold">
                            YA EXISTE FORMATO
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1.5">
                        OT: {item.numero_ot || "-"} | Cliente: {item.cliente || "-"}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            recStatus === "completado"
                              ? "border-green-300 text-green-700 bg-green-50"
                              : recStatus === "en_proceso"
                              ? "border-yellow-300 text-yellow-700 bg-yellow-50"
                              : "border-slate-300 text-slate-600 bg-slate-50"
                          }`}
                        >
                          REC: {recStatus}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            verStatus === "completado"
                              ? "border-green-300 text-green-700 bg-green-50"
                              : verStatus === "en_proceso"
                              ? "border-yellow-300 text-yellow-700 bg-yellow-50"
                              : "border-slate-300 text-slate-600 bg-slate-50"
                          }`}
                        >
                          VER: {verStatus}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            comStatus === "completado"
                              ? "border-green-300 text-green-700 bg-green-50"
                              : comStatus === "en_proceso"
                              ? "border-yellow-300 text-yellow-700 bg-yellow-50"
                              : "border-slate-300 text-slate-600 bg-slate-50"
                          }`}
                        >
                          COM: {comStatus}
                        </Badge>
                      </div>
                      {(faltaRecepcion || faltaVerificacion) && (
                        <div className="mt-1.5 text-[10px] font-semibold text-orange-600">
                          {faltaRecepcion && faltaVerificacion
                            ? "⚠ Falta: Recepción y Verificación"
                            : faltaRecepcion
                            ? "⚠ Falta: Recepción"
                            : "⚠ Falta: Verificación"}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              N° OT
            </Label>
            <Input
              {...register("ot_numero")}
              onBlur={(e) => {
                register("ot_numero").onBlur(e)
                const formatted = formatOtNumber(e.target.value)
                if (formatted) setValue("ot_numero", formatted)
              }}
              placeholder="OT-XXX-26"
              className={`mt-1 ${errors.ot_numero ? "border-destructive" : ""}`}
            />
            {errors.ot_numero && (
              <p className="text-xs text-destructive mt-1">{errors.ot_numero.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Código Equipo
            </Label>
            <select
              {...register("codigo_equipo")}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {EQUIPO_OPTIONS.map((eq) => (
                <option key={eq.codigo} value={eq.codigo}>
                  {eq.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground">Otros</Label>
            <Input {...register("otros")} placeholder="Detalles adicionales" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase text-muted-foreground">Nota</Label>
            <Textarea
              {...register("nota")}
              placeholder="Observaciones..."
              className="mt-1 min-h-[36px]"
              rows={1}
            />
          </div>
        </div>
      </div>

      {/* Traceability Status Card */}
      {traceStatus?.exists && (
        <div className="shrink-0 px-6 py-3 border-b bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                Estado de Módulos
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  {
                    key: "recepcion",
                    label: "Recepción",
                    icon: "R",
                  },
                  {
                    key: "verificacion",
                    label: "Verificación",
                    icon: "V",
                  },
                  {
                    key: "compresion",
                    label: "Compresión",
                    icon: "C",
                  },
                ].map((stage) => {
                  const status = traceStatus[stage.key]?.status || "pendiente"
                  const isComplete = status === "completado"
                  return (
                    <div
                      key={stage.key}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border ${
                        isComplete
                          ? "bg-green-50 text-green-700 border-green-200"
                          : status === "en_proceso"
                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                          : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}
                      title={stage.label}
                    >
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black bg-white border">
                        {isComplete ? "✓" : status === "en_proceso" ? "◐" : "○"}
                      </span>
                      {stage.label}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="text-[10px] font-semibold">
              {traceStatus.compresion?.status === "completado" ? (
                <span className="text-green-600">✓ Informe listo</span>
              ) : (
                <span className="text-orange-600">
                  ℹ{" "}
                  {[
                    traceStatus.recepcion?.status !== "completado" && "Recepción",
                    traceStatus.verificacion?.status !== "completado" && "Verificación",
                    traceStatus.compresion?.status !== "completado" && "Compresión",
                  ]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  pendiente(s)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase text-muted-foreground">
            Resultados de Compresión ({fields.length})
          </h3>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(createItemTemplate(fields.length + 1))}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar fila
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-10">Item</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-32">Cód. LEM</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-36">F. Programado</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-24">Carga (kN)</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-20">Fractura</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-24">Defectos</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-28">Realizado</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-36">F. Ensayo</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-24">Hora</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-28">Revisado</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-36">F. Revisión</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-28">Aprobado</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-left w-36">F. Aprobación</th>
                <th className="px-2 py-2 text-[10px] font-black uppercase text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const item = items[index]
                return (
                  <tr key={field.id} className="border-t hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <Input
                        {...register(`items.${index}.item` as const)}
                        type="number"
                        className="w-10 text-center text-xs p-1 h-8"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        {...register(`items.${index}.codigo_lem` as const)}
                        onFocus={() => handleSourceFieldInteraction("codigo_lem")}
                        onClick={() => handleSourceFieldInteraction("codigo_lem")}
                        onBlur={(e) => {
                          const current = getValues(`items.${index}.codigo_lem`)
                          const formatted = formatLemCode(e.target.value)
                          if (formatted && formatted !== current) {
                            setValue(`items.${index}.codigo_lem`, current || formatted)
                          }
                        }}
                        className="w-32 text-xs p-1 h-8 font-mono"
                        placeholder="XXXX-CO-26"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Controller
                        control={control}
                        name={`items.${index}.fecha_ensayo_programado` as const}
                        render={({ field }) => (
                          <DatePickerSmart
                            value={field.value}
                            onChange={(val) => {
                              field.onChange(val)
                              // Sync linked fecha_ensayo if empty
                              const currentEnsayo = getValues(`items.${index}.fecha_ensayo`)
                              if (!currentEnsayo) {
                                setValue(`items.${index}.fecha_ensayo`, val)
                              }
                            }}
                            className="w-36"
                            onFocus={() => handleSourceFieldInteraction("fecha_ensayo_programado") as unknown as void}
                          />
                        )}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        {...register(`items.${index}.carga_maxima` as const, { valueAsNumber: true })}
                        type="number"
                        step="0.01"
                        className="w-24 text-xs p-1 h-8"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        {...register(`items.${index}.tipo_fractura` as const)}
                        className="w-20 h-8 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value=""></option>
                        {TIPO_FRACTURA_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        {...register(`items.${index}.defectos` as const)}
                        className="w-24 h-8 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value=""></option>
                        {DEFECTOS_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      {item?.defectos === "Otro" && (
                        <Input
                          {...register(`items.${index}.defectos_custom` as const)}
                          className="w-24 text-xs p-1 h-7 mt-1"
                          placeholder="Especifique"
                        />
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <select
                        {...register(`items.${index}.realizado` as const)}
                        className="w-28 h-8 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value=""></option>
                        {REALIZADO_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Controller
                        control={control}
                        name={`items.${index}.fecha_ensayo` as const}
                        render={({ field }) => (
                          <DatePickerSmart
                            value={field.value}
                            onChange={field.onChange}
                            className="w-36"
                          />
                        )}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        {...register(`items.${index}.hora_ensayo` as const)}
                        className="w-24 text-xs p-1 h-8 text-center"
                        placeholder="HH:MM:SS"
                        maxLength={8}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        {...register(`items.${index}.revisado` as const)}
                        onChange={(e) => {
                          const value = e.target.value
                          register(`items.${index}.revisado`).onChange(e)
                          if (value === "Fabian la Rosa") {
                            const current = getValues(`items.${index}.fecha_revisado`)
                            if (!current) {
                              setValue(`items.${index}.fecha_revisado`, getTodayPeruIso())
                            }
                          }
                        }}
                        className="w-28 h-8 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value=""></option>
                        {REVISADO_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Controller
                        control={control}
                        name={`items.${index}.fecha_revisado` as const}
                        render={({ field }) => (
                          <DatePickerSmart
                            value={field.value}
                            onChange={field.onChange}
                            className="w-36"
                          />
                        )}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        {...register(`items.${index}.aprobado` as const)}
                        onChange={(e) => {
                          const value = e.target.value
                          register(`items.${index}.aprobado`).onChange(e)
                          if (value === "Irma Coaquira") {
                            const current = getValues(`items.${index}.fecha_aprobado`)
                            if (!current) {
                              setValue(`items.${index}.fecha_aprobado`, getTodayPeruIso())
                            }
                          }
                        }}
                        className="w-28 h-8 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        <option value=""></option>
                        {APROBADO_OPTIONS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <Controller
                        control={control}
                        name={`items.${index}.fecha_aprobado` as const}
                        render={({ field }) => (
                          <DatePickerSmart
                            value={field.value}
                            onChange={field.onChange}
                            className="w-36"
                          />
                        )}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          const itemCode = getValues(`items.${index}.codigo_lem`) || String(index + 1)
                          setDeleteItemTarget({ index, code: itemCode })
                          setDeleteItemConfirmText("")
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="shrink-0 px-6 py-4 border-t bg-muted/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {hasSavedData && !editId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowClearDraftConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Eliminar borrador
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadExcel}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Excel
            </Button>
          )}
          <Button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} size="sm">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            {editId ? "Actualizar" : "Guardar"}
          </Button>
          {onClose && (
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {/* Clear Draft Confirmation */}
      <AlertDialog open={showClearDraftConfirm} onOpenChange={setShowClearDraftConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar borrador</AlertDialogTitle>
            <AlertDialogDescription>
              Los datos guardados en borrador se perderán permanentemente. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowClearDraftConfirm(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                handleReset()
                setShowClearDraftConfirm(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={sourceLockField !== null} onOpenChange={(open) => {
        if (!open) {
          setSourceLockField(null)
          setSourceLockMessage(null)
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Campo proveniente de Recepción</AlertDialogTitle>
            <AlertDialogDescription>
              {sourceLockMessage || "Este valor no puede modificarse desde Compresión."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setSourceLockField(null)
              setSourceLockMessage(null)
            }}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Item Inline Confirmation */}
      {deleteItemTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border shadow-lg p-6 w-full max-w-sm mx-4 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold mb-2">Eliminar fila</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta acción no se puede deshacer. Para confirmar, escribe el código del item:
            </p>
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 font-mono text-sm font-semibold text-red-700 mb-4">
              {deleteItemTarget.code || `Item ${deleteItemTarget.index + 1}`}
            </div>
            <Input
              value={deleteItemConfirmText}
              onChange={(e) => setDeleteItemConfirmText(e.target.value)}
              placeholder={`Escribe "${deleteItemTarget.code || String(deleteItemTarget.index + 1)}" para confirmar`}
              className="font-mono mb-4"
              autoComplete="off"
              data-lpignore="true"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteItemTarget(null)
                  setDeleteItemConfirmText("")
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  deleteItemConfirmText.trim().toUpperCase() !==
                  (deleteItemTarget.code || String(deleteItemTarget.index + 1)).toUpperCase()
                }
                onClick={() => {
                  remove(deleteItemTarget.index)
                  setDeleteItemTarget(null)
                  setDeleteItemConfirmText("")
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
