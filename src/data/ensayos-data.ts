export interface EnsayoItem {
  codigo: string;
  descripcion: string;
  norma: string;
  acreditado: string;
  referenciaOtraNorma: string;
  ubicacion: string;
  precio: number;
  tiempo: string;
  comentarios: string;
  categoria: string;
  codigoRelacionado?: string;
}

export const ensayosData: EnsayoItem[] = [
  // CEMENTO
  { codigo: 'CE01', descripcion: 'Análisis Físico del Cemento.', norma: 'NTP 334.004', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 80, tiempo: '3 dias', comentarios: '', categoria: 'CEMENTO' },
  
  // ENSAYO CONCRETO
  { codigo: 'CO07', descripcion: 'Resistencia a la Flexión del concreto.', norma: 'NTP 339.078/079', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 100, tiempo: '20 minutos', comentarios: '', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'CO08', descripcion: 'Resistencia a la compresión de mortero con especimen cubicos de 50 mm.', norma: 'NTP 334.051', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 25, tiempo: '20 minutos', comentarios: '', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'CO12', descripcion: 'Compresión de testigos cilíndricos de concreto', norma: 'ASTM C39/C39M-24', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 15, tiempo: '20 minutos', comentarios: 'Podemos curar las probetas', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'CO12A', descripcion: 'El servicio incluye: - Suministro de modulo de madera, moldes para probetas cilíndricas de 4x8", varilla compactadora, comba de goma y cucharón. - Recojo de probetas. - Compresión de testigos cilíndricos de concreto - Emisión de informe. - Cantidad: Kit por 06 unidades', norma: 'ASTM C39/C39M-24', acreditado: 'NO', referenciaOtraNorma: '', ubicacion: 'LABORATORIO', precio: 90, tiempo: '', comentarios: '', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'CO14', descripcion: 'Resistencia tracción simple por compresión diametral.', norma: 'NTP 339.084', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 30, tiempo: '20 minutos', comentarios: '', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'CO19', descripcion: 'Refrentado de probetas cilíndricas de concreto (por cara).', norma: 'ASTM C617/C617M-23', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 15, tiempo: '20 minutos', comentarios: '* Solo Es Para Probetas Que Se Realizara El Servicio De Ensayo De Compresion', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'CO20', descripcion: 'Espesor de especímenes en concreto.', norma: 'MTC E 507', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 50, tiempo: '1 dia', comentarios: '', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'DIS01', descripcion: 'Verificación diseño de mezcla', norma: 'ACI 211', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 250, tiempo: '1/2 dia', comentarios: 'Puede variar de acuerdo cantidad', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'DIS02', descripcion: 'Verificación diseño de mezcla con aditivo.', norma: 'ACI 211', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 500, tiempo: '1/2 dia', comentarios: 'Puede variar de acuerdo cantidad', categoria: 'ENSAYO CONCRETO' },
  { codigo: 'DIS03', descripcion: 'Diseño de mezcla Teórico.', norma: 'ACI 211', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 100, tiempo: '20 minutos', comentarios: 'Siempre se debe realizar verificacion del diseño de mezcla', categoria: 'ENSAYO CONCRETO' },

  // ENSAYO AGREGADO
  { codigo: 'AG08A', descripcion: 'Inalterabilidad Agregado Grueso con Sulfato de Magnesio.', norma: 'NTP 400.016', acreditado: 'NO', referenciaOtraNorma: 'ASTM C88', ubicacion: 'LABORATORIO', precio: 350, tiempo: '7 dias', comentarios: '* Se requiere realizar granulometria agregado AG19', categoria: 'ENSAYO AGREGADO', codigoRelacionado: 'AG19' },
  { codigo: 'AG08B', descripcion: 'Inalterabilidad Agregado Fino con Sulfato de Magnesio.', norma: 'NTP 400.016', acreditado: 'NO', referenciaOtraNorma: 'ASTM C88', ubicacion: 'LABORATORIO', precio: 350, tiempo: '7 dias', comentarios: '* Se requiere realizar granulometria agregado AG19', categoria: 'ENSAYO AGREGADO', codigoRelacionado: 'AG19' },
  { codigo: 'AG09', descripcion: 'Índice de Durabilidad Agregado.', norma: 'MTC E-214', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 350, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO AGREGADO' },
  { codigo: 'AG18', descripcion: 'Gravedad específica y absorción del agregado fino', norma: 'ASTM C128-25', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 150, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO AGREGADO' },
  { codigo: 'AG19', descripcion: 'Análisis granulométrico por tamizado en agregado', norma: 'ASTM C136/C136M-19', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 100, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO AGREGADO' },
  { codigo: 'AG20', descripcion: 'Contenido de humedad  en agregado', norma: 'ASTM C566-19', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 30, tiempo: '2 dias', comentarios: '', categoria: 'ENSAYO AGREGADO' },
  { codigo: 'AG22', descripcion: 'Peso Unitario y Vacío de agregados', norma: 'ASTM C29/C29M-23', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 120, tiempo: '3 dias', comentarios: '* Se requiere hacer el peso especifico fino AG18 o grueso AG28, fino si es arena y grueso si es grava', categoria: 'ENSAYO AGREGADO' },
  { codigo: 'AG23', descripcion: 'Pasante de la malla No.200', norma: 'ASTM C117-23', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 120, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO AGREGADO' },
  { codigo: 'AG26', descripcion: 'Abrasión los Ángeles de agregado grueso de gran tamaño', norma: 'ASTM C535-16 (Reapproved 2024)', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 350, tiempo: '3 dias', comentarios: '* Se requiere realizar granulometria agregado AG19', categoria: 'ENSAYO AGREGADO', codigoRelacionado: 'AG19' },

  // ENSAYO ALBAÑILERÍA
  { codigo: 'ALB01', descripcion: 'Absorción / Unidades de albañilería de Arcilla.', norma: 'NTP 399.613', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 130, tiempo: '3 dias', comentarios: 'Ladrillo arcilla king kong / cantidad 5 und / tiempo 3 dias', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB02', descripcion: 'Alabeo / Unidades de albañilería de Arcilla.', norma: 'NTP 399.613', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 130, tiempo: '1 dias', comentarios: 'Ladrillo arcilla king kong / cantidad 5 und / tiempo 1 día', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB03', descripcion: 'Compresión / Unidades de albañilería de Arcilla.', norma: 'NTP 399.613', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 200, tiempo: '3 dias', comentarios: 'Ladrillo arcilla king kong / cantidad 5 und / tiempo 3 dias', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB04', descripcion: 'Eflorescencia / Unidades de albañilería de Arcilla.', norma: 'NTP 399.613', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 130, tiempo: '7 dias', comentarios: 'Ladrillo arcilla king kong y pastelero / cantidad 10 und /  tiempo 7 días', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB04A', descripcion: 'Eflorescencia / Unidades de albañilería de Arcilla.', norma: 'NTP 399.613', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 200, tiempo: '7 dias', comentarios: 'Ladrillo arcilla Techo / cantidad 10 und /  tiempo 7 días', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB05', descripcion: 'Dimensionamiento  / Unidades de albañilería de Arcilla.', norma: 'NTP 399.613', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 130, tiempo: '1 dias', comentarios: 'Ladrillo arcilla king kong / cantidad 10 und / tiempo 1 día', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB06', descripcion: 'Medidas del área de vacíos en unidades perforadas.', norma: 'NTP 399.613', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 150, tiempo: '1 dias', comentarios: 'Ladrillo arcilla king kong / cantidad X und / tiempo 1 día', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB07', descripcion: 'Ensayo de Compresión en pilas de ladrillo (prisma albañilería).', norma: 'NTP 399.605', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 350, tiempo: '30 dias', comentarios: 'Ladrillo arcilla king kong / cantidad 12 und / tiempo 30 dias', categoria: 'ENSAYO ALBAÑILERÍA' },
  { codigo: 'ALB08', descripcion: 'Muestreo / Unidades de albañilería de concreto.', norma: 'NTP 399.604', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 350, tiempo: '1/2 dia', comentarios: 'Ladrillo de concreto king blog / ', categoria: 'ENSAYO ALBAÑILERÍA' },

  // ENSAYO SUELO
  { codigo: 'SS01', descripcion: 'Contenido de humedad natural', norma: 'ASTM D2216-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 50, tiempo: '1 dia', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS02', descripcion: 'Análisis granulométrico de suelos', norma: 'ASTM D6913/D6913M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 120, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS03', descripcion: 'Límite líquido', norma: 'ASTM D4318-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 80, tiempo: '2 dias', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS04', descripcion: 'Límite plástico', norma: 'ASTM D4318-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 80, tiempo: '2 dias', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS05', descripcion: 'Índice plástico', norma: 'ASTM D4318-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 80, tiempo: '2 dias', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS06', descripcion: 'Clasificación unificada de suelos (SUCS)', norma: 'ASTM D2487-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 150, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS07', descripcion: 'Peso específico de suelos', norma: 'ASTM D854-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 100, tiempo: '2 dias', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS08', descripcion: 'Ensayo de compactación Proctor', norma: 'ASTM D698/D698M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 200, tiempo: '4 dias', comentarios: '', categoria: 'ENSAYO SUELO' },
  { codigo: 'SS09', descripcion: 'Ensayo de compactación CBR', norma: 'ASTM D1883-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 250, tiempo: '5 dias', comentarios: '', categoria: 'ENSAYO SUELO' },

  // ENSAYO PAVIMENTO
  { codigo: 'PV01', descripcion: 'Extracción de núcleo de pavimento', norma: 'ASTM D1599/D1599M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'CAMPO', precio: 150, tiempo: '1 dia', comentarios: '', categoria: 'ENSAYO PAVIMENTO' },
  { codigo: 'PV02', descripcion: 'Densidad de campo del pavimento', norma: 'ASTM D6938/D6938M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'CAMPO', precio: 100, tiempo: '1 dia', comentarios: '', categoria: 'ENSAYO PAVIMENTO' },
  { codigo: 'PV03', descripcion: 'Ensayo de penetración de pavimento', norma: 'ASTM D1388/D1388M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'CAMPO', precio: 200, tiempo: '1 dia', comentarios: '', categoria: 'ENSAYO PAVIMENTO' },
  { codigo: 'PV04', descripcion: 'Resistencia a la compresión del pavimento', norma: 'ASTM D1074/D1074M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 180, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO PAVIMENTO' },

  // ENSAYO QUÍMICO
  { codigo: 'QU01', descripcion: 'Análisis químico de agregados', norma: 'ASTM C1152-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 200, tiempo: '5 dias', comentarios: '', categoria: 'ENSAYO QUÍMICO' },
  { codigo: 'QU02', descripcion: 'Análisis químico de agua', norma: 'ASTM D512-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 150, tiempo: '3 dias', comentarios: '', categoria: 'ENSAYO QUÍMICO' },
  { codigo: 'QU03', descripcion: 'pH de suelos', norma: 'ASTM D4972-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 80, tiempo: '1 dia', comentarios: '', categoria: 'ENSAYO QUÍMICO' },
  { codigo: 'QU04', descripcion: 'Contenido de sulfatos en suelos', norma: 'ASTM D4327-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 120, tiempo: '2 dias', comentarios: '', categoria: 'ENSAYO QUÍMICO' },
  { codigo: 'QU05', descripcion: 'Contenido de cloruros en concreto', norma: 'ASTM C1218/C1218M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 100, tiempo: '2 dias', comentarios: '', categoria: 'ENSAYO QUÍMICO' },

  // ENSAYOS ESPECIALES
  { codigo: 'ES01', descripcion: 'Ensayo de permeabilidad', norma: 'ASTM D5084-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 300, tiempo: '5 dias', comentarios: '', categoria: 'ENSAYOS ESPECIALES' },
  { codigo: 'ES02', descripcion: 'Ensayo de consolidación', norma: 'ASTM D2435/D2435M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 400, tiempo: '7 dias', comentarios: '', categoria: 'ENSAYOS ESPECIALES' },
  { codigo: 'ES03', descripcion: 'Ensayo triaxial', norma: 'ASTM D2850/D2850M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'LABORATORIO', precio: 500, tiempo: '10 dias', comentarios: '', categoria: 'ENSAYOS ESPECIALES' },

  // EVALUACIONES ESTRUCTURALES
  { codigo: 'EE01', descripcion: 'Ensayo de carga en pilotes', norma: 'ASTM D1143/D1143M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'CAMPO', precio: 800, tiempo: '2 dias', comentarios: '', categoria: 'EVALUACIONES ESTRUCTURALES' },
  { codigo: 'EE02', descripcion: 'Ensayo de placa de carga', norma: 'ASTM D1196/D1196M-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'CAMPO', precio: 600, tiempo: '1 dia', comentarios: '', categoria: 'EVALUACIONES ESTRUCTURALES' },
  { codigo: 'EE03', descripcion: 'Ensayo de ultrasonido en concreto', norma: 'ASTM C597-20', acreditado: 'SI', referenciaOtraNorma: '-', ubicacion: 'CAMPO', precio: 400, tiempo: '1 dia', comentarios: '', categoria: 'EVALUACIONES ESTRUCTURALES' },

  // OTROS SERVICIOS
  { codigo: 'OT01', descripcion: 'Consultoría técnica', norma: '-', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'OFICINA', precio: 500, tiempo: 'Por hora', comentarios: '', categoria: 'OTROS SERVICIOS' },
  { codigo: 'OT02', descripcion: 'Supervisión de obra', norma: '-', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'CAMPO', precio: 300, tiempo: 'Por día', comentarios: '', categoria: 'OTROS SERVICIOS' },
  { codigo: 'OT03', descripcion: 'Capacitación técnica', norma: '-', acreditado: 'NO', referenciaOtraNorma: '-', ubicacion: 'OFICINA', precio: 400, tiempo: 'Por día', comentarios: '', categoria: 'OTROS SERVICIOS' },
];

// Función para buscar ensayos por código o descripción
export const searchEnsayos = (query: string): EnsayoItem[] => {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  return ensayosData.filter(ensayo => 
    ensayo.codigo.toLowerCase().includes(lowerQuery) ||
    ensayo.descripcion.toLowerCase().includes(lowerQuery)
  );
};

// Función para obtener ensayo por código exacto
export const getEnsayoByCodigo = (codigo: string): EnsayoItem | undefined => {
  return ensayosData.find(ensayo => ensayo.codigo === codigo);
};

// Función para obtener ensayos relacionados
export const getEnsayosRelacionados = (codigo: string): EnsayoItem[] => {
  const ensayo = getEnsayoByCodigo(codigo);
  if (!ensayo || !ensayo.codigoRelacionado) return [];
  
  return ensayosData.filter(e => e.codigo === ensayo.codigoRelacionado);
};

// Obtener todas las categorías
export const getCategorias = (): string[] => {
  return [...new Set(ensayosData.map(e => e.categoria))];
};
