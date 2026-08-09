"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  MessageSquare,
  Hash,
  Lock,
  Plus,
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Search,
  Users,
  MoreVertical,
  ChevronRight,
  X,
  FileText,
  Download,
  Shield,
  CheckCircle2,
  Phone,
  Video,
  Info,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { type User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"

interface ChatMessage {
  id: string
  channelId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  attachments?: Array<{ url: string; type: "image" | "file"; name: string; size?: string }>
  createdAt: string
  parent_id?: string
}

interface ChatChannel {
  id: string
  name: string
  description?: string
  isPrivate: boolean
  category: "general" | "area" | "proyecto" | "dm"
  unreadCount?: number
}

interface TeamUser {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  status: "online" | "offline"
}

interface ComunicacionesModuleProps {
  user: User
  initialChannelId?: string
}

const DEFAULT_CHANNELS: ChatChannel[] = [
  { id: "general", name: "general", description: "Comunicados e información de empresa", isPrivate: false, category: "general" },
  { id: "ventas", name: "comercial-ventas", description: "Coordinación de cotizaciones y clientes", isPrivate: false, category: "area" },
  { id: "laboratorio", name: "laboratorio-ensayos", description: "Ensayos de campo, muestras y probetas", isPrivate: false, category: "area" },
  { id: "informes", name: "informes-revision", description: "Revisión y emisión de informes LEM", isPrivate: false, category: "area" },
  { id: "alertas", name: "alertas-gerencia", description: "Notificaciones y clientes prioritarios", isPrivate: true, category: "area" },
]

const DEFAULT_TEAM_USERS: TeamUser[] = [
  { id: "u-1", name: "Dra. Ana López (Laboratorio)", email: "ana.lopez@geofal.com.pe", role: "jefe_laboratorio", status: "online" },
  { id: "u-2", name: "Ing. Carlos Mendoza (Gerencia)", email: "carlos.mendoza@geofal.com.pe", role: "gerencia", status: "online" },
  { id: "u-3", name: "Lic. Miguel Torres (Ventas)", email: "miguel.torres@geofal.com.pe", role: "comercial", status: "online" },
  { id: "u-4", name: "Téc. David Miller (Suelos)", email: "david.miller@geofal.com.pe", role: "tecnico", status: "offline" },
]

export function ComunicacionesModule({ user, initialChannelId }: ComunicacionesModuleProps) {
  const [channels, setChannels] = useState<ChatChannel[]>(DEFAULT_CHANNELS)
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannelId || "general")
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>(DEFAULT_TEAM_USERS)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m-1",
      channelId: "general",
      senderId: "sys-1",
      senderName: "Ing. Carlos Mendoza (Gerencia)",
      content: "¡Bienvenidos al nuevo canal de comunicación interna de Geofal! Aquí podemos coordinar proyectos, enviar avances de laboratorio y archivos sin depender de aplicaciones externas.",
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "m-2",
      channelId: "general",
      senderId: "sys-2",
      senderName: "Dra. Ana López (Laboratorio)",
      content: "Excelente actualización. Ya tenemos listas las muestras de la minera Antamina para el ensayo de Proctor y CBR.",
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ])

  const [inputMessage, setInputMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const [isMembersOpen, setIsMembersOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)

  // Form para crear canal
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDesc, setNewChannelDesc] = useState("")
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false)

  // Visor de fotos (Lightbox)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, activeChannelId])

  // Verificar si el usuario actual tiene rol/email permitido para crear canales
  const canCreateChannel =
    user.role === "admin" ||
    user.role === "admin_general" ||
    user.role === "gerencia" ||
    user.role === "jefe_laboratorio" ||
    user.email === "gerencia@geofal.com.pe"

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0]

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return

    const newMessage: ChatMessage = {
      id: `m-${Date.now()}`,
      channelId: activeChannelId,
      senderId: user.id,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: inputMessage.trim(),
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, newMessage])
    setInputMessage("")
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isImage = file.type.startsWith("image/")
    const objectUrl = URL.createObjectURL(file)

    const newMessage: ChatMessage = {
      id: `m-${Date.now()}`,
      channelId: activeChannelId,
      senderId: user.id,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: isImage ? `📷 Imagen adjunta: ${file.name}` : `📎 Archivo adjunto: ${file.name}`,
      attachments: [
        {
          url: objectUrl,
          type: isImage ? "image" : "file",
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
        },
      ],
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, newMessage])
    toast.success("Archivo subido correctamente", { description: file.name })
  }

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) {
      toast.error("Ingresa un nombre para el canal")
      return
    }

    const formattedName = newChannelName.toLowerCase().replace(/\s+/g, "-")

    const newChannel: ChatChannel = {
      id: `ch-${Date.now()}`,
      name: formattedName,
      description: newChannelDesc,
      isPrivate: newChannelIsPrivate,
      category: "area",
    }

    setChannels((prev) => [...prev, newChannel])
    setActiveChannelId(newChannel.id)
    setIsCreateChannelOpen(false)
    setNewChannelName("")
    setNewChannelDesc("")
    setNewChannelIsPrivate(false)

    toast.success("Canal creado con éxito", { description: `#${formattedName}` })
  }

  const activeMessages = messages.filter((m) => m.channelId === activeChannelId)

  return (
    <div className="flex h-[calc(100vh-4.5rem)] w-full overflow-hidden bg-background text-foreground rounded-xl border border-border shadow-md">
      {/* ── COLUMNA IZQUIERDA: Lista de Canales y DMs (Estilo Slack/Discord) ── */}
      <div className="w-72 shrink-0 border-r border-border bg-card/60 flex flex-col">
        {/* Encabezado de Comunicaciones */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-base tracking-tight">Comunicaciones</h2>
          </div>
          {canCreateChannel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-accent"
              onClick={() => setIsCreateChannelOpen(true)}
              title="Crear nuevo canal"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Buscador de Canales / Chat */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar canal o persona..."
              className="pl-8 h-9 text-xs bg-background/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5 leading-tight">
            <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              <strong>Gobernanza:</strong> Los DMs Comercial-Laboratorio están restringidos. Toda coordinación debe realizarse por canales de proyecto.
            </span>
          </div>
        </div>

        {/* Lista de Canales */}
        <ScrollArea className="flex-1 px-3 py-2 space-y-4">
          <div>
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Canales de Trabajo</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{channels.length}</span>
            </div>

            <div className="mt-1 space-y-0.5">
              {channels
                .filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((ch) => {
                  const isActive = ch.id === activeChannelId
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setActiveChannelId(ch.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                        isActive
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                      }`}
                    >
                      {ch.isPrivate ? (
                        <Lock className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary-foreground" : "text-amber-500"}`} />
                      ) : (
                        <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary/70"}`} />
                      )}
                      <span className="truncate flex-1"># {ch.name}</span>
                      {ch.unreadCount ? (
                        <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                          {ch.unreadCount}
                        </Badge>
                      ) : null}
                    </button>
                  )
                })}
            </div>
          </div>

          {/* Chats Privados (DMs) */}
          <div className="mt-4">
            <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              <span>Chats Privados (DMs)</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{teamUsers.length}</span>
            </div>

            <div className="mt-1 space-y-0.5">
              {teamUsers.map((u) => {
                const isComercialUser = user.role === "comercial" || user.role === "auxiliar_comercial"
                const isLabTarget = u.role === "jefe_laboratorio" || u.role === "tecnico" || u.role === "laboratorio"
                const isBlocked = isComercialUser && isLabTarget

                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (isBlocked) {
                        toast.warning("Restricción de Gobernanza CRM", {
                          description: "Los mensajes directos entre Comercial y Laboratorio están restringidos. Coordinar en Canales de Proyecto.",
                        })
                      } else {
                        toast.info(`Iniciando chat directo con ${u.name}`)
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left text-muted-foreground hover:bg-accent/60 hover:text-foreground ${
                      isBlocked ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-6 w-6 border border-border">
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-bold">
                          {u.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card ${
                          u.status === "online" ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                    </div>
                    <span className="truncate flex-1">{u.name}</span>
                    {isBlocked && (
                      <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ── COLUMNA CENTRAL: Chat Principal (Discord Style) ── */}
      <div className="flex-1 flex flex-col bg-background/40 min-w-0">
        {/* Encabezado del Canal Activo */}
        <div className="h-14 px-4 border-b border-border flex items-center justify-between bg-card/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {activeChannel.isPrivate ? (
              <Lock className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <Hash className="h-4 w-4 text-primary shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                # {activeChannel.name}
              </h3>
              {activeChannel.description && (
                <p className="text-[11px] text-muted-foreground truncate">{activeChannel.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-accent"
              onClick={() => setIsMembersOpen(true)}
              title="Ver Miembros del Grupo"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-accent"
              onClick={() => setIsInfoOpen(true)}
              title="Información del Canal"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Feed de Mensajes */}
        <ScrollArea className="flex-1 p-4 space-y-4">
          <div className="space-y-4">
            {activeMessages.map((msg) => {
              const isMe = msg.senderId === user.id
              return (
                <div key={msg.id} className={`flex gap-3 text-sm group ${isMe ? "flex-row-reverse" : ""}`}>
                  <Avatar className="h-8 w-8 border border-border shrink-0">
                    <AvatarImage src={msg.senderAvatar || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {msg.senderName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs text-foreground">{msg.senderName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-none shadow-xs"
                          : "bg-card border border-border text-card-foreground rounded-tl-none shadow-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>

                      {/* Adjuntos (Imágenes o Archivos) */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.attachments.map((att, idx) => (
                            <div key={idx}>
                              {att.type === "image" ? (
                                <img
                                  src={att.url}
                                  alt={att.name}
                                  className="max-w-xs max-h-60 rounded-lg border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setSelectedImage(att.url)}
                                />
                              ) : (
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border text-foreground hover:bg-accent transition-colors"
                                >
                                  <FileText className="h-4 w-4 text-primary" />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-xs truncate">{att.name}</p>
                                    {att.size && <p className="text-[10px] text-muted-foreground">{att.size}</p>}
                                  </div>
                                  <Download className="h-4 w-4 text-muted-foreground" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input de Mensaje de Abajo */}
        <div className="p-3 border-t border-border bg-card/60">
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
            <label className="cursor-pointer p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors">
              <Paperclip className="h-4 w-4" />
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>

            <label className="cursor-pointer p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors">
              <ImageIcon className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>

            <Input
              placeholder={`Enviar mensaje a # ${activeChannel.name}...`}
              className="flex-1 border-none shadow-none focus-visible:ring-0 text-xs bg-transparent h-8"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
            />

            <Button
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0"
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── MODAL: Crear Canal ── */}
      <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />
              Crear nuevo canal de comunicación
            </DialogTitle>
            <DialogDescription>
              Crea un canal para organizar discusiones por área, proyecto o equipo de trabajo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name" className="text-xs font-semibold">
                Nombre del Canal
              </Label>
              <Input
                id="ch-name"
                placeholder="ej. calibracion-balanzas"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ch-desc" className="text-xs font-semibold">
                Descripción (Opcional)
              </Label>
              <Textarea
                id="ch-desc"
                placeholder="¿De qué se tratará este canal?"
                value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
                className="text-xs h-20"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  Canal Privado / Grupo de Proyecto
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Solo los integrantes asignados podrán ver e interactuar en este canal.
                </p>
              </div>
              <Switch checked={newChannelIsPrivate} onCheckedChange={setNewChannelIsPrivate} />
            </div>

            {newChannelIsPrivate && (
              <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-2">
                <Label className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Asignación de Integrantes (Roles Autorizados)
                </Label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border" />
                    <span>Jefe de Laboratorio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border" />
                    <span>Gerencia / Admin</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border" />
                    <span>Técnicos de Lab</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded border-border" />
                    <span>Asesor Comercial</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreateChannelOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateChannel}>
              Crear Canal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Miembros del Grupo ── */}
      <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Miembros de # {activeChannel.name}
            </DialogTitle>
            <DialogDescription>
              Integrantes asignados y roles autorizados en este canal de trabajo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
            {teamUsers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-8 w-8 border border-border">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                        {member.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-card ${
                        member.status === "online" ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{member.name}</p>
                    <p className="text-[10px] text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                  {member.role.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setIsMembersOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Información del Canal ── */}
      <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Información de # {activeChannel.name}
            </DialogTitle>
            <DialogDescription>
              Detalles de gobernanza, privacidad y configuración del canal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg border border-border bg-card space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-muted-foreground">Tipo de Canal:</span>
                <Badge variant={activeChannel.isPrivate ? "destructive" : "secondary"}>
                  {activeChannel.isPrivate ? "Privado / Grupo Proyecto" : "Público General"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-muted-foreground">Categoría:</span>
                <span className="capitalize font-medium">{activeChannel.category}</span>
              </div>
              <div className="space-y-1 pt-1">
                <span className="font-semibold text-muted-foreground">Descripción:</span>
                <p className="text-foreground leading-relaxed bg-muted/30 p-2 rounded border border-border">
                  {activeChannel.description || "Sin descripción asignada."}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <Shield className="h-4 w-4" /> Política de Seguridad CRM
              </p>
              <p className="leading-tight">
                Reconfiguración exclusiva por la Jefatura de Laboratorio y Gerencia. No se permite la comunicación informal fuera de grupos asignados.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" onClick={() => setIsInfoOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: Lightbox de Imágenes ── */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl">
            <img src={selectedImage} alt="Vista previa" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
