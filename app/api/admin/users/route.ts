import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  jsonError,
  readBoolean,
  readNullableString,
  readString,
  requireActiveAdmin,
} from "../_lib"

const allowedRoles = new Set(["owner", "admin", "reseller", "reguler"])

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    const action = readString(body.action)

    if (!id) return jsonError("User ID wajib diisi.")

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

    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal update user", 400)
  }
}
