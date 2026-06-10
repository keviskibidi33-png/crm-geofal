"use client"

import { useState, useEffect } from "react"
import { authFetch } from "@/lib/api-auth"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, FileText } from "lucide-react"
import type { CompresionEnsayo } from "@/types/compresion"
import { formatLocalDate } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

interface CompresionDetailProps {
  ensayoId: number
  onClose: () => void
}

export default function CompresionDetail({ ensayoId, onClose }: CompresionDetailProps) {
  const [data, setData] = useState<CompresionEnsayo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    authFetch(`${API_URL}/api/compresion/${ensayoId}`)
      .then(async (res) => {
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      })
      .catch(() => {
        // ignore
      })
      .finally(() => setLoading(false))
  }, [ensayoId])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground font-medium">Cargando datos del ensayo...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground italic">No se encontraron datos para este ensayo.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Detalle de F. Probetas</h2>
          </div>
          <Badge variant="outline">{data.estado}</Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
          <div>
            <span className="text-[10px] font-bold uppercase text-muted-foreground block">N° OT</span>
            <span className="font-semibold text-primary font-mono">{data.numero_ot}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-muted-foreground block">N° Recepción</span>
            <span className="font-semibold">{data.numero_recepcion}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-muted-foreground block">Equipo</span>
            <span className="font-semibold">{data.codigo_equipo || "-"}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-muted-foreground block">Fecha Creación</span>
            <span className="font-semibold">
              {data.fecha_creacion
                ? new Date(data.fecha_creacion).toLocaleDateString("es-PE")
                : "-"}
            </span>
          </div>
        </div>
        {(data.otros || data.nota) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-sm">
            {data.otros && (
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Otros</span>
                <span>{data.otros}</span>
              </div>
            )}
            {data.nota && (
              <div>
                <span className="text-[10px] font-bold uppercase text-muted-foreground block">Nota</span>
                <span className="italic text-muted-foreground">{data.nota}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <div className="rounded-md border overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[1400px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase w-10">Item</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-32">Cód. LEM</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-32">F. Programado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-32">F. Ensayo</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-20">Hora</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-24">Carga (kN)</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-16">Fractura</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-20">Defectos</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-28">Realizado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-28">Revisado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-32">F. Revisión</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-28">Aprobado</TableHead>
                  <TableHead className="text-[10px] font-black uppercase w-32">F. Aprobación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items?.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 h-10">
                    <TableCell className="text-xs font-bold text-center py-2">{item.item}</TableCell>
                    <TableCell className="text-[11px] font-mono text-primary py-2">
                      {item.codigo_lem || "-"}
                    </TableCell>
                    <TableCell className="text-xs py-2">
                      {formatLocalDate(item.fecha_ensayo_programado)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold py-2">
                      {formatLocalDate(item.fecha_ensayo)}
                    </TableCell>
                    <TableCell className="text-xs py-2">{item.hora_ensayo || "-"}</TableCell>
                    <TableCell className="text-xs font-bold text-green-700 py-2">
                      {item.carga_maxima != null ? `${item.carga_maxima} kN` : "-"}
                    </TableCell>
                    <TableCell className="text-xs py-2">{item.tipo_fractura || "-"}</TableCell>
                    <TableCell className="text-xs py-2">{item.defectos || "-"}</TableCell>
                    <TableCell className="text-[10px] py-2">{item.realizado || "-"}</TableCell>
                    <TableCell className="text-[10px] py-2">{item.revisado || "-"}</TableCell>
                    <TableCell className="text-xs py-2">
                      {formatLocalDate(item.fecha_revisado)}
                    </TableCell>
                    <TableCell className="text-[10px] py-2">{item.aprobado || "-"}</TableCell>
                    <TableCell className="text-xs py-2">
                      {formatLocalDate(item.fecha_aprobado)}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data.items || data.items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={13} className="h-16 text-center text-xs text-muted-foreground italic">
                      No hay resultados registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-6 py-4 border-t bg-muted/30 flex justify-end">
        <Button variant="outline" onClick={onClose} className="px-8 font-bold">
          Cerrar
        </Button>
      </div>
    </div>
  )
}
