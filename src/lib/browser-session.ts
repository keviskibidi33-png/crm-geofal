const CRM_BROWSER_ID_KEY = "crm_browser_id:v1"

function generateBrowserId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }

    return `browser-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateBrowserId(): string | null {
    if (typeof window === "undefined") return null

    try {
        const existingId = window.localStorage.getItem(CRM_BROWSER_ID_KEY)
        if (existingId) return existingId

        const browserId = generateBrowserId()
        window.localStorage.setItem(CRM_BROWSER_ID_KEY, browserId)
        return browserId
    } catch {
        return null
    }
}
