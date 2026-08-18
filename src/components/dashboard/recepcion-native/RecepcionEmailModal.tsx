"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Mail, FileSpreadsheet, Copy, Send, Check, Loader2, Sparkles, Building2, Calendar, Hash, FolderKanban, X, ExternalLink, User, ShieldCheck, AlertCircle, AlertTriangle } from "lucide-react"
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

interface EmailProfileOption {
    id: string
    codigo: string
    nombre: string
    cargo: string
    from_name: string
    from_email: string
    default_cc: string[]
    signature_image_url?: string
}

const EMAIL_PROFILES_CATALOG: EmailProfileOption[] = [
    {
        id: "OFICINA_TECNICA",
        codigo: "OFICINA_TECNICA",
        nombre: "Oficina Técnica",
        cargo: "Oficina Técnica - Control de Calidad",
        from_name: "Oficina Técnica - GEOFAL",
        from_email: "oficinatecnica1@geofal.com.pe",
        default_cc: ["oficinatecnica3@geofal.com.pe", "asesorcomercial1@geofal.com.pe"],
        signature_image_url: undefined,
    },
    {
        id: "COORDINADOR_LAB",
        codigo: "COORDINADOR_LAB",
        nombre: "Coordinación de Laboratorio",
        cargo: "Coordinadora de Laboratorio",
        from_name: "Coordinadora de Laboratorio - GEOFAL",
        from_email: "coordinadorlab@geofal.com.pe",
        default_cc: ["oficinatecnica1@geofal.com.pe", "oficinatecnica3@geofal.com.pe", "asesorcomercial1@geofal.com.pe"],
        signature_image_url: "/FirmaCoordinadoraLabBetzabethSaravia.png",
    }
]

export function RecepcionEmailModal({ open, onOpenChange, recepcion }: RecepcionEmailModalProps) {
    const [selectedProfileId, setSelectedProfileId] = useState<string>("OFICINA_TECNICA")
    const [toEmail, setToEmail] = useState("")
    const [ccList, setCcList] = useState<string[]>(DEFAULT_CCS)
    const [newCcInput, setNewCcInput] = useState("")
    const [subject, setSubject] = useState("")
    const [speechText, setSpeechText] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [isLoadingDetails, setIsLoadingDetails] = useState(false)
    const [copied, setCopied] = useState(false)

    const activeProfile = EMAIL_PROFILES_CATALOG.find(p => p.id === selectedProfileId) || EMAIL_PROFILES_CATALOG[0]

    const handleProfileChange = (profileId: string) => {
        setSelectedProfileId(profileId)
        const profile = EMAIL_PROFILES_CATALOG.find(p => p.id === profileId) || EMAIL_PROFILES_CATALOG[0]
        setCcList(profile.default_cc)
        toast.info(`Perfil cambiado a: ${profile.nombre} (${profile.from_email})`)
    }

    // Formatear speech y datos al abrir con una nueva recepción + consulta asíncrona de seguridad
    useEffect(() => {
        if (!recepcion || !open) return

        let isMounted = true

        const personaInitial = recepcion.persona_contacto?.trim() || recepcion.cliente?.trim() || "Cliente"
        const numRecepcionInitial = recepcion.numero_recepcion || "-"
        const tipoLabelInitial = getTipoMuestraLabel(recepcion.tipo_recepcion)

        // Saludo dinámico según hora peruana (UTC-5)
        const now = new Date()
        const peruHour = new Date(now.toLocaleString("en-US", { timeZone: "America/Lima" })).getHours()
        const saludo = peruHour < 12 ? "Buenos días," : "Buenas tardes,"

        // Normalizar y auto-seleccionar correos iniciales si están en el registro de la fila
        const rawEmail = recepcion.email || ""
        const emailList = rawEmail
            .split(/[\r\n;,]+/)
            .map(e => e.trim())
            .filter(e => e.length > 0)
        
        if (emailList.length > 0) {
            setToEmail(emailList.join("; "))
        } else {
            setToEmail("")
        }

        setCcList(activeProfile.default_cc)
        setSubject(`Recepción (N° ${numRecepcionInitial} muestra ${tipoLabelInitial})`)

        const initialSpeech = `${saludo}
Estimado(a) ${personaInitial}

De acuerdo con la muestra recepcionada en laboratorio, le hacemos llegar el Formato de Recepción (N° ${numRecepcionInitial}) con el fin de completar y/o verifique que los datos consignados sean correctos y tenga conocimiento de la fecha de entrega de los informes de ensayo.

Cualquier modificación solicitada una vez emitidos los informes de ensayo, deberá justificar el motivo del cambio por correo, el área comercial se pondrá en contacto.

Agradeceremos nos brinde su conformidad por este medio para emitir el informe de ensayo.

Atentamente,`

        setSpeechText(initialSpeech)

        // Consulta asíncrona para asegurar que cargue el correo completo y persona de contacto desde el backend
        const fetchFullDetails = async () => {
            setIsLoadingDetails(true)
            try {
                const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
                const res = await authFetch(`${API_URL}/api/recepcion/${recepcion.id}`)
                if (res.ok) {
                    const fullData = await res.json()
                    if (isMounted && fullData) {
                        const fullEmailRaw = fullData.email || ""
                        const fullEmailList = fullEmailRaw
                            .split(/[\r\n;,]+/)
                            .map((e: string) => e.trim())
                            .filter((e: string) => e.length > 0)

                        if (fullEmailList.length > 0) {
                            setToEmail(fullEmailList.join("; "))
                        }

                        if (fullData.persona_contacto?.trim()) {
                            const updatedPersona = fullData.persona_contacto.trim()
                            setSpeechText(`${saludo}
Estimado(a) ${updatedPersona}

De acuerdo con la muestra recepcionada en laboratorio, le hacemos llegar el Formato de Recepción (N° ${numRecepcionInitial}) con el fin de completar y/o verifique que los datos consignados sean correctos y tenga conocimiento de la fecha de entrega de los informes de ensayo.

Cualquier modificación solicitada una vez emitidos los informes de ensayo, deberá justificar el motivo del cambio por correo, el área comercial se pondrá en contacto.

Agradeceremos nos brinde su conformidad por este medio para emitir el informe de ensayo.

Atentamente,`)
                        }
                    }
                }
            } catch (err) {
                console.error("Error cargando detalle completo de recepción:", err)
            } finally {
                if (isMounted) setIsLoadingDetails(false)
            }
        }

        fetchFullDetails()

        return () => {
            isMounted = false
        }
    }, [recepcion?.id, open])

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
            description: `Conectando con el servidor institucional (${activeProfile.from_email})...`
        })

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"
            const payload = {
                to_email: toEmail.trim(),
                cc_emails: ccList,
                subject: subject.trim(),
                body_text: speechText.trim(),
                profile_id: selectedProfileId,
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
                description: `Se envió desde ${activeProfile.from_name} a ${data.to?.join(", ") || toEmail} con el Excel adjunto.`,
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

    const hasCliente = Boolean(recepcion.cliente && recepcion.cliente.trim() !== "" && recepcion.cliente.trim() !== "-")
    const hasNumeroRecepcion = Boolean(recepcion.numero_recepcion && recepcion.numero_recepcion.trim() !== "" && recepcion.numero_recepcion.trim() !== "-")
    const hasValidEmail = Boolean(toEmail && toEmail.trim() !== "" && toEmail.includes("@"))
    const hasSpeech = Boolean(speechText && speechText.trim() !== "")
    const isSecurityPassed = hasCliente && hasNumeroRecepcion && hasValidEmail && hasSpeech

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
                                    Enviar Notificación por Correo
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                        {activeProfile.nombre}
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Envía la notificación con el Excel oficial adjunto y la firma corporativa de {activeProfile.nombre}.
                                </DialogDescription>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Selector de Perfil de Remitente */}
                    <div className="p-3 rounded-lg border bg-gradient-to-r from-blue-500/5 via-orange-500/5 to-transparent border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1.5 rounded-md bg-blue-600/10 text-blue-600 font-bold shrink-0">
                                <User className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                    Perfil de Remitente
                                    <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200">
                                        {activeProfile.nombre}
                                    </Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                    Cuenta de salida: <strong className="text-foreground font-mono">{activeProfile.from_email}</strong>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                            <select
                                value={selectedProfileId}
                                onChange={(e) => handleProfileChange(e.target.value)}
                                className="w-full sm:w-auto h-8 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-foreground shadow-2xs focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                                {EMAIL_PROFILES_CATALOG.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.nombre} ({p.from_email})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

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
                            <span className="font-bold text-foreground truncate block">
                                {recepcion.cliente || "-"}
                            </span>
                        </div>
                        <div className="col-span-2 space-y-0.5 pt-1 border-t">
                            <span className="text-muted-foreground flex items-center gap-1">
                                <FolderKanban className="h-3 w-3" /> Proyecto
                            </span>
                            <span className="font-medium text-foreground truncate block">
                                {recepcion.proyecto || "-"}
                            </span>
                        </div>
                    </div>

                    {/* Campos de Envío */}
                    <div className="space-y-3">
                        {/* Destinatario Principal (Para) */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                                    Para (Correo del Cliente):
                                    <span className="text-destructive">*</span>
                                </label>
                                {isLoadingDetails ? (
                                    <span className="text-[10px] text-blue-600 flex items-center gap-1 animate-pulse">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Buscando correo en base de datos...
                                    </span>
                                ) : !toEmail.trim() ? (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Ingrese el correo del cliente para enviar
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                                        <Check className="h-3 w-3" /> Correo cargado
                                    </span>
                                )}
                            </div>
                            <Input
                                placeholder="ejemplo: contacto@cliente.com; supervisor@cliente.com"
                                value={toEmail}
                                onChange={(e) => setToEmail(e.target.value)}
                                className={`text-xs h-9 ${!hasValidEmail ? 'border-amber-300 dark:border-amber-700 bg-amber-50/20' : ''}`}
                            />
                            <span className="text-[10px] text-muted-foreground">
                                Puedes ingresar múltiples correos separados por punto y coma (;) o comas (,).
                            </span>
                        </div>

                        {/* Con Copia (CC) */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-foreground block">
                                Con Copia (CC):
                            </label>
                            <div className="p-2 rounded-lg border bg-muted/20 min-h-10 flex flex-wrap items-center gap-1.5">
                                {ccList.map((ccEmail) => (
                                    <Badge
                                        key={ccEmail}
                                        variant="secondary"
                                        className="text-xs font-mono font-medium py-1 px-2 gap-1 bg-background border shadow-2xs"
                                    >
                                        {ccEmail}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveCc(ccEmail)}
                                            className="hover:text-destructive transition-colors ml-0.5"
                                            title="Remover copia"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                                <div className="flex-1 min-w-[200px] flex items-center gap-1">
                                    <input
                                        type="email"
                                        placeholder="Agregar otro correo y presione Enter..."
                                        value={newCcInput}
                                        onChange={(e) => setNewCcInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === ",") {
                                                e.preventDefault()
                                                handleAddCc()
                                            }
                                        }}
                                        className="w-full text-xs bg-transparent border-none outline-hidden px-1 text-foreground placeholder:text-muted-foreground"
                                    />
                                    {newCcInput.trim() && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleAddCc}
                                            className="h-6 px-2 text-[11px]"
                                        >
                                            Agregar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Asunto */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-foreground block">
                                Asunto:
                            </label>
                            <Input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="text-xs h-9 font-medium"
                            />
                        </div>

                        {/* Mensaje Personalizado / Speech */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-foreground flex items-center gap-1">
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
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-semibold text-muted-foreground block">
                                    Firma Corporativa (al pie del correo):
                                </label>
                                {activeProfile.signature_image_url ? (
                                    <Badge variant="outline" className="text-[10px] text-green-700 dark:text-green-300 border-green-300 bg-green-50 dark:bg-green-950/50">
                                        Firma Oficial: {activeProfile.cargo}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300 bg-slate-100 dark:bg-slate-800">
                                        None (Sin firma gráfica)
                                    </Badge>
                                )}
                            </div>

                            {activeProfile.signature_image_url ? (
                                <div className="p-3 rounded-lg border bg-muted/30 flex items-center gap-3.5 shadow-2xs">
                                    <img
                                        src={activeProfile.signature_image_url}
                                        alt="Firma Geofal"
                                        className="h-14 w-auto object-contain rounded shrink-0 bg-white p-1 border border-slate-200"
                                        onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                        }}
                                    />
                                    <div className="border-l-2 border-[#ea580c] pl-3 text-left space-y-0.5 min-w-0">
                                        <div className="text-xs font-bold text-[#ea580c] tracking-wide uppercase truncate">
                                            {activeProfile.cargo}
                                        </div>
                                        <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                                            GEOFAL S.A.C. — Laboratorio de Ensayo de Materiales
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">
                                            <strong>T:</strong> +51 1 9051911 &nbsp;|&nbsp; <strong>E:</strong> {activeProfile.from_email} &nbsp;|&nbsp; <strong>W:</strong> www.geofal.com.pe
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-800 bg-muted/15 flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                                            None / Sin firma
                                        </span>
                                        <span>Envío con datos institucionales de <strong>{activeProfile.nombre}</strong> (sin firma gráfica).</span>
                                    </div>
                                </div>
                            )}
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
                            disabled={isSending || isGenerating || !hasValidEmail}
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
                            disabled={isSending || isGenerating || !hasValidEmail}
                            className={`text-xs font-bold gap-2 shadow-sm ${!hasValidEmail ? 'bg-slate-400 cursor-not-allowed text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                            title={!hasValidEmail ? "Ingrese el correo del cliente para poder enviar" : "Envía el correo directamente desde el servidor institucional"}
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
