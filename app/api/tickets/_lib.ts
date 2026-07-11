import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

type TicketRow = Record<string, unknown>

type AuthResult =
  | {
      ok: true
      adminEmail: string
    }
  | {
      ok: false
      response: NextResponse
    }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SB_SERVICE_ROLE

export const adminSupabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

const authSupabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export function getString(row: TicketRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }

  return ""
}

export function getNumber(row: TicketRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value)
    }
  }

  return null
}

export function ticketDisplayCode(ticket: TicketRow) {
  return getString(ticket, ["ticket_code", "code", "ticket_id", "public_id", "sid"]) || `TICKET-${getString(ticket, ["id"]) || "-"}`
}

export function ticketNumericId(ticket: TicketRow) {
  return getString(ticket, ["id", "ticket_number", "number"]) || "-"
}

export function orderDisplayId(ticket: TicketRow) {
  const raw = getString(ticket, ["order_code", "order_id", "transaction_code", "invoice_code"])
  if (!raw) return "-"

  return raw.replace(/^#/, "")
}

export function ticketUserMessage(ticket: TicketRow) {
  return getString(ticket, ["message", "pesan", "description", "content", "body", "issue"]) || "-"
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

export async function requireAdminSession(req: NextRequest): Promise<AuthResult> {
  if (!authSupabase || !adminSupabase) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Missing Supabase server env. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      ),
    }
  }

  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const { data, error } = await authSupabase.auth.getUser(token)

  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid session" }, { status: 401 }),
    }
  }

  return {
    ok: true,
    adminEmail: data.user.email || "admin",
  }
}

export async function getTicketWithUser(ticketId: string) {
  if (!adminSupabase) throw new Error("Missing service role client")

  const { data: ticket, error } = await adminSupabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single()

  if (error || !ticket) {
    throw new Error(error?.message || "Ticket tidak ditemukan")
  }

  const ticketRow = ticket as TicketRow

  if (!ticketUserMessage(ticketRow) || ticketUserMessage(ticketRow) === "-") {
    const { data: firstUserReply } = await adminSupabase
      .from("ticket_replies")
      .select("message")
      .eq("ticket_id", ticketId)
      .eq("sender_type", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    const replyMessage = getString((firstUserReply || {}) as TicketRow, ["message"])
    if (replyMessage) {
      ticketRow.message = replyMessage
    }
  }

  let telegramId = getNumber(ticketRow, ["telegram_id", "chat_id", "user_telegram_id"])

  if (!telegramId) {
    const userId = getString(ticketRow, ["user_id"])

    if (userId) {
      const { data: user } = await adminSupabase
        .from("users")
        .select("telegram_id")
        .eq("id", userId)
        .maybeSingle()

      if (user) {
        telegramId = getNumber(user as TicketRow, ["telegram_id"])
      }
    }
  }

  if (!telegramId) {
    throw new Error("Telegram ID user tidak ditemukan untuk ticket ini")
  }

  return { ticket: ticketRow, telegramId }
}

export function buildReplyText(ticket: TicketRow, feedback: string) {
  const code = ticketDisplayCode(ticket)
  const orderId = orderDisplayId(ticket)

  return `✅ TIKET  [${escapeHtml(code)}]

└ Tiket ID : #${escapeHtml(ticketNumericId(ticket))} - [${escapeHtml(code)}]
└ ORDER ID : #${escapeHtml(orderId)}
└ Status : Assigned
└ Pesan : ${escapeHtml(ticketUserMessage(ticket))}

└ feedback : ${escapeHtml(feedback)}

====================`
}

export function buildResolvedText(ticket: TicketRow) {
  const code = ticketDisplayCode(ticket)
  const orderId = orderDisplayId(ticket)

  return `✅ TIKET  [${escapeHtml(code)}]

└ Tiket ID : #${escapeHtml(ticketNumericId(ticket))} - [${escapeHtml(code)}]
└ ORDER ID : #${escapeHtml(orderId)}
└ Status : Resolved

Terima Kasih Telah menggunakan Layanan SAISOKU.ID`
}

export async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN

  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN env")
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  })

  const result = (await res.json()) as { ok?: boolean; description?: string }

  if (!result.ok) {
    throw new Error(result.description || "Gagal mengirim pesan Telegram")
  }
}

export function buildTicketReplyTelegramText(ticket: TicketRow, feedback: string) {
  const code = ticketDisplayCode(ticket)
  const orderId = orderDisplayId(ticket)

  return `✅ TIKET  [${escapeHtml(code)}]

└ Tiket ID : #${escapeHtml(ticketNumericId(ticket))} - [${escapeHtml(code)}]
└ ORDER ID : #${escapeHtml(orderId)}
└ Status : Assigned
└ Pesan : ${escapeHtml(ticketUserMessage(ticket))}

└ feedback : ${escapeHtml(feedback)}

====================`
}

export function buildTicketResolvedTelegramText(ticket: TicketRow) {
  const code = ticketDisplayCode(ticket)
  const orderId = orderDisplayId(ticket)

  return `✅ TIKET  [${escapeHtml(code)}]

└ Tiket ID : #${escapeHtml(ticketNumericId(ticket))} - [${escapeHtml(code)}]
└ ORDER ID : #${escapeHtml(orderId)}
└ Status : Resolved

Terima Kasih Telah menggunakan Layanan SAISOKU.ID`
}
