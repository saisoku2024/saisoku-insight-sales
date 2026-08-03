import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  jsonRouteError,
  ownerOnly,
  readBoolean,
  readLimitedNullableString,
  readLimitedString,
  readNumberRange,
  readString,
  readStringArray,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

function productPayload(body: Record<string, unknown>) {
  const product_code = readLimitedString(body.product_code, "Product code", 64)
  const name = readLimitedString(body.name, "Nama produk", 120)
  const price_normal = readNumberRange(body.price_normal, "Harga normal", { min: 1, max: 100_000_000 })
  const duration_days = readNumberRange(body.duration_days, "Durasi", { min: 1, max: 3650 })

  if (!product_code || !name || price_normal <= 0 || duration_days <= 0) {
    throw new Error("Product code, name, price, dan duration wajib valid.")
  }

  return {
    product_code,
    name,
    price_normal,
    reseller_discount: readNumberRange(body.reseller_discount, "Diskon reseller", { min: 0, max: 100_000_000 }),
    modal: readNumberRange(body.modal, "Modal", { min: 0, max: 100_000_000 }),
    duration_days,
    description: readLimitedNullableString(body.description, "Deskripsi", 1000),
    tos_description: readLimitedNullableString(body.tos_description, "TOS", 2000),
    is_promo_active: readBoolean(body.is_promo_active) ?? false,
    promo_price: readNumberRange(body.promo_price, "Harga promo", { min: 0, max: 100_000_000 }),
    promo_price_reguler: readNumberRange(body.promo_price, "Harga promo", { min: 0, max: 100_000_000 }),
    promo_price_reseller: 0,
    promo_label: readLimitedNullableString(body.promo_label, "Label promo", 120),
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.products.write", limit: 30, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const payload = {
      ...productPayload(body),
      template_message: readLimitedString(body.template_message, "Template message", 2000) || "Email: {email}\nPassword: {password}",
      is_active: true,
    }

    const { data, error } = await adminSupabase!.from("products").insert(payload).select().single()
    if (error) return jsonRouteError(req, auth, "POST /api/admin/products insert", error, "Gagal menambah produk", 500)

    await writeAdminAuditLog(auth, {
      action: "create",
      entity: "products",
      entityId: data.id,
      after: data,
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/products", error, "Gagal menambah produk", 400)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.products.write", limit: 30, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    if (!id) return jsonError("Product ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("products").select("*").eq("id", id).maybeSingle()

    const isActive = readBoolean(body.is_active)
    const isPromoActive = readBoolean(body.is_promo_active)
    const isStatusToggle = isActive !== null && body.product_code === undefined
    const isPromoToggle = isPromoActive !== null && body.product_code === undefined && isActive === null
    const payload =
      isStatusToggle
        ? {
            is_active: isActive,
          }
        : isPromoToggle
          ? {
              is_promo_active: isPromoActive,
            }
          : productPayload(body)

    const { data, error } = await adminSupabase!
      .from("products")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonRouteError(req, auth, "PATCH /api/admin/products update", error, "Gagal update produk", 500)

    await writeAdminAuditLog(auth, {
      action: isStatusToggle ? "toggle" : isPromoToggle ? "toggle_promo" : "update",
      entity: "products",
      entityId: id,
      before,
      after: data,
      metadata: { payload },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "PATCH /api/admin/products", error, "Gagal update produk", 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const ownerError = ownerOnly(auth.role, "Hanya owner yang dapat menghapus produk.")
  if (ownerError) return ownerError
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.products.write", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const ids = readStringArray(body.ids)
    if (!ids.length) return jsonError("Product ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("products").select("*").in("id", ids)

    // Check if any product has associated transactions or pending orders
    const { count: trxCnt } = await adminSupabase!
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .in("product_id", ids)

    const { count: pendingCnt } = await adminSupabase!
      .from("pending_orders")
      .select("id", { count: "exact", head: true })
      .in("product_id", ids)

    const hasRelations = (trxCnt || 0) > 0 || (pendingCnt || 0) > 0

    if (hasRelations) {
      // Soft delete: deactivate product to preserve historical relation integrity
      const { error } = await adminSupabase!
        .from("products")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .in("id", ids)

      if (error) return jsonRouteError(req, auth, "DELETE /api/admin/products soft-delete", error, "Gagal menonaktifkan produk", 500)

      await writeAdminAuditLog(auth, {
        action: "soft_delete",
        entity: "products",
        entityId: ids.join(","),
        before,
        metadata: { ids, count: ids.length, hasRelations: true },
      })

      return NextResponse.json({
        ok: true,
        softDeleted: true,
        message: "Produk yang memiliki riwayat transaksi/order telah dinonaktifkan (soft-delete) untuk menjaga integritas data.",
      })
    }

    const { error } = await adminSupabase!.from("products").delete().in("id", ids)
    if (error) return jsonRouteError(req, auth, "DELETE /api/admin/products delete", error, "Gagal delete produk", 500)

    await writeAdminAuditLog(auth, {
      action: "delete",
      entity: "products",
      entityId: ids.join(","),
      before,
      metadata: { ids, count: ids.length, hasRelations: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonRouteError(req, auth, "DELETE /api/admin/products", error, "Gagal delete produk", 400)
  }
}
