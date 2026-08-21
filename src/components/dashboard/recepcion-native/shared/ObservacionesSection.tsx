"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

interface ObservacionesSectionProps {
  form: UseFormReturn<any>;
  isSubmitting: boolean;
  isEditMode: boolean;
  onClose: () => void;
}

export function ObservacionesSection({
  form,
  isSubmitting,
  isEditMode,
  onClose,
}: ObservacionesSectionProps) {
  const { register } = form;

  return (
    <>
      {/* SECTION 5: NOTAS */}
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            Notas / Observaciones:
          </Label>
          <Textarea
            {...register("observaciones")}
            rows={2}
            placeholder="-"
          />
        </div>
      </div>

      {/* BOTTOM ACTIONS BAR */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t bg-background mt-4">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onClose()}
            disabled={isSubmitting}
            className="text-xs font-bold uppercase tracking-wider"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="text-xs font-black uppercase tracking-wider gap-2 shadow-lg shadow-primary/20 px-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{isEditMode ? "Actualizar Recepción" : "Guardar Recepción"}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
