/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  X,
  Search,
  Star,
  Users,
  Pin,
  Bell,
  AlertTriangle,
  LogOut,
  ShieldCheck,
  Image as ImageIcon,
  Copy,
  Check,
  ChevronLeft,
  UserPlus,
  Share2,
  UserX,
  ChevronRight,
  ShieldAlert,
  Lock,
  Globe,
  FileText,
  Link as LinkIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { type User } from "@/hooks/use-auth"
import { type ChatChannel, type ChatMessage, type TeamUser, getAvatarUrl } from "./types"
import { extractChannelMediaAndFiles, MediaGalleryModal } from "./dialogs/media-gallery-modal"
import { toast } from "sonner"

interface ChatDetailsSidebarProps {
  activeChannel: ChatChannel
  dmTargetUser: TeamUser | { name: string; email?: string; avatar?: string } | null
  user?: User
  activeMessages: ChatMessage[]
  onClose: () => void
  handleOpenDM?: (targetUser: TeamUser) => void
  teamUsers?: TeamUser[]
  currentMembers?: TeamUser[]
  availableUsersToAdd?: TeamUser[]
  initialView?: ViewMode
  onAddMember?: (userEmailOrId: string) => void
  onRemoveMember?: (member: TeamUser) => void
  onTogglePrivacy?: (isPrivate: boolean) => void
  isAdminUser?: boolean
  onTogglePinMessage?: (messageId: string) => void
  onSelectImage?: (url: string) => void
  onScrollToMessage?: (messageId: string) => void
}

type ViewMode = "main" | "members" | "user-detail" | "pinned-messages"

function isUserOnline(user: TeamUser | { status?: string; last_seen_at?: string | null }): boolean {
  if (user.status === "online") return true
  if (!user.last_seen_at) return false
  const diff = new Date().getTime() - new Date(user.last_seen_at).getTime()
  return diff < 5 * 60 * 1000
}

function formatRoleLabel(role?: string): string {
  if (!role) return "Miembro"
  const map: Record<string, string> = {
    admin: "Admin",
    admin_general: "Admin General",
    gerencia: "Gerencia",
    super_admin: "Super Admin",
    comercial: "Comercial",
    auxiliar_comercial: "Aux. Comercial",
    laboratorio: "Lab",
    jefe_laboratorio: "Jefe Lab",
    jefe_de_laboratorio: "Jefe Lab",
    laboratorio_tipificador: "Tipificador",
    tecnico: "Técnico",
    tecnico_suelos: "Téc. Suelos",
    oficina_tecnica: "Oficina Técnica",
  }
  return map[role.toLowerCase()] || role
}

export function ChatDetailsSidebar({
  activeChannel,
  dmTargetUser,
  user,
  activeMessages,
  onClose,
  handleOpenDM,
  teamUsers = [],
  currentMembers = [],
  availableUsersToAdd = [],
  initialView = "main",
  onAddMember,
  onRemoveMember,
  onTogglePrivacy,
  isAdminUser,
  onTogglePinMessage,
  onSelectImage,
  onScrollToMessage,
}: ChatDetailsSidebarProps) {
  const isDM = activeChannel.category === "dm" || activeChannel.id.startsWith("dm-") || activeChannel.id.startsWith("dm_")
  const displayName = isDM && dmTargetUser ? dmTargetUser.name : activeChannel.name
  const displayAvatar = isDM && dmTargetUser ? getAvatarUrl(dmTargetUser.avatar) : undefined
  const displayEmail = isDM && dmTargetUser && "email" in dmTargetUser ? dmTargetUser.email : undefined

  const userRole = (user?.role || "").toLowerCase()
  const isUserAdmin = Boolean(isAdminUser) || ["admin", "admin_general", "gerencia", "super_admin"].includes(userRole)

  const [currentView, setCurrentView] = useState<ViewMode>(initialView)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamUser | null>(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [memberSearch, setMemberSearch] = useState("")
  const [copied, setCopied] = useState(false)

  // Local Pinned Messages Map
  const [pinnedIdsMap, setPinnedIdsMap] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {}
    try {
      return JSON.parse(localStorage.getItem("crm_pinned_messages_map") || "{}")
    } catch {
      return {}
    }
  })

  const pinnedMessages = useMemo(() => {
    const pinnedIds = pinnedIdsMap[activeChannel.id] || []
    return activeMessages.filter((m) => m.isPinned || pinnedIds.includes(m.id))
  }, [activeMessages, pinnedIdsMap, activeChannel.id])

  const media = useMemo(() => extractChannelMediaAndFiles(activeMessages), [activeMessages])

  useEffect(() => {
    setCurrentView(initialView)
  }, [initialView])

  useEffect(() => {
    try {
      const favs = JSON.parse(localStorage.getItem("crm_chat_favorites") || "[]")
      setIsFavorite(favs.includes(activeChannel.id))

      const sound = localStorage.getItem("crm_chat_sound_enabled")
      setSoundEnabled(sound !== "false")
    } catch {
      // Ignore storage errors
    }
  }, [activeChannel.id])

  const toggleFavorite = (checked: boolean) => {
    setIsFavorite(checked)
    try {
      const favs = JSON.parse(localStorage.getItem("crm_chat_favorites") || "[]")
      let updated: string[] = []
      if (checked) {
        updated = Array.from(new Set([...favs, activeChannel.id]))
        toast.success(`Canal "${displayName}" añadido a favoritos`)
      } else {
        updated = favs.filter((id: string) => id !== activeChannel.id)
        toast.info(`Canal "${displayName}" removido de favoritos`)
      }
      localStorage.setItem("crm_chat_favorites", JSON.stringify(updated))
    } catch {
      // Ignore
    }
  }

  const toggleSound = (checked: boolean) => {
    setSoundEnabled(checked)
    localStorage.setItem("crm_chat_sound_enabled", String(checked))
    if (checked) {
      toast.success("Notificaciones sonoras activadas")
    } else {
      toast.info("Notificaciones sonoras silenciadas")
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    toast.success("Enlace de conversación copiado al portapapeles")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTogglePin = (msgId: string) => {
    const current = pinnedIdsMap[activeChannel.id] || []
    const isPinned = current.includes(msgId)
    const updated = isPinned ? current.filter((id) => id !== msgId) : [...current, msgId]
    const newMap = { ...pinnedIdsMap, [activeChannel.id]: updated }
    setPinnedIdsMap(newMap)
    try {
      localStorage.setItem("crm_pinned_messages_map", JSON.stringify(newMap))
    } catch {}
    if (isPinned) {
      toast.info("Mensaje desfijado del canal")
    } else {
      toast.success("Mensaje fijado en el canal")
    }
    onTogglePinMessage?.(msgId)
  }

  const memberList: TeamUser[] = (currentMembers && currentMembers.length > 0) ? currentMembers : (teamUsers.length > 0 ? teamUsers : [])
  const filteredMembers = memberList.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.email && m.email.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  return (
    <div className="w-80 min-w-[320px] max-w-[320px] border-l border-border bg-card/70 flex flex-col h-full shrink-0 shadow-xl animate-in slide-in-from-right duration-200 overflow-hidden">
      {/* Header Bar depending on Sub-view */}
      <div className="p-3 border-b border-border flex items-center justify-between bg-card/90 shrink-0">
        {currentView === "main" ? (
          <>
            <div className="relative flex-1 mr-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar en mensajes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-8 rounded-full bg-background border-border/60 focus-visible:ring-1"
              />
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full hover:bg-accent"
                onClick={() => {
                  if (currentView === "user-detail") {
                    setCurrentView("members")
                  } else {
                    setCurrentView("main")
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-bold text-sm text-foreground">
                {currentView === "members"
                  ? "Gente / Miembros"
                  : currentView === "pinned-messages"
                  ? "Mensajes Fijados"
                  : "Perfil de Usuario"}
              </h3>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* ──── VISTA PRINCIPAL (MAIN) ──── */}
      {currentView === "main" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
          {/* Ficha Principal de Perfil o Canal */}
          <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-border">
            <Avatar className="h-20 w-20 border-2 border-primary/20 shadow-md ring-4 ring-background">
              {displayAvatar && <AvatarImage src={displayAvatar} alt={displayName} />}
              <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 font-extrabold text-2xl border border-sky-200 dark:border-slate-700">
                {displayName.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h3 className="font-bold text-base tracking-tight text-foreground flex items-center justify-center gap-1.5">
                {displayName}
              </h3>
              {displayEmail && <p className="text-xs text-muted-foreground">{displayEmail}</p>}
              {activeChannel.description && (
                <p className="text-xs text-muted-foreground/80 px-2 italic">{activeChannel.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <Badge variant="outline" className="text-[10px] gap-1 py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold">
                <ShieldCheck className="h-3 w-3" /> Cifrado CRM
              </Badge>
              <Badge variant="secondary" className="text-[10px] py-0.5 px-2 font-medium">
                {isDM ? "Mensaje Directo" : "Canal de Trabajo"}
              </Badge>
            </div>
          </div>

          {/* Opciones de Interacción */}
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                <span className="text-xs font-medium flex items-center gap-2 text-foreground">
                  <Star className={`h-4 w-4 ${isFavorite ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                  Añadir a favoritos
                </span>
                <Switch checked={isFavorite} onCheckedChange={toggleFavorite} className="scale-85" />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                <span className="text-xs font-medium flex items-center gap-2 text-foreground">
                  <Bell className="h-4 w-4 text-sky-500" />
                  Notificaciones sonoras
                </span>
                <Switch checked={soundEnabled} onCheckedChange={toggleSound} className="scale-85" />
              </div>

              {!isDM && isUserAdmin && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/60 border border-border/50">
                  <span className="text-xs font-medium flex items-center gap-2 text-foreground">
                    {activeChannel.isPrivate ? <Lock className="h-4 w-4 text-amber-500" /> : <Globe className="h-4 w-4 text-emerald-500" />}
                    {activeChannel.isPrivate ? "Canal Privado" : "Canal Público"}
                  </span>
                  <Switch
                    checked={activeChannel.isPrivate}
                    onCheckedChange={(checked) => onTogglePrivacy?.(checked)}
                    className="scale-85"
                  />
                </div>
              )}
            </div>

            <div className="h-px bg-border my-3" />

            {/* Metadatos y Accesos Directos */}
            <div className="space-y-1 text-xs">
              {!isDM && (
                <button
                  type="button"
                  onClick={() => setCurrentView("members")}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <Users className="h-4 w-4 text-primary" /> Gente / Miembros
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      {memberList.length}
                    </Badge>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCurrentView("pinned-messages")}
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors group"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Pin className="h-4 w-4 text-amber-500" /> Mensajes Fijados
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                    {pinnedMessages.length}
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsMediaGalleryOpen(true)}
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors group"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <ImageIcon className="h-4 w-4 text-sky-500" /> Archivos y Documentos
                </span>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                    {media.all.length}
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>

          {/* Sección de Archivos y Adjuntos (Vista Previa Estilo WhatsApp) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Archivos compartidos ({media.all.length})
              </h4>
              {media.all.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-primary hover:text-primary font-semibold px-2"
                  onClick={() => setIsMediaGalleryOpen(true)}
                >
                  Ver todos <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>

            {media.all.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-1">No hay archivos ni multimedia en esta conversación.</p>
            ) : (
              <div className="space-y-1">
                {media.all.slice(0, 5).map((att) => (
                  <div
                    key={att.id}
                    onClick={() => {
                      if (att.type === "image") {
                        onSelectImage?.(att.url)
                      } else {
                        window.open(att.url, "_blank")
                      }
                    }}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/60 transition-colors text-xs font-medium text-foreground cursor-pointer group"
                  >
                    {att.type === "image" ? (
                      <div className="h-7 w-7 rounded-md bg-muted overflow-hidden shrink-0 border border-border">
                        <img src={att.url} alt={att.name} className="h-full w-full object-cover" />
                      </div>
                    ) : att.type === "link" ? (
                      <LinkIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold group-hover:text-primary transition-colors leading-tight">
                        {att.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground truncate">{att.senderName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opciones de Acciones */}
          <div className="pt-2 border-t border-border space-y-1 text-xs">
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-accent text-foreground transition-colors font-medium"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              <span>{copied ? "Enlace copiado" : "Copiar enlace de la sala"}</span>
            </button>

            <button
              type="button"
              onClick={() => toast.info("Reporte enviado al equipo de administración CRM")}
              className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-rose-500/10 text-rose-500 transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Reportar sala o conversación</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-medium">Cerrar panel de detalles</span>
            </button>
          </div>
        </div>
      )}

      {/* ──── VISTA MENSAJES FIJADOS ──── */}
      {currentView === "pinned-messages" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          {pinnedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
              <Pin className="h-10 w-10 text-amber-500/40" />
              <p className="text-xs font-semibold text-foreground">No hay mensajes fijados en este canal.</p>
              <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                Pasa el cursor sobre cualquier mensaje en el chat y presiona el ícono 📌 para fijarlo al canal.
              </p>
            </div>
          ) : (
            pinnedMessages.map((pm) => (
              <div key={pm.id} className="p-3 rounded-xl border border-border/80 bg-card hover:bg-accent/30 transition-colors space-y-2 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-6 w-6 border border-border shrink-0">
                      {pm.senderAvatar && <AvatarImage src={getAvatarUrl(pm.senderAvatar)} />}
                      <AvatarFallback className="bg-sky-100 text-sky-700 text-[9px] font-bold">
                        {pm.senderName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold truncate text-foreground">{pm.senderName}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(pm.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <p className="text-xs text-foreground line-clamp-3 bg-muted/40 p-2 rounded-lg border border-border/40 italic">
                  "{pm.content}"
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 px-2 font-semibold"
                    onClick={() => onScrollToMessage?.(pm.id)}
                  >
                    Ir al mensaje
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-rose-500 hover:bg-rose-500/10 px-2"
                    onClick={() => handleTogglePin(pm.id)}
                  >
                    <Pin className="h-3 w-3" /> Desfijar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ──── VISTA MIEMBROS / GENTE ──── */}
      {currentView === "members" && (
        <div className="flex-1 flex flex-col min-h-0 p-4 space-y-3 overflow-hidden">
          {/* Botón Invitar */}
          <Button
            variant="outline"
            className="w-full h-9 gap-2 rounded-full border-border hover:bg-accent text-xs font-semibold shadow-xs shrink-0"
            onClick={() => {
              if (!isUserAdmin) {
                toast.info("Solo Administradores o Gerencia pueden invitar integrantes al canal.")
                return
              }
              if (availableUsersToAdd.length === 0) {
                toast.info("Todos los integrantes del equipo ya forman parte de este canal.")
                return
              }
              setIsInviteModalOpen(true)
            }}
          >
            <UserPlus className="h-4 w-4 text-primary" /> Invitar Participante
          </Button>

          {/* Buscador de Miembros */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar gente..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="h-8 text-xs pl-8 rounded-full bg-background border-border/60"
            />
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-1 shrink-0">
            {filteredMembers.length} {filteredMembers.length === 1 ? "Miembro" : "Miembros"}
          </div>

          {/* Lista de Miembros con Scroll Nativo Fluido */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1">
            {filteredMembers.map((m) => {
              const online = isUserOnline(m)
              return (
                <div
                  key={m.id}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/60 transition-colors group overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMember(m)
                      setCurrentView("user-detail")
                    }}
                    className="flex-1 flex items-center gap-2.5 min-w-0 text-left mr-1 overflow-hidden"
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-8 w-8 border border-border">
                        {m.avatar && <AvatarImage src={getAvatarUrl(m.avatar)} alt={m.name} />}
                        <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-slate-700">
                          {m.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {online ? (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5" title="En línea (Activo)">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-card shadow-[0_0_6px_rgba(34,197,94,0.8)]" />
                        </span>
                      ) : (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-card bg-slate-400" title="Desconectado" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                        {m.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground min-w-0">
                        {m.email && <span className="truncate flex-1">{m.email}</span>}
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-bold shrink-0 rounded-sm bg-muted/60 border border-border/40 text-muted-foreground tracking-tight">
                          {formatRoleLabel(m.role)}
                        </Badge>
                      </div>
                    </div>
                  </button>

                  {isUserAdmin && !isDM && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity ml-1"
                      title="Expulsar integrante del canal"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveMember?.(m)
                      }}
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ──── VISTA DETALLE DE USUARIO ──── */}
      {currentView === "user-detail" && selectedMember && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
          <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-border">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg ring-2 ring-primary/20">
              {selectedMember.avatar && <AvatarImage src={getAvatarUrl(selectedMember.avatar)} alt={selectedMember.name} />}
              <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 font-extrabold text-3xl border border-sky-200 dark:border-slate-700">
                {selectedMember.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h3 className="font-bold text-base tracking-tight text-foreground">{selectedMember.name}</h3>
              <p className={`text-xs font-semibold ${isUserOnline(selectedMember) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                {isUserOnline(selectedMember) ? "En línea" : "Desconectado"}
              </p>
              {selectedMember.email && (
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 pt-0.5">
                  <span>{selectedMember.email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedMember.email || "")
                      toast.success("Correo copiado")
                    }}
                    className="p-1 hover:text-foreground text-muted-foreground"
                    title="Copiar correo"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </p>
              )}
            </div>

            <div className="w-full pt-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block text-left mb-1">
                Nivel de poder
              </label>
              <div className="p-2 rounded-lg bg-background border border-border text-xs font-semibold text-foreground text-left flex items-center justify-between">
                <span>{formatRoleLabel(selectedMember.role)}</span>
                <ShieldAlert className="h-4 w-4 text-sky-500" />
              </div>
            </div>
          </div>

          {/* Acciones del Usuario */}
          <div className="space-y-2 pt-1 text-xs">
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-accent text-foreground transition-colors font-medium"
            >
              <Share2 className="h-4 w-4 text-primary" />
              <span>Compartir enlace al usuario</span>
            </button>

            {isUserAdmin && !isDM && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full gap-2 rounded-lg text-xs font-semibold"
                onClick={() => {
                  onRemoveMember?.(selectedMember)
                  setCurrentView("members")
                }}
              >
                <UserX className="h-4 w-4" /> Expulsar integrante del canal
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Modal Invitar Participante */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Invitar Participante a #{activeChannel.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Selecciona un usuario del equipo para añadirlo a este canal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto py-2">
            {availableUsersToAdd.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-8 w-8 border border-border">
                    {u.avatar && <AvatarImage src={getAvatarUrl(u.avatar)} />}
                    <AvatarFallback className="bg-sky-100 text-sky-700 text-xs font-bold">
                      {u.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email || u.role}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-full gap-1 hover:bg-primary hover:text-primary-foreground"
                  onClick={() => {
                    onAddMember?.(u.email || u.id)
                    setIsInviteModalOpen(false)
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Añadir
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Galería Multimedia Tipo WhatsApp */}
      <MediaGalleryModal
        isOpen={isMediaGalleryOpen}
        onClose={() => setIsMediaGalleryOpen(false)}
        channelName={displayName}
        activeMessages={activeMessages}
        onSelectImage={onSelectImage}
      />
    </div>
  )
}
