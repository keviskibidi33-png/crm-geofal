"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type { DatosCliente } from "@/types/datos-clientes";

interface DatosClienteDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: DatosCliente | null;
  onEdit?: (cliente: DatosCliente) => void;
}

export function DatosClienteDetailDialog({
  open,
  onOpenChange,
  cliente,
  onEdit,
}: DatosClienteDetailDialogProps) {
  if (!cliente) return null;

  const isCompleto = cliente.estado === "COMPLETO";

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-2xl border bg-background shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/40 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-muted-foreground">
                    #{cliente.id}
                  </span>
                  <DialogTitle className="text-lg font-black tracking-tight uppercase">
                    {cliente.cliente}
                  </DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  RUC: {cliente.ruc || "Sin RUC"} • {cliente.proyecto}
                </p>
              </div>
            </div>

            <Badge
              variant="outline"
              className={`px-3 py-1 text-xs font-black uppercase rounded-full flex items-center gap-1.5 ${
                isCompleto
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              {isCompleto ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  COMPLETO
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  INCOMPLETO
                </>
              )}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* SECCIÓN 1: DATOS CLIENTE */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <span className="h-4 w-1 bg-primary rounded-full" />
              <h3 className="text-xs font-black uppercase tracking-wider text-primary">
                DATOS CLIENTE
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Razón Social / Cliente:
                </span>
                <p className="font-semibold text-foreground">{cliente.cliente}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <FileText className="w-3 h-3" /> RUC:
                </span>
                <p className="font-mono font-semibold text-foreground">
                  {cliente.ruc || "-"}
                </p>
              </div>

              <div className="md:col-span-2 space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Domicilio Legal:
                </span>
                <p className="font-medium text-foreground">
                  {cliente.domicilio_legal || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <User className="w-3 h-3" /> Persona de Contacto:
                </span>
                <p className="font-semibold text-foreground">
                  {cliente.persona_contacto || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Mail className="w-3 h-3" /> E-MAIL:
                </span>
                <p className="font-mono text-foreground">{cliente.email || "-"}</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Teléfono:
                </span>
                <p className="font-mono font-semibold text-foreground">
                  {cliente.telefono || "-"}
                </p>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL INFORME */}
          <div className="rounded-xl border border-blue-500/20 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <span className="h-4 w-1 bg-blue-600 rounded-full" />
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                DATOS DEL INFORME
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-blue-600" /> Solicitante:
                </span>
                <p className="font-semibold text-foreground">
                  {cliente.solicitante || "-"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-600" /> Domicilio Legal
                  (Solicitante):
                </span>
                <p className="font-medium text-foreground">
                  {cliente.domicilio_solicitante || "-"}
                </p>
              </div>

              <div className="md:col-span-2 space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <FileText className="w-3 h-3 text-blue-600" /> Proyecto / Obra:
                </span>
                <p className="font-semibold text-foreground">
                  {cliente.proyecto || "-"}
                </p>
              </div>

              <div className="md:col-span-2 space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-600" /> Ubicación:
                </span>
                <p className="font-medium text-foreground">
                  {cliente.ubicacion || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(JSON.stringify(cliente, null, 2), "JSON")}
            className="text-xs rounded-xl gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar Ficha
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs"
            >
              Cerrar
            </Button>
            {onEdit && (
              <Button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(cliente);
                }}
                className="rounded-xl text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar Registro
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
