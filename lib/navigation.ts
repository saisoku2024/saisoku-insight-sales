import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Boxes,
  ClipboardList,
  History,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Users,
} from "lucide-react"

export type DashboardNavItem = {
  title: string
  href: string
  icon: LucideIcon
  description: string
}

export type DashboardNavGroup = {
  label: string
  items: DashboardNavItem[]
}

export const dashboardNavigation: DashboardNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Ringkasan performa penjualan",
      },
      {
        title: "Sales Report",
        href: "/dashboard/sales",
        icon: BarChart3,
        description: "Laporan penjualan dan transaksi terbaru",
      },
      {
        title: "Transactions",
        href: "/dashboard/transactions",
        icon: ClipboardList,
        description: "Filter, ekspor, dan audit transaksi",
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        title: "Products",
        href: "/dashboard/products",
        icon: Package,
        description: "Kelola harga, deskripsi, dan produk",
      },
      {
        title: "Stocks",
        href: "/dashboard/stocks",
        icon: Boxes,
        description: "Monitor stock account yang tersedia",
      },
      {
        title: "History",
        href: "/dashboard/history",
        icon: History,
        description: "Riwayat account yang sudah terjual",
      },
    ],
  },
  {
    label: "Access",
    items: [
      {
        title: "Users",
        href: "/dashboard/users",
        icon: Users,
        description: "Kelola status, role, dan user admin",
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
  const items = dashboardNavigation.flatMap((group) => group.items)
  const matched = items
    .filter((item) => isActivePath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    matched ?? {
      title: "Dashboard",
      href: "/dashboard",
      icon: ShieldCheck,
      description: "Sales admin workspace",
    }
  )
}
