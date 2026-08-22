"use client";

import React from "react";
import { Sparkles, Copy, Check, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { type EmailProfileOption } from "./email-profiles";

interface EmailSpeechEditorProps {
  subject: string;
  setSubject: (val: string) => void;
  speechText: string;
  setSpeechText: (val: string) => void;
  copied: boolean;
  onCopySpeech: () => void;
  activeProfile: EmailProfileOption;
  recepcionNumero: string;
  clienteNombre: string;
}

export function EmailSpeechEditor({
  subject,
  setSubject,
  speechText,
  setSpeechText,
  copied,
  onCopySpeech,
  activeProfile,
  recepcionNumero,
  clienteNombre,
}: EmailSpeechEditorProps) {
  return (
    <div className="space-y-3">
      {/* Asunto */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground block">
          Asunto del Correo:
        </label>
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="text-xs font-semibold h-9"
          placeholder="Asunto del correo institucional..."
        />
      </div>

      {/* Cuerpo del Mensaje */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            Cuerpo del Mensaje (Speech Formal):
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCopySpeech}
            className="h-6 text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 gap-1 px-2"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copiar Texto
              </>
            )}
          </Button>
        </div>
        <Textarea
          rows={7}
          value={speechText}
          onChange={(e) => setSpeechText(e.target.value)}
          className="text-xs leading-relaxed font-sans resize-y bg-muted/10"
          placeholder="Escriba aquí el cuerpo del correo..."
        />
      </div>

      {/* Adjuntos y Firma Preview */}
      <div className="p-3 rounded-lg border bg-muted/20 space-y-2.5 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Archivo Adjunto Automático:
          </span>
          <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            REC N° {recepcionNumero} {clienteNombre}.xlsx
          </span>
        </div>

        {/* Firma Institucional y Vista Previa */}
        <div className="flex flex-col gap-2 pt-2 border-t">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              Firma Institucional:
            </span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {activeProfile.cargo} ({activeProfile.from_name})
              </span>
              {activeProfile.signature_image_url ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-300">
                  PNG Oficial
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-300">
                  None
                </span>
              )}
            </div>
          </div>

          {/* Vista previa gráfica de la firma */}
          {activeProfile.signature_image_url ? (
            <div className="mt-1 p-2 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col gap-1.5 shadow-2xs">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                <span>Vista previa de imagen de firma:</span>
                <span className="text-emerald-600 font-mono text-[10px]">FirmaCoordinadoraLabBetzabethSaravia.png</span>
              </div>
              <img
                src={activeProfile.signature_image_url}
                alt={`Firma ${activeProfile.from_name}`}
                className="max-h-20 w-auto object-contain rounded"
              />
            </div>
          ) : (
            <div className="mt-1 p-2 rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-semibold">Vista previa de imagen de firma:</span>
              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300">
                None (Sin imagen gráfica)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
