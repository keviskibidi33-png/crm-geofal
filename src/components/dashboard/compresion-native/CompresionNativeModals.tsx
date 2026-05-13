"use client"

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import dynamic from "next/dynamic"

const CompresionForm = dynamic(() => import("./CompresionForm"), { ssr: false })
const CompresionDetail = dynamic(() => import("./CompresionDetail"), { ssr: false })

interface CompresionNativeModalsProps {
  mode: "create" | "edit" | "detail" | null
  ensayoId?: number | null
  importedData?: any
  onClose: () => void
  onSaved: () => void
}

export default function CompresionNativeModals({
  mode,
  ensayoId,
  importedData,
  onClose,
  onSaved,
}: CompresionNativeModalsProps) {
  const isOpen = mode !== null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden flex flex-col bg-background [&>button]:hidden">
        <DialogTitle className="hidden">{mode === "detail" ? "Detalle" : "Formulario"}</DialogTitle>
        <DialogDescription className="hidden">F. Probetas</DialogDescription>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {mode === "create" && (
            <CompresionForm importedData={importedData} onClose={onClose} onSaved={onSaved} />
          )}
          {mode === "edit" && ensayoId && (
            <CompresionForm editId={ensayoId} onClose={onClose} onSaved={onSaved} />
          )}
          {mode === "detail" && ensayoId && (
            <CompresionDetail ensayoId={ensayoId} onClose={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
