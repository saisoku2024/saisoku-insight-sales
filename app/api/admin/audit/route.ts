import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  jsonError,
  readNumber,
  requirePanelAccess,
} from "../_lib"

export async function GET(req: NextRequest) {
  const auth = await requirePanelAccess(req)
  if (!auth.ok) return auth.response

  const page = Math.max(1, readNumber(req.nextUrl.searchParams.get("page"), 1))
  const pageSize = Math.min(50, Math.max(1, readNumber(req.nextUrl.searchParams.get("pageSize"), 10)))
  const from = (page - 1) * pageSize

  const { data, error, count } = await adminSupabase!
    .from("admin_audit_logs")
    .select("id, admin_email, admin_role, action, entity, entity_id, status, error, metadata, created_at", {
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
