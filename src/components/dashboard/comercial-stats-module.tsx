"use client"

import { useState } from "react"
import { useKpisData } from "@/hooks/use-kpis-data"
import { KpiPieChart, KpiBarChart, KpiSummaryRow, MonthSelector } from "@/components/dashboard/kpi-charts"
import { KpiHistoricoComercial } from "@/components/dashboard/kpi-historico-comercial-admin"
import { RefreshCw, BarChart3, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ComercialStatsModule() {
  const { comercialUnico, comercialUnicoDetalle, comercialSemanas, historicalComercial, isLoading, isHistoricalLoading, lastUpdated, refresh, selectedMonth, selectedYear, availableMonths, setSelectedMonth } = useKpisData()
  const [tabView, setTabView] = useState<"mes" | "historico">("mes")
  const [estadoFilter, setEstadoFilter] = useState<"todos" | "Cotización Enviada" | "Venta" | "Negociación">("todos")
  const montoCategories = estadoFilter === "todos"
    ? comercialUnico.montoAcumuladoMes.categories
    : comercialUnico.montoAcumuladoMes.categories.filter((cat) => cat.label === estadoFilter)
  const clientesCategories = estadoFilter === "todos"
    ? comercialUnico.numeroClientes.categories
    : comercialUnico.numeroClientes.categories.filter((cat) => estadoFilter === "todos" || (estadoFilter === "Cotización Enviada" ? cat.label === "Leads" || cat.label === "Cliente Nuevos" : true))
  const weekLabels = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"]
  const getWeekValue = (label: string, key: keyof (typeof comercialSemanas)[number]) => comercialSemanas.find((week) => week.semana === label)?.[key] ?? 0
  const formatMoney = (value: number) => value.toLocaleString("es-PE")

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
                    </TableRow>
                  ))}
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">TASA CONVERSION %</p>
              <p className="text-4xl font-black mt-3">{comercialUnico.tasaConversion}%</p>
              <p className="text-sm text-muted-foreground mt-2">Leads → clientes nuevos</p>
            </div>
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">META</p>
              <p className="text-4xl font-black mt-3">{comercialUnico.meta}%</p>
              <p className="text-sm text-muted-foreground mt-2">Objetivo mensual comercial</p>
            </div>
          </div>
        </div>
      ) : (
        <KpiHistoricoComercial data={historicalComercial} loading={isHistoricalLoading} />
      )}
    </div>
  )
}
