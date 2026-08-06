import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST() {
  const isProduction = process.env.NODE_ENV === "production"
  const enableGuestLogin = process.env.ENABLE_GUEST_LOGIN?.trim().toLowerCase()

  // In production, Guest Mode is DISABLED by default unless ENABLE_GUEST_LOGIN is explicitly set to "true"
  if (isProduction && enableGuestLogin !== "true") {
    return NextResponse.json(
      { error: "Mode guest dinonaktifkan di lingkungan produksi." },
      { status: 403 }
    )
  }

  // Check if explicitly disabled in non-production environment
  if (enableGuestLogin === "false" || enableGuestLogin === "0" || enableGuestLogin === "off") {
    return NextResponse.json(
      { error: "Mode guest sedang dinonaktifkan." },
      { status: 403 }
    )
  }

  const email = process.env.GUEST_EMAIL
  const password = process.env.GUEST_PASSWORD

  if (!email || !password) {
    return NextResponse.json(
      { error: "Kredensial akun guest (GUEST_EMAIL & GUEST_PASSWORD) belum dikonfigurasi di server env." },
      { status: 500 }
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Konfigurasi Supabase server tidak lengkap." }, { status: 500 })
  }

  try {
    const serverSupabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data, error } = await serverSupabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      return NextResponse.json({ error: error?.message || "Gagal mengautentikasi akun guest." }, { status: 401 })
    }

    return NextResponse.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    })
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan pada server."
    return NextResponse.json({ error: errorMsg }, { status: 500 })
  }
}


