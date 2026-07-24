"use client"

import { useState } from "react"
import { useKpisData, type DateFilter } from "@/hooks/use-kpis-data"
import { KpiChartCard, KpiPieChart, KpiBarChart, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { KpiHistorico } from "@/components/dashboard/kpi-historico"
import { RefreshCw, CalendarCheck, CalendarPlus, BarChart3, History } from "lucide-react"
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
          {/* Tabla + Pie + Bar: Servicios por Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={laboratorio.serviciosPorTipo.categories} previousCategories={prevLaboratorio?.serviciosPorTipo.categories} loading={isLoading} title="ANALISIS CANTIDAD POR TIPO DE SERVICIO" />
            <KpiPieChart data={laboratorio.serviciosPorTipo} loading={isLoading} />
            <KpiBarChart data={laboratorio.serviciosPorTipo} loading={isLoading} />
          </div>

          {/* Tabla + Pie + Bar: Estado de Trabajo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={laboratorio.estadoTrabajo.categories} previousCategories={prevLaboratorio?.estadoTrabajo.categories} loading={isLoading} title="ANALISIS ESTADO DE TRABAJO" />
            <KpiPieChart data={laboratorio.estadoTrabajo} loading={isLoading} />
            <KpiBarChart data={laboratorio.estadoTrabajo} loading={isLoading} />
          </div>

          {/* Tabla + Pie + Bar: Analisis Entrega de Trabajo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={laboratorio.tiempoEntrega.categories} previousCategories={prevLaboratorio?.tiempoEntrega.categories} loading={isLoading} title="ANALISIS ENTREGA DE TRABAJO" />
            <KpiPieChart data={laboratorio.tiempoEntrega} loading={isLoading} />
            <KpiBarChart data={laboratorio.tiempoEntrega} loading={isLoading} />
          </div>

          {/* Tabla + Pie + Bar: Analisis Probetas Ensayada y Por Ensayar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={laboratorio.probetasEnsayo.categories} previousCategories={prevLaboratorio?.probetasEnsayo.categories} loading={isLoading} title="ANALISIS PROBETAS ENSAYADA Y POR ENSAYAR" />
            <KpiPieChart data={laboratorio.probetasEnsayo} loading={isLoading} />
            <KpiBarChart data={laboratorio.probetasEnsayo} loading={isLoading} />
          </div>

          {/* Tabla + Pie + Bar: Analisis Probetas Falta Ensayar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={gerencia.probetasFaltantes.categories} previousCategories={prevGerencia?.probetasFaltantes.categories} loading={isLoading} title="ANALISIS PROBETAS FALTA ENSAYAR" />
            <KpiPieChart data={gerencia.probetasFaltantes} loading={isLoading} />
            <KpiBarChart data={gerencia.probetasFaltantes} loading={isLoading} />
          </div>

          {/* Tabla + Pie + Bar: Control Lab Correcto General */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={laboratorio.controlLabGeneral.categories} previousCategories={prevLaboratorio?.controlLabGeneral.categories} loading={isLoading} title="PENDIENTES DE ENTREGA DE INFORME" />
            <KpiPieChart data={laboratorio.controlLabGeneral} loading={isLoading} />
            <KpiBarChart data={laboratorio.controlLabGeneral} loading={isLoading} />
          </div>

          {/* Tabla + Pie + Bar: Evidencias de Recepción e Informe */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={laboratorio.evidenciaEnvio.categories} previousCategories={prevLaboratorio?.evidenciaEnvio.categories} loading={isLoading} title="DASHBOARD EVIDENCIAS DE RECEPCION E INFORME" />
            <KpiPieChart data={laboratorio.evidenciaEnvio} loading={isLoading} />
            <KpiBarChart data={laboratorio.evidenciaEnvio} loading={isLoading} />
          </div>

          {/* Tabla + Pie + Bar: Status Probetas Entregadas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KpiSummaryRow categories={gerencia.statusProbetasEntregadas.categories} previousCategories={prevGerencia?.statusProbetasEntregadas.categories} loading={isLoading} title="ANALISIS STATUS POR CADA PROBETA ENTREGADO AL CLIENTE" />
            <KpiPieChart data={gerencia.statusProbetasEntregadas} loading={isLoading} />
            <KpiBarChart data={gerencia.statusProbetasEntregadas} loading={isLoading} />
          </div>
        </>
      ) : (
        <KpiHistorico data={historical} loading={isHistoricalLoading} />
      )}
    </div>
  )
}
