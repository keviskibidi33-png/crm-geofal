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

export function RecepcionEmailModal({ open, onOpenChange, recepcion }: RecepcionEmailModalProps) {
    const [toEmail, setToEmail] = useState("")
    const [ccList, setCcList] = useState<string[]>(DEFAULT_CCS)
    const [newCcInput, setNewCcInput] = useState("")
    const [subject, setSubject] = useState("")
    const [speechText, setSpeechText] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [copied, setCopied] = useState(false)

    // Formatear speech y datos al abrir con una nueva recepción
    useEffect(() => {
        if (!recepcion || !open) return

        const cliente = recepcion.cliente || "Cliente"
        const numRecepcion = recepcion.numero_recepcion || "-"
        const numOt = recepcion.numero_ot ? formatOtDisplay(recepcion.numero_ot) : "-"
        const proyecto = recepcion.proyecto || "-"
        const fecha = recepcion.fecha_recepcion || "-"
        const muestrasCount = recepcion.muestras_count ?? (Array.isArray(recepcion.muestras) ? recepcion.muestras.length : 0)

        setToEmail(recepcion.email || "")
        setCcList(DEFAULT_CCS)
        setSubject(`RECEPCIÓN DE PROBETAS DE CONCRETO N° ${numRecepcion} - ${cliente}`)

        const generatedSpeech = `Estimado(s) ${cliente},

Por medio de la presente, confirmamos la recepción satisfactoria de sus muestras/probetas de concreto en nuestro laboratorio GEOFAL S.A.C.:

• N° Recepción: ${numRecepcion}
• N° Orden de Trabajo: ${numOt}
• Proyecto: ${proyecto}
• Fecha de Recepción: ${fecha}
• Cantidad de Probetas: ${muestrasCount} probetas

Adjuntamos en este correo el formato oficial de registro de recepción de probetas para su respectiva conformidad. Estaremos procediendo con los ensayos programados de rotura según las edades solicitadas.

Cualquier consulta técnica o comercial, quedamos a su entera disposición.

Atentamente,
OFICINA TÉCNICA
GEOFAL S.A.C.
Control de Calidad de Materiales | Concreto, Suelos y Pavimentos
oficinatecnica1@geofal.com.pe`

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

            toast.success("¡Abriendo correo en Microsoft Outlook con el Excel adjunto!", {
                description: "Se abrirá tu ventana de Outlook lista con el archivo Excel incrustado.",
                duration: 5000,
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
                                rows={8}
                                value={speechText}
                                onChange={(e) => setSpeechText(e.target.value)}
                                className="text-xs leading-relaxed font-sans resize-y"
                            />
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
                <DialogFooter className="p-4 border-t bg-muted/10 gap-2 sm:gap-0 flex-row justify-between items-center">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        disabled={isGenerating}
                        className="text-xs"
                    >
                        Cancelar
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleOpenInOutlook}
                            disabled={isGenerating}
                            className="text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xs"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Preparando Outlook...
                                </>
                            ) : (
                                <>
                                    <Mail className="h-4 w-4" />
                                    Abrir en Outlook con Excel Adjunto
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
