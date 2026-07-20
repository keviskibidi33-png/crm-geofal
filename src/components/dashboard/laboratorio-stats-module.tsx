"use client"

import { useKpisData, type DateFilter } from "@/hooks/use-kpis-data"
import { KpiChartCard, KpiPieChart, KpiCard, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { FlaskConical, Clock, CheckCircle2, AlertTriangle, RefreshCw, CalendarCheck, CalendarPlus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LaboratorioStatsProps {
  user?: any
}

export function LaboratorioStatsModule({ user }: LaboratorioStatsProps) {
  const { laboratorio, isLoading, lastUpdated, refresh, selectedMonth, selectedYear, dateFilter, availableMonths, setSelectedMonth, setDateFilter } = useKpisData()

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
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={dateFilter === "recepcion" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setDateFilter("recepcion")}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Recepción
            </Button>
            <Button
              variant={dateFilter === "creacion" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setDateFilter("creacion")}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Creación
            </Button>
          </div>
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

      {/* Tabla + Grafico Servicios por Tipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={laboratorio.serviciosPorTipo.categories} loading={isLoading} />
        <KpiChartCard data={laboratorio.serviciosPorTipo} loading={isLoading} />
      </div>

      {/* Tabla + PieChart Estado de Trabajo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={laboratorio.estadoTrabajo.categories} loading={isLoading} title="ANALISIS ESTADO DE TRABAJO" />
        <KpiPieChart data={laboratorio.estadoTrabajo} loading={isLoading} />
      </div>

      {/* Tabla + Grafico Analisis Entrega de Trabajo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={laboratorio.tiempoEntrega.categories} loading={isLoading} title="ANALISIS ENTREGA DE TRABAJO" />
        <KpiChartCard data={laboratorio.tiempoEntrega} loading={isLoading} />
      </div>
    </div>
  )
}
