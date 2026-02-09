"use client"

import { useState, useEffect, useRef } from "react"
import { useTracing, TracingSummary } from "@/hooks/use-tracing"
import { useReactToPrint } from "react-to-print"
import {
    Search,
    CheckCircle2,
    Clock,
    AlertCircle,
    FileText,
    FlaskConical,
    Zap,
    LayoutList,
    ArrowRight,
    RefreshCw,
    Eye,
    ChevronRight,
    Calendar,
    Download,
    Printer
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

export function TracingModule() {
    const { tracingData, tracingList, loading, loadingList, error, fetchTracing, fetchTracingList } = useTracing()
    const [searchTerm, setSearchTerm] = useState("")
    const [isDetailOpen, setIsDetailOpen] = useState(false)

    const componentRef = useRef<HTMLDivElement>(null)

    const handlePrint = useReactToPrint({
        // @ts-ignore
        content: () => componentRef.current,
        documentTitle: `Seguimiento-${tracingData?.numero_recepcion || 'Muestra'}`,
    })

    // Cargar lista inicial
    useEffect(() => {
        fetchTracingList()
    }, [fetchTracingList])

    const handleOpenDetail = (numero: string) => {
        fetchTracing(numero)
        setIsDetailOpen(true)
    }

    const handleExportList = () => {
        // Implementación simple de exportación a CSV desde el frontend
        if (!tracingList.length) return

        const headers = ["Numero Recepcion", "Cliente", "Fecha", "Recepcion", "Verificacion", "Compresion", "Informe"]
        const rows = tracingList.map(item => [
            item.numero_recepcion,
            item.cliente || "",
            item.fecha ? new Date(item.fecha).toLocaleDateString() : "",
            item.stages.find(s => s.key === 'recepcion')?.status || "-",
            item.stages.find(s => s.key === 'verificacion')?.status || "-",
            item.stages.find(s => s.key === 'compresion')?.status || "-",
            item.stages.find(s => s.key === 'informe')?.status || "-"
        ])

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n")

        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `tracing_list_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completado': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'en_proceso': return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
            case 'por_implementar': return <Zap className="w-4 h-4 text-blue-400 opacity-60" />;
            default: return <AlertCircle className="w-4 h-4 text-slate-300" />;
        }
    }

    const getStatusBubble = (status: string, label: string) => {
        const colors = {
            completado: "bg-green-500 shadow-green-500/20",
            en_proceso: "bg-yellow-500 shadow-yellow-500/20",
            pendiente: "bg-slate-200 dark:bg-slate-800",
            por_implementar: "bg-blue-300 opacity-60"
        } as any;

        return (
            <div className="flex flex-col items-center gap-1">
                <div className={cn(
                    "w-3 h-3 rounded-full shadow-sm transition-all duration-300",
                    colors[status] || colors.pendiente
                )} />
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{label}</span>
            </div>
        )
    }

    const filteredList = tracingList.filter(item =>
        item.numero_recepcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col space-y-6 p-6 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Zap className="w-8 h-8 text-yellow-500" />
                        Seguimiento de Flujo (Tracing)
                    </h1>
                    <p className="text-muted-foreground">Monitoreo masivo del ciclo de vida de las muestras</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportList} disabled={loadingList} className="gap-2">
                        <Download className="w-4 h-4" />
                        Exportar Lista
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => fetchTracingList()} disabled={loadingList} className="gap-2">
                        <RefreshCw className={cn("w-4 h-4", loadingList && "animate-spin")} />
                        Actualizar
                    </Button>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-muted/30">
                <CardContent className="p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                            placeholder="Buscar por cliente o número de recepción..."
                            className="pl-10 h-10 border-none focus-visible:ring-1"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <ScrollArea className="flex-1 rounded-xl border bg-card shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[180px]">Número Recepción</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="w-[120px]">Fecha</TableHead>
                            <TableHead className="text-center w-[240px]">Estado por Etapa</TableHead>
                            <TableHead className="text-right w-[100px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loadingList ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i} className="animate-pulse">
                                    <TableCell><div className="h-4 bg-muted rounded w-24"></div></TableCell>
                                    <TableCell><div className="h-4 bg-muted rounded w-48"></div></TableCell>
                                    <TableCell><div className="h-4 bg-muted rounded w-16"></div></TableCell>
                                    <TableCell><div className="h-4 bg-muted rounded w-32 mx-auto"></div></TableCell>
                                    <TableCell><div className="h-8 bg-muted rounded w-8 ml-auto"></div></TableCell>
                                </TableRow>
                            ))
                        ) : filteredList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                                    No se encontraron registros.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredList.map((item) => (
                                <TableRow key={item.numero_recepcion} className="hover:bg-muted/30 transition-colors cursor-pointer group" onClick={() => handleOpenDetail(item.numero_recepcion)}>
                                    <TableCell className="font-bold text-primary">{item.numero_recepcion}</TableCell>
                                    <TableCell className="font-medium max-w-[200px] truncate">{item.cliente || '-'}</TableCell>
                                    <TableCell className="text-muted-foreground text-xs">
                                        {item.fecha ? new Date(item.fecha).toLocaleDateString() : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-center gap-6">
                                            {item.stages.map(s => (
                                                <div key={s.key}>
                                                    {getStatusBubble(s.status, s.key.substring(0, 3))}
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="group-hover:bg-primary group-hover:text-white transition-all rounded-full">
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>

            {/* Modal de Detalle Premium */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 border-none shadow-2xl overflow-hidden">
                    <DialogHeader className="p-6 bg-primary text-white shrink-0">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                    <LayoutList className="w-6 h-6" />
                                    Detalle del Seguimiento
                                </DialogTitle>
                                <DialogDescription className="text-primary-foreground/80 font-medium">
                                    {loading ? "Cargando trazabilidad..." : `Análisis completo para ${tracingData?.numero_recepcion}`}
                                </DialogDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {!loading && tracingData && (
                                    <Button variant="secondary" size="sm" onClick={handlePrint} className="gap-2 bg-white/20 text-white hover:bg-white/30 border-none">
                                        <Printer className="w-4 h-4" />
                                        Imprimir Ficha
                                    </Button>
                                )}
                                {!loading && tracingData && (
                                    <Badge variant="secondary" className="bg-white/20 text-white border-none px-3 py-1">
                                        ID: {tracingData.numero_recepcion}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 min-h-0 bg-slate-50 dark:bg-slate-900">
                        <div ref={componentRef} className="p-8 space-y-8">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center p-24 gap-4">
                                    <RefreshCw className="w-12 h-12 text-primary animate-spin" />
                                    <p className="text-muted-foreground font-medium animate-pulse">Consolidando estados de laboratorio...</p>
                                </div>
                            ) : tracingData ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Dashboard Info Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card className="bg-white dark:bg-slate-800 border-none shadow-sm">
                                            <CardContent className="p-4 flex flex-col gap-1">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Cliente / Solicitante</span>
                                                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{tracingData.cliente || 'No especificado'}</span>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-white dark:bg-slate-800 border-none shadow-sm">
                                            <CardContent className="p-4 flex flex-col gap-1">
                                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Proyecto Relacionado</span>
                                                <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{tracingData.proyecto || 'General'}</span>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Timeline Stepper */}
                                    <div className="relative space-y-4 px-2">
                                        <div className="absolute left-7 top-4 bottom-4 w-1 bg-slate-200 dark:bg-slate-800 rounded-full hidden md:block" />

                                        {tracingData.stages.map((stage, index) => (
                                            <div key={stage.key} className="relative flex flex-col md:flex-row gap-6 md:items-center">
                                                <div className={cn(
                                                    "z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg shrink-0 transition-all duration-300 ring-4 ring-white dark:ring-slate-900",
                                                    stage.status === 'completado' ? "bg-green-500 text-white" :
                                                        stage.status === 'en_proceso' ? "bg-yellow-500 text-white animate-pulse" :
                                                            stage.status === 'por_implementar' ? "bg-blue-300 text-white" :
                                                                "bg-slate-200 text-slate-500 dark:bg-slate-800"
                                                )}>
                                                    {index === 0 ? <LayoutList className="w-5 h-5" /> :
                                                        index === 1 ? <FlaskConical className="w-5 h-5" /> :
                                                            index === 2 ? <Zap className="w-5 h-5" /> :
                                                                <FileText className="w-5 h-5" />}
                                                </div>

                                                <Card className={cn(
                                                    "flex-1 border-none shadow-sm transition-all duration-300",
                                                    stage.status === 'completado' ? "bg-white dark:bg-slate-800" :
                                                        stage.status === 'en_proceso' ? "bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30" :
                                                            "bg-slate-100/50 dark:bg-slate-800/50 opacity-60"
                                                )}>
                                                    <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="text-md font-bold">{stage.name}</h3>
                                                                {getStatusIcon(stage.status)}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground leading-tight">{stage.message}</p>
                                                            {stage.date && (
                                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-2 font-medium">
                                                                    <Calendar className="w-3 h-3" />
                                                                    {new Date(stage.date).toLocaleString()}
                                                                </div>
                                                            )}
                                                            {stage.data && Object.keys(stage.data).length > 0 && (
                                                                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-slate-200 dark:border-slate-700 pt-3">
                                                                    {Object.entries(stage.data).map(([key, value]) => (
                                                                        key !== 'ot' && (
                                                                            <div key={key} className="flex flex-col">
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{key}</span>
                                                                                <span className="font-medium text-slate-900 dark:text-slate-100">{String(value)}</span>
                                                                            </div>
                                                                        )
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {stage.download_url && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="mt-3 gap-2 h-8 text-xs border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:text-primary w-full sm:w-auto"
                                                                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${stage.download_url}`, '_blank')}
                                                                >
                                                                    <FileText className="w-3 h-3" />
                                                                    Descargar Excel Original
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <Badge className={cn(
                                                            "text-[10px] uppercase px-2 py-0 border-none transition-colors",
                                                            stage.status === 'completado' ? "bg-green-100 text-green-700 hover:bg-green-200" :
                                                                stage.status === 'en_proceso' ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" :
                                                                    "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                                        )}>
                                                            {stage.status.replace('_', ' ')}
                                                        </Badge>
                                                    </CardContent>
                                                </Card>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    )
}
