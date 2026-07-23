"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"

export interface KpiCategory {
  label: string
  value: number
  percentage: number
}

export interface KpiGroup {
  title: string
  categories: KpiCategory[]
  total: number
}

export interface LaboratorioKpis {
  serviciosPorTipo: KpiGroup
  probetasEnsayo: KpiGroup
  estadoTrabajo: KpiGroup
  tiempoEntrega: KpiGroup
  evidenciaEnvio: KpiGroup
}

export interface ComercialKpis {
  estadoTrabajo: KpiGroup
  serviciosPorTipo: KpiGroup
  tiempoEntrega: KpiGroup
  evidenciaSolicitud: KpiGroup
  diasAtrasoCotizacion: KpiGroup
  cumplimientoCotizacion: KpiGroup
}

export interface GerenciaKpis {
  resumenMensual: KpiGroup
  probetasFaltantes: KpiGroup
  facturacion: KpiGroup
  estadoPago: KpiGroup
  statusProbetasEntregadas: KpiGroup
}

export interface HistoricalMonthData {
  mes: string
  label: string
  total: number
  entregado: number
  proceso: number
  informeListo: number
  anulado: number
  tasaEntrega: number
  confirmacionEnvios: number
  cumplimientoTiempo: number
  serviciosEnProceso: number
  recepcionesDoc: number
  tasaAnulacion: number
}

export type HistoricalKpis = HistoricalMonthData[]

export interface HistoricalComercialMonthData {
  mes: string
  label: string
  total: number
  entregados: number
  enProceso: number
  informeListo: number
  anulados: number
  conFactura: number
  pagados: number
  pendientes: number
}

export type HistoricalComercialKpis = HistoricalComercialMonthData[]

export interface HistoricalAdminMonthData {
  mes: string
  label: string
  total: number
  conFactura: number
  sinFactura: number
  pagado: number
  pendiente: number
  sinRegistro: number
}

export type HistoricalAdminKpis = HistoricalAdminMonthData[]

export interface MonthOption {
  value: string
  label: string
  year: number
  month: number
}

export type DateFilter = "recepcion" | "creacion"

export interface KpisData {
  laboratorio: LaboratorioKpis
  comercial: ComercialKpis
  gerencia: GerenciaKpis
  prevLaboratorio: LaboratorioKpis | null
  prevComercial: ComercialKpis | null
  prevGerencia: GerenciaKpis | null
  historical: HistoricalKpis
  historicalComercial: HistoricalComercialKpis
  historicalAdmin: HistoricalAdminKpis
  isLoading: boolean
  isHistoricalLoading: boolean
  lastUpdated: Date | null
  selectedMonth: string
  selectedYear: number
  dateFilter: DateFilter
  availableMonths: MonthOption[]
  setSelectedMonth: (month: string, year?: number) => void
  setDateFilter: (filter: DateFilter) => void
  refresh: () => Promise<void>
  refreshHistorical: () => Promise<void>
}

function calcPct(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100 * 100) / 100
}

function buildGroup(title: string, data: { label: string; value: number }[]): KpiGroup {
  const total = data.reduce((s, i) => s + i.value, 0)
  return {
    title,
    categories: data.map(i => ({ label: i.label, value: i.value, percentage: calcPct(i.value, total) })),
    total,
  }
}

const EMPTY_LAB: LaboratorioKpis = {
  serviciosPorTipo: buildGroup("Servicios por Tipo", []),
  probetasEnsayo: buildGroup("Probetas Ensayo", []),
  estadoTrabajo: buildGroup("Estado Trabajo", []),
  tiempoEntrega: buildGroup("Tiempo Entrega", []),
  evidenciaEnvio: buildGroup("Evidencia Envio", []),
}

const EMPTY_COM: ComercialKpis = {
  estadoTrabajo: buildGroup("Estado Trabajo", []),
  serviciosPorTipo: buildGroup("Servicios por Tipo", []),
  tiempoEntrega: buildGroup("Tiempo Entrega", []),
  evidenciaSolicitud: buildGroup("Evidencia Solicitud", []),
  diasAtrasoCotizacion: buildGroup("Dias Atraso Cotizacion", []),
  cumplimientoCotizacion: buildGroup("Cumplimiento Cotizacion", []),
}

const EMPTY_GER: GerenciaKpis = {
  resumenMensual: buildGroup("Resumen Mensual", []),
  probetasFaltantes: buildGroup("Probetas Faltantes", []),
  facturacion: buildGroup("Facturacion", []),
  estadoPago: buildGroup("Estado Pago", []),
  statusProbetasEntregadas: buildGroup("Status Probetas Entregadas", []),
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

function generateAvailableMonths(): MonthOption[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const months: MonthOption[] = []

  for (let year = currentYear; year >= currentYear - 2; year--) {
    const startMonth = year === currentYear ? currentMonth : 12
    const endMonth = year === currentYear ? 1 : 1
    for (let m = startMonth; m >= endMonth; m--) {
      months.push({
        value: `${year}-${String(m).padStart(2, "0")}`,
        label: `${MONTH_NAMES[m - 1]} ${year}`,
        year,
        month: m,
      })
    }
  }

  return months
}

function validateMonthYear(month: string, year: number): boolean {
  const m = parseInt(month)
  if (isNaN(m) || m < 1 || m > 12) return false
  if (year < 2020 || year > new Date().getFullYear() + 1) return false
  return true
}

export function useKpisData(): KpisData {
  const now = new Date()
  const [selectedMonth, setSelectedMonthState] = useState<string>(String(now.getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear())
  const [laboratorio, setLaboratorio] = useState<LaboratorioKpis>(EMPTY_LAB)
  const [comercial, setComercial] = useState<ComercialKpis>(EMPTY_COM)
  const [gerencia, setGerencia] = useState<GerenciaKpis>(EMPTY_GER)
  const [prevLaboratorio, setPrevLaboratorio] = useState<LaboratorioKpis | null>(null)
  const [prevComercial, setPrevComercial] = useState<ComercialKpis | null>(null)
  const [prevGerencia, setPrevGerencia] = useState<GerenciaKpis | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>("recepcion")
  const [availableMonths] = useState<MonthOption[]>(() => generateAvailableMonths())
  const [historical, setHistorical] = useState<HistoricalKpis>([])
  const [historicalComercial, setHistoricalComercial] = useState<HistoricalComercialKpis>([])
  const [historicalAdmin, setHistoricalAdmin] = useState<HistoricalAdminKpis>([])

  const setSelectedMonth = useCallback((month: string, year?: number) => {
    const targetYear = year || selectedYear
    if (!validateMonthYear(month, targetYear)) {
      console.warn("Invalid month/year combination:", month, targetYear)
      return
    }
    setSelectedMonthState(month)
    if (year !== undefined) {
      setSelectedYear(year)
    }
  }, [])

  const fetchKpis = useCallback(async () => {
    try {
      setIsLoading(true)

      if (!validateMonthYear(selectedMonth, selectedYear)) {
        console.error("Invalid month/year:", selectedMonth, selectedYear)
        return
      }

      const targetMonth = parseInt(selectedMonth)
      const startDate = `${selectedYear}-${String(targetMonth).padStart(2, "0")}-01`
      const endMonth = targetMonth === 12 ? 1 : targetMonth + 1
      const endYear = targetMonth === 12 ? selectedYear + 1 : selectedYear
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`
      const today = now.toISOString().split("T")[0]
      const yesterday = new Date(now.getTime() - 86400000).toISOString().split("T")[0]

      const dateCol = dateFilter === "recepcion" ? "fecha_recepcion" : "created_at"

      const [sTotalRes, sEmsRes, sDenRes, sProbRes, eEntRes, eProRes, eInfRes, eAnuRes, tEntregaRes, evRecRes, evInfRes, stEntRes, stNoIndNullRes, stNoIndEmptyRes, dAtrasoAT, dAtraso1a3, dAtraso4a7, dAtraso8, cumTiempoAT, cumTiempoCR] = await Promise.all([
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%EMS%,and(codigo_muestra.ilike.SU%,cliente_nombre.eq.GEOFAL ING)").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%DENSIDAD%,codigo_muestra.ilike.%DEN%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).ilike("codigo_muestra", "%CO%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "INFORME LISTO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ANULADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id,entrega_real,fecha_entrega_estimada", { count: "exact" }).not("fecha_entrega_estimada", "is", null).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("evidencia_envio_recepcion.ilike.%si%,evidencia_envio_recepcion.ilike.%ok%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("envio_informes.ilike.%si%,envio_informes.ilike.%ok%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").or("evidencia_envio_recepcion.ilike.%si%,evidencia_envio_recepcion.ilike.%ok%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").is("evidencia_envio_recepcion", null).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").eq("evidencia_envio_recepcion", "").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("dias_atraso_lab", 0).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 0).lte("dias_atraso_lab", 3).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 3).lte("dias_atraso_lab", 7).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 7).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("dias_atraso_lab", 0).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 0).gte(dateCol, startDate).lt(dateCol, endDate),
      ])

      const { data: monthLabIds } = await supabase
        .from("programacion_lab").select("id")
        .gte(dateCol, startDate).lt(dateCol, endDate)
      const labIdArr = (monthLabIds ?? []).map((r: any) => r.id)
      const labIdSet = new Set(labIdArr)
      const { data: allPpRows } = await supabase
        .from("muestras_concreto").select("recepcion_id", { count: "exact", head: false })
        .eq("es_control_probetas", true).eq("status_ensayo", "PENDIENTE")
        .not("recepcion_id", "is", null)
      const ppCount = (allPpRows ?? []).filter((r: any) => labIdSet.has(r.recepcion_id)).length
      const ppRes = { count: ppCount }

      const [pfRawRes, peRes, pfHoyRes, pfAyerRes, pfRestoRes] = await Promise.all([
        supabase.from("muestras_concreto").select("id,status_ensayo,fecha_rotura", { count: "exact" }).eq("es_control_probetas", true).in("status_ensayo", ["FALTA", "-"]).in("recepcion_id", labIdArr),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).eq("status_ensayo", "ENSAYADO").in("recepcion_id", labIdArr),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).neq("status_ensayo", "ENSAYADO").eq("fecha_rotura", today.replace(/-/g, "/")).in("recepcion_id", labIdArr),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).neq("status_ensayo", "ENSAYADO").eq("fecha_rotura", yesterday.replace(/-/g, "/")).in("recepcion_id", labIdArr),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).neq("status_ensayo", "ENSAYADO").lt("fecha_rotura", yesterday.replace(/-/g, "/")).in("recepcion_id", labIdArr),
      ])

      const BATCH = 100

      let evSiCount = 0, evTotalCount = 0
      let adFact = 0, adSinFact = 0, adPag = 0, adPend = 0
      for (let i = 0; i < labIdArr.length; i += BATCH) {
        const chunk = labIdArr.slice(i, i + BATCH)
        const [siRes, totalRes, aF, aSF, aP, aPe] = await Promise.all([
          supabase.from("programacion_comercial").select("id", { count: "exact", head: true }).eq("evidencia_solicitud_envio", "SI").in("programacion_id", chunk),
          supabase.from("programacion_comercial").select("id", { count: "exact", head: true }).in("programacion_id", chunk),
          supabase.from("programacion_administracion").select("id", { count: "exact", head: true }).not("numero_factura", "is", null).in("programacion_id", chunk),
          supabase.from("programacion_administracion").select("id", { count: "exact", head: true }).is("numero_factura", null).in("programacion_id", chunk),
          supabase.from("programacion_administracion").select("id", { count: "exact", head: true }).eq("estado_pago", "PAGADO").in("programacion_id", chunk),
          supabase.from("programacion_administracion").select("id", { count: "exact", head: true }).eq("estado_pago", "PENDIENTE").in("programacion_id", chunk),
        ])
        evSiCount += siRes.count ?? 0; evTotalCount += totalRes.count ?? 0
        adFact += aF.count ?? 0; adSinFact += aSF.count ?? 0; adPag += aP.count ?? 0; adPend += aPe.count ?? 0
      }
      const comEvSolRes = { count: evSiCount }
      const comSinEvRes = { count: Math.max(0, evTotalCount - evSiCount) }
      const comDiasATRes = { count: dAtrasoAT.count ?? 0 }
      const comDias1a3Res = { count: dAtraso1a3.count ?? 0 }
      const comDias4a7Res = { count: dAtraso4a7.count ?? 0 }
      const comDias8Res = { count: dAtraso8.count ?? 0 }
      const comATRes = { count: cumTiempoAT.count ?? 0 }
      const comCRRes = { count: cumTiempoCR.count ?? 0 }
      const adminFactRes = { count: adFact }
      const adminSinFactRes = { count: adSinFact }
      const adminPagRes = { count: adPag }
      const adminPendRes = { count: adPend }

      const tEntregaRows = (tEntregaRes.data ?? []) as { id: string; entrega_real: string | null; fecha_entrega_estimada: string }[]
      const tATCount = tEntregaRows.filter(r => !r.entrega_real || r.entrega_real <= r.fecha_entrega_estimada).length
      const tCRCount = tEntregaRows.filter(r => r.entrega_real && r.entrega_real > r.fecha_entrega_estimada).length

      const pfRawRows = (pfRawRes.data ?? []) as { id: string; status_ensayo: string; fecha_rotura: string | null }[]
      const todayNorm = now.toISOString().split("T")[0].replace(/-/g, "/")
      const pfFaltaCount = pfRawRows.filter(r => r.status_ensayo === "FALTA" || (r.status_ensayo === "-" && r.fecha_rotura && r.fecha_rotura < todayNorm)).length

      if (lastUpdated) {
        setPrevLaboratorio({ ...laboratorio })
        setPrevComercial({ ...comercial })
        setPrevGerencia({ ...gerencia })
      }

      setLaboratorio({
        serviciosPorTipo: buildGroup("Servicios por Tipo", [
          { label: "Suelo y Ag", value: Math.max(0, (sTotalRes.count ?? 0) - (sEmsRes.count ?? 0) - (sDenRes.count ?? 0) - (sProbRes.count ?? 0)) },
          { label: "EMS", value: sEmsRes.count ?? 0 },
          { label: "Densidad", value: sDenRes.count ?? 0 },
          { label: "Probetas", value: sProbRes.count ?? 0 },
        ]),
        probetasEnsayo: buildGroup("Probetas Ensayo", [
          { label: "Falta", value: pfFaltaCount },
          { label: "Pendiente", value: ppRes.count ?? 0 },
          { label: "Ensayada", value: peRes.count ?? 0 },
        ]),
        estadoTrabajo: buildGroup("Estado Trabajo", [
          { label: "Entregado", value: eEntRes.count ?? 0 },
          { label: "En Proceso", value: eProRes.count ?? 0 },
          { label: "Informe Listo", value: eInfRes.count ?? 0 },
          { label: "Anulado", value: eAnuRes.count ?? 0 },
        ]),
        tiempoEntrega: buildGroup("Tiempo Entrega", [
          { label: "A Tiempo", value: tATCount },
          { label: "Con Retraso", value: tCRCount },
        ]),
        evidenciaEnvio: buildGroup("Evidencia Envio", [
          { label: "Recepcion", value: evRecRes.count ?? 0 },
          { label: "Informe", value: evInfRes.count ?? 0 },
        ]),
      })

      setComercial({
        estadoTrabajo: buildGroup("Estado Trabajo", [
          { label: "Entregado", value: eEntRes.count ?? 0 },
          { label: "En Proceso", value: eProRes.count ?? 0 },
          { label: "Informe Listo", value: eInfRes.count ?? 0 },
          { label: "Anulado", value: eAnuRes.count ?? 0 },
        ]),
        serviciosPorTipo: buildGroup("Servicios por Tipo", [
          { label: "Suelo y Ag", value: Math.max(0, (sTotalRes.count ?? 0) - (sEmsRes.count ?? 0) - (sDenRes.count ?? 0) - (sProbRes.count ?? 0)) },
          { label: "EMS", value: sEmsRes.count ?? 0 },
          { label: "Densidad", value: sDenRes.count ?? 0 },
          { label: "Probetas", value: sProbRes.count ?? 0 },
        ]),
        tiempoEntrega: buildGroup("Tiempo Entrega", [
          { label: "A Tiempo", value: tATCount },
          { label: "Con Retraso", value: tCRCount },
        ]),
        evidenciaSolicitud: buildGroup("Evidencia Solicitud Cotizacion", [
          { label: "Con Evidencia", value: comEvSolRes.count ?? 0 },
          { label: "Sin Evidencia", value: comSinEvRes.count ?? 0 },
        ]),
        diasAtrasoCotizacion: buildGroup("Dias Atraso Envio Cotizacion", [
          { label: "A Tiempo (0)", value: comDiasATRes.count ?? 0 },
          { label: "1-3 dias", value: comDias1a3Res.count ?? 0 },
          { label: "4-7 dias", value: comDias4a7Res.count ?? 0 },
          { label: "8+ dias", value: comDias8Res.count ?? 0 },
        ]),
        cumplimientoCotizacion: buildGroup("Cumplimiento Tiempo Cotizacion", [
          { label: "A Tiempo", value: comATRes.count ?? 0 },
          { label: "Con Retraso", value: comCRRes.count ?? 0 },
        ]),
      })

      setGerencia({
        resumenMensual: buildGroup("Resumen Mensual", [
          { label: "Entregados", value: eEntRes.count ?? 0 },
          { label: "En Proceso", value: eProRes.count ?? 0 },
          { label: "Pendientes", value: ppRes.count ?? 0 },
        ]),
        probetasFaltantes: buildGroup("Probetas Faltantes", [
          { label: "Hoy", value: pfHoyRes.count ?? 0 },
          { label: "Ayer", value: pfAyerRes.count ?? 0 },
          { label: "Anteriores", value: pfRestoRes.count ?? 0 },
        ]),
        facturacion: buildGroup("Facturacion", [
          { label: "Con Factura", value: adminFactRes.count ?? 0 },
          { label: "Sin Factura", value: adminSinFactRes.count ?? 0 },
        ]),
        estadoPago: buildGroup("Estado Pago", [
          { label: "Pagado", value: adminPagRes.count ?? 0 },
          { label: "Pendiente", value: adminPendRes.count ?? 0 },
          { label: "Sin Registro", value: Math.max(0, ((adminFactRes.count ?? 0) + (adminSinFactRes.count ?? 0)) - (adminPagRes.count ?? 0) - (adminPendRes.count ?? 0)) },
        ]),
        statusProbetasEntregadas: buildGroup("Status Probetas Entregadas", [
          { label: "Enviado", value: stEntRes.count ?? 0 },
          { label: "No Enviado", value: (stNoIndNullRes.count ?? 0) + (stNoIndEmptyRes.count ?? 0) },
        ]),
      })

      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error fetching KPIs:", err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedMonth, selectedYear, dateFilter])

  const fetchHistoricalKpis = useCallback(async () => {
    try {
      setIsHistoricalLoading(true)

      const { data: rows, error } = await supabase
        .from("programacion_lab")
        .select("fecha_recepcion, estado_trabajo, entrega_real, fecha_entrega_estimada, envio_informes, evidencia_envio_recepcion")
        .not("fecha_recepcion", "is", null)
        .gte("fecha_recepcion", "2026-01-01")

      if (error) {
        console.error("Error fetching historical KPIs:", error)
        return
      }

      const grouped: Record<string, typeof rows> = {}
      for (const row of rows ?? []) {
        const key = row.fecha_recepcion!.substring(0, 7)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(row)
      }

      const result: HistoricalKpis = Object.keys(grouped)
        .sort()
        .map((key) => {
          const monthRows = grouped[key]
          const total = monthRows.length
          const entregado = monthRows.filter(r => r.estado_trabajo === "ENTREGADO").length
          const proceso = monthRows.filter(r => r.estado_trabajo === "PROCESO").length
          const informeListo = monthRows.filter(r => r.estado_trabajo === "INFORME LISTO").length
          const anulado = monthRows.filter(r => r.estado_trabajo === "ANULADO").length
          const conFechaEst = monthRows.filter(r => r.fecha_entrega_estimada)
          const conEntregaReal = monthRows.filter(r => r.entrega_real)
          const aTiempo = monthRows.filter(r => r.fecha_entrega_estimada && (!r.entrega_real || r.entrega_real <= r.fecha_entrega_estimada)).length
          const conRetraso = monthRows.filter(r => r.entrega_real && r.fecha_entrega_estimada && r.entrega_real > r.fecha_entrega_estimada).length
          const envInfSi = monthRows.filter(r => r.envio_informes === "SI").length
          const envRecSi = monthRows.filter(r => r.evidencia_envio_recepcion === "SI").length
          const [y, m] = key.split("-")
          const monthIdx = parseInt(m) - 1

          return {
            mes: key,
            label: `${MONTH_NAMES[monthIdx]} ${y}`,
            total,
            entregado,
            proceso,
            informeListo,
            anulado,
            tasaEntrega: calcPct(entregado, total),
            confirmacionEnvios: calcPct(envInfSi, total),
            cumplimientoTiempo: conFechaEst.length > 0 ? calcPct(aTiempo, conFechaEst.length) : 0,
            serviciosEnProceso: calcPct(proceso, total),
            recepcionesDoc: calcPct(envRecSi, total),
            tasaAnulacion: calcPct(anulado, total),
          }
        })

      setHistorical(result)
    } catch (err) {
      console.error("Error fetching historical KPIs:", err)
    } finally {
      setIsHistoricalLoading(false)
    }
  }, [])

  const fetchHistoricalComercialKpis = useCallback(async () => {
    try {
      setIsHistoricalLoading(true)
      const { data: rows, error } = await supabase
        .from("programacion_lab")
        .select("fecha_recepcion, estado_trabajo")
        .not("fecha_recepcion", "is", null)
        .gte("fecha_recepcion", "2026-01-01")
      if (error) { console.error("Error fetching comercial historical:", error); return }

      const grouped: Record<string, typeof rows> = {}
      for (const row of rows ?? []) {
        const key = row.fecha_recepcion!.substring(0, 7)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(row)
      }

      const result: HistoricalComercialKpis = Object.keys(grouped).sort().map((key) => {
        const m = grouped[key]
        const total = m.length
        const entregados = m.filter(r => r.estado_trabajo === "ENTREGADO").length
        const enProceso = m.filter(r => r.estado_trabajo === "PROCESO").length
        const informeListo = m.filter(r => r.estado_trabajo === "INFORME LISTO").length
        const anulados = m.filter(r => r.estado_trabajo === "ANULADO").length
        const [y, mo] = key.split("-")
        const monthIdx = parseInt(mo) - 1
        return { mes: key, label: `${MONTH_NAMES[monthIdx]} ${y}`, total, entregados, enProceso, informeListo, anulados, conFactura: 0, pagados: 0, pendientes: 0 }
      })

      const { data: adminRows } = await supabase
        .from("programacion_administracion")
        .select("programacion_id, numero_factura, estado_pago")
      const progIds = [...new Set((adminRows ?? []).map(r => r.programacion_id).filter(Boolean))]
      const labDateMap: Record<string, string> = {}
      const BATCH = 100
      for (let i = 0; i < progIds.length; i += BATCH) {
        const chunk = progIds.slice(i, i + BATCH)
        const { data: labRows } = await supabase
          .from("programacion_lab")
          .select("id, fecha_recepcion")
          .in("id", chunk)
        for (const lr of labRows ?? []) { if (lr.fecha_recepcion) labDateMap[lr.id] = lr.fecha_recepcion }
      }
      const adminGrouped: Record<string, typeof adminRows> = {}
      for (const row of adminRows ?? []) {
        const fecha = labDateMap[row.programacion_id]
        if (!fecha) continue
        const key = fecha.substring(0, 7)
        if (!adminGrouped[key]) adminGrouped[key] = []
        adminGrouped[key].push(row)
      }
      for (const entry of result) {
        const am = adminGrouped[entry.mes] ?? []
        entry.conFactura = am.filter(r => r.numero_factura).length
        entry.pagados = am.filter(r => r.estado_pago === "PAGADO").length
        entry.pendientes = am.filter(r => r.estado_pago === "PENDIENTE").length
      }

      setHistoricalComercial(result)
    } catch (err) { console.error("Error:", err) } finally { setIsHistoricalLoading(false) }
  }, [])

  const fetchHistoricalAdminKpis = useCallback(async () => {
    try {
      setIsHistoricalLoading(true)
      const { data: rows, error } = await supabase
        .from("programacion_administracion")
        .select("programacion_id, numero_factura, estado_pago")
      if (error) { console.error("Error fetching admin historical:", error); return }

      const progIds = [...new Set((rows ?? []).map(r => r.programacion_id).filter(Boolean))]
      const labDateMap: Record<string, string> = {}
      const BATCH = 100
      for (let i = 0; i < progIds.length; i += BATCH) {
        const chunk = progIds.slice(i, i + BATCH)
        const { data: labRows } = await supabase
          .from("programacion_lab")
          .select("id, fecha_recepcion")
          .in("id", chunk)
          .not("fecha_recepcion", "is", null)
          .gte("fecha_recepcion", "2026-01-01")
        for (const lr of labRows ?? []) { if (lr.fecha_recepcion) labDateMap[lr.id] = lr.fecha_recepcion }
      }

      const grouped: Record<string, typeof rows> = {}
      for (const row of rows ?? []) {
        const fecha = labDateMap[row.programacion_id]
        if (!fecha) continue
        const key = fecha.substring(0, 7)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(row)
      }

      const result: HistoricalAdminKpis = Object.keys(grouped).sort().map((key) => {
        const m = grouped[key]
        const total = m.length
        const conFactura = m.filter(r => r.numero_factura).length
        const sinFactura = total - conFactura
        const pagado = m.filter(r => r.estado_pago === "PAGADO").length
        const pendiente = m.filter(r => r.estado_pago === "PENDIENTE").length
        const sinRegistro = total - pagado - pendiente
        const [y, mo] = key.split("-")
        const monthIdx = parseInt(mo) - 1
        return { mes: key, label: `${MONTH_NAMES[monthIdx]} ${y}`, total, conFactura, sinFactura, pagado, pendiente, sinRegistro }
      })

      setHistoricalAdmin(result)
    } catch (err) { console.error("Error:", err) } finally { setIsHistoricalLoading(false) }
  }, [])

  useEffect(() => {
    fetchHistoricalKpis()
    fetchHistoricalComercialKpis()
    fetchHistoricalAdminKpis()
  }, [fetchHistoricalKpis, fetchHistoricalComercialKpis, fetchHistoricalAdminKpis])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  return {
    laboratorio,
    comercial,
    gerencia,
    prevLaboratorio,
    prevComercial,
    prevGerencia,
    historical,
    historicalComercial,
    historicalAdmin,
    isLoading,
    isHistoricalLoading,
    lastUpdated,
    selectedMonth,
    selectedYear,
    dateFilter,
    availableMonths,
    setSelectedMonth,
    setDateFilter,
    refresh: fetchKpis,
    refreshHistorical: fetchHistoricalKpis,
  }
}
