"use client"

import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiChartCard, KpiCard, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { FlaskConical, Clock, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LaboratorioStatsProps {
  user?: any
}

export function LaboratorioStatsModule({ user }: LaboratorioStatsProps) {
  const { laboratorio, isLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estadistica Laboratorio</h2>
          <p className="text-sm text-muted-foreground">
            KPIs y metricas del laboratorio
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
          title="En Curado"
          value={laboratorio.probetasEnsayo.categories.find(c => c.label === "Pendiente")?.value ?? 0}
          icon={<Clock className="h-5 w-5 text-blue-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Pendientes Hoy"
          value={laboratorio.probetasEnsayo.categories.find(c => c.label === "Falta")?.value ?? 0}
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Ensayadas"
          value={laboratorio.probetasEnsayo.categories.find(c => c.label === "Ensayada")?.value ?? 0}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Total Probetas"
          value={laboratorio.probetasEnsayo.total}
          icon={<FlaskConical className="h-5 w-5 text-blue-600" />}
          loading={isLoading}
        />
      </div>

      {/* Tabla + Grafico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={laboratorio.serviciosPorTipo.categories} loading={isLoading} />
        <KpiChartCard data={laboratorio.serviciosPorTipo} loading={isLoading} />
      </div>
    </div>
  )
}
