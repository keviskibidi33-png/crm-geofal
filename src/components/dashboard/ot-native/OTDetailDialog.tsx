"use client"

import { useState } from "react"
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Download, Calendar, Layers, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { OTData } from "./OTForm"

interface OTDetailDialogProps {
  ot: OTData
  onClose: () => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function OTDetailDialog({ ot, onClose }: OTDetailDialogProps) {
  const [downloading, setDownloading] = useState(false)

  const handleExportExcel = async () => {
    if (!ot.id) return
    setDownloading(true)
    try {
      const res = await fetch(`${API_URL}/api/ot/${ot.id}/excel`)
      if (!res.ok) throw new Error("Error al descargar el archivo Excel")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `OT-${(ot.numero_ot || "001").replace("/", "-")}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()

      toast.success("Excel de Orden de Trabajo descargado correctamente")
    } catch (err: any) {
      toast.error(err.message || "No se pudo descargar el Excel")
    } finally {
      setDownloading(false)
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "COMPLETADO":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">COMPLETADO</Badge>
      case "EN PROCESO":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">EN PROCESO</Badge>
      default:
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">PENDIENTE</Badge>
    }
  }

  return (
    <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-6 sm:p-8 rounded-2xl">
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <FileText className="h-6 w-6 text-amber-600" />
            Orden de Trabajo: <span className="font-mono text-amber-700">{ot.numero_ot}</span>
          </DialogTitle>
          {getStatusBadge(ot.estado)}
        </div>
        <DialogDescription>
          Vista detallada del registro oficial F-LEM-P-02.01.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 mt-4">
        {/* Encabezado */}
        <div className="grid grid-cols-3 gap-4 bg-amber-50/60 p-4 rounded-xl border border-amber-200/60 text-xs">
          <div>
            <span className="font-semibold text-slate-500 block">N° OT</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{ot.numero_ot}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 block">N° RECEPCIÓN</span>
            <span className="font-mono font-semibold text-slate-800">{ot.numero_recepcion || "-"}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500 block">REFERENCIA</span>
            <span className="font-medium text-slate-800">{ot.referencia || "-"}</span>
          </div>
        </div>

        {/* Tabla de ítems */}
        <div>
          <div className="flex items-center gap-2 font-semibold text-sm text-slate-800 mb-2">
            <Layers className="h-4 w-4 text-blue-600" />
            Ítems y Muestras ({ot.items?.length || 0})
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead className="w-12 text-center">ÍTEM</TableHead>
                  <TableHead className="w-36">CÓDIGO MUESTRA</TableHead>
                  <TableHead>DESCRIPCIÓN DE ENSAYO / SERVICIO</TableHead>
                  <TableHead className="w-20 text-center">CANT.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ot.items && ot.items.length > 0 ? (
                  ot.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-bold text-slate-500 text-xs">
                        {item.item || idx + 1}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-blue-700">
                        {item.codigo_muestra || "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-800">
                        {item.descripcion || "-"}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs text-slate-700">
                        {item.cantidad || 1}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-400 py-4 text-xs">
                      Sin ítems registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Fechas de control */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
          <div className="flex items-center gap-2 font-semibold text-slate-800 border-b border-slate-200 pb-2">
            <Calendar className="h-4 w-4 text-emerald-600" />
            Fechas y Control de Ejecución
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-slate-500 block">Fecha Recepción</span>
              <span className="font-medium text-slate-800">{ot.fecha_recepcion || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Plazo Entrega (Días)</span>
              <span className="font-bold text-slate-900">{ot.plazo_entrega_dias || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Duración Real</span>
              <span className="font-medium text-slate-800">{ot.duracion_real_ejecucion_dias || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Inicio Programado</span>
              <span className="font-medium text-slate-800">{ot.inicio_programado || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Fin Programado</span>
              <span className="font-medium text-slate-800">{ot.fin_programado || "-"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Var. Inicio / Fin</span>
              <span className="font-medium text-slate-800">
                {ot.variacion_inicio || "-"} / {ot.variacion_fin || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Observaciones y personal */}
        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <span className="font-semibold text-slate-600 block mb-1">Aperturada Por:</span>
            <span className="font-medium text-slate-900">{ot.ot_aperturada_por || "-"}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-600 block mb-1">Designada A (Técnicos):</span>
            <span className="font-medium text-slate-900">{ot.ot_designada_a || "-"}</span>
          </div>
          {ot.observaciones && (
            <div className="col-span-2 border-t border-slate-200 pt-2 mt-1">
              <span className="font-semibold text-slate-600 block mb-1">Observaciones:</span>
              <p className="text-slate-700 italic">{ot.observaciones}</p>
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="flex justify-between items-center sm:justify-between pt-4">
        <Button variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          onClick={handleExportExcel}
          disabled={downloading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Descargar Excel (.xlsx)
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
