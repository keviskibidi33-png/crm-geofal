import { NextRequest, NextResponse } from "next/server"

import { logAction } from "@/app/actions/audit-actions"

function resolveClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("forwarded")
  const forwardedMatch = forwarded?.match(/for=(?:"?\[?)([^;,"]+)/i)
  const forwardedIp = forwardedMatch?.[1]?.replace("]", "").trim()

  const candidateHeaders = [
    forwardedIp,
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-client-ip"),
    request.headers.get("true-client-ip"),
  ]

  const firstHeaderIp = candidateHeaders
    .find((value) => value && value.trim().length > 0)
    ?.split(",")[0]
    ?.trim()

  if (!firstHeaderIp || firstHeaderIp.toLowerCase() === "unknown") {
    return undefined
  }

  return firstHeaderIp
}

export async function POST(request: NextRequest) {
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
      ip_address: body.ip_address || resolveClientIp(request),
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
