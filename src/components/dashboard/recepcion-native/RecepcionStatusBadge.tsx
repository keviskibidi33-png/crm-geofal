"use client"

/**
 * RecepcionStatusBadge
 * --------------------
 * Badge de STATUS para Recepcion de Probetas.
 * Diseno IDENTICO al modulo OT Concreto (getStatusBadge):
 *   PENDIENTE  -> amber  (bg-amber-100 text-amber-800)   - clickeable
 *   EMITIDO    -> emerald (bg-emerald-100 text-emerald-800) - estatico
 *   COMPLETADO -> green  (bg-green-100 text-green-800)   - estatico
 */

import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface RecepcionStatusBadgeProps {
    numeroRecepcion?: string | null
    otExists?: boolean
    otEstado?: string | null
    otEmitida?: boolean
    otMissingFields?: string[]
    onNavigateToOTConcreto?: (numRecepcion: string) => void
}

export function RecepcionStatusBadge({
    numeroRecepcion,
    otExists = false,
    otEstado,
    otEmitida,
    otMissingFields = [],
    onNavigateToOTConcreto,
}: RecepcionStatusBadgeProps) {
    const estado = (otEstado ?? "").toUpperCase()
    const isCompletado = estado === "COMPLETADO" || estado === "DESCARGADO"
    const isEmitido    = otEmitida === true || estado === "EMITIDO"

    if (isCompletado) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 cursor-default">
                            Completado
                        </Badge>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="bg-slate-900 text-white border-slate-700 p-2.5 text-[11px]">
                    La OT Concreto fue finalizada correctamente.
                </TooltipContent>
            </Tooltip>
        )
    }

    if (isEmitido) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span>
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 cursor-default">
                            EMITIDO
                        </Badge>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="bg-slate-900 text-white border-slate-700 p-2.5 text-[11px]">
                    Todos los datos de Recepcion y OT estan completos.
                </TooltipContent>
            </Tooltip>
        )
    }

    const title = !otExists
        ? "OT Concreto no creada"
        : "OT Concreto pendiente de completar"
    const missingList = !otExists
        ? ["OT Concreto no ha sido creada para esta recepcion"]
        : otMissingFields.length > 0
            ? otMissingFields
            : ["Faltan datos en la OT (responsables / probetas / elementos)"]

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={() => { if (numeroRecepcion) onNavigateToOTConcreto?.(numeroRecepcion) }}
                    className="cursor-pointer"
                >
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                        Pendiente
                    </Badge>
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="bg-slate-900 text-white border-slate-700 p-3 max-w-xs shadow-2xl text-left">
                <div className="flex items-center gap-1.5 font-bold text-slate-300 pb-1.5 border-b border-slate-800 text-[11px]">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <span>{title}</span>
                </div>
                <ul className="space-y-1 my-2 text-[10.5px] text-slate-300">
                    {missingList.map((m, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 leading-tight">
                            <span className="text-amber-400 text-[10px] mt-0.5">*</span>
                            <span>{m}</span>
                        </li>
                    ))}
                </ul>
                <div className="pt-1.5 border-t border-slate-800 text-[10px] text-sky-300 font-semibold">
                    Click para ir a OT Concreto
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
