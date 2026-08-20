"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Loader2, ExternalLink } from "lucide-react";
import { Recepcion } from "@/hooks/use-recepciones";
import { authFetch } from "@/lib/api-auth";
import { toast } from "sonner";

import {
  DEFAULT_CCS,
  EMAIL_PROFILES_CATALOG,
  getTipoMuestraLabel,
  generateDefaultSpeech,
} from "./email/email-profiles";
import { EmailProfileSelector } from "./email/EmailProfileSelector";
import { EmailSummaryCard } from "./email/EmailSummaryCard";
import { EmailDestinatarios } from "./email/EmailDestinatarios";
import { EmailSpeechEditor } from "./email/EmailSpeechEditor";
import { EmailSecurityChecklist } from "./email/EmailSecurityChecklist";

export interface RecepcionEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recepcion: Recepcion | null;
}

export function RecepcionEmailModal({
  open,
  onOpenChange,
  recepcion,
}: RecepcionEmailModalProps) {
  const [selectedProfileId, setSelectedProfileId] =
    useState<string>("OFICINA_TECNICA");
  const [toEmail, setToEmail] = useState("");
  const [ccList, setCcList] = useState<string[]>(DEFAULT_CCS);
  const [newCcInput, setNewCcInput] = useState("");
  const [subject, setSubject] = useState("");
  const [speechText, setSpeechText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeProfile =
    EMAIL_PROFILES_CATALOG.find((p) => p.id === selectedProfileId) ||
    EMAIL_PROFILES_CATALOG[0];

  const handleProfileChange = (profileId: string) => {
    setSelectedProfileId(profileId);
    const profile =
      EMAIL_PROFILES_CATALOG.find((p) => p.id === profileId) ||
      EMAIL_PROFILES_CATALOG[0];
    setCcList(profile.default_cc);
    toast.info(`Perfil cambiado a: ${profile.nombre} (${profile.from_email})`);
  };

  useEffect(() => {
    if (!recepcion || !open) return;

    let isMounted = true;
    const personaInitial =
      recepcion.persona_contacto?.trim() || recepcion.cliente?.trim() || "Cliente";
    const numRecepcionInitial = recepcion.numero_recepcion || "-";
    const tipoLabelInitial = getTipoMuestraLabel(recepcion.tipo_recepcion);

    const rawEmail = recepcion.email || "";
    const emailList = rawEmail
      .split(/[\r\n;,]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emailList.length > 0) {
      setToEmail(emailList.join("; "));
    } else {
      setToEmail("");
    }

    setCcList(activeProfile.default_cc);
    setSubject(`Recepción (N° ${numRecepcionInitial} muestra ${tipoLabelInitial})`);
    setSpeechText(generateDefaultSpeech(personaInitial, numRecepcionInitial));

    const fetchFullDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe";
        const res = await authFetch(`${API_URL}/api/recepcion/${recepcion.id}`);
        if (res.ok) {
          const fullData = await res.json();
          if (isMounted && fullData) {
            const fullEmailRaw = fullData.email || "";
            const fullEmailList = fullEmailRaw
              .split(/[\r\n;,]+/)
              .map((e: string) => e.trim())
              .filter((e: string) => e.length > 0);

            if (fullEmailList.length > 0) {
              setToEmail(fullEmailList.join("; "));
            }

            if (fullData.persona_contacto?.trim()) {
              setSpeechText(
                generateDefaultSpeech(
                  fullData.persona_contacto.trim(),
                  numRecepcionInitial
                )
              );
            }
          }
        }
      } catch (err) {
        console.error("Error cargando detalle completo de recepción:", err);
      } finally {
        if (isMounted) setIsLoadingDetails(false);
      }
    };

    fetchFullDetails();

    return () => {
      isMounted = false;
    };
  }, [recepcion?.id, open]);

  if (!recepcion) return null;

  const handleAddCc = () => {
    const trimmed = newCcInput.trim().toLowerCase();
    if (trimmed && !ccList.includes(trimmed)) {
      setCcList([...ccList, trimmed]);
      setNewCcInput("");
    }
  };

  const handleRemoveCc = (emailToRemove: string) => {
    setCcList(ccList.filter((c) => c !== emailToRemove));
  };

  const handleCopySpeech = () => {
    navigator.clipboard.writeText(speechText);
    setCopied(true);
    toast.success("Speech copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendDirectEmail = async () => {
    if (!recepcion) return;
    if (!toEmail.trim()) {
      toast.error(
        "Por favor ingrese al menos un correo de destinatario para el cliente."
      );
      return;
    }

    setIsSending(true);
    const toastId = toast.loading("Enviando correo oficial con Excel adjunto...", {
      description: `Conectando con el servidor institucional (${activeProfile.from_email})...`,
    });

    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe";
      const payload = {
        to_email: toEmail.trim(),
        cc_emails: ccList,
        subject: subject.trim(),
        body_text: speechText.trim(),
        profile_id: selectedProfileId,
      };

      const response = await authFetch(
        `${API_URL}/api/recepcion/${recepcion.id}/enviar-correo`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.detail || "Error al enviar el correo.");
      }

      toast.success("¡Correo enviado exitosamente!", {
        id: toastId,
        description: `Se envió desde ${activeProfile.from_name} a ${
          data.to?.join(", ") || toEmail
        } con el Excel adjunto.`,
        duration: 6000,
      });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error enviando correo:", error);
      toast.error("No se pudo enviar el correo", {
        id: toastId,
        description:
          error.message || "Verifique la conexión o contacte al administrador.",
        duration: 7000,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenMailtoDirect = () => {
    const toClean = toEmail
      .split(/[\r\n;,]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .join(",");
    const toParam = encodeURIComponent(toClean);
    const ccParam = encodeURIComponent(ccList.join(","));
    const subjectParam = encodeURIComponent(subject.trim());
    const bodyParam = encodeURIComponent(speechText.trim());
    window.location.href = `mailto:${toParam}?cc=${ccParam}&subject=${subjectParam}&body=${bodyParam}`;
    toast.success("Abriendo ventana de Outlook con tu firma de Windows...");
  };

  const handleOpenInOutlook = async () => {
    if (!recepcion) return;
    setIsGenerating(true);
    try {
      const API_URL =
        process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe";
      const payload = {
        to_email: toEmail.trim(),
        cc_emails: ccList,
        subject: subject.trim(),
        body_text: speechText.trim(),
      };

      const response = await authFetch(
        `${API_URL}/api/recepcion/${recepcion.id}/outlook-draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error("Error al generar el borrador de Outlook");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Correo_Recepcion_${
        recepcion.numero_recepcion || recepcion.id
      }.eml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("¡Borrador de Outlook descargado con Excel y Firma Geofal!", {
        description:
          "Haz clic en la descarga para abrirlo en Outlook listo para enviar.",
        duration: 6000,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error abriendo Outlook draft:", error);
      toast.error(
        "No se pudo generar el correo para Outlook. Revisa la conexión con el servidor."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const hasCliente = Boolean(
    recepcion.cliente &&
      recepcion.cliente.trim() !== "" &&
      recepcion.cliente.trim() !== "-"
  );
  const hasNumeroRecepcion = Boolean(
    recepcion.numero_recepcion &&
      recepcion.numero_recepcion.trim() !== "" &&
      recepcion.numero_recepcion.trim() !== "-"
  );
  const hasValidEmail = Boolean(
    toEmail && toEmail.trim() !== "" && toEmail.includes("@")
  );
  const hasSpeech = Boolean(speechText && speechText.trim() !== "");
  const isSecurityPassed =
    hasCliente && hasNumeroRecepcion && hasValidEmail && hasSpeech;

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
                  <Badge
                    variant="outline"
                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {activeProfile.nombre}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Envía la notificación con el Excel oficial adjunto y la firma
                  corporativa de {activeProfile.nombre}.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <EmailProfileSelector
            selectedProfileId={selectedProfileId}
            onProfileChange={handleProfileChange}
            activeProfile={activeProfile}
          />

          <EmailSummaryCard recepcion={recepcion} />

          <EmailDestinatarios
            toEmail={toEmail}
            setToEmail={setToEmail}
            hasValidEmail={hasValidEmail}
            isLoadingDetails={isLoadingDetails}
            ccList={ccList}
            newCcInput={newCcInput}
            setNewCcInput={setNewCcInput}
            handleAddCc={handleAddCc}
            handleRemoveCc={handleRemoveCc}
          />

          <EmailSpeechEditor
            subject={subject}
            setSubject={setSubject}
            speechText={speechText}
            setSpeechText={setSpeechText}
            copied={copied}
            onCopySpeech={handleCopySpeech}
            activeProfile={activeProfile}
            recepcionNumero={recepcion.numero_recepcion || "-"}
            clienteNombre={recepcion.cliente || ""}
          />

          <EmailSecurityChecklist
            hasCliente={hasCliente}
            hasNumeroRecepcion={hasNumeroRecepcion}
            hasValidEmail={hasValidEmail}
            hasSpeech={hasSpeech}
            isSecurityPassed={isSecurityPassed}
          />
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenInOutlook}
              disabled={isGenerating || isSending}
              className="text-xs font-semibold gap-1.5 w-full sm:w-auto text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer"
              title="Descarga el archivo .eml con el Excel ya adjunto para abrirlo en tu Outlook de escritorio"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Generando borrador...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Descargar Borrador (.eml)</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenMailtoDirect}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground hidden sm:inline-flex"
              title="Abre tu cliente de correo predeterminado mediante enlace mailto:"
            >
              Abrir app de correo
            </Button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSending}
              className="text-xs w-full sm:w-auto"
            >
              Cerrar
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSendDirectEmail}
              disabled={isSending || !isSecurityPassed}
              className="text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs w-full sm:w-auto cursor-pointer"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Enviar Correo Oficial</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
