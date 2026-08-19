"use client";

import React, { useState, useEffect, useRef } from "react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { FormInput, FormOutput } from "@/lib/recepcion-validators";
import { ensayosData, searchEnsayos, getEnsayoByCodigo, type EnsayoItem } from "@/data/ensayos-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Sparkles, Layers } from "lucide-react";

interface SueloAgregadoSampleListProps {
  form: UseFormReturn<FormInput, unknown, FormOutput>;
  fields: Array<Record<string, any>>;
  append: (value: any) => void;
  onCloneSample: (index: number) => void;
  onRequestDeleteSample: (index: number) => void;
}

interface EnsayoRow {
  codigo: string;
  descripcion: string;
  norma: string;
}

export function SueloAgregadoSampleList({
  form,
  fields,
  append,
  onCloneSample,
  onRequestDeleteSample,
}: SueloAgregadoSampleListProps) {
  const { register, setValue, watch } = form;
  const muestrasValues = watch("muestras") || [];

  return (
    <div className="space-y-6 overflow-visible">
      {fields.map((field, sIdx) => {
        const muestra = muestrasValues[sIdx] || {};
        const rawEnsayos = muestra.ensayos_lista;
        let sampleAssays: EnsayoRow[] = [];

        if (Array.isArray(rawEnsayos) && rawEnsayos.length > 0) {
          sampleAssays = rawEnsayos.map((e) => ({
            codigo: String(e?.codigo || "").trim(),
            descripcion: String(e?.descripcion || "").trim(),
            norma: String(e?.norma || "").trim(),
          }));
        } else if (muestra.ensayos_json) {
          try {
            const parsed = JSON.parse(muestra.ensayos_json);
            if (Array.isArray(parsed) && parsed.length > 0) {
              sampleAssays = parsed.map((e) => ({
                codigo: String(e?.codigo || "").trim(),
                descripcion: String(e?.descripcion || "").trim(),
                norma: String(e?.norma || "").trim(),
              }));
            }
          } catch {}
        }

        // Fallback to single fields or default
        if (sampleAssays.length === 0) {
          if (muestra.codigo_ensayo || muestra.ensayos_requeridos || muestra.norma_requerida) {
            sampleAssays = [
              {
                codigo: muestra.codigo_ensayo || "",
                descripcion: muestra.ensayos_requeridos || "",
                norma: muestra.norma_requerida || "",
              },
            ];
          } else {
            sampleAssays = [
              {
                codigo: "SU24",
                descripcion: "ANÁLISIS GRANULOMÉTRICO POR TAMIZADO EN SUELOS",
                norma: "ASTM D6913/D6913M-17",
              },
            ];
          }
        }

        const updateAssays = (newAssays: EnsayoRow[]) => {
          setValue(`muestras.${sIdx}.ensayos_lista`, newAssays as any, { shouldDirty: true });
          setValue(`muestras.${sIdx}.ensayos_json`, JSON.stringify(newAssays), { shouldDirty: true });
          if (newAssays.length > 0) {
            setValue(`muestras.${sIdx}.codigo_ensayo`, newAssays[0].codigo, { shouldDirty: true });
            setValue(
              `muestras.${sIdx}.ensayos_requeridos`,
              newAssays.map((a) => a.descripcion).filter(Boolean).join(", "),
              { shouldDirty: true }
            );
            setValue(`muestras.${sIdx}.norma_requerida`, newAssays[0].norma, { shouldDirty: true });
          }
        };

        const handleAddAssay = () => {
          const updated = [...sampleAssays, { codigo: "", descripcion: "", norma: "" }];
          updateAssays(updated);
        };

        const handleRemoveAssay = (assayIdx: number) => {
          if (sampleAssays.length <= 1) {
            updateAssays([{ codigo: "", descripcion: "", norma: "" }]);
            return;
          }
          const updated = sampleAssays.filter((_, idx) => idx !== assayIdx);
          updateAssays(updated);
        };

        const handleAssayChange = (assayIdx: number, field: keyof EnsayoRow, val: string) => {
          const updated = [...sampleAssays];
          updated[assayIdx] = { ...updated[assayIdx], [field]: val };
          updateAssays(updated);
        };

        const handleSelectSuggestedEnsayo = (assayIdx: number, item: EnsayoItem) => {
          const updated = [...sampleAssays];
          updated[assayIdx] = {
            codigo: item.codigo,
            descripcion: item.descripcion,
            norma: item.norma || "-",
          };
          updateAssays(updated);
        };

        return (
          <div
            key={field.id}
            className="rounded-2xl border-2 border-border/80 bg-card overflow-visible shadow-sm hover:shadow-md transition-all relative"
            style={{ zIndex: Math.max(1, 40 - sIdx) }}
          >
            {/* CARD HEADER */}
            <div className="bg-muted/40 px-5 py-3.5 border-b rounded-t-2xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Badge
                  variant="default"
                  className="px-3 py-1 text-xs font-black tracking-wider uppercase bg-primary text-primary-foreground shadow-sm"
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  MUESTRA N° {sIdx + 1}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Código LEM:
                  </span>
                  <Input
                    {...register(`muestras.${sIdx}.codigo_muestra_lem`)}
                    placeholder="-----"
                    className="h-8 w-36 font-mono font-bold text-xs uppercase bg-background"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCloneSample(sIdx)}
                  className="h-8 px-2.5 text-xs font-bold gap-1.5 hover:text-primary hover:border-primary/40"
                  title="Clonar esta muestra"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Clonar</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRequestDeleteSample(sIdx)}
                  className="h-8 px-2 text-xs font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Eliminar muestra"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* CARD BODY: 4 SAMPLE METADATA FIELDS */}
            <div className="p-5 space-y-5 overflow-visible">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">1.</span> MUESTRA:
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.identificacion_muestra`)}
                    placeholder="-----"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">2.</span> PROCEDENCIA:
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.procedencia`)}
                    placeholder="-----"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">3.</span> CANTERA:
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.cantera`)}
                    placeholder="-----"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">4.</span> CANTIDAD (KG):
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.cantidad`)}
                    placeholder="-----"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>
              </div>

              {/* SUBSECTION: ENSAYOS REQUERIDOS (VINCULACIÓN CON COTIZADORA) */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 overflow-visible relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-foreground/90">
                      Ensayos Requeridos para Muestra #{sIdx + 1}
                    </h5>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      (Autocompletado al escribir código o descripción)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAssay}
                    className="h-7 text-[10px] font-black uppercase tracking-wider gap-1 border-primary/40 text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar Ensayo
                  </Button>
                </div>

                {/* ASSAYS TABLE */}
                <div className="border rounded-lg overflow-visible bg-background relative">
                  <table className="w-full text-left border-collapse overflow-visible">
                    <thead>
                      <tr className="bg-muted/50 border-b text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                        <th className="px-3 py-2 w-36">Cód. Ensayo</th>
                        <th className="px-3 py-2">Ensayos requeridos (Descripción)</th>
                        <th className="px-3 py-2 w-48">Norma</th>
                        <th className="px-2 py-2 w-12 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 overflow-visible">
                      {sampleAssays.map((assay, aIdx) => (
                        <AssayRowItem
                          key={aIdx}
                          assay={assay}
                          totalAssays={sampleAssays.length}
                          rowIndex={aIdx}
                          onChange={(field, val) => handleAssayChange(aIdx, field, val)}
                          onSelectSuggestion={(item) => handleSelectSuggestedEnsayo(aIdx, item)}
                          onRemove={() => handleRemoveAssay(aIdx)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* BUTTON TO ADD ANOTHER SAMPLE */}
      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            append({
              item_numero: fields.length + 1,
              identificacion_muestra: "",
              procedencia: "",
              cantera: "",
              cantidad: "",
              codigo_muestra_lem: "",
              ensayos_lista: [
                {
                  codigo: "SU24",
                  descripcion: "ANÁLISIS GRANULOMÉTRICO POR TAMIZADO EN SUELOS",
                  norma: "ASTM D6913/D6913M-17",
                },
              ],
            })
          }
          className="w-full py-6 border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 text-primary font-black text-xs uppercase tracking-widest gap-2 rounded-2xl shadow-sm transition-all"
        >
          <Plus className="h-5 w-5 stroke-[2.5]" />
          Agregar Otra Muestra (Muestra N° {fields.length + 1})
        </Button>
      </div>
    </div>
  );
}

interface AssayRowItemProps {
  assay: EnsayoRow;
  totalAssays: number;
  rowIndex: number;
  onChange: (field: keyof EnsayoRow, val: string) => void;
  onSelectSuggestion: (item: EnsayoItem) => void;
  onRemove: () => void;
}

function AssayRowItem({
  assay,
  totalAssays,
  rowIndex,
  onChange,
  onSelectSuggestion,
  onRemove,
}: AssayRowItemProps) {
  // Código state
  const [codigoQuery, setCodigoQuery] = useState(assay.codigo || "");
  const [codigoSuggestions, setCodigoSuggestions] = useState<EnsayoItem[]>([]);
  const [isCodigoOpen, setIsCodigoOpen] = useState(false);
  const codigoRef = useRef<HTMLDivElement>(null);

  // Descripción state
  const [descQuery, setDescQuery] = useState(assay.descripcion || "");
  const [descSuggestions, setDescSuggestions] = useState<EnsayoItem[]>([]);
  const [isDescOpen, setIsDescOpen] = useState(false);
  const descRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCodigoQuery(assay.codigo || "");
  }, [assay.codigo]);

  useEffect(() => {
    setDescQuery(assay.descripcion || "");
  }, [assay.descripcion]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (codigoRef.current && !codigoRef.current.contains(e.target as Node)) {
        setIsCodigoOpen(false);
      }
      if (descRef.current && !descRef.current.contains(e.target as Node)) {
        setIsDescOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Código change
  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setCodigoQuery(val);
    onChange("codigo", val);

    const exact = getEnsayoByCodigo(val);
    if (exact) {
      onSelectSuggestion(exact);
      setCodigoSuggestions([]);
      setIsCodigoOpen(false);
      return;
    }

    if (val.trim().length >= 1) {
      const results = searchEnsayos(val);
      setCodigoSuggestions(results.slice(0, 10));
      setIsCodigoOpen(results.length > 0);
    } else {
      setCodigoSuggestions([]);
      setIsCodigoOpen(false);
    }
  };

  // Handle Descripción change
  const handleDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setDescQuery(val);
    onChange("descripcion", val);

    if (val.trim().length >= 1) {
      const results = searchEnsayos(val);
      setDescSuggestions(results.slice(0, 10));
      setIsDescOpen(results.length > 0);
    } else {
      setDescSuggestions([]);
      setIsDescOpen(false);
    }
  };

  const handleSelectFromCodigo = (item: EnsayoItem) => {
    setCodigoQuery(item.codigo);
    setDescQuery(item.descripcion);
    onSelectSuggestion(item);
    setCodigoSuggestions([]);
    setIsCodigoOpen(false);
  };

  const handleSelectFromDesc = (item: EnsayoItem) => {
    setCodigoQuery(item.codigo);
    setDescQuery(item.descripcion);
    onSelectSuggestion(item);
    setDescSuggestions([]);
    setIsDescOpen(false);
  };

  const rowZIndex = Math.max(1, (totalAssays - rowIndex) * 10);

  return (
    <tr
      className="hover:bg-muted/20 transition-colors relative"
      style={{ zIndex: isCodigoOpen || isDescOpen ? 999 : rowZIndex }}
    >
      {/* CÓDIGO ENSAYO CON AUTOCOMPLETE */}
      <td className="px-3 py-2 align-top relative">
        <div ref={codigoRef} className="relative">
          <Input
            value={codigoQuery}
            onChange={handleCodigoChange}
            onFocus={() => {
              if (codigoQuery.trim().length >= 1) {
                const results = searchEnsayos(codigoQuery);
                setCodigoSuggestions(results.slice(0, 10));
                setIsCodigoOpen(results.length > 0);
              }
            }}
            placeholder="-----"
            className="h-8 font-mono font-bold text-xs uppercase bg-background"
            autoComplete="off"
          />

          {isCodigoOpen && codigoSuggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-84 max-h-60 overflow-y-auto bg-popover text-popover-foreground border-2 border-primary/30 rounded-xl shadow-2xl z-[9999] p-1.5 divide-y divide-border/40">
              {codigoSuggestions.map((item) => (
                <button
                  key={item.codigo}
                  type="button"
                  onClick={() => handleSelectFromCodigo(item)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary rounded-lg transition-colors flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-primary text-[11px]">
                      {item.codigo}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {item.categoria}
                    </span>
                  </div>
                  <span className="font-medium text-[11px] line-clamp-1 text-foreground">
                    {item.descripcion}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    Norma: {item.norma || "-"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* DESCRIPCIÓN CON AUTOCOMPLETE */}
      <td className="px-3 py-2 align-top relative">
        <div ref={descRef} className="relative">
          <Input
            value={descQuery}
            onChange={handleDescChange}
            onFocus={() => {
              if (descQuery.trim().length >= 1) {
                const results = searchEnsayos(descQuery);
                setDescSuggestions(results.slice(0, 10));
                setIsDescOpen(results.length > 0);
              }
            }}
            placeholder="-----"
            className="h-8 text-xs font-semibold uppercase bg-background"
            autoComplete="off"
          />

          {isDescOpen && descSuggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-96 max-h-60 overflow-y-auto bg-popover text-popover-foreground border-2 border-primary/30 rounded-xl shadow-2xl z-[9999] p-1.5 divide-y divide-border/40">
              {descSuggestions.map((item) => (
                <button
                  key={item.codigo}
                  type="button"
                  onClick={() => handleSelectFromDesc(item)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary rounded-lg transition-colors flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-primary text-[11px]">
                      {item.codigo}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {item.categoria}
                    </span>
                  </div>
                  <span className="font-medium text-[11px] line-clamp-1 text-foreground">
                    {item.descripcion}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    Norma: {item.norma || "-"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* NORMA */}
      <td className="px-3 py-2 align-top">
        <Input
          value={assay.norma || ""}
          onChange={(e) => onChange("norma", e.target.value.toUpperCase())}
          placeholder="-----"
          className="h-8 font-mono text-xs uppercase bg-background"
        />
      </td>

      {/* ACCIÓN */}
      <td className="px-2 py-2 text-center align-middle">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Eliminar este ensayo"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
