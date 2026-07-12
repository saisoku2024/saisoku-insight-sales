import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Boxes,
  Bell,
  Bot,
  DatabaseBackup,
  CreditCard,
  DollarSign,
  FileText,
  Gift,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Ticket,
  Users,
  Wallet,
} from "lucide-react"

export type DashboardNavItem = {
  title: string
  href: string
  icon: LucideIcon
  description: string
}

export type DashboardNavGroup = {
  type: "group"
  label: string
  items: DashboardNavItem[]
}

export type DashboardNavSingle = {
  type: "item"
  item: DashboardNavItem
}

export type DashboardNavEntry = DashboardNavGroup | DashboardNavSingle

export const dashboardNavigation: DashboardNavEntry[] = [
  {
    type: "item",
    item: {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      description: "Sales Monitoring & Reporting",
    },
  },
  {
    type: "group",
    label: "Manage Product",
    items: [
      {
        title: "Products",
        href: "/dashboard/products",
        icon: Package,
        description: "Kelola Harga, Deskripsi, dan Produk",
      },
      {
        title: "Stock",
        href: "/dashboard/stocks",
        icon: Boxes,
        description: "Monitor Stock Account",
      },
    ],
  },
  {
    type: "group",
    label: "Users",
    items: [
      {
        title: "User List",
        href: "/dashboard/users",
        icon: Users,
        description: "Kelola status, role, dan user admin",
      },
    ],
  },
  {
    type: "group",
    label: "Business",
    items: [
      {
        title: "Balance",
        href: "/dashboard/balance",
        icon: Wallet,
        description: "Saldo user, mutasi, dan adjustment balance",
      },
      {
        title: "Pricing",
        href: "/dashboard/pricing",
        icon: DollarSign,
        description: "Harga regular, reseller, dan margin profit",
      },
      {
        title: "Loyalty",
        href: "/dashboard/loyalty",
        icon: Gift,
        description: "Reward point, redeem, dan tier member",
      },
      {
        title: "Vouchers",
        href: "/dashboard/vouchers",
        icon: Ticket,
        description: "Kode voucher, kuota, expired, dan status",
      },
    ],
  },
  {
    type: "group",
    label: "Reports",
    items: [
      {
        title: "Sales & Profit",
        href: "/dashboard/sales",
        icon: BarChart3,
        description: "Laporan agregat penjualan dan profit",
      },
      {
        title: "Log Sales",
        href: "/dashboard/log-sales",
        icon: ShoppingCart,
        description: "Riwayat transaksi per invoice, user, dan produk",
      },
      {
        title: "Log Balance",
        href: "/dashboard/log-balance",
        icon: CreditCard,
        description: "Riwayat top up, purchase, dan adjustment saldo",
      },
      {
        title: "Log Audit",
        href: "/dashboard/log-audit",
        icon: FileText,
        description: "Aktivitas admin dan perubahan sistem",
      },
    ],
  },
  {
    type: "item",
    item: {
      title: "Tickets",
      href: "/dashboard/tickets",
      icon: Ticket,
      description: "Ticket Management",
    },
  },
  {
    type: "group",
    label: "Settings",
    items: [
      {
        title: "General",
        href: "/dashboard/settings/general",
        icon: SlidersHorizontal,
        description: "Info aplikasi, company, currency, dan preference",
      },
      {
        title: "Telegram",
        href: "/dashboard/settings/telegram",
        icon: Bot,
        description: "Konfigurasi bot, webhook, admin chat, dan notif",
      },
      {
        title: "Payment Gateway",
        href: "/dashboard/settings/payment",
        icon: CreditCard,
        description: "Provider payment, QRIS, bank, dan deposit rules",
      },
      {
        title: "Notifications",
        href: "/dashboard/settings/notifications",
        icon: Bell,
        description: "Channel, event, dan recipient notification",
      },
      {
        title: "Backup",
        href: "/dashboard/settings/backup",
        icon: DatabaseBackup,
        description: "Manual backup, auto backup, dan recovery status",
      },
    ],
  },
]

export function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getPageMeta(pathname: string) {
  const items = dashboardNavigation.flatMap((entry) =>
    entry.type === "item" ? [entry.item] : entry.items
  )
  const matched = items
    .filter((item) => isActivePath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    matched ?? {
      title: "Dashboard",
      href: "/dashboard",
      icon: ShieldCheck,
      description: "Sales Admin Workspace",
    }
  )
}
