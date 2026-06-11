import Link from "next/link"
import { LogOut } from "lucide-react"

import { BrandMark } from "@/components/brand/brand-mark"
import type { DashboardNavGroup } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { isActivePath } from "@/lib/navigation"

type SidebarNavProps = {
  pathname: string
  groups: DashboardNavGroup[]
  userEmail?: string | null
  isLoggingOut: boolean
  onNavigate?: () => void
  onLogout: () => void
}

export function SidebarNav({
  pathname,
  groups,
  userEmail,
  isLoggingOut,
  onNavigate,
  onLogout,
}: SidebarNavProps) {
  return (
    <div className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/40">
      <BrandMark className="px-2 pb-6" compact />

      <div className="space-y-6 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {group.label}
            </div>

            <div className="mt-3 space-y-1.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-start gap-3 rounded-2xl px-3 py-3 transition-all",
                      active
                        ? "bg-slate-950 text-white shadow-lg shadow-slate-950/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                        active
                          ? "border-white/10 bg-white/10 text-white"
                          : "border-slate-200 bg-white text-slate-500 group-hover:border-slate-300"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs leading-5",
                          active ? "text-slate-300" : "text-slate-400"
                        )}
                      >
                        {item.description}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Signed in
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">
            {userEmail || "Admin"}
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </div>
  )
}
