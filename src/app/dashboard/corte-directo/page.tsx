"use client"

import { useSearchParams } from "next/navigation"
import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"
import { Suspense } from "react"

const CorteDirectoForm = dynamic(
  () => import("@/components/dashboard/corte-directo-native/CorteDirectoForm"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Loader2 className="h-6 w-6 animate-spin" />
          Cargando formulario de Corte Directo...
        </div>
      </div>
    ),
  }
)

function CorteDirectoContent() {
  const searchParams = useSearchParams()
  const ensayoIdParam = searchParams.get("ensayo_id") || searchParams.get("id")
  const editId = ensayoIdParam ? Number(ensayoIdParam) : undefined

  return <CorteDirectoForm editId={editId} />
}

export default function CorteDirectoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen w-full items-center justify-center bg-slate-100">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Loader2 className="h-6 w-6 animate-spin" />
            Cargando...
          </div>
        </div>
      }
    >
      <CorteDirectoContent />
    </Suspense>
  )
}
