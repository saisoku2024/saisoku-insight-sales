import { Menu, Sparkles } from "lucide-react"

import { BrandMark } from "@/components/brand/brand-mark"

type HeaderBarProps = {
  title: string
  description: string
  userEmail?: string | null
  currentDateLabel: string
  onOpenSidebar: () => void
}

export function HeaderBar({
  title,
  description,
  userEmail,
  currentDateLabel,
  onOpenSidebar,
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-20 mb-6 rounded-[28px] border border-white/70 bg-white/80 px-4 py-4 shadow-lg shadow-slate-200/40 backdrop-blur lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block">
            <BrandMark />
          </div>

          <div className="lg:hidden">
            <p className="text-base font-semibold tracking-tight text-slate-950">{title}</p>
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 lg:flex">
          <span className="rounded-full bg-emerald-100 p-2 text-emerald-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{userEmail || "Admin"}</p>
            <p className="text-xs text-slate-500">{currentDateLabel}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 hidden items-end justify-between gap-4 lg:flex">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Activity Window
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">{currentDateLabel}</p>
        </div>
      </div>
    </header>
  )
}
