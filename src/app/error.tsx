'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error('CRITICAL UI ERROR:', error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-4">
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Algo salió mal</h1>
                    <p className="text-zinc-500 text-sm">
                        Ha ocurrido un error inesperado en la interfaz. Hemos registrado el incidente para solucionarlo.
                    </p>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                    <Button
                        onClick={() => reset()}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-11"
                    >
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Reintentar cargar
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/'}
                        className="w-full h-11 font-semibold"
                    >
                        Volver al inicio
                    </Button>
                </div>

                {error.digest && (
                    <p className="text-[10px] text-zinc-400 font-mono">ID: {error.digest}</p>
                )}
            </div>
        </div>
    )
}
