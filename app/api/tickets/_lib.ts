import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

type TicketRow = Record<string, unknown>
export type TicketStatus = "open" | "on_progress" | "assigned" | "resolved"

type AuthResult =
  | {
      ok: true
      adminEmail: string
      role: "owner" | "admin"
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
  const existing = getString(ticket, ["ticket_code", "code", "ticket_id", "public_id", "sid"])
  if (existing) return existing.replace(/^#/, "").replace(/^\[|\]$/g, "")

  return buildStructuredTicketCode(ticket)
}

export function ticketNumericId(ticket: TicketRow) {
  return getString(ticket, ["id", "ticket_number", "number"]) || "-"
}

export function orderDisplayId(ticket: TicketRow) {
  const raw = getString(ticket, ["order_code", "order_id", "transaction_code", "invoice_code", "invoice", "trx_code"])
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

function formatTicketDate(value?: unknown) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : new Date()
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(validDate)
    .replace(".", ":")
}

function formatTicketDateCode(value?: unknown) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : new Date()
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(validDate)

  const day = parts.find((part) => part.type === "day")?.value || "01"
  const month = parts.find((part) => part.type === "month")?.value || "01"
  const year = parts.find((part) => part.type === "year")?.value || "1970"

  return `${year}${month}${day}`
}

function cleanOrderSegment(value: string) {
  const cleaned = value.replace(/^#/, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
  return (cleaned || "GENERAL").slice(0, 8)
}

function buildStructuredTicketCode(ticket: TicketRow) {
  const orderSegment = cleanOrderSegment(orderDisplayId(ticket))
  const serial = ticketNumericId(ticket).replace(/\D/g, "").padStart(6, "0") || "000000"
  return `SID${formatTicketDateCode(ticket.created_at)}-${orderSegment}-${serial}`
}

function statusLabel(status: TicketStatus) {
  if (status === "resolved") return "✅ [ RESOLVED ]"
  if (status === "assigned") return "🟦 [ ASSIGNED ]"
  if (status === "on_progress") return "🔄 [ ON PROGRESS ]"
  return "⏳ [ OPEN ]"
}

function buildStructuredTicketText({
  ticket,
  status,
  adminResponse,
  footer,
}: {
  ticket: TicketRow
  status: TicketStatus
  adminResponse?: string
  footer: string
}) {
  const code = ticketDisplayCode(ticket)
  const orderId = orderDisplayId(ticket)
  const createdAt = formatTicketDate(ticket.created_at)
  const resolvedAt =
    status === "resolved" ? formatTicketDate(ticket.resolved_at || new Date()) : "PENDING"
  const userMessage = escapeHtml(ticketUserMessage(ticket))
  const response = adminResponse ? escapeHtml(adminResponse) : "(Menunggu balasan admin...)"

  return `<b>[ TICKET NOTIFICATION ]</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶ <b>TICKET ID</b>    : <code>${escapeHtml(code)}</code>
▶ <b>ORDER ID</b>     : <code>${escapeHtml(orderId)}</code>
▶ <b>STATUS</b>       : ${statusLabel(status)}

<b>LOG AKTIVITAS</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[+] Dibuat     : ${createdAt}
[-] Selesai    : ${resolvedAt}

<b>PESAN DARI USER</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
&quot;${userMessage}&quot;
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<b>RESPON ADMIN</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${response}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<i>${escapeHtml(footer)}</i>`
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

  const userSupabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })
  const { data: profileData, error: profileError } = await userSupabase.rpc("get_admin_profile")
  const profile = Array.isArray(profileData) ? profileData[0] : null

  if (profileError || !profile?.is_active || !["owner", "admin"].includes(String(profile.role))) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Mode viewer hanya boleh melihat ticket." }, { status: 403 }),
    }
  }

  return {
    ok: true,
    adminEmail: data.user.email || "admin",
    role: String(profile.role) === "owner" ? "owner" : "admin",
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

  const transactionId = getString(ticketRow, ["transaction_id"])
  if (transactionId && orderDisplayId(ticketRow) === "-") {
    const { data: transaction } = await adminSupabase
      .from("transactions")
      .select("invoice, trx_code")
      .eq("id", transactionId)
      .maybeSingle()

    const orderCode = getString((transaction || {}) as TicketRow, ["invoice", "trx_code"])
    if (orderCode) {
      ticketRow.order_code = orderCode
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
  return buildStructuredTicketText({
    ticket,
    status: "assigned",
    adminResponse: feedback,
    footer: "Admin telah membalas tiket Anda. Silakan cek respon di atas.",
  })
}

export function buildStatusText(ticket: TicketRow, status: TicketStatus) {
  const responseByStatus: Record<TicketStatus, string> = {
    open: "(Menunggu balasan admin...)",
    on_progress: "Tiket sedang ditangani oleh admin.",
    assigned: "Tiket telah diterima dan sedang dalam antrean penanganan admin.",
    resolved: "Tiket telah diselesaikan oleh admin.",
  }

  const footerByStatus: Record<TicketStatus, string> = {
    open: "Admin telah dinotifikasi. Harap tunggu balasan selanjutnya.",
    on_progress: "Mohon tunggu, admin sedang memproses tiket Anda.",
    assigned: "Admin telah mengambil tiket Anda dan akan memberi balasan berikutnya.",
    resolved: "Terima kasih telah menggunakan Layanan SAISOKU.ID.",
  }

  return buildStructuredTicketText({
    ticket,
    status,
    adminResponse: responseByStatus[status],
    footer: footerByStatus[status],
  })
}

export function buildResolvedText(ticket: TicketRow) {
  return buildStructuredTicketText({
    ticket,
    status: "resolved",
    adminResponse: "Tiket telah diselesaikan oleh admin.",
    footer: "Terima kasih telah menggunakan Layanan SAISOKU.ID.",
  })
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
  return buildReplyText(ticket, feedback)
}

export function buildTicketResolvedTelegramText(ticket: TicketRow) {
  return buildResolvedText(ticket)
}

export function buildTicketStatusTelegramText(ticket: TicketRow, status: TicketStatus) {
  return buildStatusText(ticket, status)
}
