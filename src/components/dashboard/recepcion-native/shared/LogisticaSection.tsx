"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface LogisticaSectionProps {
  form: UseFormReturn<any>;
}

export function LogisticaSection({ form }: LogisticaSectionProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Entregado por */}
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            Entregado por:
          </Label>
          <Input
            {...register("entregado_por")}
            className={errors.entregado_por ? "border-destructive" : ""}
            placeholder="-"
          />
          {errors.entregado_por?.message && (
            <span className="text-[9px] font-black text-destructive">
              {String(errors.entregado_por.message ?? "")}
            </span>
          )}
        </div>

        {/* Recibido por */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Recibido por (Laboratorio GEOFAL):
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setValue("recibido_por", "BETZABETH SARAVIA", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className="h-5 px-1.5 text-[9px] font-black bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
              >
                BETZABETH SARAVIA
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setValue("recibido_por", "GERALDINE PINEDO", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                className="h-5 px-1.5 text-[9px] font-black bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
              >
                GERALDINE PINEDO
              </Button>
            </div>
          </div>
          <Input
            {...register("recibido_por")}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase();
              register("recibido_por").onChange(e);
            }}
            className={`${errors.recibido_por ? "border-destructive" : ""} font-bold text-xs uppercase`}
            placeholder="-"
          />
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
