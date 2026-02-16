import { NextResponse } from "next/server"

import { logAction } from "@/app/actions/audit-actions"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body?.action || typeof body.action !== "string") {
      return NextResponse.json({ error: "Acción de auditoría inválida" }, { status: 400 })
    }

    const result = await logAction({
      user_id: body.user_id,
      user_name: body.user_name,
      action: body.action,
      module: body.module,
      details: body.details,
      ip_address: body.ip_address,
      severity: body.severity,
    })

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Error interno al registrar auditoría" },
      { status: 500 }
    )
  }
}
