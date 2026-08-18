"use client"

/**
 * RecepcionStatusBadge
 * --------------------
 * Badge de STATUS para la columna de Recepción de Probetas.
 * Usa los mismos colores y estados que el módulo OT:
 *   PENDIENTE  (gris, clickeable)  → OT no creada O OT incompleta
 *   EMITIDO    (verde, estático)   → OT con todos los campos completos
 *   COMPLETADO (azul, estático)    → OT en estado COMPLETADO o DESCARGADO
 */

import { Check, CheckCircle2, AlertTriangle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface RecepcionStatusBadgeProps {
    numeroRecepcion?: string | null
    otExists?: boolean
    otEstado?: string | null
    otMissingFields?: string[]
    onNavigateToOTConcreto?: (numRecepcion: string) => void
}

export function RecepcionStatusBadge({
    numeroRecepcion,
    otExists = false,
    otEstado,
    otMissingFields = [],
    onNavigateToOTConcreto,
}: RecepcionStatusBadgeProps) {
    const estado = otEstado ?? "PENDIENTE"
    const isCompletado = otExists && (estado === "COMPLETADO" || estado === "DESCARGADO")
    const isEmitido    = otExists && estado === "EMITIDO"

    /* ── COMPLETADO ─────────────────────────── */
    if (isCompletado) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-300 shadow-2xs cursor-default transition-transform hover:scale-105">
                        <CheckCircle2 className="h-3 w-3 text-sky-600" />
                        <span>COMPLETADO</span>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="bg-slate-900 text-white border-slate-700 p-2.5 max-w-xs shadow-2xl text-center">
                    <div className="font-bold text-sky-400 flex items-center justify-center gap-1.5 text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> OT completada
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">La OT Concreto fue finalizada correctamente.</div>
                </TooltipContent>
            </Tooltip>
        )
    }

    /* ── EMITIDO ────────────────────────────── */
    if (isEmitido) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs cursor-default transition-transform hover:scale-105">
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span>EMITIDO</span>
                    </span>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="bg-slate-900 text-white border-slate-700 p-2.5 max-w-xs shadow-2xl text-center">
                    <div className="font-bold text-emerald-400 flex items-center justify-center gap-1.5 text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> OT emitida
                    </div>
                    <div className="text-[10px] text-slate-300 mt-1">Todos los datos de Recepción y OT están completos.</div>
                </TooltipContent>
            </Tooltip>
        )
    }

    /* ── PENDIENTE ──────────────────────────── */
    const title = !otExists
        ? "OT Concreto no creada"
        : "OT Concreto pendiente de completar"
    const missingList = !otExists
        ? ["OT Concreto no ha sido creada para esta recepción"]
        : otMissingFields.length > 0
            ? otMissingFields
            : ["Faltan datos en la OT (responsables / probetas / elementos)"]

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    onClick={() => { if (numeroRecepcion) onNavigateToOTConcreto?.(numeroRecepcion) }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300 shadow-2xs cursor-pointer transition-all hover:bg-slate-200 hover:scale-105 active:scale-95"
                >
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
                    <span>PENDIENTE</span>
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
                            <span className="text-amber-400 text-[10px] mt-0.5">•</span>
                            <span>{m}</span>
                        </li>
                    ))}
                </ul>
                <div className="pt-1.5 border-t border-slate-800 text-[10px] text-sky-300 font-semibold flex items-center gap-1">
                    <span>👉 Clic para ir a OT Concreto</span>
                </div>
            </TooltipContent>
        </Tooltip>
    )
}
