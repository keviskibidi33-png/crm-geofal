"use client"

import React from "react"
import { Info, Shield, Trash2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { type ChatChannel } from "../types"

interface ChannelInfoDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  activeChannel: ChatChannel
  activeChannelId: string
  canCreateChannel: boolean
  editChannelName: string
  setEditChannelName: (name: string) => void
  editChannelDesc: string
  setEditChannelDesc: (desc: string) => void
  editChannelCategory: "general" | "area" | "proyecto" | "dm"
  setEditChannelCategory: (cat: "general" | "area" | "proyecto" | "dm") => void
  editChannelIsPrivate: boolean
  setEditChannelIsPrivate: (isPriv: boolean) => void
  handleUpdateChannelInfo: () => void
  handleDeleteChannel: () => void
}

export function ChannelInfoDialog({
  isOpen,
  onOpenChange,
  activeChannel,
  activeChannelId,
  canCreateChannel,
  editChannelName,
  setEditChannelName,
  editChannelDesc,
  setEditChannelDesc,
  editChannelCategory,
  setEditChannelCategory,
  editChannelIsPrivate,
  setEditChannelIsPrivate,
  handleUpdateChannelInfo,
  handleDeleteChannel,
}: ChannelInfoDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Configuración e Información de # {activeChannel.name}
          </DialogTitle>
          <DialogDescription>
            Modifica la configuración, gobernanza y detalles de este canal de trabajo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <Label htmlFor="edit-ch-name" className="text-xs font-semibold">
              Nombre del Canal
            </Label>
            <Input
              id="edit-ch-name"
              value={editChannelName}
              onChange={(e) => setEditChannelName(e.target.value)}
              className="text-xs font-medium"
              placeholder="ej. prueba-comu"
              disabled={!canCreateChannel}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-ch-desc" className="text-xs font-semibold">
              Descripción
            </Label>
            <Textarea
              id="edit-ch-desc"
              value={editChannelDesc}
              onChange={(e) => setEditChannelDesc(e.target.value)}
              className="text-xs h-20"
              placeholder="Describe el propósito del canal..."
              disabled={!canCreateChannel}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Categoría</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={editChannelCategory}
                onChange={(e) => setEditChannelCategory(e.target.value as any)}
                disabled={!canCreateChannel}
              >
                <option value="general">General</option>
                <option value="area">Área de Trabajo</option>
                <option value="proyecto">Proyecto Especial</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Visibilidad</Label>
              <div className="flex items-center justify-between h-9 px-3 rounded-md border border-input bg-background">
                <span className="text-xs font-medium">
                  {editChannelIsPrivate ? "Privado" : "Público"}
                </span>
                <Switch
                  checked={editChannelIsPrivate}
                  onCheckedChange={setEditChannelIsPrivate}
                  disabled={!canCreateChannel}
                />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> Política de Gobernanza CRM
            </p>
            <p className="leading-tight">
              Los cambios en el canal se aplicarán en tiempo real para todos los integrantes asignados.
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
          {canCreateChannel && activeChannelId !== "general" && activeChannelId !== "laboratorio" ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleDeleteChannel}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar Canal
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {canCreateChannel && (
              <Button size="sm" className="gap-1" onClick={handleUpdateChannelInfo}>
                <Save className="h-3.5 w-3.5" /> Guardar Cambios
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
