"use client"

import React, { useState } from "react"
import { MessageSquare, Shield, Lock, CheckCircle2, Clock, Mail } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { type TeamUser } from "../types"
import { type User } from "@/hooks/use-auth"

interface UserProfilePopoverProps {
  targetUser: TeamUser | { id?: string; name: string; email?: string; role?: string; avatar?: string; banner_url?: string; last_seen_at?: string }
  currentUser: User
  handleOpenDM?: (targetUser: TeamUser) => void
  children: React.ReactNode
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
}

export function UserProfilePopover({
  targetUser,
  currentUser,
  handleOpenDM,
  children,
  align = "start",
  side = "bottom",
}: UserProfilePopoverProps) {
  const [open, setOpen] = useState(false)

  const isOnline = (lastSeen?: string | null) => {
    if (!lastSeen) return false
    const diff = new Date().getTime() - new Date(lastSeen).getTime()
    return diff < 5 * 60 * 1000
  }

  const name = targetUser.name || "Usuario CRM"
  const email = targetUser.email || ""
  const role = targetUser.role || "usuario"
  const rawAvatar = targetUser.avatar
  const bannerUrl = (targetUser as any).banner_url
  const onlineStatus = isOnline(targetUser.last_seen_at)

  const resolveAvatarUrl = (url?: string) => {
    if (!url) return undefined
    if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uivlyclywvxvhjvgssky.supabase.co"
    return `${supabaseUrl}/storage/v1/object/public/avatars/${url.replace(/^\/+/, "")}`
  }

  const avatar = resolveAvatarUrl(rawAvatar)

  const isAdminUser =
    currentUser.role === "admin" ||
    currentUser.role === "admin_general" ||
    currentUser.role === "gerencia" ||
    currentUser.role === "super_admin" ||
    currentUser.email === "gerencia@geofal.com.pe"

  const isComercialUser = currentUser.role === "comercial" || currentUser.role === "auxiliar_comercial"
  const isLabTarget = role === "jefe_laboratorio" || role === "tecnico" || role === "laboratorio"
  const isBlocked = !isAdminUser && isComercialUser && isLabTarget
  const isSelf = (currentUser.email && email && currentUser.email.toLowerCase() === email.toLowerCase()) || currentUser.id === targetUser.id

  const formatRoleLabel = (r: string) => {
    const clean = r.replace(/_/g, " ").toUpperCase()
    if (clean === "SUPER ADMIN" || clean === "GERENCIA") return "GERENCIA / SUPER ADMIN"
    if (clean === "AUXILIAR COMERCIAL") return "COMERCIAL / VENTAS"
    if (clean === "JEFE LABORATORIO") return "JEFE DE LABORATORIO"
    return clean
  }

  const onStartDM = () => {
    setOpen(false)
    if (handleOpenDM && !isSelf && !isBlocked) {
      const fullTeamUser: TeamUser = {
        id: String(targetUser.id || targetUser.email),
        name,
        email,
        role,
        avatar,
        status: onlineStatus ? "online" : "offline",
        last_seen_at: targetUser.last_seen_at,
      }
      handleOpenDM(fullTeamUser)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-80 p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-card text-card-foreground z-50 animate-in fade-in-0 zoom-in-95"
      >
        {/* Cabecera Corporativa con Fondo Personalizado o Gradiente Geofal */}
        <div
          className="relative h-24 p-3 bg-cover bg-center transition-all bg-slate-900"
          style={{ backgroundImage: `url(${bannerUrl || "/login-background.png"})` }}
        >
          <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
          <div className="absolute right-3 top-3 flex items-center gap-1 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] text-white/90 font-semibold border border-white/20">
            <Shield className="h-3 w-3 text-sky-300" />
            <span>Perfil CRM</span>
          </div>
        </div>

        {/* Avatar Flotante y Estado */}
        <div className="px-4 pb-4 pt-0 relative">
          <div className="relative -mt-10 mb-3 flex items-end justify-between">
            <div className="relative">
              <Avatar className="h-16 w-16 border-4 border-card shadow-lg ring-2 ring-primary/20">
                {avatar && <AvatarImage src={avatar} alt={name} />}
                <AvatarFallback className="bg-linear-to-br from-primary to-blue-700 text-white font-extrabold text-lg">
                  {name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {onlineStatus ? (
                <span className="absolute bottom-0 right-0 flex h-4 w-4" title="En línea">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-card shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                </span>
              ) : (
                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-card bg-slate-400" title="Desconectado" />
              )}
            </div>

            <Badge variant="outline" className="text-[10px] uppercase font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/20">
              {formatRoleLabel(role)}
            </Badge>
          </div>

          {/* Información del Usuario */}
          <div className="space-y-1">
            <h3 className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
              {name}
              {onlineStatus && <CheckCircle2 className="h-4 w-4 text-emerald-500 fill-emerald-500/20" />}
            </h3>
            {email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{email}</span>
              </p>
            )}
          </div>

          {/* Estado de Actividad */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
              <span>Estado:</span>
            </span>
            <span className={onlineStatus ? "font-bold text-emerald-600 dark:text-emerald-400" : "font-medium text-slate-500"}>
              {onlineStatus ? "En línea (Activo)" : "Desconectado"}
            </span>
          </div>

          {/* Botón Acción Principal: Chat Privado */}
          {!isSelf && (
            <div className="mt-4">
              {isBlocked ? (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-2">
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Gobernanza CRM: DMs Comercial-Laboratorio restringidos. Usar Canales de Proyecto.</span>
                </div>
              ) : (
                <Button
                  onClick={onStartDM}
                  className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Enviar Mensaje Directo</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
