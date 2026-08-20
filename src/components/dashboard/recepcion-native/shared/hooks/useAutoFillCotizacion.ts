"use client";

import { UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { authFetch } from "@/lib/api-auth";
import {
  normalizeImportedText,
  normalizeRucValue,
  normalizeImportedDate,
  sanitizeImportedMuestras,
  DEFAULT_FC,
  DEFAULT_EDAD,
} from "@/lib/recepcion-validators";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface UseAutoFillCotizacionProps {
  form: UseFormReturn<any>;
  replace: (values: any[]) => void;
  selectCliente: (nombre: string) => void;
  syncEntregadoPorFromContacto: (
    contacto: unknown,
    options?: { force?: boolean }
  ) => void;
  initialTipo: string;
}

export function useAutoFillCotizacion({
  form,
  replace,
  selectCliente,
  syncEntregadoPorFromContacto,
  initialTipo,
}: UseAutoFillCotizacionProps) {
  const { setValue, getValues } = form;

  const handleAutoFillFromCotizacion = async (cotValue: string) => {
    if (!cotValue || cotValue.trim().length === 0) return;
    const cleanVal = cotValue.trim().toUpperCase();
    const tokenMatch = cleanVal.match(/^(\d+)-COT-(\d+)$/);
    const token = tokenMatch ? `${tokenMatch[1]}-${tokenMatch[2]}` : cleanVal;

    try {
      toast.loading("Consultando cotización / control de laboratorio...");
      let qd: any = null;
      let res = await authFetch(
        `${API_URL}/api/recepcion/prefill-cotizacion/${encodeURIComponent(cleanVal)}`
      );
      if (res.ok) {
        qd = await res.json();
      } else {
        res = await authFetch(
          `${API_URL}/api/cotizacion/by-token/${encodeURIComponent(token)}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) qd = json.data;
        }
      }

      toast.dismiss();

      if (qd) {
        if (qd.source === "control_laboratorio") {
          toast.success(
            `Datos sincronizados desde Control Laboratorio (OT: ${
              qd.numero_ot || "-"
            }, Cotiz: ${qd.numero_cotizacion || qd.cotizacion_numero || "-"})`
          );
        } else {
          toast.success(
            `Datos cargados desde cotización: ${
              qd.cliente || qd.cliente_nombre || "-"
            }`
          );
        }
        const fallback = (v: unknown) => (v && String(v).trim()) || "";

        if (qd.numero_ot || qd.ot) {
          let otVal = String(qd.numero_ot || qd.ot).trim();
          if (otVal && !otVal.includes("-") && /^\d+$/.test(otVal)) {
            otVal = `${otVal}-26`;
          }
          setValue("numero_ot", otVal, { shouldValidate: true });
        }

        if (qd.numero_cotizacion || qd.cotizacion_numero || qd.cotizacion_lab) {
          let cotVal = String(
            qd.numero_cotizacion || qd.cotizacion_numero || qd.cotizacion_lab
          )
            .trim()
            .toUpperCase();
          if (cotVal && !cotVal.includes("-") && /^\d+$/.test(cotVal)) {
            cotVal = `${cotVal}-26`;
          }
          setValue("numero_cotizacion", cotVal, { shouldValidate: true });
        }

        if (qd.fecha_recepcion) {
          const normFecha = normalizeImportedDate(qd.fecha_recepcion);
          if (normFecha)
            setValue("fecha_recepcion", normFecha, { shouldValidate: true });
        }
        if (qd.fecha_estimada_culminacion || qd.fecha_entrega) {
          const normFechaFin = normalizeImportedDate(
            qd.fecha_estimada_culminacion || qd.fecha_entrega
          );
          if (normFechaFin)
            setValue("fecha_estimada_culminacion", normFechaFin, {
              shouldValidate: true,
            });
        }

        if (qd.source !== "control_laboratorio") {
          const clienteVal = String(fallback(qd.cliente || qd.cliente_nombre));
          setValue("cliente", clienteVal, { shouldValidate: true });
          selectCliente(clienteVal);

          setValue("ruc", normalizeRucValue(qd.ruc || qd.cliente_ruc), {
            shouldValidate: true,
          });
          const contactoVal = normalizeImportedText(
            qd.persona_contacto || qd.contacto || qd.cliente_contacto
          );
          setValue("persona_contacto", contactoVal, { shouldValidate: true });
          syncEntregadoPorFromContacto(contactoVal, { force: true });
          setValue(
            "email",
            normalizeImportedText(qd.email || qd.cliente_email),
            { shouldValidate: true }
          );
          setValue(
            "telefono",
            normalizeImportedText(qd.telefono || qd.cliente_telefono),
            { shouldValidate: true }
          );
          setValue("proyecto", normalizeImportedText(qd.proyecto), {
            shouldValidate: true,
          });
          setValue(
            "ubicacion",
            normalizeImportedText(qd.ubicacion || qd.domicilio_legal),
            { shouldValidate: true }
          );
          setValue(
            "domicilio_legal",
            fallback(qd.domicilio_legal || qd.ubicacion),
            { shouldValidate: true }
          );
          setValue(
            "solicitante",
            fallback(qd.solicitante || qd.cliente || qd.cliente_nombre),
            { shouldValidate: true }
          );
          setValue(
            "domicilio_solicitante",
            fallback(
              qd.domicilio_solicitante || qd.ubicacion || qd.domicilio_legal
            ),
            { shouldValidate: true }
          );

          const rawItems = qd.items || qd.items_json;
          if (Array.isArray(rawItems) && rawItems.length > 0) {
            const currentTipo = getValues("tipo_recepcion") || initialTipo;
            if (
              currentTipo === "SUELO_AGREGADO" ||
              currentTipo === "ROCA" ||
              currentTipo === "ALBANILERIA" ||
              currentTipo === "AGUA"
            ) {
              const newMuestras = rawItems.map((item: any, idx: number) => ({
                item_numero: idx + 1,
                identificacion_muestra: item.descripcion
                  ? `M-${idx + 1} (${item.descripcion})`
                  : `MUESTRA N° ${idx + 1}`,
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
              toast.success(
                `${newMuestras.length} muestra(s) y ensayos cargados desde la cotización`
              );
            } else {
              const newMuestras = sanitizeImportedMuestras(
                rawItems.map((item: any, idx: number) => ({
                  item_numero: idx + 1,
                  identificacion_muestra:
                    item.descripcion || `Probeta ${idx + 1}`,
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
              replace(newMuestras as any);
              toast.success(
                `${newMuestras.length} probeta(s) cargadas desde la cotización`
              );
            }
          }
        }
      } else {
        toast.info(`No se encontró cotización o registro para '${cotValue}'`);
      }
    } catch {
      toast.dismiss();
    }
  };

  return { handleAutoFillFromCotizacion };
}
