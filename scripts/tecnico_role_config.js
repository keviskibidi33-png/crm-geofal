const TECNICO_ROLE_NAME = "tecnico";
const TECNICO_ROLE_LABEL = "Tecnico de Laboratorio";
const TECNICO_ROLE_DESCRIPTION =
  "Seguimiento y recepcion en lectura; verificacion y F. Probetas en edicion";

const TECNICO_ROLE_PERMISSIONS = {
  tracing: { read: true, write: false, delete: false },
  recepcion: { read: true, write: false, delete: false },
  verificacion_muestras: { read: true, write: true, delete: false },
  compresion: { read: true, write: true, delete: false },
  configuracion: { read: true, write: false, delete: false },
};

module.exports = {
  TECNICO_ROLE_NAME,
  TECNICO_ROLE_LABEL,
  TECNICO_ROLE_DESCRIPTION,
  TECNICO_ROLE_PERMISSIONS,
};
