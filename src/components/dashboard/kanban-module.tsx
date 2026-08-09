"use client"

import React, { useState } from "react"
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
  commentCount?: number
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
    codigoOt: "OT-2026-0814",
    columnId: "in_progress",
    assignedTo: "Ana López",
    priority: "alta",
    dueDate: "2026-08-10",
    commentCount: 3,
  },
  {
    id: "k-2",
    title: "CBR en Laboratorio Huanta",
    description: "Medir penetración a 0.1 y 0.2 pulgadas en moldes de suelo granular.",
    proyectoNombre: "Carretera Huanta — Ayacucho",
    codigoOt: "OT-2026-0815",
    columnId: "todo",
    assignedTo: "Carlos Ruiz",
    priority: "urgente",
    dueDate: "2026-08-11",
    commentCount: 1,
  },
  {
    id: "k-3",
    title: "Revisión de Informe de Compresión No Confinada",
    description: "Verificar curva esfuerzo-deformación y firma de Jefe de Laboratorio.",
    proyectoNombre: "Edificio Multifamiliar Huancayo",
    codigoOt: "OT-2026-0810",
    columnId: "review",
    assignedTo: "Ing. Mendoza",
    priority: "media",
    dueDate: "2026-08-09",
    commentCount: 5,
  },
  {
    id: "k-4",
    title: "Control Ambiental de Cámaras Húmedas",
    description: "Registro de lecturas de temperatura y humedad en el formato ISO 17025.",
    proyectoNombre: "Mantenimiento Interno",
    columnId: "done",
    assignedTo: "David Miller",
    priority: "baja",
    dueDate: "2026-08-08",
    commentCount: 0,
  },
]

export function KanbanModule({ user, onOpenChatWithCard }: KanbanModuleProps) {
  const [cards, setCards] = useState<KanbanCard[]>(INITIAL_CARDS)
  const [searchQuery, setSearchQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<string>("todas")
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // Form nueva tarjeta manual
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newProyecto, setNewProyecto] = useState("")
  const [newPriority, setNewPriority] = useState<KanbanCard["priority"]>("media")
  const [newAssigned, setNewAssigned] = useState(user.name || "Usuario CRM")

  const columns: { id: KanbanCard["columnId"]; label: string; color: string }[] = [
    { id: "todo", label: "POR HACER (TO DO)", color: "border-slate-500/50 bg-slate-500/5" },
    { id: "in_progress", label: "EN PROGRESO (IN PROGRESS)", color: "border-blue-500/50 bg-blue-500/5" },
    { id: "review", label: "EN REVISIÓN (REVIEW)", color: "border-amber-500/50 bg-amber-500/5" },
    { id: "done", label: "HECHO (DONE)", color: "border-emerald-500/50 bg-emerald-500/5" },
  ]

  const moveCard = (cardId: string, nextColumnId: KanbanCard["columnId"]) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, columnId: nextColumnId } : c))
    )
    toast.success("Tarjeta movida de estado", { description: `Estado actualizado` })
  }

  const handleCreateCard = () => {
    if (!newTitle.trim()) {
      toast.error("Ingresa un título para la tarjeta")
      return
    }

    const newCard: KanbanCard = {
      id: `k-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      proyectoNombre: newProyecto.trim() || "Proyecto General",
      columnId: "todo",
      assignedTo: newAssigned,
      priority: newPriority,
      commentCount: 0,
    }

    setCards((prev) => [newCard, ...prev])
    setIsCreateOpen(false)
    setNewTitle("")
    setNewDesc("")
    setNewProyecto("")
    toast.success("Tarjeta creada en Kanban", { description: newCard.title })
  }

  const filteredCards = cards.filter((c) => {
    const matchesSearch =
      searchQuery === "" ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.proyectoNombre.toLowerCase().includes(searchQuery.toLowerCase())
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
            <h1 className="font-bold text-lg leading-tight">Tableros Kanban de Trabajo</h1>
            <p className="text-xs text-muted-foreground">
              Seguimiento de avance por proyectos selecciones y programación lab
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proyecto o tarea..."
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

          <Button size="sm" className="h-9 text-xs gap-1.5" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva Tarea
          </Button>
        </div>
      </div>

      {/* ── TABLERO DE COLUMNAS KANBAN (ClickUp/Monday Style) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-x-auto min-h-0">
        {columns.map((col) => {
          const columnCards = filteredCards.filter((c) => c.columnId === col.id)
          return (
            <div key={col.id} className={`flex flex-col rounded-xl border p-3 bg-card/40 ${col.color} min-h-0`}>
              {/* Encabezado de Columna */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
                <h3 className="font-bold text-xs tracking-wide uppercase text-foreground">{col.label}</h3>
                <Badge variant="outline" className="text-xs font-bold">
                  {columnCards.length}
                </Badge>
              </div>

              {/* Lista de Tarjetas */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {columnCards.map((card) => (
                  <Card
                    key={card.id}
                    className="border border-border/80 shadow-xs hover:shadow-md transition-all duration-200 group bg-card"
                  >
                    <CardHeader className="p-3 pb-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/30 truncate max-w-[140px]">
                          <Building className="h-3 w-3 mr-1" />
                          {card.proyectoNombre}
                        </Badge>
                        {getPriorityBadge(card.priority)}
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

                      {card.codigoOt && (
                        <div className="text-[10px] font-mono bg-muted/60 px-2 py-0.5 rounded-md inline-block">
                          LEM: {card.codigoOt}
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5 border border-border">
                            <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">
                              {card.assignedTo.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[90px]">{card.assignedTo}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {onOpenChatWithCard && (
                            <button
                              onClick={() => onOpenChatWithCard(card)}
                              className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                              title="Discutir en el chat"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-bold">{card.commentCount || 0}</span>
                            </button>
                          )}

                          {/* Control de mover columna */}
                          <div className="flex items-center gap-1">
                            {col.id !== "todo" && (
                              <button
                                onClick={() =>
                                  moveCard(
                                    card.id,
                                    col.id === "done"
                                      ? "review"
                                      : col.id === "review"
                                      ? "in_progress"
                                      : "todo"
                                  )
                                }
                                className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                title="Mover a columna anterior"
                              >
                                <ArrowLeft className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {col.id !== "done" && (
                              <button
                                onClick={() =>
                                  moveCard(
                                    card.id,
                                    col.id === "todo"
                                      ? "in_progress"
                                      : col.id === "in_progress"
                                      ? "review"
                                      : "done"
                                  )
                                }
                                className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                title="Mover a siguiente columna"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── MODAL: Nueva Tarea Manual ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              Nueva Tarea en Kanban
            </DialogTitle>
            <DialogDescription>
              Crea una tarjeta manual para el equipo de trabajo asignado a un proyecto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Título de la Tarea</Label>
              <Input
                placeholder="ej. Ensayo de Lavado Malla 200"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="text-xs"
              />
            </div>

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
              <Label className="text-xs font-semibold">Descripción u Observaciones</Label>
              <Textarea
                placeholder="Detalles sobre las muestras o fechas de entrega..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="text-xs h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <Label className="text-xs font-semibold">Asignar A</Label>
                <Input
                  placeholder="Nombre de responsable"
                  value={newAssigned}
                  onChange={(e) => setNewAssigned(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateCard}>
              Crear Tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
