import { NextResponse } from "next/server"
import { createSessionAction } from "@/app/actions/auth-actions"

export async function POST(request: Request) {
    const payload = await request.json().catch(() => null) as { userId?: string; browserId?: string } | null
    const userId = typeof payload?.userId === "string" ? payload.userId : ""
    const browserId = typeof payload?.browserId === "string" ? payload.browserId : undefined

    if (!userId) {
        return NextResponse.json(
            { error: "userId es requerido" },
            { status: 400 },
        )
    }

    const result = await createSessionAction(userId, browserId)
    return NextResponse.json(result)
}
