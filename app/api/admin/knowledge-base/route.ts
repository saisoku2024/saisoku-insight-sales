import { NextResponse, type NextRequest } from "next/server"
import {
  requirePanelAccess,
  requireActiveAdmin,
  jsonError,
  jsonRouteError,
  readString,
  readNumber,
  adminSupabase,
  writeAdminAuditLog,
} from "../_lib"

export async function GET(req: NextRequest) {
  const auth = await requirePanelAccess(req)
  if (!auth.ok) return auth.response

  try {
    const { searchParams } = req.nextUrl
    const page = readNumber(searchParams.get("page"), 1)
    const pageSize = readNumber(searchParams.get("pageSize"), 10)
    const search = readString(searchParams.get("search"))
    const category = readString(searchParams.get("category"))
    const status = readString(searchParams.get("status"))

    if (!adminSupabase) {
      return jsonError("Konfigurasi Supabase server tidak lengkap.", 500)
    }

    let query = adminSupabase
      .from("knowledge_base")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      // If table does not exist yet in Supabase, return empty array with 0 total gracefully
      if (error.code === "42P01") {
        return NextResponse.json({
          data: [],
          total: 0,
          page,
          pageSize,
          hasMore: false,
        })
      }
      throw error
    }

    return NextResponse.json({
      data: data || [],
      total: count || 0,
      page,
      pageSize,
      hasMore: (count || 0) > page * pageSize,
    })
  } catch (error) {
    return jsonRouteError(
      req,
      auth,
      "GET /api/admin/knowledge-base",
      error,
      "Gagal mengambil data knowledge base"
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const title = readString(body.title)
    const category = readString(body.category) || "General"
    const content = readString(body.content)
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : []
    const source_file = readString(body.source_file) || null

    if (!title) {
      return jsonError("Judul dokumen/data wajib diisi.")
    }
    if (!content) {
      return jsonError("Isi dokumen/konten wajib diisi.")
    }

    if (!adminSupabase) {
      return jsonError("Konfigurasi Supabase server tidak lengkap.", 500)
    }

    const newRecord = {
      title,
      category,
      content,
      tags,
      source_file,
      status: "active",
      created_by: auth.adminEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await adminSupabase
      .from("knowledge_base")
      .insert(newRecord)
      .select()
      .single()

    if (error) throw error

    await writeAdminAuditLog(auth, {
      action: "create_knowledge_base",
      entity: "knowledge_base",
      entityId: data.id,
      after: data,
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(
      req,
      auth,
      "POST /api/admin/knowledge-base",
      error,
      "Gagal menambahkan data knowledge base"
    )
  }
}
