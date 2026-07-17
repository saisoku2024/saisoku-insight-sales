import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  jsonRouteError,
  readBoolean,
  readLimitedNullableString,
  readLimitedString,
  readNumber,
  readNumberRange,
  readString,
  requireActiveAdmin,
  requirePanelAccess,
  writeAdminAuditLog,
} from "../_lib"

const allowedTargetRoles = new Set(["reguler", "reseller", "both"])

function normalizeCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase()
}

function voucherPayload(body: Record<string, unknown>) {
  const code = normalizeCode(readLimitedString(body.code, "Kode voucher", 40))
  const reward_amount = readNumberRange(body.reward_amount, "Nominal voucher", { min: 1, max: 100_000_000 })
  const quota = readNumberRange(body.quota, "Kuota voucher", { min: 1, max: 100_000 })
  const target_role = readString(body.target_role) || "both"

  if (!code) throw new Error("Kode voucher wajib diisi.")
  if (!/^[A-Z0-9_-]+$/.test(code)) throw new Error("Kode voucher hanya boleh huruf, angka, underscore, atau strip.")
  if (!allowedTargetRoles.has(target_role)) throw new Error("Target role voucher tidak valid.")

  return {
    code,
    reward_type: "balance_add",
    reward_amount,
    quota,
    target_role,
    expired_at: readLimitedNullableString(body.expired_at, "Expired at", 80),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePanelAccess(req)
  if (!auth.ok) return auth.response

  const page = Math.max(1, readNumber(req.nextUrl.searchParams.get("page"), 1))
  const pageSize = Math.min(50, Math.max(1, readNumber(req.nextUrl.searchParams.get("pageSize"), 10)))
  const from = (page - 1) * pageSize

  const [voucherResult, activeResult, claimResult] = await Promise.all([
    adminSupabase!
      .from("vouchers")
      .select("id, code, reward_type, reward_amount, quota, used_count, is_active, expired_at, target_role", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1),
    adminSupabase!
      .from("vouchers")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    adminSupabase!
      .from("voucher_claims")
      .select("id", { count: "exact", head: true }),
  ])

  if (voucherResult.error) return jsonError(voucherResult.error.message, 500)
  if (activeResult.error) return jsonError(activeResult.error.message, 500)
  if (claimResult.error) return jsonError(claimResult.error.message, 500)

  return NextResponse.json({
    data: {
      vouchers: voucherResult.data || [],
      totalRows: voucherResult.count || 0,
      activeTotal: activeResult.count || 0,
      claimCount: claimResult.count || 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.vouchers.write", limit: 25, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const payload = {
      ...voucherPayload(body),
      used_count: 0,
      is_active: readBoolean(body.is_active) ?? true,
    }

    const { data, error } = await adminSupabase!.from("vouchers").insert(payload).select().single()
    if (error) return jsonRouteError(req, auth, "POST /api/admin/vouchers insert", error, "Gagal menambah voucher", 500)

    await writeAdminAuditLog(auth, {
      action: "create",
      entity: "vouchers",
      entityId: data.id,
      after: data,
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/vouchers", error, "Gagal menambah voucher", 400)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.vouchers.write", limit: 25, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    const action = readString(body.action)
    if (!id) return jsonError("Voucher ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("vouchers").select("*").eq("id", id).maybeSingle()

    let payload: Record<string, unknown>
    if (action === "toggle_status") {
      const isActive = readBoolean(body.is_active)
      if (isActive === null) return jsonError("Status voucher tidak valid.")
      payload = { is_active: isActive }
    } else {
      payload = {
        ...voucherPayload(body),
        is_active: readBoolean(body.is_active) ?? true,
      }
    }

    const { data, error } = await adminSupabase!
      .from("vouchers")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonRouteError(req, auth, "PATCH /api/admin/vouchers update", error, "Gagal update voucher", 500)

    await writeAdminAuditLog(auth, {
      action: action === "toggle_status" ? "toggle" : "update",
      entity: "vouchers",
      entityId: id,
      before,
      after: data,
      metadata: { action, payload },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "PATCH /api/admin/vouchers", error, "Gagal update voucher", 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  if (auth.role !== "owner") return jsonError("Hanya owner yang dapat menghapus voucher.", 403)
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.vouchers.write", limit: 15, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    if (!id) return jsonError("Voucher ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("vouchers").select("*").eq("id", id).maybeSingle()

    const { error } = await adminSupabase!.from("vouchers").delete().eq("id", id)
    if (error) return jsonRouteError(req, auth, "DELETE /api/admin/vouchers delete", error, "Gagal hapus voucher", 500)

    await writeAdminAuditLog(auth, {
      action: "delete",
      entity: "vouchers",
      entityId: id,
      before,
    })

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    return jsonRouteError(req, auth, "DELETE /api/admin/vouchers", error, "Gagal hapus voucher", 400)
  }
}
