type SessionApiResponse = {
    success?: boolean
    error?: string
    isValid?: boolean
    mismatch?: boolean
}

async function postSessionApi<T extends SessionApiResponse>(path: string, body?: Record<string, unknown>): Promise<T> {
    const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
    })

    return await response.json() as T
}

export async function deleteServerSession() {
    return await postSessionApi<SessionApiResponse>("/api/session/delete")
}

export async function verifyServerSessionConsistency(userId: string) {
    return await postSessionApi<SessionApiResponse>("/api/session/verify", { userId })
}

export async function createServerSession(userId: string, browserId?: string | null) {
    return await postSessionApi<SessionApiResponse & { code?: string; details?: unknown; reused?: boolean; reclaimed?: boolean }>(
        "/api/session/create",
        { userId, browserId: browserId || undefined },
    )
}

export async function refreshServerSession(browserId?: string | null) {
    return await postSessionApi<SessionApiResponse>(
        "/api/session/refresh",
        browserId ? { browserId } : undefined,
    )
}
