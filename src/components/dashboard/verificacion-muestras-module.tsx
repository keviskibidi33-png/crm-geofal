"use client"

import { useState, useEffect } from "react"
import { RefreshCw, Plus, Search, FileText, Trash2, Eye, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useVerificaciones } from "@/hooks/use-verificaciones"
import { toast } from "sonner"
export function VerificacionMuestrasModule() {
    const { verificaciones, loading, fetchVerificaciones, deleteVerificacion } = useVerificaciones()
    const [searchTerm, setSearchTerm] = useState("")
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [iframePath, setIframePath] = useState("/nuevo") // Default route for iframe
    const [refreshKey, setRefreshKey] = useState(0)

    const FRONTEND_URL = process.env.NEXT_PUBLIC_VERIFICACION_FRONTEND_URL || "https://verificacion.geofal.com.pe"

    useEffect(() => {
        fetchVerificaciones()
    }, [fetchVerificaciones])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
                fetchVerificaciones()
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [fetchVerificaciones])

    const handleOpenModal = (path: string) => {
        setIframePath(path)
        setRefreshKey(prev => prev + 1)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: number) => {
        const success = await deleteVerificacion(id)
        if (success) {
            toast.success("Verificación eliminada correctamente")
        }
    }

    const handleDownloadExcel = (id: number) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
        window.open(`${API_URL}/api/verificacion/${id}/exportar`, '_blank')
    }

    const filteredData = verificaciones.filter(item =>
        item.numero_verificacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.cliente && item.cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.codigo_documento.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="h-full flex flex-col space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Verificación Muestras</h1>
                    <p className="text-muted-foreground">Gestión y control de verificaciones de muestras</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => fetchVerificaciones()} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={() => handleOpenModal("/nuevo")} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nueva Verificación
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por N° Verificación, Cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Native Table */}
            <div className="rounded-md border bg-card flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° Verificación</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Verificado Por</TableHead>
                            <TableHead>Fecha Verificación</TableHead>
                            <TableHead className="text-center">Muestras</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && verificaciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">Cargando datos...</TableCell>
                            </TableRow>
                        ) : filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No se encontraron resultados</TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/50">
                                    <TableCell className="font-medium">{item.numero_verificacion}</TableCell>
                                    <TableCell>{item.cliente || "-"}</TableCell>
                                    <TableCell>{item.verificado_por || "-"}</TableCell>
                                    <TableCell>{item.fecha_verificacion || "-"}</TableCell>
                                    <TableCell className="text-center">{item.muestras_verificadas?.length || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end items-center gap-2">
                                            {/* Download Excel */}
                                            <Button variant="ghost" size="icon" title="Descargar Excel" onClick={() => handleDownloadExcel(item.id)}>
                                                <FileText className="h-4 w-4 text-green-600" />
                                            </Button>

                                            {/* View/Edit Details (Iframe Modal) */}
                                            <Button variant="ghost" size="icon" title="Ver Detalles" onClick={() => handleOpenModal(`/detalle/${item.id}`)}>
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </Button>

                                            {/* Delete */}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Eliminará la verificación {item.numero_verificacion}. Esta acción no se puede deshacer.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive hover:bg-destructive/90">
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

            {/* Modal Iframe */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background">
                    <DialogHeader className="hidden">
                        <DialogTitle>Verificación</DialogTitle>
                        <DialogDescription>Módulo de Verificación</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <iframe
                            key={refreshKey}
                            src={`${FRONTEND_URL}${iframePath}`}
                            className="w-full h-full border-none"
                            title="Verificación Muestras Iframe"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
