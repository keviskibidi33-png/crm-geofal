import { ProgramacionServicio } from "@/types/programacion"

const API_BASE_URL = "https://api.geofal.com.pe/v1"

class ProgramacionApiError extends Error {
    constructor(public message: string, public status: number) {
        super(message)
    }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    // In a real app, retrieve token from Supabase auth or storage
    const token = "mock-token-for-now"

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...options.headers,
        },
    })

    if (!res.ok) {
        throw new ProgramacionApiError(`API Error: ${res.statusText}`, res.status)
    }

    return res.json()
}

export const externalApi = {
    /**
     * Update status with business logic side-effects
     */
    updateEstado: async (id: string, newEstado: string, userId: string) => {
        return fetchWithAuth(`/programacion/${id}/estado`, {
            method: "PATCH",
            body: JSON.stringify({ estado: newEstado, userId }),
        })
    },

    /**
     * Close a period (complex logic)
     */
    closePeriodo: async (periodoId: string) => {
        return fetchWithAuth(`/periodos/${periodoId}/cerrar`, {
            method: "POST",
        })
    },

    /**
     * Validate a specific workflow transition
     */
    validateTramite: async (id: string, action: string) => {
        return fetchWithAuth(`/programacion/${id}/validate`, {
            method: "POST",
            body: JSON.stringify({ action }),
        })
    }
}
