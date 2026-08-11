"use client"

import React from "react"
import { Hash, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type TeamUser } from "../types"

interface CreateChannelDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  newChannelName: string
  setNewChannelName: (name: string) => void
  newChannelDesc: string
  setNewChannelDesc: (desc: string) => void
  newChannelIsPrivate: boolean
  setNewChannelIsPrivate: (isPrivate: boolean) => void
  selectedUserEmails: string[]
  setSelectedUserEmails: React.Dispatch<React.SetStateAction<string[]>>
  teamUsers: TeamUser[]
  handleCreateChannel: () => void
}

export function CreateChannelDialog({
  isOpen,
  onOpenChange,
  newChannelName,
  setNewChannelName,
  newChannelDesc,
  setNewChannelDesc,
  newChannelIsPrivate,
  setNewChannelIsPrivate,
  selectedUserEmails,
  setSelectedUserEmails,
  teamUsers,
  handleCreateChannel,
}: CreateChannelDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
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
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleCreateChannel}>
            Crear Canal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
