import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  readBoolean,
  readNullableString,
  readNumber,
  readString,
  readStringArray,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

function productPayload(body: Record<string, unknown>) {
  const product_code = readString(body.product_code)
  const name = readString(body.name)
  const price_normal = readNumber(body.price_normal)
  const duration_days = readNumber(body.duration_days)

  if (!product_code || !name || price_normal <= 0 || duration_days <= 0) {
    throw new Error("Product code, name, price, dan duration wajib valid.")
  }

  return {
    product_code,
    name,
    price_normal,
    reseller_discount: readNumber(body.reseller_discount),
    modal: readNumber(body.modal),
    duration_days,
    description: readNullableString(body.description),
    tos_description: readNullableString(body.tos_description),
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
      template_message: readString(body.template_message) || "Email: {email}\nPassword: {password}",
      is_active: true,
    }

    const { data, error } = await adminSupabase!.from("products").insert(payload).select().single()
    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: "create",
      entity: "products",
      entityId: data.id,
      after: data,
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal menambah produk", 400)
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
    const payload =
      isActive === null
        ? productPayload(body)
        : {
            is_active: isActive,
          }

    const { data, error } = await adminSupabase!
      .from("products")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: isActive === null ? "update" : "toggle",
      entity: "products",
      entityId: id,
      before,
      after: data,
      metadata: { payload },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal update produk", 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.products.write", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const ids = readStringArray(body.ids)
    if (!ids.length) return jsonError("Product ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("products").select("*").in("id", ids)

    const { error } = await adminSupabase!.from("products").delete().in("id", ids)
    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: "delete",
      entity: "products",
      entityId: ids.join(","),
      before,
      metadata: { ids, count: ids.length },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal delete produk", 400)
  }
}
