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
  isLoading: boolean
  lastUpdated: Date | null
  selectedMonth: string
  selectedYear: number
  dateFilter: DateFilter
  availableMonths: MonthOption[]
  setSelectedMonth: (month: string, year?: number) => void
  setDateFilter: (filter: DateFilter) => void
  refresh: () => Promise<void>
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>("recepcion")
  const [availableMonths] = useState<MonthOption[]>(() => generateAvailableMonths())

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

      const [pfRes, ppRes, peRes, eEntRes, eProRes, eInfRes, eAnuRes, tATRes, tCRRes, evRecRes, evInfRes, sTotalRes, sEmsRes, sDenRes, sProbRes, pfHoyRes, pfAyerRes, pfRestoRes, stEntRes, stInfRes, stNoIndRes] = await Promise.all([
        supabase.from("control_probetas").select("id", { count: "exact", head: true }).is("ensayo_realizado", null),
        supabase.from("control_probetas").select("id", { count: "exact", head: true }).not("ensayo_realizado", "is", null).is("fecha_ensayo", null),
        supabase.from("control_probetas").select("id", { count: "exact", head: true }).not("fecha_ensayo", "is", null),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "INFORME LISTO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ANULADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).not("entrega_real", "is", null).not("fecha_entrega_estimada", "is", null).lte("entrega_real", "fecha_entrega_estimada").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).not("entrega_real", "is", null).not("fecha_entrega_estimada", "is", null).gt("entrega_real", "fecha_entrega_estimada").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("envio_recepcion", "SI").gte("created_at", startDate).lt("created_at", endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("envio_informe", "SI").gte("created_at", startDate).lt("created_at", endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%EMS%,and(codigo_muestra.ilike.SU%,cliente_nombre.eq.GEOFAL ING)").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%DENSIDAD%,codigo_muestra.ilike.%DEN%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).ilike("codigo_muestra", "%CO%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("control_probetas").select("id", { count: "exact", head: true }).is("ensayo_realizado", null).eq("fecha_recepcion", today),
        supabase.from("control_probetas").select("id", { count: "exact", head: true }).is("ensayo_realizado", null).eq("fecha_recepcion", yesterday),
        supabase.from("control_probetas").select("id", { count: "exact", head: true }).is("ensayo_realizado", null).lt("fecha_recepcion", yesterday),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("envio_informe", "SI").eq("estado_trabajo", "ENTREGADO").gte("created_at", startDate).lt("created_at", endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("envio_recepcion", "SI").eq("estado_trabajo", "ENTREGADO").gte("created_at", startDate).lt("created_at", endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").is("envio_informe", null).is("envio_recepcion", null).gte("created_at", startDate).lt("created_at", endDate),
      ])

      setLaboratorio({
        serviciosPorTipo: buildGroup("Servicios por Tipo", [
          { label: "Suelo y Ag", value: Math.max(0, (sTotalRes.count ?? 0) - (sEmsRes.count ?? 0) - (sDenRes.count ?? 0) - (sProbRes.count ?? 0)) },
          { label: "EMS", value: sEmsRes.count ?? 0 },
          { label: "Densidad", value: sDenRes.count ?? 0 },
          { label: "Probetas", value: sProbRes.count ?? 0 },
        ]),
        probetasEnsayo: buildGroup("Probetas Ensayo", [
          { label: "Falta", value: pfRes.count ?? 0 },
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
          { label: "A Tiempo", value: tATRes.count ?? 0 },
          { label: "Con Retraso", value: tCRRes.count ?? 0 },
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

  useEffect(() => {
    fetchKpis()
  }, [fetchKpis])

  return {
    laboratorio,
    comercial,
    gerencia,
    isLoading,
    lastUpdated,
    selectedMonth,
    selectedYear,
    dateFilter,
    availableMonths,
    setSelectedMonth,
    setDateFilter,
    refresh: fetchKpis,
  }
}
