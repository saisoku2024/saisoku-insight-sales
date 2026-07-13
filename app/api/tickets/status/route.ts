import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  buildTicketStatusTelegramText,
  getTicketWithUser,
  requireAdminSession,
  sendTelegramMessage,
  type TicketStatus,
} from "../_lib"
import { enforceAdminRateLimit, writeAdminAuditLog } from "../../admin/_lib"

const allowedStatuses: TicketStatus[] = ["open", "on_progress", "assigned", "resolved"]

async function updateTicketStatus(ticketId: string, status: TicketStatus, adminEmail: string) {
  const now = new Date().toISOString()
  const baseUpdate =
    status === "resolved"
      ? { status, resolved_by: adminEmail, resolved_at: now }
      : { status, resolved_at: null }
  const fallbackUpdate = status === "resolved" ? { status, resolved_at: now } : { status }
  const updates = [baseUpdate, fallbackUpdate, { status }]

  let lastError = ""

  for (const update of updates) {
    const { error } = await adminSupabase!.from("tickets").update(update).eq("id", ticketId)
    if (!error) return
    lastError = error.message
  }

  throw new Error(lastError || "Gagal update status ticket")
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminSession(req)
  if (!auth.ok) return auth.response
  const rateLimited = await enforceAdminRateLimit(req, { adminEmail: auth.adminEmail }, { scope: "tickets.status", limit: 25, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as { ticketId?: unknown; status?: unknown }
    const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : ""
    const status = typeof body.status === "string" ? body.status.trim() : ""

    if (!ticketId) {
      return NextResponse.json({ error: "Ticket ID wajib diisi" }, { status: 400 })
    }

    if (!allowedStatuses.includes(status as TicketStatus)) {
      return NextResponse.json({ error: "Status ticket tidak valid" }, { status: 400 })
    }

    const nextStatus = status as TicketStatus
    const { ticket, telegramId } = await getTicketWithUser(ticketId)

    await updateTicketStatus(ticketId, nextStatus, auth.adminEmail)

    const text = buildTicketStatusTelegramText(
      {
        ...ticket,
        status: nextStatus,
        resolved_at: nextStatus === "resolved" ? new Date().toISOString() : ticket.resolved_at,
      },
      nextStatus
    )
    await sendTelegramMessage(telegramId, text)

    await writeAdminAuditLog({ adminEmail: auth.adminEmail }, {
      action: "status_update",
      entity: "tickets",
      entityId: ticketId,
      before: ticket,
      after: {
        ...ticket,
        status: nextStatus,
        resolved_at: nextStatus === "resolved" ? new Date().toISOString() : ticket.resolved_at,
      },
      metadata: { status: nextStatus, telegramId },
    })

    return NextResponse.json({ ok: true, data: { status: nextStatus } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal update status ticket" },
      { status: 500 }
    )
  }
}
