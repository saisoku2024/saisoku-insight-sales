import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  buildTicketReplyTelegramText,
  getTicketWithUser,
  requireAdminSession,
  sendTelegramMessage,
} from "../_lib"

async function updateReplyTicket(ticketId: string, feedback: string, adminEmail: string) {
  const updates = [
    {
      status: "replied",
      feedback,
      replied_by: adminEmail,
      replied_at: new Date().toISOString(),
    },
    {
      status: "replied",
      feedback,
    },
    {
      status: "replied",
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

  try {
    const body = (await req.json()) as { ticketId?: unknown; feedback?: unknown }
    const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : ""
    const feedback = typeof body.feedback === "string" ? body.feedback.trim() : ""

    if (!ticketId) {
      return NextResponse.json({ error: "Ticket ID wajib diisi" }, { status: 400 })
    }

    if (!feedback) {
      return NextResponse.json({ error: "Feedback wajib diisi" }, { status: 400 })
    }

    const { ticket, telegramId } = await getTicketWithUser(ticketId)
    const text = buildTicketReplyTelegramText(ticket, feedback)

    const { data: reply, error: replyError } = await adminSupabase!
      .from("ticket_replies")
      .insert({
        ticket_id: Number(ticketId),
        sender_type: "admin",
        message: feedback,
      })
      .select("id, ticket_id, sender_type, message, created_at")
      .single()

    if (replyError) {
      return NextResponse.json({ error: replyError.message }, { status: 500 })
    }

    await updateReplyTicket(ticketId, feedback, auth.adminEmail)

    await sendTelegramMessage(telegramId, text)

    return NextResponse.json({ ok: true, data: reply })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal membalas ticket" },
      { status: 500 }
    )
  }
}
