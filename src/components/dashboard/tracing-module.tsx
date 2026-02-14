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
    Printer,
    Loader2,
    FileSpreadsheet,
    Building2,
    Trash2,
    History
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
    const { tracingData, tracingList, loading, loadingList, error, fetchTracing, fetchTracingList, deleteTracing } = useTracing()
    const [searchTerm, setSearchTerm] = useState("")
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isEnsayoDetailOpen, setIsEnsayoDetailOpen] = useState(false)
    const [selectedEnsayo, setSelectedEnsayo] = useState<any>(null)
    const [loadingEnsayo, setLoadingEnsayo] = useState(false)
    const [selectedEnsayoId, setSelectedEnsayoId] = useState<number | null>(null)

    // Reception Detail State
    const [isRecepcionDetailOpen, setIsRecepcionDetailOpen] = useState(false)
    const [selectedRecepcion, setSelectedRecepcion] = useState<any>(null)
    const [loadingRecepcion, setLoadingRecepcion] = useState(false)

    // Verification Detail State
    const [isVerificDetailOpen, setIsVerificDetailOpen] = useState(false)
    const [selectedVerific, setSelectedVerific] = useState<any>(null)
    const [loadingVerific, setLoadingVerific] = useState(false)

    // Informe Version History State
    const [informeVersiones, setInformeVersiones] = useState<any[]>([])
    const [loadingVersiones, setLoadingVersiones] = useState(false)

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
        fetchInformeVersiones(numero)
        setIsDetailOpen(true)
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

    // Fetch version history when detail opens
    const fetchInformeVersiones = async (numeroRecepcion: string) => {
        setLoadingVersiones(true)
        try {
            const response = await fetch(`${API_URL}/api/tracing/informe/${encodeURIComponent(numeroRecepcion)}/versiones`)
            if (response.ok) {
                const data = await response.json()
                setInformeVersiones(data.versiones || [])
            }
        } catch (err) {
            console.error("Error fetching versiones:", err)
        } finally {
            setLoadingVersiones(false)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completado': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'en_proceso': return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
            case 'por_implementar': return <Zap className="w-4 h-4 text-blue-400 opacity-60" />;
            default: return <AlertCircle className="w-4 h-4 text-slate-300" />;
        }
    }

    const handleDownloadRecepcionExcel = async (id: number, ot: string) => {
        try {
            const response = await fetch(`${API_URL}/api/recepcion/${id}/excel`)
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `OT-${ot}.xlsx`
                document.body.appendChild(a)
                a.click()
                a.remove()
            }
        } catch (error) {
            console.error("Error downloading excel:", error)
        }
    }

    const handleDownloadVerificacionExcel = async (id: number) => {
        try {
            const response = await fetch(`${API_URL}/api/verificacion/${id}/exportar`)
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `Verificacion-${id}.xlsx`
                document.body.appendChild(a)
                a.click()
                a.remove()
            }
        } catch (error) {
            console.error("Error downloading excel:", error)
        }
    }

    const handleViewEnsayoDetail = async (id: number) => {
        setLoadingEnsayo(true)
        setIsEnsayoDetailOpen(true)
        setSelectedEnsayoId(id)
        try {
            const response = await fetch(`${API_URL}/api/compresion/${id}`)
            if (response.ok) {
                const data = await response.json()
                setSelectedEnsayo(data)
            }
        } catch (error) {
            console.error("Error loading ensayo detail:", error)
        } finally {
            setLoadingEnsayo(false)
        }
    }

    const handleViewRecepcionDetail = async (id: number) => {
        setLoadingRecepcion(true)
        setIsRecepcionDetailOpen(true)
        try {
            const response = await fetch(`${API_URL}/api/recepcion/${id}`)
            if (response.ok) {
                const data = await response.json()
                setSelectedRecepcion(data)
            }
        } catch (error) {
            console.error("Error loading recepcion detail:", error)
        } finally {
            setLoadingRecepcion(false)
        }
    }

    const handleViewVerificDetail = async (id: number) => {
        setLoadingVerific(true)
        setIsVerificDetailOpen(true)
        try {
            const response = await fetch(`${API_URL}/api/verificacion/${id}`)
            if (response.ok) {
                const data = await response.json()
                setSelectedVerific(data)
            }
        } catch (error) {
            console.error("Error loading verificacion detail:", error)
        } finally {
            setLoadingVerific(false)
        }
    }

    const handleDeleteTracing = async (numero: string) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el registro ${numero} de la trazabilidad? Esta acción no se puede deshacer.`)) {
            return
        }

        const success = await deleteTracing(numero)
        if (success) {
            setIsDetailOpen(false)
            alert("Registro eliminado con éxito.")
        } else {
            alert("No se pudo eliminar el registro.")
        }
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
                                        <div className="flex justify-end gap-2 px-2" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="hover:bg-red-50 hover:text-red-500 rounded-full h-8 w-8"
                                                onClick={() => handleDeleteTracing(item.numero_recepcion)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="group-hover:bg-primary group-hover:text-white transition-all rounded-full h-8 w-8" onClick={() => handleOpenDetail(item.numero_recepcion)}>
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
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
                                {!loading && tracingData && (
                                    <Button 
                                        variant="destructive" 
                                        size="sm" 
                                        onClick={() => handleDeleteTracing(tracingData.numero_recepcion)} 
                                        className="gap-2 bg-red-600/50 hover:bg-red-600 text-white border-none"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Eliminar de Historial
                                    </Button>
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
                                                            {stage.data && Object.keys(stage.data).length > 0 && stage.key !== 'informe' && (
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
                                                            {/* Informe stage: custom UI with version info */}
                                                            {stage.key === 'informe' && (
                                                                <div className="mt-3 space-y-3 border-t border-slate-200 dark:border-slate-700 pt-3">
                                                                    {/* Status indicators */}
                                                                    <div className="flex flex-wrap gap-2 text-[10px]">
                                                                        {stage.data?.versiones > 0 && (
                                                                            <Badge variant="outline" className="gap-1 text-[10px]">
                                                                                <History className="w-3 h-3" />
                                                                                {stage.data.versiones} versión(es) generada(s)
                                                                            </Badge>
                                                                        )}
                                                                        {stage.status !== 'completado' && (
                                                                            <Badge variant="outline" className="gap-1 text-[10px] border-yellow-300 text-yellow-700 bg-yellow-50">
                                                                                <AlertCircle className="w-3 h-3" />
                                                                                Datos parciales
                                                                            </Badge>
                                                                        )}
                                                                        {stage.status === 'completado' && (
                                                                            <Badge variant="outline" className="gap-1 text-[10px] border-green-300 text-green-700 bg-green-50">
                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                                Datos completos
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    {/* Download button */}
                                                                    {stage.download_url && (
                                                                        <Button
                                                                            variant="default"
                                                                            size="sm"
                                                                            className="gap-2 h-8 text-xs w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                                                            onClick={() => {
                                                                                window.open(`${API_URL}${stage.download_url}`, '_blank')
                                                                                // Refresh versions after download
                                                                                if (tracingData?.numero_recepcion) {
                                                                                    setTimeout(() => fetchInformeVersiones(tracingData.numero_recepcion), 2000)
                                                                                }
                                                                            }}
                                                                        >
                                                                            <Download className="w-3 h-3" />
                                                                            {stage.status === 'completado' ? 'Generar Informe Final' : 'Generar Informe (Parcial)'}
                                                                        </Button>
                                                                    )}
                                                                    {/* Version history */}
                                                                    {informeVersiones.length > 0 && (
                                                                        <div className="space-y-2">
                                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                                                                <History className="w-3 h-3" />
                                                                                Historial de Versiones
                                                                            </p>
                                                                            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                                                                                {informeVersiones.map((v: any) => (
                                                                                    <div key={v.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded px-2.5 py-1.5 text-[11px]">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-bold text-primary">v{v.version}</span>
                                                                                            <span className="text-muted-foreground">
                                                                                                {v.fecha_generacion ? new Date(v.fecha_generacion).toLocaleString() : '-'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5">
                                                                                            {v.datos_completos ? (
                                                                                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-300 text-green-600">Completo</Badge>
                                                                                            ) : (
                                                                                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-yellow-300 text-yellow-600">Parcial</Badge>
                                                                                            )}
                                                                                            <span className="text-muted-foreground">{v.total_muestras}m</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {/* Non-informe download buttons */}
                                                            {stage.download_url && stage.key !== 'informe' && (
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="mt-3 gap-2 h-8 text-xs w-full sm:w-auto border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                                                                    onClick={() => window.open(`${API_URL}${stage.download_url}`, '_blank')}
                                                                >
                                                                    <FileText className="w-3 h-3" /> Descargar Excel Original
                                                                </Button>
                                                            )}
                                                            {stage.key === 'recepcion' && stage.data?.recepcion_id && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 p-0 h-auto"
                                                                    onClick={() => handleViewRecepcionDetail(stage.data.recepcion_id)}
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    Ver Detalles de Recepción
                                                                </Button>
                                                            )}
                                                            {stage.key === 'verificacion' && stage.data?.verificacion_id && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 p-0 h-auto"
                                                                    onClick={() => handleViewVerificDetail(stage.data.verificacion_id)}
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    Ver Detalles de Verificación
                                                                </Button>
                                                            )}
                                                            {stage.key === 'compresion' && stage.data?.compresion_id && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 p-0 h-auto"
                                                                    onClick={() => handleViewEnsayoDetail(stage.data.compresion_id)}
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    Ver Detalles del Ensayo
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

            {/* Ensayo Detail Modal */}
            <Dialog open={isEnsayoDetailOpen} onOpenChange={setIsEnsayoDetailOpen}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" />
                            Detalle de Ensayo de Compresión
                        </DialogTitle>
                        <DialogDescription>
                            Información completa del ensayo OT {selectedEnsayo?.numero_ot}
                        </DialogDescription>
                    </DialogHeader>

                    {loadingEnsayo ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
                            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Cargando datos del ensayo...</p>
                        </div>
                    ) : selectedEnsayo ? (
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-6 space-y-6">
                                {/* Ensayo Info Card */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                            Cabecera del Ensayo
                                        </h4>
                                        <div className="space-y-2.5">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Número OT</p>
                                                    <p className="text-sm font-semibold text-indigo-600 font-mono">{selectedEnsayo.numero_ot}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Número Recepción</p>
                                                    <p className="text-sm font-semibold text-slate-800">{selectedEnsayo.numero_recepcion}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Equipo Utilizado</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedEnsayo.codigo_equipo || 'No especificado'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                                            Notas y Adicionales
                                        </h4>
                                        <div className="space-y-2.5">
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Otros Detalles</p>
                                                <p className="text-sm font-semibold text-slate-800">{selectedEnsayo.otros || 'Sin detalles'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Nota</p>
                                                <p className="text-xs text-slate-600 italic line-clamp-2">{selectedEnsayo.nota || 'Sin observaciones'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Items Table Section */}
                                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
                                            Resultados de Compresión ({selectedEnsayo.items?.length || 0})
                                        </h4>
                                        <Badge variant="outline" className="bg-white text-[9px] font-black">{selectedEnsayo.estado}</Badge>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-full">
                                            <TableHeader className="bg-slate-50/50">
                                                <TableRow>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Item</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Cód. LEM</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Fecha Ensayo</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Carga Máx (kN)</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase h-8">Fractura</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedEnsayo.items?.map((m: any) => (
                                                    <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors h-10">
                                                        <TableCell className="text-xs font-bold text-center py-2">{m.item}</TableCell>
                                                        <TableCell className="text-[11px] font-mono text-indigo-700 py-2">{m.codigo_lem}</TableCell>
                                                        <TableCell className="text-xs font-semibold py-2">
                                                            {m.fecha_ensayo ? new Date(m.fecha_ensayo).toLocaleDateString('es-PE') : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-bold text-green-700 py-2">{m.carga_maxima} kN</TableCell>
                                                        <TableCell className="text-xs text-slate-600 py-2">{m.tipo_fractura}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!selectedEnsayo.items || selectedEnsayo.items.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="h-16 text-center text-xs text-slate-400 italic">No hay resultados registrados</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-slate-400 italic">No se encontraron datos para este ensayo.</p>
                        </div>
                    )}

                    <div className="p-6 border-t bg-muted/5">
                        <Button variant="outline" onClick={() => setIsEnsayoDetailOpen(false)} className="w-full sm:w-auto px-8 font-bold text-slate-700">
                            Cerrar Detalles
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reception Detail Modal */}
            <Dialog open={isRecepcionDetailOpen} onOpenChange={setIsRecepcionDetailOpen}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                            Detalle de Recepción Original
                        </DialogTitle>
                        <DialogDescription>
                            Información completa de la OT {selectedRecepcion?.numero_ot}
                        </DialogDescription>
                    </DialogHeader>

                    {loadingRecepcion ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
                            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Cargando datos de recepción...</p>
                        </div>
                    ) : selectedRecepcion ? (
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-8 space-y-8">
                                {/* Information Grid */}
                                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Cliente / Solicitante</p>
                                                <p className="text-lg font-black text-slate-900 uppercase">{selectedRecepcion.cliente || '1111'}</p>
                                                <p className="text-xs font-bold text-slate-500 mt-1">{selectedRecepcion.ruc || '1111'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Contacto</p>
                                                <p className="text-sm font-black text-slate-800 uppercase">{selectedRecepcion.persona_contacto || '1111'}</p>
                                                <p className="text-[11px] text-slate-500 font-bold mt-1">
                                                    {selectedRecepcion.email} • {selectedRecepcion.telefono}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Proyecto</p>
                                                <p className="text-lg font-black text-slate-900 uppercase">{selectedRecepcion.proyecto || '1111'}</p>
                                                <p className="text-xs font-bold text-slate-500 mt-1">{selectedRecepcion.ubicacion || '1111'}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Fechas</p>
                                                    <p className="text-xs font-bold text-slate-700">Recepción: <span className="font-black">{selectedRecepcion.fecha_recepcion || '06/02/2026'}</span></p>
                                                </div>
                                                <div className="flex flex-col justify-end">
                                                    <p className="text-xs font-bold text-slate-700">Conclusión Est.: <span className="font-black">{selectedRecepcion.fecha_estimada_culminacion || '13/02/2026'}</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Logistics Row */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-2">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Emisión de Informes</p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase border-slate-200", selectedRecepcion.emision_fisica ? "bg-slate-100 text-slate-700" : "opacity-40")}>Físico</Badge>
                                            <Badge variant="outline" className={cn("px-3 py-1 text-[10px] font-black uppercase border-transparent", selectedRecepcion.emision_digital ? "bg-[#0070F3] text-white" : "opacity-40")}>Digital</Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Entregado por</p>
                                        <p className="text-sm font-black text-slate-800 uppercase">{selectedRecepcion.entregado_por || '1111'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Recibido por</p>
                                        <p className="text-sm font-black text-slate-800 uppercase">{selectedRecepcion.recibido_por || '1111'}</p>
                                    </div>
                                </div>

                                {/* Muestras Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 text-[#0070F3] h-6 w-6 rounded-md flex items-center justify-center text-xs font-black">
                                            {selectedRecepcion.muestras?.length || 0}
                                        </div>
                                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Muestras Registradas</h3>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                                    <TableHead className="w-12 text-center text-[10px] font-black uppercase text-slate-600">Nº</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Código LEM</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600">Identificación</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600">Estructura</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">F'c</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Fecha Moldeo</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Edad</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Rotura</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Densidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedRecepcion.muestras?.map((m: any, idx: number) => (
                                                    <TableRow key={m.id} className="hover:bg-slate-50/30 transition-colors h-12">
                                                        <TableCell className="text-xs font-bold text-slate-400 text-center">{idx + 1}</TableCell>
                                                        <TableCell className="text-xs font-bold text-[#0070F3] text-center underline decoration-blue-200">
                                                            {m.codigo_lem || '11111111'}
                                                        </TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-600">{m.identificacion_muestra || '1111'}</TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-600">{m.estructura || '1111'}</TableCell>
                                                        <TableCell className="text-xs font-black text-slate-900 text-center">{m.fc_kg_cm2 || '280'}</TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-600 text-center">{m.fecha_moldeo || '05/12/2026'}</TableCell>
                                                        <TableCell className="text-xs font-black text-slate-600 text-center">{m.edad || '7'}</TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-500 text-center">{m.fecha_rotura || '12/12/2026'}</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-slate-50 py-0 h-5">
                                                                {m.densidad ? 'SI' : 'NO'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-slate-400 italic">No se encontraron datos para esta recepción.</p>
                        </div>
                    )}

                    <div className="p-6 border-t bg-muted/5">
                        <Button variant="outline" onClick={() => setIsRecepcionDetailOpen(false)} className="w-full sm:w-auto px-8 font-bold text-slate-700">
                            Cerrar Detalles
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Verification Detail Modal */}
            <Dialog open={isVerificDetailOpen} onOpenChange={setIsVerificDetailOpen}>
                <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                            Detalle de Verificación de Muestras
                        </DialogTitle>
                        <DialogDescription>
                            Validación técnica de dimensiones y geometría
                        </DialogDescription>
                    </DialogHeader>

                    {loadingVerific ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 animate-pulse">
                            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Cargando datos de verificación...</p>
                        </div>
                    ) : selectedVerific ? (
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-6 space-y-6">
                                {/* Header Info */}
                                <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Cliente</p>
                                                <p className="text-lg font-black text-slate-900 uppercase">{selectedVerific.cliente || 'CLIENTE PRUEBA PATRONES'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Documento de Referencia</p>
                                                <p className="text-sm font-black text-slate-800 uppercase">{selectedVerific.codigo_documento || 'F-LEM-P-01.12 (v03)'}</p>
                                                <p className="text-[11px] text-slate-500 font-bold mt-1">
                                                    Fecha Doc: {selectedVerific.fecha_documento || '01/01/2026'} • Pág: {selectedVerific.pagina || '1 de 1'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Nº Verificación</p>
                                                <p className="text-lg font-black text-slate-900 uppercase">{selectedVerific.numero_verificacion || 'TEST-1758'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Fecha & Responsable</p>
                                                <p className="text-sm font-black text-slate-800 uppercase">{selectedVerific.fecha_verificacion || '2026-02-06'}</p>
                                                <p className="text-[11px] text-slate-500 font-bold mt-1">
                                                    Verificado por: {selectedVerific.verificado_por || 'TEST AGENT'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Results Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-50 text-[#0070F3] h-6 w-6 rounded-md flex items-center justify-center text-xs font-black">
                                            {selectedVerific.muestras_verificadas?.length || 0}
                                        </div>
                                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Muestras Verificadas</h3>
                                    </div>

                                    <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                                                    <TableHead className="w-12 text-center text-[10px] font-black uppercase text-slate-600">Itm</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600">Cód. LEM</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600">Tipo</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Ø1 (mm)</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Ø2 (mm)</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Tol (%)</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase text-slate-600 text-center">Cumple</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedVerific.muestras_verificadas?.map((m: any, idx: number) => (
                                                    <TableRow key={m.id} className="hover:bg-slate-50/30 transition-colors h-12">
                                                        <TableCell className="text-xs font-bold text-slate-400 text-center">{m.item_numero || idx + 1}</TableCell>
                                                        <TableCell className="text-xs font-bold text-[#0070F3] underline decoration-blue-200">{m.codigo_lem || '-'}</TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-600">{m.tipo_testigo}</TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-600 text-center">{m.diametro_1_mm}</TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-600 text-center">{m.diametro_2_mm}</TableCell>
                                                        <TableCell className="text-xs font-bold text-slate-600 text-center">{m.tolerancia_porcentaje}%</TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge variant="outline" className={cn(
                                                                "text-[9px] font-black uppercase px-2 py-0 border-none",
                                                                m.cumple_tolerancia ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                            )}>
                                                                {m.cumple_tolerancia ? 'SI' : 'NO'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-slate-400 italic">No se encontraron datos para esta verificación.</p>
                        </div>
                    )}

                    <div className="p-6 border-t bg-muted/5">
                        <Button variant="outline" onClick={() => setIsVerificDetailOpen(false)} className="w-full sm:w-auto px-8 font-bold text-slate-700">
                            Cerrar Detalles
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    )
}
