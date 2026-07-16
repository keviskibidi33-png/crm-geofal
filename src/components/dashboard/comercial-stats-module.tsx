"use client"

import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiPieChart, KpiBarChart, KpiCard, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { TrendingUp, FileText, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ComercialStatsProps {
  user?: any
}

export function ComercialStatsModule({ user }: ComercialStatsProps) {
  const { comercial, isLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Total Servicios"
          value={comercial.serviciosPorTipo.total}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
          loading={isLoading}
        />
        <KpiCard
          title="Entregados"
          value={comercial.estadoTrabajo.categories.find(c => c.label === "Entregado")?.value ?? 0}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="En Proceso"
          value={comercial.estadoTrabajo.categories.find(c => c.label === "En Proceso")?.value ?? 0}
          icon={<FileText className="h-4 w-4 text-blue-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Anulados"
          value={comercial.estadoTrabajo.categories.find(c => c.label === "Anulado")?.value ?? 0}
          icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          loading={isLoading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Servicios por Tipo */}
        <KpiBarChart data={comercial.serviciosPorTipo} loading={isLoading} />

        {/* Estado de Trabajo */}
        <KpiPieChart data={comercial.estadoTrabajo} loading={isLoading} />

        {/* Evidencia de Envio */}
        <KpiPieChart data={comercial.evidenciaEnvio} loading={isLoading} />
      </div>

      {/* Summary Rows */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Distribucion de Servicios</h3>
          <KpiSummaryRow categories={comercial.serviciosPorTipo.categories} loading={isLoading} />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Resumen de Evidencias</h3>
          <KpiSummaryRow categories={comercial.evidenciaEnvio.categories} loading={isLoading} />
        </div>
      </div>
    </div>
  )
}
