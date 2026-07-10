export interface User {
  id: string

  telegram_id?: number
  username?: string | null
  name?: string | null
  whatsapp?: string | null
  email?: string | null

  role: "owner" | "admin" | "reseller" | "reguler"

  balance: number

  is_active: boolean
  is_banned: boolean

  created_at: string
  last_checkin_at?: string | null
}