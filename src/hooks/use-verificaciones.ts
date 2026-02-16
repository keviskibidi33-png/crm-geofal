import { useState, useCallback } from "react"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "sonner"
import { authFetch } from "@/lib/api-auth"

export interface VerificacionMuestra {
    id: number
    numero_verificacion: string
    codigo_documento: string
    version: string
    fecha_documento: string
    pagina: string
    verificado_por?: string
    fecha_verificacion?: string
    cliente?: string
    fecha_creacion: string
    archivo_excel?: string
    muestras_verificadas: any[]
}

export function useVerificaciones() {
    const { user } = useAuth()
    const [verificaciones, setVerificaciones] = useState<VerificacionMuestra[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

    const fetchVerificaciones = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await authFetch(`${API_URL}/api/verificacion/`, {
                method: "GET",
            })
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.detail || `Error fetching verificaciones: ${res.status}`)
            }
            const data = await res.json()
            setVerificaciones(data)
        } catch (err: any) {
            console.error(err)
            setError(err.message)
            // toast.error("Error cargando verificaciones") // Optional: show toast on error
        } finally {
            setLoading(false)
        }
    }, [API_URL])

    const deleteVerificacion = async (id: number) => {
        try {
            const res = await authFetch(`${API_URL}/api/verificacion/${id}`, {
                method: 'DELETE'
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.detail || "Failed to delete")
            }
            await fetchVerificaciones()
            return true
        } catch (e: any) {
            console.error(e)
            toast.error(e.message || "Error al eliminar")
            return false
        }
    }

    const fetchVerificacion = useCallback(async (id: number) => {
        try {
            const res = await authFetch(`${API_URL}/api/verificacion/${id}`, {
                method: "GET",
            })
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.detail || `Error fetching verificacion: ${res.status}`)
            }
            return await res.json()
        } catch (err: any) {
            console.error(err)
            toast.error(err.message || "Error cargando detalle")
            return null
        }
    }, [API_URL])

    return {
        verificaciones,
        loading,
        error,
        fetchVerificaciones,
        fetchVerificacion,
        deleteVerificacion
    }
}
