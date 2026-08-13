"use client"

import { useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
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

  const IconComponent = config.icon

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background flex flex-col [&>button]:hidden">
        <DialogHeader className="flex flex-row items-center justify-between px-4 py-2.5 border-b bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            {IconComponent && <IconComponent className="h-5 w-5 text-blue-400 shrink-0" />}
            <div>
              <DialogTitle className="text-base font-semibold text-white leading-tight">
                {config.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 leading-none mt-0.5">
                {config.description}
              </DialogDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Cerrar ventana (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        <div className="flex-1 min-h-0 w-full relative">
          <SmartIframe src={iframeSrc} title={iframeTitle} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useNativeEnsayoMode(config: EnsayoModuleConfig) {
  const MODE: "native" | "iframe" = (process.env[config.envModeKey] || "native") as "native" | "iframe"
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
