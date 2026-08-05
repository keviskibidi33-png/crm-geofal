"use client"

import { useState } from "react"
import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiPieChart, KpiBarChart, KpiSummaryRow, KpiEvidenciasSummaryRow, KpiEvidenciasProgressCard, MonthSelector } from "@/components/dashboard/kpi-charts"
import { KpiHistorico } from "@/components/dashboard/kpi-historico"
import { RefreshCw, CalendarCheck, CalendarPlus, BarChart3, History, TestTube2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LaboratorioStatsProps {
  user?: unknown
}

type TabView = "mes" | "probetas" | "historico"

export function LaboratorioStatsModule({ user }: LaboratorioStatsProps) {
  void user
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
          {(tabView === "mes" || tabView === "probetas") && (
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
          variant={tabView === "probetas" ? "default" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setTabView("probetas")}
        >
          <TestTube2 className="h-3.5 w-3.5" />
          Probetas
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Card 1: Analisis Entrega de Trabajo */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
              <KpiSummaryRow categories={laboratorio.tiempoEntrega.categories} previousCategories={prevLaboratorio?.tiempoEntrega.categories} loading={isLoading} title="ANALISIS ENTREGA DE TRABAJO" />
              <KpiBarChart data={laboratorio.tiempoEntrega} loading={isLoading} />
            </div>
          </div>

          {/* Card 2: Control Lab Correcto General */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
              <KpiSummaryRow categories={laboratorio.controlLabGeneral.categories} previousCategories={prevLaboratorio?.controlLabGeneral.categories} loading={isLoading} title="PENDIENTES DE ENTREGA DE INFORME" />
              <KpiBarChart data={laboratorio.controlLabGeneral} loading={isLoading} />
            </div>
          </div>

          {/* Card 3: Servicios por Tipo */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
              <KpiSummaryRow categories={laboratorio.serviciosPorTipo.categories} previousCategories={prevLaboratorio?.serviciosPorTipo.categories} loading={isLoading} title="ANALISIS CANTIDAD POR TIPO DE SERVICIO" />
              <KpiBarChart data={laboratorio.serviciosPorTipo} loading={isLoading} />
            </div>
          </div>

          {/* Card 4: Estado de Trabajo */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
              <KpiSummaryRow categories={laboratorio.estadoTrabajo.categories} previousCategories={prevLaboratorio?.estadoTrabajo.categories} loading={isLoading} title="ANALISIS ESTADO DE TRABAJO" />
              <KpiBarChart data={laboratorio.estadoTrabajo} loading={isLoading} />
            </div>
          </div>

          {/* Card 5: Evidencias de Recepción e Informe */}
          <div className="lg:col-span-2 rounded-xl border bg-card p-4 shadow-sm">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 items-start">
              <KpiEvidenciasSummaryRow categories={laboratorio.evidenciaEnvio.categories} previousCategories={prevLaboratorio?.evidenciaEnvio.categories} loading={isLoading} title="DASHBOARD EVIDENCIAS DE RECEPCION E INFORME" total={laboratorio.evidenciaEnvio.total} />
              <KpiEvidenciasProgressCard data={laboratorio.evidenciaEnvio} loading={isLoading} />
              <KpiBarChart data={laboratorio.evidenciaEnvio} loading={isLoading} />
            </div>
          </div>
        </div>
      ) : tabView === "probetas" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
            <h3 className="text-sm font-bold text-blue-950 uppercase tracking-wide">Panel Probetas</h3>
            <p className="text-xs text-blue-800/80 mt-0.5">
              KPIs agrupados exclusivamente para control, ensayo, faltantes y entrega de probetas.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tabla + Bar: Analisis Probetas Ensayada y Por Ensayar */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
                <KpiSummaryRow categories={laboratorio.probetasEnsayo.categories} previousCategories={prevLaboratorio?.probetasEnsayo.categories} loading={isLoading} title="ANALISIS PROBETAS ENSAYADA Y POR ENSAYAR" />
                <KpiBarChart data={laboratorio.probetasEnsayo} loading={isLoading} />
              </div>
            </div>

            {/* Tabla + Bar: Analisis Probetas Falta Ensayar */}
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
                <KpiSummaryRow categories={gerencia.probetasFaltantes.categories} previousCategories={prevGerencia?.probetasFaltantes.categories} loading={isLoading} title="ANALISIS PROBETAS FALTA ENSAYAR" />
                <KpiBarChart data={gerencia.probetasFaltantes} loading={isLoading} />
              </div>
            </div>

            {/* Tabla + Bar: Status Probetas Entregadas */}
            <div className="lg:col-span-2 rounded-xl border bg-card p-4 shadow-sm">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
                <KpiSummaryRow categories={gerencia.statusProbetasEntregadas.categories} previousCategories={prevGerencia?.statusProbetasEntregadas.categories} loading={isLoading} title="ANALISIS STATUS POR CADA PROBETA ENTREGADO AL CLIENTE" />
                <KpiBarChart data={gerencia.statusProbetasEntregadas} loading={isLoading} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <KpiHistorico data={historical} loading={isHistoricalLoading} />
      )}
    </div>
  )
}
