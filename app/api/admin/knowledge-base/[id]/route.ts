import { NextResponse, type NextRequest } from "next/server"
import {
  requireActiveAdmin,
  jsonError,
  jsonRouteError,
  readString,
  adminSupabase,
  writeAdminAuditLog,
} from "../../_lib"

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    if (!id) {
      return jsonError("ID Knowledge Base wajib diisi.")
    }

    if (!adminSupabase) {
      return jsonError("Konfigurasi Supabase server tidak lengkap.", 500)
    }

    // Fetch existing record before deletion for audit
    const { data: existing } = await adminSupabase
      .from("knowledge_base")
      .select("*")
      .eq("id", id)
      .single()

    const { error } = await adminSupabase
      .from("knowledge_base")
      .delete()
      .eq("id", id)

    if (error) throw error

    await writeAdminAuditLog(auth, {
      action: "delete_knowledge_base",
      entity: "knowledge_base",
      entityId: id,
      before: existing,
    })

    return NextResponse.json({ success: true, id })
  } catch (error) {
    return jsonRouteError(
      req,
      auth,
      "DELETE /api/admin/knowledge-base/[id]",
      error,
      "Gagal menghapus data knowledge base"
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    if (!id) {
      return jsonError("ID Knowledge Base wajib diisi.")
    }

    const body = await req.json()
    const title = readString(body.title)
    const category = readString(body.category)
    const content = readString(body.content)
    const status = readString(body.status) || "active"
    const tags = Array.isArray(body.tags) ? body.tags.map(String) : []
    const source_file = readString(body.source_file) || null

    if (!title || !content) {
      return jsonError("Judul dan isi konten wajib diisi.")
    }

    if (!adminSupabase) {
      return jsonError("Konfigurasi Supabase server tidak lengkap.", 500)
    }

    const updates = {
      title,
      category,
      content,
      status,
      tags,
      source_file,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await adminSupabase
      .from("knowledge_base")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    await writeAdminAuditLog(auth, {
      action: "update_knowledge_base",
      entity: "knowledge_base",
      entityId: id,
      after: data,
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(
      req,
      auth,
      "PUT /api/admin/knowledge-base/[id]",
      error,
      "Gagal mengupdate data knowledge base"
    )
  }
}
