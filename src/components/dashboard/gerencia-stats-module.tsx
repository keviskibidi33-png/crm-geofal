"use client"

import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiPieChart, KpiBarChart, KpiCard, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { BarChart3, Clock, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GerenciaStatsProps {
  user?: any
}

export function GerenciaStatsModule({ user }: GerenciaStatsProps) {
  const { gerencia, isLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Estadistica Administracion</h2>
          <p className="text-sm text-muted-foreground">
            Resumen ejecutivo y KPIs de administracion
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
          title="Resumen Mensual"
          value={gerencia.resumenMensual.total}
          icon={<BarChart3 className="h-4 w-4 text-primary" />}
          loading={isLoading}
        />
        <KpiCard
          title="Probetas Faltantes"
          value={gerencia.probetasFaltantes.total}
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Status Entregadas"
          value={gerencia.statusProbetasEntregadas.total}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Pendientes Urgentes"
          value={gerencia.probetasFaltantes.categories.find(c => c.label === "Hoy")?.value ?? 0}
          icon={<Clock className="h-4 w-4 text-red-600" />}
          loading={isLoading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Resumen Mensual */}
        <KpiPieChart data={gerencia.resumenMensual} loading={isLoading} />

        {/* Probetas Faltantes */}
        <KpiBarChart data={gerencia.probetasFaltantes} loading={isLoading} />

        {/* Status Probetas Entregadas */}
        <KpiPieChart data={gerencia.statusProbetasEntregadas} loading={isLoading} />
      </div>

      {/* Summary Rows */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Resumen Ejecutivo del Mes</h3>
          <KpiSummaryRow categories={gerencia.resumenMensual.categories} loading={isLoading} />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Urgencia de Probetas Faltantes</h3>
          <KpiSummaryRow categories={gerencia.probetasFaltantes.categories} loading={isLoading} />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Status de Entrega al Cliente</h3>
          <KpiSummaryRow categories={gerencia.statusProbetasEntregadas.categories} loading={isLoading} />
        </div>
      </div>
    </div>
  )
}
