import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  jsonRouteError,
  ownerOnly,
  readBoolean,
  readLimitedNullableString,
  readString,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

const allowedRoles = new Set(["owner", "admin", "reseller", "reguler"])

async function deleteUserAction(
  req: NextRequest,
  auth: { adminEmail: string; role: "owner" | "admin" },
  id: string
) {
  const ownerError = ownerOnly(auth.role, "Hanya owner yang dapat menghapus user.")
  if (ownerError) return ownerError

  const { data: before, error: findErr } = await adminSupabase!
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (findErr) {
    return jsonRouteError(req, auth, "DELETE /api/admin/users find", findErr, "Gagal mengambil data user", 500)
  }
  if (!before) {
    return jsonError("User tidak ditemukan.", 404)
  }

  if (before.email && before.email.toLowerCase() === auth.adminEmail.toLowerCase()) {
    return jsonError("Anda tidak dapat menghapus akun Anda sendiri.", 400)
  }

  // Check if user has related records that prevent physical deletion
  const [
    { count: trxCnt },
    { count: pendingCnt },
    { count: depositCnt },
    { count: balanceCnt },
    { count: ticketCnt },
    { count: voucherCnt },
  ] = await Promise.all([
    adminSupabase!.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", id),
    adminSupabase!.from("pending_orders").select("id", { count: "exact", head: true }).eq("user_id", id),
    adminSupabase!.from("deposit_requests").select("id", { count: "exact", head: true }).eq("user_id", id),
    adminSupabase!.from("balance_logs").select("id", { count: "exact", head: true }).eq("user_id", id),
    adminSupabase!.from("tickets").select("id", { count: "exact", head: true }).eq("user_id", id),
    adminSupabase!.from("voucher_claims").select("id", { count: "exact", head: true }).eq("user_id", id),
  ])

  const hasRelations =
    (trxCnt || 0) > 0 ||
    (pendingCnt || 0) > 0 ||
    (depositCnt || 0) > 0 ||
    (balanceCnt || 0) > 0 ||
    (ticketCnt || 0) > 0 ||
    (voucherCnt || 0) > 0

  if (hasRelations) {
    // Soft delete: deactivate user to preserve historical relation integrity
    const { data: after, error: updateErr } = await adminSupabase!
      .from("users")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single()

    if (updateErr) {
      return jsonRouteError(req, auth, "DELETE /api/admin/users soft-delete", updateErr, "Gagal menonaktifkan user", 500)
    }

    await writeAdminAuditLog(auth, {
      action: "soft_delete",
      entity: "users",
      entityId: id,
      before,
      after,
      metadata: { id, hasRelations: true },
    })

    return NextResponse.json({
      ok: true,
      data: after,
      softDeleted: true,
      message: "User yang memiliki riwayat transaksi/order telah dinonaktifkan (soft-delete) untuk menjaga integritas data.",
    })
  }

  // Clean up auxiliary records without FK constraints if any
  await Promise.all([
    adminSupabase!.from("users_profile").delete().eq("user_id", id),
    adminSupabase!.from("user_states").delete().eq("user_id", id),
  ])

  const { error: deleteErr } = await adminSupabase!.from("users").delete().eq("id", id)

  if (deleteErr) {
    // Fallback to soft delete if unexpected database error occurred
    const { data: after } = await adminSupabase!
      .from("users")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single()

    await writeAdminAuditLog(auth, {
      action: "soft_delete",
      entity: "users",
      entityId: id,
      before,
      after,
      metadata: { id, fallback: true, error: deleteErr.message },
    })

    return NextResponse.json({
      ok: true,
      data: after,
      softDeleted: true,
      message: "User telah dinonaktifkan (soft-delete).",
    })
  }

  await writeAdminAuditLog(auth, {
    action: "delete",
    entity: "users",
    entityId: id,
    before,
    metadata: { id, hasRelations: false },
  })

  return NextResponse.json({ ok: true, data: { id } })
}

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

    if (action === "soft_delete" || action === "delete") {
      return await deleteUserAction(req, auth, id)
    }

    const { data: before } = await adminSupabase!.from("users").select("*").eq("id", id).maybeSingle()

    let payload: Record<string, unknown>

    if (action === "toggle_status") {
      const isActive = readBoolean(body.is_active)
      if (isActive === null) return jsonError("Status user tidak valid.")
      payload = { is_active: isActive }
    } else {
      const role = readString(body.role)
      if (role && !allowedRoles.has(role)) {
        return jsonError("Role tidak valid.")
      }
      if (["owner", "admin"].includes(role) && auth.role !== "owner") {
        return jsonError("Hanya owner yang dapat memberi role owner/admin.", 403)
      }

      payload = {
        email: readLimitedNullableString(body.email, "Email", 256),
        name: readLimitedNullableString(body.name, "Nama", 120),
        whatsapp: readLimitedNullableString(body.whatsapp, "WhatsApp", 40),
        role: role || "reguler",
      }
    }

    const { data, error } = await adminSupabase!
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonRouteError(req, auth, "PATCH /api/admin/users update", error, "Gagal update user", 500)

    await writeAdminAuditLog(auth, {
      action: action === "toggle_status" ? "toggle" : "update",
      entity: "users",
      entityId: id,
      before,
      after: data,
      metadata: { action, payload },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "PATCH /api/admin/users", error, "Gagal update user", 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.users.write", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const id = readString(body.id) || readString(req.nextUrl.searchParams.get("id"))

    if (!id) return jsonError("User ID wajib diisi.")

    return await deleteUserAction(req, auth, id)
  } catch (error) {
    return jsonRouteError(req, auth, "DELETE /api/admin/users", error, "Gagal delete user", 400)
  }
}

