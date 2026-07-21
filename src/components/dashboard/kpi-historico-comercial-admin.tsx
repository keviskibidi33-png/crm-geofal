"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from "recharts"
import { Loader2, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react"
import type { HistoricalComercialKpis, HistoricalComercialMonthData, HistoricalAdminKpis, HistoricalAdminMonthData } from "@/hooks/use-kpis-data"

function getStatusBadge(current: number, previous?: number): { label: string; color: string } {
  if (previous === undefined || previous === null) return { label: "—", color: "bg-muted text-muted-foreground" }
  const diff = current - previous
  if (Math.abs(diff) < 1) return { label: "ESTABLE", color: "bg-amber-50 text-amber-700" }
  if (diff > 0) return { label: "CRECIMIENTO", color: "bg-emerald-50 text-emerald-700" }
  return { label: "RETROCESO", color: "bg-red-50 text-red-700" }
}

function getVariation(current: number, previous?: number): { text: string; icon: React.ReactNode; color: string } | null {
  if (previous === undefined || previous === null) return null
  const diff = current - previous
  if (Math.abs(diff) < 0.1) return { text: "0", icon: <Minus className="h-3 w-3" />, color: "text-muted-foreground" }
  const sign = diff > 0 ? "+" : ""
  return {
    text: `${sign}${diff.toFixed(1)}pp`,
    icon: diff > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />,
    color: diff > 0 ? "text-emerald-600" : "text-red-600",
  }
}

// ──────────────────────────────────────────────────────────
// HISTORICO COMERCIAL
// ──────────────────────────────────────────────────────────

interface KpiHistoricoComercialProps {
  data: HistoricalComercialKpis
  loading?: boolean
}

const COM_INDICATORS = [
  { key: "entregados" as const, label: "Entregados", color: "#16a34a" },
  { key: "enProceso" as const, label: "En Proceso", color: "#2563eb" },
  { key: "informeListo" as const, label: "Informe Listo", color: "#ca8a04" },
  { key: "anulados" as const, label: "Anulados", color: "#dc2626" },
  { key: "conFactura" as const, label: "Con Factura", color: "#8b5cf6" },
  { key: "pagados" as const, label: "Pagados", color: "#059669" },
  { key: "pendientes" as const, label: "Pendientes", color: "#f97316" },
]

export function KpiHistoricoComercial({ data, loading }: KpiHistoricoComercialProps) {
  if (loading) {
    return <div className="flex items-center justify-center h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!data || data.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No hay datos históricos disponibles</div>
  }

  const lastTwo = data.slice(-2)
  const currentMonth = lastTwo[lastTwo.length - 1]
  const previousMonth = lastTwo.length > 1 ? lastTwo[0] : undefined

  return (
    <div className="space-y-6">
      <ComKpiTable data={data} currentMonth={currentMonth} previousMonth={previousMonth} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ComEntregadosChart data={data} />
        <ComServiciosChart data={data} />
      </div>
    </div>
  )
}

function ComKpiTable({ data, currentMonth, previousMonth }: { data: HistoricalComercialKpis; currentMonth: HistoricalComercialMonthData; previousMonth?: HistoricalComercialMonthData }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">INDICADOR KPI COMERCIAL — Histórico Mensual</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium w-[200px]">INDICADOR</th>
                {data.map((m) => (
                  <th key={m.mes} className="text-center px-3 py-2.5 font-medium whitespace-nowrap">{m.label.split(" ")[0].substring(0, 3).toUpperCase()}<br /><span className="text-[10px] font-normal text-muted-foreground">{m.label.split(" ")[1]}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/10">
                <td className="px-4 py-2 font-semibold">Total Servicios</td>
                {data.map((m) => (
                  <td key={m.mes} className="text-center px-3 py-2 tabular-nums font-medium">{m.total}</td>
                ))}
                <td className="text-center px-3 py-2">
                  {previousMonth && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${currentMonth.total > previousMonth.total ? "bg-emerald-50 text-emerald-700" : currentMonth.total < previousMonth.total ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"}`}>
                      {currentMonth.total > previousMonth.total ? <TrendingUp className="h-3 w-3" /> : currentMonth.total < previousMonth.total ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {currentMonth.total > previousMonth.total ? "+" : ""}{((currentMonth.total - previousMonth.total) / Math.max(previousMonth.total, 1) * 100).toFixed(0)}%
                    </span>
                  )}
                </td>
              </tr>
              {COM_INDICATORS.map((ind) => {
                const cur = currentMonth[ind.key]
                const prev = previousMonth ? previousMonth[ind.key] : undefined
                const variation = getVariation(cur, prev)
                const status = getStatusBadge(cur, prev)
                return (
                  <tr key={ind.key} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{ind.label}</td>
                    {data.map((m) => (
                      <td key={m.mes} className="text-center px-3 py-2 tabular-nums">{m[ind.key]}</td>
                    ))}
                    <td className="text-center px-3 py-2">
                      {variation && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${variation.color}`}>
                          {variation.icon}{variation.text}
                        </span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2">
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function ComEntregadosChart({ data }: { data: HistoricalComercialKpis }) {
  const chartData = data.map(m => ({ name: m.label.split(" ")[0].substring(0, 3), fullLabel: m.label, entregados: m.entregados, enProceso: m.enProceso, informeListo: m.informeListo }))
  const config: ChartConfig = {
    entregados: { label: "Entregados", color: "#16a34a" },
    enProceso: { label: "En Proceso", color: "#2563eb" },
    informeListo: { label: "Informe Listo", color: "#ca8a04" },
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">TENDENCIA ESTADO DE TRABAJO POR MES</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent labelKey="fullLabel" />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="entregados" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="enProceso" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="informeListo" stroke="#ca8a04" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function ComServiciosChart({ data }: { data: HistoricalComercialKpis }) {
  const chartData = data.map(m => ({ name: m.label.split(" ")[0].substring(0, 3), fullLabel: m.label, conFactura: m.conFactura, pagados: m.pagados, pendientes: m.pendientes }))
  const config: ChartConfig = {
    conFactura: { label: "Con Factura", color: "#8b5cf6" },
    pagados: { label: "Pagados", color: "#059669" },
    pendientes: { label: "Pendientes", color: "#f97316" },
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">TENDENCIA FACTURACIÓN POR MES</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent labelKey="fullLabel" />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="conFactura" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="pagados" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="pendientes" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────────────────
// HISTORICO ADMINISTRACION
// ──────────────────────────────────────────────────────────

interface KpiHistoricoAdminProps {
  data: HistoricalAdminKpis
  loading?: boolean
}

const ADMIN_INDICATORS = [
  { key: "conFactura" as const, label: "Con Factura", color: "#8b5cf6" },
  { key: "sinFactura" as const, label: "Sin Factura", color: "#f97316" },
  { key: "pagado" as const, label: "Pagado", color: "#059669" },
  { key: "pendiente" as const, label: "Pendiente", color: "#dc2626" },
  { key: "sinRegistro" as const, label: "Sin Registro", color: "#6b7280" },
]

export function KpiHistoricoAdmin({ data, loading }: KpiHistoricoAdminProps) {
  if (loading) {
    return <div className="flex items-center justify-center h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!data || data.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No hay datos históricos disponibles</div>
  }

  const lastTwo = data.slice(-2)
  const currentMonth = lastTwo[lastTwo.length - 1]
  const previousMonth = lastTwo.length > 1 ? lastTwo[0] : undefined

  return (
    <div className="space-y-6">
      <AdminKpiTable data={data} currentMonth={currentMonth} previousMonth={previousMonth} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AdminFacturacionChart data={data} />
        <AdminEstadoPagoChart data={data} />
      </div>
    </div>
  )
}

function AdminKpiTable({ data, currentMonth, previousMonth }: { data: HistoricalAdminKpis; currentMonth: HistoricalAdminMonthData; previousMonth?: HistoricalAdminMonthData }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">INDICADOR KPI ADMINISTRACIÓN — Histórico Mensual</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium w-[200px]">INDICADOR</th>
                {data.map((m) => (
                  <th key={m.mes} className="text-center px-3 py-2.5 font-medium whitespace-nowrap">{m.label.split(" ")[0].substring(0, 3).toUpperCase()}<br /><span className="text-[10px] font-normal text-muted-foreground">{m.label.split(" ")[1]}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-muted/10">
                <td className="px-4 py-2 font-semibold">Total Servicios</td>
                {data.map((m) => (
                  <td key={m.mes} className="text-center px-3 py-2 tabular-nums font-medium">{m.total}</td>
                ))}
                <td className="text-center px-3 py-2">
                  {previousMonth && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${currentMonth.total > previousMonth.total ? "bg-emerald-50 text-emerald-700" : currentMonth.total < previousMonth.total ? "bg-red-50 text-red-700" : "bg-muted text-muted-foreground"}`}>
                      {currentMonth.total > previousMonth.total ? <TrendingUp className="h-3 w-3" /> : currentMonth.total < previousMonth.total ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {currentMonth.total > previousMonth.total ? "+" : ""}{((currentMonth.total - previousMonth.total) / Math.max(previousMonth.total, 1) * 100).toFixed(0)}%
                    </span>
                  )}
                </td>
              </tr>
              {ADMIN_INDICATORS.map((ind) => {
                const cur = currentMonth[ind.key]
                const prev = previousMonth ? previousMonth[ind.key] : undefined
                const variation = getVariation(cur, prev)
                const status = getStatusBadge(cur, prev)
                return (
                  <tr key={ind.key} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{ind.label}</td>
                    {data.map((m) => (
                      <td key={m.mes} className="text-center px-3 py-2 tabular-nums">{m[ind.key]}</td>
                    ))}
                    <td className="text-center px-3 py-2">
                      {variation && (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${variation.color}`}>
                          {variation.icon}{variation.text}
                        </span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2">
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminFacturacionChart({ data }: { data: HistoricalAdminKpis }) {
  const chartData = data.map(m => ({ name: m.label.split(" ")[0].substring(0, 3), fullLabel: m.label, conFactura: m.conFactura, sinFactura: m.sinFactura }))
  const config: ChartConfig = {
    conFactura: { label: "Con Factura", color: "#8b5cf6" },
    sinFactura: { label: "Sin Factura", color: "#f97316" },
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">TENDENCIA FACTURACIÓN POR MES</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent labelKey="fullLabel" />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="conFactura" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="sinFactura" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function AdminEstadoPagoChart({ data }: { data: HistoricalAdminKpis }) {
  const chartData = data.map(m => ({ name: m.label.split(" ")[0].substring(0, 3), fullLabel: m.label, pagado: m.pagado, pendiente: m.pendiente, sinRegistro: m.sinRegistro }))
  const config: ChartConfig = {
    pagado: { label: "Pagado", color: "#059669" },
    pendiente: { label: "Pendiente", color: "#dc2626" },
    sinRegistro: { label: "Sin Registro", color: "#6b7280" },
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">TENDENCIA ESTADO DE PAGO POR MES</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="h-[250px] w-full">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <ChartTooltip content={<ChartTooltipContent labelKey="fullLabel" />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="pagado" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="pendiente" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="sinRegistro" stroke="#6b7280" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
