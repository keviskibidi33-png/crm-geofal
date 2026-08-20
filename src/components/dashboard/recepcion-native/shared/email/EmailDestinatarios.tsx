"use client";

import React from "react";
import { Loader2, AlertTriangle, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface EmailDestinatariosProps {
  toEmail: string;
  setToEmail: (val: string) => void;
  hasValidEmail: boolean;
  isLoadingDetails: boolean;
  ccList: string[];
  newCcInput: string;
  setNewCcInput: (val: string) => void;
  handleAddCc: () => void;
  handleRemoveCc: (email: string) => void;
}

export function EmailDestinatarios({
  toEmail,
  setToEmail,
  hasValidEmail,
  isLoadingDetails,
  ccList,
  newCcInput,
  setNewCcInput,
  handleAddCc,
  handleRemoveCc,
}: EmailDestinatariosProps) {
  return (
    <div className="space-y-3">
      {/* Destinatario Principal (Para) */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-foreground flex items-center gap-1">
            Para (Correo del Cliente):
            <span className="text-destructive">*</span>
          </label>
          {isLoadingDetails ? (
            <span className="text-[10px] text-blue-600 flex items-center gap-1 animate-pulse">
              <Loader2 className="h-3 w-3 animate-spin" /> Buscando correo en base de datos...
            </span>
          ) : !toEmail.trim() ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Ingrese el correo del cliente para enviar
            </span>
          ) : (
            <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
              <Check className="h-3 w-3" /> Correo cargado
            </span>
          )}
        </div>
        <Input
          placeholder="ejemplo: contacto@cliente.com; supervisor@cliente.com"
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          className={`text-xs h-9 ${
            !hasValidEmail ? "border-amber-300 dark:border-amber-700 bg-amber-50/20" : ""
          }`}
        />
        <span className="text-[10px] text-muted-foreground">
          Puedes ingresar múltiples correos separados por punto y coma (;) o comas (,).
        </span>
      </div>

      {/* Con Copia (CC) */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-foreground block">
          Con Copia (CC):
        </label>
        <div className="p-2 rounded-lg border bg-muted/20 min-h-10 flex flex-wrap items-center gap-1.5">
          {ccList.map((ccEmail) => (
            <Badge
              key={ccEmail}
              variant="secondary"
              className="text-xs font-mono font-medium py-1 px-2 gap-1 bg-background border shadow-2xs"
            >
              {ccEmail}
              <button
                type="button"
                onClick={() => handleRemoveCc(ccEmail)}
                className="hover:text-destructive transition-colors ml-0.5"
                title="Remover copia"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <div className="flex-1 min-w-[200px] flex items-center gap-1">
            <input
              type="email"
              placeholder="Agregar otro correo y presione Enter..."
              value={newCcInput}
              onChange={(e) => setNewCcInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  handleAddCc();
                }
              }}
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none px-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
