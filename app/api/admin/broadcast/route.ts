import { NextResponse, type NextRequest } from "next/server"
import { adminSupabase, requireActiveAdmin, jsonError, jsonRouteError, writeAdminAuditLog } from "../_lib"

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const body = (await req.json()) as { text?: unknown; reply_markup?: unknown }
    const text = typeof body.text === "string" ? body.text.trim() : ""
    const reply_markup = body.reply_markup

    if (!text) {
      return jsonError("Pesan broadcast wajib diisi.")
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
    const serviceRole =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SB_SERVICE_ROLE ||
      ""

    // Strategy 1: Direct Broadcast from Next.js server if TELEGRAM_BOT_TOKEN is present
    if (botToken && adminSupabase) {
      const { data: users, error: userErr } = await adminSupabase
        .from("users")
        .select("telegram_id, is_banned, is_active")
        .not("telegram_id", "is", null)

      if (!userErr && users && users.length > 0) {
        const recipients = users.filter((u) => !u.is_banned && u.telegram_id)
        let success = 0
        let failed = 0
        let lastError: string | null = null

        const CHUNK_SIZE = 15
        for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
          const chunk = recipients.slice(i, i + CHUNK_SIZE)
          const results = await Promise.allSettled(
            chunk.map(async (u) => {
              const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: Number(u.telegram_id),
                  text,
                  parse_mode: "HTML",
                  ...(reply_markup ? { reply_markup } : {}),
                }),
              })
              const json = (await res.json()) as { ok?: boolean; description?: string }
              if (!json.ok) {
                throw new Error(json.description || "Gagal mengirim pesan")
              }
            })
          )

          for (const r of results) {
            if (r.status === "fulfilled") {
              success++
            } else {
              failed++
              lastError = r.reason instanceof Error ? r.reason.message : String(r.reason)
            }
          }

          if (i + CHUNK_SIZE < recipients.length) {
            await new Promise((resolve) => setTimeout(resolve, 600))
          }
        }

        await writeAdminAuditLog(auth, {
          action: "broadcast",
          entity: "telegram_bot",
          entityId: null,
          after: { success, failed, total: recipients.length },
          metadata: { success, failed, total: recipients.length, textPreview: text.slice(0, 100) },
        })

        return NextResponse.json({
          data: {
            success,
            failed,
            total: recipients.length,
            error: lastError,
          },
        })
      }
    }

    // Strategy 2: Call Edge Function (with multiple fallback endpoints & headers)
    if (!sbUrl || !serviceRole) {
      return jsonError("Konfigurasi server Supabase/Telegram tidak lengkap.", 500)
    }

    const endpoints = [
      `${sbUrl}/functions/v1/telegram-bot`,
      `${sbUrl}/functions/v1/telegram-bot/broadcast`,
    ]

    let edgeResponse: Response | null = null
    let lastEdgeError = ""

    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRole}`,
            apikey: serviceRole,
            "x-telegram-bot-api-secret-token": serviceRole,
          },
          body: JSON.stringify({
            action: "broadcast",
            text,
            reply_markup,
          }),
        })

        if (res.ok) {
          edgeResponse = res
          break
        } else {
          lastEdgeError = await res.text()
        }
      } catch (err) {
        lastEdgeError = err instanceof Error ? err.message : String(err)
      }
    }

    if (!edgeResponse) {
      return jsonError(`Gagal menghubungi server broadcast: ${lastEdgeError || "Tidak ada respon"}`, 502)
    }

    const data = (await edgeResponse.json()) as Record<string, unknown>

    await writeAdminAuditLog(auth, {
      action: "broadcast",
      entity: "telegram_bot",
      entityId: null,
      after: data,
      metadata: { data, textPreview: text.slice(0, 100) },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/broadcast", error, "Gagal mengirim broadcast", 400)
  }
}
