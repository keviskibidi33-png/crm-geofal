"use client"

import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiChartCard, KpiPieChart, KpiCard, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { BarChart3, FileText, DollarSign, CreditCard, CheckCircle2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GerenciaStatsProps {
  user?: any
}

export function GerenciaStatsModule({ user }: GerenciaStatsProps) {
  const { gerencia, prevGerencia, isLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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
          title="Entregados"
          value={gerencia.resumenMensual.categories.find(c => c.label === "Entregados")?.value ?? 0}
          previousValue={prevGerencia?.resumenMensual.categories.find(c => c.label === "Entregados")?.value}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="En Proceso"
          value={gerencia.resumenMensual.categories.find(c => c.label === "En Proceso")?.value ?? 0}
          previousValue={prevGerencia?.resumenMensual.categories.find(c => c.label === "En Proceso")?.value}
          icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Con Factura"
          value={gerencia.facturacion.categories.find(c => c.label === "Con Factura")?.value ?? 0}
          previousValue={prevGerencia?.facturacion.categories.find(c => c.label === "Con Factura")?.value}
          icon={<FileText className="h-5 w-5 text-amber-600" />}
          loading={isLoading}
        />
        <KpiCard
          title="Pagados"
          value={gerencia.estadoPago.categories.find(c => c.label === "Pagado")?.value ?? 0}
          previousValue={prevGerencia?.estadoPago.categories.find(c => c.label === "Pagado")?.value}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          loading={isLoading}
        />
      </div>

      {/* Tabla + PieChart Resumen Mensual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={gerencia.resumenMensual.categories} previousCategories={prevGerencia?.resumenMensual.categories} loading={isLoading} title="ANALISIS RESUMEN MENSUAL" />
        <KpiPieChart data={gerencia.resumenMensual} loading={isLoading} />
      </div>

      {/* Tabla + PieChart Facturacion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={gerencia.facturacion.categories} previousCategories={prevGerencia?.facturacion.categories} loading={isLoading} title="ANALISIS FACTURACION" />
        <KpiPieChart data={gerencia.facturacion} loading={isLoading} />
      </div>

      {/* Tabla + BarChart Estado de Pago */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={gerencia.estadoPago.categories} previousCategories={prevGerencia?.estadoPago.categories} loading={isLoading} title="ANALISIS ESTADO DE PAGO" />
        <KpiChartCard data={gerencia.estadoPago} loading={isLoading} />
      </div>

      {/* Tabla + PieChart Status Probetas Entregadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiSummaryRow categories={gerencia.statusProbetasEntregadas.categories} previousCategories={prevGerencia?.statusProbetasEntregadas.categories} loading={isLoading} title="ANALISIS STATUS PROBETAS ENTREGADAS" />
        <KpiPieChart data={gerencia.statusProbetasEntregadas} loading={isLoading} />
      </div>
    </div>
  )
}
