import { useEffect, useCallback, useState } from "react";
import type { UseFormReturn, FieldValues, DefaultValues } from "react-hook-form";

export function useFormPersist<T extends FieldValues>(
  formKey: string,
  formMethods: UseFormReturn<T>,
  enabled = true
) {
  const { watch, reset } = formMethods;
  const values = watch();
  const [hasSavedData, setHasSavedData] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const savedData = localStorage.getItem(formKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);

        if (Array.isArray(parsed.muestras)) {
          const originalCount = parsed.muestras.length;
          parsed.muestras = parsed.muestras.filter((m: Record<string, unknown> | null) => {
            if (!m) return false;
            const hasIdentificacion =
              m.identificacion_muestra &&
              String(m.identificacion_muestra).trim() !== "";
            const hasFechaMoldeo =
              m.fecha_moldeo && String(m.fecha_moldeo).trim() !== "";
            const hasFc =
              m.fc_kg_cm2 !== undefined &&
              m.fc_kg_cm2 !== null &&
              String(m.fc_kg_cm2).trim() !== "";
            const hasEdad =
              m.edad !== undefined &&
              m.edad !== null &&
              String(m.edad).trim() !== "";
            return (
              (hasIdentificacion || hasFechaMoldeo) &&
              (hasFc || hasEdad || hasFechaMoldeo)
            );
          });
          if (parsed.muestras.length === 0) {
            parsed.muestras = [
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
            ];
          }
          if (parsed.muestras.length !== originalCount) {
            console.debug(
              `[FormPersist] Removed ${originalCount - parsed.muestras.length} ghost muestra(s)`
            );
          }
        }

        setHasSavedData(true);
        reset(parsed as DefaultValues<T>);
      } catch (e) {
        console.error("Error loading saved form data:", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const timeoutId = setTimeout(() => {
      if (Object.keys(values).length > 0) {
        const toSave = { ...values };
        if (Array.isArray((toSave as Record<string, unknown>).muestras)) {
          (toSave as Record<string, unknown>).muestras = (
            (toSave as Record<string, unknown>).muestras as Array<Record<string, unknown> | null>
          ).filter((m: Record<string, unknown> | null) => {
            if (!m) return false;
            const hasIdentificacion =
              m.identificacion_muestra &&
              String(m.identificacion_muestra).trim() !== "";
            const hasFechaMoldeo =
              m.fecha_moldeo && String(m.fecha_moldeo).trim() !== "";
            const hasFc =
              m.fc_kg_cm2 !== undefined &&
              m.fc_kg_cm2 !== null &&
              String(m.fc_kg_cm2).trim() !== "";
            const hasEdad =
              m.edad !== undefined &&
              m.edad !== null &&
              String(m.edad).trim() !== "";
            return (
              (hasIdentificacion || hasFechaMoldeo) &&
              (hasFc || hasEdad || hasFechaMoldeo)
            );
          });
          if (
            ((toSave as Record<string, unknown>).muestras as Array<unknown>).length === 0
          ) {
            (toSave as Record<string, unknown>).muestras = [
              (values as Record<string, unknown>).muestras &&
              Array.isArray((values as Record<string, unknown>).muestras)
                ? ((values as Record<string, unknown>).muestras as Array<unknown>)[0] || {}
                : {},
            ];
          }
        }
        localStorage.setItem(formKey, JSON.stringify(toSave));
        setHasSavedData(true);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [values, formKey, enabled]);

  const clearSavedData = useCallback(() => {
    localStorage.removeItem(formKey);
    setHasSavedData(false);
  }, [formKey]);

  return { clearSavedData, hasSavedData };
}
