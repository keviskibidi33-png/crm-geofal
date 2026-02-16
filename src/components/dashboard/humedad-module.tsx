"use client"

import { useState, useEffect } from "react"
import { Plus, Droplets } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabaseClient"

export function HumedadModule() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const [token, setToken] = useState<string | null>(null)

    const FRONTEND_URL = process.env.NEXT_PUBLIC_HUMEDAD_FRONTEND_URL || "http://127.0.0.1:3008"

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) setToken(session.access_token)
        }
        getSession()
    }, [])

    // Listen for close message from iframe
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'CLOSE_MODAL') {
                setIsModalOpen(false)
            }
            if (event.data?.type === 'TOKEN_REFRESH_REQUEST' && event.source) {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session && event.source) {
                        (event.source as Window).postMessage(
                            { type: 'TOKEN_REFRESH', token: session.access_token },
                            '*'
                        )
                    }
                })
            }
        }
        window.addEventListener('message', handleMessage)
        return () => window.removeEventListener('message', handleMessage)
    }, [])

    const openNewEnsayo = () => {
        setRefreshKey(prev => prev + 1)
        setIsModalOpen(true)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Droplets className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Contenido de Humedad</h2>
                        <p className="text-muted-foreground">ASTM D2216-19 — Generador de Informes</p>
                    </div>
                </div>
                <Button onClick={openNewEnsayo} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Nuevo Ensayo
                </Button>
            </div>

            {/* Placeholder content when no modal is open */}
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-lg">
                <Droplets className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">Módulo de Humedad</p>
                <p className="text-sm">
                    Haz clic en &quot;Nuevo Ensayo&quot; para generar un informe Excel de contenido de humedad.
                </p>
            </div>

            {/* Iframe modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 overflow-hidden bg-background [&>button]:hidden">
                    <DialogHeader className="hidden">
                        <DialogTitle>Ensayo de Humedad</DialogTitle>
                        <DialogDescription>Formulario de contenido de humedad ASTM D2216</DialogDescription>
                    </DialogHeader>
                    <iframe
                        key={refreshKey}
                        src={`${FRONTEND_URL}/?token=${token || ''}&v=${new Date().getTime()}`}
                        className="w-full h-full border-none"
                        title="Humedad CRM"
                    />
                </DialogContent>
            </Dialog>
        </div>
    )
}
