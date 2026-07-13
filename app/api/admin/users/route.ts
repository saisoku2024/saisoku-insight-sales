import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  readBoolean,
  readNullableString,
  readString,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

const allowedRoles = new Set(["owner", "admin", "reseller", "reguler"])

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.users.write", limit: 25, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    const action = readString(body.action)

    if (!id) return jsonError("User ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("users").select("*").eq("id", id).maybeSingle()

    let payload: Record<string, unknown>

    if (action === "toggle_status") {
      const isActive = readBoolean(body.is_active)
      if (isActive === null) return jsonError("Status user tidak valid.")
      payload = { is_active: isActive }
    } else if (action === "soft_delete") {
      payload = { deleted_at: new Date().toISOString() }
    } else {
      const role = readString(body.role)
      if (role && !allowedRoles.has(role)) {
        return jsonError("Role tidak valid.")
      }

      payload = {
        email: readNullableString(body.email),
        name: readNullableString(body.name),
        whatsapp: readNullableString(body.whatsapp),
        role: role || "reguler",
      }
    }

    const { data, error } = await adminSupabase!
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: action === "toggle_status" ? "toggle" : action === "soft_delete" ? "delete" : "update",
      entity: "users",
      entityId: id,
      before,
      after: data,
      metadata: { action, payload },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal update user", 400)
  }
}
