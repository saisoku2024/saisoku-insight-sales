"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ChevronDown, LogOut } from "lucide-react"

import type { DashboardNavEntry, DashboardNavItem } from "@/lib/navigation"
import { cn } from "@/lib/utils"
import { isActivePath } from "@/lib/navigation"

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
}: {
  item: DashboardNavItem
  pathname: string
  onNavigate?: () => void
}) {
  const active = isActivePath(pathname, item.href)
  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2 border-[3px] px-2.5 py-1.5 text-lg leading-none transition-all",
        active
          ? "border-blue-700 bg-[var(--insight-blue)] text-white shadow-[2px_2px_0_var(--insight-shadow)]"
          : "border-[var(--insight-border)] bg-[var(--insight-panel)] text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 hover:bg-blue-100 dark:hover:bg-slate-700"
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center border-2",
          active
            ? "border-white/30 bg-white/10 text-white"
            : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)]"
        )}
      >
        <Icon className="h-4 w-4" />
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  // Initialize group state on path changes
  useEffect(() => {
    const nextOpenGroups: Record<string, boolean> = { ...openGroups }
    groups.forEach((entry) => {
      if (entry.type === "group") {
        const hasActiveChild = entry.items.some((item) => isActivePath(pathname, item.href))
        if (hasActiveChild) {
          nextOpenGroups[entry.label] = true
        }
      }
    })
    setOpenGroups(nextOpenGroups)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, groups])

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }))
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
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {groups.map((entry) => {
          if (entry.type === "item") {
            return (
              <SidebarItem
                key={entry.item.href}
                item={entry.item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            )
          }

          const isOpen = Boolean(openGroups[entry.label])

          return (
            <div key={entry.label} className="space-y-1.5">
              <button
                type="button"
                onClick={() => toggleGroup(entry.label)}
                className="insight-button flex w-full items-center justify-between px-2.5 py-1.5 text-lg leading-none text-left"
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
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 border-t-2 border-[var(--insight-border)] pt-3">
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="insight-button inline-flex w-full items-center justify-center gap-2 px-3 py-1.5 text-lg disabled:cursor-not-allowed disabled:opacity-70"
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? "Signing out..." : "Logout"}
        </button>

        <div className="mt-3 text-center text-sm leading-tight text-[var(--insight-muted)]">
          INSIGHT PANEL
          <br />
          Version 3.0
        </div>
      </div>
    </div>
  )
}
