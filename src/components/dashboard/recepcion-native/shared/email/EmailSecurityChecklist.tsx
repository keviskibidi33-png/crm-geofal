"use client";

import React from "react";
import { Check, AlertCircle, AlertTriangle } from "lucide-react";

interface EmailSecurityChecklistProps {
  hasCliente: boolean;
  hasNumeroRecepcion: boolean;
  hasValidEmail: boolean;
  hasSpeech: boolean;
  isSecurityPassed: boolean;
}

export function EmailSecurityChecklist({
  hasCliente,
  hasNumeroRecepcion,
  hasValidEmail,
  hasSpeech,
  isSecurityPassed,
}: EmailSecurityChecklistProps) {
  return (
    <div
      className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 transition-colors ${
        isSecurityPassed
          ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-900 dark:text-green-200"
          : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
      }`}
    >
      <div className="flex items-center justify-between font-bold">
        <span className="flex items-center gap-1.5">
          {isSecurityPassed ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          )}
          Protocolo de Validación Previa:
        </span>
        <span className="text-[10px] uppercase tracking-wider font-extrabold">
          {isSecurityPassed ? "Listo para Enviar" : "Verificaciones Pendientes"}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
        <span
          className={`flex items-center gap-1 ${
            hasCliente ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {hasCliente ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          Cliente válido
        </span>
        <span
          className={`flex items-center gap-1 ${
            hasNumeroRecepcion
              ? "text-green-700 dark:text-green-400"
              : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {hasNumeroRecepcion ? (
            <Check className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          N° Recepción
        </span>
        <span
          className={`flex items-center gap-1 ${
            hasValidEmail
              ? "text-green-700 dark:text-green-400"
              : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {hasValidEmail ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          Email destinatario
        </span>
        <span
          className={`flex items-center gap-1 ${
            hasSpeech ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"
          }`}
        >
          {hasSpeech ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          Mensaje completo
        </span>
      </div>
    </div>
  );
}
