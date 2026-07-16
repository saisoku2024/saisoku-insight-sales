import { supabase } from "@/lib/supabase/client"

export type AdminProfile = {
  auth_user_id: string
  email: string
  role: "owner" | "admin"
  is_active: boolean
}

export async function getActiveAdminProfile() {
  const { data, error } = await supabase.rpc("get_admin_profile")

  if (error) {
    return { profile: null, error }
  }

  const profiles = (data as AdminProfile[] | null) ?? []
  const profile = profiles[0] ?? null

  return { profile, error: null }
}

export function getAdminAccessErrorMessage() {
  return "Akun ini belum terdaftar sebagai admin aktif. Hubungi owner untuk akses panel."
}
