export interface User {
  id: string

  telegram_id?: string
  username?: string

  email?: string
  phone?: string

  role: "owner" | "admin" | "reseller" | "regular"

  balance: number

  is_active: boolean

  created_at: string

  updated_at?: string

  deleted_at?: string | null

  last_sign_in_at?: string | null
}