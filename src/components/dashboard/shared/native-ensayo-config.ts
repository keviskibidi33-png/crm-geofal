import { Beaker, FlaskConical, Droplets, Ruler, Weight, Dumbbell, Gauge, Layers, Scale } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface EnsayoModuleConfig {
  /** Kebab-case API slug: e.g. "ph", "caras", "cont-humedad" */
  slug: string
  /** PascalCase module name for components: e.g. "PH", "Caras" */
  name: string
  /** Display title in the header */
  title: string
  /** Description subtitle */
  description: string
  /** Lucide icon component */
  icon: LucideIcon
  /** Env var for frontend URL (iframe fallback) */
  envFrontendKey: string
  /** Default frontend URL if env var is not set */
  defaultFrontendUrl: string
  /** History section title */
  historyTitle: string
  /** Table caption */
  tableCaption: string
  /** Env var for native/iframe mode toggle */
  envModeKey: string
  /** Labels for detail fields (key -> label) */
  detailLabels: Record<string, string>
}

export const ENSAYO_MODULES: EnsayoModuleConfig[] = [
  {
    slug: "ph",
    name: "PH",
    title: "PH Suelo",
    description: "Registro y exportacion de ensayos.",
    icon: Beaker,
    envFrontendKey: "NEXT_PUBLIC_PH_FRONTEND_URL",
    defaultFrontendUrl: "https://ph.geofal.com.pe",
    historyTitle: "Historial PH Suelo",
    tableCaption: "PH Suelo - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_PH_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "caras",
    name: "Caras",
    title: "CARAS ASTM D5821-13",
    description: "Determinacion del porcentaje de particulas fracturadas.",
    icon: FlaskConical,
    envFrontendKey: "NEXT_PUBLIC_CARAS_FRONTEND_URL",
    defaultFrontendUrl: "https://caras.geofal.com.pe",
    historyTitle: "Historial de Caras",
    tableCaption: "Caras - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_CARAS_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      metodo_determinacion: "Metodo determinacion",
      fraccionada: "Fraccionada",
      nota: "Nota",
    },
  },
  {
    slug: "cont-humedad",
    name: "ContHumedad",
    title: "Contenido de Humedad AG",
    description: "Determinacion del contenido de humedad en agregados.",
    icon: Droplets,
    envFrontendKey: "NEXT_PUBLIC_CONT_HUMEDAD_FRONTEND_URL",
    defaultFrontendUrl: "https://cont-humedad.geofal.com.pe",
    historyTitle: "Historial Contenido de Humedad",
    tableCaption: "Contenido de Humedad - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_CONT_HUMEDAD_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "ge-fino",
    name: "GeFino",
    title: "Gravedad Especifica Fino",
    description: "Determinacion de la gravedad especifica de agregado fino.",
    icon: Weight,
    envFrontendKey: "NEXT_PUBLIC_GE_FINO_FRONTEND_URL",
    defaultFrontendUrl: "https://ge-fino.geofal.com.pe",
    historyTitle: "Historial Gravedad Especifica Fino",
    tableCaption: "GE Fino - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_GE_FINO_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "ge-grueso",
    name: "GeGrueso",
    title: "Gravedad Especifica Grueso",
    description: "Determinacion de la gravedad especifica de agregado grueso.",
    icon: Weight,
    envFrontendKey: "NEXT_PUBLIC_GE_GRUESO_FRONTEND_URL",
    defaultFrontendUrl: "https://ge-grueso.geofal.com.pe",
    historyTitle: "Historial Gravedad Especifica Grueso",
    tableCaption: "GE Grueso - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_GE_GRUESO_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "equi-arena",
    name: "EquiArena",
    title: "Equivalente de Arena",
    description: "Determinacion del equivalente de arena en suelos y agregados.",
    icon: Dumbbell,
    envFrontendKey: "NEXT_PUBLIC_EQUI_ARENA_FRONTEND_URL",
    defaultFrontendUrl: "https://equi-arena.geofal.com.pe",
    historyTitle: "Historial Equivalente de Arena",
    tableCaption: "Equivalente de Arena - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_EQUI_ARENA_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "peso-unitario",
    name: "PesoUnitario",
    title: "Peso Unitario",
    description: "Determinacion del peso unitario y vacios en agregados.",
    icon: Gauge,
    envFrontendKey: "NEXT_PUBLIC_PESO_UNITARIO_FRONTEND_URL",
    defaultFrontendUrl: "https://peso-unitario.geofal.com.pe",
    historyTitle: "Historial Peso Unitario",
    tableCaption: "Peso Unitario - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_PESO_UNITARIO_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "planas",
    name: "Planas",
    title: "Particulas Planas y Alargadas",
    description: "Determinacion de particulas planas y alargadas en agregados.",
    icon: Layers,
    envFrontendKey: "NEXT_PUBLIC_PLANAS_FRONTEND_URL",
    defaultFrontendUrl: "https://planas.geofal.com.pe",
    historyTitle: "Historial Particulas Planas",
    tableCaption: "Planas - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_PLANAS_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "tamiz",
    name: "Tamiz",
    title: "Malla 200 ASTM C117-23",
    description: "Determinacion del porcentaje de material que pasa el tamiz N 200.",
    icon: Scale,
    envFrontendKey: "NEXT_PUBLIC_TAMIZ_FRONTEND_URL",
    defaultFrontendUrl: "https://tamiz.geofal.com.pe",
    historyTitle: "Historial de Malla 200",
    tableCaption: "Malla 200 - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_TAMIZ_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "gran-suelo",
    name: "GranSuelo",
    title: "GRANULOMETRIA SUELOS ASTM D6913/D6913M-17",
    description: "Analisis granulometrico de suelos por tamizado.",
    icon: FlaskConical,
    envFrontendKey: "NEXT_PUBLIC_GRAN_SUELO_FRONTEND_URL",
    defaultFrontendUrl: "https://gran-suelo.geofal.com.pe",
    historyTitle: "Historial de Gran Suelo",
    tableCaption: "Gran Suelo - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_GRAN_SUELO_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "gran-agregado",
    name: "GranAgregado",
    title: "GRANULOMETRIA AGREGADOS ASTM C136/C136M-25",
    description: "Analisis granulometrico de agregados por tamizado.",
    icon: FlaskConical,
    envFrontendKey: "NEXT_PUBLIC_GRAN_AGREGADO_FRONTEND_URL",
    defaultFrontendUrl: "https://gran-agregado.geofal.com.pe",
    historyTitle: "Historial de Gran Agregado",
    tableCaption: "Gran Agregado - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_GRAN_AGREGADO_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
  {
    slug: "compresion-no-confinada",
    name: "CompresionNoConfinada",
    title: "C. No Confinada",
    description: "Ensayo de compresion no confinada en suelos.",
    icon: Beaker,
    envFrontendKey: "NEXT_PUBLIC_COMPRESION_NO_CONFINADA_FRONTEND_URL",
    defaultFrontendUrl: "https://compresion-no-confinada.geofal.com.pe",
    historyTitle: "Historial C. No Confinada",
    tableCaption: "C. No Confinada - listado con busqueda y acceso rapido.",
    envModeKey: "NEXT_PUBLIC_COMPRESION_NO_CONFINADA_MODE",
    detailLabels: {
      realizado_por: "Realizado por",
      observaciones: "Observaciones",
    },
  },
]

export function getModuleConfig(slug: string): EnsayoModuleConfig {
  const config = ENSAYO_MODULES.find((m) => m.slug === slug)
  if (!config) throw new Error(`Module config not found for slug: ${slug}`)
  return config
}
