import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  readNullableString,
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

function stockPayload(body: Record<string, unknown>): StockInput {
  const product_id = readString(body.product_id)
  const email = readString(body.email)

  if (!product_id || !email) {
    throw new Error("Product dan email/no HP wajib diisi.")
  }

  return {
    product_id,
    email,
    password: readNullableString(body.password),
    profile: readNullableString(body.profile),
    pin: readNullableString(body.pin),
    status: readString(body.status) || "available",
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

    if (rows.length > 1000) {
      return jsonError("Bulk upload maksimal 1000 row per request.")
    }

    const { data, error } = await adminSupabase!.from("product_accounts").insert(rows).select()
    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: rows.length > 1 ? "bulk_create" : "create",
      entity: "product_accounts",
      entityId: rows.length === 1 ? data?.[0]?.id : null,
      after: data,
      metadata: { count: rows.length },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal menambah stock", 400)
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.stocks.write", limit: 30, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    if (!id) return jsonError("Stock ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("product_accounts").select("*").eq("id", id).maybeSingle()

    const payload = {
      email: readString(body.email),
      password: readNullableString(body.password),
      profile: readNullableString(body.profile),
      pin: readNullableString(body.pin),
    }

    if (!payload.email) return jsonError("Email/no HP wajib diisi.")

    const { data, error } = await adminSupabase!
      .from("product_accounts")
      .update(payload)
      .eq("id", id)
      .select()
      .single()

    if (error) return jsonError(error.message, 500)

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
    return jsonError(error instanceof Error ? error.message : "Gagal update stock", 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.stocks.write", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const id = readString(body.id)
    if (!id) return jsonError("Stock ID wajib diisi.")

    const { data: before } = await adminSupabase!.from("product_accounts").select("*").eq("id", id).maybeSingle()

    const { error } = await adminSupabase!.from("product_accounts").delete().eq("id", id)
    if (error) return jsonError(error.message, 500)

    await writeAdminAuditLog(auth, {
      action: "delete",
      entity: "product_accounts",
      entityId: id,
      before,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal delete stock", 400)
  }
}
