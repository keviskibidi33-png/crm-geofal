import { supabase } from "@/lib/supabaseClient"

export async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
}

export async function buildAuthHeaders(extraHeaders: HeadersInit = {}): Promise<Headers> {
    const token = await getAccessToken()

    const headers = new Headers(extraHeaders)

    if (token) {
        headers.set("Authorization", `Bearer ${token}`)
    }

    if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json")
    }

    return headers
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    let finalInput = input
    if (typeof finalInput === "string") {
        if (finalInput.startsWith("http://api.geofal.com.pe")) {
            finalInput = finalInput.replace("http://api.geofal.com.pe", "https://api.geofal.com.pe")
        }
    } else if (finalInput instanceof URL) {
        if (finalInput.href.startsWith("http://api.geofal.com.pe")) {
            finalInput = new URL(finalInput.href.replace("http://api.geofal.com.pe", "https://api.geofal.com.pe"))
        }
    }

    const headers = await buildAuthHeaders(init.headers)

    if (init.body instanceof FormData) {
        headers.delete("Content-Type")
    }

    return fetch(finalInput, {
        ...init,
        headers,
    })
}
