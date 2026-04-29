"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRecepciones, Recepcion } from "@/hooks/use-recepciones"
import { Plus, Search, RefreshCw, FileText, Trash2, FileSpreadsheet, Eye, Pencil, Loader2, Upload, ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"

import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import { SmartIframe } from "./smart-iframe"

export function RecepcionModule() {
    const { recepciones, loading, pagination, fetchRecepciones, refreshRecepciones, getRecepcionById, deleteRecepcion } = useRecepciones()
    const [searchTerm, setSearchTerm] = useState("")
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [selectedRecepcion, setSelectedRecepcion] = useState<Recepcion | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [showExitConfirm, setShowExitConfirm] = useState(false)
    const [token, setToken] = useState<string | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importedData, setImportedData] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const importedDataSentRef = useRef(false)
    const { user } = useAuth()
    const canWrite = user?.role === "admin" || user?.permissions?.recepcion?.write === true
    const canDelete = user?.role === "admin" || user?.permissions?.recepcion?.delete === true
    const FRONTEND_URL = process.env.NEXT_PUBLIC_RECEPCION_FRONTEND_URL || "http://127.0.0.1:5173"

    const getStoredAccessToken = useCallback((): string | null => {
        if (typeof window === "undefined") return null

        const direct = localStorage.getItem("token")
        if (direct) return direct

        const extractToken = (parsed: any): string | null => {
            if (!parsed) return null
            if (typeof parsed?.access_token === "string" && parsed.access_token) return parsed.access_token
            if (typeof parsed?.currentSession?.access_token === "string" && parsed.currentSession.access_token) return parsed.currentSession.access_token
            if (typeof parsed?.session?.access_token === "string" && parsed.session.access_token) return parsed.session.access_token
            if (Array.isArray(parsed) && typeof parsed[0]?.access_token === "string" && parsed[0].access_token) return parsed[0].access_token
            return null
        }

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue

            const raw = localStorage.getItem(key)
            if (!raw) continue

            try {
                const parsed = JSON.parse(raw)
                const token = extractToken(parsed)
                if (token) return token
            } catch {
                // Ignore malformed storage entries.
            }
        }

        return null
    }, [])

    const isTokenExpiringSoon = useCallback((jwt: string | null, skewMs = 60_000): boolean => {
        if (!jwt) return true

        try {
            const [, payload] = jwt.split(".")
            if (!payload) return true

            const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
            const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
            const parsed = JSON.parse(window.atob(padded))
            const expMs = typeof parsed?.exp === "number" ? parsed.exp * 1000 : null

            if (!expMs) return true
            return expMs <= Date.now() + skewMs
        } catch {
            return true
        }
    }, [])

    const frontendOrigin = useMemo(() => {
        try {
            return new URL(FRONTEND_URL).origin
        } catch {
            return null
        }
    }, [FRONTEND_URL])

    const syncIframeToken = useCallback(async (): Promise<string | null> => {
        const { data: { session } } = await supabase.auth.getSession()
        const sessionToken = session?.access_token ?? null
        const localToken = getStoredAccessToken()
        let freshToken = !isTokenExpiringSoon(sessionToken)
            ? sessionToken
            : !isTokenExpiringSoon(localToken)
                ? localToken
                : null

        if (!freshToken) {
            try {
                const { data } = await supabase.auth.refreshSession()
                freshToken = data?.session?.access_token ?? getStoredAccessToken()
            } catch {
                freshToken = getStoredAccessToken()
            }
        }

        if (freshToken && typeof window !== "undefined") {
            localStorage.setItem("token", freshToken)
        }

        setToken(freshToken)
        return freshToken
    }, [getStoredAccessToken, isTokenExpiringSoon])

    const refreshCurrentPage = useCallback(() => {
        void fetchRecepciones({
            page: currentPage,
            pageSize,
            search: debouncedSearchTerm,
        })
    }, [currentPage, debouncedSearchTerm, fetchRecepciones, pageSize])

    useEffect(() => {
        if (!frontendOrigin) return
        const preconnectLink = document.createElement("link")
        preconnectLink.rel = "preconnect"
        preconnectLink.href = frontendOrigin
        preconnectLink.crossOrigin = "anonymous"
        document.head.appendChild(preconnectLink)

        const dnsPrefetchLink = document.createElement("link")
        dnsPrefetchLink.rel = "dns-prefetch"
        dnsPrefetchLink.href = frontendOrigin
        document.head.appendChild(dnsPrefetchLink)

        return () => {
            if (preconnectLink.parentNode) {
                preconnectLink.parentNode.removeChild(preconnectLink)
            }
            if (dnsPrefetchLink.parentNode) {
                dnsPrefetchLink.parentNode.removeChild(dnsPrefetchLink)
            }
        }
    }, [frontendOrigin])

    // Sync token once on mount.
    useEffect(() => {
        void syncIframeToken()
    }, [syncIframeToken])

    // Debounce search to avoid request spam and reset to first page.
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1)
            setDebouncedSearchTerm(searchTerm.trim())
        }, 300)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Real server-side pagination + search.
    useEffect(() => {
        void fetchRecepciones({
            page: currentPage,
            pageSize,
            search: debouncedSearchTerm,
        })
    }, [currentPage, debouncedSearchTerm, fetchRecepciones, pageSize])

    useEffect(() => {
        if (pagination.page && pagination.page !== currentPage) {
            setCurrentPage(pagination.page)
        }
    }, [pagination.page, currentPage])

    // Listen for close message from Iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (frontendOrigin && event.origin !== frontendOrigin) return

            if (event.data?.type === 'IFRAME_READY' && event.source && isModalOpen && importedData && !editId && !importedDataSentRef.current) {
                console.log('[RecepcionModule] Syncing imported data to iframe after IFRAME_READY...')
                ;(event.source as Window).postMessage(
                    { type: 'IMPORT_DATA', data: importedData },
                    event.origin
                )
                importedDataSentRef.current = true
            }

            if (event.data?.type === 'CLOSE_MODAL') {
                const reason = event.data?.reason
                if (reason === 'created') {
                    toast.success('¡Recepción creada exitosamente!')
                } else if (reason === 'updated') {
                    toast.success('¡Recepción actualizada exitosamente!')
                }
                setIsModalOpen(false)
                setEditId(null)
                refreshCurrentPage()
            }
            // Auto-refresh: iframe requests a fresh token before expiry
            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                syncIframeToken().then((freshToken) => {
                    if (freshToken && event.source) {
                        (event.source as Window).postMessage(
                            {
                                type: 'TOKEN_REFRESH',
                                token: freshToken,
                                requestId: typeof event.data?.requestId === 'string' ? event.data.requestId : undefined,
                            },
                            event.origin
                        )
                    }
                })
            }
        }
        window.addEventListener("message", handleMessage)
        return () => window.removeEventListener("message", handleMessage)
    }, [editId, frontendOrigin, importedData, isModalOpen, refreshCurrentPage, syncIframeToken])

    useEffect(() => {
        importedDataSentRef.current = false
    }, [importedData, editId, isModalOpen])

    // Refresh when modal closes
    const handleModalOpenChange = (open: boolean) => {
        if (!open) {
            if (editId) {
                // Editing → show confirmation before discarding
                setShowExitConfirm(true)
                return
            }
            // Creating new → close directly
            setIsModalOpen(false)
            refreshCurrentPage()
            return
        }
        setIsModalOpen(open)
    }

    const confirmCloseModal = () => {
        setShowExitConfirm(false)
        setIsModalOpen(false)
        setEditId(null)
        refreshCurrentPage()
    }

    const handleEdit = (recepcion: Recepcion) => {
        if (!canWrite) {
            toast.error("Acceso denegado", { description: "Solo tienes permisos de lectura en Recepcion Probetas." })
            return
        }
        setEditId(recepcion.id)
        setIsDetailOpen(false)
        setIsModalOpen(true)
        void syncIframeToken()
    }

    const handleCreate = () => {
        if (!canWrite) {
            toast.error("Acceso denegado", { description: "Solo tienes permisos de lectura en Recepcion Probetas." })
            return
        }
        setEditId(null)
        setImportedData(null)
        setIsModalOpen(true)
        void syncIframeToken()
    }

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canWrite) {
            toast.error("Acceso denegado", { description: "Solo tienes permisos de lectura en Recepcion Probetas." })
            if (fileInputRef.current) fileInputRef.current.value = ""
            return
        }

        const file = e.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xlsm')) {
            toast.error("Solo se permiten archivos Excel (.xlsx, .xlsm)")
            return
        }

        setIsImporting(true)
        const loadingToast = toast.loading("Procesando Excel...")
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

        try {
            const formData = new FormData()
            formData.append('file', file)
            
            const response = await authFetch(`${API_URL}/api/recepcion/importar-excel`, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || "Error al procesar el Excel")
            }

            const data = await response.json()
            toast.dismiss(loadingToast)
            toast.success(`Excel importado: ${data.muestras?.length || 0} muestras detectadas`)
            
            // Set data and open modal
            setImportedData(data)
            setEditId(null)
            setIsModalOpen(true)
            void syncIframeToken()
        } catch (error: any) {
            toast.dismiss(loadingToast)
            toast.error(error.message)
        } finally {
            setIsImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const safeCurrentPage = Math.max(1, pagination.page || currentPage)
    const safeTotalPages = Math.max(1, pagination.totalPages || 1)
    const hasData = recepciones.length > 0
    const showingFrom = hasData ? (safeCurrentPage - 1) * pagination.pageSize + 1 : 0
    const showingTo = hasData ? Math.min(safeCurrentPage * pagination.pageSize, pagination.total) : 0

    const handleDelete = async (id: number) => {
        if (!canDelete) {
            toast.error("Acceso denegado", { description: "No tienes permisos para eliminar recepciones." })
            return
        }

        const success = await deleteRecepcion(id)
        if (success) {
            toast.success("Recepción Probetas eliminada correctamente")
            if (selectedRecepcion?.id === id) {
                setIsDetailOpen(false)
            }
            if (recepciones.length === 1 && currentPage > 1) {
                setCurrentPage(prev => Math.max(1, prev - 1))
            } else {
                refreshCurrentPage()
            }
        } else {
            toast.error("Error al eliminar recepción")
        }
    }

    const handleDownloadExcel = async (id: number) => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
        try {
            const response = await authFetch(`${API_URL}/api/recepcion/${id}/excel`)
            if (response.ok) {
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                
                // Try to get filename from headers
                const contentDisposition = response.headers.get('Content-Disposition')
                let filename = `Recepcion-${id}.xlsx`
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?([^"]+)"?/)
                    if (match && match[1]) filename = match[1]
                }
                
                a.download = filename
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
            } else {
                toast.error("Error al descargar el archivo")
            }
        } catch (error) {
            console.error("Download error:", error)
            toast.error("Error de conexión al descargar")
        }
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

    const openDetail = async (recepcion: Recepcion) => {
        setSelectedRecepcion(recepcion)
        setIsDetailLoading(true)
        setIsDetailOpen(true)
        try {
            const fullRecepcion = await getRecepcionById(recepcion.id)
            setSelectedRecepcion(fullRecepcion)
        } catch (error: any) {
            toast.error("No se pudo cargar el detalle completo", {
                description: error?.message || "Intenta nuevamente.",
            })
        } finally {
            setIsDetailLoading(false)
        }
    }

    return (
        <div className="h-full min-h-0 flex flex-col gap-6 p-4 md:p-6 overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Recepción Probetas</h1>
                    <p className="text-muted-foreground">Gestiona los registros de ingreso y órdenes de trabajo</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xlsm"
                        onChange={handleImportExcel}
                        className="hidden"
                    />
                    <Button variant="outline" size="icon" onClick={() => { void refreshRecepciones() }} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    {canWrite && (
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={isImporting}
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Importar Recepción Probetas
                        </Button>
                    )}
                    {canWrite && (
                        <Button onClick={handleCreate} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nueva Recepción Probetas
                        </Button>
                    )}
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
            <div className="rounded-md border bg-card flex-1 overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[120px]">Recepción Probetas</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Proyecto</TableHead>
                            <TableHead className="text-center">Muestras</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && recepciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    Cargando datos...
                                </TableCell>
                            </TableRow>
                        ) : recepciones.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No se encontraron resultados
                                </TableCell>
                            </TableRow>
                        ) : (
                            recepciones.map((item) => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { void openDetail(item) }}>
                                    <TableCell className="font-bold text-primary">{item.numero_recepcion}</TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.cliente}>
                                        {item.cliente}
                                    </TableCell>
                                    <TableCell className="max-w-[200px] truncate" title={item.proyecto}>
                                        {item.proyecto}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">
                                            {Number(item.muestras_count ?? (Array.isArray(item.muestras) ? item.muestras.length : 0))}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end items-center gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => { void openDetail(item) }}>
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            {canWrite && (
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            )}
                                            {canDelete && (
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
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Server-side pagination */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between rounded-md border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">
                    Mostrando {showingFrom} a {showingTo} de {pagination.total} registros
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground">
                        Filas:
                    </label>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            const nextSize = Number(e.target.value)
                            setPageSize(nextSize)
                            setCurrentPage(1)
                        }}
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        disabled={loading}
                    >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                    </select>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={loading || safeCurrentPage <= 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[120px] text-center text-xs font-medium">
                        Página {safeCurrentPage} / {safeTotalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        disabled={loading || safeCurrentPage >= safeTotalPages}
                        onClick={() => setCurrentPage(prev => Math.min(safeTotalPages, prev + 1))}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Modal with Iframe for Creation */}
            <Dialog open={isModalOpen} onOpenChange={handleModalOpenChange}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background [&>button]:hidden">
                    <DialogHeader className="hidden">
                        <DialogTitle>{editId ? 'Editar Recepción Probetas' : 'Nueva Recepción Probetas'}</DialogTitle>
                        <DialogDescription>{editId ? 'Formulario de edición de recepción' : 'Formulario de creación de nueva recepción'}</DialogDescription>
                    </DialogHeader>
                    <div className="w-full h-full relative">
                        <SmartIframe
                            src={editId
                                ? `${FRONTEND_URL}/migration/recepciones/${editId}/editar`
                                : `${FRONTEND_URL}/migration/nueva-recepcion`
                            }
                            title={editId ? 'Editar Recepción Probetas' : 'Nueva Recepción Probetas'}
                            token={token}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            {/* Unsaved changes confirmation */}
            <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Los datos ingresados no se han guardado. Si sales ahora, se perderán los cambios.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Seguir editando</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmCloseModal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Salir sin guardar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Detail Sheet/Dialog */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
                    <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <FileText className="h-5 w-5 text-primary" />
                            Detalle de Recepción Probetas {selectedRecepcion?.numero_recepcion}
                        </DialogTitle>
                        <DialogDescription>
                            Información completa de la orden de trabajo {selectedRecepcion?.numero_ot}
                        </DialogDescription>
                    </DialogHeader>

                    {isDetailLoading ? (
                        <div className="flex flex-1 items-center justify-center">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando detalle...
                            </div>
                        </div>
                    ) : selectedRecepcion && (
                        <div className="flex-1 min-h-0 overflow-auto">
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
                                        <div className="text-xs text-muted-foreground space-y-0.5">
                                            {selectedRecepcion.email && selectedRecepcion.email.split(/[\s,;]+/).filter(Boolean).map((e, i) => (
                                                <p key={i}>{e}</p>
                                            ))}
                                            {selectedRecepcion.telefono && <p>Tel: {selectedRecepcion.telefono}</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fechas</p>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-muted-foreground">Recepción Probetas:</span> <span className="font-medium">{formatDate(selectedRecepcion.fecha_recepcion)}</span>
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
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table className="min-w-[900px]">
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 text-xs hover:bg-muted/50">
                                                    <TableHead className="w-[50px] text-center font-bold">Nº</TableHead>
                                                    <TableHead className="font-bold">Código LEM</TableHead>
                                                    <TableHead className="font-bold">Codigo</TableHead>
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
                                                        <TableCell className="whitespace-pre-wrap max-w-[180px]">{m.identificacion_muestra || "-"}</TableCell>
                                                        <TableCell className="whitespace-pre-wrap max-w-[180px]">{m.estructura || "-"}</TableCell>
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
                        </div>
                    )}

                    <DialogFooter className="p-6 border-t shrink-0 bg-muted/5 gap-2 sm:gap-0">
                        <div className="flex-1 text-xs text-muted-foreground flex items-center">
                            ID Referencia: {selectedRecepcion?.id}
                        </div>
                        {canWrite && !isDetailLoading && (
                            <Button variant="outline" onClick={() => selectedRecepcion && handleEdit(selectedRecepcion)} className="gap-2">
                                <Pencil className="h-4 w-4" />
                                Editar
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => selectedRecepcion && handleDownloadExcel(selectedRecepcion.id)}
                            className="gap-2"
                            disabled={isDetailLoading || !selectedRecepcion}
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Descargar Excel
                        </Button>
                        <Button onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
