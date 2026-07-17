import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  readLimitedNullableString,
  readLimitedString,
  readNumber,
  requireActiveAdmin,
  requirePanelAccess,
  writeErrorLog,
} from "../_lib"

export async function GET(req: NextRequest) {
  const auth = await requirePanelAccess(req)
  if (!auth.ok) return auth.response

  const page = Math.max(1, readNumber(req.nextUrl.searchParams.get("page"), 1))
  const pageSize = Math.min(50, Math.max(1, readNumber(req.nextUrl.searchParams.get("pageSize"), 10)))
  const from = (page - 1) * pageSize

  const { data, error, count } = await adminSupabase!
    .from("error_logs")
    .select("id, source, level, message, route, actor, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) return jsonError(error.message, 500)

  return NextResponse.json({
    data: {
      logs: data || [],
      totalRows: count || 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.error_logs.write", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const level = readLimitedString(body.level, "Level", 20)
    const safeLevel = level === "warn" || level === "info" ? level : "error"

    await writeErrorLog({
      source: readLimitedString(body.source, "Source", 120) || "web-client",
      level: safeLevel,
      message: readLimitedString(body.message, "Message", 500),
      stack: readLimitedNullableString(body.stack, "Stack", 2000),
      route: readLimitedNullableString(body.route, "Route", 240),
      actor: auth.adminEmail,
      metadata: { clientReported: true },
    })

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal mencatat error log.", 400)
  }
}
