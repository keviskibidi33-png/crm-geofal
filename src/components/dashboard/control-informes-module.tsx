"use client"

import { useEffect, useMemo, useState } from "react"
import { 
  CheckCircle2, 
  FileText, 
  Loader2, 
  RefreshCw, 
  FlaskConical, 
  Grid, 
  Droplets, 
  Waves, 
  Construction, 
  Pipette, 
  Square, 
  Map,
  User,
  Check,
  Clock,
  PlusCircle,
  LayoutDashboard,
  Library
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authFetch } from "@/lib/api-auth"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type CatalogItem = {
  codigo: string
  nombre: string
  area?: string | null
  orden: number
  activo: boolean
}

type CounterItem = {
  codigo: string
  ultimo_numero: number
}

type ResumenItem = {
  codigo: string
  nombre: string
  ultimo_informe: string
  total_anio?: number | null
  total_mes?: number | null
  total?: number | null
  ultimo_enviado: boolean
  ultimo_responsable: string
}


const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

const TABS_CATEGORIES = [
  { id: "SUELO", label: "SUELO", icon: FlaskConical },
  { id: "AGREGADO", label: "AGREGADO", icon: Grid },
  { id: "HUMEDAD SUELO", label: "HUMEDAD SUELO", icon: Droplets },
  { id: "DENSIDAD SUELO", label: "DENSIDAD SUELO", icon: Waves },
  { id: "CONCRETO", label: "CONCRETO", icon: Construction },
  { id: "ALBAÑILERIA", label: "ALBAÑILERIA", icon: Square },
  { id: "PAVIMENTO", label: "PAVIMENTO", icon: Map },
]

const FEATURED_CATEGORY = { id: "PROBETAS", label: "PROBETAS", icon: FlaskConical }


export function ControlInformesModule() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  
  const [catalogo, setCatalogo] = useState<CatalogItem[]>([])
  const [resumen, setResumen] = useState<ResumenItem[]>([])
  const [viewMode, setViewMode] = useState<"master" | "areas">("master")
  
  const [activeTab, setActiveTab] = useState("SUELO")
  
  const filteredCatalog = useMemo(() => {
    if (activeTab === "CONCRETO") {
      return catalogo.filter((c) => {
        const area = (c.area || "").toUpperCase()
        return area === "CONCRETO" || area === "AGUA"
      })
    }
    return catalogo.filter((c) => (c.area || "").toUpperCase() === activeTab.toUpperCase())
  }, [catalogo, activeTab])

  const loadData = async (area: string = activeTab) => {
    setResumen([])
    setLoading(true)
    try {
      const [dashboardRes, resumenRes] = await Promise.all([
        authFetch(`${API_URL}/api/control-informes/dashboard`),
        authFetch(`${API_URL}/api/control-informes/resumen?area=${encodeURIComponent(area)}`),
      ])

      if (!dashboardRes.ok) throw new Error("No se pudo cargar el catálogo")
      if (!resumenRes.ok) throw new Error("No se pudo cargar el resumen")

      const dashboardData = await dashboardRes.json()
      const resumenData = await resumenRes.json()

      setCatalogo(Array.isArray(dashboardData?.catalogo) ? dashboardData.catalogo : [])
      setResumen(
        Array.isArray(resumenData?.items)
          ? resumenData.items.map((item: ResumenItem) => ({
              ...item,
              total_anio: Number(item.total_anio ?? item.total_mes ?? item.total ?? 0),
            }))
          : []
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let areaToLoad = viewMode === "master" ? "PROBETAS" : activeTab
    if (areaToLoad === "CONCRETO") {
      areaToLoad = "CONCRETO,AGUA"
    }
    void loadData(areaToLoad)
  }, [activeTab, viewMode])

  const toggleEnviado = async (codigo: string, currentStatus: boolean) => {
    setToggling(codigo)
    try {
      const res = await authFetch(`${API_URL}/api/control-informes/ensayo/${codigo}/toggle-enviado?enviado=${!currentStatus}`, {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("Error al actualizar estado")
      
      setResumen(prev => prev.map(item => 
        item.codigo === codigo ? { ...item, ultimo_enviado: !currentStatus } : item
      ))
      toast.success("Estado actualizado")
    } catch (error) {
      toast.error("No se pudo actualizar el estado")
    } finally {
      setToggling(null)
    }
  }

  const quickRegister = async (codigo: string) => {
    setSaving(codigo)
    try {
      const res = await authFetch(`${API_URL}/api/control-informes`, {
        method: "POST",
        body: JSON.stringify({
          fecha: new Date().toISOString().slice(0, 10),
          archivo_nombre: "REGISTRO RÁPIDO",
          archivo_url: null,
          observaciones: "Incremento por acción rápida",
          ensayos: [codigo],
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.detail || "No se pudo registrar")
      }

      toast.success("Contador incrementado correctamente")
      await loadData(viewMode === "master" ? "PROBETAS" : (activeTab === "CONCRETO" ? "CONCRETO,AGUA" : activeTab))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al registrar")
    } finally {
      setSaving(null)
    }
  }

  const renderCategoryTable = (areaId: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-300">
          <tr>
            <th className="px-6 py-4 text-sm uppercase tracking-wider">Tipo de Ensayo</th>
            <th className="px-6 py-4 border-l border-slate-200 text-center text-sm uppercase tracking-wider">Último Informe</th>
            <th className="px-6 py-4 border-l border-slate-200 text-center text-slate-950 text-sm uppercase tracking-wider">Total</th>
            {activeTab === "CONCRETO" && <th className="px-6 py-4 border-l border-slate-200 text-center text-sm uppercase tracking-wider">Categoría</th>}
            <th className="px-6 py-4 border-l border-slate-200 text-center text-sm uppercase tracking-wider">Acción Rápida</th>
          </tr>
        </thead>



        <tbody className="divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td colSpan={activeTab === "CONCRETO" ? 5 : 4} className="px-6 py-8 text-center text-slate-300">Cargando datos...</td>
              </tr>
            ))
          ) : resumen.length === 0 ? (
            <tr>
              <td colSpan={activeTab === "CONCRETO" ? 5 : 4} className="px-6 py-12 text-center text-slate-400 italic">No se encontraron ensayos registrados en esta área.</td>
            </tr>
          ) : (
            resumen.map((item) => {
              const catalogItem = catalogo.find(c => c.codigo === item.codigo)
              const isAgua = (catalogItem?.area || "").toUpperCase() === "AGUA"
              
              return (
                <tr 
                  key={item.codigo} 
                  className={`group hover:bg-slate-50 transition-colors ${isAgua ? "bg-sky-50/50 hover:bg-sky-100/50" : ""}`}
                >
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-base font-bold text-slate-900 leading-tight">{item.nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 border-l border-slate-200 text-center">
                    <Badge variant="outline" className={`text-sm font-mono border-slate-300 px-3 py-1 mx-auto ${item.ultimo_informe !== "-" ? "bg-slate-50 text-slate-950 font-bold" : "text-slate-400"}`}>
                      {item.ultimo_informe}
                    </Badge>
                  </td>
                  <td className="px-6 py-5 border-l border-slate-200 text-center">
                    <span className={`text-lg font-bold block ${(Number(item.total_anio) || 0) > 0 ? "text-slate-950" : "text-slate-400"}`}>
                      {Number(item.total_anio ?? item.total_mes ?? item.total ?? 0)}
                    </span>
                  </td>



                  {activeTab === "CONCRETO" && (
                    <td className="px-6 py-5 border-l border-slate-200 text-center">
                      <Badge variant="outline" className={`text-xs font-bold ${isAgua ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-50 text-slate-700 border-slate-300"}`}>
                        {isAgua ? "AGUA" : "CONCRETO"}
                      </Badge>
                    </td>
                  )}
                  <td className="px-6 py-5 text-center border-l border-slate-200">


                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="outline"
                            className={`h-9 w-9 rounded-xl transition-all border-slate-200 text-slate-600 hover:bg-slate-900 hover:text-white shadow-sm`}

                            onClick={() => void quickRegister(item.codigo)}
                            disabled={saving === item.codigo}
                          >
                            {saving === item.codigo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <PlusCircle className="h-5 w-5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Registro Rápido (+1)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 px-4 md:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Control de Informes</h1>
          <p className="text-slate-500 text-sm font-medium">Gestión dinámica de correlativos por área técnica.</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner gap-1">

          <button
            onClick={() => setViewMode("master")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              viewMode === "master" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Probetas
          </button>


          <button
            onClick={() => setViewMode("areas")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              viewMode === "areas" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Library className="h-4 w-4" />
            Ensayos
          </button>

        </div>
      </div>

      {viewMode === "master" ? (
        /* SECCIÓN DESTACADA: PROBETAS */
        <section className="animate-in slide-in-from-bottom-4 duration-700">
          <Card className="border-slate-200 bg-white shadow-lg shadow-slate-100/50 overflow-hidden relative border-t-2 border-t-slate-900">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200">
                    <FlaskConical className="h-6 w-6 text-slate-950" />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-slate-950 tracking-tight leading-none uppercase">Compresión de Probetas</h2>
                  </div>
                </div>

              </div>
            </CardHeader>
            <CardContent className="p-0">
              {renderCategoryTable("PROBETAS")}
            </CardContent>
          </Card>
        </section>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
          <div className="overflow-x-auto pb-2 scrollbar-none">
            <TabsList className="bg-slate-100 border border-slate-200 p-1 h-auto flex-nowrap w-max min-w-full justify-start md:justify-center">
              {TABS_CATEGORIES.map((cat) => (
                <TabsTrigger 
                  key={cat.id} 
                  value={cat.id}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm transition-all whitespace-nowrap"
                >
                  <cat.icon className="h-4 w-4" />
                  {cat.label}
                </TabsTrigger>

              ))}
            </TabsList>
          </div>

          {TABS_CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-0 outline-none">
              <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <cat.icon className="h-5 w-5 text-slate-700" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-slate-900 font-bold uppercase tracking-tight">Control — {cat.label}</CardTitle>
                      </div>
                    </div>

                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => void loadData()} 
                      className="border-slate-200 hover:bg-slate-50 text-slate-500"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {renderCategoryTable(cat.id)}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
