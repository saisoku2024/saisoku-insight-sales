import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  jsonRouteError,
  ownerOnly,
  readLimitedNullableString,
  readLimitedString,
  readString,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

type StockInput = {
  product_id: string
  email: string
  password: string | null
  profile: string | null
  pin: string | null
  status?: string
}

const allowedStockStatuses = new Set(["available", "sold", "reserved", "inactive", "deleted"])

function stockPayload(body: Record<string, unknown>): StockInput {
  const product_id = readLimitedString(body.product_id, "Product ID", 80)
  const email = readLimitedString(body.email, "Email/no HP", 256)
  const status = readLimitedString(body.status, "Status", 32) || "available"

  if (!product_id || !email) {
    throw new Error("Product dan email/no HP wajib diisi.")
  }
  if (!allowedStockStatuses.has(status)) {
    throw new Error("Status stock tidak valid.")
  }

  return {
    product_id,
    email,
    password: readLimitedNullableString(body.password, "Password", 256),
    profile: readLimitedNullableString(body.profile, "Profile", 120),
    pin: readLimitedNullableString(body.pin, "PIN", 64),
    status,
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.stocks.write", limit: 12, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const rows = Array.isArray(body.items)
      ? body.items.map((item) => stockPayload((item || {}) as Record<string, unknown>))
      : [stockPayload(body)]

    if (rows.length > 500) {
      return jsonError("Bulk upload maksimal 500 row per request.")
    }

    let insertedNew = 0
    let insertedExpired = 0
    let skippedAvailable = 0
    let skippedActive = 0

    for (const row of rows) {
      const { data: status, error } = await adminSupabase!.rpc("insert_product_stock", {
        p_product_id: row.product_id,
        p_email: row.email,
        p_password: row.password,
        p_pin: row.pin,
        p_profile: row.profile
      })

      if (error) {
        return jsonRouteError(req, auth, "POST /api/admin/stocks insert", error, "Gagal menambah stock", 500)
      }

      switch (status) {
        case "INSERTED_NEW":
          insertedNew++
          break
        case "INSERTED_EXPIRED":
          insertedExpired++
          break
        case "SKIPPED_AVAILABLE":
          skippedAvailable++
          break
        case "SKIPPED_ACTIVE":
          skippedActive++
          break
      }
    }

    // Jika upload tunggal dan duplikat, beri tahu user secara spesifik
    if (rows.length === 1) {
      if (skippedAvailable > 0) {
        return jsonError("Akun/stok ini sudah terdaftar dan siap dijual (duplikat).", 400)
      }
      if (skippedActive > 0) {
        return jsonError("Akun/stok ini sedang digunakan oleh pembeli aktif (duplikat).", 400)
      }
    }

    await writeAdminAuditLog(auth, {
      action: rows.length > 1 ? "bulk_create" : "create",
      entity: "product_accounts",
      entityId: null,
      after: { insertedNew, insertedExpired, skippedAvailable, skippedActive },
      metadata: { count: rows.length, insertedNew, insertedExpired, skippedAvailable, skippedActive },
    })

    return NextResponse.json({
      data: {
        success: true,
        count: rows.length,
        insertedNew,
        insertedExpired,
        skippedAvailable,
        skippedActive,
      }
    })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/stocks", error, "Gagal menambah stock", 400)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.stocks.write", limit: 30, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>

    if (Array.isArray(body.items)) {
      const items = body.items as Array<Record<string, unknown>>
      if (items.length > 500) {
        return jsonError("Bulk update maksimal 500 row per request.")
      }

      let updatedCount = 0
      let notFoundCount = 0

      for (const item of items) {
        const email = readLimitedString(item.email, "Email/no HP", 256)
        if (!email) continue

        const productId = readLimitedNullableString(item.product_id, "Product ID", 80)
        const password = readLimitedNullableString(item.password, "Password", 256)
        const profile = readLimitedNullableString(item.profile, "Profile", 120)
        const pin = readLimitedNullableString(item.pin, "PIN", 64)
        const nextStatus = readLimitedNullableString(item.status, "Status", 32)

        const payload: Record<string, unknown> = {
          email,
          password,
          profile,
          pin,
          ...(nextStatus && allowedStockStatuses.has(nextStatus) ? { status: nextStatus } : {}),
        }

        let query = adminSupabase!.from("product_accounts").update(payload).eq("email", email)
        if (productId) {
          query = query.eq("product_id", productId)
        }

        const { data: updatedRows, error } = await query.select()

        if (error) {
          return jsonRouteError(req, auth, "PATCH /api/admin/stocks bulk update", error, "Gagal bulk update stock", 500)
        }

        if (updatedRows && updatedRows.length > 0) {
          updatedCount += updatedRows.length
        } else {
          notFoundCount++
        }
      }

      await writeAdminAuditLog(auth, {
        action: "bulk_update",
        entity: "product_accounts",
        entityId: null,
        after: { updatedCount, notFoundCount },
        metadata: { count: items.length, updatedCount, notFoundCount },
      })

      return NextResponse.json({
        data: {
          success: true,
          count: items.length,
          updatedCount,
          notFoundCount,
        }
      })
    }

    const id = readString(body.id)
    if (!id) return jsonError("Stock ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("product_accounts").select("*").eq("id", id).maybeSingle()

    const nextStatus = readLimitedString(body.status, "Status", 32)
    if (nextStatus && !allowedStockStatuses.has(nextStatus)) {
      return jsonError("Status stock tidak valid.")
    }

    const payload = {
      email: readLimitedString(body.email, "Email/no HP", 256),
      password: readLimitedNullableString(body.password, "Password", 256),
      profile: readLimitedNullableString(body.profile, "Profile", 120),
      pin: readLimitedNullableString(body.pin, "PIN", 64),
      ...(nextStatus ? { status: nextStatus } : {}),
    }

    if (!payload.email) return jsonError("Email/no HP wajib diisi.")

    const { data, error } = await adminSupabase!
      .from("product_accounts")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonRouteError(req, auth, "PATCH /api/admin/stocks update", error, "Gagal update stock", 500)

    await writeAdminAuditLog(auth, {
      action: "update",
      entity: "product_accounts",
      entityId: id,
      before,
      after: data,
      metadata: { payload },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "PATCH /api/admin/stocks", error, "Gagal update stock", 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const ownerError = ownerOnly(auth.role, "Hanya owner yang dapat menghapus stock.")
  if (ownerError) return ownerError
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.stocks.write", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const ids = Array.isArray(body.ids)
      ? body.ids.map((value) => readString(value)).filter(Boolean)
      : [readString(body.id)].filter(Boolean)

    if (!ids.length) return jsonError("Stock ID wajib diisi.")
    if (ids.length > 100) return jsonError("Bulk delete maksimal 100 stock per request.")

    const { data: before } = await adminSupabase!.from("product_accounts").select("*").in("id", ids)

    const { data, error } = await adminSupabase!
      .from("product_accounts")
      .update({ status: "deleted" })
      .in("id", ids)
      .select()

    if (error) return jsonRouteError(req, auth, "DELETE /api/admin/stocks soft delete", error, "Gagal delete stock", 500)

    await writeAdminAuditLog(auth, {
      action: ids.length > 1 ? "bulk_soft_delete" : "soft_delete",
      entity: "product_accounts",
      entityId: ids.length === 1 ? ids[0] : null,
      before,
      after: data,
      metadata: { count: ids.length, ids },
    })

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    return jsonRouteError(req, auth, "DELETE /api/admin/stocks", error, "Gagal delete stock", 400)
  }
}
