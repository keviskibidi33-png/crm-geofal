"use client"

import React from "react"
import { Users, UserPlus, Plus, UserMinus } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type ChatChannel, type TeamUser } from "../types"

interface ChannelMembersDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  activeChannel: ChatChannel
  canCreateChannel: boolean
  selectedUserToAdd: string
  setSelectedUserToAdd: (val: string) => void
  availableUsersToAdd: TeamUser[]
  currentMembers: TeamUser[]
  handleAddMemberToChannel: () => void
  handleRemoveMemberFromChannel: (member: TeamUser) => void
}

export function ChannelMembersDialog({
  isOpen,
  onOpenChange,
  activeChannel,
  canCreateChannel,
  selectedUserToAdd,
  setSelectedUserToAdd,
  availableUsersToAdd,
  currentMembers,
  handleAddMemberToChannel,
  handleRemoveMemberFromChannel,
}: ChannelMembersDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">
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
                {availableUsersToAdd.map((u) => (
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

        <div className="space-y-2.5 py-2 max-h-[380px] overflow-y-auto pr-2">
          {currentMembers.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No hay integrantes en este grupo.
            </div>
          ) : (
            currentMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/80 hover:bg-card transition-colors">
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
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold">
                    {member.role.replace("_", " ")}
                  </Badge>
                  {canCreateChannel && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => handleRemoveMemberFromChannel(member)}
                      title="Quitar del grupo"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
