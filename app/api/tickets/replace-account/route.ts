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

    // Call atomic replacement RPC
    const { data: rpcResult, error: rpcErr } = await adminSupabase.rpc(
      "replace_warranty_account_atomic",
      {
        p_ticket_id: ticketId,
        p_admin_email: auth.adminEmail,
      }
    )

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    }

    if (!rpcResult || rpcResult.success === false) {
      return NextResponse.json(
        { error: rpcResult?.error || "Gagal memproses transaksi penggantian akun" },
        { status: 400 }
      )
    }

    const replacement = rpcResult.replacement || {}
    const telegramId = rpcResult.telegram_id
    const claimCount = rpcResult.claim_count || 1

    // Fetch display code and product name for Telegram notification
    const { data: ticket } = await adminSupabase
      .from("tickets")
      .select("*, transactions(*, products(name, product_code))")
      .eq("id", ticketId)
      .maybeSingle()

    const trx = ticket?.transactions
    const displayCode = trx?.trx_code || (trx?.id ? `SSID-${trx.id.slice(0, 8).toUpperCase()}` : `TICKET-${ticketId}`)
    const prodName = trx?.products?.name || "Produk"

    const buyerText = `🔄 <b>PENGGANTIAN AKUN GARANSI BERHASIL</b>

└ Kode Order : <code>${escapeHtml(displayCode)}</code>
└ Produk : <b>${escapeHtml(prodName)}</b>

<b>[ Data Akun Pengganti ]</b>
└ Email : <code>${escapeHtml(replacement.email || "-")}</code>
└ Password : <code>${escapeHtml(replacement.password || "-")}</code>
└ Profile : <b>${escapeHtml(replacement.profile || "-")}</b>
└ PIN : <code>${escapeHtml(replacement.pin || "-")}</code>

📌 <i>Klaim garansi ke-${claimCount} Anda telah selesai diproses oleh Admin via Web Dashboard.</i>`

    if (telegramId) {
      await sendTelegramMessage(Number(telegramId), buyerText)
    }

    await writeAdminAuditLog(
      { adminEmail: auth.adminEmail },
      {
        action: "replace_account",
        entity: "tickets",
        entityId: ticketId,
        before: { ticketId },
        after: { ticketId, status: "resolved", replacement },
        metadata: { telegramId, claimCount },
      }
    )

    return NextResponse.json({
      ok: true,
      message: "Akun pengganti dari stok berhasil dikirim ke Telegram pembeli!",
      account: replacement,
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
