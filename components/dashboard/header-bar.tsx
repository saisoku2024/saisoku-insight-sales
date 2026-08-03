"use client"

import {
  Clock3,
  Menu,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

import { BrandMark } from "@/components/shared/brand-mark"

type HeaderBarProps = {
  title: string
  description: string
  userRole?: string | null
  currentDateLabel: string
  onOpenSidebar: () => void
  sidebarCollapsed: boolean
  onToggleSidebarCollapsed: () => void
  isDark: boolean
  onToggleTheme: () => void
}

export function HeaderBar({
  title,
  description,
  userRole,
  currentDateLabel,
  onOpenSidebar,
  sidebarCollapsed,
  onToggleSidebarCollapsed,
  isDark,
  onToggleTheme,
}: HeaderBarProps) {
  const roleLabel = userRole === "owner" ? "Owner" : userRole === "viewer" ? "Viewer" : "Admin"

  return (
    <header
      className="
        sticky top-0 z-30
        flex h-[64px] items-center justify-between gap-4
        border-b-[3px] border-[var(--insight-border)]
        bg-[var(--insight-card)]
        px-4 sm:px-5
        transition-colors duration-300
      "
    >
      <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="insight-button inline-flex h-10 w-10 items-center justify-center lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={onToggleSidebarCollapsed}
            className="insight-button hidden h-9 w-9 items-center justify-center lg:inline-flex"
            aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>

          <BrandMark />

          <div className="hidden h-7 w-px bg-[var(--insight-border)] opacity-30 sm:block" />

          <div className="hidden sm:block">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-[var(--insight-text)]">
              {title}
            </h1>
            <p className="truncate text-[11px] leading-tight text-[var(--insight-muted)]">
              {description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            className="
              hidden lg:flex
              h-9
              items-center gap-2
              border-[3px] border-[var(--insight-border)]
              bg-[var(--insight-panel)]
              px-2.5
              shadow-[3px_3px_0_var(--insight-shadow)]
            "
          >
            <Clock3 className="h-4 w-4 text-[var(--insight-blue)]" />
            <span className="text-lg leading-none text-[var(--insight-text)]">
              {currentDateLabel}
            </span>
          </div>

          {userRole === "viewer" ? (
            <div
              className="
                flex
                h-9
                items-center gap-1.5
                border-[3px] border-[var(--insight-border)]
                bg-amber-100 dark:bg-amber-950/40
                px-2.5
                shadow-[3px_3px_0_var(--insight-shadow)]
                text-amber-800 dark:text-amber-200
                font-bold text-xs leading-none uppercase
              "
            >
              <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border border-amber-600" />
              Guest Mode
            </div>
          ) : null}

          <button
            type="button"
            onClick={onToggleTheme}
            className="insight-button flex h-9 min-w-[48px] items-center justify-center px-2"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
          </button>
          
          <div
            className="
              hidden h-9 items-center gap-2
              border-[3px] border-[var(--insight-border)]
              bg-[var(--insight-panel)]
              px-2.5
              shadow-[3px_3px_0_var(--insight-shadow)]
              md:flex
            "
          >
            <div className="relative">
              <div
                className="
                  h-5 w-5
                  border-2 border-[var(--insight-border)]
                  bg-[var(--insight-blue)]
                "
              />
              <span
                className="
                  absolute bottom-0 right-0
                  h-3 w-3
                  rounded-full
                  border-2 border-white dark:border-slate-800
                  bg-emerald-500
                "
              />
            </div>

            <div className="flex min-w-0 items-center gap-1.5">
              <span className="text-lg leading-none text-[var(--insight-text)]">
                {roleLabel}
              </span>
              <span className="text-base leading-none text-emerald-600 dark:text-emerald-400">
                Online
              </span>
            </div>
          </div>
        </div>
    </header>
  )
}
