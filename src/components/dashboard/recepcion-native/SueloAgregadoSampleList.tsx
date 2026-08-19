"use client";

import React, { useState, useEffect, useRef } from "react";
import { UseFormReturn, useFieldArray } from "react-hook-form";
import { FormInput, FormOutput } from "@/lib/recepcion-validators";
import { ensayosData, searchEnsayos, getEnsayoByCodigo, type EnsayoItem } from "@/data/ensayos-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Copy, Sparkles, Search, Check, Layers } from "lucide-react";

interface SueloAgregadoSampleListProps {
  form: UseFormReturn<FormInput, unknown, FormOutput>;
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
  onCloneSample,
  onRequestDeleteSample,
}: SueloAgregadoSampleListProps) {
  const { control, register, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "muestras",
  });

  const muestrasValues = watch("muestras") || [];

  return (
    <div className="space-y-6">
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
            className="rounded-2xl border-2 border-border/80 bg-card overflow-hidden shadow-sm hover:shadow-md transition-all"
          >
            {/* CARD HEADER */}
            <div className="bg-muted/40 px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3">
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
                    placeholder="1500-SU-26"
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
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">1.</span> MUESTRA:
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.identificacion_muestra`)}
                    placeholder="M-01 C-01 (0.00 - 1.50 M)"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">2.</span> PROCEDENCIA:
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.procedencia`)}
                    placeholder="CALICATA 01"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">3.</span> CANTERA:
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.cantera`)}
                    placeholder="CANTERA CENTRAL"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/80 flex items-center gap-1">
                    <span className="text-primary font-bold">4.</span> CANTIDAD (KG):
                  </Label>
                  <Input
                    {...register(`muestras.${sIdx}.cantidad`)}
                    placeholder="50 KG"
                    className="font-bold text-xs uppercase bg-background"
                  />
                </div>
              </div>

              {/* SUBSECTION: ENSAYOS REQUERIDOS (VINCULACIÓN CON COTIZADORA) */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <h5 className="text-[11px] font-black uppercase tracking-wider text-foreground/90">
                      Ensayos Requeridos para Muestra #{sIdx + 1}
                    </h5>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      (Autocompletado con catálogo de cotizaciones)
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
                <div className="border rounded-lg overflow-hidden bg-background">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/50 border-b text-[9px] uppercase font-black tracking-widest text-muted-foreground">
                        <th className="px-3 py-2 w-36">Cód. Ensayo</th>
                        <th className="px-3 py-2">Ensayos requeridos (Descripción)</th>
                        <th className="px-3 py-2 w-48">Norma</th>
                        <th className="px-2 py-2 w-12 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {sampleAssays.map((assay, aIdx) => (
                        <AssayRowItem
                          key={aIdx}
                          assay={assay}
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
  onChange: (field: keyof EnsayoRow, val: string) => void;
  onSelectSuggestion: (item: EnsayoItem) => void;
  onRemove: () => void;
}

function AssayRowItem({ assay, onChange, onSelectSuggestion, onRemove }: AssayRowItemProps) {
  const [query, setQuery] = useState(assay.codigo || "");
  const [suggestions, setSuggestions] = useState<EnsayoItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(assay.codigo || "");
  }, [assay.codigo]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setQuery(val);
    onChange("codigo", val);

    // Direct exact match
    const exact = getEnsayoByCodigo(val);
    if (exact) {
      onSelectSuggestion(exact);
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    if (val.length >= 2) {
      const results = searchEnsayos(val);
      setSuggestions(results.slice(0, 8));
      setIsOpen(results.length > 0);
    } else {
      setSuggestions([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (item: EnsayoItem) => {
    setQuery(item.codigo);
    onSelectSuggestion(item);
    setSuggestions([]);
    setIsOpen(false);
  };

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      {/* CÓDIGO ENSAYO CON AUTOCOMPLETE */}
      <td className="px-3 py-2 align-top">
        <div ref={containerRef} className="relative">
          <Input
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.length >= 2) {
                const results = searchEnsayos(query);
                setSuggestions(results.slice(0, 8));
                setIsOpen(results.length > 0);
              }
            }}
            placeholder="SU24"
            className="h-8 font-mono font-bold text-xs uppercase"
            autoComplete="off"
          />

          {isOpen && suggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1 w-80 max-h-56 overflow-y-auto bg-popover text-popover-foreground border rounded-xl shadow-xl z-50 p-1 divide-y divide-border/40">
              {suggestions.map((item) => (
                <button
                  key={item.codigo}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-primary text-[11px]">
                      {item.codigo}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {item.categoria}
                    </span>
                  </div>
                  <span className="font-medium text-[11px] line-clamp-1">
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

      {/* DESCRIPCIÓN */}
      <td className="px-3 py-2 align-top">
        <Input
          value={assay.descripcion || ""}
          onChange={(e) => onChange("descripcion", e.target.value.toUpperCase())}
          placeholder="ANÁLISIS GRANULOMÉTRICO POR TAMIZADO EN SUELOS"
          className="h-8 text-xs font-semibold uppercase"
        />
      </td>

      {/* NORMA */}
      <td className="px-3 py-2 align-top">
        <Input
          value={assay.norma || ""}
          onChange={(e) => onChange("norma", e.target.value.toUpperCase())}
          placeholder="ASTM D6913"
          className="h-8 font-mono text-xs uppercase"
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
