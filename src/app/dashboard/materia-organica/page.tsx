"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function MateriaOrganicaContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get("ensayo_id") || searchParams.get("id")
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
      <h1 className="text-2xl font-bold text-slate-800">Materia Organica Form</h1>
      <p className="text-slate-500 mt-2">ID del ensayo: {id || "Nuevo"}</p>
    </div>
  )
}

export default function MateriaOrganicaPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center">Cargando...</div>}>
      <MateriaOrganicaContent />
    </Suspense>
  )
}
