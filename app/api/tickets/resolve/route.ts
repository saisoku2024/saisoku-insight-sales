import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  buildTicketResolvedTelegramText,
  getTicketWithUser,
  requireAdminSession,
  sendTelegramMessage,
} from "../_lib"
import { enforceAdminRateLimit, jsonRouteError, readLimitedString, writeAdminAuditLog } from "../../admin/_lib"

async function updateResolvedTicket(ticketId: string, adminEmail: string) {
  const updates = [
    {
      status: "resolved",
      resolved_by: adminEmail,
      resolved_at: new Date().toISOString(),
    },
    {
      status: "resolved",
    },
  ]

  let lastError = ""

  for (const update of updates) {
    const { error } = await adminSupabase!.from("tickets").update(update).eq("id", ticketId)
    if (!error) return
    lastError = error.message
  }

  throw new Error(lastError || "Gagal update ticket")
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, { adminEmail: auth.adminEmail }, { scope: "tickets.resolve", limit: 20, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as { ticketId?: unknown }
    const ticketId = readLimitedString(body.ticketId, "Ticket ID", 80)

    if (!ticketId) {
      return NextResponse.json({ error: "Ticket ID wajib diisi" }, { status: 400 })
    }

    const { ticket, telegramId } = await getTicketWithUser(ticketId)
    const text = buildTicketResolvedTelegramText(ticket)

    await updateResolvedTicket(ticketId, auth.adminEmail)

    await sendTelegramMessage(telegramId, text)

    await writeAdminAuditLog({ adminEmail: auth.adminEmail }, {
      action: "resolve",
      entity: "tickets",
      entityId: ticketId,
      before: ticket,
      after: { ...ticket, status: "resolved", resolved_at: new Date().toISOString() },
      metadata: { telegramId },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return jsonRouteError(req, { adminEmail: auth.adminEmail }, "POST /api/tickets/resolve", error, "Gagal resolve ticket", 500)
  }
}
