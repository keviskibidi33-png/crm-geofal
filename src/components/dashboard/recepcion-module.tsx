"use client"

import { useState, useEffect } from "react"
import { useRecepciones, Recepcion } from "@/hooks/use-recepciones"
import { Plus, Search, RefreshCw, FileText, Calendar, Trash2, FileSpreadsheet, X, Eye, MoreHorizontal } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

export function RecepcionModule() {
    const { recepciones, loading, fetchRecepciones, deleteRecepcion } = useRecepciones()
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const { user } = useAuth()

    // Initial fetch
    useEffect(() => {
        fetchRecepciones()
    }, [fetchRecepciones])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                fetchRecepciones() // Refresh data on close
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [fetchRecepciones])

    // Refresh when modal closes
    const handleModalOpenChange = (open: boolean) => {
        setIsModalOpen(open)
        if (!open) {
            fetchRecepciones()
        }
    }

    // Filter Logic
    const filteredData = recepciones.filter(item =>
        item.numero_ot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.numero_recepcion?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleDelete = async (id: number) => {
        const success = await deleteRecepcion(id)
        if (success) {
            toast.success("Recepción eliminada correctamente")
            if (selectedRecepcion?.id === id) {
                setIsDetailOpen(false)
            }
        } else {
            toast.error("Error al eliminar recepción")
        }
    }

    const handleDownloadExcel = (id: number) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
        window.open(`${API_URL}/api/recepcion/${id}/excel`, '_blank')
    }

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "-"
        const parts = dateStr.split('/')
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0')
            const month = parts[1].padStart(2, '0')
            const year = parts[2]
            return `${day}/${month}/${year}`
        }
        return dateStr
    }

    const openDetail = (recepcion: Recepcion) => {
        setSelectedRecepcion(recepcion)
        setIsDetailOpen(true)
    }

    return (
        <div className="h-full flex flex-col space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Recepciones</h1>
                    <p className="text-muted-foreground">Gestiona los registros de ingreso y órdenes de trabajo</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => fetchRecepciones()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nueva Recepción
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por OT, Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Content (Table) */}
            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">OT</TableHead>
                            <TableHead>Recepción</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Proyecto</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-center">Muestras</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && recepciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    Cargando datos...
                                </TableCell>
                            </TableRow>
                        ) : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    No se encontraron resultados
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(item)}>
                                    <TableCell className="font-medium">{item.numero_ot}</TableCell>
                                    <TableCell>{item.numero_recepcion}</TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.cliente}>
                                        {item.cliente}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.proyecto}>
                                        {item.proyecto}
                                    </TableCell>
                                    <TableCell>{formatDate(item.fecha_recepcion)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">
                                            {Array.isArray(item.muestras) ? item.muestras.length : 0}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openDetail(item)}>
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Está absolutamente seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Esta acción no se puede deshacer. Esto eliminará permanentemente la recepción
                                                            <span className="font-bold text-foreground"> {item.numero_recepcion} </span>
                                                            y la orden de trabajo asociada.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                            Eliminar
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal with Iframe for Creation */}
            <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background">
                    <DialogHeader className="hidden">
                        <DialogTitle>Nueva Recepción</DialogTitle>
                        <DialogDescription>Formulario de creación de nueva recepción</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <iframe
                            src={`${process.env.NEXT_PUBLIC_RECEPCION_FRONTEND_URL || "http://127.0.0.1:5173"}/migration/nueva-recepcion`}
                            className="w-full h-full border-none"
                            title="Nueva Recepción"
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Detail Sheet/Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" />
                            Detalle de Recepción {selectedRecepcion?.numero_recepcion}
                        </DialogTitle>
                        <DialogDescription>
                            Información completa de la orden de trabajo {selectedRecepcion?.numero_ot}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRecepcion && (
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-6 space-y-6">
                                {/* Section 1: Project & Client */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/20">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente / Solicitante</p>
                                        <p className="font-semibold text-lg">{selectedRecepcion.solicitante || selectedRecepcion.cliente}</p>
                                        {selectedRecepcion.domicilio_legal && <p className="text-sm text-muted-foreground">{selectedRecepcion.domicilio_legal}</p>}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Proyecto</p>
                                        <p className="font-semibold text-lg">{selectedRecepcion.proyecto}</p>
                                        {selectedRecepcion.ubicacion && <p className="text-sm text-muted-foreground">{selectedRecepcion.ubicacion}</p>}
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Contacto</p>
                                        <p className="text-sm font-medium">{selectedRecepcion.persona_contacto || "-"}</p>
                                        <p className="text-xs text-muted-foreground">{selectedRecepcion.email} {selectedRecepcion.telefono ? `• ${selectedRecepcion.telefono}` : ''}</p>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fechas</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Recepción:</span> <span className="font-medium">{formatDate(selectedRecepcion.fecha_recepcion)}</span>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Conclusión Est.:</span> <span className="font-medium">{formatDate(selectedRecepcion.fecha_estimada_culminacion)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Logistics */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Emisión de Formatos</p>
                                        <div className="flex gap-2 mt-1">
                                            {selectedRecepcion.emision_fisica && <Badge variant="outline">Físico</Badge>}
                                            {selectedRecepcion.emision_digital && <Badge variant="default">Digital</Badge>}
                                            {!selectedRecepcion.emision_fisica && !selectedRecepcion.emision_digital && <span className="text-muted-foreground">-</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Entregado Por</p>
                                        <p className="font-medium">{selectedRecepcion.entregado_por || "-"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recibido Por</p>
                                        <p className="font-medium">{selectedRecepcion.recibido_por || "-"}</p>
                                    </div>
                                </div>

                                {/* Section 3: Samples Table */}
                                <div>
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">
                                            {Array.isArray(selectedRecepcion.muestras) ? selectedRecepcion.muestras.length : 0}
                                        </span>
                                        Muestras Registradas
                                    </h3>
                                    <div className="rounded-md border overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 text-xs hover:bg-muted/50">
                                                    <TableHead className="w-[50px] text-center font-bold">Nº</TableHead>
                                                    <TableHead className="font-bold">Código LEM</TableHead>
                                                    <TableHead className="font-bold">Identificación</TableHead>
                                                    <TableHead className="font-bold">Estructura</TableHead>
                                                    <TableHead className="text-center font-bold">F&apos;c</TableHead>
                                                    <TableHead className="font-bold">Fecha Moldeo</TableHead>
                                                    <TableHead className="font-bold">Hora</TableHead>
                                                    <TableHead className="text-center font-bold">Edad</TableHead>
                                                    <TableHead className="font-bold">Fecha Rotura</TableHead>
                                                    <TableHead className="text-center font-bold">Densidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="text-xs">
                                                {Array.isArray(selectedRecepcion.muestras) && selectedRecepcion.muestras.map((m: any, idx: number) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="text-center font-medium bg-muted/20">{m.item_numero}</TableCell>
                                                        <TableCell className="font-mono text-primary">{m.codigo_muestra_lem || "-"}</TableCell>
                                                        <TableCell>{m.identificacion_muestra}</TableCell>
                                                        <TableCell>{m.estructura || "-"}</TableCell>
                                                        <TableCell className="text-center font-bold">{m.fc_kg_cm2 || "-"}</TableCell>
                                                        <TableCell>{formatDate(m.fecha_moldeo)}</TableCell>
                                                        <TableCell>{m.hora_moldeo || "-"}</TableCell>
                                                        <TableCell className="text-center font-semibold">{m.edad}</TableCell>
                                                        <TableCell>{formatDate(m.fecha_rotura)}</TableCell>
                                                        <TableCell className="text-center">
                                                            {m.requiere_densidad ? <Badge variant="outline" className="h-5 px-1">SI</Badge> : <span className="text-muted-foreground opacity-50">NO</span>}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {(!Array.isArray(selectedRecepcion.muestras) || selectedRecepcion.muestras.length === 0) && (
                                                    <TableRow>
                                                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                                            No hay muestras registradas en esta recepción.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    )}

                    <DialogFooter className="p-6 border-t shrink-0 bg-muted/5 gap-2 sm:gap-0">
                        <div className="flex-1 text-xs text-muted-foreground flex items-center">
                            ID Referencia: {selectedRecepcion?.id}
                        </div>
                        <Button variant="outline" onClick={() => selectedRecepcion && handleDownloadExcel(selectedRecepcion.id)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Descargar Excel
                        </Button>
                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
