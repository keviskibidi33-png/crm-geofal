"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"

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
  controlLabGeneral: KpiGroup
}

export interface ComercialKpis {
  estadoTrabajo: KpiGroup
  serviciosPorTipo: KpiGroup
  tiempoEntrega: KpiGroup
  evidenciaSolicitud: KpiGroup
  diasAtrasoCotizacion: KpiGroup
  cumplimientoCotizacion: KpiGroup
}

export interface ComercialKpiUnico {
  montoAcumuladoMes: KpiGroup
  numeroClientes: KpiGroup
  tasaConversion: number
}

export interface ComercialKpiDetalleItem {
  label: string
  count: number
  monto: number
}

export interface ComercialKpiSemana {
  semana: string
  cotizacionEnviada: number
  venta: number
  negociacion: number
  leads: number
  clienteNuevos: number
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
  comercialUnico: ComercialKpiUnico
  comercialUnicoDetalle: ComercialKpiDetalleItem[]
  comercialSemanas: ComercialKpiSemana[]
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


const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 1000 * 60 * 60 * 24

function parseDateOnlyUtc(value: string | null | undefined): Date | null {
  if (!value) return null
  const cleaned = String(value).trim().split("T")[0]
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const [, year, month, day] = match
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function calculateDiasAtrasoLabForKpi(fechaEntregaEstimada: string | null | undefined, entregaReal: string | null | undefined): number | null {
  const estimated = parseDateOnlyUtc(fechaEntregaEstimada)
  if (!estimated) return null

  const real = parseDateOnlyUtc(entregaReal)
  if (!real) {
    return -Math.round((estimated.getTime() - EXCEL_EPOCH_UTC) / MS_PER_DAY)
  }

  return Math.round((real.getTime() - estimated.getTime()) / MS_PER_DAY)
}

function isEntregaTrabajoATiempo(diasAtraso: number | null): boolean {
  return diasAtraso !== null && diasAtraso >= -10 && diasAtraso <= 0
}

function isEntregaTrabajoAtrasado(diasAtraso: number | null): boolean {
  return diasAtraso !== null && diasAtraso >= 1 && diasAtraso <= 10
}

function calcPct(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100 * 100) / 100
}

function buildGroup(title: string, data: { label: string; value: number }[], baseTotal?: number): KpiGroup {
  const total = baseTotal !== undefined ? baseTotal : data.reduce((s, i) => s + i.value, 0)
  return {
    title,
    categories: data.map(i => ({ label: i.label, value: i.value, percentage: calcPct(i.value, total) })),
    total,
  }
}

function normalizeDateValue(value: string | null | undefined): string {
  if (!value) return ""
  return String(value).trim().split("T")[0].replace(/-/g, "/")
}

function parseNormalizedDate(value: string | null | undefined): Date | null {
  const normalized = normalizeDateValue(value)
  if (!normalized) return null
  const [y, m, d] = normalized.split("/")
  if (!y || !m || !d) return null
  const dt = new Date(Number(y), Number(m) - 1, Number(d))
  return Number.isNaN(dt.getTime()) ? null : dt
}

function normalizeEstadoProbeta(value: string | null | undefined): "curado" | "pendiente" | "vencido" | "ensayado" | "anulado" | "otro" {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized === "curado") return "curado"
  if (normalized === "pendiente") return "pendiente"
  if (normalized === "vencido") return "vencido"
  if (normalized === "ensayado") return "ensayado"
  if (normalized === "anulado") return "anulado"
  return "otro"
}

const EMPTY_LAB: LaboratorioKpis = {
  serviciosPorTipo: buildGroup("Servicios por Tipo", []),
  probetasEnsayo: buildGroup("Probetas Ensayo", []),
  estadoTrabajo: buildGroup("Estado Trabajo", []),
  tiempoEntrega: buildGroup("Tiempo Entrega", []),
  evidenciaEnvio: buildGroup("Evidencia Envio", []),
  controlLabGeneral: buildGroup("Control Lab General", []),
}

const EMPTY_COM: ComercialKpis = {
  estadoTrabajo: buildGroup("Estado Trabajo", []),
  serviciosPorTipo: buildGroup("Servicios por Tipo", []),
  tiempoEntrega: buildGroup("Tiempo Entrega", []),
  evidenciaSolicitud: buildGroup("Evidencia Solicitud", []),
  diasAtrasoCotizacion: buildGroup("Dias Atraso Cotizacion", []),
  cumplimientoCotizacion: buildGroup("Cumplimiento Cotizacion", []),
}

const EMPTY_COM_UNICO: ComercialKpiUnico = {
  montoAcumuladoMes: buildGroup("Monto Acumulado Mes", []),
  numeroClientes: buildGroup("Numero Clientes", []),
  tasaConversion: 0,
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
  const [comercialUnico, setComercialUnico] = useState<ComercialKpiUnico>(EMPTY_COM_UNICO)
  const [comercialUnicoDetalle, setComercialUnicoDetalle] = useState<ComercialKpiDetalleItem[]>([])
  const [comercialSemanas, setComercialSemanas] = useState<ComercialKpiSemana[]>([])
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
  }, [selectedYear])

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
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
      const yesterdayLabDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const yesterday = `${yesterdayLabDate.getFullYear()}-${String(yesterdayLabDate.getMonth() + 1).padStart(2, "0")}-${String(yesterdayLabDate.getDate()).padStart(2, "0")}`
      const tomorrowLabDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      const tomorrow = `${tomorrowLabDate.getFullYear()}-${String(tomorrowLabDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowLabDate.getDate()).padStart(2, "0")}`
      const entregaTrabajoEndDate = selectedYear === now.getFullYear() && targetMonth === now.getMonth() + 1 ? tomorrow : endDate

      const dateCol = dateFilter === "recepcion" ? "fecha_recepcion" : "created_at"

      const [sTotalRes, sEmsRes, sDenRes, sProbRes, eEntRes, eProRes, eInfRes, eAnuRes, tEntregaRes, evRecRes, evInfEntRes, stEntRes, stNoIndNullRes, stNoIndEmptyRes, dAtrasoAT, dAtraso1a3, dAtraso4a7, dAtraso8, cumTiempoAT, cumTiempoCR, clHoyRes, clAyerRes, clAnterioresRes] = await Promise.all([
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%EMS%,and(codigo_muestra.ilike.SU%,cliente_nombre.eq.GEOFAL ING)").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("codigo_muestra.ilike.%DENSIDA%,codigo_muestra.ilike.%DEN%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).ilike("codigo_muestra", "%CO%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "INFORME LISTO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ANULADO").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id,entrega_real,fecha_entrega_estimada").not("fecha_entrega_estimada", "is", null).gte(dateCol, startDate).lt(dateCol, entregaTrabajoEndDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).or("evidencia_envio_recepcion.ilike.%si%,evidencia_envio_recepcion.ilike.%ok%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").or("envio_informes.ilike.%si%,envio_informes.ilike.%ok%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").or("evidencia_envio_recepcion.ilike.%si%,evidencia_envio_recepcion.ilike.%ok%").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").is("evidencia_envio_recepcion", null).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "ENTREGADO").eq("evidencia_envio_recepcion", "").gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("dias_atraso_lab", 0).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 0).lte("dias_atraso_lab", 3).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 3).lte("dias_atraso_lab", 7).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 7).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("dias_atraso_lab", 0).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).gt("dias_atraso_lab", 0).gte(dateCol, startDate).lt(dateCol, endDate),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO").eq("fecha_entrega_estimada", today),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO").eq("fecha_entrega_estimada", yesterday),
        supabase.from("programacion_lab").select("id", { count: "exact", head: true }).eq("estado_trabajo", "PROCESO").lt("fecha_entrega_estimada", yesterday),
      ])

      const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")
      const params = new URLSearchParams({ page: "1", page_size: "4000" })
      const controlResp = await authFetch(`${API_URL}/api/control-probetas/?${params}`)
      const controlData = controlResp.ok ? await controlResp.json() : { items: [] }
      const controlRows = (controlData.items ?? []).filter((r: any) => r.recepcion_id != null)

      const parseMoney = (value: unknown) => {
        if (value === null || value === undefined) return 0
        let str = String(value).trim()
        if (!str || str === "-") return 0

        str = str.replace(/^(S\/\.?|\$|PEN|USD)\s*/i, "").trim()
        const raw = str.replace(/[^0-9.,-]/g, "")
        if (!raw || raw === "-") return 0

        const sign = raw.startsWith("-") ? -1 : 1
        const unsigned = raw.replace(/-/g, "")
        let normalized = unsigned

        if (/^\d{1,3}(?:\.\d{3})+\.\d{1,2}$/.test(unsigned)) {
          normalized = String(Number(unsigned.replace(/\./g, "")) / 100)
        } else if (/^\d{1,3}(?:,\d{3})+,\d{1,2}$/.test(unsigned)) {
          normalized = String(Number(unsigned.replace(/,/g, "")) / 100)
        } else if (/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(unsigned)) {
          normalized = unsigned.replace(/,/g, "")
        } else if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(unsigned)) {
          normalized = unsigned.replace(/\./g, "").replace(",", ".")
        } else if (/^\d+[.,]\d{1,2}$/.test(unsigned)) {
          normalized = unsigned.replace(",", ".")
        } else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(unsigned)) {
          normalized = unsigned.replace(/[.,]/g, "")
        }

        const num = Number.parseFloat(normalized) * sign
        return Number.isFinite(num) ? num : 0
      }

      const normalizeState = (value: unknown) =>
        String(value ?? "")
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
      const stateAliases: Record<string, string> = {
        "COTIZACION ENVIADA": "COTIZACION ENVIADA",
        "COTIZACION REALIZADA": "COTIZACION ENVIADA",
        "VENTA": "VENTA",
        "NEGOCIACION": "NEGOCIACION",
      }
      const resolveSeguimientoState = (value: unknown) => {
        const normalized = normalizeState(value)
        return stateAliases[normalized] || normalized
      }
      const seguimientoParams = new URLSearchParams({ limit: "10000", offset: "0" })
      const seguimientoResp = await authFetch(`${API_URL}/api/seguimiento-comercial?${seguimientoParams}`)
      const seguimientoData = seguimientoResp.ok ? await seguimientoResp.json() : { items: [] }
      const seguimientosMes = (seguimientoData.items ?? []).filter((r: any) => {
        const contactDate = parseNormalizedDate(r.fecha_contacto)
        return !!contactDate && contactDate.getFullYear() === selectedYear && (contactDate.getMonth() + 1) === parseInt(selectedMonth)
      })
      const seguimientos = seguimientosMes
      const hasQuoteNumber = (value: unknown) => {
        const quoteNumber = String(value ?? "").trim()
        if (!quoteNumber || quoteNumber === "-") return false
        // Excluir placeholders de fecha (ej: 04/08, 02/06, 04-08)
        if (/^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(quoteNumber)) return false
        return true
      }
      const montoEnviada = seguimientos.filter((r: any) => {
        return parseMoney(r.costo_cotiz_sin_igv) > 0
      })
      const montoVenta = seguimientos.filter((r: any) => {
        const estadoSeguimiento = resolveSeguimientoState(r.estado_seguimiento)
        const isSale = estadoSeguimiento === "VENTA"
        return isSale && parseMoney(r.costo_cotiz_sin_igv) > 0
      })

      const leads = seguimientos.filter((r: any) => {
        const contactDate = parseNormalizedDate(r.fecha_contacto)
        return !!contactDate && hasQuoteNumber(r.numero_cotizacion)
      })

      const nuevos = seguimientos.filter((r: any) => {
        const contactDate = parseNormalizedDate(r.fecha_contacto)
        const estadoSeguimiento = resolveSeguimientoState(r.estado_seguimiento)
        const isSale = estadoSeguimiento === "VENTA"
        return !!contactDate && isSale
      })

      const totalMonto = montoEnviada.reduce((sum: number, r: any) => sum + parseMoney(r.costo_cotiz_sin_igv), 0)
      const ventaMonto = montoVenta.reduce((sum: number, r: any) => sum + parseMoney(r.costo_cotiz_sin_igv), 0)
      const negociacionMonto = Math.max(0, totalMonto - ventaMonto)
      const cotizacionMonto = montoEnviada.reduce((sum: number, r: any) => sum + parseMoney(r.costo_cotiz_sin_igv), 0)
      const negociacionCount = Math.max(0, montoEnviada.length - montoVenta.length)
      const totalClientes = leads.length + nuevos.length
      const tasaConversion = leads.length > 0 ? Math.round((nuevos.length / leads.length) * 100) : 0

      const monthNumber = parseInt(selectedMonth)
      const daysInMonth = new Date(selectedYear, monthNumber, 0).getDate()
      const weekBuckets = Array.from({ length: 4 }, (_, idx) => {
        const start = idx * 7 + 1
        const end = idx === 3 ? daysInMonth : Math.min((idx + 1) * 7, daysInMonth)
        return {
          semana: `Semana ${idx + 1}`,
          start,
          end,
          cotizacionEnviada: 0,
          venta: 0,
          negociacion: 0,
          leads: 0,
          clienteNuevos: 0,
        }
      }).filter((week) => week.start <= daysInMonth)

      for (const row of seguimientos) {
        const baseDate = parseNormalizedDate(row.fecha_contacto)
        if (!baseDate || baseDate.getFullYear() !== selectedYear || (baseDate.getMonth() + 1) !== monthNumber) continue
        const weekIndex = Math.min(3, Math.floor((baseDate.getDate() - 1) / 7))
        const week = weekBuckets[weekIndex]
        if (!week) continue

        const estadoCliente = normalizeState(row.estado_cliente)
        const estadoSeguimiento = resolveSeguimientoState(row.estado_seguimiento)
        const monto = parseMoney(row.costo_cotiz_sin_igv)
        const isSentQuote = monto > 0
        if (isSentQuote) week.cotizacionEnviada += monto
        if ((estadoSeguimiento === "VENTA" || estadoSeguimiento.includes("VENTA")) && monto > 0) week.venta += monto
        if (hasQuoteNumber(row.numero_cotizacion)) week.leads += 1
        if (estadoSeguimiento === "VENTA" || estadoSeguimiento.includes("VENTA")) week.clienteNuevos += 1
      }
      for (const week of weekBuckets) {
        week.negociacion = Math.max(0, week.cotizacionEnviada - week.venta)
      }

      setComercialUnico({
        montoAcumuladoMes: buildGroup("Monto Acumulado Mes", [
          { label: "Cotización Enviada", value: cotizacionMonto },
          { label: "Venta", value: ventaMonto },
          { label: "Negociación", value: negociacionMonto },
        ], cotizacionMonto),
        numeroClientes: buildGroup("Numero Clientes", [
          { label: "Leads", value: leads.length },
          { label: "Cliente Nuevos", value: nuevos.length },
        ], totalClientes || 1),
        tasaConversion,
      })
      setComercialUnicoDetalle([
        { label: "Cotización Enviada", count: montoEnviada.length, monto: cotizacionMonto },
        { label: "Venta", count: montoVenta.length, monto: ventaMonto },
        { label: "Negociación", count: negociacionCount, monto: negociacionMonto },
        { label: "Leads", count: leads.length, monto: 0 },
        { label: "Cliente Nuevos", count: nuevos.length, monto: 0 },
      ])
      setComercialSemanas(weekBuckets.map(({ semana, cotizacionEnviada, venta, negociacion, leads, clienteNuevos }) => ({
        semana,
        cotizacionEnviada,
        venta,
        negociacion,
        leads,
        clienteNuevos,
      })))

      const selectedMonthNum = parseInt(selectedMonth)
      const monthControlRows = controlRows.filter((r: any) => {
        const roturaDate = parseNormalizedDate(r.fecha_rotura)
        if (!roturaDate) return false
        return roturaDate.getFullYear() === selectedYear && (roturaDate.getMonth() + 1) === selectedMonthNum
      })
      const monthPendienteCount = monthControlRows.filter((r: any) => normalizeEstadoProbeta(r.estado_probeta) === "pendiente").length
      const monthFaltaCount = monthControlRows.filter((r: any) => normalizeEstadoProbeta(r.estado_probeta) === "vencido").length
      const ensayadasCount = monthControlRows.filter((r: any) => normalizeEstadoProbeta(r.estado_probeta) === "ensayado").length
      const ppRes = { count: monthPendienteCount }

      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      const currentPendingRows = monthControlRows.filter((r: any) => {
        const estado = normalizeEstadoProbeta(r.estado_probeta)
        return estado === "pendiente" || estado === "vencido"
      })
      const pfHoyRes = {
        count: currentPendingRows.filter((r: any) => {
          const roturaDate = parseNormalizedDate(r.fecha_rotura)
          return !!roturaDate && roturaDate.getTime() === todayDate.getTime()
        }).length,
      }
      const pfAyerRes = {
        count: currentPendingRows.filter((r: any) => {
          const roturaDate = parseNormalizedDate(r.fecha_rotura)
          return !!roturaDate && roturaDate.getTime() === yesterdayDate.getTime()
        }).length,
      }
      const pfRestoRes = {
        count: currentPendingRows.filter((r: any) => {
          const roturaDate = parseNormalizedDate(r.fecha_rotura)
          return !!roturaDate && roturaDate < yesterdayDate
        }).length,
      }

      const BATCH = 100

      let evSiCount = 0, evTotalCount = 0
      let adFact = 0, adSinFact = 0, adPag = 0, adPend = 0
      const labIdArr = controlRows.map((r: any) => r.recepcion_id).filter((id: any) => id != null)
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

      const tEntregaRows = (tEntregaRes.data ?? []) as { id: string; entrega_real: string | null; fecha_entrega_estimada: string | null }[]
      const recepcionesCount = sTotalRes.count ?? 0
      const entregadosCount = eEntRes.count ?? 0
      const evidenciaRecepcionSiCount = evRecRes.count ?? 0
      const evidenciaInformeSiCount = evInfEntRes.count ?? 0
      const pendientesInformeHoyCount = clHoyRes.count ?? 0
      const pendientesInformeAyerCount = clAyerRes.count ?? 0
      const pendientesInformeAnterioresCount = clAnterioresRes.count ?? 0
      const tEntregaDias = tEntregaRows.map(r => calculateDiasAtrasoLabForKpi(r.fecha_entrega_estimada, r.entrega_real))
      const tATCount = tEntregaDias.filter(isEntregaTrabajoATiempo).length
      const tCRCount = tEntregaDias.filter(isEntregaTrabajoAtrasado).length

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
          { label: "Falta", value: monthFaltaCount },
          { label: "Pendiente", value: ppRes.count ?? 0 },
          { label: "Ensayada", value: ensayadasCount },
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
        evidenciaEnvio: {
          title: "Evidencia Envio",
          total: recepcionesCount,
          categories: [
            { label: "Recepción (SI)", value: evidenciaRecepcionSiCount, percentage: calcPct(evidenciaRecepcionSiCount, recepcionesCount) },
            { label: "Recepción (Faltante)", value: Math.max(0, recepcionesCount - evidenciaRecepcionSiCount), percentage: calcPct(Math.max(0, recepcionesCount - evidenciaRecepcionSiCount), recepcionesCount) },
            { label: "Informe (SI)", value: evidenciaInformeSiCount, percentage: calcPct(evidenciaInformeSiCount, entregadosCount) },
            { label: "Informe (Faltante)", value: Math.max(0, entregadosCount - evidenciaInformeSiCount), percentage: calcPct(Math.max(0, entregadosCount - evidenciaInformeSiCount), entregadosCount) },
          ],
        },
        controlLabGeneral: buildGroup("Control Lab General", [
          { label: "Hoy", value: pendientesInformeHoyCount },
          { label: "Ayer", value: pendientesInformeAyerCount },
          { label: "Anteriores", value: pendientesInformeAnterioresCount },
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
          const entregaTrabajoDias = monthRows.map(r => calculateDiasAtrasoLabForKpi(r.fecha_entrega_estimada, r.entrega_real))
          const entregaTrabajoEvaluables = entregaTrabajoDias.filter(dias => isEntregaTrabajoATiempo(dias) || isEntregaTrabajoAtrasado(dias)).length
          const aTiempo = entregaTrabajoDias.filter(isEntregaTrabajoATiempo).length
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
            cumplimientoTiempo: entregaTrabajoEvaluables > 0 ? calcPct(aTiempo, entregaTrabajoEvaluables) : 0,
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
    comercialUnico,
    comercialUnicoDetalle,
    comercialSemanas,
    refresh: fetchKpis,
    refreshHistorical: fetchHistoricalKpis,
  }
}
