"use client"

import React from "react"
import { SquarePen, Search, Lock } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type User } from "@/hooks/use-auth"
import { type TeamUser } from "../types"

interface NewDmDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  user: User
  teamUsers: TeamUser[]
  dmSearchQuery: string
  setDmSearchQuery: (query: string) => void
  isAdminUser: boolean
  handleOpenDM: (targetUser: TeamUser) => void
}

export function NewDmDialog({
  isOpen,
  onOpenChange,
  user,
  teamUsers,
  dmSearchQuery,
  setDmSearchQuery,
  isAdminUser,
  handleOpenDM,
}: NewDmDialogProps) {
  const isOnline = (lastSeen?: string | null) => {
    if (!lastSeen) return false
    const diff = new Date().getTime() - new Date(lastSeen).getTime()
    return diff < 5 * 60 * 1000
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
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

          <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
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
                          onOpenChange(false)
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
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
