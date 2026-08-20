"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/api-auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface SavePlantillaModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFormData: Record<string, any>;
  tipoRecepcion: string;
}

export function SavePlantillaModal({
  isOpen,
  onClose,
  currentFormData,
  tipoRecepcion,
}: SavePlantillaModalProps) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error("Ingresa un nombre para la plantilla");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nombre_plantilla: nombre.trim(),
        descripcion_plantilla: descripcion.trim() || undefined,
        tipo_recepcion: tipoRecepcion || "CONCRETO",
        cliente: currentFormData.cliente || "",
        ruc: currentFormData.ruc || "",
        domicilio_legal: currentFormData.domicilio_legal || "",
        persona_contacto: currentFormData.persona_contacto || "",
        email: currentFormData.email || "",
        telefono: currentFormData.telefono || "",
        solicitante: currentFormData.solicitante || "",
        domicilio_solicitante: currentFormData.domicilio_solicitante || "",
        proyecto: currentFormData.proyecto || "",
        ubicacion: currentFormData.ubicacion || "",
      };

      const res = await authFetch(`${API_URL}/api/recepcion/plantillas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Error al guardar la plantilla");
      }

      toast.success(`Plantilla "${nombre.trim()}" guardada exitosamente`);
      setNombre("");
      setDescripcion("");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error al guardar la plantilla");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
              <BookmarkPlus className="h-5 w-5 text-primary" />
              Guardar como Plantilla
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Nombre de la Plantilla <span className="text-destructive">*</span>
              </Label>
              <Input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Plantilla Consorcio Vial"
                className="text-xs font-semibold"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider">
                Descripción (Opcional)
              </Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Notas sobre el cliente o proyecto recurrente..."
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="bg-muted/40 rounded-xl p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-bold uppercase text-foreground">Datos que se guardarán:</p>
              <p>• Cliente: {currentFormData.cliente || "-"}</p>
              <p>• RUC: {currentFormData.ruc || "-"}</p>
              <p>• Proyecto: {currentFormData.proyecto || "-"}</p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="text-xs font-black uppercase gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Guardar Plantilla
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
