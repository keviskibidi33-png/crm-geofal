"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface InformeSectionProps {
  form: UseFormReturn<any>;
}

export function InformeSection({ form }: InformeSectionProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-6">
      <h3 className="text-[10px] font-black text-primary uppercase tracking-widest border-l-4 border-primary pl-4">
        DATOS QUE IRÁN EN EL INFORME
      </h3>
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">
          Solicitante:
        </Label>
        <Input
          {...register("solicitante")}
          className={errors.solicitante ? "border-destructive" : ""}
          placeholder=""
        />
        {errors.solicitante?.message && (
          <span className="text-[9px] font-black text-destructive">
            {String(errors.solicitante.message ?? "")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">
          Domicilio Legal Solicitante:
        </Label>
        <Textarea
          {...register("domicilio_solicitante")}
          className={errors.domicilio_solicitante ? "border-destructive" : ""}
          placeholder=""
          rows={2}
        />
        {errors.domicilio_solicitante?.message && (
          <span className="text-[9px] font-black text-destructive">
            {String(errors.domicilio_solicitante.message ?? "")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">
          Proyecto:
        </Label>
        <Input
          {...register("proyecto")}
          className={errors.proyecto ? "border-destructive" : ""}
          placeholder=""
        />
        {errors.proyecto?.message && (
          <span className="text-[9px] font-black text-destructive">
            {String(errors.proyecto.message ?? "")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">
          Ubicación:
        </Label>
        <Textarea
          {...register("ubicacion")}
          className={errors.ubicacion ? "border-destructive" : ""}
          placeholder=""
          rows={2}
        />
        {errors.ubicacion?.message && (
          <span className="text-[9px] font-black text-destructive">
            {String(errors.ubicacion.message ?? "")}
          </span>
        )}
      </div>
    </div>
  );
}
