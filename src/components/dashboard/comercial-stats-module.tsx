"use client"

import { useState } from "react"
import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiPieChart, KpiCard, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { KpiHistoricoComercial } from "@/components/dashboard/kpi-historico-comercial-admin"
import { FileText, CheckCircle2, AlertTriangle, RefreshCw, BarChart3, History } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ComercialStatsProps {
  user?: any
}

export function ComercialStatsModule({ user }: ComercialStatsProps) {
  const { comercial, prevComercial, historicalComercial, isLoading, isHistoricalLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()
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
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              title="Entregados"
              value={comercial.estadoTrabajo.categories.find(c => c.label === "Entregado")?.value ?? 0}
              previousValue={prevComercial?.estadoTrabajo.categories.find(c => c.label === "Entregado")?.value}
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              loading={isLoading}
            />
            <KpiCard
              title="En Proceso"
              value={comercial.estadoTrabajo.categories.find(c => c.label === "En Proceso")?.value ?? 0}
              previousValue={prevComercial?.estadoTrabajo.categories.find(c => c.label === "En Proceso")?.value}
              icon={<FileText className="h-5 w-5 text-blue-600" />}
              loading={isLoading}
            />
            <KpiCard
              title="Informe Listo"
              value={comercial.estadoTrabajo.categories.find(c => c.label === "Informe Listo")?.value ?? 0}
              previousValue={prevComercial?.estadoTrabajo.categories.find(c => c.label === "Informe Listo")?.value}
              icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
              loading={isLoading}
            />
            <KpiCard
              title="Anulados"
              value={comercial.estadoTrabajo.categories.find(c => c.label === "Anulado")?.value ?? 0}
              previousValue={prevComercial?.estadoTrabajo.categories.find(c => c.label === "Anulado")?.value}
              icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
              loading={isLoading}
            />
          </div>

          {/* Tabla + PieChart Estado de Trabajo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={comercial.estadoTrabajo.categories} previousCategories={prevComercial?.estadoTrabajo.categories} loading={isLoading} title="ANALISIS ESTADO DE TRABAJO" />
            <KpiPieChart data={comercial.estadoTrabajo} loading={isLoading} />
          </div>

          {/* Tabla + PieChart Servicios por Tipo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={comercial.serviciosPorTipo.categories} previousCategories={prevComercial?.serviciosPorTipo.categories} loading={isLoading} title="ANALISIS CANTIDAD POR TIPO DE SERVICIO" />
            <KpiPieChart data={comercial.serviciosPorTipo} loading={isLoading} />
          </div>

          {/* Tabla + PieChart Tiempo de Entrega */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={comercial.tiempoEntrega.categories} previousCategories={prevComercial?.tiempoEntrega.categories} loading={isLoading} title="ANALISIS TIEMPO DE ENTREGA" />
            <KpiPieChart data={comercial.tiempoEntrega} loading={isLoading} />
          </div>

          {/* Tabla + PieChart Dias Atraso Cotizacion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={comercial.diasAtrasoCotizacion.categories} previousCategories={prevComercial?.diasAtrasoCotizacion.categories} loading={isLoading} title="ANALISIS DIAS ATRASO ENVIO COTIZACION" />
            <KpiPieChart data={comercial.diasAtrasoCotizacion} loading={isLoading} />
          </div>

          {/* Tabla + PieChart Cumplimiento Cotizacion */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={comercial.cumplimientoCotizacion.categories} previousCategories={prevComercial?.cumplimientoCotizacion.categories} loading={isLoading} title="ANALISIS CUMPLIMIENTO TIEMPO COTIZACION" />
            <KpiPieChart data={comercial.cumplimientoCotizacion} loading={isLoading} />
          </div>

          {/* Tabla + PieChart Evidencia Solicitud */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <KpiSummaryRow categories={comercial.evidenciaSolicitud.categories} previousCategories={prevComercial?.evidenciaSolicitud.categories} loading={isLoading} title="ANALISIS EVIDENCIA ENVIO SOLICITUD" />
            <KpiPieChart data={comercial.evidenciaSolicitud} loading={isLoading} />
          </div>
        </>
      ) : (
        <KpiHistoricoComercial data={historicalComercial} loading={isHistoricalLoading} />
      )}
    </div>
  )
}
