import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_GUEST_LOGIN === "false") {
    return NextResponse.json({ error: "Mode guest dinonaktifkan di lingkungan produksi." }, { status: 403 })
  }

  const email = process.env.GUEST_EMAIL || "guest@ssidmail.my.id"
  const password = process.env.GUEST_PASSWORD || "guestonly123"
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

