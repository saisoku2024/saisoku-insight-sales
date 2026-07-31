import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  getTicketWithUser,
  requireAdminSession,
  sendTelegramMessage,
  escapeHtml,
} from "../_lib"
import { enforceAdminRateLimit, jsonRouteError, readLimitedString, writeAdminAuditLog } from "../../admin/_lib"

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(
    req,
    { adminEmail: auth.adminEmail },
    { scope: "tickets.replace", limit: 20, windowSeconds: 60 }
  )
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as { ticketId?: unknown }
    const ticketId = readLimitedString(body.ticketId, "Ticket ID", 80)

    if (!ticketId) {
      return NextResponse.json({ error: "Ticket ID wajib diisi" }, { status: 400 })
    }

    if (!adminSupabase) {
      return NextResponse.json({ error: "Koneksi database admin gagal" }, { status: 500 })
    }

    // 1. Fetch ticket details
    const { data: ticket, error: ticketErr } = await adminSupabase
      .from("tickets")
      .select("*, users(telegram_id)")
      .eq("id", ticketId)
      .single()

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: "Tiket tidak ditemukan" }, { status: 404 })
    }

    const trxId = ticket.transaction_id
    if (!trxId) {
      return NextResponse.json({ error: "Tiket ini tidak terasosiasi dengan transaksi order" }, { status: 400 })
    }

    // 2. Fetch transaction details
    const { data: trx, error: trxErr } = await adminSupabase
      .from("transactions")
      .select("*, products(name, product_code)")
      .eq("id", trxId)
      .single()

    if (trxErr || !trx) {
      return NextResponse.json({ error: "Transaksi order tidak ditemukan" }, { status: 404 })
    }

    const productId = trx.product_id

    // 3. Find available replacement account from stock
    const { data: availableAcc, error: accErr } = await adminSupabase
      .from("product_accounts")
      .select("*")
      .eq("product_id", productId)
      .eq("status", "available")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (accErr || !availableAcc) {
      return NextResponse.json(
        { error: "Stok pengganti habis! Silakan restock produk ini terlebih dahulu." },
        { status: 400 }
      )
    }

    // 4. Mark replacement account as sold
    await adminSupabase
      .from("product_accounts")
      .update({ status: "sold", sold_at: new Date().toISOString() })
      .eq("id", availableAcc.id)

    // 5. Update sold_accounts
    const { data: sa } = await adminSupabase
      .from("sold_accounts")
      .select("*")
      .eq("transaction_id", trxId)
      .maybeSingle()

    const newClaimCount = (sa?.warranty_claim_count || 0) + 1
    const newSnapshot = {
      email: availableAcc.email,
      password: availableAcc.password,
      pin: availableAcc.pin,
      profile: availableAcc.profile,
    }

    if (sa) {
      await adminSupabase
        .from("sold_accounts")
        .update({
          account_id: availableAcc.id,
          account_snapshot: newSnapshot,
          warranty_claim_count: newClaimCount,
          warranty_last_claim_at: new Date().toISOString(),
        })
        .eq("id", sa.id)
    }

    // 6. Update ticket status to resolved
    await adminSupabase
      .from("tickets")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        feedback: `Akun pengganti dikirim otomatis oleh ${auth.adminEmail}`,
      })
      .eq("id", ticketId)

    // 7. Insert admin reply entry into ticket_replies
    await adminSupabase.from("ticket_replies").insert({
      ticket_id: Number(ticketId),
      sender_type: "admin",
      message: `✅ Akun pengganti garansi telah dikirimkan ke Telegram pembeli (Email: ${availableAcc.email}).`,
    })

    // 8. Send Telegram message to buyer
    const telegramId = ticket.users?.telegram_id || ticket.telegram_id
    const displayCode = trx.trx_code || `SSID-${trxId.slice(0, 8).toUpperCase()}`
    const prodName = trx.products?.name || "Produk"

    const buyerText = `🔄 <b>PENGGANTIAN AKUN GARANSI BERHASIL</b>

└ Kode Order : <code>${escapeHtml(displayCode)}</code>
└ Produk : <b>${escapeHtml(prodName)}</b>

<b>[ Data Akun Pengganti ]</b>
└ Email : <code>${escapeHtml(availableAcc.email || "-")}</code>
└ Password : <code>${escapeHtml(availableAcc.password || "-")}</code>
└ Profile : <b>${escapeHtml(availableAcc.profile || "-")}</b>
└ PIN : <code>${escapeHtml(availableAcc.pin || "-")}</code>

📌 <i>Klaim garansi ke-${newClaimCount} Anda telah selesai diproses oleh Admin via Web Dashboard.</i>`

    if (telegramId) {
      await sendTelegramMessage(Number(telegramId), buyerText)
    }

    await writeAdminAuditLog(
      { adminEmail: auth.adminEmail },
      {
        action: "replace_account",
        entity: "tickets",
        entityId: ticketId,
        before: ticket,
        after: { ...ticket, status: "resolved", replacement_account_id: availableAcc.id },
        metadata: { telegramId, claimCount: newClaimCount },
      }
    )

    return NextResponse.json({
      ok: true,
      message: "Akun pengganti dari stok berhasil dikirim ke Telegram pembeli!",
      account: newSnapshot,
    })
  } catch (error) {
    return jsonRouteError(
      req,
      { adminEmail: auth.adminEmail },
      "POST /api/tickets/replace-account",
      error,
      "Gagal melakukan replace akun dari stok",
      500
    )
  }
}
