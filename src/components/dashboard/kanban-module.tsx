"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User as UserIcon,
  Calendar,
  MoreVertical,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Building,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Paperclip,
  Send,
  X,
  ExternalLink,
  FileText,
  Layers,
  Tag,
  Sparkles,
  Check,
  Activity,
  ChevronRight,
  FlaskConical,
  CheckCheck,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { type User } from "@/hooks/use-auth"
import { authFetch } from "@/lib/api-auth"
import { cn } from "@/lib/utils"

export interface KanbanNote {
  id: string
  author: string
  authorEmail?: string
  authorRole?: string
  avatar?: string
  content: string
  imageUrl?: string
  createdAt: string
}

export interface KanbanCard {
  id: string
  title: string
  description?: string
  proyectoNombre: string
  codigoOt?: string
  columnId: "todo" | "in_progress" | "review" | "done"
  assignedTo: string
  assignedAvatar?: string
  priority: "baja" | "media" | "alta" | "urgente"
  dueDate?: string
  imageUrl?: string
  notes?: KanbanNote[]
  tracingSummary?: {
    numero_recepcion?: string
    cliente?: string
    fecha_recepcion?: string
    tipo_recepcion?: string
    totalMuestras?: number
  }
  createdBy?: string
  createdAt?: string
  updatedAt?: string
}

interface KanbanModuleProps {
  user: User
  onOpenChatWithCard?: (card: KanbanCard) => void
}

const INITIAL_CARDS: KanbanCard[] = [
  {
    id: "k-1",
    title: "Ensayo de Proctor Modificado — Muestra 4182",
    description: "Realizar compactación y cálculo de humedad óptima para proyecto Minera Antamina.",
    proyectoNombre: "Minera Antamina — Tramo 2",
    codigoOt: "REC-2026-0814",
    columnId: "in_progress",
    assignedTo: "Ana López",
    priority: "alta",
    dueDate: "2026-08-18",
    notes: [
      {
        id: "n-1",
        author: "Ana López",
        authorRole: "Laboratorista",
        content: "Muestra secada al horno. Procediendo a tamizado y moldeado de 5 puntos.",
        createdAt: "2026-08-14 09:30 AM",
      },
    ],
  },
  {
    id: "k-2",
    title: "CBR en Laboratorio Huanta",
    description: "Medir penetración a 0.1 y 0.2 pulgadas en moldes de suelo granular.",
    proyectoNombre: "Carretera Huanta — Ayacucho",
    codigoOt: "REC-2026-0815",
    columnId: "todo",
    assignedTo: "Carlos Ruiz",
    priority: "urgente",
    dueDate: "2026-08-16",
    notes: [],
  },
  {
    id: "k-3",
    title: "Revisión de Informe de Compresión No Confinada",
    description: "Verificar curva esfuerzo-deformación y firma de Jefe de Laboratorio.",
    proyectoNombre: "Edificio Multifamiliar Huancayo",
    codigoOt: "REC-2026-0810",
    columnId: "review",
    assignedTo: "Ing. Mendoza",
    priority: "media",
    dueDate: "2026-08-15",
    notes: [
      {
        id: "n-2",
        author: "Ing. Mendoza",
        authorRole: "Jefe de Laboratorio",
        content: "Revisando consistencia de datos y módulo de elasticidad.",
        createdAt: "2026-08-14 10:15 AM",
      },
    ],
  },
  {
    id: "k-4",
    title: "Control Ambiental de Cámaras Húmedas",
    description: "Registro de lecturas de temperatura y humedad en el formato ISO 17025.",
    proyectoNombre: "Mantenimiento Interno",
    columnId: "done",
    assignedTo: "David Miller",
    priority: "baja",
    dueDate: "2026-08-14",
    notes: [],
  },
]

const STORAGE_KEY = "geofal_kanban_cards_v2"
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function KanbanModule({ user, onOpenChatWithCard }: KanbanModuleProps) {
  const [cards, setCards] = useState<KanbanCard[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
      } catch {
        // ignore
      }
    }
    return INITIAL_CARDS
  })

  const [isLoadingBackend, setIsLoadingBackend] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<string>("todas")
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // ── ESTADO PARA MODAL DE DETALLE & TRAZABILIDAD (5 ETAPAS) ──
  const [activeTracingCard, setActiveTracingCard] = useState<KanbanCard | null>(null)
  const [tracingStages, setTracingStages] = useState<any[]>([])
  const [loadingTracing, setLoadingTracing] = useState(false)

  // ── ESTADO PARA MODAL DE NOTAS TIPO CHAT ──
  const [activeNotesCard, setActiveNotesCard] = useState<KanbanCard | null>(null)
  const [newNoteContent, setNewNoteContent] = useState("")
  const [newNoteImageUrl, setNewNoteImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // ── FORM NUEVA TARJETA MANUAL / RECEPCIÓN ──
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newProyecto, setNewProyecto] = useState("")
  const [newOt, setNewOt] = useState("")
  const [newDueDate, setNewDueDate] = useState("")
  const [newPriority, setNewPriority] = useState<KanbanCard["priority"]>("media")
  const [newAssigned, setNewAssigned] = useState(user.name || "Usuario CRM")
  const [newCardImageUrl, setNewCardImageUrl] = useState<string | null>(null)
  const cardImageInputRef = useRef<HTMLInputElement | null>(null)

  // ── BUSCADOR INTELIGENTE POR RECEPCIÓN ──
  const [recepcionSearchQuery, setRecepcionSearchQuery] = useState("")
  const [isSearchingRecepciones, setIsSearchingRecepciones] = useState(false)
  const [recepcionesResults, setRecepcionesResults] = useState<any[]>([])
  const [selectedRecepcion, setSelectedRecepcion] = useState<any | null>(null)

  // Cargar tarjetas desde Backend FastAPI
  const loadCardsFromBackend = useCallback(async () => {
    setIsLoadingBackend(true)
    try {
      const res = await authFetch(`${API_URL}/api/kanban/cards`)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setCards(data)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
          return
        }
      }
    } catch {
      // Fallback a localStorage
    } finally {
      setIsLoadingBackend(false)
    }
  }, [])

  useEffect(() => {
    loadCardsFromBackend()
  }, [loadCardsFromBackend])

  // Persistir tarjetas (optimista local + sync backend)
  const saveCards = (newCards: KanbanCard[]) => {
    setCards(newCards)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCards))
    } catch {
      // ignore
    }
  }

  // Buscar recepciones con debounce
  useEffect(() => {
    if (!recepcionSearchQuery.trim() || recepcionSearchQuery.length < 2) {
      setRecepcionesResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingRecepciones(true)
      try {
        const response = await authFetch(
          `/api/recepcion/paginated?page=1&page_size=8&q=${encodeURIComponent(recepcionSearchQuery)}`
        )
        if (response.ok) {
          const data = await response.json()
          const list = data?.data || data?.recepciones || []
          setRecepcionesResults(Array.isArray(list) ? list : [])
        } else {
          setRecepcionesResults([])
        }
      } catch {
        setRecepcionesResults([])
      } finally {
        setIsSearchingRecepciones(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [recepcionSearchQuery])

  // Manejar selección de una recepción encontrada
  const handleSelectRecepcion = (rec: any) => {
    setSelectedRecepcion(rec)
    const numeroRec = rec.numero_recepcion || rec.numero_ot || ""
    const clienteName = rec.cliente || "Cliente"
    const proyectoName = rec.proyecto || clienteName || "Proyecto Geofal"
    const totalMuestras = Array.isArray(rec.muestras) ? rec.muestras.length : rec.muestras_count || 1

    setNewTitle(`Seguimiento Recepción ${numeroRec} — ${clienteName}`)
    setNewProyecto(proyectoName)
    setNewOt(numeroRec)
    setNewDueDate(rec.fecha_estimada_culminacion || rec.fecha_recepcion || "")
    setNewDesc(
      `Recepción de ${totalMuestras} muestra(s). Solicitante: ${rec.solicitante || clienteName}. Tipo: ${rec.tipo_recepcion || "General"}.`
    )
    toast.success(`Datos de ${numeroRec} vinculados exitosamente`)
  }

  const columns: { id: KanbanCard["columnId"]; label: string; color: string }[] = [
    { id: "todo", label: "POR HACER (TO DO)", color: "border-slate-500/50 bg-slate-500/5" },
    { id: "in_progress", label: "EN PROGRESO (IN PROGRESS)", color: "border-blue-500/50 bg-blue-500/5" },
    { id: "review", label: "EN REVISIÓN (REVIEW)", color: "border-amber-500/50 bg-amber-500/5" },
    { id: "done", label: "HECHO (DONE)", color: "border-emerald-500/50 bg-emerald-500/5" },
  ]

  // Mover tarjeta de columna de forma silenciosa
  const moveCard = async (cardId: string, nextColumnId: KanbanCard["columnId"]) => {
    const updated = cards.map((c) => (c.id === cardId ? { ...c, columnId: nextColumnId } : c))
    saveCards(updated)

    try {
      await authFetch(`${API_URL}/api/kanban/cards/${cardId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: nextColumnId }),
      })
    } catch {
      // Backend sync fallback
    }
  }

  // Eliminar tarjeta
  const deleteCard = async (cardId: string) => {
    const updated = cards.filter((c) => c.id !== cardId)
    saveCards(updated)
    if (activeNotesCard?.id === cardId) setActiveNotesCard(null)
    if (activeTracingCard?.id === cardId) setActiveTracingCard(null)

    try {
      await authFetch(`${API_URL}/api/kanban/cards/${cardId}`, { method: "DELETE" })
    } catch {
      // Backend sync fallback
    }
  }

  // Abrir modal de Detalle y Trazabilidad (5 Etapas)
  const handleOpenTracingDetail = async (card: KanbanCard) => {
    setActiveTracingCard(card)
    setTracingStages([])
    setLoadingTracing(true)

    const codigo = card.codigoOt || card.tracingSummary?.numero_recepcion
    if (!codigo) {
      setLoadingTracing(false)
      return
    }

    try {
      const res = await authFetch(`${API_URL}/api/tracing/flujo/${encodeURIComponent(codigo)}?_ts=${Date.now()}`)
      if (res.ok) {
        const payload = await res.json()
        if (payload?.stages && Array.isArray(payload.stages)) {
          setTracingStages(payload.stages)
        }
      }
    } catch {
      // Mock fallback basado en estado
    } finally {
      setLoadingTracing(false)
    }
  }

  // Subir imagen en notas
  const handleNoteImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 3 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 3MB")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setNewNoteImageUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Subir imagen de portada en tarjeta
  const handleCardImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 3 * 1024 * 1024) {
      toast.error("La imagen debe ser menor a 3MB")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setNewCardImageUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Agregar nota tipo chat
  const handleAddNote = async () => {
    if (!activeNotesCard) return
    if (!newNoteContent.trim() && !newNoteImageUrl) {
      toast.error("Escribe un mensaje o adjunta una imagen")
      return
    }

    const now = new Date()
    const formattedDate = now.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

    const notePayload = {
      author: user.name || "Usuario CRM",
      authorEmail: user.email,
      authorRole: user.roleLabel || user.role || "Operador",
      avatar: user.avatar,
      content: newNoteContent.trim(),
      imageUrl: newNoteImageUrl || undefined,
    }

    const newNote: KanbanNote = {
      id: `note-${Date.now()}`,
      ...notePayload,
      createdAt: formattedDate,
    }

    const updatedCard: KanbanCard = {
      ...activeNotesCard,
      notes: [...(activeNotesCard.notes || []), newNote],
    }

    const updatedCards = cards.map((c) => (c.id === activeNotesCard.id ? updatedCard : c))
    saveCards(updatedCards)
    setActiveNotesCard(updatedCard)
    setNewNoteContent("")
    setNewNoteImageUrl(null)

    try {
      await authFetch(`${API_URL}/api/kanban/cards/${activeNotesCard.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notePayload),
      })
    } catch {
      // Backend sync fallback
    }
  }

  const handleCreateCard = async () => {
    if (!newTitle.trim()) {
      toast.error("Ingresa un título para la tarea")
      return
    }

    const newCard: KanbanCard = {
      id: `k-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      proyectoNombre: newProyecto.trim() || "Proyecto General",
      codigoOt: newOt.trim() || undefined,
      columnId: "todo",
      assignedTo: newAssigned,
      priority: newPriority,
      dueDate: newDueDate || undefined,
      imageUrl: newCardImageUrl || undefined,
      notes: [],
      tracingSummary: selectedRecepcion
        ? {
            numero_recepcion: selectedRecepcion.numero_recepcion || selectedRecepcion.numero_ot,
            cliente: selectedRecepcion.cliente,
            fecha_recepcion: selectedRecepcion.fecha_recepcion,
            tipo_recepcion: selectedRecepcion.tipo_recepcion,
            totalMuestras: Array.isArray(selectedRecepcion.muestras) ? selectedRecepcion.muestras.length : 1,
          }
        : undefined,
    }

    saveCards([newCard, ...cards])
    setIsCreateOpen(false)

    // Reset form
    setNewTitle("")
    setNewDesc("")
    setNewProyecto("")
    setNewOt("")
    setNewDueDate("")
    setNewCardImageUrl(null)
    setSelectedRecepcion(null)
    setRecepcionSearchQuery("")
    setRecepcionesResults([])

    try {
      await authFetch(`${API_URL}/api/kanban/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCard),
      })
    } catch {
      // Backend sync fallback
    }
  }

  const filteredCards = cards.filter((c) => {
    const matchesSearch =
      searchQuery === "" ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.proyectoNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.codigoOt && c.codigoOt.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesPriority = priorityFilter === "todas" || c.priority === priorityFilter
    return matchesSearch && matchesPriority
  })

  const getPriorityBadge = (p: KanbanCard["priority"]) => {
    switch (p) {
      case "urgente":
        return <Badge variant="destructive" className="text-[10px] uppercase">Urgente</Badge>
      case "alta":
        return <Badge className="bg-amber-500 text-white text-[10px] uppercase">Alta</Badge>
      case "media":
        return <Badge variant="outline" className="text-blue-500 border-blue-500 text-[10px] uppercase">Media</Badge>
      default:
        return <Badge variant="secondary" className="text-[10px] uppercase">Baja</Badge>
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] w-full p-4 space-y-4 bg-background">
      {/* ── ENCABEZADO Y FILTROS ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <FolderKanban className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
              <span>Tableros Kanban de Trabajo</span>
              {isLoadingBackend && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </h1>
            <p className="text-xs text-muted-foreground">
              Seguimiento operativo por proyectos, recepciones y programación de ensayos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por OT, proyecto, tarea..."
              className="pl-8 h-9 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 h-9 text-xs">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Media</SelectItem>
              <SelectItem value="baja">Baja</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="h-9 text-xs gap-1.5 shadow-xs cursor-pointer" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* ── TABLERO DE COLUMNAS KANBAN (ClickUp / Linear Style) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-x-auto min-h-0">
        {columns.map((col) => {
          const columnCards = filteredCards.filter((c) => c.columnId === col.id)
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const cardId = e.dataTransfer.getData("cardId")
                if (cardId) {
                  moveCard(cardId, col.id)
                }
              }}
              className={`flex flex-col rounded-xl border p-3 bg-card/40 ${col.color} transition-all duration-150 min-h-0 hover:border-primary/40`}
            >
              {/* Encabezado de Columna */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <h3 className="font-bold text-xs tracking-wide uppercase text-foreground">{col.label}</h3>
                <Badge variant="outline" className="text-xs font-bold">
                  {columnCards.length}
                </Badge>
              </div>

              {/* Lista de Tarjetas */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {columnCards.map((card) => {
                  const noteCount = card.notes?.length || 0
                  return (
                    <Card
                      key={card.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("cardId", card.id)
                      }}
                      className="border border-border/80 shadow-xs hover:shadow-md transition-all duration-200 group bg-card cursor-grab active:cursor-grabbing overflow-hidden"
                    >
                      {/* Imagen de portada opcional */}
                      {card.imageUrl && (
                        <div className="w-full h-28 overflow-hidden border-b border-border/60 bg-muted/30">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={card.imageUrl}
                            alt={card.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}

                      <CardHeader className="p-3 pb-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 truncate max-w-[140px]">
                            <Building className="h-3 w-3 mr-1" />
                            {card.proyectoNombre}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            {getPriorityBadge(card.priority)}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteCard(card.id)
                              }}
                              className="text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                              title="Eliminar tarjeta"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <CardTitle className="text-xs font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                          {card.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="p-3 pt-1 text-xs space-y-3">
                        {card.description && (
                          <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                            {card.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          {card.codigoOt && (
                            <div className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold inline-block">
                              {card.codigoOt}
                            </div>
                          )}
                          {card.dueDate && (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md">
                              <Calendar className="h-2.5 w-2.5" />
                              {card.dueDate}
                            </div>
                          )}
                        </div>

                        {/* Footer de Tarjeta con Usuario Real, Botón Detalle Trazabilidad y Botón de Notas */}
                        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5" title={`Asignado a ${card.assignedTo}`}>
                            <Avatar className="h-5 w-5 border border-border">
                              {card.assignedAvatar && <AvatarImage src={card.assignedAvatar} />}
                              <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">
                                {card.assignedTo.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[80px] font-medium">{card.assignedTo}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Botón de Detalle y Trazabilidad (Icono Capas/Trazabilidad solicitado por usuario) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenTracingDetail(card)
                              }}
                              className="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground/70 hover:text-primary hover:bg-primary/10 border border-border/80 transition-all cursor-pointer shadow-2xs"
                              title="Ver detalle completo y trazabilidad de 5 etapas (Recepción ➡️ Informe)"
                            >
                              <Layers className="h-3.5 w-3.5" />
                            </button>

                            {/* Botón de Notas / Chat Interno */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveNotesCard(card)
                              }}
                              className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold transition-all cursor-pointer",
                                noteCount > 0
                                  ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800"
                                  : "text-muted-foreground/60 hover:text-primary hover:bg-primary/5 border border-border/70"
                              )}
                              title="Abrir bitácora y notas tipo chat de la tarea"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span className="text-[10px]">{noteCount}</span>
                            </button>

                            {/* Control de mover columna */}
                            <div className="flex items-center gap-0.5">
                              {col.id !== "todo" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    moveCard(
                                      card.id,
                                      col.id === "done"
                                        ? "review"
                                        : col.id === "review"
                                        ? "in_progress"
                                        : "todo"
                                    )
                                  }}
                                  className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  title="Mover a columna anterior"
                                >
                                  <ArrowLeft className="h-3 w-3" />
                                </button>
                              )}

                              {col.id !== "done" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    moveCard(
                                      card.id,
                                      col.id === "todo"
                                        ? "in_progress"
                                        : col.id === "in_progress"
                                        ? "review"
                                        : "done"
                                    )
                                  }}
                                  className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                  title="Mover a siguiente columna"
                                >
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: DETALLE COMPLETO Y TRAZABILIDAD (5 ETAPAS DEL CRM)       ── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!activeTracingCard} onOpenChange={(open) => !open && setActiveTracingCard(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold truncate">
                  {activeTracingCard?.title}
                </DialogTitle>
                <DialogDescription className="text-xs flex items-center gap-2 mt-0.5">
                  <span className="font-semibold text-foreground">{activeTracingCard?.proyectoNombre}</span>
                  {activeTracingCard?.codigoOt && (
                    <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30">
                      {activeTracingCard.codigoOt}
                    </Badge>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tarjeta de Resumen Rápido */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-muted/40 p-3 rounded-xl border border-border text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Estado Actual</span>
                <span className="font-semibold text-primary capitalize">{activeTracingCard?.columnId.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Prioridad</span>
                <span className="font-semibold uppercase">{activeTracingCard?.priority}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Responsable</span>
                <span className="font-semibold truncate block">{activeTracingCard?.assignedTo}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Fecha Entrega</span>
                <span className="font-semibold">{activeTracingCard?.dueDate || "Sin fecha"}</span>
              </div>
            </div>

            {/* Ciclo de Vida y Trazabilidad en Tiempo Real (5 Etapas) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" />
                <span>Flujo de Trazabilidad del Laboratorio</span>
              </h4>

              {loadingTracing ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span>Consultando trazabilidad en tiempo real...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Etapas Estándar del Ciclo de Vida de Geofal */}
                  {[
                    {
                      key: "recepcion",
                      title: "1. Recepción de Muestras",
                      desc: "Ingreso al laboratorio, datos del cliente y muestras registradas.",
                      icon: Building,
                      status: activeTracingCard?.codigoOt ? "completado" : "pendiente",
                    },
                    {
                      key: "verificacion",
                      title: "2. Verificación de Muestras",
                      desc: "Control geométrico, perpendicularidad y validación de dimensiones.",
                      icon: CheckCheck,
                      status: activeTracingCard?.columnId !== "todo" ? "completado" : "en_proceso",
                    },
                    {
                      key: "ensayo",
                      title: "3. Ensayo de Laboratorio / Rotura",
                      desc: "Ejecución del ensayo (Compresión, CBR, Proctor, Granulometría, etc.).",
                      icon: FlaskConical,
                      status:
                        activeTracingCard?.columnId === "review" || activeTracingCard?.columnId === "done"
                          ? "completado"
                          : activeTracingCard?.columnId === "in_progress"
                          ? "en_proceso"
                          : "pendiente",
                    },
                    {
                      key: "seguimiento",
                      title: "4. Seguimiento & Revisión Técnica",
                      desc: "Verificación de cálculos, curva de ensayo y visto bueno del Jefe de Laboratorio.",
                      icon: FileSpreadsheet,
                      status:
                        activeTracingCard?.columnId === "done"
                          ? "completado"
                          : activeTracingCard?.columnId === "review"
                          ? "en_proceso"
                          : "pendiente",
                    },
                    {
                      key: "informe",
                      title: "5. Control de Informes (Listo / Enviado)",
                      desc: "Emisión de informe final numerado y despacho formal al cliente.",
                      icon: FileText,
                      status: activeTracingCard?.columnId === "done" ? "completado" : "pendiente",
                    },
                  ].map((stage, idx) => {
                    const isCompleted = stage.status === "completado"
                    const isInProgress = stage.status === "en_proceso"

                    return (
                      <div
                        key={stage.key}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-xl border transition-all text-xs",
                          isCompleted
                            ? "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/20"
                            : isInProgress
                            ? "bg-blue-500/5 border-blue-500/40 dark:bg-blue-950/20 shadow-2xs"
                            : "bg-card border-border/70 opacity-70"
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5",
                            isCompleted
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : isInProgress
                              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          <stage.icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground text-xs">{stage.title}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] uppercase px-1.5 py-0 font-bold",
                                isCompleted
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                  : isInProgress
                                  ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                  : "text-muted-foreground"
                              )}
                            >
                              {isCompleted ? "Completado" : isInProgress ? "En Proceso" : "Pendiente"}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                            {stage.desc}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setActiveTracingCard(null)}>
              Cerrar Detalle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: BITÁCORA Y NOTAS TIPO CHAT DE LA TAREA                   ── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!activeNotesCard} onOpenChange={(open) => !open && setActiveNotesCard(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-3 border-b border-border bg-card/80">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold truncate max-w-md">
                    {activeNotesCard?.title}
                  </DialogTitle>
                  <DialogDescription className="text-xs flex items-center gap-2">
                    <span>{activeNotesCard?.proyectoNombre}</span>
                    {activeNotesCard?.codigoOt && (
                      <span className="font-mono text-[11px] font-semibold text-primary">
                        • {activeNotesCard.codigoOt}
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Historial de Notas tipo Chat */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-60 max-h-[45vh] bg-muted/20">
            {!activeNotesCard?.notes || activeNotesCard.notes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground space-y-2">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs font-medium">No hay notas registradas para esta tarea</p>
                <p className="text-[11px] text-muted-foreground/70 max-w-xs">
                  Escribe comentarios, pendientes, observaciones de muestras o sube fotos para el equipo.
                </p>
              </div>
            ) : (
              activeNotesCard.notes.map((note) => {
                const isCurrentUser = note.authorEmail === user.email || note.author === user.name
                return (
                  <div
                    key={note.id}
                    className={cn(
                      "flex gap-2.5 max-w-[90%] rounded-xl p-3 shadow-2xs border text-xs",
                      isCurrentUser
                        ? "ml-auto bg-primary/5 border-primary/20 text-foreground"
                        : "mr-auto bg-card border-border text-foreground"
                    )}
                  >
                    <Avatar className="h-6 w-6 shrink-0 mt-0.5 border border-border">
                      {note.avatar && <AvatarImage src={note.avatar} />}
                      <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">
                        {note.author.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground text-[11px]">{note.author}</span>
                          {note.authorRole && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                              {note.authorRole}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{note.createdAt}</span>
                      </div>

                      {note.content && (
                        <p className="text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      )}

                      {note.imageUrl && (
                        <div className="pt-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={note.imageUrl}
                            alt="Adjunto de nota"
                            className="max-h-48 rounded-lg border border-border object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onClick={() => window.open(note.imageUrl, "_blank")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Vista previa de imagen a adjuntar */}
          {newNoteImageUrl && (
            <div className="px-4 py-2 bg-muted/40 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={newNoteImageUrl} alt="Preview" className="h-10 w-10 object-cover rounded-md border border-border" />
                <span className="text-xs text-muted-foreground">Imagen adjunta lista para enviar</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => setNewNoteImageUrl(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Editor de Nueva Nota */}
          <div className="p-3 border-t border-border bg-card flex flex-col gap-2">
            <Textarea
              placeholder={`Escribir nota o indicación como ${user.name || "Usuario"}...`}
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              className="text-xs min-h-[60px] resize-none focus-visible:ring-primary/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleAddNote()
                }
              }}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleNoteImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  <span>Adjuntar Foto</span>
                </Button>
              </div>

              <Button size="sm" className="h-8 text-xs gap-1.5 shadow-xs cursor-pointer" onClick={handleAddNote}>
                <Send className="h-3.5 w-3.5" />
                <span>Publicar Nota</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* ── MODAL: NUEVA TAREA CON BUSCADOR INTELIGENTE POR RECEPCIÓN       ── */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              Nueva Tarea en Tablero Kanban
            </DialogTitle>
            <DialogDescription>
              Crea una tarea manual o vincula automáticamente una Recepción / OT del laboratorio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ── BUSCADOR INTELIGENTE POR RECEPCIÓN / OT ── */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Buscador Inteligente de Recepciones / Trazabilidad
                </Label>
                {selectedRecepcion && (
                  <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">
                    <Check className="h-3 w-3 mr-1" />
                    Vinculado
                  </Badge>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Escribe número de recepción (ej. REC-1111), cliente o proyecto..."
                  value={recepcionSearchQuery}
                  onChange={(e) => setRecepcionSearchQuery(e.target.value)}
                  className="pl-8 text-xs bg-background"
                />
                {isSearchingRecepciones && (
                  <RefreshCw className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Lista desplegable de sugerencias de recepción */}
              {recepcionesResults.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-sm">
                  {recepcionesResults.map((rec) => (
                    <button
                      key={rec.id || rec.numero_recepcion}
                      type="button"
                      onClick={() => handleSelectRecepcion(rec)}
                      className="w-full text-left p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-bold font-mono text-primary truncate">
                          {rec.numero_recepcion || rec.numero_ot}
                        </div>
                        <div className="text-[11px] text-foreground truncate font-medium">
                          {rec.cliente || "Cliente"}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {rec.proyecto || "Sin proyecto"}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] shrink-0">
                        {rec.tipo_recepcion || "Muestras"}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Campos de la tarea */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título de la Tarea / Ensayo</Label>
              <Input
                placeholder="ej. Ensayo de CBR o Rotura de Probetas"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Proyecto / Cliente</Label>
                <Input
                  placeholder="ej. Minera Chinalco"
                  value={newProyecto}
                  onChange={(e) => setNewProyecto(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nº OT / Recepción</Label>
                <Input
                  placeholder="ej. REC-2026-0816"
                  value={newOt}
                  onChange={(e) => setNewOt(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descripción u Observaciones del Ensayo</Label>
              <Textarea
                placeholder="Detalles sobre las muestras, observaciones iniciales o indicaciones..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="text-xs h-20 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Prioridad</Label>
                <Select value={newPriority} onValueChange={(v: any) => setNewPriority(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baja">Baja</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Asignar A (Responsable)</Label>
                <Input
                  placeholder="Nombre de responsable"
                  value={newAssigned}
                  onChange={(e) => setNewAssigned(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Fecha Límite / Entrega</Label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Imagen opcional para la tarjeta */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-semibold">Foto de Portada / Muestra (Opcional)</Label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={cardImageInputRef}
                  onChange={handleCardImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 cursor-pointer"
                  onClick={() => cardImageInputRef.current?.click()}
                >
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  <span>Subir Foto de Muestra</span>
                </Button>
                {newCardImageUrl && (
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newCardImageUrl} alt="Card Preview" className="h-8 w-8 object-cover rounded-md border border-border" />
                    <button
                      type="button"
                      onClick={() => setNewCardImageUrl(null)}
                      className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateCard}>
              Crear Tarea en Kanban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
