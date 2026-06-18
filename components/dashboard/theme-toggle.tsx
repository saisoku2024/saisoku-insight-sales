"use client"

import { Moon, SunMedium } from "lucide-react"

export function ThemeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="
      inline-flex
      h-11 w-11
      items-center justify-center
      rounded-2xl
      border border-slate-200
      bg-white
      text-slate-700
      shadow-sm
      transition
      hover:bg-slate-50

      dark:border-white/10
      dark:bg-slate-900/50
      dark:text-white
      "
      aria-label={isDark ? "Mode terang" : "Mode gelap"}
    >
      {isDark ? (
        <SunMedium className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  )
}