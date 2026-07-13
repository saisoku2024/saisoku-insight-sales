import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  readBoolean,
  readLimitedNullableString,
  readLimitedString,
  readNumber,
  readNumberRange,
  readString,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

function loyaltyPayload(body: Record<string, unknown>) {
  const tier_name = readLimitedString(body.tier_name, "Nama tier", 80)
  const min_order = readNumberRange(body.min_order, "Min order", { min: 0, max: 1_000_000 })
  const max_order = readNumberRange(body.max_order, "Max order", { min: 0, max: 1_000_000 })
  const discount_amount = readNumberRange(body.discount_amount, "Diskon", { min: 0, max: 100_000_000 })

  if (!tier_name) {
    throw new Error("Nama tier wajib diisi.")
  }

  if (min_order < 0 || max_order < 0 || discount_amount < 0) {
    throw new Error("Min order, max order, dan diskon wajib bernilai 0 atau lebih.")
  }

  if (max_order > 0 && max_order < min_order) {
    throw new Error("Max order tidak boleh lebih kecil dari min order.")
  }

  return {
    tier_name,
    min_order,
    max_order,
    discount_amount,
    description: readLimitedNullableString(body.description, "Deskripsi", 500),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  const page = Math.max(1, readNumber(req.nextUrl.searchParams.get("page"), 1))
  const pageSize = Math.min(50, Math.max(1, readNumber(req.nextUrl.searchParams.get("pageSize"), 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const [tiersResult, activeResult] = await Promise.all([
    adminSupabase!
      .from("loyalty_settings")
      .select("id, tier_name, min_order, max_order, discount_amount, is_active, description", {
        count: "exact",
      })
      .order("min_order", { ascending: true })
      .range(from, to),
    adminSupabase!
      .from("loyalty_settings")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
  ])

  if (tiersResult.error) return jsonError(tiersResult.error.message, 500)
  if (activeResult.error) return jsonError(activeResult.error.message, 500)

  return NextResponse.json({
    data: {
      tiers: tiersResult.data || [],
      totalRows: tiersResult.count || 0,
      activeTotal: activeResult.count || 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.loyalty.write", limit: 25, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const payload = {
      ...loyaltyPayload(body),
      is_active: readBoolean(body.is_active) ?? true,
    }

    const { data, error } = await adminSupabase!
      .from("loyalty_settings")
      .insert(payload)
      .select()
      .single()

    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: "create",
      entity: "loyalty_settings",
      entityId: data.id,
      after: data,
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal menambah tier loyalty", 400)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.loyalty.write", limit: 25, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    const action = readString(body.action)
    if (!id) return jsonError("Loyalty tier ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("loyalty_settings").select("*").eq("id", id).maybeSingle()

    let payload: Record<string, unknown>

    if (action === "toggle_status") {
      const isActive = readBoolean(body.is_active)
      if (isActive === null) return jsonError("Status loyalty tier tidak valid.")
      payload = { is_active: isActive }
    } else {
      payload = {
        ...loyaltyPayload(body),
        is_active: readBoolean(body.is_active) ?? true,
      }
    }

    const { data, error } = await adminSupabase!
      .from("loyalty_settings")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: action === "toggle_status" ? "toggle" : "update",
      entity: "loyalty_settings",
      entityId: id,
      before,
      after: data,
      metadata: { action, payload },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal update tier loyalty", 400)
  }
}
