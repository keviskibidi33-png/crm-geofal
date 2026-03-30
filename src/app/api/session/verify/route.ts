import { NextResponse } from "next/server"
import { verifySessionConsistencyAction } from "@/app/actions/verify-session"

export async function POST(request: Request) {
    const payload = await request.json().catch(() => null) as { userId?: string } | null
    const userId = typeof payload?.userId === "string" ? payload.userId : ""

    if (!userId) {
        return NextResponse.json(
            { error: "userId es requerido", isValid: false },
            { status: 400 },
        )
    }

    const result = await verifySessionConsistencyAction(userId)
    return NextResponse.json(result)
}
