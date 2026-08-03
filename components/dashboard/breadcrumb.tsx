"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Overview",
  sales: "Sales & Transactions",
  products: "Products Management",
  users: "User Management",
  analytics: "Analytics & Reports",
  settings: "System Settings",
  logs: "Access Logs",
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-xs text-[var(--insight-muted)]">
      <Link
        href="/dashboard"
        className="flex items-center gap-1 hover:text-[var(--insight-text)] transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Dashboard</span>
      </Link>

      {segments.slice(1).map((segment, index) => {
        const path = `/${segments.slice(0, index + 2).join("/")}`
        const isLast = index === segments.length - 2
        const label = ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

        return (
          <div key={path} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3 opacity-50" />
            {isLast ? (
              <span className="font-semibold text-[var(--insight-text)]">{label}</span>
            ) : (
              <Link href={path} className="hover:text-[var(--insight-text)] transition-colors">
                {label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
