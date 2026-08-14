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
  fecha_contacto?: string | null
  fecha_ultimo_contacto?: string | null
  fecha_creacion?: string | null
  created_at?: string | null
  servicio_solicitado?: string | null
  categoria_servicio?: string | null
  categoria_cliente?: string | null
  costo_cotiz_sin_igv?: string | null
  monto?: string | number | null
  costo?: string | number | null
  costo_cotizacion?: string | number | null
  estado_cliente?: string | null
  estado_seguimiento?: string | null
  numero_cotizacion?: string | null
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
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return Number.isFinite(value) ? value : 0

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

function getRowAmount(row: SeguimientoRow): number {
  return parseMoney(
    row.costo_cotiz_sin_igv ?? row.monto ?? row.costo ?? row.costo_cotizacion
  )
}

function calcPercentage(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 10_000) / 100
}

function hasQuoteNumber(value: unknown) {
  const normalized = normalizeText(value)
  if (!normalized || normalized === "-") return false
  // Excluir placeholders de fecha ingresados provisionalmente por los asesores (ej: 04/08, 02/06, 04-08)
  if (/^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/.test(normalized)) return false
  return true
}

function toIsoDatePart(value: unknown): string | null {
  const raw = String(value ?? "").trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/)
  if (iso) {
    const year = iso[1]
    const month = iso[2].padStart(2, "0")
    const day = iso[3].padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const slash = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/)
  if (slash) {
    const day = slash[1].padStart(2, "0")
    const month = slash[2].padStart(2, "0")
    const numericYear = Number.parseInt(slash[3], 10)
    const year = slash[3].length === 2 ? 2000 + numericYear : numericYear
    return `${year}-${month}-${day}`
  }

  return null
}

function getRowDate(row: SeguimientoRow): string | null {
  return (
    toIsoDatePart(row.fecha_contacto) ||
    toIsoDatePart(row.fecha_ultimo_contacto) ||
    toIsoDatePart(row.fecha_creacion) ||
    toIsoDatePart(row.created_at)
  )
}

/**
 * Cotización enviada se alimenta del patrón: Fecha de contacto + costo sin IGV + categoría cliente.
 */
function isSentQuote(_row: SeguimientoRow) {
  return true
}

function isSale(row: SeguimientoRow) {
  const estadoSegNorm = normalizeText(row.estado_seguimiento)
  return estadoSegNorm === "VENTA"
}

function resolveSeguimientoCategory(row: SeguimientoRow): CategoryKey | null {
  // 1. Strict priority for explicit categoria_cliente / categoria_servicio selection
  const explicitCategory = normalizeText(
    `${row.categoria_cliente ?? ""} ${row.categoria_servicio ?? ""}`
  )

  if (explicitCategory) {
    if (explicitCategory.includes("CATEGORIA 1") || /\bDEN\b/.test(explicitCategory)) {
      return "DEN"
    }
    if (explicitCategory.includes("CATEGORIA 2") || /\bPROB\b/.test(explicitCategory)) {
      return "PROB"
    }
    if (explicitCategory.includes("CATEGORIA 3") || /\bEMS\b/.test(explicitCategory)) {
      return "EMS"
    }
    if (explicitCategory.includes("CATEGORIA 4") || /\bALQ\b/.test(explicitCategory)) {
      return "ALQ"
    }
    if (explicitCategory.includes("CATEGORIA 5") || /\bENS\s*\.?\s*V\.?\b/.test(explicitCategory)) {
      return "ENS.V."
    }
  }

  // 2. Fallback only if no explicit category is assigned
  const serviceText = normalizeText(row.servicio_solicitado ?? "")
  if (!serviceText) return null

  if (/DENSIDA|DENSIME|\bDEN\b/.test(serviceText)) {
    return "DEN"
  }
  if (/PROBETA|ROTURA.*PROB|COMPRESION.*PROB|\bPROB\b/.test(serviceText)) {
    return "PROB"
  }
  if (/ESTUDIO.*SUELO|ENSAYO.*SUELO|SUELOS|\bEMS\b/.test(serviceText)) {
    return "EMS"
  }
  if (/ALQUILER|\bALQ\b/.test(serviceText)) {
    return "ALQ"
  }
  if (/ENSAYO|MEZCLA|AGREGADO|LADRILLO|CORTE DIRECTO|PROCTOR|BLOQUE|ROCA|LABORATORIO|\bENS\s*\.?\s*V\.?\b/.test(serviceText)) {
    return "ENS.V."
  }

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

async function fetchSeguimientoRows(apiUrl: string, asesor?: string) {
  const pageSize = 10_000
  const fetchPage = async (offset: number) => {
    const params = new URLSearchParams({ limit: String(pageSize), offset: String(offset) })
    if (asesor) params.append("asesor", asesor)
    const response = await authFetch(`${apiUrl}/api/seguimiento-comercial?${params.toString()}`)
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

export function useCommercialTrackingKpis(selectedMonth: string, selectedYear: number, selectedAdvisor?: string) {
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

      const seguimientoRows = (await fetchSeguimientoRows(apiUrl, selectedAdvisor)).filter((row) => {
        const datePart = getRowDate(row)
        return datePart !== null && datePart >= startDate && datePart < endDate
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
        const datePart = getRowDate(row)
        const day = Number.parseInt(datePart?.slice(8, 10) ?? "", 10)
        const weekIndex = Number.isInteger(day) && day > 0 ? Math.min(3, Math.floor((day - 1) / 7)) : null
        const sale = isSale(row)

        if (weekIndex !== null) {
          if (hasQuoteNumber(row.numero_cotizacion)) weeklyLeads[weekIndex] += 1
          if (sale) weeklyNewClients[weekIndex] += 1
        }

        const category = resolveSeguimientoCategory(row)
        if (!category) continue
        const amount = getRowAmount(row)
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
  }, [selectedMonth, selectedYear, selectedAdvisor])

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
