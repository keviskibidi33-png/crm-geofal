"use client"

import { useCallback, useEffect, useState } from "react"

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

interface ControlCommercialRow {
  codigo_muestra: string | null
  cliente_nombre: string | null
  descripcion_servicio: string | null
  proyecto: string | null
  costo_servicio: string | number | null
  evidencia_solicitud_envio: string | null
  activo: boolean | null
}

export interface GerenciaKpiCategory {
  key: CategoryKey
  label: string
  shortLabel: CategoryKey
  income: number
  incomePercentage: number
  clients: number
  clientsPercentage: number
  averageTicket: number
}

export interface GerenciaEvidenceKpi {
  label: "Si" | "No"
  value: number
  percentage: number
}

export interface GerenciaKpis {
  categories: GerenciaKpiCategory[]
  totalIncome: number
  totalClients: number
  averageTicket: number
  evidences: GerenciaEvidenceKpi[]
  totalEvidences: number
  ignoredEvidenceRecords: number
  uncategorizedRecords: number
  missingCostRecords: number
  missingClientRecords: number
}

const EMPTY_KPIS: GerenciaKpis = {
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

  const parsed = Number.parseFloat(normalized) * sign
  return Number.isFinite(parsed) ? parsed : 0
}

function calcPercentage(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 10_000) / 100
}

function resolveControlCommercialCategory(row: ControlCommercialRow): CategoryKey | null {
  const sampleCode = normalizeText(row.codigo_muestra)
  const serviceDescription = normalizeText(row.descripcion_servicio)
  const project = normalizeText(row.proyecto)

  // 1. Clasificación Primaria: Por CODIGO MUESTRA de Laboratorio
  if (sampleCode && !/^[-_.\s]+$/.test(sampleCode)) {
    // Categoría 4 (ALQ): ALQUILER, ALQ
    if (/\bALQ\b|ALQUILER/.test(sampleCode)) return "ALQ"

    // Categoría 1 (DEN): DEN, DENSIDAD, DENSIDADES
    if (/\bDEN\b|DENSIDAD/.test(sampleCode)) return "DEN"

    // Categoría 3 (EMS): EMS, MECANICA DE SUELOS, ESTUDIO DE SUELOS
    if (/\bEMS\b|MECANICA DE SUELOS|ESTUDIO DE SUELOS/.test(sampleCode)) return "EMS"

    // Categoría 2 (PROB): CO, PROBETA, CONCRETO, CILINDRO, COMPRESION, ROTURA
    if (
      /\bCO\b|[-_]CO[-_]|[-_]CO\d+|\bCO[-_]\d+|\bCO\d+|PROBETA|CONCRETO|CILINDRO|COMPRESION|ROTURA/.test(sampleCode)
    ) {
      return "PROB"
    }

    // Cualquier otro código de muestra de Laboratorio (SU-..., AG-..., CH-..., HUM-..., M-..., etc.) es ENSAYOS VARIOS
    return "ENS.V."
  }

  // 2. Clasificación Secundaria (Fallback): Si no hay código de muestra, usar proyecto y descripción
  const fallbackText = `${project} ${serviceDescription}`.trim()
  if (!fallbackText || /^[-_.\s]+$/.test(fallbackText)) return null

  if (/\bALQ\b|ALQUILER/.test(fallbackText)) return "ALQ"
  if (/\bEMS\b|MECANICA DE SUELOS|ESTUDIO DE SUELOS/.test(fallbackText)) return "EMS"
  if (/DENSIDAD|\bDEN\b/.test(fallbackText)) return "DEN"
  if (/PROBETA|CONCRETO|CILINDRO|COMPRESION|ROTURA|\bCO\b/.test(fallbackText)) return "PROB"

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

async function fetchControlCommercialRows(startDate: string, endDate: string) {
  const pageSize = 1_000
  const rows: ControlCommercialRow[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("cuadro_control")
      .select("codigo_muestra,cliente_nombre,descripcion_servicio,proyecto,costo_servicio,evidencia_solicitud_envio,activo")
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

export function useGerenciaKpis() {
  const [today] = useState(() => new Date())
  const [selectedMonth, setSelectedMonthState] = useState(String(today.getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [availableMonths] = useState<MonthOption[]>(createAvailableMonths)
  const [kpis, setKpis] = useState<GerenciaKpis>(EMPTY_KPIS)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setSelectedMonth = useCallback((month: string, year?: number) => {
    const monthNumber = Number.parseInt(month, 10)
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) return

    setSelectedMonthState(String(monthNumber))
    if (year !== undefined) setSelectedYear(year)
  }, [])

  const fetchKpis = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const month = Number.parseInt(selectedMonth, 10)
      const startDate = `${selectedYear}-${String(month).padStart(2, "0")}-01`
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear = month === 12 ? selectedYear + 1 : selectedYear
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`
      const allControlCommercialRows = await fetchControlCommercialRows(startDate, endDate)

      const controlCommercialRows = allControlCommercialRows.filter((row) => row.activo !== false)
      const accumulators = new Map<CategoryKey, { income: number; clients: Set<string> }>(
        CATEGORY_DEFINITIONS.map((category) => [category.key, { income: 0, clients: new Set<string>() }]),
      )
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
      const totalAverageTicket = totalClients > 0 ? totalIncome / totalClients : 0

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
    lastUpdated,
    selectedMonth,
    selectedYear,
    availableMonths,
    setSelectedMonth,
    refresh: fetchKpis,
  }
}
