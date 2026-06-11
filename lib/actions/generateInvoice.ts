import { supabase } from "@/lib/supabaseClient"

export async function generateInvoice() {

  const now = new Date()

  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")

  const dateStr = `${yyyy}${mm}${dd}`

  const startOfDay = `${yyyy}-${mm}-${dd}T00:00:00`
  const endOfDay = `${yyyy}-${mm}-${dd}T23:59:59`

  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)

  const sequence = (count || 0) + 1

  const seq = String(sequence).padStart(3, "0")

  const invoice = `SSID-${dateStr}-${seq}`

  return invoice
}