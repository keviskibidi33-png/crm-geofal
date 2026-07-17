"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, RefreshCw, Search, Download, Eye, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { authFetch } from "@/lib/api-auth"

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe").replace(/^http:\/\//, "https://")

type LoteSummary = {
  codigo_lote_interno: string
  fecha_moldeo: string
  elemento: string
  detalle_elemento: string
  cantidad_probetas: number
  estado: string
}

type ProbetaRow = {
  id: number
  item: number
  codigo_probeta: string
  sigla: string
  elemento: string
  detalle_elemento: string
  fecha_moldeo: string
  edad: number
  fecha_rotura: string
  codigo_muestra_lem: string
  estado: string
  codigo_lote_interno: string
  carga_maxima: number | null
}

function lotColorClasses(lote: string) {
  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-violet-50 text-violet-700 border-violet-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
  ]
  const idx = Math.abs((lote || "").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0))
  return colors[idx % colors.length]
}

export function HuantaSeguimientoModule() {
  const [lotes, setLotes] = useState<LoteSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")

  // Detail Modal
  const [selectedLote, setSelectedLote] = useState<LoteSummary | null>(null)
  const [probetas, setProbetas] = useState<ProbetaRow[]>([])
  const [loadingProbetas, setLoadingProbetas] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [exporting, setExporting] = useState(false)

  const fetchLotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_URL}/api/huanta-probetas/lotes`)
      if (!res.ok) throw new Error("No se pudieron cargar los lotes")
      const data = await res.json()
      setLotes(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar lotes")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchLotes() }, [fetchLotes])

  const onReload = async () => {
    setRefreshing(true)
    await fetchLotes()
    setRefreshing(false)
    toast.success("Listado de lotes actualizado")
  }

  const handleRowClick = async (lote: LoteSummary) => {
    setSelectedLote(lote)
    setSelectedIds([])
    setLoadingProbetas(true)
    try {
      const res = await authFetch(`${API_URL}/api/huanta-probetas?ts=${Date.now()}`)
      if (!res.ok) throw new Error("No se pudieron cargar las probetas")
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      // Filter by lot code locally
      const filtered = list.filter((p: ProbetaRow) => p.codigo_lote_interno === lote.codigo_lote_interno)
      setProbetas(filtered)
    } catch (err: any) {
      toast.error(err?.message || "Error al cargar detalle del lote")
    } finally {
      setLoadingProbetas(false)
    }
  }

  const handleCheckboxChange = (id: number, checked: boolean) => {
    if (checked) {
      if (selectedIds.length >= 3) {
        toast.warning("Límite máximo", { description: "Solo puedes exportar un máximo de 3 probetas por informe." })
        return
      }
      setSelectedIds((prev) => [...prev, id])
    } else {
      setSelectedIds((prev) => prev.filter((x) => x !== id))
    }
  }

  const handleExportReport = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selección vacía", { description: "Por favor selecciona al menos una probeta." })
      return
    }
    setExporting(true)
    const toastId = toast.loading("Generando Reporte Excel...")
    try {
      const res = await authFetch(`${API_URL}/api/huanta-probetas/export-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probeta_ids: selectedIds }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || "Error al exportar reporte")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `INF-HUANTA-PROBETAS_${selectedLote?.codigo_lote_interno || "LOTE"}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success("Reporte descargado correctamente", { id: toastId })
    } catch (err: any) {
      toast.error(err?.message || "Error al descargar reporte", { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  const filteredLotes = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lotes
    return lotes.filter((l) =>
      [l.codigo_lote_interno, l.elemento, l.detalle_elemento, l.estado]
        .some((v) => (v || "").toLowerCase().includes(q))
    )
  }, [lotes, search])

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 bg-white border-b border-slate-100">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Seguimiento por Lote</h1>
          <p className="text-sm text-slate-500 mt-1">Control consolidado de lotes. Selecciona un lote para visualizar e imprimir sus informes.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={onReload} disabled={loading || refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b flex items-center gap-3 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lote o elemento..." className="pl-9" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading && lotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm font-medium">Cargando lotes Huanta...</p>
              </div>
            ) : filteredLotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <AlertCircle className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium">No se encontraron lotes Huanta</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#f4f4f5] border-b border-slate-100">
                  <TableRow>
                    <TableHead>Lote Interno</TableHead>
                    <TableHead>Fecha Moldeo</TableHead>
                    <TableHead>Elemento</TableHead>
                    <TableHead>Detalle</TableHead>
                    <TableHead className="text-center">Probetas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[100px] text-center">Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLotes.map((row) => (
                    <TableRow
                      key={row.codigo_lote_interno}
                      className="hover:bg-slate-50/30 cursor-pointer"
                      onClick={() => void handleRowClick(row)}
                    >
                      <TableCell className="font-semibold text-slate-900">
                        <Badge className={`px-2 py-0.5 text-[10px] font-semibold border ${lotColorClasses(row.codigo_lote_interno)}`}>
                          {row.codigo_lote_interno}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.fecha_moldeo}</TableCell>
                      <TableCell>{row.elemento}</TableCell>
                      <TableCell>{row.detalle_elemento}</TableCell>
                      <TableCell className="text-center font-semibold">{row.cantidad_probetas}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          row.estado === "ENSAYADO"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : row.estado === "DESCARGADO"
                            ? "bg-sky-50 text-sky-700 border border-sky-100"
                            : row.estado === "PARCIAL"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-slate-100 text-slate-600"
                        }`}>{row.estado}</span>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900" onClick={() => void handleRowClick(row)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Lote Detail / Select Export Dialog */}
      <Dialog open={selectedLote !== null} onOpenChange={(open) => { if (!open) setSelectedLote(null) }}>
        <DialogContent className="max-w-[96vw] w-[1100px] h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Detalle Lote — {selectedLote?.codigo_lote_interno}</DialogTitle>
            <DialogDescription className="sr-only">Detalle del lote y selección de probetas para exportación</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4 pr-1 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border">
              <div>
                <span className="text-slate-500 block text-xs">Elemento</span>
                <span className="font-semibold text-slate-800">{selectedLote?.elemento}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Detalle</span>
                <span className="font-semibold text-slate-800">{selectedLote?.detalle_elemento}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Fecha Moldeo</span>
                <span className="font-semibold text-slate-800">{selectedLote?.fecha_moldeo}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs">Estado Lote</span>
                <span className="font-semibold text-slate-800">{selectedLote?.estado}</span>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
              {loadingProbetas ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-xs">Cargando probetas...</p>
                </div>
              ) : (
                  <Table>
                    <TableHeader className="bg-[#f4f4f5]">
                      <TableRow>
                        <TableHead className="w-12 text-center">Seleccionar</TableHead>
                        <TableHead className="w-16 text-center">Item</TableHead>
                        <TableHead>Código Probeta</TableHead>
                        <TableHead>Código Muestra LEM</TableHead>
                        <TableHead className="text-center">Fecha Rotura</TableHead>
                        <TableHead className="text-center">Carga Maxima (Kn)</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {probetas.map((p, idx) => {
                        const isSelected = selectedIds.includes(p.id)
                        const isMaxReached = selectedIds.length >= 3 && !isSelected
                        return (
                          <TableRow key={p.id} className={idx % 2 === 0 ? "bg-slate-50/40" : "bg-white"}>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={isSelected}
                                disabled={isMaxReached}
                                onCheckedChange={(checked) => handleCheckboxChange(p.id, !!checked)}
                              />
                            </TableCell>
                            <TableCell className="font-semibold text-center">{p.item}</TableCell>
                            <TableCell className="font-mono">{p.codigo_probeta}</TableCell>
                            <TableCell className="text-xs">{p.codigo_muestra_lem || "-"}</TableCell>
                            <TableCell className="text-center">{p.fecha_rotura}</TableCell>
                            <TableCell className="text-center font-semibold">
                              {p.carga_maxima != null ? p.carga_maxima.toFixed(2).replace('.', ',') : "-"}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                p.estado === "ENSAYADO" ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : p.estado === "DESCARGADO" ? "bg-sky-50 text-sky-700 border border-sky-100"
                                : "bg-slate-100 text-slate-600"
                              }`}>{p.estado}</span>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
              )}
            </div>

            <div className="text-xs text-slate-500 flex justify-between items-center">
              <span>* Selecciona un máximo de 3 probetas para generar el informe final.</span>
              <span className="font-semibold text-slate-700">Seleccionadas: {selectedIds.length} / 3 Máx</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLote(null)}>Cerrar</Button>
            <Button onClick={handleExportReport} disabled={selectedIds.length === 0 || exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Exportar Reporte ({selectedIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
