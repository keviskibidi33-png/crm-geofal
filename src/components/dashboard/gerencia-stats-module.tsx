"use client"

import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  BadgeCheck,
  CircleDollarSign,
  LayoutDashboard,
  RefreshCw,
  TicketCheck,
  TrendingUp,
  Users,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts"

import { MonthSelector } from "@/components/dashboard/kpi-charts"
import { GerenciaCommercialTracking } from "@/components/dashboard/gerencia-commercial-tracking"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { useGerenciaKpis } from "@/hooks/use-gerencia-kpis"

const CATEGORY_COLORS = ["#f59e0b", "#22c55e", "#ef4444", "#3b82f6", "#8b5cf6"]
const EVIDENCE_COLORS = ["#16a34a", "#ef4444"]

const chartConfig = {
  value: {
    label: "Valor",
    color: "#2563eb",
  },
} satisfies ChartConfig

const moneyFormatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 0,
})

function formatMoney(value: number) {
  return moneyFormatter.format(value).replace("PEN", "S/")
}

function formatPercentage(value: number) {
  return `${value.toLocaleString("es-PE", { maximumFractionDigits: 2 })}%`
}

function formatCompact(value: number, monetary: boolean) {
  const formatted = new Intl.NumberFormat("es-PE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
  return monetary ? `S/ ${formatted}` : formatted
}

interface ChartDatum {
  label: string
  shortLabel: string
  value: number
  fill: string
  displayValue: string
}

function MetricBarChart({
  data,
  monetary = false,
  loading,
}: {
  data: ChartDatum[]
  monetary?: boolean
  loading: boolean
}) {
  if (loading) {
    return <div className="h-[250px] animate-pulse rounded-xl bg-slate-100" />
  }

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <ChartContainer config={chartConfig} className="h-[250px] w-full">
        <BarChart data={data} margin={{ top: 30, right: 12, left: monetary ? 16 : 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={monetary ? 72 : 42}
            tickFormatter={(value) => formatCompact(Number(value), monetary)}
          />
          <ChartTooltip
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
            content={
              <ChartTooltipContent
                labelKey="label"
                formatter={(_, __, item) => (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">Valor</span>
                    <span className="font-mono font-semibold">{String(item.payload?.displayValue ?? "0")}</span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="value" radius={[7, 7, 0, 0]} maxBarSize={72}>
            {data.map((item) => (
              <Cell key={item.label} fill={item.fill} />
            ))}
            <LabelList dataKey="displayValue" position="top" className="fill-slate-600 text-[10px] font-semibold" />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}

function KpiPanel({
  title,
  description,
  source,
  icon,
  children,
  chart,
}: {
  title: string
  description: string
  source: string
  icon: ReactNode
  children: ReactNode
  chart: ReactNode
}) {
  return (
    <section className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            {icon}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-950">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
          Fuente: {source}
        </span>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(440px,0.95fr)_minmax(420px,1.05fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200">{children}</div>
        {chart}
      </div>
    </section>
  )
}

function TableSkeleton({ rows = 5, columns = 3 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        <tr key={index} className="border-b border-slate-100 last:border-b-0">
          <td className="px-4 py-3" colSpan={columns}>
            <div className="h-5 animate-pulse rounded bg-slate-100" />
          </td>
        </tr>
      ))}
    </>
  )
}

function TableHeaderCell({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <th className={`bg-slate-100 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 ${numeric ? "text-right" : "text-left"}`}>
      {children}
    </th>
  )
}

function TotalRow({ children }: { children: ReactNode }) {
  return <tr className="bg-slate-50 font-bold text-slate-900">{children}</tr>
}

export function GerenciaStatsModule() {
  const [dashboardView, setDashboardView] = useState<"indicadores" | "seguimiento">("indicadores")
  const {
    kpis,
    isLoading,
    error,
    trackingError,
    lastUpdated,
    refresh,
    selectedMonth,
    selectedYear,
    availableMonths,
    setSelectedMonth,
  } = useGerenciaKpis()

  const incomeChart = kpis.categories.map((category, index) => ({
    label: category.label,
    shortLabel: category.shortLabel,
    value: category.income,
    fill: CATEGORY_COLORS[index],
    displayValue: formatCompact(category.income, true),
  }))
  const clientsChart = kpis.categories.map((category, index) => ({
    label: category.label,
    shortLabel: category.shortLabel,
    value: category.clients,
    fill: CATEGORY_COLORS[index],
    displayValue: numberFormatter.format(category.clients),
  }))
  const ticketChart = kpis.categories.map((category, index) => ({
    label: category.label,
    shortLabel: category.shortLabel,
    value: category.averageTicket,
    fill: CATEGORY_COLORS[index],
    displayValue: formatCompact(category.averageTicket, true),
  }))
  const evidenceChart = kpis.evidences.map((item, index) => ({
    label: item.label,
    shortLabel: item.label,
    value: item.value,
    fill: EVIDENCE_COLORS[index],
    displayValue: numberFormatter.format(item.value),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Gerencia</h2>
          <p className="text-sm text-muted-foreground">
            Indicadores gerenciales de Laboratorio y Comercial del mes seleccionado.
            {lastUpdated ? <span className="ml-2">Actualizado: {lastUpdated.toLocaleTimeString("es-PE")}</span> : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <MonthSelector
            availableMonths={availableMonths}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            loading={isLoading}
          />
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-lg bg-muted p-0.5">
        <Button
          type="button"
          variant={dashboardView === "indicadores" ? "default" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setDashboardView("indicadores")}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          Indicadores Gerenciales
        </Button>
        <Button
          type="button"
          variant={dashboardView === "seguimiento" ? "default" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setDashboardView("seguimiento")}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Estadística Comercial
        </Button>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {dashboardView === "seguimiento" && trackingError ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {trackingError}
        </div>
      ) : null}

      {dashboardView === "indicadores" ? (
        <>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
        <span className="font-bold text-slate-800">Clasificación desde Laboratorio:</span> DENSIDAD/DEN → DEN; PROBETA/CONCRETO/CILINDRO/COMPRESIÓN/ROTURA/CO → PROB; EMS o Mecánica de Suelos → EMS; ALQ/ALQUILER → ALQ; los demás códigos → ENS.V.
      </div>
      {kpis.uncategorizedRecords > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {kpis.uncategorizedRecords} registro(s) de Control Comercial no tienen código de muestra ni descripción y no se incluyen en los totales.
        </div>
      ) : null}

      {kpis.missingCostRecords > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {kpis.missingCostRecords} trabajo(s) no tienen costo del servicio con IGV. Se contabilizan en cantidad, pero aportan S/ 0.00 al ingreso.
        </div>
      ) : null}

      {kpis.missingClientRecords > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {kpis.missingClientRecords} trabajo(s) no tienen nombre de cliente y no se incluyen en Número de clientes ni en el divisor del Ticket promedio.
        </div>
      ) : null}

      <KpiPanel
        title="INGRESO DE TRABAJO POR RECEPCIÓN"
        description="Suma del costo del servicio con IGV, relacionando cada código de muestra de Laboratorio con su fila de Control Comercial."
        source="Laboratorio + Comercial"
        icon={<CircleDollarSign className="h-5 w-5" />}
        chart={<MetricBarChart data={incomeChart} monetary loading={isLoading} />}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <TableHeaderCell>Descripción</TableHeaderCell>
              <TableHeaderCell numeric>Costo S/.</TableHeaderCell>
              <TableHeaderCell numeric>Costo %</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableSkeleton columns={3} /> : kpis.categories.map((category) => (
              <tr key={category.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                <td className="px-4 py-2.5 font-medium text-slate-700">{category.label}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatMoney(category.income)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatPercentage(category.incomePercentage)}</td>
              </tr>
            ))}
            {!isLoading ? (
              <TotalRow>
                <td className="px-4 py-3">Monto total</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMoney(kpis.totalIncome)}</td>
                <td className="px-4 py-3 text-right">{kpis.totalIncome > 0 ? "100%" : "0%"}</td>
              </TotalRow>
            ) : null}
          </tbody>
        </table>
      </KpiPanel>

      <KpiPanel
        title="NÚMERO DE CLIENTES"
        description="Empresas únicas por categoría, identificadas por el nombre de cliente registrado en Laboratorio."
        source="Laboratorio + Comercial"
        icon={<Users className="h-5 w-5" />}
        chart={<MetricBarChart data={clientsChart} loading={isLoading} />}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <TableHeaderCell>Descripción</TableHeaderCell>
              <TableHeaderCell numeric>Cant. und</TableHeaderCell>
              <TableHeaderCell numeric>Cant. %</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableSkeleton columns={3} /> : kpis.categories.map((category) => (
              <tr key={category.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                <td className="px-4 py-2.5 font-medium text-slate-700">{category.label}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{numberFormatter.format(category.clients)}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatPercentage(category.clientsPercentage)}</td>
              </tr>
            ))}
            {!isLoading ? (
              <TotalRow>
                <td className="px-4 py-3">Total clientes</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{numberFormatter.format(kpis.totalClients)}</td>
                <td className="px-4 py-3 text-right">{kpis.totalClients > 0 ? "100%" : "0%"}</td>
              </TotalRow>
            ) : null}
          </tbody>
        </table>
      </KpiPanel>

      <KpiPanel
        title="KPI TICKET PROMEDIO"
        description="Por categoría: costo con IGV ÷ clientes únicos. El total final suma los cinco tickets promedio, igual que el Excel."
        source="Laboratorio + Comercial"
        icon={<TicketCheck className="h-5 w-5" />}
        chart={<MetricBarChart data={ticketChart} monetary loading={isLoading} />}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <TableHeaderCell>Descripción</TableHeaderCell>
              <TableHeaderCell numeric>Costo S/.</TableHeaderCell>
              <TableHeaderCell numeric>Cant. und</TableHeaderCell>
              <TableHeaderCell numeric>Ticket prom. S/.</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableSkeleton columns={4} /> : kpis.categories.map((category) => (
              <tr key={category.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                <td className="px-4 py-2.5 font-medium text-slate-700">{category.label}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatMoney(category.income)}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{numberFormatter.format(category.clients)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{formatMoney(category.averageTicket)}</td>
              </tr>
            ))}
            {!isLoading ? (
              <TotalRow>
                <td className="px-4 py-3">Monto total</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMoney(kpis.totalIncome)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{numberFormatter.format(kpis.totalClients)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatMoney(kpis.averageTicket)}</td>
              </TotalRow>
            ) : null}
          </tbody>
        </table>
      </KpiPanel>

      <KpiPanel
        title="EVIDENCIA DE RECEPCIONES"
        description="Clasificación directa del campo Evidencias de Control Comercial: SI se cuenta como Si y NO como No."
        source="Laboratorio + Comercial"
        icon={<BadgeCheck className="h-5 w-5" />}
        chart={<MetricBarChart data={evidenceChart} loading={isLoading} />}
      >
        <table className="w-full text-sm">
          <thead>
            <tr>
              <TableHeaderCell>Descripción</TableHeaderCell>
              <TableHeaderCell numeric>Cant. und</TableHeaderCell>
              <TableHeaderCell numeric>Cant. %</TableHeaderCell>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <TableSkeleton rows={2} columns={3} /> : kpis.evidences.map((item) => (
              <tr key={item.label} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70">
                <td className="px-4 py-3 font-medium text-slate-700">{item.label}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{numberFormatter.format(item.value)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPercentage(item.percentage)}</td>
              </tr>
            ))}
            {!isLoading ? (
              <TotalRow>
                <td className="px-4 py-3">Total recepciones</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{numberFormatter.format(kpis.totalEvidences)}</td>
                <td className="px-4 py-3 text-right">{kpis.totalEvidences > 0 ? "100%" : "0%"}</td>
              </TotalRow>
            ) : null}
            {!isLoading && kpis.ignoredEvidenceRecords > 0 ? (
              <tr className="border-t border-amber-200 bg-amber-50 text-amber-800">
                <td colSpan={3} className="px-4 py-2.5 text-xs">
                  {kpis.ignoredEvidenceRecords} registro(s) con evidencia vacía o distinta de SI/NO no se incluyen en el total.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </KpiPanel>
        </>
      ) : (
        <GerenciaCommercialTracking data={kpis.commercialTracking} loading={isLoading} />
      )}
    </div>
  )
}
