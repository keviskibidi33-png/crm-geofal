"use client";

import React, { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import { normalizeRucValue } from "@/lib/recepcion-validators";

export interface ClienteItem {
  id?: string | number;
  nombre?: string;
  cliente?: string;
  ruc?: string;
  domicilio_legal?: string;
  direccion?: string;
  contacto?: string;
  persona_contacto?: string;
  telefono?: string;
  email?: string;
  correo?: string;
  solicitante?: string;
  domicilio_solicitante?: string;
  proyecto?: string;
  ubicacion?: string;
}

interface FacturacionSectionProps {
  form: UseFormReturn<any>;
  clientes: ClienteItem[];
  setClienteSearch: (val: string) => void;
  syncEntregadoPorFromContacto: (contacto: string, options?: { force?: boolean }) => void;
  handleSelectCliente: (cliente: ClienteItem) => void;
}

export function FacturacionSection({
  form,
  clientes,
  setClienteSearch,
  syncEntregadoPorFromContacto,
  handleSelectCliente,
}: FacturacionSectionProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = form;

  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  return (
    <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-6">
      <h3 className="text-[10px] font-black text-primary uppercase tracking-widest border-l-4 border-primary pl-4">
        DATOS PARA FACTURACIÓN Y PERSONA DE CONTACTO
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cliente con Autocomplete */}
        <div className="relative flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            Cliente:
          </Label>
          <Input
            {...register("cliente")}
            onChange={(e) => {
              register("cliente").onChange(e);
              setClienteSearch(e.target.value);
              setShowClienteDropdown(true);
            }}
            onFocus={() => {
              if (clientes.length > 0) setShowClienteDropdown(true);
            }}
            className={errors.cliente ? "border-destructive" : ""}
            placeholder="Buscar por nombre o RUC..."
            autoComplete="off"
          />
          {errors.cliente?.message && (
            <span className="text-[9px] font-black text-destructive">
              {String(errors.cliente.message ?? "")}
            </span>
          )}
          {showClienteDropdown && clientes.length > 0 && (
            <div className="absolute z-1000 top-full mt-1 w-full bg-popover text-popover-foreground border-2 border-primary/30 rounded-xl shadow-2xl max-h-72 overflow-y-auto py-1.5 divide-y divide-border/40">
              {clientes.map((c) => (
                <div
                  key={String(c.id || Math.random())}
                  onClick={() => {
                    handleSelectCliente(c);
                    setShowClienteDropdown(false);
                  }}
                  className="px-4 py-2.5 hover:bg-primary/10 cursor-pointer transition-colors"
                >
                  <div className="text-[11px] font-black text-primary uppercase">
                    {String(c.nombre || c.cliente || "")}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {c.ruc && (
                      <span className="text-[10px] font-mono font-bold text-muted-foreground">
                        RUC: {c.ruc}
                      </span>
                    )}
                    {c.contacto && (
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        Contacto: {c.contacto}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RUC */}
        <div className="flex flex-col gap-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">
            RUC:
          </Label>
          <Input
            {...register("ruc")}
            onBlur={(e) => {
              register("ruc").onBlur(e);
              setValue("ruc", normalizeRucValue(e.target.value), {
                shouldValidate: true,
              });
            }}
            className={errors.ruc ? "border-destructive" : ""}
            placeholder="-"
          />
          {errors.ruc?.message && (
            <span className="text-[9px] font-black text-destructive">
              {String(errors.ruc.message ?? "")}
            </span>
          )}
        </div>
      </div>

      {/* Domicilio Legal */}
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">
          Domicilio Legal:
        </Label>
        <Textarea
          {...register("domicilio_legal")}
          className={errors.domicilio_legal ? "border-destructive" : ""}
          placeholder=""
          rows={2}
        />
        {errors.domicilio_legal?.message && (
          <span className="text-[9px] font-black text-destructive">
            {String(errors.domicilio_legal.message ?? "")}
          </span>
        )}
      </div>

      {/* Contacto, Email, Teléfono */}
      <div className="space-y-2">
        <p className="text-[9px] font-black text-primary uppercase ml-1 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Complete al menos 2 de los 3 campos siguientes:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Persona Contacto:
            </Label>
            <Input
              {...register("persona_contacto")}
              onChange={(e) => {
                register("persona_contacto").onChange(e);
                syncEntregadoPorFromContacto(e.target.value, {
                  force: true,
                });
              }}
              onBlur={(e) => {
                register("persona_contacto").onBlur(e);
                syncEntregadoPorFromContacto(e.target.value, {
                  force: true,
                });
              }}
              className={errors.persona_contacto ? "border-destructive" : ""}
              placeholder="-"
            />
            {errors.persona_contacto?.message && (
              <span className="text-[9px] font-black text-destructive">
                {errors.persona_contacto.message as string}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              E-mail:{" "}
              <span className="text-muted-foreground normal-case font-bold">
                (uno por línea)
              </span>
            </Label>
            <Textarea
              {...register("email")}
              rows={2}
              className={errors.email ? "border-destructive" : ""}
              placeholder="-"
            />
            {errors.email?.message && (
              <span className="text-[9px] font-black text-destructive">
                {errors.email.message as string}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Teléfono:
            </Label>
            <Input
              {...register("telefono")}
              className={errors.telefono ? "border-destructive" : ""}
              placeholder="-"
            />
            {errors.telefono?.message && (
              <span className="text-[9px] font-black text-destructive">
                {errors.telefono.message as string}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
