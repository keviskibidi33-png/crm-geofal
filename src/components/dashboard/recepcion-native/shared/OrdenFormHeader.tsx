"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface RecepcionStatus {
  estado: "idle" | "buscando" | "disponible" | "ocupado";
  mensaje?: string;
  formatos?: { recepcion: boolean; verificacion: boolean; compresion: boolean };
}

interface OrdenFormHeaderProps {
  form: UseFormReturn<any>;
  recepcionStatus: RecepcionStatus;
  buscarEstadoRecepcion: (numero: string) => void;
  handleAutoFillFromCotizacion: (numero: string) => void;
}

export function OrdenFormHeader({
  form,
  recepcionStatus,
  buscarEstadoRecepcion,
  handleAutoFillFromCotizacion,
}: OrdenFormHeaderProps) {
  const {
    register,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = form;

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Numero Recepcion */}
        <div className="relative">
          <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
            Recepción Nº:
          </Label>
          <Input
            {...register("numero_recepcion")}
            onBlur={(e) => {
              let value = e.target.value.trim().toUpperCase();
              if (value) {
                const hasYearSuffix = /-\d{2}$/.test(value);
                const hasExtendedSuffix = /-\d{2}-[A-Z0-9]+$/.test(value);
                if (!hasYearSuffix && !hasExtendedSuffix && /^\d+$/.test(value)) {
                  value = value + "-26";
                }
                e.target.value = value;
                setValue("numero_recepcion", value, { shouldValidate: true });
                buscarEstadoRecepcion(value);
                // Auto-sincronizar cotización, fechas y OT desde Control Laboratorio en tiempo real
                handleAutoFillFromCotizacion(value);
              }
            }}
            className={errors.numero_recepcion ? "border-destructive" : ""}
            placeholder="-"
          />
          {errors.numero_recepcion && (
            <span className="text-[9px] font-black text-destructive ml-1">
              {String(errors.numero_recepcion.message ?? "")}
            </span>
          )}
          <div className="absolute right-2 top-7.5 flex flex-col items-end gap-1">
            {recepcionStatus.estado === "buscando" && (
              <Badge variant="secondary" className="animate-pulse gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Buscando...
              </Badge>
            )}
            {recepcionStatus.estado === "disponible" && (
              <Badge variant="default" className="bg-emerald-100 text-emerald-700 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Disponible
              </Badge>
            )}
            {recepcionStatus.estado === "ocupado" && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                Ocupado
              </Badge>
            )}
          </div>
          {recepcionStatus.mensaje && recepcionStatus.estado !== "buscando" && (
            <p
              className={`text-right text-[9px] font-black italic mt-1 ${
                recepcionStatus.estado === "ocupado"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {recepcionStatus.mensaje}
            </p>
          )}
        </div>

        {/* Numero Cotizacion */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
              Cotización Nº:
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const val = getValues("numero_cotizacion") || "";
                if (val.trim()) {
                  handleAutoFillFromCotizacion(val);
                } else {
                  toast.info("Ingresa un número de cotización o código para autocompletar");
                }
              }}
              className="h-5 px-1.5 text-[9px] font-black text-primary hover:bg-primary/10 gap-1"
              title="Autocompletar datos y ensayos desde la Cotización / Control Lab"
            >
              <Sparkles className="h-3 w-3" />
              <span>Autocompletar</span>
            </Button>
          </div>
          <Input
            {...register("numero_cotizacion")}
            onBlur={async (e) => {
              let value = e.target.value.trim().toUpperCase();
              if (!value) return;

              const fullFormat = /^\d+-COT-\d{2}$/.test(value);
              if (!fullFormat) {
                const digits = value.match(/\d+/);
                if (digits) value = `${digits[0]}-COT-26`;
              }
              e.target.value = value;
              setValue("numero_cotizacion", value, { shouldValidate: true });
              handleAutoFillFromCotizacion(value);
            }}
            className={errors.numero_cotizacion ? "border-destructive" : ""}
            placeholder="-"
          />
          {errors.numero_cotizacion?.message && (
            <span className="text-[9px] font-black text-destructive ml-1">
              {errors.numero_cotizacion.message as string}
            </span>
          )}
        </div>

        {/* OT */}
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
            OT Nº:
          </Label>
          <div className="relative flex items-center">
            <Input
              {...register("numero_ot")}
              autoComplete="off"
              onBlur={(e) => {
                let value = e.target.value.trim();
                if (value) {
                  if (value === "-") {
                    e.target.value = "-";
                    setValue("numero_ot", "-", { shouldValidate: true });
                    return;
                  }
                  // Si no tiene guión de año y son dígitos, agregar suffix
                  if (!value.includes("-") && /^\d+$/.test(value)) {
                    const year = new Date().getFullYear().toString().slice(-2);
                    value = `${value}-${year}`;
                  }
                  e.target.value = value;
                  setValue("numero_ot", value, { shouldValidate: true });
                }
              }}
              className={`${errors.numero_ot ? "border-destructive" : ""} font-mono font-bold`}
              placeholder="-"
            />
          </div>
          {errors.numero_ot?.message && (
            <span className="text-[9px] font-black text-destructive ml-1">
              {String(errors.numero_ot.message ?? "")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
