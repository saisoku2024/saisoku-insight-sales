import { supabase } from "@/lib/supabase/client"

export async function adminWrite<T>(
  path: string,
  options: {
    method?: "POST" | "PATCH" | "DELETE"
    body?: unknown
  } = {}
) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Session admin tidak ditemukan. Silakan login ulang.")
  }

  const res = await fetch(path, {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const result = (await res.json()) as { data?: T; error?: string }

  if (!res.ok) {
    throw new Error(result.error || "Request admin gagal")
  }

  return result.data as T
}
