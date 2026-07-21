"use client"

import { useState } from "react"
import { useKpisData, type DateFilter } from "@/hooks/use-kpis-data"
import { KpiChartCard, KpiPieChart, KpiCard, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { KpiHistorico } from "@/components/dashboard/kpi-historico"
import { FlaskConical, Clock, CheckCircle2, AlertTriangle, RefreshCw, CalendarCheck, CalendarPlus, BarChart3, History } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LaboratorioStatsProps {
  user?: any
}

type TabView = "mes" | "historico"

export function LaboratorioStatsModule({ user }: LaboratorioStatsProps) {
  const { laboratorio, gerencia, prevLaboratorio, prevGerencia, isLoading, isHistoricalLoading, lastUpdated, refresh, refreshHistorical, selectedMonth, selectedYear, dateFilter, availableMonths, setSelectedMonth, setDateFilter, historical } = useKpisData()
  const [tabView, setTabView] = useState<TabView>("mes")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          {tabView === "mes" && (
            <MonthSelector
              availableMonths={availableMonths}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onMonthChange={setSelectedMonth}
              loading={isLoading}
            />
          )}
          <Button variant="outline" size="sm" onClick={() => tabView === "mes" ? refresh() : refreshHistorical()} disabled={tabView === "mes" ? isLoading : isHistoricalLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(tabView === "mes" ? isLoading : isHistoricalLoading) ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
        <Button
          variant={tabView === "mes" ? "default" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setTabView("mes")}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Mes Actual
        </Button>
        <Button
          variant={tabView === "historico" ? "default" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setTabView("historico")}
        >
          <History className="h-3.5 w-3.5" />
          Histórico
        </Button>
      </div>

      {tabView === "mes" ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Probetas en Curado"
              value={laboratorio.probetasEnsayo.categories.find(c => c.label === "Pendiente")?.value ?? 0}
              previousValue={prevLaboratorio?.probetasEnsayo.categories.find(c => c.label === "Pendiente")?.value}
              icon={<Clock className="h-5 w-5 text-blue-600" />}
              loading={isLoading}
            />
            <KpiCard
              title="Pendientes por Ensayar"
              value={laboratorio.probetasEnsayo.categories.find(c => c.label === "Falta")?.value ?? 0}
              previousValue={prevLaboratorio?.probetasEnsayo.categories.find(c => c.label === "Falta")?.value}
              icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
              loading={isLoading}
            />
            <KpiCard
              title="Cumplidas"
              value={laboratorio.probetasEnsayo.categories.find(c => c.label === "Ensayada")?.value ?? 0}
              previousValue={prevLaboratorio?.probetasEnsayo.categories.find(c => c.label === "Ensayada")?.value}
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              loading={isLoading}
            />
            <KpiCard
              title="Total Probetas"
              value={laboratorio.probetasEnsayo.total}
              previousValue={prevLaboratorio?.probetasEnsayo.total}
              icon={<FlaskConical className="h-5 w-5 text-blue-600" />}
              loading={isLoading}
            />
          </div>

          {/* Tabla + Grafico Servicios por Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={laboratorio.serviciosPorTipo.categories} previousCategories={prevLaboratorio?.serviciosPorTipo.categories} loading={isLoading} title="ANALISIS CANTIDAD POR TIPO DE SERVICIO" />
            <KpiChartCard data={laboratorio.serviciosPorTipo} loading={isLoading} />
          </div>

          {/* Tabla + PieChart Estado de Trabajo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={laboratorio.estadoTrabajo.categories} previousCategories={prevLaboratorio?.estadoTrabajo.categories} loading={isLoading} title="ANALISIS ESTADO DE TRABAJO" />
            <KpiPieChart data={laboratorio.estadoTrabajo} loading={isLoading} />
          </div>

          {/* Tabla + Grafico Analisis Entrega de Trabajo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={laboratorio.tiempoEntrega.categories} previousCategories={prevLaboratorio?.tiempoEntrega.categories} loading={isLoading} title="ANALISIS ENTREGA DE TRABAJO" />
            <KpiChartCard data={laboratorio.tiempoEntrega} loading={isLoading} />
          </div>

          {/* Tabla + Grafico Analisis Probetas Ensayada y Por Ensayar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={laboratorio.probetasEnsayo.categories} previousCategories={prevLaboratorio?.probetasEnsayo.categories} loading={isLoading} title="ANALISIS PROBETAS ENSAYADA Y POR ENSAYAR" />
            <KpiPieChart data={laboratorio.probetasEnsayo} loading={isLoading} />
          </div>

          {/* Tabla + Grafico Analisis Probetas Falta Ensayar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={gerencia.probetasFaltantes.categories} previousCategories={prevGerencia?.probetasFaltantes.categories} loading={isLoading} title="ANALISIS PROBETAS FALTA ENSAYAR" />
            <KpiChartCard data={gerencia.probetasFaltantes} loading={isLoading} />
          </div>

          {/* Tabla + Grafico Status Probetas Entregadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={gerencia.statusProbetasEntregadas.categories} previousCategories={prevGerencia?.statusProbetasEntregadas.categories} loading={isLoading} title="ANALISIS STATUS POR CADA PROBETA ENTREGADO AL CLIENTE" />
            <KpiPieChart data={gerencia.statusProbetasEntregadas} loading={isLoading} />
          </div>
        </>
      ) : (
        <KpiHistorico data={historical} loading={isHistoricalLoading} />
      )}
    </div>
  )
}
