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
  evidenciaEnvio: KpiGroup
}

export interface GerenciaKpis {
  resumenMensual: KpiGroup
  probetasFaltantes: KpiGroup
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
  historical: HistoricalKpis
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
  evidenciaEnvio: buildGroup("Evidencia Envio", []),
}

const EMPTY_GER: GerenciaKpis = {
  resumenMensual: buildGroup("Resumen Mensual", []),
  probetasFaltantes: buildGroup("Probetas Faltantes", []),
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
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>("recepcion")
  const [availableMonths] = useState<MonthOption[]>(() => generateAvailableMonths())
  const [historical, setHistorical] = useState<HistoricalKpis>([])

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

      const [pfRawRes, ppRes, peRes, eEntRes, eProRes, eInfRes, eAnuRes, tEntregaRes, evRecRes, evInfRes, sTotalRes, sEmsRes, sDenRes, sProbRes, pfHoyRes, pfAyerRes, pfRestoRes, stEntRes, stInfRes, stNoIndRes] = await Promise.all([
        supabase.from("muestras_concreto").select("id,status_ensayo,fecha_rotura", { count: "exact" }).eq("es_control_probetas", true).in("status_ensayo", ["FALTA", "-"]),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).eq("status_ensayo", "PENDIENTE"),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).eq("status_ensayo", "ENSAYADO"),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "INFORME LISTO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ANULADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id,entrega_real,fecha_entrega_estimada", { count: "exact" }).not("fecha_entrega_estimada", "is", null).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("evidencia_envio_recepcion.eq.SI,evidencia_envio_recepcion.eq.OK").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("envio_informes.eq.SI,envio_informes.eq.OK").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%EMS%,and(codigo_muestra.ilike.SU%,cliente_nombre.eq.GEOFAL ING)").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%DENSIDAD%,codigo_muestra.ilike.%DEN%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).ilike("codigo_muestra", "%CO%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).neq("status_ensayo", "ENSAYADO").eq("fecha_rotura", today.replace(/-/g, "/")),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).neq("status_ensayo", "ENSAYADO").eq("fecha_rotura", yesterday.replace(/-/g, "/")),
        supabase.from("muestras_concreto").select("id", { count: "exact", head: true }).eq("es_control_probetas", true).neq("status_ensayo", "ENSAYADO").lt("fecha_rotura", yesterday.replace(/-/g, "/")),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").or("evidencia_envio_recepcion.eq.SI,evidencia_envio_recepcion.eq.OK").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").or("envio_informes.eq.SI,envio_informes.eq.OK").not("evidencia_envio_recepcion", "in", "(SI,OK)").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").is("envio_informes", null).is("evidencia_envio_recepcion", null).gte(dateCol, startDate).lt(dateCol, endDate),
      ])

      const tEntregaRows = (tEntregaRes.data ?? []) as { id: string; entrega_real: string | null; fecha_entrega_estimada: string }[]
      const tATCount = tEntregaRows.filter(r => !r.entrega_real || r.entrega_real <= r.fecha_entrega_estimada).length
      const tCRCount = tEntregaRows.filter(r => r.entrega_real && r.entrega_real > r.fecha_entrega_estimada).length

      const pfRawRows = (pfRawRes.data ?? []) as { id: string; status_ensayo: string; fecha_rotura: string | null }[]
      const todayNorm = now.toISOString().split("T")[0].replace(/-/g, "/")
      const pfFaltaCount = pfRawRows.filter(r => r.status_ensayo === "FALTA" || (r.status_ensayo === "-" && r.fecha_rotura && r.fecha_rotura < todayNorm)).length

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
        evidenciaEnvio: buildGroup("Evidencia Envio", [
          { label: "Recepcion", value: evRecRes.count ?? 0 },
          { label: "Informe", value: evInfRes.count ?? 0 },
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
        statusProbetasEntregadas: buildGroup("Status Probetas Entregadas", [
          { label: "Entregado", value: stEntRes.count ?? 0 },
          { label: "Informe", value: stInfRes.count ?? 0 },
          { label: "No Indica", value: stNoIndRes.count ?? 0 },
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

  useEffect(() => {
    fetchHistoricalKpis()
  }, [fetchHistoricalKpis])

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  return {
    laboratorio,
    comercial,
    gerencia,
    historical,
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
