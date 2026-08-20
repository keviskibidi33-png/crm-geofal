"use client";

import React, { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Trash2, X, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/api-auth";
import {
  formSchema,
  type FormOutput,
  type FormInput,
  normalizeImportedText,
  normalizeRucValue,
  normalizeImportedDate,
  normalizeLemCode,
  sanitizeImportedMuestras,
  incrementString,
  extractLeadingNumber,
  getFormattedDate,
  getFieldPathFromBackendIssue,
  getBackendIssueMessage,
  getFirstClientErrorPath,
} from "@/lib/recepcion-validators";
import { useFormPersist } from "@/hooks/use-form-persist";
import { useEnterTableNavigation } from "@/hooks/use-enter-table-navigation";
import { TIPO_RECEPCION_CONFIG } from "@/types/recepcion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// Subcomponentes modulares organizados por carpetas
import { OrdenFormHeader } from "./shared/OrdenFormHeader";
import { ConcretoSampleTable } from "./recepcion-probetas/ConcretoSampleTable";
import { SueloAgregadoSampleList } from "./recepcion-suelo-agregado/SueloAgregadoSampleList";
import { FacturacionSection, type ClienteItem } from "./shared/FacturacionSection";
import { InformeSection } from "./shared/InformeSection";
import { FechasEmisionSection } from "./shared/FechasEmisionSection";
import { LogisticaSection } from "./shared/LogisticaSection";
import { ObservacionesSection } from "./shared/ObservacionesSection";
import { SavePlantillaModal } from "./shared/SavePlantillaModal";
import { OrdenConfirmDialogs } from "./shared/OrdenConfirmDialogs";

// Custom Hooks
import { useClienteSearch } from "./shared/hooks/useClienteSearch";
import { useAutoFillCotizacion } from "./shared/hooks/useAutoFillCotizacion";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface OrdenFormProps {
  mode: "create" | "edit";
  editId?: number;
  importedData?: Record<string, unknown> | null;
  defaultTipo?: string;
  allowedTipos?: string[];
  onClose: (reason?: "created" | "updated") => void;
}

export function OrdenForm({
  mode,
  editId,
  importedData,
  defaultTipo,
  allowedTipos,
  onClose,
}: OrdenFormProps) {
  const isEditMode = mode === "edit";
  const id = editId;
  const queryClient = useQueryClient();
  const handleItemsTableKeyDown = useEnterTableNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de Modales
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sampleDeleteIndex, setSampleDeleteIndex] = useState<number | null>(null);
  const [isSavePlantillaOpen, setIsSavePlantillaOpen] = useState(false);

  const [recepcionStatus, setRecepcionStatus] = useState<{
    estado: "idle" | "buscando" | "disponible" | "ocupado";
    mensaje?: string;
    formatos?: { recepcion: boolean; verificacion: boolean; compresion: boolean };
  }>({ estado: "idle" });

  const initialTipo = defaultTipo || (allowedTipos && allowedTipos[0]) || "CONCRETO";
  const initialCfg = TIPO_RECEPCION_CONFIG[initialTipo] || TIPO_RECEPCION_CONFIG["CONCRETO"];

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numero_ot: "",
      numero_recepcion: "",
      numero_cotizacion: "",
      tipo_recepcion: initialTipo,
      codigo_laboratorio: initialCfg.codigo,
      version: initialCfg.version,
      cliente: "",
      domicilio_legal: "",
      ruc: "",
      persona_contacto: "",
      email: "",
      telefono: "",
      solicitante: "",
      domicilio_solicitante: "",
      proyecto: "",
      ubicacion: "",
      fecha_recepcion: "",
      fecha_estimada_culminacion: "",
      emision_fisica: false,
      emision_digital: true,
      entregado_por: "",
      recibido_por: "",
      observaciones: "",
      muestras: [
        {
          item_numero: 1,
          identificacion_muestra: "",
          estructura: "",
          fc_kg_cm2: "",
          edad: "",
          requiere_densidad: false,
          fecha_moldeo: "",
          hora_moldeo: "",
          fecha_rotura: "",
          codigo_muestra_lem: "",
        },
      ],
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    getValues,
    setError,
    clearErrors,
    setFocus,
  } = form;

  const { fields, append, replace } = useFieldArray({
    control: form.control,
    name: "muestras",
  });

  const activeTipo = watch("tipo_recepcion") || "CONCRETO";

  // Hook de Búsqueda de Clientes con tipado estricto
  const {
    setClienteSearch,
    clientes,
    selectCliente,
  } = useClienteSearch();

  const syncEntregadoPorFromContacto = (
    contacto: unknown,
    options?: { force?: boolean }
  ) => {
    const normalizedContacto = normalizeImportedText(contacto).toUpperCase();
    const currentEntregado = normalizeImportedText(getValues("entregado_por"));
    if (options?.force || !currentEntregado) {
      setValue("entregado_por", normalizedContacto, { shouldValidate: true });
    }
  };

  // Hook de Autocompletado desde Cotización o Control de Laboratorio
  const { handleAutoFillFromCotizacion } = useAutoFillCotizacion({
    form,
    replace,
    selectCliente,
    syncEntregadoPorFromContacto,
    initialTipo,
  });

  // Helpers de foco y errores
  const focusFieldByPath = (fieldPath: string) => {
    try {
      setFocus(fieldPath);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      const field = document.getElementsByName(fieldPath)[0] as HTMLElement | undefined;
      if (!field) return;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      if ("focus" in field && typeof field.focus === "function") {
        field.focus();
      }
    });
  };

  const applyBackendValidationErrors = (
    issues: { loc?: Array<string | number>; msg?: string; type?: string; ctx?: Record<string, unknown> }[]
  ) => {
    const fieldIssues = issues
      .map((issue) => ({
        path: getFieldPathFromBackendIssue(issue),
        message: getBackendIssueMessage(issue),
      }))
      .filter((issue): issue is { path: string; message: string } => Boolean(issue.path));

    if (fieldIssues.length === 0) return false;

    fieldIssues.forEach(({ path, message }) => {
      setError(path, { type: "server", message });
    });

    const firstIssue = fieldIssues[0];
    focusFieldByPath(firstIssue.path);
    toast.error(`Revisa el campo resaltado: ${firstIssue.message}`);
    return true;
  };

  const defaultValues: FormInput = {
    numero_ot: "",
    numero_recepcion: "",
    numero_cotizacion: "",
    cliente: "",
    domicilio_legal: "",
    ruc: "",
    persona_contacto: "",
    email: "",
    telefono: "",
    solicitante: "",
    domicilio_solicitante: "",
    proyecto: "",
    ubicacion: "",
    fecha_recepcion: "",
    fecha_estimada_culminacion: "",
    emision_fisica: false,
    emision_digital: true,
    entregado_por: "",
    recibido_por: "",
    observaciones: "",
    muestras: [
      {
        identificacion_muestra: "",
        estructura: "",
        fc_kg_cm2: "",
        edad: "",
        requiere_densidad: "",
        fecha_moldeo: "",
        hora_moldeo: "",
        fecha_rotura: "",
        codigo_muestra_lem: "",
      },
    ],
  };

  const { clearSavedData } = useFormPersist(
    `recepcion-form-${id || "new"}`,
    form,
    !id
  );

  // Carga de orden en modo edición
  const { data: existingOrden, isLoading: isLoadingOrden } = useQuery({
    queryKey: ["recepcion-detail", id],
    queryFn: async () => {
      const res = await authFetch(`${API_URL}/api/recepcion/${id}`);
      if (!res.ok) throw new Error("Error cargando recepción");
      return res.json();
    },
    enabled: isEditMode,
  });

  useEffect(() => {
    if (existingOrden) {
      reset(existingOrden);
      if (Array.isArray(existingOrden.muestras) && existingOrden.muestras.length > 0) {
        const formatted = existingOrden.muestras.map((m: any, idx: number) => {
          let ensayosLista = m.ensayos_lista;
          if (!ensayosLista && m.ensayos_json && typeof m.ensayos_json === "string") {
            try {
              const parsed = JSON.parse(m.ensayos_json);
              if (Array.isArray(parsed) && parsed.length > 0) ensayosLista = parsed;
            } catch {}
          }
          if (!ensayosLista && (m.codigo_ensayo || m.ensayos_requeridos || m.norma_requerida)) {
            ensayosLista = [
              {
                codigo: m.codigo_ensayo || "",
                descripcion: m.ensayos_requeridos || "",
                norma: m.norma_requerida || "",
              },
            ];
          }
          return {
            ...m,
            item_numero: m.item_numero || idx + 1,
            identificacion_muestra: m.identificacion_muestra || "",
            procedencia: m.procedencia || "",
            cantera: m.cantera || "",
            cantidad: m.cantidad || "",
            codigo_ensayo: m.codigo_ensayo || "",
            ensayos_requeridos: m.ensayos_requeridos || "",
            norma_requerida: m.norma_requerida || "",
            ensayos_lista: ensayosLista || [],
            fecha_moldeo: m.fecha_moldeo ? normalizeImportedDate(m.fecha_moldeo) : "",
            fecha_rotura: m.fecha_rotura ? normalizeImportedDate(m.fecha_rotura) : "",
          };
        });
        replace(formatted as any);
      }
      if (existingOrden.cliente) {
        selectCliente(existingOrden.cliente);
      }
    }
  }, [existingOrden, reset, replace]);

  // Carga de datos importados
  useEffect(() => {
    if (importedData && !isEditMode) {
      const d = importedData;
      if (d.tipo_recepcion) setValue("tipo_recepcion", String(d.tipo_recepcion).toUpperCase() as any);
      if (d.numero_recepcion !== undefined) setValue("numero_recepcion", normalizeImportedText(d.numero_recepcion).toUpperCase());
      if (d.numero_cotizacion !== undefined) setValue("numero_cotizacion", normalizeImportedText(d.numero_cotizacion).toUpperCase());
      if (d.numero_ot !== undefined) setValue("numero_ot", normalizeImportedText(d.numero_ot).toUpperCase());
      if (d.cliente) setValue("cliente", normalizeImportedText(d.cliente));
      if (d.ruc) setValue("ruc", normalizeRucValue(d.ruc));
      if (d.persona_contacto) {
        const pc = normalizeImportedText(d.persona_contacto);
        setValue("persona_contacto", pc);
        syncEntregadoPorFromContacto(pc);
      }
      if (d.telefono) setValue("telefono", normalizeImportedText(d.telefono));
      if (d.email) setValue("email", normalizeImportedText(d.email));
      if (d.proyecto) setValue("proyecto", normalizeImportedText(d.proyecto));
      if (d.ubicacion) setValue("ubicacion", normalizeImportedText(d.ubicacion));
      if (d.solicitante) setValue("solicitante", normalizeImportedText(d.solicitante));
      if (d.domicilio_solicitante)
        setValue("domicilio_solicitante", normalizeImportedText(d.domicilio_solicitante));
      if (d.domicilio_legal)
        setValue("domicilio_legal", normalizeImportedText((d.domicilio_legal || d.ubicacion || "") as string));
      if (d.fecha_recepcion) setValue("fecha_recepcion", normalizeImportedDate(d.fecha_recepcion));
      if (d.fecha_estimada_culminacion)
        setValue("fecha_estimada_culminacion", normalizeImportedDate(d.fecha_estimada_culminacion));
      if (Array.isArray(d.muestras) && d.muestras.length > 0) {
        replace(sanitizeImportedMuestras(d.muestras as Array<Record<string, unknown>>));
      }
      toast.success(`Datos importados: ${Array.isArray(d.muestras) ? d.muestras.length : 0} muestras cargadas`);
    }
  }, [importedData, isEditMode, setValue, replace]);

  // Manejo de borrador y muestras
  const handleConfirmDelete = () => {
    clearSavedData();
    setRecepcionStatus({ estado: "idle" });
    setClienteSearch("");
    reset(defaultValues);
    toast.success("Borrador eliminado y formulario reiniciado");
    setIsDeleteModalOpen(false);
  };

  const handleRequestSampleDelete = (index: number) => {
    setSampleDeleteIndex(index);
  };

  const handleConfirmSampleDelete = () => {
    if (sampleDeleteIndex === null) return;
    const currentMuestras = getValues("muestras") || [];
    const filtered = currentMuestras.filter((_: any, idx: number) => idx !== sampleDeleteIndex);
    const reindexed = filtered.map((m: any, idx: number) => ({
      ...m,
      item_numero: idx + 1,
    }));
    replace(reindexed);
    setValue("muestras", reindexed as any, { shouldValidate: true, shouldDirty: true });
    setSampleDeleteIndex(null);
    toast.success("Muestra eliminada del formulario");
  };

  const handleSelectCliente = (c: ClienteItem) => {
    const fallback = (v: unknown) => (v && String(v).trim()) || "";
    setValue("cliente", fallback(c.nombre || c.cliente), { shouldValidate: true });
    setValue("ruc", normalizeRucValue(c.ruc), { shouldValidate: true });
    setValue("domicilio_legal", fallback(c.direccion || c.domicilio_legal), { shouldValidate: true });
    setValue("persona_contacto", normalizeImportedText(c.contacto || c.persona_contacto), {
      shouldValidate: true,
    });
    setValue("email", normalizeImportedText(c.email), { shouldValidate: true });
    setValue("telefono", normalizeImportedText(c.telefono), {
      shouldValidate: true,
    });
    setValue("solicitante", fallback(c.solicitante || c.nombre || c.cliente), { shouldValidate: true });
    setValue(
      "domicilio_solicitante",
      fallback(c.domicilio_solicitante || c.direccion || c.domicilio_legal),
      { shouldValidate: true }
    );
    if (c.proyecto) {
      setValue("proyecto", fallback(c.proyecto), { shouldValidate: true });
    }
    if (c.ubicacion) {
      setValue("ubicacion", fallback(c.ubicacion), { shouldValidate: true });
    }
    syncEntregadoPorFromContacto(c.contacto || c.persona_contacto, { force: true });
    toast.success(`Cliente ${c.nombre || c.cliente} seleccionado y datos completados`);
  };

  // Clonado inteligente de muestras
  const handleClone = (index: number) => {
    const currentMuestras = watch("muestras");
    const itemToClone = currentMuestras[index];
    if (!itemToClone) return;

    const existingCodes = new Set(
      currentMuestras
        .map((m: any) => m.codigo_muestra_lem?.trim().toUpperCase())
        .filter((code: any): code is string => Boolean(code))
    );

    let lastLem = itemToClone.codigo_muestra_lem?.trim() || "";
    for (const m of currentMuestras) {
      const candidate = m.codigo_muestra_lem?.trim();
      if (!candidate) continue;
      const candidateNum = extractLeadingNumber(candidate);
      const lastNum = extractLeadingNumber(lastLem);
      if (!Number.isNaN(candidateNum) && (Number.isNaN(lastNum) || candidateNum > lastNum)) {
        lastLem = candidate;
      }
    }

    const isPlaceholderCode = lastLem.trim() === "-";
    let nextLem = isPlaceholderCode ? "-" : incrementString(lastLem);
    while (!isPlaceholderCode && nextLem && existingCodes.has(nextLem.trim().toUpperCase())) {
      nextLem = incrementString(nextLem);
    }

    const cloneData = { ...(itemToClone as Record<string, unknown>) };
    delete (cloneData as Record<string, unknown>).id;

    const isYmd = (v: unknown) =>
      typeof v === "string" && /^\d{4}\/\d{2}\/\d{2}$/.test(v.trim());
    const isHms = (v: unknown) =>
      typeof v === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(v.trim());

    const newItem = {
      ...cloneData,
      item_numero: (currentMuestras.length || 0) + 1,
      codigo_muestra_lem: nextLem,
      fecha_moldeo: isYmd(cloneData.fecha_moldeo) ? (cloneData.fecha_moldeo as string).trim() : "",
      fecha_rotura: isYmd(cloneData.fecha_rotura) ? (cloneData.fecha_rotura as string).trim() : "",
      hora_moldeo: isHms(cloneData.hora_moldeo) ? (cloneData.hora_moldeo as string).trim() : "",
    };

    append(newItem);
    toast.success(`Muestra duplicada (${currentMuestras.length + 1} total)`, {
      id: "clone-toast",
    });
  };

  // Cálculo automático de fecha de rotura según fecha de moldeo + edad
  const muestrasValues = watch("muestras");
  const serializedMuestras = JSON.stringify(muestrasValues);
  useEffect(() => {
    if (muestrasValues) {
      muestrasValues.forEach((muestra: any, index: number) => {
        const { fecha_moldeo, edad, fecha_rotura } = muestra;

        if (fecha_moldeo && edad && /^\d{4}\/\d{2}\/\d{2}$/.test(fecha_moldeo)) {
          try {
            const [year, month, day] = fecha_moldeo.split("/").map(Number);
            const date = new Date(year, month - 1, day);
            date.setDate(date.getDate() + Number(edad));
            if (!isNaN(date.getTime())) {
              const calculatedRotura = getFormattedDate(date);
              if (fecha_rotura !== calculatedRotura) {
                setValue(`muestras.${index}.fecha_rotura`, calculatedRotura);
              }
            }
          } catch {
            /* ignore */
          }
        }
      });
    }
  }, [serializedMuestras, setValue]);

  // Formato inteligente de fechas
  const handleSmartDate = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    name: string
  ) => {
    const val = e.target.value.trim();
    if (!val) return;

    if (val.includes("/")) {
      const parts = val.split("/");
      if (parts.length >= 2) {
        const currentYear = new Date().getFullYear().toString();
        let y = "",
          m = "",
          d = "";

        if (parts[0].trim().length === 4) {
          y = parts[0].trim();
          m = parts[1].trim().padStart(2, "0");
          d = (parts[2] || "").trim().padStart(2, "0");
        } else {
          d = parts[0].trim().padStart(2, "0");
          m = parts[1].trim().padStart(2, "0");
          y = (parts[2] || "").trim();
          if (!y) y = currentYear;
          if (y.length === 2) y = `20${y}`;
        }

        if (d.length === 2 && m.length === 2 && y.length === 4) {
          setValue(name, `${y}/${m}/${d}`, { shouldValidate: true });
          return;
        }
      }
    }

    const digits = val.replace(/\D/g, "");
    const currentYear = new Date().getFullYear().toString();
    let finalDate = "";

    if (digits.length === 2) {
      const d = digits.slice(0, 1).padStart(2, "0");
      const m = digits.slice(1).padStart(2, "0");
      finalDate = `${currentYear}/${m}/${d}`;
    } else if (digits.length === 3) {
      const d = digits.slice(0, 1).padStart(2, "0");
      const m = digits.slice(1);
      finalDate = `${currentYear}/${m}/${d}`;
    } else if (digits.length === 5) {
      const d = digits.slice(0, 1).padStart(2, "0");
      const m = digits.slice(1, 3);
      const y = digits.slice(3);
      finalDate = `20${y}/${m}/${d}`;
    } else if (digits.length === 4) {
      const m = digits.slice(0, 2);
      const d = digits.slice(2);
      finalDate = `${currentYear}/${m}/${d}`;
    } else if (digits.length === 6) {
      const firstFour = Number(digits.slice(0, 4));
      if (firstFour >= 1900 && firstFour <= 2100) {
        const y = digits.slice(0, 4);
        const m = digits.slice(4, 6);
        finalDate = `${y}/${m}/01`;
      } else {
        const d = digits.slice(0, 2);
        const m = digits.slice(2, 4);
        const y = digits.slice(4);
        finalDate = `20${y}/${m}/${d}`;
      }
    } else if (digits.length === 8) {
      const y = digits.slice(0, 4);
      const m = digits.slice(4, 6);
      const d = digits.slice(6, 8);
      if (Number(y) > 1900) finalDate = `${y}/${m}/${d}`;
      else {
        const dd = digits.slice(0, 2);
        const mm = digits.slice(2, 4);
        const yyyy = digits.slice(4);
        finalDate = `${yyyy}/${mm}/${dd}`;
      }
    }

    if (finalDate) {
      setValue(name, finalDate, { shouldValidate: true });
    }
  };

  // Verificación de disponibilidad de número de recepción
  const buscarEstadoRecepcion = async (numero: string) => {
    if (!numero || numero.length < 3) return;
    setRecepcionStatus({ estado: "buscando" });

    const currentTipo = getValues("tipo_recepcion") || initialTipo;
    const moduloNombre = currentTipo === "CONCRETO" ? "Recepción Probetas" : "Recepción Muestras";

    try {
      const res = await authFetch(
        `${API_URL}/api/recepcion/buscar-recepcion?numero=${encodeURIComponent(numero)}`
      );
      if (!res.ok) throw new Error("Error buscando recepción");
      const data = await res.json();

      if (data.encontrado) {
        setRecepcionStatus({
          estado: "ocupado",
          mensaje: `Recepción ya registrada en ${moduloNombre} (OT: ${data.datos?.numero_ot || "-"})`,
          formatos: { recepcion: true, verificacion: false, compresion: false },
        });
      } else {
        setRecepcionStatus({
          estado: "disponible",
          mensaje: `Número disponible en ${moduloNombre}`,
          formatos: { recepcion: false, verificacion: false, compresion: false },
        });
      }
    } catch {
      setRecepcionStatus({
        estado: "disponible",
        mensaje: "Sin conexión con el servidor - Ingreso manual habilitado",
      });
    }
  };

  // Submit Handler
  const onSubmit = async (data: FormOutput) => {
    setIsSubmitting(true);
    clearErrors();
    try {
      let normOt = (data.numero_ot || "").trim();
      if (normOt && !normOt.includes("-")) {
        const year = new Date().getFullYear().toString().slice(-2);
        normOt = `${normOt}-${year}`;
      }
      let normRec = (data.numero_recepcion || "").trim();
      if (normRec && !normRec.includes("-")) {
        const year = new Date().getFullYear().toString().slice(-2);
        normRec = `${normRec}-${year}`;
      }

      const formattedData = {
        ...data,
        numero_ot: normOt || data.numero_ot,
        numero_recepcion: normRec || data.numero_recepcion,
        muestras: data.muestras.map((m, idx) => ({
          ...m,
          item_numero: idx + 1,
          codigo_muestra_lem: normalizeLemCode(m.codigo_muestra_lem || ""),
        })),
      };

      if (isEditMode) {
        const res = await authFetch(`${API_URL}/api/recepcion/${id}`, {
          method: "PUT",
          body: JSON.stringify(formattedData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const error = { response: { status: res.status, data: errData } };
          throw error;
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["recepciones"] }),
          queryClient.invalidateQueries({ queryKey: ["recepcion-detail", id] }),
        ]);
        onClose("updated");
      } else {
        const res = await authFetch(`${API_URL}/api/recepcion/`, {
          method: "POST",
          body: JSON.stringify(formattedData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const error = { response: { status: res.status, data: errData } };
          throw error;
        }
        await queryClient.invalidateQueries({ queryKey: ["recepciones"] });
        onClose("created");
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { detail?: unknown; message?: string } };
        message?: string;
      };
      const status = err?.response?.status;
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Error inesperado";
      const detailLower = typeof detail === "string" ? detail.toLowerCase() : "";

      if (
        status === 422 &&
        Array.isArray(detail) &&
        applyBackendValidationErrors(
          detail as Array<{
            loc?: Array<string | number>;
            msg?: string;
            type?: string;
            ctx?: Record<string, unknown>;
          }>
        )
      ) {
        return;
      }

      let tipo = "Error";
      if (status === 409) {
        if (
          detailLower.includes("número ot") ||
          detailLower.includes("numero ot") ||
          detailLower.includes("ot")
        ) {
          tipo = "OT duplicada";
        } else if (
          detailLower.includes("número de recepción") ||
          detailLower.includes("numero de recepcion") ||
          detailLower.includes("recepción") ||
          detailLower.includes("recepcion")
        ) {
          tipo = "Recepción duplicada";
        } else {
          tipo = "Conflicto";
        }
      } else if (status === 400) {
        tipo = "Datos inválidos";
      } else if (status === 401) {
        tipo = "Sesión expirada";
      } else if (status === 500) {
        tipo = "Error interno";
      }

      const msg = typeof detail === "string" ? detail : JSON.stringify(detail);
      toast.error(`[${tipo}] ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditMode && isLoadingOrden) {
    return (
      <div className="flex items-center justify-center gap-3 p-12 text-muted-foreground font-bold uppercase tracking-widest">
        <Loader2 className="animate-spin h-6 w-6" />
        Cargando Datos...
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* TOP BAR */}
        <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                <Plus className="h-5 w-5" strokeWidth={3} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-tighter uppercase">
                    {isEditMode ? "Editar Recepción" : "Nueva Recepción"}
                  </h2>
                  {isEditMode && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 font-bold text-xs">
                      ✎ EDITANDO
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground font-bold uppercase text-[9px] tracking-[0.2em] mt-0.5">
                  Registro Geofal
                </p>
              </div>

              {/* TIPO DE RECEPCIÓN SELECTOR */}
              <div className="ml-4 flex items-center gap-2 bg-background border-2 border-primary/30 rounded-xl px-3 py-1.5 shadow-sm">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  Tipo de Recepción:
                </Label>
                <select
                  {...register("tipo_recepcion")}
                  onChange={(e) => {
                    const val = e.target.value;
                    setValue("tipo_recepcion", val);
                    const cfg = TIPO_RECEPCION_CONFIG[val] || TIPO_RECEPCION_CONFIG["CONCRETO"];
                    setValue("codigo_laboratorio", cfg.codigo);
                    setValue("version", cfg.version);
                  }}
                  className="h-7 bg-transparent text-xs font-black uppercase text-foreground focus:outline-none cursor-pointer"
                >
                  {(!allowedTipos || allowedTipos.includes("CONCRETO")) && (
                    <option value="CONCRETO">Concreto (Probetas)</option>
                  )}
                  {(!allowedTipos || allowedTipos.includes("SUELO_AGREGADO")) && (
                    <option value="SUELO_AGREGADO">Suelo y Agregado</option>
                  )}
                  {(!allowedTipos || allowedTipos.includes("ROCA")) && (
                    <option value="ROCA">Muestras de Roca</option>
                  )}
                  {(!allowedTipos || allowedTipos.includes("ALBANILERIA")) && (
                    <option value="ALBANILERIA">Muestras de Albañilería</option>
                  )}
                  {(!allowedTipos || allowedTipos.includes("AGUA")) && (
                    <option value="AGUA">Muestras de Agua</option>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Limpiar
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => onClose()}>
                <X className="h-3.5 w-3.5 mr-1" />
                Cerrar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest border-t pt-3 mt-3">
            <div className="flex gap-6">
              <span>
                COD:{" "}
                <span className="text-foreground">
                  {TIPO_RECEPCION_CONFIG[activeTipo]?.codigo || "F-LEM-P-01.02"}
                </span>
              </span>
              <span>
                VER:{" "}
                <span className="text-foreground">
                  {TIPO_RECEPCION_CONFIG[activeTipo]?.version || "07"}
                </span>
              </span>
            </div>
            <div className="flex gap-6">
              <span>
                FECHA:{" "}
                <span className="text-foreground">{new Date().toLocaleDateString("es-ES")}</span>
              </span>
              <span>
                PAG: <span className="text-foreground">1 de 1</span>
              </span>
            </div>
          </div>
        </div>

        {/* FORM CONTENT */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8">
          <form
            onSubmit={handleSubmit(onSubmit, (formErrors: any) => {
              const firstErrorPath = getFirstClientErrorPath(formErrors);
              if (firstErrorPath) focusFieldByPath(firstErrorPath);

              const getAllErrorMessages = (
                errObj: Record<string, unknown>,
                prefix = ""
              ): string[] => {
                const messages: string[] = [];
                if (errObj.message && typeof errObj.message === "string") {
                  messages.push(`${prefix || "formulario"}: ${errObj.message}`);
                }
                if (typeof errObj === "object" && errObj !== null) {
                  for (const key in errObj) {
                    if (key !== "message" && key !== "ref" && key !== "type") {
                      const newPrefix = prefix ? `${prefix}.${key}` : key;
                      messages.push(
                        ...getAllErrorMessages(errObj[key] as Record<string, unknown>, newPrefix)
                      );
                    }
                  }
                }
                return messages;
              };

              const allErrors = getAllErrorMessages(formErrors as unknown as Record<string, unknown>);
              if (allErrors.length > 0) {
                toast.error(`Revisa el campo resaltado en rojo. ${allErrors[0]}`, {
                  duration: 8000,
                });
              } else {
                toast.error("Por favor revise los campos en rojo");
              }
            })}
            className="space-y-8"
          >
            {/* 1. CABECERA: N° RECEPCIÓN, COTIZACIÓN, OT */}
            <OrdenFormHeader
              form={form}
              recepcionStatus={recepcionStatus}
              buscarEstadoRecepcion={buscarEstadoRecepcion}
              handleAutoFillFromCotizacion={handleAutoFillFromCotizacion}
            />

            {/* 2. TABLA DE MUESTRAS SEGÚN TIPO */}
            {activeTipo === "SUELO_AGREGADO" ? (
              <SueloAgregadoSampleList
                form={form}
                fields={fields}
                append={append}
                onCloneSample={handleClone}
                onRequestDeleteSample={handleRequestSampleDelete}
              />
            ) : (
              <ConcretoSampleTable
                form={form}
                fields={fields}
                append={append}
                handleClone={handleClone}
                handleRequestSampleDelete={handleRequestSampleDelete}
                handleSmartDate={handleSmartDate}
                handleItemsTableKeyDown={handleItemsTableKeyDown}
              />
            )}

            {/* 3. SECCIÓN 1: DATOS PARA FACTURACIÓN */}
            <FacturacionSection
              form={form}
              clientes={clientes}
              setClienteSearch={setClienteSearch}
              syncEntregadoPorFromContacto={syncEntregadoPorFromContacto}
              handleSelectCliente={handleSelectCliente}
            />

            {/* 4. SECCIÓN 2: DATOS QUE IRÁN EN EL INFORME */}
            <InformeSection form={form} />

            {/* 5. SECCIÓN 3: FECHAS Y EMISIÓN */}
            <FechasEmisionSection
              form={form}
              handleSmartDate={handleSmartDate}
            />

            {/* 6. SECCIÓN 4: LOGÍSTICA */}
            <LogisticaSection form={form} />

            {/* 7. SECCIÓN 5: OBSERVACIONES Y ACCIONES INFERIORES */}
            <ObservacionesSection
              form={form}
              isSubmitting={isSubmitting}
              isEditMode={isEditMode}
              onOpenSavePlantilla={() => setIsSavePlantillaOpen(true)}
              onClose={onClose}
            />
          </form>
        </div>
      </div>

      {/* MODALES Y DIÁLOGOS DE CONFIRMACIÓN */}
      <OrdenConfirmDialogs
        isDeleteModalOpen={isDeleteModalOpen}
        setIsDeleteModalOpen={setIsDeleteModalOpen}
        handleConfirmDelete={handleConfirmDelete}
        sampleDeleteIndex={sampleDeleteIndex}
        setSampleDeleteIndex={setSampleDeleteIndex}
        handleConfirmSampleDelete={handleConfirmSampleDelete}
      />

      <SavePlantillaModal
        isOpen={isSavePlantillaOpen}
        onClose={() => setIsSavePlantillaOpen(false)}
        currentFormData={getValues()}
        tipoRecepcion={activeTipo}
      />
    </>
  );
}
