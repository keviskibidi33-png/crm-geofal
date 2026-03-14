const TECNICO_SUELOS_ROLE_NAME = "tecnico_suelos";
const TECNICO_SUELOS_ROLE_LABEL = "Tecnico Laboratorio Suelos";
const TECNICO_SUELOS_ROLE_DESCRIPTION =
  "Rol técnico de laboratorio para ensayos de suelos y agregados con edición operativa y sin permisos administrativos.";

const TECNICO_SUELOS_ROLE_PERMISSIONS = {
  humedad: { read: true, write: true, delete: false },
  cont_humedad: { read: true, write: true, delete: false },
  cbr: { read: true, write: true, delete: false },
  proctor: { read: true, write: true, delete: false },
  llp: { read: true, write: true, delete: false },
  gran_suelo: { read: true, write: true, delete: false },
  gran_agregado: { read: true, write: true, delete: false },
  abra: { read: true, write: true, delete: false },
  abrass: { read: true, write: true, delete: false },
  peso_unitario: { read: true, write: true, delete: false },
  tamiz: { read: true, write: true, delete: false },
  planas: { read: true, write: true, delete: false },
  caras: { read: true, write: true, delete: false },
  equi_arena: { read: true, write: true, delete: false },
  ge_fino: { read: true, write: true, delete: false },
  ge_grueso: { read: true, write: true, delete: false },
  cd: { read: true, write: true, delete: false },
  ph: { read: true, write: true, delete: false },
  cloro_soluble: { read: true, write: true, delete: false },
  sales_solubles: { read: true, write: true, delete: false },
  sulfatos_solubles: { read: true, write: true, delete: false },
  compresion_no_confinada: { read: true, write: true, delete: false },
  configuracion: { read: true, write: false, delete: false },
};

module.exports = {
  TECNICO_SUELOS_ROLE_NAME,
  TECNICO_SUELOS_ROLE_LABEL,
  TECNICO_SUELOS_ROLE_DESCRIPTION,
  TECNICO_SUELOS_ROLE_PERMISSIONS,
};
