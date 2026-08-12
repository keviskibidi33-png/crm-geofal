"use client"

import { Download, Eye, FileText, Building2, User2, Package, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, Loader2, Mail, Phone, Trash2, UploadCloud } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Quote } from "./types"

interface QuotePreviewPanelProps {
    quote: Quote | null
    onDownload: (quote: Quote) => void
    onStatusChange: (quoteId: string, status: Quote["estado"]) => void
    onViewFull: (quote: Quote) => void
    onEdit: (quote: Quote) => void
    onDuplicate: (quote: Quote) => void
    onDelete: (quote: Quote) => void
    onUpload: (quote: Quote) => void
    isUpdating?: boolean
}

const statusConfig = {
    pendiente: {
        color: "bg-amber-500/20 text-amber-600 border-amber-500/30",
        icon: AlertCircle,
        label: "Pendiente",
    },
    aprobada: {
        color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
        icon: CheckCircle2,
        label: "Aprobada",
    },
    rechazada: {
        color: "bg-red-500/20 text-red-600 border-red-500/30",
        icon: XCircle,
        label: "Rechazada",
    },
    borrador: {
        color: "bg-slate-500/20 text-slate-600 border-slate-500/30",
        icon: Clock,
        label: "Borrador",
    },
}

export function QuotePreviewPanel({
    quote,
    onDownload,
    onStatusChange,
    onViewFull,
    onEdit,
    onDuplicate,
    onDelete,
    onUpload,
    isUpdating,
}: QuotePreviewPanelProps) {
    if (!quote) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-secondary/10">
                <FileText className="h-12 w-12 stroke-[1.5] mb-3 opacity-40" />
                <p className="text-sm font-medium">Selecciona una cotización</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Haz clic en una fila para ver los detalles rápidos aquí
                </p>
            </div>
        )
    }

    const currentStatus = statusConfig[quote.estado] || statusConfig.pendiente
    const StatusIcon = currentStatus.icon

    return (
        <div className="h-full flex flex-col bg-card">
            {/* Header */}
            <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-lg text-foreground">
                                COT-{quote.numero}-{quote.year}
                            </h3>
                            <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${currentStatus.color}`}
                            >
                                <StatusIcon className="h-3 w-3" />
                                {currentStatus.label}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Generada el {quote.fecha}
                        </p>
                    </div>
                </div>

                <div className="text-right bg-secondary/30 p-2.5 rounded-lg border border-border/50">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold block">Monto Total</span>
                    <span className="text-xl font-bold text-primary">
                        S/. {quote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 text-xs">
                    {/* Cliente Info */}
                    <div className="space-y-2">
                        <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5" />
                            Empresa / Cliente
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5 border border-border/40">
                            <p className="font-bold text-sm text-foreground">{quote.cliente}</p>
                            {quote.clienteRuc && (
                                <p className="text-muted-foreground">RUC: <span className="font-mono font-medium text-foreground">{quote.clienteRuc}</span></p>
                            )}
                            {quote.clienteContacto && (
                                <p className="text-muted-foreground flex items-center gap-1 pt-1">
                                    <User2 className="h-3 w-3" />
                                    <span>{quote.clienteContacto}</span>
                                </p>
                            )}
                            {quote.clienteEmail && (
                                <p className="text-muted-foreground flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    <span className="truncate">{quote.clienteEmail}</span>
                                </p>
                            )}
                            {quote.clienteTelefono && (
                                <p className="text-muted-foreground flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    <span>{quote.clienteTelefono}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Proyecto Info */}
                    {quote.proyectoNombre && (
                        <>
                            <div className="space-y-2">
                                <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    Proyecto / Obra
                                </div>
                                <div className="bg-secondary/30 rounded-lg p-3 border border-border/40">
                                    <p className="font-semibold text-foreground">{quote.proyectoNombre}</p>
                                </div>
                            </div>
                            <Separator />
                        </>
                    )}

                    {/* Items Detail */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                                <Package className="h-3.5 w-3.5" />
                                Detalle de Items ({quote.itemsCount})
                            </div>
                        </div>

                        {quote.itemsJson && quote.itemsJson.length > 0 ? (
                            <div className="space-y-2">
                                {quote.itemsJson.map((item: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="bg-secondary/20 rounded-lg p-3 border border-border/30 hover:border-primary/20 transition-colors"
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-1.5">
                                            <p className="font-medium text-xs line-clamp-2 flex-1">
                                                {item.descripcion || item.item || `Item ${idx + 1}`}
                                            </p>
                                            <span className="text-xs font-bold text-primary shrink-0">
                                                S/. {Number(item.total || item.total_item || (item.costo_unitario || item.precio_unitario || 0) * (item.cantidad || 1)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                            <span className="bg-background/60 px-1.5 py-0.5 rounded">
                                                Cant: <strong className="text-foreground">{item.cantidad || 1}</strong>
                                            </span>
                                            <span className="bg-background/60 px-1.5 py-0.5 rounded">
                                                P.U: <strong className="text-foreground">S/. {Number(item.costo_unitario || item.precio_unitario || item.pu || 0).toFixed(2)}</strong>
                                            </span>
                                            {item.unidad && (
                                                <span className="bg-background/60 px-1.5 py-0.5 rounded">
                                                    {item.unidad}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Total Cotización</span>
                                    <span className="text-lg font-bold text-primary">
                                        S/. {quote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-muted-foreground text-xs">
                                No hay items disponibles
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Actions Footer */}
            <div className="p-3 border-t border-border bg-secondary/10 space-y-2">
                <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs gap-1.5" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                Cambiar Estado
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem onClick={() => onStatusChange(quote.id, "aprobada")} className="gap-2 text-xs">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Aprobar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(quote.id, "rechazada")} className="gap-2 text-xs">
                                <XCircle className="h-3.5 w-3.5 text-red-500" /> Rechazar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(quote.id, "pendiente")} className="gap-2 text-xs">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Pendiente
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="default"
                        size="sm"
                        className="flex-1 h-9 text-xs gap-1.5"
                        onClick={() => onDownload(quote)}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                    </Button>
                </div>

                <div className="flex gap-2">
                     <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9 text-xs gap-1.5 bg-background hover:bg-muted"
                        onClick={() => onUpload(quote)}
                        title="Reemplazar archivo (PDF/Excel)"
                        disabled={isUpdating}
                    >
                        {isUpdating ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <UploadCloud className="h-3.5 w-3.5" />
                        )}
                        {isUpdating ? "Subiendo..." : "Subir Archivo"}
                    </Button>
                    
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 h-9 text-xs gap-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                        onClick={() => onEdit(quote)}
                    >
                        <FileText className="h-3.5 w-3.5" />
                        Editar
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs gap-1.5"
                        onClick={() => onDuplicate(quote)}
                    >
                        <FileText className="h-3.5 w-3.5" />
                        Duplicar
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => onViewFull(quote)}
                    >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Ver Completo
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(quote)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
