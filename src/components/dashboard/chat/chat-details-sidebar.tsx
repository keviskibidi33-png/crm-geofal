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
  user: User
  activeMessages: ChatMessage[]
  onClose: () => void
  handleOpenDM?: (targetUser: TeamUser) => void
}

export function ChatDetailsSidebar({
  activeChannel,
  dmTargetUser,
  user: _user,
  activeMessages,
  onClose,
}: ChatDetailsSidebarProps) {
  const isDM = activeChannel.category === "dm" || activeChannel.id.startsWith("dm-")
  const displayName = isDM && dmTargetUser ? dmTargetUser.name : activeChannel.name
  const displayAvatar = isDM && dmTargetUser ? getAvatarUrl(dmTargetUser.avatar) : undefined
  const displayEmail = isDM && dmTargetUser ? dmTargetUser.email : undefined

  // Favorite toggle state
  const [isFavorite, setIsFavorite] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
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
  const memberCount = (activeChannel as unknown as { memberCount?: number }).memberCount || 1

  return (
    <div className="w-80 border-l border-border bg-card/60 flex flex-col h-full shrink-0 shadow-lg animate-in slide-in-from-right duration-200">
      {/* Search Header Bar */}
      <div className="p-3 border-b border-border flex items-center gap-2 bg-card/80">
        <div className="relative flex-1">
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
      </div>

      <ScrollArea className="flex-1 p-4 space-y-6">
        {/* Profile Card Section */}
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

        {/* Options List */}
        <div className="space-y-4 pt-2">
          {/* Quick Controls */}
          <div className="space-y-2.5">
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

          {/* Chat Metadata Items */}
          <div className="space-y-1 text-xs">
            {!isDM && (
              <button
                type="button"
                className="w-full flex items-center justify-between p-2 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="flex items-center gap-2.5 font-medium">
                  <Users className="h-4 w-4 text-primary" /> Gente / Miembros
                </span>
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                  {memberCount}
                </Badge>
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
                <ImageIcon className="h-4 w-4 text-blue-500" /> Imágenes y Archivos
              </span>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                {attachments.length}
              </Badge>
            </button>
          </div>

          <div className="h-px bg-border my-3" />

          {/* Action Links */}
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

          {/* Critical Danger Actions */}
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
    </div>
  )
}
