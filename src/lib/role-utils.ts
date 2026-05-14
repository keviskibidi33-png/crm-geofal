const ROLE_ALIASES: Record<string, string> = {
  sig_el_rol: "auxiliar_comercial",
  "auxiliar comercial": "auxiliar_comercial",
  "auxiliar_comercial": "auxiliar_comercial",
  tecnico_general: "tecnico",
  tecnico_no_lab_write: "tecnico",
  laboratorio_tipificador_no_lab_write: "laboratorio_lector",
  oficina_tecnica_humedad: "oficina_tecnica",
  oficina_tecnica_humedad_tipificador: "oficina_tecnica",
  oficina_tecnica_sup: "oficina_tecnica",
}

export function normalizeRoleId(value: string | null | undefined) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  return ROLE_ALIASES[normalized] || normalized
}

export function isLegacyRoleAlias(value: string | null | undefined) {
  const normalized = String(value || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  return normalized in ROLE_ALIASES
}
