"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Copy,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { authFetch } from "@/lib/api-auth";
import type { DatosCliente, DatosClienteFormData } from "@/types/datos-clientes";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface DatosClienteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteToEdit?: DatosCliente | null;
  onSaved: () => void;
}

interface ComercialClienteSuggestion {
  id: string;
  nombre: string;
  empresa?: string;
  ruc?: string;
  direccion?: string;
  contacto?: string;
  email?: string;
  telefono?: string;
}

export function DatosClienteDialog({
  open,
  onOpenChange,
  clienteToEdit,
  onSaved,
}: DatosClienteDialogProps) {
  const [saving, setSaving] = useState(false);
  const [comercialSearch, setComercialSearch] = useState("");
  const [suggestions, setSuggestions] = useState<ComercialClienteSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const isSelectingRef = React.useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<DatosClienteFormData>({
    defaultValues: {
      cliente: "",
      ruc: "",
      domicilio_legal: "",
      persona_contacto: "",
      email: "",
      telefono: "",
      solicitante: "",
      domicilio_solicitante: "",
      proyecto: "",
      ubicacion: "",
    },
  });

  const watchCliente = watch("cliente");
  const watchDomicilioLegal = watch("domicilio_legal");

  // Búsqueda en comercial al tipear
  useEffect(() => {
    if (isSelectingRef.current) {
      isSelectingRef.current = false;
      return;
    }
    const q = comercialSearch.trim();
    if (q.length >= 2 && !clienteToEdit) {
      const timer = setTimeout(async () => {
        try {
          const res = await authFetch(`${API_URL}/clientes?search=${encodeURIComponent(q)}`);
          if (res.ok) {
            const data = await res.json();
            setSuggestions(Array.isArray(data.data) ? data.data : []);
            setShowDropdown(true);
          }
        } catch {
          setSuggestions([]);
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, [comercialSearch, clienteToEdit]);

  const handleSelectComercial = (item: ComercialClienteSuggestion) => {
    isSelectingRef.current = true;
    const clientName = item.nombre || item.empresa || "";
    setValue("cliente", clientName, { shouldDirty: true, shouldValidate: true });
    setComercialSearch(clientName);

    if (item.ruc) {
      setValue("ruc", item.ruc, { shouldDirty: true, shouldValidate: true });
    }
    if (item.direccion) {
      setValue("domicilio_legal", item.direccion, { shouldDirty: true, shouldValidate: true });
      setValue("domicilio_solicitante", item.direccion, { shouldDirty: true, shouldValidate: true });
    }
    setValue("solicitante", clientName, { shouldDirty: true, shouldValidate: true });

    if (item.contacto) {
      setValue("persona_contacto", item.contacto, { shouldDirty: true });
    }
    if (item.email) {
      setValue("email", item.email, { shouldDirty: true });
    }
    if (item.telefono) {
      setValue("telefono", item.telefono, { shouldDirty: true });
    }

    setShowDropdown(false);
    toast.success(`Datos de "${clientName}" cargados desde Comercial`, {
      description: "Complete el proyecto y ubicación de la obra.",
    });
  };

  useEffect(() => {
    if (open) {
      if (clienteToEdit) {
        reset({
          cliente: clienteToEdit.cliente || "",
          ruc: clienteToEdit.ruc || "",
          domicilio_legal: clienteToEdit.domicilio_legal || "",
          persona_contacto: clienteToEdit.persona_contacto || "",
          email: clienteToEdit.email || "",
          telefono: clienteToEdit.telefono || "",
          solicitante: clienteToEdit.solicitante || "",
          domicilio_solicitante: clienteToEdit.domicilio_solicitante || "",
          proyecto: clienteToEdit.proyecto || "",
          ubicacion: clienteToEdit.ubicacion || "",
        });
      } else {
        reset({
          cliente: "",
          ruc: "",
          domicilio_legal: "",
          persona_contacto: "",
          email: "",
          telefono: "",
          solicitante: "",
          domicilio_solicitante: "",
          proyecto: "",
          ubicacion: "",
        });
      }
    }
  }, [open, clienteToEdit, reset]);

  const handleCopyClientToSolicitante = () => {
    if (!watchCliente) {
      toast.warning("Ingrese primero el Cliente para copiarlo");
      return;
    }
    setValue("solicitante", watchCliente, { shouldDirty: true });
    if (watchDomicilioLegal) {
      setValue("domicilio_solicitante", watchDomicilioLegal, {
        shouldDirty: true,
      });
    }
    toast.success("Datos copiados al Solicitante");
  };

  const onSubmit = async (data: DatosClienteFormData) => {
    setSaving(true);
    try {
      const isEditing = !!clienteToEdit;
      const url = isEditing
        ? `${API_URL}/api/datos-clientes/${clienteToEdit.id}`
        : `${API_URL}/api/datos-clientes`;
      const method = isEditing ? "PUT" : "POST";

      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.detail || "Error al guardar el registro del cliente"
        );
      }

      const savedItem = await res.json();
      toast.success(
        isEditing
          ? "Registro actualizado con éxito"
          : "Registro creado con éxito",
        {
          description: `Estado asignado: ${savedItem.estado}`,
        }
      );

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error en la operación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-2xl border bg-background shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-muted/40 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight uppercase">
                  {clienteToEdit
                    ? "Editar Datos de Cliente e Informe"
                    : "Nuevo Registro: Datos de Cliente e Informe"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ficha maestra para autocompletado en Recepción y generación de
                  Informes Oficiales.
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* SECCIÓN 1: DATOS CLIENTE */}
          <div className="rounded-xl border border-primary/20 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 bg-primary rounded-full" />
                <h3 className="text-xs font-black uppercase tracking-wider text-primary">
                  DATOS CLIENTE
                </h3>
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                Información Fiscal & Contacto
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cliente con Autocomplete desde Comercial */}
              <div className="md:col-span-2 space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    Cliente (Razón Social) <span className="text-destructive">*</span>
                  </Label>
                  {!clienteToEdit && (
                    <span className="text-[10px] text-primary/80 font-medium flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Autocompleta desde Comercial
                    </span>
                  )}
                </div>
                <Input
                  {...register("cliente", {
                    required: "El nombre o razón social es obligatorio",
                  })}
                  onChange={(e) => {
                    register("cliente").onChange(e);
                    setComercialSearch(e.target.value);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0 && !clienteToEdit) setShowDropdown(true);
                  }}
                  placeholder="Ej. VYV BRAVO S.A.C. (escriba para buscar en Comercial)"
                  autoComplete="off"
                  data-lpignore="true"
                  className={`font-semibold uppercase ${
                    errors.cliente ? "border-destructive" : ""
                  }`}
                />
                {errors.cliente && (
                  <span className="text-[10px] text-destructive font-medium">
                    {errors.cliente.message}
                  </span>
                )}

                {/* Dropdown de sugerencias comerciales */}
                {showDropdown && suggestions.length > 0 && !clienteToEdit && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border-2 border-primary/30 rounded-xl shadow-2xl max-h-60 overflow-y-auto py-1 divide-y divide-border/40">
                    <div className="px-3 py-1 bg-muted/60 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                      Clientes encontrados en Comercial (Clic para autollenar)
                    </div>
                    {suggestions.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectComercial(item)}
                        className="px-3 py-2 hover:bg-primary/10 cursor-pointer transition-colors"
                      >
                        <div className="text-xs font-bold text-primary uppercase">
                          {item.nombre || item.empresa}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground mt-0.5">
                          {item.ruc && <span>RUC: <strong className="font-mono">{item.ruc}</strong></span>}
                          {item.direccion && <span className="truncate max-w-xs">{item.direccion}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* RUC */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  RUC / Doc. <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register("ruc", {
                    required: "El RUC o documento es obligatorio",
                  })}
                  placeholder="Ej. 20549356762"
                  className={`font-mono ${
                    errors.ruc ? "border-destructive" : ""
                  }`}
                />
                {errors.ruc && (
                  <span className="text-[10px] text-destructive font-medium">
                    {errors.ruc.message}
                  </span>
                )}
              </div>

              {/* Domicilio Legal */}
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  Domicilio Legal <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register("domicilio_legal", {
                    required: "El domicilio legal es obligatorio",
                  })}
                  placeholder="Ej. AV. ARAÑON 763, LOS OLIVOS, LIMA"
                  className={`uppercase ${
                    errors.domicilio_legal ? "border-destructive" : ""
                  }`}
                />
                {errors.domicilio_legal && (
                  <span className="text-[10px] text-destructive font-medium">
                    {errors.domicilio_legal.message}
                  </span>
                )}
              </div>

              {/* Persona Contacto */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  Persona Contacto
                </Label>
                <Input
                  {...register("persona_contacto")}
                  placeholder="Ej. IRMA COAQUIRA LAYME"
                  className="uppercase"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  E-MAIL
                </Label>
                <Input
                  type="email"
                  {...register("email")}
                  placeholder="Ej. icoaquira@gmail.com"
                  className="font-mono text-xs"
                />
              </div>

              {/* Teléfono */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                  Teléfono
                </Label>
                <Input
                  {...register("telefono")}
                  placeholder="Ej. 956057624"
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL INFORME */}
          <div className="rounded-xl border border-blue-500/20 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 bg-blue-600 rounded-full" />
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  DATOS DEL INFORME
                </h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyClientToSolicitante}
                className="h-7 text-[11px] font-bold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center gap-1.5"
              >
                <Copy className="w-3 h-3" />
                Copiar de Cliente
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Solicitante */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Solicitante <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register("solicitante", {
                    required: "El solicitante es obligatorio",
                  })}
                  placeholder="Ej. VYV BRAVO"
                  className={`font-semibold uppercase ${
                    errors.solicitante ? "border-destructive" : ""
                  }`}
                />
                {errors.solicitante && (
                  <span className="text-[10px] text-destructive font-medium">
                    {errors.solicitante.message}
                  </span>
                )}
              </div>

              {/* Domicilio Legal Solicitante */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Domicilio Legal (Solicitante){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register("domicilio_solicitante", {
                    required: "El domicilio del solicitante es obligatorio",
                  })}
                  placeholder="Ej. AV. ARAÑON 763, LOS OLIVOS, LIMA"
                  className={`uppercase ${
                    errors.domicilio_solicitante ? "border-destructive" : ""
                  }`}
                />
                {errors.domicilio_solicitante && (
                  <span className="text-[10px] text-destructive font-medium">
                    {errors.domicilio_solicitante.message}
                  </span>
                )}
              </div>

              {/* Proyecto */}
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Proyecto / Obra <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register("proyecto", {
                    required: "El nombre del proyecto es obligatorio",
                  })}
                  placeholder="Ej. CONSTRUCCION DEL PUENTE INAMBARI"
                  className={`font-semibold uppercase ${
                    errors.proyecto ? "border-destructive" : ""
                  }`}
                />
                {errors.proyecto && (
                  <span className="text-[10px] text-destructive font-medium">
                    {errors.proyecto.message}
                  </span>
                )}
              </div>

              {/* Ubicación */}
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  Ubicación del Proyecto / Obra{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  {...register("ubicacion", {
                    required: "La ubicación del proyecto es obligatoria",
                  })}
                  placeholder="Ej. AV. LAS PALMERAS, CUSCO, CUSCO"
                  className={`uppercase ${
                    errors.ubicacion ? "border-destructive" : ""
                  }`}
                />
                {errors.ubicacion && (
                  <span className="text-[10px] text-destructive font-medium">
                    {errors.ubicacion.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="rounded-xl px-5"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl px-6 font-bold shadow-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {clienteToEdit ? "Guardar Cambios" : "Crear Registro"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
