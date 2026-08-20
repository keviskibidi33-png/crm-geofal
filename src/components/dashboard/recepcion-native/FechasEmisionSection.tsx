"use client";

import React from "react";
import { UseFormReturn, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface FechasEmisionSectionProps {
  form: UseFormReturn<any>;
  handleSmartDate: (e: React.FocusEvent<HTMLInputElement>, fieldPath: string) => void;
}

export function FechasEmisionSection({
  form,
  handleSmartDate,
}: FechasEmisionSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            FECHA DE RECEPCIÓN:
          </Label>
          <Input
            {...register("fecha_recepcion")}
            onBlur={(e) => {
              register("fecha_recepcion").onBlur(e);
              handleSmartDate(e, "fecha_recepcion");
            }}
            className={errors.fecha_recepcion ? "border-destructive" : ""}
            placeholder="-"
          />
          {errors.fecha_recepcion?.message && (
            <span className="text-[9px] font-black text-destructive">
              {String(errors.fecha_recepcion.message ?? "")}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            FECHA ESTIMADA DE CULMINACIÓN:
          </Label>
          <Input
            {...register("fecha_estimada_culminacion")}
            onBlur={(e) => {
              register("fecha_estimada_culminacion").onBlur(e);
              handleSmartDate(e, "fecha_estimada_culminacion");
            }}
            className={errors.fecha_estimada_culminacion ? "border-destructive" : ""}
            placeholder="-"
          />
          {errors.fecha_estimada_culminacion?.message && (
            <span className="text-[9px] font-black text-destructive">
              {String(errors.fecha_estimada_culminacion.message ?? "")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="text-[10px] font-black uppercase tracking-widest">
          Emisión de Informes:
        </h4>
        <div className="flex flex-wrap gap-8">
          <div className="flex items-center space-x-2">
            <Controller
              name="emision_digital"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="emision_digital"
                  checked={!!field.value}
                  onCheckedChange={(checked) => field.onChange(!!checked)}
                />
              )}
            />
            <Label
              htmlFor="emision_digital"
              className="text-xs font-bold uppercase cursor-pointer select-none"
            >
              Digital
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Controller
              name="emision_fisica"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="emision_fisica"
                  checked={!!field.value}
                  onCheckedChange={(checked) => field.onChange(!!checked)}
                />
              )}
            />
            <Label
              htmlFor="emision_fisica"
              className="text-xs font-bold uppercase cursor-pointer select-none"
            >
              Físico
            </Label>
          </div>
        </div>
      </div>
    </div>
  );
}
