"use client"

import { Moon, SunMedium } from "lucide-react"

export function AuthThemeToggle({
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
      className="insight-button inline-flex h-10 min-w-[55px] items-center justify-center px-3"
      aria-label={isDark ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={isDark ? "Mode terang" : "Mode gelap"}
    >
      {isDark ? <SunMedium className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
