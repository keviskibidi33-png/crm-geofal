"use client"

import { useCallback, useEffect, useState } from "react"

import { authFetch } from "@/lib/api-auth"

const CATEGORY_DEFINITIONS = [
  { key: "DEN", label: "Categoría 1 (DEN)" },
  { key: "PROB", label: "Categoría 2 (PROB)" },
  { key: "EMS", label: "Categoría 3 (EMS)" },
  { key: "ALQ", label: "Categoría 4 (ALQ)" },
  { key: "ENS.V.", label: "Categoría 5 (ENS.V.)" },
] as const

type CategoryKey = (typeof CATEGORY_DEFINITIONS)[number]["key"]

interface SeguimientoRow {
  fecha_contacto: string | null
  servicio_solicitado: string | null
  categoria_servicio: string | null
  costo_cotiz_sin_igv: string | null
  estado_cliente: string | null
  estado_seguimiento: string | null
  numero_cotizacion: string | null
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

function emptyWeeklyAmounts(): CommercialWeeklyAmounts {
  return [0, 0, 0, 0]
}

function createEmptyCommercialGroup(): CommercialTrackingAmountGroup {
  return {
    weeklyTotals: emptyWeeklyAmounts(),
    categories: CATEGORY_DEFINITIONS.map((category, index) => ({
      key: category.key,
      label: `Categoría ${index + 1} (${category.key})`,
      weeklyAmounts: emptyWeeklyAmounts(),
      total: 0,
      percentage: 0,
    })),
    total: 0,
  }
}

const EMPTY_COMMERCIAL_TRACKING: CommercialTrackingKpis = {
  weekLabels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
  quoteSent: createEmptyCommercialGroup(),
  sales: createEmptyCommercialGroup(),
  leads: [0, 0, 0, 0],
  newClients: [0, 0, 0, 0],
  conversionRates: [0, 0, 0, 0],
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

function resolveSeguimientoCategory(row: SeguimientoRow): CategoryKey | null {
  const categoryText = normalizeText(`${row.categoria_servicio ?? ""} ${row.servicio_solicitado ?? ""}`)

  if (/\bENS\s*\.?\s*V\.?\b/.test(categoryText)) return "ENS.V."
  if (/ENSAYOS DE LABORATORIO/.test(categoryText)) return "ENS.V."
  if (/\bPROB\b/.test(categoryText)) return "PROB"
  if (/PROBETAS/.test(categoryText)) return "PROB"
  if (/\bEMS\b/.test(categoryText)) return "EMS"
  if (/ESTUDIOS DE SUELOS|ENSAYOS DE SUELOS/.test(categoryText)) return "EMS"
  if (/\bALQ\b/.test(categoryText)) return "ALQ"
  if (/ALQUILER/.test(categoryText)) return "ALQ"
  if (/\bDEN\b/.test(categoryText)) return "DEN"
  if (/DENSIDADES?/.test(categoryText)) return "DEN"
  return null
}

function buildCommercialGroup(amountsByCategory: Map<CategoryKey, CommercialWeeklyAmounts>): CommercialTrackingAmountGroup {
  const categories = CATEGORY_DEFINITIONS.map((category, index) => {
    const weeklyAmounts = amountsByCategory.get(category.key) ?? emptyWeeklyAmounts()
    const total = weeklyAmounts.reduce((sum, amount) => sum + amount, 0)
    return {
      key: category.key,
      label: `Categoría ${index + 1} (${category.key})`,
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

export function useCommercialTrackingKpis(selectedMonth: string, selectedYear: number) {
  const [kpis, setKpis] = useState<CommercialTrackingKpis>(EMPTY_COMMERCIAL_TRACKING)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKpis = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const month = Number.parseInt(selectedMonth, 10)
      if (!Number.isInteger(month) || month < 1 || month > 12) return

      const startDate = `${selectedYear}-${String(month).padStart(2, "0")}-01`
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? selectedYear + 1 : selectedYear
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

      const seguimientoRows = (await fetchSeguimientoRows(apiUrl)).filter((row) => {
        if (!row.fecha_contacto) return false
        const datePart = String(row.fecha_contacto).split("T")[0]
        return datePart >= startDate && datePart < endDate
      })

      const quoteAmountsByCategory = new Map<CategoryKey, CommercialWeeklyAmounts>(
        CATEGORY_DEFINITIONS.map((category) => [category.key, emptyWeeklyAmounts()]),
      )
      const saleAmountsByCategory = new Map<CategoryKey, CommercialWeeklyAmounts>(
        CATEGORY_DEFINITIONS.map((category) => [category.key, emptyWeeklyAmounts()]),
      )
      const weeklyLeads = emptyWeeklyAmounts()
      const weeklyNewClients = emptyWeeklyAmounts()

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

      const conversionRates = weeklyLeads.map((leads, index) => (
        leads > 0 ? Math.round((weeklyNewClients[index] / leads) * 10_000) / 100 : 0
      )) as CommercialWeeklyAmounts

      setKpis({
        weekLabels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
        quoteSent: buildCommercialGroup(quoteAmountsByCategory),
        sales: buildCommercialGroup(saleAmountsByCategory),
        leads: weeklyLeads,
        newClients: weeklyNewClients,
        conversionRates,
      })
    } catch (fetchError) {
      console.error("Error fetching commercial tracking KPIs:", fetchError)
      setKpis(EMPTY_COMMERCIAL_TRACKING)
      setError("No se pudo cargar Resumen Comercial 1.")
    } finally {
      setIsLoading(false)
    }
  }, [selectedMonth, selectedYear])

  useEffect(() => {
    void fetchKpis()
  }, [fetchKpis])

  return {
    kpis,
    isLoading,
    error,
    refresh: fetchKpis,
  }
}
