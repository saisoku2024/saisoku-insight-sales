// ============================================================
// SAISOKU INSIGHT - Shared TypeScript Types
// ============================================================

// Re-export existing User type
export type { User } from "./user"

// -------------------------------------------------------
// PRODUCT
// -------------------------------------------------------
export interface Product {
  id: string
  product_code: string
  name: string
  price_normal: number
  reseller_discount: number
  modal: number
  duration_days: number
  description: string | null
  tos_description: string | null
  template_message: string | null
  is_active: boolean
  created_at: string
  updated_at?: string | null
}

// -------------------------------------------------------
// STOCK (product_accounts)
// -------------------------------------------------------
export interface Stock {
  id: string
  product_id: string
  email: string
  password: string | null
  profile: string | null
  pin: string | null
  status: "available" | "sold" | "reserved" | "inactive" | "deleted"
  created_at: string
  sold_at?: string | null
  sold_to?: string | null
  products?: { name: string | null; product_code?: string | null } | { name: string | null; product_code?: string | null }[] | null
}

// -------------------------------------------------------
// TRANSACTION
// -------------------------------------------------------
export interface Transaction {
  id: string
  trx_code?: string | null
  invoice?: string | null
  user_id: string
  product_id: string
  account_id?: string | null
  price: number
  payment_method?: string | null
  status: "pending" | "paid" | "cancelled" | "expired" | string
  purchased_at?: string | null
  approved_at?: string | null
  expired_at?: string | null
  created_at: string
  products?: { name: string | null; modal: number | null } | null
  users?: { username: string | null } | null
  product_accounts?:
    | { email: string | null; password: string | null; pin: string | null; sold_at: string | null }
    | { email: string | null; password: string | null; pin: string | null; sold_at: string | null }[]
    | null
}

// -------------------------------------------------------
// SALES STATS
// -------------------------------------------------------
export interface SalesStats {
  today: number
  month: number
  year: number
  revenue: number
}

// -------------------------------------------------------
// RECENT TRANSACTION (for Sales page)
// -------------------------------------------------------
export interface RecentTransaction {
  id: string
  invoice?: string | null
  user_id: string
  price: number
  payment_method?: string | null
  status: string
  created_at: string
  products?: { name: string | null } | null
}

// -------------------------------------------------------
// DASHBOARD META
// -------------------------------------------------------
export interface DashboardMeta {
  gmvToday: number
  gmvMonth: number
  profitToday: number
  profitMonth: number
  profitYear: number
  transactions: number
  newUsers: number
  activeUsers: number
  bannedUsers: number
}
