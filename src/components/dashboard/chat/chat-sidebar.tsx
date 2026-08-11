"use client"

import React from "react"
import { MessageSquare, Hash, Lock, Plus, Search, Shield, SquarePen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { type User } from "@/hooks/use-auth"
import { type ChatChannel, type TeamUser, getCanonicalDmId } from "./types"

interface ChatSidebarProps {
  user: User
  channels: ChatChannel[]
  activeChannelId: string
  setActiveChannelId: (id: string) => void
  teamUsers: TeamUser[]
  startedDmUserIds: string[]
  searchQuery: string
  setSearchQuery: (query: string) => void
  canCreateChannel: boolean
  isAdminUser: boolean
  setIsCreateChannelOpen: (open: boolean) => void
  setIsNewDMOpen: (open: boolean) => void
  handleOpenDM: (targetUser: TeamUser) => void
  unreadCounts?: Record<string, number>
}

export function ChatSidebar({
  user,
  channels,
  activeChannelId,
  setActiveChannelId,
  teamUsers,
  startedDmUserIds,
  searchQuery,
  setSearchQuery,
  canCreateChannel,
  isAdminUser,
  setIsCreateChannelOpen,
  setIsNewDMOpen,
  handleOpenDM,
  unreadCounts = {},
}: ChatSidebarProps) {
  const isOnline = (lastSeen?: string | null) => {
    if (!lastSeen) return false
    const diff = new Date().getTime() - new Date(lastSeen).getTime()
    return diff < 5 * 60 * 1000
  }

  const workChannels = channels.filter((c) => c.category !== "dm" && !c.id.startsWith("dm-"))
  const filteredWork = workChannels.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const startedDmUsers = teamUsers.filter(
    (u) => startedDmUserIds.includes(u.id) && u.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-72 shrink-0 border-r border-border bg-card/60 flex flex-col h-full overflow-hidden">
      {/* Encabezado de Comunicaciones */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
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

      <div className="p-3 border-b border-border space-y-2 shrink-0">
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

      {/* Lista de Canales y Chats */}
      <ScrollArea className="flex-1 min-h-0 px-3 py-2 space-y-4">
        <div>
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Canales de Trabajo</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{workChannels.length}</span>
          </div>

          <div className="mt-1 space-y-0.5">
            {filteredWork.map((ch) => {
              const isActive = ch.id === activeChannelId
              const unread = unreadCounts[ch.id] || ch.unreadCount || 0
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 text-left ${
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : unread > 0
                      ? "bg-primary/10 text-foreground font-bold border border-primary/20"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 hover:text-foreground"
                  }`}
                >
                  {ch.isPrivate ? (
                    <Lock className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary-foreground" : "text-amber-500"}`} />
                  ) : (
                    <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary/70"}`} />
                  )}
                  <span className="truncate flex-1"># {ch.name}</span>
                  {unread > 0 ? (
                    <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-extrabold animate-bounce shadow-xs">
                      {unread}
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
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{startedDmUsers.length}</span>
            </div>
          </div>

          <div className="mt-1 space-y-0.5">
            {startedDmUsers.length === 0 ? (
              <div className="mt-2 p-3 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                <p className="font-medium text-foreground">Sin chats iniciados</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Haz clic en + para iniciar un chat privado.</p>
              </div>
            ) : (
              startedDmUsers.map((u) => {
                const isComercialUser = user.role === "comercial" || user.role === "auxiliar_comercial"
                const isLabTarget = u.role === "jefe_laboratorio" || u.role === "tecnico" || u.role === "laboratorio"
                const isBlocked = !isAdminUser && isComercialUser && isLabTarget

                const targetDmId = getCanonicalDmId(user, u)
                const isActive = activeChannelId === targetDmId
                const isUserOnline = isOnline(u.last_seen_at)
                const unread = unreadCounts[targetDmId] || 0

                return (
                  <button
                    key={u.id}
                    onClick={() => handleOpenDM(u)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-150 text-left ${
                      isActive
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : unread > 0
                        ? "bg-primary/10 text-foreground font-bold border border-primary/20 animate-pulse"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/80 hover:text-foreground"
                    } ${isBlocked ? "opacity-60 cursor-not-allowed" : ""}`}
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <Avatar className="h-6 w-6 border border-border">
                        <AvatarFallback
                          className={`text-[9px] font-extrabold ${
                            isActive
                              ? "bg-white/20 text-primary-foreground border border-white/30"
                              : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600"
                          }`}
                        >
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
                    {unread > 0 && (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-extrabold animate-bounce shadow-xs ml-auto">
                        {unread}
                      </Badge>
                    )}
                    {isBlocked && (
                      <Lock className={`h-3 w-3 shrink-0 ${isActive ? "text-primary-foreground" : "text-amber-500"}`} />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
