"use client"

import { useState } from "react"
import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiPieChart, KpiBarChart, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { KpiHistoricoComercial } from "@/components/dashboard/kpi-historico-comercial-admin"
import { RefreshCw, BarChart3, History } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ComercialStatsModule() {
  const { comercialUnico, historicalComercial, isLoading, isHistoricalLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()
  const [tabView, setTabView] = useState<"mes" | "historico">("mes")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Estadistica Comercial</h2>
          <p className="text-sm text-muted-foreground">
            KPIs y metricas del area comercial
            {lastUpdated && (
              <span className="ml-2">
                Actualizado: {lastUpdated.toLocaleTimeString("es-PE")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector
            availableMonths={availableMonths}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            loading={isLoading}
          />
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
        <Button variant={tabView === "mes" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setTabView("mes")}>
          <BarChart3 className="h-3.5 w-3.5" />
          Mes Actual
        </Button>
        <Button variant={tabView === "historico" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setTabView("historico")}>
          <History className="h-3.5 w-3.5" />
          Histórico
        </Button>
      </div>

      {tabView === "mes" ? (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold">MONTO ACUMULADO MES (S/.)</h3>
              <p className="text-sm text-muted-foreground">Fuente: seguimiento_cliente_comercial filtrado por fecha_contacto del mes seleccionado.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiSummaryRow
                categories={comercialUnico.montoAcumuladoMes.categories}
                loading={isLoading}
                title="MONTO ACUMULADO MES (S/.)"
              />
              <KpiPieChart data={comercialUnico.montoAcumuladoMes} loading={isLoading} />
              <KpiBarChart data={comercialUnico.montoAcumuladoMes} loading={isLoading} />
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold">NUMERO CLIENTES</h3>
              <p className="text-sm text-muted-foreground">Leads y cliente nuevos del mismo mes seleccionado.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiSummaryRow
                categories={comercialUnico.numeroClientes.categories}
                loading={isLoading}
                title="NUMERO CLIENTES"
              />
              <KpiPieChart data={comercialUnico.numeroClientes} loading={isLoading} />
              <KpiBarChart data={comercialUnico.numeroClientes} loading={isLoading} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">TASA CONVERSION %</p>
              <p className="text-4xl font-black mt-3">{comercialUnico.tasaConversion}%</p>
              <p className="text-sm text-muted-foreground mt-2">Leads → clientes nuevos</p>
            </div>
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">META</p>
              <p className="text-4xl font-black mt-3">{comercialUnico.meta}%</p>
              <p className="text-sm text-muted-foreground mt-2">Objetivo mensual comercial</p>
            </div>
          </div>
        </div>
      ) : (
        <KpiHistoricoComercial data={historicalComercial} loading={isHistoricalLoading} />
      )}
    </div>
  )
}
