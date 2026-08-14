"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Trash2, AlertTriangle, X, type LucideIcon } from "lucide-react"

export interface ConfirmActionModalProps {
  isOpen: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "warning" | "info"
  icon?: LucideIcon
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmActionModal({
  isOpen,
  title = "Limpiar datos no guardados",
  message = "Se limpiarán los datos no guardados. ¿Deseas continuar?",
  confirmText = "Sí, limpiar",
  cancelText = "Cancelar",
  variant = "warning",
  icon: CustomIcon,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen || !mounted) return null

  const IconComponent = CustomIcon || (variant === "warning" || variant === "danger" ? Trash2 : AlertTriangle)

  const iconClasses =
    variant === "danger"
      ? "bg-red-100 text-red-600 border border-red-200"
      : variant === "warning"
      ? "bg-amber-100 text-amber-700 border border-amber-200"
      : "bg-blue-100 text-blue-700 border border-blue-200"

  const confirmBtnClasses =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 text-white"
      : "bg-[#0080B8] hover:bg-[#006f9e] text-white"

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm cursor-default border-none"
        onClick={onCancel}
        aria-label="Cerrar modal"
      />

      {/* Dialog Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-3.5">
            <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClasses}`}>
              <IconComponent className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 pr-4">
              <h3 className="text-base font-bold text-slate-900 leading-tight">{title}</h3>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-500">{message}</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 transition-colors shadow-xs"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-9 px-4 rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-sm ${confirmBtnClasses}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
