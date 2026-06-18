"use client"

import {
  Bell,
  Clock3,
  Menu,
  Search,
  Sun,
  Moon,
} from "lucide-react"

import { BrandMark } from "@/components/brand/brand-mark"

type HeaderBarProps = {
  title: string
  description: string
  userEmail?: string | null
  currentDateLabel: string
  onOpenSidebar: () => void
  isDark: boolean
  onToggleTheme: () => void
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) return "Good Morning"
  if (hour < 17) return "Good Afternoon"
  if (hour < 21) return "Good Evening"

  return "Good Night"
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
        sticky top-0 z-20 mb-6
        rounded-[32px]
        border border-white/80 dark:border-white/10
        bg-white/80 dark:bg-slate-900/40
        px-5 py-5
        shadow-[0_20px_50px_rgba(15,23,42,0.08)]
        backdrop-blur-xl
        transition-colors duration-300
      "
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="
              inline-flex h-11 w-11 items-center justify-center
              rounded-2xl
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
              text-slate-700 dark:text-slate-200
              lg:hidden
            "
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block">
            <BrandMark />
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {getGreeting()}
            </p>

            <h1 className="text-3xl font-bold text-slate-950 dark:text-white">
              {title}
            </h1>

            <p className="text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="
              hidden xl:flex
              items-center gap-2
              rounded-2xl
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
              px-4 py-2
            "
          >
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              placeholder="Search..."
              className="
                w-52
                bg-transparent
                text-sm text-slate-900 dark:text-white
                outline-none
                placeholder:text-slate-400 dark:placeholder:text-slate-500
              "
            />
          </div>

          <div
            className="
              hidden lg:flex
              items-center gap-2
              rounded-2xl
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
              px-4 py-2
            "
          >
            <Clock3 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {currentDateLabel}
            </span>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="
              flex h-11 w-11 items-center justify-center
              rounded-2xl
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
              text-slate-700 dark:text-slate-200
              transition hover:bg-slate-50 dark:hover:bg-slate-700
            "
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5" />}
          </button>

          <button
            className="
              relative
              h-11 w-11
              rounded-2xl
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
            "
            aria-label="Notifications"
          >
            <Bell className="mx-auto h-5 w-5 text-slate-700 dark:text-slate-200" />
            <span
              className="
                absolute right-2 top-2
                h-2 w-2
                rounded-full
                bg-red-500
              "
            />
          </button>

          <div
            className="
              flex items-center gap-3
              rounded-2xl
              border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800
              px-4 py-2
            "
          >
            <div className="relative">
              <div
                className="
                  h-10 w-10
                  rounded-full
                  bg-gradient-to-br
                  from-blue-500
                  to-indigo-600
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

            <div className="hidden md:block">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {userEmail || "Admin"}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Online
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}