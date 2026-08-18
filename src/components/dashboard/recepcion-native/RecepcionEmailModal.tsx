"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Mail, FileSpreadsheet, Copy, Send, Check, Loader2, Sparkles, Building2, Calendar, Hash, FolderKanban, X, ExternalLink } from "lucide-react"
import { Recepcion } from "@/hooks/use-recepciones"
import { authFetch } from "@/lib/api-auth"
import { formatOtDisplay } from "@/lib/utils"
import { toast } from "sonner"

interface RecepcionEmailModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    recepcion: Recepcion | null
}

const DEFAULT_CCS = ["oficinatecnica3@geofal.com.pe", "asesorcomercial1@geofal.com.pe"]

const getTipoMuestraLabel = (tipo?: string) => {
    switch ((tipo || "").toUpperCase()) {
        case "CONCRETO": return "Concreto"
        case "SUELO_AGREGADO": return "Suelo/Agregado"
        case "ALBANILERIA": return "Albañilería"
        case "ROCA": return "Roca"
        case "AGUA": return "Agua"
        default: return "Concreto"
    }
}

export function RecepcionEmailModal({ open, onOpenChange, recepcion }: RecepcionEmailModalProps) {
    const [toEmail, setToEmail] = useState("")
    const [ccList, setCcList] = useState<string[]>(DEFAULT_CCS)
    const [newCcInput, setNewCcInput] = useState("")
    const [subject, setSubject] = useState("")
    const [speechText, setSpeechText] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [copied, setCopied] = useState(false)

    // Formatear speech y datos al abrir con una nueva recepción
    useEffect(() => {
        if (!recepcion || !open) return

        const persona = recepcion.persona_contacto?.trim() || recepcion.cliente?.trim() || "Cliente"
        const numRecepcion = recepcion.numero_recepcion || "-"
        const tipoLabel = getTipoMuestraLabel(recepcion.tipo_recepcion)

        // Saludo dinámico según hora peruana (UTC-5)
        const now = new Date()
        const peruHour = new Date(now.toLocaleString("en-US", { timeZone: "America/Lima" })).getHours()
        const saludo = peruHour < 12 ? "Buenos días," : "Buenas tardes,"

        // Normalizar y auto-seleccionar todos los correos del cliente (separados por ; o saltos de línea)
        const rawEmail = recepcion.email || ""
        const emailList = rawEmail
            .split(/[\r\n;,]+/)
            .map(e => e.trim())
            .filter(e => e.length > 0)
        
        setToEmail(emailList.join("; "))
        setCcList(DEFAULT_CCS)
        setSubject(`Recepción (N° ${numRecepcion} muestra ${tipoLabel})`)

        const generatedSpeech = `${saludo}
Estimado(a) ${persona}

De acuerdo con la muestra recepcionada en laboratorio, le hacemos llegar el Formato de Recepción (N° ${numRecepcion}) con el fin de completar y/o verifique que los datos consignados sean correctos y tenga conocimiento de la fecha de entrega de los informes de ensayo.

Cualquier modificación solicitada una vez emitidos los informes de ensayo, deberá justificar el motivo del cambio por correo, el área comercial se pondrá en contacto.

Agradeceremos nos brinde su conformidad por este medio para emitir el informe de ensayo.

Atentamente,`

        setSpeechText(generatedSpeech)
    }, [recepcion, open])

    if (!recepcion) return null

    const handleAddCc = () => {
        const trimmed = newCcInput.trim().toLowerCase()
        if (trimmed && !ccList.includes(trimmed)) {
            setCcList([...ccList, trimmed])
            setNewCcInput("")
        }
    }

    const handleRemoveCc = (emailToRemove: string) => {
        setCcList(ccList.filter(c => c !== emailToRemove))
    }

    const handleCopySpeech = () => {
        navigator.clipboard.writeText(speechText)
        setCopied(true)
        toast.success("Speech copiado al portapapeles")
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSendDirectEmail = async () => {
        if (!recepcion) return
        if (!toEmail.trim()) {
            toast.error("Por favor ingrese al menos un correo de destinatario para el cliente.")
            return
        }

        setIsSending(true)
        const toastId = toast.loading("Enviando correo oficial con Excel adjunto...", {
            description: "Conectando con el servidor institucional oficinatecnica1@geofal.com.pe..."
        })

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const payload = {
                to_email: toEmail.trim(),
                cc_emails: ccList,
                subject: subject.trim(),
                body_text: speechText.trim(),
            }

            const response = await authFetch(`${API_URL}/api/recepcion/${recepcion.id}/enviar-correo`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data?.detail || "Error al enviar el correo.")
            }

            toast.success("¡Correo enviado exitosamente!", {
                id: toastId,
                description: `Se envió a ${data.to?.join(", ") || toEmail} con copia a los correos internos y el Excel adjunto.`,
                duration: 6000,
            })
            onOpenChange(false)
        } catch (error: any) {
            console.error("Error enviando correo:", error)
            toast.error("No se pudo enviar el correo", {
                id: toastId,
                description: error.message || "Verifique la conexión o contacte al administrador.",
                duration: 7000,
            })
        } finally {
            setIsSending(false)
        }
    }

    const handleOpenMailtoDirect = () => {
        const toClean = toEmail.split(/[\r\n;,]+/).map(e => e.trim()).filter(Boolean).join(",")
        const toParam = encodeURIComponent(toClean)
        const ccParam = encodeURIComponent(ccList.join(","))
        const subjectParam = encodeURIComponent(subject.trim())
        const bodyParam = encodeURIComponent(speechText.trim())
        window.location.href = `mailto:${toParam}?cc=${ccParam}&subject=${subjectParam}&body=${bodyParam}`
        toast.success("Abriendo ventana de Outlook con tu firma de Windows...")
    }

    const handleOpenInOutlook = async () => {
        if (!recepcion) return
        setIsGenerating(true)
        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const payload = {
                to_email: toEmail.trim(),
                cc_emails: ccList,
                subject: subject.trim(),
                body_text: speechText.trim(),
            }

            const response = await authFetch(`${API_URL}/api/recepcion/${recepcion.id}/outlook-draft`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                throw new Error("Error al generar el borrador de Outlook")
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = `Correo_Recepcion_${recepcion.numero_recepcion || recepcion.id}.eml`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast.success("¡Borrador de Outlook descargado con Excel y Firma Geofal!", {
                description: "Haz clic en la descarga para abrirlo en Outlook listo para enviar.",
                duration: 6000,
            })
            onOpenChange(false)
        } catch (error) {
            console.error("Error abriendo Outlook draft:", error)
            toast.error("No se pudo generar el correo para Outlook. Revisa la conexión con el servidor.")
        } finally {
            setIsGenerating(false)
        }
    }

    const muestrasCount = recepcion.muestras_count ?? (Array.isArray(recepcion.muestras) ? recepcion.muestras.length : 0)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
                {/* Header */}
                <DialogHeader className="p-4 sm:p-5 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-600 border border-blue-600/20">
                                <Mail className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                    Enviar Notificación por Correo (Outlook)
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        Oficina Técnica
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Genera el correo con el Excel oficial adjunto y ábrelo directamente en tu Microsoft Outlook listo para enviar.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Tarjeta Resumen de Recepción */}
                    <div className="p-3.5 rounded-lg border bg-card/60 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 shadow-xs">
                        <div className="space-y-0.5">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Hash className="h-3 w-3" /> N° Recepción
                            </span>
                            <span className="font-bold text-foreground text-sm block">
                                {recepcion.numero_recepcion || "-"}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Hash className="h-3 w-3" /> N° OT
                            </span>
                            <span className="font-bold text-foreground text-sm block">
                                {recepcion.numero_ot ? formatOtDisplay(recepcion.numero_ot) : "-"}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" /> F. Recepción
                            </span>
                            <span className="font-medium text-foreground block">
                                {recepcion.fecha_recepcion || "-"}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> Probetas
                            </span>
                            <span className="font-bold text-blue-600 block">
                                {muestrasCount} muestras
                            </span>
                        </div>
                        <div className="col-span-2 space-y-0.5 pt-1 border-t">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3" /> Cliente
                            </span>
                            <span className="font-semibold text-foreground truncate block">
                                {recepcion.cliente || "-"}
                            </span>
                        </div>
                        <div className="col-span-2 space-y-0.5 pt-1 border-t">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <FolderKanban className="h-3 w-3" /> Proyecto
                            </span>
                            <span className="font-semibold text-foreground truncate block">
                                {recepcion.proyecto || "-"}
                            </span>
                        </div>
                    </div>

                    {/* Campos de Destinatarios */}
                    <div className="space-y-3">
                        {/* Para */}
                        <div>
                            <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1">
                                <span>Para (Correo del Cliente):</span>
                                {!toEmail && (
                                    <span className="text-[11px] text-amber-600 font-normal">
                                        ⚠️ Ingrese el correo del cliente para enviar
                                    </span>
                                )}
                            </label>
                            <Input
                                type="email"
                                placeholder="ejemplo: contacto@cliente.com"
                                value={toEmail}
                                onChange={(e) => setToEmail(e.target.value)}
                                className="h-9 text-xs"
                            />
                        </div>

                        {/* CC */}
                        <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">
                                Con Copia (CC):
                            </label>
                            <div className="flex flex-wrap gap-1.5 p-2 rounded-md border bg-muted/20 min-h-[38px] items-center">
                                {ccList.map((cc) => (
                                    <Badge key={cc} variant="secondary" className="gap-1 text-[11px] py-0.5 px-2 bg-background border">
                                        {cc}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCc(cc)}
                                            className="text-muted-foreground hover:text-destructive ml-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                                <div className="flex items-center gap-1 flex-1 min-w-[180px]">
                                    <input
                                        type="email"
                                        placeholder="Agregar otro correo y presione Enter..."
                                        value={newCcInput}
                                        onChange={(e) => setNewCcInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault()
                                                handleAddCc()
                                            }
                                        }}
                                        className="text-xs bg-transparent outline-none flex-1 placeholder:text-muted-foreground/60 h-6 px-1"
                                    />
                                    {newCcInput.trim() && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            onClick={handleAddCc}
                                            className="h-6 px-2 text-[10px]"
                                        >
                                            Agregar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Asunto */}
                        <div>
                            <label className="text-xs font-semibold text-foreground mb-1 block">
                                Asunto:
                            </label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="h-9 text-xs font-medium"
                            />
                        </div>

                        {/* Speech / Mensaje */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                                    Mensaje Personalizado / Speech:
                                </label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopySpeech}
                                    className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                                >
                                    {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                    {copied ? "Copiado" : "Copiar Texto"}
                                </Button>
                            </div>
                            <Textarea
                                rows={7}
                                value={speechText}
                                onChange={(e) => setSpeechText(e.target.value)}
                                className="text-xs leading-relaxed font-sans resize-y"
                            />
                        </div>

                        {/* Previsualización de la Firma Corporativa Oficial */}
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-muted-foreground block">
                                Firma Institucional (se adjunta al pie del correo):
                            </label>
                            <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3.5 shadow-2xs">
                                <div className="bg-[#ff5500] text-white font-black text-xs px-3 py-2.5 rounded-lg text-center tracking-tight shadow-xs select-none">
                                    Geofal
                                </div>
                                <div className="border-l-2 border-[#ea580c] pl-3 text-left space-y-0.5">
                                    <div className="text-xs font-bold text-[#ea580c] tracking-wide">
                                        OFICINA TÉCNICA
                                    </div>
                                    <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                                        GEOFAL S.A.C. — Laboratorio de Ensayo de Materiales
                                    </div>
                                    <div className="text-[10px] text-muted-foreground">
                                        <strong>T:</strong> +51 1 9051911 &nbsp;|&nbsp; <strong>E:</strong> oficinatecnica1@geofal.com.pe &nbsp;|&nbsp; <strong>W:</strong> www.geofal.com.pe
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Archivo Adjunto Automático */}
                        <div className="p-3 rounded-lg border bg-green-500/5 border-green-200 dark:border-green-900 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="p-2 rounded bg-green-600 text-white shrink-0">
                                    <FileSpreadsheet className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-bold text-foreground truncate">
                                        REC N-{recepcion.numero_recepcion || recepcion.id} {recepcion.cliente || ""}.xlsx
                                    </div>
                                    <div className="text-[11px] text-green-700 dark:text-green-400 flex items-center gap-1">
                                        <Check className="h-3 w-3" />
                                        Se adjuntará automáticamente dentro de Outlook
                                    </div>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 shrink-0">
                                Excel Oficial
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 border-t bg-muted/10 gap-2 sm:gap-0 flex-row justify-between items-center flex-wrap">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        disabled={isSending || isGenerating}
                        className="text-xs"
                    >
                        Cancelar
                    </Button>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleOpenInOutlook}
                            disabled={isSending || isGenerating}
                            className="text-xs font-medium text-slate-700 dark:text-slate-200 border-slate-300 hover:bg-accent gap-1.5"
                            title="Descarga el borrador .eml para abrirlo en Outlook de escritorio"
                        >
                            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 text-blue-600" />}
                            Borrador Outlook (.eml)
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            onClick={handleSendDirectEmail}
                            disabled={isSending || isGenerating}
                            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm"
                            title="Envía el correo directamente desde oficinatecnica1@geofal.com.pe con el Excel oficial y firma corporativa"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Enviando Correo...
                                </>
                            ) : (
                                <>
                                    <Send className="h-4 w-4" />
                                    Enviar Correo Directo
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
