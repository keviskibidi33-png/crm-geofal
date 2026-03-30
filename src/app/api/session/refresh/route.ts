import { NextResponse } from "next/server"
import { refreshSessionAction } from "@/app/actions/auth-actions"

export async function POST(request: Request) {
    const payload = await request.json().catch(() => null) as { browserId?: string } | null
    const browserId = typeof payload?.browserId === "string" ? payload.browserId : undefined
    const result = await refreshSessionAction(browserId)
    return NextResponse.json(result)
}
