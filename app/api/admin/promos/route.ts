import { NextResponse, type NextRequest } from "next/server"
import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  jsonRouteError,
  requireActiveAdmin,
  writeAdminAuditLog,
  readLimitedString,
  readLimitedNullableString,
} from "../_lib"

export async function GET(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  try {
    // 1. Jalankan pembersihan promo yang kedaluwarsa secara otomatis
    await adminSupabase!.rpc("expire_and_restore_promos")

    // 2. Ambil seluruh data promo beserta relasi produk penyusun
    const { data: promos, error } = await adminSupabase!
      .from("promos")
      .select(`
        *,
        promo_items (
          qty,
          product:products (id, name, product_code)
        )
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    // 3. Ambil sisa stok tersedia yang diasosiasikan ke setiap promo
    const { data: accounts } = await adminSupabase!
      .from("product_accounts")
      .select("promo_id")
      .eq("status", "available")
      .not("promo_id", "is", null)

    const counts = (accounts || []).reduce((acc, row) => {
      if (row.promo_id) {
        acc[row.promo_id] = (acc[row.promo_id] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)

    const result = (promos || []).map((p) => ({
      ...p,
      current_stock: counts[p.id] || 0,
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    return jsonRouteError(req, auth, "GET /api/admin/promos", error, "Gagal mengambil data promo", 400)
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.promos.write", limit: 12, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const name = readLimitedString(body.name, "Nama Promo", 120)
    const description = readLimitedNullableString(body.description, "Deskripsi", 500)
    const priceRaw = body.price
    const allocated_qty_raw = body.allocated_qty
    const end_at_raw = body.end_at ? String(body.end_at) : null
    const items = body.items as Array<Record<string, unknown>>

    if (!name || !items || !Array.isArray(items) || items.length === 0) {
      return jsonError("Nama promo dan produk penyusun wajib diisi.")
    }

    const price = Number(priceRaw)
    if (isNaN(price) || price < 0) {
      return jsonError("Harga promo tidak valid.")
    }

    const allocated_qty = Number(allocated_qty_raw)
    if (isNaN(allocated_qty) || allocated_qty <= 0) {
      return jsonError("Jumlah alokasi stok harus berupa angka positif.")
    }

    // Validasi produk penyusun
    for (const item of items) {
      if (!item.product_id || !item.qty || Number(item.qty) <= 0) {
        return jsonError("Produk penyusun atau quantity tidak valid.")
      }
    }

    // Call create_promo_campaign RPC in database
    const { data: promoId, error } = await adminSupabase!.rpc("create_promo_campaign", {
      p_name: name,
      p_description: description,
      p_price: price,
      p_allocated_qty: allocated_qty,
      p_items: items, // Passing array directly (PostgREST handles it as JSONB)
      p_end_at: end_at_raw ? new Date(end_at_raw).toISOString() : null,
    })

    if (error) {
      if (error.message.includes("Stok untuk produk")) {
        return jsonError(error.message, 400)
      }
      throw error
    }

    await writeAdminAuditLog(auth, {
      action: "create",
      entity: "promos",
      entityId: promoId,
      after: { id: promoId, name, price, items, allocated_qty, end_at: end_at_raw },
    })

    return NextResponse.json({ success: true, promoId })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/promos", error, "Gagal membuat promo", 400)
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.promos.write", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return jsonError("Promo ID wajib diisi.")

    // 1. Ambil data sebelum update untuk audit log
    const { data: before } = await adminSupabase!.from("promos").select("*").eq("id", id).maybeSingle()
    if (!before) return jsonError("Promo tidak ditemukan.", 404)

    // 2. Nonaktifkan promo
    const { error: promoError } = await adminSupabase!
      .from("promos")
      .update({ is_active: false, end_at: new Date().toISOString() })
      .eq("id", id)

    if (promoError) throw promoError

    // 3. Restore stok yang masih berstatus available
    const { data: restored, error: restoreError } = await adminSupabase!
      .from("product_accounts")
      .update({ promo_id: null })
      .eq("promo_id", id)
      .eq("status", "available")
      .select("id")

    if (restoreError) throw restoreError

    await writeAdminAuditLog(auth, {
      action: "update",
      entity: "promos",
      entityId: id,
      before,
      after: { ...before, is_active: false },
      metadata: { restored_count: restored?.length || 0 },
    })

    return NextResponse.json({ success: true, restored_count: restored?.length || 0 })
  } catch (error) {
    return jsonRouteError(req, auth, "DELETE /api/admin/promos", error, "Gagal menonaktifkan promo", 400)
  }
}
