"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Copy,
  Plus,
  Trash2,
  X,
  Save,
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { authFetch } from "@/lib/api-auth";
import { formSchema, type FormOutput, type FormInput } from "@/lib/recepcion-validators";
import {
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
  DEFAULT_FC,
  DEFAULT_EDAD,
} from "@/lib/recepcion-validators";
import { useFormPersist } from "@/hooks/use-form-persist";
import { useEnterTableNavigation } from "@/hooks/use-enter-table-navigation";
import { TIPO_RECEPCION_CONFIG } from "@/types/recepcion";
import { SueloAgregadoSampleList } from "./SueloAgregadoSampleList";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface OrdenFormProps {
  mode: "create" | "edit";
  editId?: number;
  importedData?: Record<string, unknown> | null;
  defaultTipo?: string;
  allowedTipos?: string[];
  onClose: (reason?: "created" | "updated") => void;
}

export function OrdenForm({ mode, editId, importedData, defaultTipo, allowedTipos, onClose }: OrdenFormProps) {
  const isEditMode = mode === "edit";
  const id = editId;
  const queryClient = useQueryClient();
  const handleItemsTableKeyDown = useEnterTableNavigation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSelectionRef = useRef(false);

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
      emision_digital: false,
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
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    getValues,
    setError,
    clearErrors,
    setFocus,
    formState: { errors },
  } = form;

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "muestras",
  });

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

  const syncEntregadoPorFromContacto = (
    contacto: unknown,
    options?: { force?: boolean }
  ) => {
    const normalizedContacto = normalizeImportedText(contacto).toUpperCase();
    if (!normalizedContacto) return;
    const currentEntregado = normalizeImportedText(getValues("entregado_por"));
    if (options?.force || !currentEntregado) {
      setValue("entregado_por", normalizedContacto, { shouldValidate: true });
    }
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
    emision_digital: false,
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

  const { clearSavedData, hasSavedData } = useFormPersist(
    `recepcion-form-${id || "new"}`,
    form,
    !id
  );

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
        isSelectionRef.current = true;
        setClienteSearch(existingOrden.cliente);
      }
    }
  }, [existingOrden, reset, replace]);

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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sampleDeleteIndex, setSampleDeleteIndex] = useState<number | null>(null);

  const handleConfirmDelete = () => {
    clearSavedData();
    setRecepcionStatus({ estado: "idle" });
    setClienteSearch("");
    setTemplateSearch("");
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
    const filtered = currentMuestras.filter((_, idx) => idx !== sampleDeleteIndex);
    const reindexed = filtered.map((m, idx) => ({
      ...m,
      item_numero: idx + 1,
    }));
    replace(reindexed);
    setValue("muestras", reindexed as any, { shouldValidate: true, shouldDirty: true });
    setSampleDeleteIndex(null);
    toast.success("Muestra eliminada del formulario");
  };

  const [clienteSearch, setClienteSearch] = useState("");
  const [clientes, setClientes] = useState<Array<Record<string, unknown>>>([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const [templateSearch, setTemplateSearch] = useState("");
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (templateSearch.length >= 2) {
        try {
          const res = await authFetch(
            `${API_URL}/api/recepcion/plantillas/buscar?q=${encodeURIComponent(templateSearch)}`
          );
          if (res.ok) {
            const data = await res.json();
            setTemplates(data || []);
          }
          setShowTemplateDropdown(true);
        } catch {
          setTemplates([]);
        }
      } else {
        setTemplates([]);
        setShowTemplateDropdown(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [templateSearch]);

  const handleSelectTemplate = (t: Record<string, unknown>) => {
    setValue("cliente", t.cliente as string, { shouldValidate: true });
    setValue("ruc", normalizeRucValue(t.ruc), { shouldValidate: true });
    setValue("domicilio_legal", t.domicilio_legal as string, { shouldValidate: true });
    setValue("persona_contacto", normalizeImportedText(t.persona_contacto), {
      shouldValidate: true,
    });
    setValue("email", normalizeImportedText(t.email), { shouldValidate: true });
    setValue("telefono", normalizeImportedText(t.telefono), {
      shouldValidate: true,
    });
    setValue("solicitante", t.solicitante as string, { shouldValidate: true });
    setValue("domicilio_solicitante", t.domicilio_solicitante as string, {
      shouldValidate: true,
    });
    setValue("proyecto", t.proyecto as string, { shouldValidate: true });
    setValue("ubicacion", t.ubicacion as string, { shouldValidate: true });
    syncEntregadoPorFromContacto(t.persona_contacto, { force: true });
    setTemplateSearch(t.nombre_plantilla as string);
    isSelectionRef.current = true;
    setClienteSearch(t.cliente as string);
    setShowTemplateDropdown(false);
    toast.success(`Plantilla "${t.nombre_plantilla}" cargada`);
  };

  useEffect(() => {
    if (isSelectionRef.current) {
      isSelectionRef.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      const q = clienteSearch.trim();
      if (q.length >= 1) {
        try {
          const [resClientes, resPlantillas] = await Promise.allSettled([
            authFetch(`${API_URL}/clientes?search=${encodeURIComponent(q)}`),
            authFetch(`${API_URL}/api/recepcion/plantillas/buscar?q=${encodeURIComponent(q)}`)
          ]);
          let combined: Array<Record<string, unknown>> = [];
          if (resClientes.status === "fulfilled" && resClientes.value.ok) {
            const json = await resClientes.value.json();
            if (Array.isArray(json.data)) combined.push(...json.data);
          }
          if (resPlantillas.status === "fulfilled" && resPlantillas.value.ok) {
            const json = await resPlantillas.value.json();
            if (Array.isArray(json)) {
              json.forEach((p: any) => {
                const name = p.cliente || p.nombre || p.nombre_plantilla;
                if (name && !combined.some(c => String(c.nombre || c.cliente).toUpperCase() === String(name).toUpperCase())) {
                  combined.push({
                    id: p.id || p.codigo || name,
                    nombre: name,
                    ruc: p.ruc,
                    direccion: p.domicilio_legal || p.ubicacion,
                    contacto: p.persona_contacto,
                    email: p.email,
                    telefono: p.telefono,
                    proyecto: p.proyecto,
                    ubicacion: p.ubicacion,
                    solicitante: p.solicitante,
                    domicilio_solicitante: p.domicilio_solicitante,
                  });
                }
              });
            }
          }
          setClientes(combined);
          setShowClienteDropdown(combined.length > 0);
        } catch {
          setClientes([]);
          setShowClienteDropdown(false);
        }
      } else {
        setClientes([]);
        setShowClienteDropdown(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [clienteSearch]);

  const handleSelectCliente = (c: Record<string, unknown>) => {
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
    setValue("domicilio_solicitante", fallback(c.domicilio_solicitante || c.direccion || c.domicilio_legal), {
      shouldValidate: true,
    });
    if (c.proyecto) {
      setValue("proyecto", fallback(c.proyecto), { shouldValidate: true });
    }
    if (c.ubicacion) {
      setValue("ubicacion", fallback(c.ubicacion), { shouldValidate: true });
    }
    syncEntregadoPorFromContacto(c.contacto || c.persona_contacto, { force: true });
    setShowClienteDropdown(false);
    toast.success(`Cliente ${c.nombre || c.cliente} seleccionado y datos completados`);
  };

  const handleAutoFillFromCotizacion = async (cotValue: string) => {
    if (!cotValue || cotValue.trim().length === 0) return;
    const cleanVal = cotValue.trim().toUpperCase();
    const tokenMatch = cleanVal.match(/^(\d+)-COT-(\d+)$/);
    const token = tokenMatch ? `${tokenMatch[1]}-${tokenMatch[2]}` : cleanVal;

    try {
      toast.loading("Consultando cotización / control de laboratorio...");
      // Intentar primero con el endpoint de prefill directo
      let qd: any = null;
      let res = await authFetch(`${API_URL}/api/recepcion/prefill-cotizacion/${encodeURIComponent(cleanVal)}`);
      if (res.ok) {
        qd = await res.json();
      } else {
        // Fallback a by-token
        res = await authFetch(`${API_URL}/api/cotizacion/by-token/${encodeURIComponent(token)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) qd = json.data;
        }
      }

      toast.dismiss();

      if (qd) {
        toast.success(`Datos cargados desde cotización: ${qd.cliente || qd.cliente_nombre || "-"}`);
        const fallback = (v: unknown) => (v && String(v).trim()) || "";

        setValue("cliente", fallback(qd.cliente || qd.cliente_nombre), { shouldValidate: true });
        isSelectionRef.current = true;
        setClienteSearch(fallback(qd.cliente || qd.cliente_nombre));

        setValue("ruc", normalizeRucValue(qd.ruc || qd.cliente_ruc), { shouldValidate: true });
        setValue("persona_contacto", normalizeImportedText(qd.persona_contacto || qd.contacto || qd.cliente_contacto), {
          shouldValidate: true,
        });
        syncEntregadoPorFromContacto(qd.persona_contacto || qd.contacto || qd.cliente_contacto);
        setValue("email", normalizeImportedText(qd.email || qd.cliente_email), { shouldValidate: true });
        setValue("telefono", normalizeImportedText(qd.telefono || qd.cliente_telefono), { shouldValidate: true });
        setValue("proyecto", normalizeImportedText(qd.proyecto), { shouldValidate: true });
        setValue("ubicacion", normalizeImportedText(qd.ubicacion || qd.domicilio_legal), { shouldValidate: true });
        setValue("domicilio_legal", fallback(qd.domicilio_legal || qd.ubicacion), { shouldValidate: true });
        setValue("solicitante", fallback(qd.solicitante || qd.cliente || qd.cliente_nombre), { shouldValidate: true });
        setValue("domicilio_solicitante", fallback(qd.domicilio_solicitante || qd.ubicacion || qd.domicilio_legal), {
          shouldValidate: true,
        });

        const rawItems = qd.items || qd.items_json;
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          const currentTipo = getValues("tipo_recepcion") || tipoRecepcion;
          if (currentTipo === "SUELO_AGREGADO" || currentTipo === "ROCA" || currentTipo === "ALBANILERIA" || currentTipo === "AGUA") {
            const newMuestras = rawItems.map((item: any, idx: number) => ({
              item_numero: idx + 1,
              identificacion_muestra: item.descripcion ? `M-${idx + 1} (${item.descripcion})` : `MUESTRA N° ${idx + 1}`,
              procedencia: "",
              cantera: "",
              cantidad: String(item.cantidad ? `${item.cantidad} KG` : "50 KG"),
              codigo_muestra_lem: "",
              codigo_ensayo: item.codigo || "",
              ensayos_requeridos: item.descripcion || "",
              norma_requerida: item.norma || "-",
              ensayos_lista: [
                {
                  codigo: item.codigo || "",
                  descripcion: item.descripcion || "",
                  norma: item.norma || "-",
                },
              ],
            }));
            replace(newMuestras as any);
            toast.success(`${newMuestras.length} muestra(s) y ensayos cargados desde la cotización`);
          } else {
            // CONCRETO
            const newMuestras = sanitizeImportedMuestras(
              rawItems.map((item: any, idx: number) => ({
                item_numero: idx + 1,
                identificacion_muestra: item.descripcion || `Probeta ${idx + 1}`,
                estructura: "",
                fc_kg_cm2: DEFAULT_FC,
                edad: DEFAULT_EDAD,
                requiere_densidad: false,
                fecha_moldeo: "",
                hora_moldeo: "",
                fecha_rotura: "",
                codigo_muestra_lem: "",
              }))
            );
            replace(newMuestras);
            toast.success(`${newMuestras.length} probeta(s) importadas de la cotización`);
          }
        }
      } else {
        toast.info(`No se encontró cotización con código '${cotValue}'`);
      }
    } catch {
      toast.dismiss();
    }
  };

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

    const { id: _rhfId, ...cloneData } = itemToClone as Record<string, unknown> & { id?: string };

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

  const muestrasValues = watch("muestras");

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
  }, [JSON.stringify(muestrasValues), setValue]);

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
      const err = error as { response?: { status?: number; data?: { detail?: unknown; message?: string } }; message?: string };
      const status = err?.response?.status;
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Error inesperado";
      const detailLower = typeof detail === "string" ? detail.toLowerCase() : "";

      if (status === 422 && Array.isArray(detail) && applyBackendValidationErrors(detail as Array<{ loc?: Array<string | number>; msg?: string; type?: string; ctx?: Record<string, unknown> }>)) {
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

  const buscarEstadoRecepcion = async (numero: string) => {
    if (!numero || numero.length < 3) return;
    setRecepcionStatus({ estado: "buscando" });

    const currentTipo = getValues("tipo_recepcion") || tipoRecepcion;
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

  if (isEditMode && isLoadingOrden)
    return (
      <div className="flex items-center justify-center gap-3 p-12 text-muted-foreground font-bold uppercase tracking-widest">
        <Loader2 className="animate-spin h-6 w-6" />
        Cargando Datos...
      </div>
    );

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
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

              {/* TIPO DE RECEPCION SELECTOR - HEADER LOCATION (IMAGE 2) */}
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
              <span>COD: <span className="text-foreground">{TIPO_RECEPCION_CONFIG[watch("tipo_recepcion") || "CONCRETO"]?.codigo || "F-LEM-P-01.02"}</span></span>
              <span>VER: <span className="text-foreground">{TIPO_RECEPCION_CONFIG[watch("tipo_recepcion") || "CONCRETO"]?.version || "07"}</span></span>
            </div>
            <div className="flex gap-6">
              <span>FECHA: <span className="text-foreground">{new Date().toLocaleDateString("es-ES")}</span></span>
              <span>PAG: <span className="text-foreground">1 de 1</span></span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8">
          <form
            onSubmit={handleSubmit(onSubmit, (errors: any) => {
              const firstErrorPath = getFirstClientErrorPath(errors);
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

              const allErrors = getAllErrorMessages(errors as unknown as Record<string, unknown>);
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
            {/* TOP SECTION: IDs */}
            <div className="bg-card rounded-2xl border p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Numero Recepcion */}
                <div className="relative">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                    Recepción Nº:
                  </Label>
                  <Input
                    {...register("numero_recepcion")}
                    onBlur={(e) => {
                      let value = e.target.value.trim().toUpperCase();
                      if (value) {
                        const hasYearSuffix = /-\d{2}$/.test(value);
                        const hasExtendedSuffix = /-\d{2}-[A-Z0-9]+$/.test(value);
                        if (!hasYearSuffix && !hasExtendedSuffix) {
                          value = value + "-26";
                        }
                        e.target.value = value;
                        setValue("numero_recepcion", value, { shouldValidate: true });
                      }
                      buscarEstadoRecepcion(value);
                    }}
                    className={errors.numero_recepcion ? "border-destructive" : ""}
                    placeholder="193-26"
                  />
                  {errors.numero_recepcion && (
                    <span className="text-[9px] font-black text-destructive ml-1">
                      {String(errors.numero_recepcion.message ?? "")}
                    </span>
                  )}
                  <div className="absolute right-2 top-7.5 flex flex-col items-end gap-1">
                    {recepcionStatus.estado === "buscando" && (
                      <Badge variant="secondary" className="animate-pulse gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Buscando...
                      </Badge>
                    )}
                    {recepcionStatus.estado === "disponible" && (
                      <Badge variant="default" className="bg-emerald-100 text-emerald-700 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Disponible
                      </Badge>
                    )}
                    {recepcionStatus.estado === "ocupado" && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Ocupado
                      </Badge>
                    )}
                  </div>
                  {recepcionStatus.mensaje && recepcionStatus.estado !== "buscando" && (
                    <p
                      className={`text-right text-[9px] font-black italic mt-1 ${
                        recepcionStatus.estado === "ocupado"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }`}
                    >
                      {recepcionStatus.mensaje}
                    </p>
                  )}
                </div>

                {/* Numero Cotizacion */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                      Cotización Nº:
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const val = getValues("numero_cotizacion") || "";
                        if (val.trim()) {
                          handleAutoFillFromCotizacion(val);
                        } else {
                          toast.info("Ingresa un número de cotización o código para autocompletar");
                        }
                      }}
                      className="h-5 px-1.5 text-[9px] font-black text-primary hover:bg-primary/10 gap-1"
                      title="Autocompletar datos y ensayos desde la Cotización / Control Lab"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Autocompletar</span>
                    </Button>
                  </div>
                  <Input
                    {...register("numero_cotizacion")}
                    onBlur={async (e) => {
                      let value = e.target.value.trim().toUpperCase();
                      if (!value) return;

                      const fullFormat = /^\d+-COT-\d{2}$/.test(value);
                      if (!fullFormat) {
                        const digits = value.match(/\d+/);
                        if (digits) value = `${digits[0]}-COT-26`;
                      }
                      e.target.value = value;
                      setValue("numero_cotizacion", value, { shouldValidate: true });
                      handleAutoFillFromCotizacion(value);
                    }}
                    className={errors.numero_cotizacion ? "border-destructive" : ""}
                    placeholder="-----"
                  />
                  {errors.numero_cotizacion?.message && (
                    <span className="text-[9px] font-black text-destructive ml-1">
                      {errors.numero_cotizacion.message as string}
                    </span>
                  )}
                </div>

                {/* OT */}
                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest ml-1">
                    OT Nº:
                  </Label>
                  <div className="relative flex items-center">
                    {watch("numero_ot") && !/^ot/i.test(watch("numero_ot").trim()) && (
                      <span className="absolute left-3 font-mono font-bold text-slate-400 pointer-events-none select-none text-sm">
                        OT-
                      </span>
                    )}
                    <Input
                      {...register("numero_ot")}
                      autoComplete="off"
                      onBlur={(e) => {
                        let value = e.target.value.trim();
                        if (value) {
                          // Si no tiene guión de año, agregar suffix
                          if (!value.includes("-")) {
                            const year = new Date().getFullYear().toString().slice(-2);
                            value = `${value}-${year}`;
                          }
                          e.target.value = value;
                          setValue("numero_ot", value, { shouldValidate: true });
                        }
                      }}
                      className={`${errors.numero_ot ? "border-destructive" : ""} ${
                        watch("numero_ot") && !/^ot/i.test(watch("numero_ot").trim()) ? "pl-10 font-mono font-bold" : "font-mono font-bold"
                      }`}
                      placeholder="193-26"
                    />
                  </div>
                  {errors.numero_ot?.message && (
                    <span className="text-[9px] font-black text-destructive ml-1">
                      {String(errors.numero_ot.message ?? "")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SAMPLES SECTION */}
            {(watch("tipo_recepcion") || "CONCRETO") === "SUELO_AGREGADO" ? (
              <SueloAgregadoSampleList
                form={form}
                fields={fields}
                append={append}
                onCloneSample={handleClone}
                onRequestDeleteSample={handleRequestSampleDelete}
              />
            ) : (
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
                        {(watch("tipo_recepcion") || "CONCRETO") === "CONCRETO" && (
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
                        {(watch("tipo_recepcion") || "CONCRETO") === "ROCA" && (
                          <>
                            <th className="px-2 py-3 w-48">Identificación Muestra</th>
                            <th className="px-2 py-3 w-36">Tamaño (cm) / Peso (kg)</th>
                            <th className="px-2 py-3 w-36">Procedencia</th>
                            <th className="px-2 py-3 w-48">Ensayos Requeridos</th>
                            <th className="px-2 py-3 w-36">Norma Requerida</th>
                          </>
                        )}
                        {(watch("tipo_recepcion") || "CONCRETO") === "ALBANILERIA" && (
                          <>
                            <th className="px-2 py-3 w-52">Descripción Muestra (Marca/Tipo)</th>
                            <th className="px-2 py-3 w-24">Cantidad</th>
                            <th className="px-2 py-3 w-48">Ensayos Requeridos</th>
                            <th className="px-2 py-3 w-36">Norma Requerida</th>
                          </>
                        )}
                        {(watch("tipo_recepcion") || "CONCRETO") === "AGUA" && (
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
                        const activeTipo = watch("tipo_recepcion") || "CONCRETO";
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
            )}

            {/* SECTION 1: FACTURACION */}
            <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-6">
              <h3 className="text-[10px] font-black text-primary uppercase tracking-widest border-l-4 border-primary pl-4">
                DATOS PARA FACTURACIÓN Y PERSONA DE CONTACTO
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <div className="absolute z-[1000] top-full mt-1 w-full bg-popover text-popover-foreground border-2 border-primary/30 rounded-xl shadow-2xl max-h-72 overflow-y-auto py-1.5 divide-y divide-border/40">
                      {clientes.map((c) => (
                        <div
                          key={c.id as string}
                          onClick={() => handleSelectCliente(c)}
                          className="px-4 py-2.5 hover:bg-primary/10 cursor-pointer transition-colors"
                        >
                          <div className="text-[11px] font-black text-primary uppercase">
                            {String(c.nombre || c.cliente || "")}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {c.ruc ? (
                              <span className="text-[9px] font-black text-muted-foreground">
                                RUC: {String(c.ruc)}
                              </span>
                            ) : null}
                            {c.contacto || c.persona_contacto ? (
                              <span className="text-[9px] font-black text-foreground/80 truncate max-w-50">
                                CONTACTO: {String(c.contacto || c.persona_contacto)}
                              </span>
                            ) : null}
                          </div>
                          {c.direccion || c.domicilio_legal ? (
                            <div className="text-[9px] font-medium text-muted-foreground mt-0.5 truncate italic">
                              {String(c.direccion || c.domicilio_legal)}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                    placeholder="-----"
                  />
                  {errors.ruc?.message && (
                    <span className="text-[9px] font-black text-destructive">
                      {String(errors.ruc.message ?? "")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Domicilio Legal:
                </Label>
                <Textarea
                  {...register("domicilio_legal")}
                  className={errors.domicilio_legal ? "border-destructive" : ""}
                  placeholder="-----"
                  rows={2}
                />
                {errors.domicilio_legal?.message && (
                  <span className="text-[9px] font-black text-destructive">
                    {String(errors.domicilio_legal.message ?? "")}
                  </span>
                )}
              </div>
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
                      className={errors.persona_contacto ? "border-destructive" : ""}
                      placeholder="-----"
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
                      placeholder="-----"
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
                      placeholder="-----"
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

            {/* SECTION 2: INFORME */}
            <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-6">
              <h3 className="text-[10px] font-black text-primary uppercase tracking-widest border-l-4 border-primary pl-4">
                DATOS QUE IRÁN EN EL INFORME
              </h3>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Solicitante:
                </Label>
                <Input
                  {...register("solicitante")}
                  className={errors.solicitante ? "border-destructive" : ""}
                  placeholder="-----"
                />
                {errors.solicitante?.message && (
                  <span className="text-[9px] font-black text-destructive">
                    {String(errors.solicitante.message ?? "")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Domicilio Legal Solicitante:
                </Label>
                <Textarea
                  {...register("domicilio_solicitante")}
                  className={errors.domicilio_solicitante ? "border-destructive" : ""}
                  placeholder="-----"
                  rows={2}
                />
                {errors.domicilio_solicitante?.message && (
                  <span className="text-[9px] font-black text-destructive">
                    {String(errors.domicilio_solicitante.message ?? "")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Proyecto:
                </Label>
                <Input
                  {...register("proyecto")}
                  className={errors.proyecto ? "border-destructive" : ""}
                  placeholder="-----"
                />
                {errors.proyecto?.message && (
                  <span className="text-[9px] font-black text-destructive">
                    {String(errors.proyecto.message ?? "")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Ubicación:
                </Label>
                <Textarea
                  {...register("ubicacion")}
                  className={errors.ubicacion ? "border-destructive" : ""}
                  placeholder="-----"
                  rows={2}
                />
                {errors.ubicacion?.message && (
                  <span className="text-[9px] font-black text-destructive">
                    {String(errors.ubicacion.message ?? "")}
                  </span>
                )}
              </div>
            </div>

            {/* SECTION 3: FECHAS Y EMISION */}
            <div className="bg-card rounded-2xl border p-6 shadow-sm space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    FECHA DE RECEPCIÓN:
                  </Label>
                  <Input
                    {...register("fecha_recepcion")}
                    onBlur={(e) => {
                      register("fecha_recepcion").onBlur(e);
                      handleSmartDate(e, "fecha_recepcion");
                    }}
                    className={errors.fecha_recepcion ? "border-destructive" : ""}
                    placeholder="-----"
                  />
                  {errors.fecha_recepcion?.message && (
                    <span className="text-[9px] font-black text-destructive">
                      {String(errors.fecha_recepcion.message ?? "")}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    FECHA ESTIMADA DE CULMINACIÓN:
                  </Label>
                  <Input
                    {...register("fecha_estimada_culminacion")}
                    onBlur={(e) => {
                      register("fecha_estimada_culminacion").onBlur(e);
                      handleSmartDate(e, "fecha_estimada_culminacion");
                    }}
                    className={errors.fecha_estimada_culminacion ? "border-destructive" : ""}
                    placeholder="-----"
                  />
                  {errors.fecha_estimada_culminacion?.message && (
                    <span className="text-[9px] font-black text-destructive">
                      {String(errors.fecha_estimada_culminacion.message ?? "")}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-[10px] font-black uppercase tracking-widest">
                  Emisión de Informes:
                </h4>
                <div className="flex flex-col md:flex-row md:items-center gap-8">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="emision_fisica"
                      {...register("emision_fisica")}
                    />
                    <Label
                      htmlFor="emision_fisica"
                      className="text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Físico (El cliente recoge en laboratorio)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="emision_digital"
                      {...register("emision_digital")}
                    />
                    <Label
                      htmlFor="emision_digital"
                      className="text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Digital (Envío con firma digital)
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 4: LOGISTICA */}
            <div className="bg-card rounded-2xl border p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">
                    Entregado por:
                  </Label>
                  <Input
                    {...register("entregado_por")}
                    className={errors.entregado_por ? "border-destructive" : ""}
                    placeholder="-----"
                  />
                  {errors.entregado_por?.message && (
                    <span className="text-[9px] font-black text-destructive">
                      {String(errors.entregado_por.message ?? "")}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-black uppercase tracking-widest">
                      Recibido por (Laboratorio GEOFAL):
                    </Label>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setValue("recibido_por", "BETZABETH SARAVIA", {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        className="h-5 px-1.5 text-[9px] font-black bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                      >
                        BETZABETH SARAVIA
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setValue("recibido_por", "GERALDINE PINEDO", {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        className="h-5 px-1.5 text-[9px] font-black bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                      >
                        GERALDINE PINEDO
                      </Button>
                    </div>
                  </div>
                  <Input
                    {...register("recibido_por")}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                      register("recibido_por").onChange(e);
                    }}
                    className={`${errors.recibido_por ? "border-destructive" : ""} font-bold text-xs uppercase`}
                    placeholder="-----"
                  />
                  {errors.recibido_por?.message && (
                    <span className="text-[9px] font-black text-destructive">
                      {String(errors.recibido_por.message ?? "")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SECTION 5: NOTAS */}
            <div className="bg-card rounded-2xl border p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Nota / Observaciones:
                </Label>
                <Textarea
                  {...register("observaciones")}
                  className={errors.observaciones ? "border-destructive" : ""}
                  placeholder="Escriba aquí cualquier observación adicional..."
                  rows={3}
                />
              </div>
            </div>

            {/* FORM FOOTER */}
            <div className="flex items-center justify-end gap-4 pt-4 pb-4">
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                <Save className="h-4 w-4" />
                {isSubmitting
                  ? "Guardando..."
                  : isEditMode
                  ? "Guardar Cambios"
                  : "Crear Recepción"}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Delete Draft Confirmation */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borrará todos los datos temporales no guardados. No se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Sample Confirmation */}
      <AlertDialog
        open={sampleDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSampleDeleteIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar muestra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción quitará la muestra de la recepción actual. Deberá guardar la
              recepción para persistir el cambio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSampleDelete}>
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
