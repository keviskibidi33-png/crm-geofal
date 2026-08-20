"use client";

import React from "react";
import { UseFormReturn, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy } from "lucide-react";

interface ConcretoSampleTableProps {
  form: UseFormReturn<any>;
  fields: Array<Record<string, any>>;
  append: (value: any) => void;
  handleClone: (index: number) => void;
  handleRequestSampleDelete: (index: number) => void;
  handleSmartDate: (e: React.FocusEvent<HTMLInputElement>, fieldPath: string) => void;
  handleItemsTableKeyDown: (e: React.KeyboardEvent<HTMLTableElement>) => void;
}

export function ConcretoSampleTable({
  form,
  fields,
  append,
  handleClone,
  handleRequestSampleDelete,
  handleSmartDate,
  handleItemsTableKeyDown,
}: ConcretoSampleTableProps) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = form;

  const activeTipo = watch("tipo_recepcion") || "CONCRETO";

  return (
    <div className="bg-card rounded-2xl border overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table
          className="w-full text-left border-collapse"
          onKeyDown={handleItemsTableKeyDown}
        >
          <thead>
            <tr className="bg-muted/50 text-[10px] uppercase font-black tracking-widest border-b">
              <th className="px-4 py-3 w-12 text-center">N°</th>
              <th className="px-2 py-3 w-36">Código LEM</th>
              {activeTipo === "CONCRETO" && (
                <>
                  <th className="px-2 py-3 w-40">Código</th>
                  <th className="px-2 py-3 w-48">Estructura</th>
                  <th className="px-2 py-3 w-16 text-center">F&apos;c</th>
                  <th className="px-2 py-3 w-24 text-center">Fecha moldeo</th>
                  <th className="px-2 py-3 w-20 text-center">Hora Moldeo</th>
                  <th className="px-2 py-3 w-12 text-center">Edad</th>
                  <th className="px-2 py-3 w-24 text-center">Fecha rotura</th>
                  <th className="px-2 py-3 w-16 text-center">Densidad</th>
                </>
              )}
              {activeTipo === "ROCA" && (
                <>
                  <th className="px-2 py-3 w-48">Identificación Muestra</th>
                  <th className="px-2 py-3 w-36">Tamaño (cm) / Peso (kg)</th>
                  <th className="px-2 py-3 w-36">Procedencia</th>
                  <th className="px-2 py-3 w-48">Ensayos Requeridos</th>
                  <th className="px-2 py-3 w-36">Norma Requerida</th>
                </>
              )}
              {activeTipo === "ALBANILERIA" && (
                <>
                  <th className="px-2 py-3 w-52">Descripción Muestra (Marca/Tipo)</th>
                  <th className="px-2 py-3 w-24">Cantidad</th>
                  <th className="px-2 py-3 w-48">Ensayos Requeridos</th>
                  <th className="px-2 py-3 w-36">Norma Requerida</th>
                </>
              )}
              {activeTipo === "AGUA" && (
                <>
                  <th className="px-2 py-3 w-48">Identificación Muestra</th>
                  <th className="px-2 py-3 w-28">Cantidad (L)</th>
                  <th className="px-2 py-3 w-36">Procedencia</th>
                  <th className="px-2 py-3 w-48">Ensayos Requeridos</th>
                  <th className="px-2 py-3 w-36">Norma Requerida</th>
                </>
              )}
              <th className="px-4 py-3 w-12 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((field, index) => {
              const sampleErrors = (errors.muestras as any)?.[index];
              return (
                <tr
                  key={field.id}
                  className="hover:bg-muted/50 transition-colors group"
                >
                  <td className="px-4 py-2 text-xs font-black text-muted-foreground text-center">
                    {index + 1}
                    <input
                      type="hidden"
                      value={index + 1}
                      {...register(`muestras.${index}.item_numero`)}
                    />
                  </td>
                  <td className="px-1 py-2">
                    <textarea
                      {...register(`muestras.${index}.codigo_muestra_lem`)}
                      rows={1}
                      onInput={(e) => {
                        const t = e.currentTarget;
                        t.style.height = "auto";
                        t.style.height = t.scrollHeight + "px";
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (/^\d+$/.test(val)) {
                          const year = new Date()
                            .getFullYear()
                            .toString()
                            .slice(-2);
                          setValue(
                            `muestras.${index}.codigo_muestra_lem`,
                            `${val}-CO-${year}`,
                            { shouldValidate: true }
                          );
                        }
                      }}
                      ref={(el) => {
                        register(`muestras.${index}.codigo_muestra_lem`).ref(el);
                        if (el) {
                          el.style.height = "auto";
                          el.style.height = el.scrollHeight + "px";
                        }
                      }}
                      className={`w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background resize-none ${
                        sampleErrors?.codigo_muestra_lem
                          ? "border-destructive"
                          : "border-input"
                      }`}
                      placeholder="1483"
                    />
                  </td>
                  {activeTipo === "CONCRETO" && (
                    <>
                      <td className="px-1 py-2">
                        <textarea
                          {...register(`muestras.${index}.identificacion_muestra`)}
                          rows={1}
                          className="w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background resize-none border-input"
                          placeholder="BD C62 (2X1)"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <textarea
                          {...register(`muestras.${index}.estructura`)}
                          rows={1}
                          className="w-full px-2 py-1.5 text-xs font-bold uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background resize-none border-input"
                          placeholder="BANCODUCTO"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.fc_kg_cm2`)}
                          className="w-16 mx-auto text-xs font-black text-center"
                          placeholder="-"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.fecha_moldeo`)}
                          onBlur={(e) => {
                            register(`muestras.${index}.fecha_moldeo`).onBlur(e);
                            handleSmartDate(e, `muestras.${index}.fecha_moldeo`);
                          }}
                          className="w-24 mx-auto text-xs font-bold text-center"
                          placeholder="YYYY/MM/DD"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Controller
                          name={`muestras.${index}.hora_moldeo`}
                          control={control}
                          render={({ field: hField }) => (
                            <Input
                              value={hField.value || ""}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^\d:]/g, "");
                                const dg = v.replace(/:/g, "");
                                if (dg.length <= 6) {
                                  let formatted = "";
                                  for (let i = 0; i < dg.length; i++) {
                                    if (i === 2 || i === 4) formatted += ":";
                                    formatted += dg[i];
                                  }
                                  hField.onChange(formatted);
                                }
                              }}
                              placeholder="00:00:00"
                              className="w-20 mx-auto text-xs font-bold text-center"
                              inputMode="numeric"
                              maxLength={8}
                            />
                          )}
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.edad`)}
                          className="w-12 mx-auto text-xs font-bold text-center"
                          placeholder="-"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.fecha_rotura`)}
                          onBlur={(e) => {
                            register(`muestras.${index}.fecha_rotura`).onBlur(e);
                            handleSmartDate(e, `muestras.${index}.fecha_rotura`);
                          }}
                          className="w-24 mx-auto text-xs font-bold text-center"
                          placeholder="YYYY/MM/DD"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <select
                          {...register(`muestras.${index}.requiere_densidad`)}
                          className="w-16 mx-auto block px-2 py-1.5 text-[10px] font-black uppercase border border-input rounded-lg bg-background cursor-pointer text-center"
                        >
                          <option value="">-</option>
                          <option value="false">NO</option>
                          <option value="true">SI</option>
                        </select>
                      </td>
                    </>
                  )}
                  {activeTipo === "ROCA" && (
                    <>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.identificacion_muestra`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="MUESTRA M-01"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.tamano_peso`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="5.2 KG"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.procedencia`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="CANTERA X"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.ensayos_requeridos`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="COMPRESIÓN SIMPLE"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.norma_requerida`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="ASTM D7012"
                        />
                      </td>
                    </>
                  )}
                  {activeTipo === "ALBANILERIA" && (
                    <>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.descripcion_muestra`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="LADRILLO KING KONG 18 HUECOS"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.cantidad`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="10 UNID"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.ensayos_requeridos`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="COMPRESIÓN LADRILLO"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.norma_requerida`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="NTP 399.613"
                        />
                      </td>
                    </>
                  )}
                  {activeTipo === "AGUA" && (
                    <>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.identificacion_muestra`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="MUESTRA AGUA POZO 01"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.cantidad`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="5 L"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.procedencia`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="OBRA SANTA ROSA"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.ensayos_requeridos`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="ANÁLISIS QUÍMICO COMPLETO"
                        />
                      </td>
                      <td className="px-1 py-2">
                        <Input
                          {...register(`muestras.${index}.norma_requerida`)}
                          className="w-full text-xs font-bold uppercase"
                          placeholder="NTP 339.088"
                        />
                      </td>
                    </>
                  )}
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClone(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Clonar item"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRequestSampleDelete(index);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Eliminar muestra"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-muted/30 border-t">
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={() =>
            append({
              item_numero: fields.length + 1,
              identificacion_muestra: "",
              estructura: "",
              fc_kg_cm2: "",
              edad: "",
              fecha_moldeo: "",
              fecha_rotura: "",
              requiere_densidad: "",
            })
          }
          className="text-[10px] font-black uppercase tracking-widest"
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar Muestra
        </Button>
      </div>
    </div>
  );
}
