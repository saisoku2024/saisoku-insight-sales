import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

type AdminAuthResult =
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

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function readNullableString(value: unknown) {
  const text = readString(value)
  return text ? text : null
}

export function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return fallback
}

export function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => readString(item)).filter(Boolean)
}

export async function requireActiveAdmin(req: NextRequest): Promise<AdminAuthResult> {
  if (!supabaseUrl || !supabaseAnonKey || !adminSupabase) {
    return {
      ok: false,
      response: jsonError(
        "Missing server env. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
        500
      ),
    }
  }

  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!token) {
    return { ok: false, response: jsonError("Unauthorized", 401) }
  }

  const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data: userData, error: userError } = await userSupabase.auth.getUser(token)
  if (userError || !userData.user) {
    return { ok: false, response: jsonError("Invalid session", 401) }
  }

  const { data: profileData, error: profileError } = await userSupabase.rpc("get_admin_profile")
  const profile = Array.isArray(profileData) ? profileData[0] : null

  if (profileError || !profile?.is_active || !["owner", "admin"].includes(String(profile.role))) {
    return { ok: false, response: jsonError("Akses ditolak. Admin aktif diperlukan.", 403) }
  }

  return {
    ok: true,
    adminEmail: userData.user.email || profile.email || "admin",
  }
}
