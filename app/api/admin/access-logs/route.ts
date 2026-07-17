import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  jsonRouteError,
  readNumber,
  readString,
  requirePanelAccess,
} from "../_lib"

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null
}

function safeDecode(value: string | null) {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getClientIp(req: NextRequest) {
  return (
    firstHeaderValue(req.headers.get("cf-connecting-ip")) ||
    firstHeaderValue(req.headers.get("x-real-ip")) ||
    firstHeaderValue(req.headers.get("x-forwarded-for")) ||
    firstHeaderValue(req.headers.get("x-vercel-forwarded-for"))
  )
}

function getGeoHeaders(req: NextRequest) {
  return {
    city: safeDecode(req.headers.get("x-vercel-ip-city")),
    region: safeDecode(req.headers.get("x-vercel-ip-country-region")),
    country: safeDecode(req.headers.get("x-vercel-ip-country")),
    latitude: safeDecode(req.headers.get("x-vercel-ip-latitude")),
    longitude: safeDecode(req.headers.get("x-vercel-ip-longitude")),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePanelAccess(req)
  if (!auth.ok) return auth.response

  const page = Math.max(1, readNumber(req.nextUrl.searchParams.get("page"), 1))
  const pageSize = Math.min(50, Math.max(1, readNumber(req.nextUrl.searchParams.get("pageSize"), 10)))
  const from = (page - 1) * pageSize

  const { data, error, count } = await adminSupabase!
    .from("admin_access_logs")
    .select(
      "id, admin_email, admin_role, event_type, path, ip_address, city, region, country, user_agent, referrer, metadata, created_at",
      { count: "exact" }
    )
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
  const auth = await requirePanelAccess(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, {
    scope: "admin.access_logs.write",
    limit: 120,
    windowSeconds: 60,
  })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const eventType = readString(body.eventType) || "page_view"
    const path = readString(body.path).slice(0, 300)
    const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {}
    const geo = getGeoHeaders(req)

    const { error } = await adminSupabase!.from("admin_access_logs").insert({
      admin_email: auth.adminEmail,
      admin_role: auth.role,
      event_type: eventType,
      path,
      ip_address: getClientIp(req),
      ...geo,
      user_agent: req.headers.get("user-agent"),
      referrer: req.headers.get("referer"),
      metadata,
    })

    if (error) return jsonError(error.message, 500)

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/access-logs", error, "Gagal mencatat access log", 500)
  }
}
