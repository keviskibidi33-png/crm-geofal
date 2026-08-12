/* eslint-disable @next/next/no-img-element */
"use client"

import React, { useEffect } from "react"
import { X, Download, ExternalLink } from "lucide-react"

interface ImageLightboxProps {
  selectedImage: string | null
  onClose: () => void
}

export function ImageLightbox({ selectedImage, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    if (selectedImage) {
      window.addEventListener("keydown", handleKeyDown)
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [selectedImage, onClose])

  if (!selectedImage) return null

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in-0 transition-opacity"
      onClick={onClose}
    >
      {/* Botones de acción flotantes en la esquina superior derecha */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-[210]" onClick={(e) => e.stopPropagation()}>
        <a
          href={selectedImage}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all shadow-md"
          title="Abrir en pestaña nueva"
        >
          <ExternalLink className="h-5 w-5" />
        </a>
        <a
          href={selectedImage}
          download
          className="p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all shadow-md"
          title="Descargar imagen"
        >
          <Download className="h-5 w-5" />
        </a>
        <button
          className="p-2.5 rounded-full bg-white/20 text-white hover:bg-red-600 transition-all shadow-md"
          onClick={onClose}
          title="Cerrar vista previa (Esc)"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Contenedor de la Imagen */}
      <div
        className="relative max-w-5xl max-h-[88vh] flex items-center justify-center p-2 rounded-2xl bg-black/40 border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={selectedImage}
          alt="Vista previa ampliada"
          className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-lg select-none"
        />
      </div>
    </div>
  )
}
