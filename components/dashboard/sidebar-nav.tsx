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
    <div
      className="
        flex h-full flex-col
        rounded-[32px]
        border border-white/60
        bg-white/80
        dark:border-white/10
        dark:bg-slate-900/50
        p-5
        backdrop-blur-xl
        shadow-[0_20px_60px_rgba(15,23,42,0.08)]
        dark:shadow-[0_20px_60px_rgba(0,0,0,0.45)]
      "
    >
      <BrandMark className="px-2 pb-6" compact />

      <div className="space-y-6 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="px-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
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
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                        active
                          ? "border-white/10 bg-white/10 text-white"
                          : "border-slate-200 bg-white text-slate-500 group-hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.title}</span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs leading-5",
                          active 
                            ? "text-slate-200" 
                            : "text-slate-400 dark:text-slate-500"
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

      <div className="mt-6 border-t border-slate-200 dark:border-white/10 pt-4">
        <div
          className="
            rounded-3xl
            border border-slate-200
            bg-gradient-to-br from-slate-50 to-slate-100
            dark:border-white/10
            dark:from-slate-900
            dark:to-slate-800
            p-4
          "
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
            {userEmail?.charAt(0).toUpperCase() ?? "A"}
          </div>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {userEmail || "Admin"}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Administrator
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out..." : "Logout"}
        </button>
      </div>
    </div>
  )
}