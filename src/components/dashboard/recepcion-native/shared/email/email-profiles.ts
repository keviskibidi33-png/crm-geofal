export interface EmailProfileOption {
  id: string;
  codigo: string;
  nombre: string;
  cargo: string;
  from_name: string;
  from_email: string;
  default_cc: string[];
  signature_image_url?: string;
}

export const DEFAULT_CCS = [
  "oficinatecnica3@geofal.com.pe",
  "asesorcomercial1@geofal.com.pe",
];

export const EMAIL_PROFILES_CATALOG: EmailProfileOption[] = [
  {
    id: "OFICINA_TECNICA",
    codigo: "OFICINA_TECNICA",
    nombre: "Oficina Técnica",
    cargo: "Oficina Técnica - Control de Calidad",
    from_name: "Oficina Técnica - GEOFAL",
    from_email: "oficinatecnica1@geofal.com.pe",
    default_cc: ["oficinatecnica3@geofal.com.pe", "asesorcomercial1@geofal.com.pe"],
    signature_image_url: undefined,
  },
  {
    id: "COORDINADOR_LAB",
    codigo: "COORDINADOR_LAB",
    nombre: "Coordinación de Laboratorio",
    cargo: "Coordinadora de Laboratorio",
    from_name: "Coordinadora de Laboratorio - GEOFAL",
    from_email: "coordinadorlab@geofal.com.pe",
    default_cc: [
      "oficinatecnica1@geofal.com.pe",
      "oficinatecnica3@geofal.com.pe",
      "asesorcomercial1@geofal.com.pe",
    ],
    signature_image_url: "/FirmaCoordinadoraLabBetzabethSaravia.png",
  },
];

export const getTipoMuestraLabel = (tipo?: string): string => {
  const t = (tipo || "").toUpperCase();
  if (t === "CONCRETO") {
    return "Concreto";
  }
  return "Suelo/Agregado/Albañileria/Roca/Agua";
};

export const generateDefaultSpeech = (
  persona: string,
  numRecepcion: string
): string => {
  const now = new Date();
  const peruHour = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Lima" })
  ).getHours();
  const saludo = peruHour < 12 ? "Buenos días," : "Buenas tardes,";

  return `${saludo}
Estimado(a) **${persona}**

De acuerdo con la muestra recepcionada en laboratorio, le hacemos llegar el Formato de Recepción (**N° ${numRecepcion}**) con el fin de completar y/o verifique que los datos consignados sean correctos y tenga conocimiento de la **fecha de entrega** de los **informes de ensayo**.

Cualquier modificación solicitada una vez emitidos los **informes de ensayo**, deberá justificar el motivo del cambio por correo, el área comercial se pondrá en contacto.

Agradeceremos nos brinde su **conformidad** por este medio para emitir el **informe de ensayo**.

Atentamente,`;
};
