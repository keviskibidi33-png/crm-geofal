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
    const headers = await buildAuthHeaders(init.headers)

    if (init.body instanceof FormData) {
        headers.delete("Content-Type")
    }

    return fetch(input, {
        ...init,
        headers,
    })
}
