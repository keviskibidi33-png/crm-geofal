"use client"

import { FileCheck2, ShoppingCart, TrendingUp, Users } from "lucide-react"

import type {
  CommercialTrackingAmountGroup,
  CommercialTrackingKpis,
} from "@/hooks/use-commercial-tracking-kpis"

const moneyFormatter = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const countFormatter = new Intl.NumberFormat("es-PE", {
  maximumFractionDigits: 0,
})

function LoadingRows({ rows, columns }: { rows: number; columns: number }) {
  return Array.from({ length: rows }, (_, index) => (
    <tr key={index} className="border-b border-slate-100 last:border-b-0">
      <td colSpan={columns} className="px-4 py-3">
        <div className="h-5 animate-pulse rounded bg-slate-100" />
      </td>
    </tr>
  ))
}

function AmountTable({
  title,
  data,
  weekLabels,
  loading,
  tone,
}: {
  title: string
  data: CommercialTrackingAmountGroup
  weekLabels: CommercialTrackingKpis["weekLabels"]
  loading: boolean
  tone: "blue" | "emerald"
}) {
  const toneClasses = tone === "blue"
    ? "border-blue-200 bg-blue-50 text-blue-900"
    : "border-emerald-200 bg-emerald-50 text-emerald-900"

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={`flex items-center gap-2 border-b px-4 py-3 ${toneClasses}`}>
        {tone === "blue" ? <FileCheck2 className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
        <h3 className="text-sm font-black uppercase tracking-wide">{title}</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <th rowSpan={2} className="w-[210px] border-r border-slate-200 px-3 py-2 text-left font-bold uppercase">
                Descripción
              </th>
              <th colSpan={4} className="border-r border-slate-200 px-3 py-2 text-center font-bold uppercase">
                Monto (S/.)
              </th>
              <th rowSpan={2} className="w-[125px] border-r border-slate-200 px-3 py-2 text-right font-bold uppercase">
                Total parcial (S/.)
              </th>
              <th rowSpan={2} className="w-[110px] px-3 py-2 text-right font-bold uppercase">
                Monto parcial (%)
              </th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              {weekLabels.map((week) => (
                <th key={week} className="border-r border-slate-200 px-3 py-2 text-right font-semibold last:border-r-0">
                  {week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows rows={6} columns={7} />
            ) : (
              <>
                <tr className="border-b border-slate-200 bg-slate-50 font-black text-slate-900">
                  <td className="border-r border-slate-200 px-3 py-2.5">TOTAL SEMANAL</td>
                  {data.weeklyTotals.map((amount, index) => (
                    <td key={weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {moneyFormatter.format(amount)}
                    </td>
                  ))}
                  <td className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                    {moneyFormatter.format(data.total)}
                  </td>
                  <td className="px-3 py-2.5 text-right">{data.total > 0 ? "100%" : "0%"}</td>
                </tr>

                {data.categories.map((category) => (
                  <tr key={category.key} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80">
                    <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">{category.label}</td>
                    {category.weeklyAmounts.map((amount, index) => (
                      <td key={weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                        {moneyFormatter.format(amount)}
                      </td>
                    ))}
                    <td className="border-r border-slate-200 px-3 py-2.5 text-right font-mono font-semibold tabular-nums">
                      {moneyFormatter.format(category.total)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                      {category.percentage.toLocaleString("es-PE", { maximumFractionDigits: 0 })}%
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ClientsTable({ data, loading }: { data: CommercialTrackingKpis; loading: boolean }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-3 text-violet-900">
        <Users className="h-4 w-4" />
        <h3 className="text-sm font-black uppercase tracking-wide">Número de clientes</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-slate-700">
              <th className="w-[210px] border-r border-slate-200 px-3 py-2.5 text-left font-bold uppercase">Descripción</th>
              {data.weekLabels.map((week) => (
                <th key={week} className="border-r border-slate-200 px-3 py-2.5 text-right font-bold uppercase last:border-r-0">
                  {week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows rows={3} columns={5} />
            ) : (
              <>
                <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                  <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">LEADS</td>
                  {data.leads.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {countFormatter.format(value)}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-slate-200 hover:bg-slate-50/80">
                  <td className="border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">CLIENTE NUEVOS</td>
                  {data.newClients.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-slate-200 px-3 py-2.5 text-right font-mono tabular-nums">
                      {countFormatter.format(value)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-violet-50 font-black text-violet-950">
                  <td className="border-r border-violet-200 px-3 py-3">
                    <span className="inline-flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      KPI TASA CONVERSIÓN %
                    </span>
                  </td>
                  {data.conversionRates.map((value, index) => (
                    <td key={data.weekLabels[index]} className="border-r border-violet-200 px-3 py-3 text-right tabular-nums">
                      {value.toLocaleString("es-PE", { maximumFractionDigits: 0 })}%
                    </td>
                  ))}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function GerenciaCommercialTracking({
  data,
  loading,
}: {
  data: CommercialTrackingKpis
  loading: boolean
}) {
  return (
    <section className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">Resumen Comercial 1</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cotizaciones enviadas, ventas y conversión semanal por categoría de cliente.
          </p>
        </div>
        <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
          Fuente: Seguimiento
        </span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
        <span className="font-bold text-slate-800">Reglas:</span> Cotización enviada usa Estado cliente = Cotización enviada, número de cotización y monto válido. Venta usa Estado seguimiento = Venta. Leads cuentan registros con número de cotización y Cliente nuevos los registros en Venta.
      </div>
      <AmountTable
        title="Cotización enviada"
        data={data.quoteSent}
        weekLabels={data.weekLabels}
        loading={loading}
        tone="blue"
      />
      <AmountTable
        title="Venta"
        data={data.sales}
        weekLabels={data.weekLabels}
        loading={loading}
        tone="emerald"
      />
      <ClientsTable data={data} loading={loading} />
    </section>
  )
}
