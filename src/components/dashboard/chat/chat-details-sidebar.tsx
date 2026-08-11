"use client"

import React, { useState, useEffect } from "react"
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
  Trash2,
  UserX,
  ChevronRight,
  ShieldAlert,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type User } from "@/hooks/use-auth"
import { type ChatChannel, type ChatMessage, type TeamUser, getAvatarUrl } from "./types"
import { toast } from "sonner"

interface ChatDetailsSidebarProps {
  activeChannel: ChatChannel
  dmTargetUser: TeamUser | { name: string; email?: string; avatar?: string } | null
  user?: User
  activeMessages: ChatMessage[]
  onClose: () => void
  handleOpenDM?: (targetUser: TeamUser) => void
  teamUsers?: TeamUser[]
  setIsMembersOpen?: (open: boolean) => void
}

type ViewMode = "main" | "members" | "user-detail"

export function ChatDetailsSidebar({
  activeChannel,
  dmTargetUser,
  activeMessages,
  onClose,
  teamUsers = [],
}: ChatDetailsSidebarProps) {
  const isDM = activeChannel.category === "dm" || activeChannel.id.startsWith("dm-")
  const displayName = isDM && dmTargetUser ? dmTargetUser.name : activeChannel.name
  const displayAvatar = isDM && dmTargetUser ? getAvatarUrl(dmTargetUser.avatar) : undefined
  const displayEmail = isDM && dmTargetUser ? dmTargetUser.email : undefined

  // Navigation Sub-view State
  const [currentView, setCurrentView] = useState<ViewMode>("main")
  const [selectedMember, setSelectedMember] = useState<TeamUser | null>(null)

  // Settings states
  const [isFavorite, setIsFavorite] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [memberSearch, setMemberSearch] = useState("")
  const [copied, setCopied] = useState(false)

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

  // Count attachments in activeMessages
  const attachments = activeMessages.flatMap((m) => m.attachments || [])
  const memberList: TeamUser[] = teamUsers.length > 0 ? teamUsers : [
    { id: "1", name: "sistem_admin", email: "admin@geofal.com.pe", role: "Administrador", status: "online", avatar: undefined },
    { id: "2", name: "Geraldine", email: "geraldine@geofal.com.pe", role: "Comercial", status: "online", avatar: undefined },
  ]
  const filteredMembers = memberList.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (m.email && m.email.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  return (
    <div className="w-80 border-l border-border bg-card/70 flex flex-col h-full shrink-0 shadow-xl animate-in slide-in-from-right duration-200">
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
                {currentView === "members" ? "Gente / Miembros" : "Perfil de Usuario"}
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
        <ScrollArea className="flex-1 p-4 space-y-6">
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
            </div>

            <div className="h-px bg-border my-3" />

            {/* Metadatos y Accesos */}
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
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Pin className="h-4 w-4 text-amber-500" /> Mensajes Fijados
                </span>
                <span className="text-muted-foreground text-[11px] font-bold">0</span>
              </button>

              <button
                type="button"
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <ImageIcon className="h-4 w-4 text-blue-500" /> Archivos y Documentos
                </span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  {attachments.length}
                </Badge>
              </button>
            </div>

            <div className="h-px bg-border my-3" />

            <div className="space-y-1 text-xs">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2.5 p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-slate-500" />}
                <span className="font-medium">Copiar enlace de conversación</span>
              </button>
            </div>

            <div className="h-px bg-border my-3" />

            {/* Acciones Críticas */}
            <div className="space-y-1 text-xs pt-1">
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
        </ScrollArea>
      )}

      {/* ──── VISTA MIEMBROS / GENTE ──── */}
      {currentView === "members" && (
        <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4">
          {/* Botón Invitar */}
          <Button
            variant="outline"
            className="w-full h-9 gap-2 rounded-full border-border hover:bg-accent text-xs font-semibold shadow-xs"
            onClick={() => toast.info("Función de invitación abierta para administradores")}
          >
            <UserPlus className="h-4 w-4 text-primary" /> Invitar Participante
          </Button>

          {/* Buscador de Miembros */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar gente..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="h-8 text-xs pl-8 rounded-full bg-background border-border/60"
            />
          </div>

          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pt-1">
            {filteredMembers.length} {filteredMembers.length === 1 ? "Miembro" : "Miembros"}
          </div>

          {/* Lista de Miembros */}
          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-1">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMember(m)
                    setCurrentView("user-detail")
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/60 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative">
                      <Avatar className="h-8 w-8 border border-border">
                        {m.avatar && <AvatarImage src={getAvatarUrl(m.avatar)} alt={m.name} />}
                        <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-slate-700">
                          {m.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {m.name}
                      </p>
                      {m.email && <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground font-medium shrink-0">
                    {m.role || "Miembro"}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* ──── VISTA DETALLE DE USUARIO ──── */}
      {currentView === "user-detail" && selectedMember && (
        <ScrollArea className="flex-1 p-4 space-y-5">
          <div className="flex flex-col items-center text-center space-y-3 pb-4 border-b border-border">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg ring-2 ring-primary/20">
              {selectedMember.avatar && <AvatarImage src={getAvatarUrl(selectedMember.avatar)} alt={selectedMember.name} />}
              <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 font-extrabold text-3xl border border-sky-200 dark:border-slate-700">
                {selectedMember.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h3 className="font-bold text-base tracking-tight text-foreground">{selectedMember.name}</h3>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">En línea</p>
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
                <span>{selectedMember.role || "Miembro"}</span>
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

            <button
              type="button"
              onClick={() => toast.info("Historial de mensajes limpio")}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors font-medium"
            >
              <Trash2 className="h-4 w-4" />
              <span>Eliminar mensajes recientes</span>
            </button>

            <button
              type="button"
              onClick={() => toast.warning("Solicitud de desactivación de usuario enviada")}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 transition-colors font-medium"
            >
              <UserX className="h-4 w-4" />
              <span>Desactivar usuario</span>
            </button>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
