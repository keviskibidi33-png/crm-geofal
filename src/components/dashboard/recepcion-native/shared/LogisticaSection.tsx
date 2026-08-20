"use client";

import React, { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LogisticaSectionProps {
  form: UseFormReturn<any>;
}

const DEFAULT_RESPONSABLES = [
  "BETZABETH SARAVIA",
  "GERALDINE PINEDO",
];

export function LogisticaSection({ form }: LogisticaSectionProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const recibidoPor = watch("recibido_por") || "";
  const [responsables, setResponsables] = useState<string[]>(DEFAULT_RESPONSABLES);
  const [isCustomRecibido, setIsCustomRecibido] = useState(false);

  // Verificar si el valor actual no está en la lista estándar
  useEffect(() => {
    if (recibidoPor && !responsables.includes(recibidoPor.toUpperCase()) && recibidoPor !== "-") {
      setResponsables((prev) => Array.from(new Set([...prev, recibidoPor.toUpperCase()])).sort());
    }
  }, [recibidoPor, responsables]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__CUSTOM__") {
      setIsCustomRecibido(true);
      setValue("recibido_por", "", { shouldValidate: true, shouldDirty: true });
    } else {
      setIsCustomRecibido(false);
      setValue("recibido_por", val, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entregado por */}
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Entregado por (Cliente / Solicitante):
          </Label>
          <Input
            {...register("entregado_por")}
            className={errors.entregado_por ? "border-destructive" : ""}
            placeholder="Nombre de quien entrega la muestra..."
          />
          {errors.entregado_por?.message && (
            <span className="text-[9px] font-black text-destructive">
              {String(errors.entregado_por.message ?? "")}
            </span>
          )}
        </div>

        {/* Recibido por */}
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Recibido por (Laboratorio GEOFAL):
          </Label>

          <div className="flex flex-col gap-2">
            <select
              value={
                isCustomRecibido
                  ? "__CUSTOM__"
                  : recibidoPor
                  ? recibidoPor.toUpperCase()
                  : ""
              }
              onChange={handleSelectChange}
              className="h-10 rounded-md border bg-background px-3 text-xs font-bold uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="">-- SELECCIONAR RESPONSABLE DE RECEPCIÓN --</option>
              {responsables.map((resp) => (
                <option key={resp} value={resp}>
                  {resp}
                </option>
              ))}
              <option value="__CUSTOM__">OTRO (INGRESAR MANUALMENTE...)</option>
            </select>

            {isCustomRecibido && (
              <Input
                {...register("recibido_por")}
                autoFocus
                onChange={(e) => {
                  e.target.value = e.target.value.toUpperCase();
                  register("recibido_por").onChange(e);
                }}
                className={`${errors.recibido_por ? "border-destructive" : ""} font-bold text-xs uppercase`}
                placeholder="ESCRIBIR NOMBRE DE QUIEN RECIBE..."
              />
            )}
          </div>

          {errors.recibido_por?.message && (
            <span className="text-[9px] font-black text-destructive">
              {String(errors.recibido_por.message ?? "")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
