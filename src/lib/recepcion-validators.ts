import * as z from "zod";

export const DEFAULT_FC = 280;
export const DEFAULT_EDAD = 7;
const CONTACT_PLACEHOLDERS = new Set([
  "-",
  "/",
  "--",
  "N/A",
  "NA",
  "S/N",
  "SIN ESPECIFICAR",
  "NO APLICA",
]);

export const isDateWithinDays = (dateStr: string, days: number): boolean => {
  if (!dateStr || !/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("/").map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
};

export const normalizeDateInput = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  let val = String(value).trim().replace(/[|]/g, "");
  if (!val) return "";

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(val)) return val;

  const digits = val.replace(/\D/g, "");
  if (digits.length === 8) {
    const y = digits.slice(0, 4);
    const m = digits.slice(4, 6);
    const d = digits.slice(6, 8);
    if (Number(y) >= 1900 && Number(y) <= 2100) return `${y}/${m}/${d}`;
    return `${digits.slice(4)}/${digits.slice(2, 4)}/${digits.slice(0, 2)}`;
  }

  return val;
};

export const normalizeImportedText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  return CONTACT_PLACEHOLDERS.has(text.toUpperCase()) ? "" : text;
};

export const normalizeImportedDate = (value: unknown): string => {
  const normalized = normalizeDateInput(value);
  return /^\d{4}\/\d{2}\/\d{2}$/.test(normalized) ? normalized : "";
};

export const normalizeRucValue = (value: unknown): string => {
  const normalized = normalizeImportedText(value);
  if (!normalized) return "";
  const digitsOnly = normalized.replace(/\D/g, "");
  return digitsOnly.length >= 8 && digitsOnly.length <= 20 ? digitsOnly : "";
};

export const normalizeLemCode = (val: string): string => {
  if (!val) return val;
  const cleaned = val.trim();
  if (/^\d+$/.test(cleaned)) {
    const year = new Date().getFullYear().toString().slice(-2);
    return `${cleaned}-CO-${year}`;
  }
  return cleaned;
};

export const isMeaningfulContactValue = (value: unknown): boolean => {
  const normalized = normalizeImportedText(value);
  return normalized.length > 0;
};

export const hasMeaningfulMuestraData = (m: unknown): boolean => {
  if (!m || typeof m !== "object") return false;
  const obj = m as Record<string, unknown>;
  const textFields = [
    obj.codigo_muestra_lem,
    obj.identificacion_muestra,
    obj.descripcion,
    obj.estructura,
    obj.fecha_moldeo,
    obj.fecha_rotura,
  ];
  const hasText = textFields.some(
    (v) => normalizeImportedText(v).length > 0
  );
  const hasNumeric = [obj.fc_kg_cm2, obj.edad].some(
    (v) =>
      v !== null &&
      v !== undefined &&
      String(v).trim() !== "" &&
      Number(v) > 0
  );
  return hasText || hasNumeric;
};

export const sanitizeImportedMuestras = (muestras: unknown[] | undefined | null) => {
  if (!Array.isArray(muestras)) return [];

  const sanitized = (muestras as Array<Record<string, unknown>>)
    .filter((m) => hasMeaningfulMuestraData(m))
    .map((m, idx: number) => ({
      item_numero: idx + 1,
      codigo_muestra_lem: normalizeLemCode(
        normalizeImportedText(m.codigo_muestra_lem)
      ),
      identificacion_muestra: String(
        m.identificacion_muestra || m.descripcion || ""
      ).trim(),
      estructura: String(m.estructura || "").trim(),
      fc_kg_cm2:
        m.fc_kg_cm2 !== null &&
        m.fc_kg_cm2 !== undefined &&
        String(m.fc_kg_cm2).trim() !== ""
          ? m.fc_kg_cm2
          : (DEFAULT_FC as never),
      edad:
        m.edad !== null &&
        m.edad !== undefined &&
        String(m.edad).trim() !== ""
          ? m.edad
          : (DEFAULT_EDAD as never),
      requiere_densidad:
        m.requiere_densidad === true ||
        m.requiere_densidad === "true" ||
        String(m.requiere_densidad || "").trim().toUpperCase() === "SI",
      fecha_moldeo: normalizeImportedDate(m.fecha_moldeo),
      hora_moldeo: normalizeImportedText(m.hora_moldeo),
      fecha_rotura: normalizeImportedDate(m.fecha_rotura),
    }));

  return sanitized.length > 0
    ? sanitized
    : [
        {
          item_numero: 1,
          codigo_muestra_lem: "",
          identificacion_muestra: "",
          estructura: "",
          fc_kg_cm2: "" as never,
          edad: "" as never,
          requiere_densidad: false,
          fecha_moldeo: "",
          hora_moldeo: "",
          fecha_rotura: "",
        },
      ];
};

export const incrementString = (str: string | undefined): string => {
  if (!str) return "";

  const lemMatch = str.match(/^(\d+)(-CO-)(\d+)$/i);
  if (lemMatch) {
    const [, base, sep, year] = lemMatch;
    const newBase = String(Number(base) + 1).padStart(base.length, "0");
    return `${newBase}${sep}${year}`;
  }

  const match = str.match(/\d+/g);
  if (!match) return str;
  if (/^\d+$/.test(str)) {
    return String(Number(str) + 1).padStart(str.length, "0");
  }
  return str.replace(/(\d+)(?!.*\d)/, (match) => {
    return String(Number(match) + 1).padStart(match.length, "0");
  });
};

export const extractLeadingNumber = (value: string | undefined): number => {
  if (!value) return NaN;
  const match = value.trim().match(/^(\d+)/);
  return match ? Number(match[1]) : Number.NaN;
};

export const getFormattedDate = (date: Date = new Date()): string => {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  return `${y}/${m}/${d}`;
};

export const getFieldPathFromBackendIssue = (
  issue: { loc?: Array<string | number> }
): string | null => {
  if (!Array.isArray(issue.loc)) return null;
  const path = issue.loc
    .filter((part) => part !== "body")
    .map((part) => String(part));
  return path.length > 0 ? path.join(".") : null;
};

export const getBackendIssueMessage = (issue: {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
  ctx?: Record<string, unknown>;
}): string => {
  const fieldPath = getFieldPathFromBackendIssue(issue);
  const fieldName = fieldPath?.split(".").pop();

  if (fieldName === "ruc") {
    return "Ingresa un RUC válido de 8 a 20 dígitos.";
  }
  if (issue.type === "string_too_long") {
    const maxLength =
      typeof issue.ctx?.max_length === "number" ? issue.ctx.max_length : null;
    return maxLength
      ? `El valor excede el máximo permitido (${maxLength} caracteres).`
      : "El valor es demasiado largo.";
  }
  if (issue.type === "missing") {
    return "Este campo es obligatorio.";
  }
  return issue.msg || "Valor inválido.";
};

export const getFirstClientErrorPath = (
  errorObject: unknown,
  prefix = ""
): string | null => {
  if (!errorObject || typeof errorObject !== "object") return null;
  const current = errorObject as Record<string, unknown>;
  if (typeof current.message === "string" && prefix) {
    return prefix;
  }
  for (const [key, value] of Object.entries(current)) {
    if (key === "message" || key === "ref" || key === "type") continue;
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    const nested = getFirstClientErrorPath(value, nextPrefix);
    if (nested) return nested;
  }
  return null;
};

// ── Zod Schemas ──

export const sampleSchema = z
  .object({
    item_numero: z.preprocess(
      (val) => {
        if (val === "" || val === null || val === undefined) return undefined;
        if (typeof val === "string" && /^\d+$/.test(val)) return Number(val);
        return val;
      },
      z.number().int().positive().optional()
    ),
    codigo_muestra_lem: z.string().optional(),
    identificacion_muestra: z.string().min(1, "Identificación Requerida"),
    estructura: z.string().min(1, "Estructura Requerida"),
    fc_kg_cm2: z.preprocess(
      (val) => (val === null || val === undefined ? "" : val),
      z
        .union([z.number(), z.string()])
        .refine((val) => Number(val) > 0, {
          message: "F'c Requerido (mayor a 0)",
        })
        .transform((val) => Number(val))
    ),
    fecha_moldeo: z.preprocess(
      normalizeDateInput,
      z
        .string()
        .min(1, "Fecha de moldeo Requerida")
        .regex(/^\d{4}\/\d{2}\/\d{2}$/, "Formato YYYY/MM/DD")
    ),
    hora_moldeo: z.string().optional(),
    edad: z.preprocess(
      (val) => (val === null || val === undefined ? "" : val),
      z
        .union([z.number(), z.string()])
        .refine((val) => Number(val) >= 1, {
          message: "Edad Requerida (mínimo 1)",
        })
        .transform((val) => Number(val))
    ),
    fecha_rotura: z.preprocess(
      normalizeDateInput,
      z
        .string()
        .min(1, "Fecha de rotura Requerida")
        .regex(/^\d{4}\/\d{2}\/\d{2}$/, "Formato YYYY/MM/DD")
    ),
    requiere_densidad: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : val),
      z
        .union([z.boolean(), z.string()])
        .optional()
        .transform((val) => val === true || val === "true")
    ),
  })
  .superRefine((data, ctx) => {
    if (data.fecha_moldeo && isDateWithinDays(data.fecha_moldeo, 3)) {
      if (!data.hora_moldeo || data.hora_moldeo.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Hora requerida (moldeo dentro de 3 días)",
          path: ["hora_moldeo"],
        });
      }
    }
  });

export const formSchema = z
  .object({
    numero_ot: z.string().min(1, "OT Requerida"),
    numero_recepcion: z.string().min(1, "Recepción Requerida"),
    numero_cotizacion: z.preprocess(
      (val) => (val === null ? undefined : val),
      z.string().optional()
    ),
    cliente: z.string().min(1, "Cliente Requerido"),
    domicilio_legal: z.string().min(1, "Requerido"),
    ruc: z.string().trim().regex(/^\d{8,20}$/, "RUC inválido"),
    persona_contacto: z.string().optional().default(""),
    email: z.string().optional().default(""),
    telefono: z.string().optional().default(""),
    solicitante: z.string().min(1, "Requerido"),
    domicilio_solicitante: z.string().min(1, "Requerido"),
    proyecto: z.string().min(1, "Requerido"),
    ubicacion: z.string().min(1, "Requerido"),
    fecha_recepcion: z.preprocess(
      normalizeDateInput,
      z.string().regex(/^\d{4}\/\d{2}\/\d{2}$/, "Fecha inválida (YYYY/MM/DD)")
    ),
    fecha_estimada_culminacion: z.preprocess(
      (val) => (val === null || val === undefined ? "" : val),
      z.string().refine(
        (val) => {
          const normalized = normalizeDateInput(val);
          return normalized === "" || /^\d{4}\/\d{2}\/\d{2}$/.test(normalized);
        },
        { message: "Fecha inválida (YYYY/MM/DD)" }
      )
    ),
    emision_fisica: z.preprocess(
      (val) => val === true || val === "true" || val === "on",
      z.boolean()
    ),
    emision_digital: z.preprocess(
      (val) => val === true || val === "true" || val === "on",
      z.boolean()
    ),
    entregado_por: z.string().min(1, "Requerido"),
    recibido_por: z.string().min(1, "Requerido"),
    observaciones: z.string().optional(),
    muestras: z.preprocess(
      (val) => {
        if (!Array.isArray(val)) return val;
        return val.filter((m: Record<string, unknown> | null | undefined) => {
          if (!m || typeof m !== "object") return false;
          const hasId =
            typeof m.identificacion_muestra === "string" &&
            m.identificacion_muestra.trim().length > 0;
          const hasDate =
            typeof m.fecha_moldeo === "string" &&
            m.fecha_moldeo.trim().length > 0;
          return hasId || hasDate;
        });
      },
      z.array(sampleSchema).min(1, "Mínimo una muestra")
    ),
  })
  .superRefine((data, ctx) => {
    const filledCount = [
      isMeaningfulContactValue(data.persona_contacto),
      isMeaningfulContactValue(data.email),
      isMeaningfulContactValue(data.telefono),
    ].filter(Boolean).length;

    if (filledCount < 2) {
      const msg = "Complete al menos 2 de 3: Nombre contacto, Email, Teléfono";
      if (!isMeaningfulContactValue(data.persona_contacto)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg,
          path: ["persona_contacto"],
        });
      }
      if (!isMeaningfulContactValue(data.email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg,
          path: ["email"],
        });
      }
      if (!isMeaningfulContactValue(data.telefono)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: msg,
          path: ["telefono"],
        });
      }
    }

    if (isMeaningfulContactValue(data.email)) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const lines = String(data.email)
        .split(/[\n\r\s,;]+/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const invalid = lines.filter((l) => !emailRegex.test(l));
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Email inválido: ${invalid[0]}`,
          path: ["email"],
        });
      }
    }

    if (
      isMeaningfulContactValue(data.telefono) &&
      String(data.telefono).trim().length < 7
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Teléfono inválido (mín. 7 dígitos)",
        path: ["telefono"],
      });
    }
  });

export type FormOutput = z.output<typeof formSchema>;
export type FormInput = z.input<typeof formSchema>;
