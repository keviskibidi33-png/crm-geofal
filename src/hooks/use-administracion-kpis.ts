"use client"

import { useCallback, useEffect, useState } from "react"

import { authFetch } from "@/lib/api-auth"
import { supabase } from "@/lib/supabaseClient"
import type { MonthOption } from "@/hooks/use-kpis-data"

const CATEGORY_DEFINITIONS = [
  { key: "DEN", label: "Categoría 1 (DEN)" },
  { key: "PROB", label: "Categoría 2 (PROB)" },
  { key: "EMS", label: "Categoría 3 (EMS)" },
  { key: "ALQ", label: "Categoría 4 (ALQ)" },
  { key: "ENS.V.", label: "Categoría 5 (ENS.V.)" },
] as const

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

type CategoryKey = (typeof CATEGORY_DEFINITIONS)[number]["key"]

interface SeguimientoRow {
  id: number
  fecha_contacto: string | null
  razon_social: string | null
  ruc: string | null
  servicio_solicitado: string | null
  categoria_servicio: string | null
  costo_cotiz_sin_igv: string | null
  estado_cliente: string | null
  estado_seguimiento: string | null
  numero_cotizacion: string | null
}

interface ControlCommercialRow {
  codigo_muestra: string | null
  cliente_nombre: string | null
  descripcion_servicio: string | null
  costo_servicio: string | number | null
  evidencia_solicitud_envio: string | null
  activo: boolean | null
}

export interface AdministracionKpiCategory {
  key: CategoryKey
  label: string
  shortLabel: CategoryKey
  income: number
  incomePercentage: number
  clients: number
  clientsPercentage: number
  averageTicket: number
}

export interface AdministracionEvidenceKpi {
  label: "Si" | "No"
  value: number
  percentage: number
}

export type CommercialWeeklyAmounts = [number, number, number, number]

export interface CommercialTrackingCategory {
  key: CategoryKey
  label: string
  weeklyAmounts: CommercialWeeklyAmounts
  total: number
  percentage: number
}

export interface CommercialTrackingAmountGroup {
  weeklyTotals: CommercialWeeklyAmounts
  categories: CommercialTrackingCategory[]
  total: number
}

export interface CommercialTrackingKpis {
  weekLabels: [string, string, string, string]
  quoteSent: CommercialTrackingAmountGroup
  sales: CommercialTrackingAmountGroup
  leads: CommercialWeeklyAmounts
  newClients: CommercialWeeklyAmounts
  conversionRates: CommercialWeeklyAmounts
}

export interface AdministracionKpis {
  categories: AdministracionKpiCategory[]
  totalIncome: number
  totalClients: number
  averageTicket: number
  evidences: AdministracionEvidenceKpi[]
  totalEvidences: number
  ignoredEvidenceRecords: number
  uncategorizedRecords: number
  missingCostRecords: number
  missingClientRecords: number
  commercialTracking: CommercialTrackingKpis
}

function emptyWeeklyAmounts(): CommercialWeeklyAmounts {
  return [0, 0, 0, 0]
}

function createEmptyCommercialGroup(): CommercialTrackingAmountGroup {
  return {
    weeklyTotals: emptyWeeklyAmounts(),
    categories: CATEGORY_DEFINITIONS.map((category, index) => ({
      key: category.key,
      label: `CLIENTE ${index + 1} (${category.key})`,
      weeklyAmounts: emptyWeeklyAmounts(),
      total: 0,
      percentage: 0,
    })),
    total: 0,
  }
}

const EMPTY_KPIS: AdministracionKpis = {
  categories: CATEGORY_DEFINITIONS.map((category) => ({
    ...category,
    shortLabel: category.key,
    income: 0,
    incomePercentage: 0,
    clients: 0,
    clientsPercentage: 0,
    averageTicket: 0,
  })),
  totalIncome: 0,
  totalClients: 0,
  averageTicket: 0,
  evidences: [
    { label: "Si", value: 0, percentage: 0 },
    { label: "No", value: 0, percentage: 0 },
  ],
  totalEvidences: 0,
  ignoredEvidenceRecords: 0,
  uncategorizedRecords: 0,
  missingCostRecords: 0,
  missingClientRecords: 0,
  commercialTracking: {
    weekLabels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
    quoteSent: createEmptyCommercialGroup(),
    sales: createEmptyCommercialGroup(),
    leads: [0, 0, 0, 0],
    newClients: [0, 0, 0, 0],
    conversionRates: [0, 0, 0, 0],
  },
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function parseMoney(value: unknown) {
  const raw = String(value ?? "").trim().replace(/[^0-9.,-]/g, "")
  if (!raw) return 0

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

  const parsed = Number.parseFloat(normalized) * sign
  return Number.isFinite(parsed) ? parsed : 0
}

function calcPercentage(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 10_000) / 100
}

function hasQuoteNumber(value: unknown) {
  const normalized = normalizeText(value)
  return normalized !== "" && normalized !== "-"
}

function isSentQuote(row: SeguimientoRow) {
  return normalizeText(row.estado_cliente).includes("COTIZACION ENVIADA")
    && hasQuoteNumber(row.numero_cotizacion)
}

function isSale(row: SeguimientoRow) {
  return normalizeText(row.estado_seguimiento).includes("VENTA")
}

function buildCommercialGroup(amountsByCategory: Map<CategoryKey, CommercialWeeklyAmounts>): CommercialTrackingAmountGroup {
  const categories = CATEGORY_DEFINITIONS.map((category, index) => {
    const weeklyAmounts = amountsByCategory.get(category.key) ?? emptyWeeklyAmounts()
    const total = weeklyAmounts.reduce((sum, amount) => sum + amount, 0)
    return {
      key: category.key,
      label: `CLIENTE ${index + 1} (${category.key})`,
      weeklyAmounts,
      total,
      percentage: 0,
    }
  })
  const total = categories.reduce((sum, category) => sum + category.total, 0)
  const weeklyTotals = [0, 1, 2, 3].map((weekIndex) => (
    categories.reduce((sum, category) => sum + category.weeklyAmounts[weekIndex], 0)
  )) as CommercialWeeklyAmounts

  return {
    weeklyTotals,
    categories: categories.map((category) => ({
      ...category,
      percentage: calcPercentage(category.total, total),
    })),
    total,
  }
}

function resolveSeguimientoCategory(row: SeguimientoRow): CategoryKey | null {
  const categoryText = normalizeText(`${row.categoria_servicio ?? ""} ${row.servicio_solicitado ?? ""}`)

  if (/\bENS\s*\.?\s*V\.?\b/.test(categoryText)) return "ENS.V."
  if (/\bPROB\b/.test(categoryText)) return "PROB"
  if (/\bEMS\b/.test(categoryText)) return "EMS"
  if (/\bALQ\b/.test(categoryText)) return "ALQ"
  if (/\bDEN\b/.test(categoryText)) return "DEN"
  return null
}

function resolveControlCommercialCategory(row: ControlCommercialRow): CategoryKey | null {
  const sampleCode = normalizeText(row.codigo_muestra)
  const serviceDescription = normalizeText(row.descripcion_servicio)
  const categoryText = `${sampleCode} ${serviceDescription}`.trim()
  if (!categoryText) return null

  if (/DENSIDAD|\bDEN\b/.test(categoryText)) return "DEN"
  if (/\bEMS\b|MECANICA DE SUELOS|ESTUDIO DE SUELOS/.test(categoryText)) return "EMS"
  if (/\bALQ\b|ALQUILER/.test(categoryText)) return "ALQ"
  if (/PROBETA|CONCRETO|CILINDRO|COMPRESION|ROTURA|\bCO\b/.test(categoryText)) return "PROB"
  return "ENS.V."
}

function resolveClientKey(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized || /^-+$/.test(normalized)) return null
  return normalized
}

function resolveEvidenceStatus(value: unknown): "Si" | "No" | null {
  const normalized = normalizeText(value)
  if (normalized === "SI") return "Si"
  if (normalized === "NO") return "No"
  return null
}

function createAvailableMonths(): MonthOption[] {
  const today = new Date()
  const result: MonthOption[] = []

  for (let year = today.getFullYear(); year >= today.getFullYear() - 2; year -= 1) {
    const firstMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12
    for (let month = firstMonth; month >= 1; month -= 1) {
      result.push({
        value: `${year}-${String(month).padStart(2, "0")}`,
        label: `${MONTH_NAMES[month - 1]} ${year}`,
        year,
        month,
      })
    }
  }

  return result
}

async function fetchSeguimientoRows(apiUrl: string) {
  const pageSize = 10_000
  const fetchPage = async (offset: number) => {
    const response = await authFetch(`${apiUrl}/api/seguimiento-comercial?limit=${pageSize}&offset=${offset}`)
    if (!response.ok) throw new Error(`Seguimiento respondió ${response.status}`)
    return response.json() as Promise<{ total?: number; items?: SeguimientoRow[] }>
  }

  const firstPage = await fetchPage(0)
  const firstItems = firstPage.items ?? []
  const total = Number(firstPage.total ?? firstItems.length)
  if (total <= firstItems.length) return firstItems

  const remainingOffsets = Array.from(
    { length: Math.max(0, Math.ceil(total / pageSize) - 1) },
    (_, index) => (index + 1) * pageSize,
  )
  const remainingPages = await Promise.all(remainingOffsets.map(fetchPage))
  return [...firstItems, ...remainingPages.flatMap((page) => page.items ?? [])]
}

async function fetchControlCommercialRows(startDate: string, endDate: string) {
  const pageSize = 1_000
  const rows: ControlCommercialRow[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("cuadro_control")
      .select("codigo_muestra,cliente_nombre,descripcion_servicio,costo_servicio,evidencia_solicitud_envio,activo")
      .gte("fecha_recepcion", startDate)
      .lt("fecha_recepcion", endDate)
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const page = (data ?? []) as ControlCommercialRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return rows
}

export function useAdministracionKpis() {
  const [today] = useState(() => new Date())
  const [selectedMonth, setSelectedMonthState] = useState(String(today.getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [availableMonths] = useState<MonthOption[]>(createAvailableMonths)
  const [kpis, setKpis] = useState<AdministracionKpis>(EMPTY_KPIS)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)

  const setSelectedMonth = useCallback((month: string, year?: number) => {
    const monthNumber = Number.parseInt(month, 10)
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return

    setSelectedMonthState(String(monthNumber))
    if (year !== undefined) setSelectedYear(year)
  }, [])

  const fetchKpis = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setTrackingError(null)

    try {
      const month = Number.parseInt(selectedMonth, 10)
      const startDate = `${selectedYear}-${String(month).padStart(2, "0")}-01`
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? selectedYear + 1 : selectedYear
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

      const [seguimientoResult, controlCommercialResult] = await Promise.allSettled([
        fetchSeguimientoRows(apiUrl),
        fetchControlCommercialRows(startDate, endDate),
      ])
      if (controlCommercialResult.status === "rejected") {
        throw controlCommercialResult.reason
      }
      const allControlCommercialRows = controlCommercialResult.value
      const allSeguimientoRows = seguimientoResult.status === "fulfilled" ? seguimientoResult.value : []
      if (seguimientoResult.status === "rejected") {
        console.error("Error fetching Seguimiento Comercial 1:", seguimientoResult.reason)
        setTrackingError("No se pudo cargar Seguimiento Comercial 1. Los indicadores de Control Comercial sí permanecen disponibles.")
      }

      const seguimientoRows = allSeguimientoRows.filter((row) => {
        if (!row.fecha_contacto) return false
        const datePart = String(row.fecha_contacto).split("T")[0]
        return datePart >= startDate && datePart < endDate
      })

      const controlCommercialRows = allControlCommercialRows.filter((row) => row.activo !== false)
      const accumulators = new Map<CategoryKey, { income: number; clients: Set<string> }>(
        CATEGORY_DEFINITIONS.map((category) => [category.key, { income: 0, clients: new Set<string>() }]),
      )
      const quoteAmountsByCategory = new Map<CategoryKey, CommercialWeeklyAmounts>(
        CATEGORY_DEFINITIONS.map((category) => [category.key, emptyWeeklyAmounts()]),
      )
      const saleAmountsByCategory = new Map<CategoryKey, CommercialWeeklyAmounts>(
        CATEGORY_DEFINITIONS.map((category) => [category.key, emptyWeeklyAmounts()]),
      )
      const weeklyLeads = emptyWeeklyAmounts()
      const weeklyNewClients = emptyWeeklyAmounts()
      let uncategorizedRecords = 0
      let missingCostRecords = 0
      let missingClientRecords = 0

      for (const row of controlCommercialRows) {
        const category = resolveControlCommercialCategory(row)
        if (!category) {
          uncategorizedRecords += 1
          continue
        }

        const accumulator = accumulators.get(category)
        if (!accumulator) continue
        const amount = parseMoney(row.costo_servicio)
        accumulator.income += amount
        const clientKey = resolveClientKey(row.cliente_nombre)
        if (clientKey) accumulator.clients.add(clientKey)
        else missingClientRecords += 1
        if (amount <= 0) missingCostRecords += 1
      }

      for (const row of seguimientoRows) {
        const datePart = String(row.fecha_contacto).split("T")[0]
        const day = Number.parseInt(datePart.slice(8, 10), 10)
        const weekIndex = Number.isInteger(day) && day > 0 ? Math.min(3, Math.floor((day - 1) / 7)) : null
        const sale = isSale(row)

        if (weekIndex !== null) {
          if (hasQuoteNumber(row.numero_cotizacion)) weeklyLeads[weekIndex] += 1
          if (sale) weeklyNewClients[weekIndex] += 1
        }

        const category = resolveSeguimientoCategory(row)
        if (!category) continue
        const amount = parseMoney(row.costo_cotiz_sin_igv)
        if (weekIndex !== null && amount > 0) {
          if (isSentQuote(row)) quoteAmountsByCategory.get(category)![weekIndex] += amount
          if (sale) saleAmountsByCategory.get(category)![weekIndex] += amount
        }
      }

      const totalIncome = Array.from(accumulators.values()).reduce((sum, item) => sum + item.income, 0)
      const totalClients = Array.from(accumulators.values()).reduce((sum, item) => sum + item.clients.size, 0)
      const categories = CATEGORY_DEFINITIONS.map((category) => {
        const accumulator = accumulators.get(category.key)!
        const clients = accumulator.clients.size
        return {
          ...category,
          shortLabel: category.key,
          income: accumulator.income,
          incomePercentage: calcPercentage(accumulator.income, totalIncome),
          clients,
          clientsPercentage: calcPercentage(clients, totalClients),
          averageTicket: clients > 0 ? accumulator.income / clients : 0,
        }
      })
      const totalAverageTicket = categories.reduce((sum, category) => sum + category.averageTicket, 0)

      let yesCount = 0
      let noCount = 0
      let ignoredEvidenceRecords = 0
      for (const row of controlCommercialRows) {
        const evidenceStatus = resolveEvidenceStatus(row.evidencia_solicitud_envio)
        if (evidenceStatus === "Si") yesCount += 1
        else if (evidenceStatus === "No") noCount += 1
        else ignoredEvidenceRecords += 1
      }
      const totalEvidences = yesCount + noCount
      const quoteSent = buildCommercialGroup(quoteAmountsByCategory)
      const sales = buildCommercialGroup(saleAmountsByCategory)
      const conversionRates = weeklyLeads.map((leads, index) => (
        leads > 0 ? Math.round((weeklyNewClients[index] / leads) * 10_000) / 100 : 0
      )) as CommercialWeeklyAmounts

      setKpis({
        categories,
        totalIncome,
        totalClients,
        averageTicket: totalAverageTicket,
        evidences: [
          { label: "Si", value: yesCount, percentage: calcPercentage(yesCount, totalEvidences) },
          { label: "No", value: noCount, percentage: calcPercentage(noCount, totalEvidences) },
        ],
        totalEvidences,
        ignoredEvidenceRecords,
        uncategorizedRecords,
        missingCostRecords,
        missingClientRecords,
        commercialTracking: {
          weekLabels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
          quoteSent,
          sales,
          leads: weeklyLeads,
          newClients: weeklyNewClients,
          conversionRates,
        },
      })
      setLastUpdated(new Date())
    } catch (fetchError) {
      console.error("Error fetching administration KPIs:", fetchError)
      setKpis(EMPTY_KPIS)
      setError("No se pudieron cargar los KPIs de Administración.")
    } finally {
      setIsLoading(false)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    void fetchKpis()
  }, [fetchKpis])

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void fetchKpis()
    }
    const intervalId = window.setInterval(refreshWhenVisible, 30_000)
    window.addEventListener("focus", refreshWhenVisible)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener("focus", refreshWhenVisible)
    }
  }, [fetchKpis])

  return {
    kpis,
    isLoading,
    error,
    trackingError,
    lastUpdated,
    selectedMonth,
    selectedYear,
    availableMonths,
    setSelectedMonth,
    refresh: fetchKpis,
  }
}
