/* eslint-disable @next/next/no-img-element */
"use client"

import React from "react"
import { X } from "lucide-react"

interface ImageLightboxProps {
  selectedImage: string | null
  onClose: () => void
}

export function ImageLightbox({ selectedImage, onClose }: ImageLightboxProps) {
  if (!selectedImage) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl">
        <img src={selectedImage} alt="Vista previa" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
        <button
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
