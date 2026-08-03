"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, LogOut } from "lucide-react"

import type { DashboardNavEntry, DashboardNavItem } from "@/config/navigation"
import { cn } from "@/lib/utils"
import { isActivePath } from "@/config/navigation"

type SidebarNavProps = {
  pathname: string
  groups: DashboardNavEntry[]
  isLoggingOut: boolean
  onNavigate?: () => void
  onLogout: () => void
}

function SidebarItem({
  item,
  pathname,
  onNavigate,
  onBeforeNavigate,
}: {
  item: DashboardNavItem
  pathname: string
  onNavigate?: () => void
  onBeforeNavigate?: () => void
}) {
  const active = isActivePath(pathname, item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={() => {
        onBeforeNavigate?.()
        onNavigate?.()
      }}
      className={cn(
        "group flex h-9 items-center gap-2.5 border-[3px] px-2.5 text-[14px] font-medium leading-none transition-all",
        active
          ? "border-blue-700 bg-[var(--insight-blue)] text-white shadow-[2px_2px_0_var(--insight-shadow)]"
          : "border-[var(--insight-border)] bg-[var(--insight-panel)] text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 hover:bg-blue-100 dark:hover:bg-slate-700"
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center border-2",
          active
            ? "border-white/30 bg-white/10 text-white"
            : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)]"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <span className="min-w-0 flex-1 truncate">{item.title}</span>
    </Link>
  )
}

export function SidebarNav({
  pathname,
  groups,
  isLoggingOut,
  onNavigate,
  onLogout,
}: SidebarNavProps) {
  const activeGroupLabel = useMemo(() => {
    const activeEntry = groups.find((entry) => {
      return entry.type === "group" && entry.items.some((item) => isActivePath(pathname, item.href))
    })

    return activeEntry?.type === "group" ? activeEntry.label : null
  }, [groups, pathname])
  const [manualOpenGroup, setManualOpenGroup] = useState<string | null>(null)
  const openGroupLabel = manualOpenGroup ?? activeGroupLabel

  const toggleGroup = (label: string) => {
    setManualOpenGroup((currentLabel) => (currentLabel === label ? null : label))
  }

  return (
    <div
      className="
        flex h-full flex-col
        border-r-[3px] border-[var(--insight-border)]
        bg-[var(--insight-card)]
        p-3
      "
    >
      <div className="space-y-3 overflow-y-auto pr-1">
        {groups.map((entry) => {
          if (entry.type === "item") {
            return (
              <SidebarItem
                key={entry.item.href}
                item={entry.item}
                pathname={pathname}
                onNavigate={onNavigate}
                onBeforeNavigate={() => setManualOpenGroup(null)}
              />
            )
          }

          const isOpen = openGroupLabel === entry.label

          return (
            <div key={entry.label} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggleGroup(entry.label)}
                className="insight-button flex h-9 w-full items-center justify-between px-2.5 text-[14px] font-semibold uppercase tracking-[0.05em] leading-none text-left"
              >
                <span>{entry.label}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} />
              </button>

              {isOpen && (
                <div className="space-y-1.5 pl-2">
                  {entry.items.map((item) => (
                    <SidebarItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onNavigate={onNavigate}
                      onBeforeNavigate={() => setManualOpenGroup(null)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 border-t-2 border-[var(--insight-border)] pt-3">
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="insight-button inline-flex w-full items-center justify-center gap-2 px-3 py-1.5 text-[14px] font-semibold leading-none disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out..." : "Logout"}
        </button>

        <div className="mt-3 flex items-center justify-center">
          <span className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-widest text-[var(--insight-muted)] shadow-[2px_2px_0_var(--insight-shadow)]">
            INSIGHT PANEL v3.0.0
          </span>
        </div>
      </div>
    </div>
  )
}
