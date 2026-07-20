"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { NativeEnsayoDetail } from "./NativeEnsayoDetail"
import type { EnsayoModuleConfig } from "./native-ensayo-config"

type ModalMode = "create" | "edit" | "detail" | null

export interface NativeEnsayoModalsProps {
  mode: ModalMode
  ensayoId: number | null
  config: EnsayoModuleConfig
  apiUrl: string
  iframeSrc: string
  iframeTitle: string
  onClose: () => void
  onSaved: () => void
}

interface SmartIframeProps {
  src: string
  title: string
}

function SmartIframe({ src, title }: SmartIframeProps) {
  return (
    <iframe
      src={src}
      className="w-full h-full border-none"
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      loading="eager"
    />
  )
}

export function NativeEnsayoModals({
  mode,
  ensayoId,
  config,
  apiUrl,
  iframeSrc,
  iframeTitle,
  onClose,
  onSaved,
}: NativeEnsayoModalsProps) {
  if (mode === null) return null

  if (mode === "detail" && ensayoId) {
    return (
      <NativeEnsayoDetail
        ensayoId={ensayoId}
        config={config}
        apiUrl={apiUrl}
        onClose={() => {
          setTimeout(onClose, 0)
        }}
      />
    )
  }

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background [&>button]:hidden">
        <DialogHeader className="hidden">
          <DialogTitle>Ensayo {config.title}</DialogTitle>
          <DialogDescription>Formulario {config.title}</DialogDescription>
        </DialogHeader>
        <SmartIframe src={iframeSrc} title={iframeTitle} />
      </DialogContent>
    </Dialog>
  )
}

export function useNativeEnsayoMode(config: EnsayoModuleConfig) {
  const MODE: "native" | "iframe" = (process.env[config.envModeKey] || "iframe") as "native" | "iframe"
  const [nativeMode, setNativeMode] = useState<ModalMode>(null)
  const [nativeEnsayoId, setNativeEnsayoId] = useState<number | null>(null)

  const openNewEnsayo = useCallback(() => {
    setNativeEnsayoId(null)
    setNativeMode("create")
  }, [])

  const openEditEnsayo = useCallback((id: number) => {
    setNativeEnsayoId(id)
    setNativeMode("edit")
  }, [])

  const openDetail = useCallback((id: number) => {
    setNativeEnsayoId(id)
    setNativeMode("detail")
  }, [])

  const closeNativeModal = useCallback(() => {
    setNativeMode(null)
    setNativeEnsayoId(null)
  }, [])

  return {
    isNative: MODE === "native",
    nativeMode,
    nativeEnsayoId,
    openNewEnsayo,
    openEditEnsayo,
    openDetail,
    closeNativeModal,
  }
}
