"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
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
  UserPlus,
  SquarePen,
  MessageSquareDashed,
  Sparkles,
  UserCheck,
  Loader2,
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
import { authFetch } from "@/lib/api-auth"

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
  last_seen_at?: string | null
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

export function ComunicacionesModule({ user, initialChannelId }: ComunicacionesModuleProps) {
  const [channels, setChannels] = useState<ChatChannel[]>(DEFAULT_CHANNELS)
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannelId || "general")
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

  const [inputMessage, setInputMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const [isMembersOpen, setIsMembersOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isNewDMOpen, setIsNewDMOpen] = useState(false)
  const [dmSearchQuery, setDmSearchQuery] = useState("")
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  // Form para crear canal
  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDesc, setNewChannelDesc] = useState("")
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false)
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([])
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>("")

  // Visor de fotos (Lightbox)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const isOnline = (lastSeen?: string | null) => {
    if (!lastSeen) return false
    const diff = new Date().getTime() - new Date(lastSeen).getTime()
    return diff < 5 * 60 * 1000 // 5 minutos de inactividad
  }

  // 1. Cargar canales y usuarios reales del Backend
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [channelsRes, usersRes] = await Promise.all([
          authFetch(`${API_URL}/api/chat/channels`),
          authFetch(`${API_URL}/api/chat/users`),
        ])

        if (channelsRes.ok) {
          const data = await channelsRes.json()
          if (data.channels && data.channels.length > 0) {
            const apiChannels: ChatChannel[] = data.channels.map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description || "",
              isPrivate: Boolean(c.is_private),
              category: c.category || "general",
            }))
            setChannels(apiChannels)
          }
        }

        if (usersRes.ok) {
          const data = await usersRes.json()
          if (data.users && data.users.length > 0) {
            const apiUsers: TeamUser[] = data.users.map((u: any) => ({
              id: String(u.id),
              name: u.nombre || u.full_name || u.email || "Usuario CRM",
              email: u.email || "",
              role: u.rol || u.role || "usuario",
              avatar: u.avatar_url,
              last_seen_at: u.last_seen_at,
              status: isOnline(u.last_seen_at) ? "online" : "offline",
            }))
            setTeamUsers(apiUsers)
          }
        }
      } catch (err) {
        console.warn("Could not fetch chat data from API:", err)
      }
    }
    loadInitialData()
  }, [])

  // 2. Cargar mensajes reales del canal/DM activo
  useEffect(() => {
    async function fetchChannelMessages() {
      setIsLoadingMessages(true)
      try {
        const res = await authFetch(`${API_URL}/api/chat/messages/${activeChannelId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.messages) {
            const loadedMessages: ChatMessage[] = data.messages.map((m: any) => ({
              id: m.id,
              channelId: m.channel_id,
              senderId: m.sender_id,
              senderName: m.sender_name || "Usuario",
              senderAvatar: m.sender_avatar,
              content: m.content,
              attachments: m.attachments || [],
              createdAt: m.created_at,
            }))
            setMessages(loadedMessages)
          }
        }
      } catch (err) {
        console.warn("Error fetching channel messages:", err)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchChannelMessages()
  }, [activeChannelId])

  // 3. Supabase Realtime Subscription para recibir mensajes en vivo
  useEffect(() => {
    const channel = supabase
      .channel(`chat_realtime_${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${activeChannelId}`,
        },
        (payload) => {
          const newMsg = payload.new as any
          if (newMsg) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [
                ...prev,
                {
                  id: newMsg.id,
                  channelId: newMsg.channel_id,
                  senderId: newMsg.sender_id,
                  senderName: newMsg.sender_name || "Usuario CRM",
                  senderAvatar: newMsg.sender_avatar,
                  content: newMsg.content,
                  attachments: newMsg.attachments || [],
                  createdAt: newMsg.created_at,
                },
              ]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeChannelId])

  useEffect(() => {
    scrollToBottom()
  }, [messages, activeChannelId])

  // Verificar si el usuario actual tiene rol/email permitido para crear canales
  const isAdminUser =
    user.role === "admin" ||
    user.role === "admin_general" ||
    user.role === "gerencia" ||
    user.role === "super_admin" ||
    user.email === "gerencia@geofal.com.pe"

  const canCreateChannel =
    isAdminUser ||
    user.role === "jefe_laboratorio"

  const activeChannel: ChatChannel = useMemo(() => {
    const found = channels.find((c) => c.id === activeChannelId)
    if (found) return found

    if (activeChannelId.startsWith("dm-")) {
      const parts = activeChannelId.replace("dm-", "").split("-")
      const targetUser = teamUsers.find((u) => parts.includes(String(u.id)) && String(u.id) !== String(user.id))
      const targetName = targetUser ? targetUser.name : "Chat Privado"
      return {
        id: activeChannelId,
        name: targetName,
        description: `Chat privado con ${targetName}`,
        isPrivate: true,
        category: "dm",
      }
    }

    return channels[0] || DEFAULT_CHANNELS[0]
  }, [channels, activeChannelId, teamUsers, user.id])

  const isDM = activeChannel.category === "dm" || activeChannel.id.startsWith("dm-")
  const channelPrefix = isDM ? "@" : "#"

  // 4. Enviar mensaje real a API Backend
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const textToSend = inputMessage.trim()
    setInputMessage("")

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      channelId: activeChannelId,
      senderId: user.id,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: textToSend,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempMessage])

    try {
      const res = await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        body: JSON.stringify({
          channel_id: activeChannelId,
          content: textToSend,
        }),
      })
      if (!res.ok) {
        toast.error("No se pudo enviar el mensaje")
      }
    } catch (err) {
      console.warn("Failed to send chat message:", err)
    }
  }

  // 5. Enviar adjuntos reales
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const isImage = file.type.startsWith("image/")
    const objectUrl = URL.createObjectURL(file)

    const attachmentObj = {
      url: objectUrl,
      type: isImage ? ("image" as const) : ("file" as const),
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    }

    const contentText = isImage ? `📷 Imagen adjunta: ${file.name}` : `📎 Archivo adjunto: ${file.name}`

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      channelId: activeChannelId,
      senderId: user.id,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: contentText,
      attachments: [attachmentObj],
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempMessage])

    try {
      await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        body: JSON.stringify({
          channel_id: activeChannelId,
          content: contentText,
          attachments: [attachmentObj],
        }),
      })
      toast.success("Archivo enviado en el chat", { description: file.name })
    } catch (err) {
      console.warn("Error uploading chat file attachment:", err)
    }
  }

  // 6. Crear canal real en Backend
  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Ingresa un nombre para el canal")
      return
    }

    const formattedName = newChannelName.toLowerCase().replace(/\s+/g, "-")

    try {
      const res = await authFetch(`${API_URL}/api/chat/channels`, {
        method: "POST",
        body: JSON.stringify({
          name: formattedName,
          description: newChannelDesc,
          is_private: newChannelIsPrivate,
          allowed_emails: selectedUserEmails,
          category: "area",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const created = data.channel || {
          id: `ch-${Date.now()}`,
          name: formattedName,
          description: newChannelDesc,
          is_private: newChannelIsPrivate,
          category: "area",
        }

        const newChannel: ChatChannel = {
          id: created.id,
          name: created.name,
          description: created.description,
          isPrivate: Boolean(created.is_private),
          category: created.category || "area",
        }

        setChannels((prev) => [...prev, newChannel])
        setActiveChannelId(newChannel.id)
        setIsCreateChannelOpen(false)
        setNewChannelName("")
        setNewChannelDesc("")
        setNewChannelIsPrivate(false)
        setSelectedUserEmails([])
        toast.success("Canal creado con éxito", { description: `#${formattedName}` })
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error("Error al crear el canal", { description: errData.detail || "Permisos insuficientes" })
      }
    } catch (err) {
      console.warn("Failed to create chat channel:", err)
    }
  }

  // Añadir integrante al grupo activo
  const handleAddMemberToChannel = async () => {
    if (!selectedUserToAdd) {
      toast.error("Selecciona un integrante para añadir")
      return
    }
    try {
      const selectedUser = teamUsers.find(u => u.email === selectedUserToAdd || u.id === selectedUserToAdd)
      const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}/members`, {
        method: "POST",
        body: JSON.stringify({
          user_id: selectedUser?.id || selectedUserToAdd,
          user_email: selectedUser?.email || selectedUserToAdd,
        }),
      })
      if (res.ok) {
        toast.success(`Integrante ${selectedUser?.name || ''} añadido al grupo #${activeChannel.name}`)
        setSelectedUserToAdd("")
      } else {
        toast.error("Error al añadir integrante al grupo")
      }
    } catch (err) {
      console.warn("Failed to add member:", err)
    }
  }

  // 7. Abrir Chat Privado (DM) con un usuario real
  const handleOpenDM = (targetUser: TeamUser) => {
    const isComercialUser = user.role === "comercial" || user.role === "auxiliar_comercial"
    const isLabTarget = targetUser.role === "jefe_laboratorio" || targetUser.role === "tecnico" || targetUser.role === "laboratorio"
    const isBlocked = !isAdminUser && isComercialUser && isLabTarget

    if (isBlocked) {
      toast.warning("Restricción de Gobernanza CRM", {
        description: "Los mensajes directos entre Comercial y Laboratorio están restringidos. Coordinar en Canales de Proyecto.",
      })
      return
    }

    const dmId = user.id < targetUser.id ? `dm-${user.id}-${targetUser.id}` : `dm-${targetUser.id}-${user.id}`
    const existingChannel = channels.find((c) => c.id === dmId)

    if (!existingChannel) {
      const newDmChannel: ChatChannel = {
        id: dmId,
        name: targetUser.name,
        description: `Chat privado con ${targetUser.name}`,
        isPrivate: true,
        category: "dm",
      }
      setChannels((prev) => [...prev, newDmChannel])
    }

    setActiveChannelId(dmId)
    toast.info(`Conversación abierta con ${targetUser.name}`)
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
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                  onClick={() => setIsNewDMOpen(true)}
                  title="Nuevo Chat Privado (DM)"
                >
                  <SquarePen className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{teamUsers.length}</span>
              </div>
            </div>

            <div className="mt-1 space-y-0.5">
              {teamUsers.map((u) => {
                const isComercialUser = user.role === "comercial" || user.role === "auxiliar_comercial"
                const isLabTarget = u.role === "jefe_laboratorio" || u.role === "tecnico" || u.role === "laboratorio"
                const isBlocked = !isAdminUser && isComercialUser && isLabTarget

                const targetDmId = user.id < u.id ? `dm-${user.id}-${u.id}` : `dm-${u.id}-${user.id}`
                const isActive = activeChannelId === targetDmId
                const isUserOnline = isOnline(u.last_seen_at)

                return (
                  <button
                    key={u.id}
                    onClick={() => handleOpenDM(u)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    } ${isBlocked ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Avatar className="h-6 w-6 border border-border">
                        <AvatarFallback className={`text-[9px] font-bold ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                          {u.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {isUserOnline ? (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5" title="En línea (Activo)">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-card shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                        </span>
                      ) : (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card bg-slate-400" title="Desconectado" />
                      )}
                    </div>
                    <span className="truncate flex-1">{u.name}</span>
                    {isBlocked && (
                      <Lock className={`h-3 w-3 shrink-0 ${isActive ? "text-primary-foreground" : "text-amber-500"}`} />
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
            {isDM ? (
              <UserCheck className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
            ) : activeChannel.isPrivate ? (
              <Lock className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <Hash className="h-4 w-4 text-primary shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                {channelPrefix} {activeChannel.name}
              </h3>
              {activeChannel.description && (
                <p className="text-[11px] text-muted-foreground truncate">{activeChannel.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDM && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent"
                onClick={() => setIsMembersOpen(true)}
                title="Ver Miembros del Grupo"
              >
                <Users className="h-4 w-4" />
              </Button>
            )}
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
          {isLoadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-xs text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Cargando conversación...</span>
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[350px] text-center p-6 space-y-3.5 my-auto">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                {isDM ? (
                  <MessageSquareDashed className="h-8 w-8 text-emerald-500" />
                ) : activeChannel.isPrivate ? (
                  <Lock className="h-8 w-8 text-amber-500" />
                ) : (
                  <Hash className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="max-w-sm space-y-1.5">
                <h4 className="text-base font-bold tracking-tight text-foreground">
                  {isDM
                    ? `Inicio de conversación con ${activeChannel.name}`
                    : `¡Bienvenido al canal #${activeChannel.name}!`}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isDM
                    ? `Este es el comienzo de tu historial de mensajes directos con ${activeChannel.name}. Envía un mensaje a continuación para iniciar el chat en tiempo real.`
                    : activeChannel.description || "Este canal de trabajo está creado y listo para enviar comunicados y coordinaciones del equipo."}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] gap-1 py-1 px-2.5 bg-background font-medium">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Mensajería en tiempo real Geofal CRM
                </Badge>
              </div>
            </div>
          ) : (
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
          )}
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
              placeholder={`Enviar mensaje a ${channelPrefix} ${activeChannel.name}...`}
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
                  Seleccionar Integrantes Autorizados del CRM
                </Label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {teamUsers.map((u) => {
                    const isSelected = selectedUserEmails.includes(u.email)
                    return (
                      <label key={u.id} className="flex items-center justify-between p-1.5 rounded hover:bg-card cursor-pointer border border-transparent hover:border-border text-xs">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUserEmails((prev) => [...prev, u.email])
                              } else {
                                setSelectedUserEmails((prev) => prev.filter((email) => email !== u.email))
                              }
                            }}
                            className="rounded border-border"
                          />
                          <span className="font-semibold text-foreground">{u.name}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold">
                          {u.role.replace("_", " ")}
                        </Badge>
                      </label>
                    )
                  })}
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

          {canCreateChannel && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
              <Label className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Agregar Integrante al Grupo
              </Label>
              <div className="flex gap-2">
                <select
                  className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={selectedUserToAdd}
                  onChange={(e) => setSelectedUserToAdd(e.target.value)}
                >
                  <option value="">-- Seleccionar Usuario del CRM --</option>
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.role.replace("_", " ")})
                    </option>
                  ))}
                </select>
                <Button size="sm" className="h-8 text-xs gap-1" onClick={handleAddMemberToChannel}>
                  <Plus className="h-3.5 w-3.5" /> Agregar
                </Button>
              </div>
            </div>
          )}

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

      {/* ── MODAL: Nuevo Chat Privado (DM) ── */}
      <Dialog open={isNewDMOpen} onOpenChange={setIsNewDMOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <SquarePen className="h-5 w-5 text-primary" />
              Nuevo Chat Privado (DM)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecciona un usuario de la lista para iniciar una conversación 1-a-1.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email o rol..."
                className="pl-8 h-9 text-xs"
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {teamUsers.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Cargando usuarios del sistema...
                </div>
              ) : (
                teamUsers
                  .filter(
                    (u) =>
                      u.name.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                      u.email.toLowerCase().includes(dmSearchQuery.toLowerCase()) ||
                      u.role.toLowerCase().includes(dmSearchQuery.toLowerCase())
                  )
                  .map((targetUser) => {
                    const isComercialUser = user.role === "comercial" || user.role === "auxiliar_comercial"
                    const isLabTarget =
                      targetUser.role === "jefe_laboratorio" ||
                      targetUser.role === "tecnico" ||
                      targetUser.role === "laboratorio"
                    const isBlocked = !isAdminUser && isComercialUser && isLabTarget

                    return (
                      <div
                        key={targetUser.id}
                        onClick={() => {
                          if (!isBlocked) {
                            handleOpenDM(targetUser)
                            setIsNewDMOpen(false)
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-lg border border-border transition-colors cursor-pointer ${
                          isBlocked
                            ? "opacity-50 cursor-not-allowed bg-muted/30"
                            : "hover:bg-accent/60 hover:border-primary/30 bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <Avatar className="h-8 w-8 border border-border">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                                {targetUser.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {isOnline(targetUser.last_seen_at) ? (
                              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-background shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                              </span>
                            ) : (
                              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              {targetUser.name}
                              {isBlocked && <Lock className="h-3 w-3 text-amber-500" />}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{targetUser.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold px-2 py-0.5">
                          {targetUser.role.replace("_", " ")}
                        </Badge>
                      </div>
                    )
                  })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setIsNewDMOpen(false)}>
              Cerrar
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
