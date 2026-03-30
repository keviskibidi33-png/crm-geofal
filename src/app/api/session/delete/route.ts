import { NextResponse } from "next/server"
import { deleteSessionAction } from "@/app/actions/auth-actions"

export async function POST() {
    const result = await deleteSessionAction()
    return NextResponse.json(result)
}
