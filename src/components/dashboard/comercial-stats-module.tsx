"use client"

import { useState } from "react"
import { useKpisData } from "@/hooks/use-kpis-data"
import { useCommercialTrackingKpis } from "@/hooks/use-commercial-tracking-kpis"
import { KpiPieChart, KpiBarChart, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { KpiHistoricoComercial } from "@/components/dashboard/kpi-historico-comercial-admin"
import { GerenciaCommercialTracking } from "@/components/dashboard/gerencia-commercial-tracking"
import { AlertTriangle, RefreshCw, BarChart3, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ComercialStatsModule() {
  const { comercialUnico, comercialSemanas, historicalComercial, isLoading, isHistoricalLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()
  const {
    kpis: commercialTrackingKpis,
    isLoading: isCommercialTrackingLoading,
    error: commercialTrackingError,
  } = useCommercialTrackingKpis(selectedMonth, selectedYear)
  const [tabView, setTabView] = useState<"kpis" | "resumen_comercial_1" | "historico">("kpis")
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "Cotización Enviada" | "Venta" | "Negociación">("todos")
  const montoCategories = estadoFilter === "todos"
    ? comercialUnico.montoAcumuladoMes.categories
    : comercialUnico.montoAcumuladoMes.categories.filter((cat) => cat.label === estadoFilter)
  const montoTotal = montoCategories.reduce((sum, category) => sum + category.value, 0)
  const clientesCategories = comercialUnico.numeroClientes.categories
  const weekLabels = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"]
  type WeekMetric = Exclude<keyof (typeof comercialSemanas)[number], "semana">
  const getWeekValue = (label: string, key: WeekMetric): number => Number(comercialSemanas.find((week) => week.semana === label)?.[key] ?? 0)
  const formatMoney = (value: number) => value.toLocaleString("es-PE")
  const getWeekConversion = (week: string) => {
    const leads = getWeekValue(week, "leads")
    const nuevos = getWeekValue(week, "clienteNuevos")
    return leads > 0 ? Math.round((nuevos / leads) * 10000) / 100 : 0
  }

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
          <Select value={estadoFilter} onValueChange={(value) => setEstadoFilter(value as typeof estadoFilter)}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="Cotización Enviada">Cotización Enviada</SelectItem>
              <SelectItem value="Venta">Venta</SelectItem>
              <SelectItem value="Negociación">Negociación</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5 w-fit">
        <Button variant={tabView === "kpis" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setTabView("kpis")}>
          <BarChart3 className="h-3.5 w-3.5" />
          KPIs Comerciales
        </Button>
        <Button variant={tabView === "resumen_comercial_1" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setTabView("resumen_comercial_1")}>
          <BarChart3 className="h-3.5 w-3.5" />
          Resumen Comercial 1
        </Button>
        <Button variant={tabView === "historico" ? "default" : "ghost"} size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setTabView("historico")}>
          <History className="h-3.5 w-3.5" />
          Histórico
        </Button>
      </div>

      {tabView === "kpis" ? (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold">MONTO ACUMULADO MES (S/.)</h3>
              <p className="text-sm text-muted-foreground">Fuente: seguimiento_cliente_comercial filtrado por fecha_contacto del mes seleccionado.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiSummaryRow
                categories={montoCategories}
                loading={isLoading}
                title="MONTO ACUMULADO MES (S/.)"
                totalOverride={montoTotal}
                valueHeader="Monto S/."
                formatValue={formatMoney}
              />
              <KpiPieChart data={{ ...comercialUnico.montoAcumuladoMes, categories: montoCategories }} loading={isLoading} />
              <KpiBarChart data={{ ...comercialUnico.montoAcumuladoMes, categories: montoCategories }} loading={isLoading} />
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">DESCRIPCION</TableHead>
                    {weekLabels.map((week) => (
                      <TableHead key={week} className="text-right">{week}</TableHead>
                    ))}
                    <TableHead className="text-right font-bold">TOTAL MES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: "COTIZACION ENVIADA", key: "cotizacionEnviada" as const },
                    { label: "VENTA", key: "venta" as const },
                    { label: "NEGOCIACION", key: "negociacion" as const },
                  ].map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      {weekLabels.map((week) => (
                        <TableCell key={week} className="text-right">{formatMoney(getWeekValue(week, row.key))}</TableCell>
                      ))}
                      <TableCell className="text-right font-semibold">
                        {formatMoney(weekLabels.reduce((sum, week) => sum + Number(getWeekValue(week, row.key)), 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>TOTAL MONTO</TableCell>
                    {weekLabels.map((week) => (
                      <TableCell key={week} className="text-right">
                        {formatMoney(Number(getWeekValue(week, "cotizacionEnviada")))}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {formatMoney(comercialUnico.montoAcumuladoMes.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold">NUMERO CLIENTES</h3>
              <p className="text-sm text-muted-foreground">Leads y cliente nuevos del mismo mes seleccionado.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KpiSummaryRow
                categories={clientesCategories}
                loading={isLoading}
                title="NUMERO CLIENTES"
              />
              <KpiPieChart data={{ ...comercialUnico.numeroClientes, categories: clientesCategories }} loading={isLoading} />
              <KpiBarChart data={{ ...comercialUnico.numeroClientes, categories: clientesCategories }} loading={isLoading} />
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[260px]">DESCRIPCION</TableHead>
                    {weekLabels.map((week) => (
                      <TableHead key={week} className="text-right">{week}</TableHead>
                    ))}
                    <TableHead className="text-right font-bold">TOTAL MES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: "LEADS", key: "leads" as const },
                    { label: "CLIENTE NUEVOS", key: "clienteNuevos" as const },
                  ].map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      {weekLabels.map((week) => (
                        <TableCell key={week} className="text-right">{getWeekValue(week, row.key)}</TableCell>
                      ))}
                      <TableCell className="text-right font-semibold">
                        {weekLabels.reduce((sum, week) => sum + getWeekValue(week, row.key), 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>TOTAL CLIENTES</TableCell>
                    {weekLabels.map((week) => (
                      <TableCell key={week} className="text-right">
                        {getWeekValue(week, "leads") + getWeekValue(week, "clienteNuevos")}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {comercialUnico.numeroClientes.total}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">TASA CONVERSIÓN %</TableCell>
                    {weekLabels.map((week) => (
                      <TableCell key={week} className="text-right">{getWeekConversion(week)}%</TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">{comercialUnico.tasaConversion}%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">TASA CONVERSION %</p>
            <p className="text-4xl font-black mt-3">{comercialUnico.tasaConversion}%</p>
            <p className="text-sm text-muted-foreground mt-2">Leads → clientes nuevos</p>
          </div>

        </div>
      ) : tabView === "resumen_comercial_1" ? (
        <div className="space-y-6">
          {commercialTrackingError ? (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {commercialTrackingError}
            </div>
          ) : null}

          <GerenciaCommercialTracking
            data={commercialTrackingKpis}
            loading={isLoading || isCommercialTrackingLoading}
          />
        </div>
      ) : (
        <KpiHistoricoComercial data={historicalComercial} loading={isHistoricalLoading} />
      )}
    </div>
  )
}
