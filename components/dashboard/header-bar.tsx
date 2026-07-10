"use client"

import {
  Clock3,
  Menu,
  Sun,
  Moon,
} from "lucide-react"

type HeaderBarProps = {
  title: string
  description: string
  userEmail?: string | null
  currentDateLabel: string
  onOpenSidebar: () => void
  isDark: boolean
  onToggleTheme: () => void
}

export function HeaderBar({
  title,
  description,
  userEmail,
  currentDateLabel,
  onOpenSidebar,
  isDark,
  onToggleTheme,
}: HeaderBarProps) {
  return (
    <header
      className="
        sticky top-0 z-30
        flex h-[60px] items-center justify-between gap-4
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

          <div className="flex h-9 w-9 shrink-0 items-center justify-center border-[3px] border-[var(--insight-border)] bg-[var(--insight-cyan)] text-base shadow-[3px_3px_0_var(--insight-shadow)]">
            ID
          </div>

          <div>
            <h1 className="truncate text-[28px] leading-none text-[var(--insight-text)]">
              {title}
            </h1>
            <p className="-mt-0.5 hidden truncate text-base leading-none text-[var(--insight-muted)] sm:block">
              {description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            className="
              hidden lg:flex
              h-10
              items-center gap-2
              border-[3px] border-[var(--insight-border)]
              bg-[var(--insight-panel)]
              px-3
              shadow-[4px_4px_0_var(--insight-shadow)]
            "
          >
            <Clock3 className="h-4 w-4 text-[var(--insight-blue)]" />
            <span className="text-xl leading-none text-[var(--insight-text)]">
              {currentDateLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="insight-button flex h-10 min-w-[55px] items-center justify-center px-3"
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
          </button>
          
          <div
            className="
              hidden h-10 items-center gap-2
              border-[3px] border-[var(--insight-border)]
              bg-[var(--insight-panel)]
              px-3
              shadow-[4px_4px_0_var(--insight-shadow)]
              md:flex
            "
          >
            <div className="relative">
              <div
                className="
                  h-6 w-6
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

            <div className="min-w-0">
              <p className="max-w-[180px] truncate text-xl leading-none text-[var(--insight-text)]">
                {userEmail || "Admin"}
              </p>
              <p className="text-base leading-none text-emerald-600 dark:text-emerald-400">
                Online
              </p>
            </div>
          </div>
        </div>
    </header>
  )
}
