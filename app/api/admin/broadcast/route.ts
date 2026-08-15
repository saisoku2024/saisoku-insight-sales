import { NextResponse, type NextRequest } from "next/server"
import { requireActiveAdmin, jsonError, jsonRouteError } from "../_lib"

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  try {
    const { text, reply_markup } = await req.json()
    if (!text) {
      return jsonError("Pesan broadcast wajib diisi.")
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
    const serviceRole =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      process.env.SB_SERVICE_ROLE ||
      ""

    if (!sbUrl || !serviceRole) {
      return jsonError("Konfigurasi server Supabase tidak lengkap.", 500)
    }

    // Call Deno Edge Function
    const res = await fetch(`${sbUrl}/functions/v1/telegram-bot/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRole}`,
      },
      body: JSON.stringify({ text, reply_markup }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return jsonError(`Gagal mengirim broadcast: ${errorText}`, res.status)
    }

    const data = await res.json()
    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/broadcast", error, "Gagal mengirim broadcast", 400)
  }
}
