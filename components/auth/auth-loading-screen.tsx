import { LoaderCircle } from "lucide-react"

import { BrandMark } from "@/components/brand/brand-mark"

export function AuthLoadingScreen({
  title = "Menyiapkan dashboard",
  description = "Mohon tunggu sebentar...",
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f5f7fb,white_45%,#eef2ff)] px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-200/60 backdrop-blur">
        <BrandMark />

        <div className="mt-8 flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mt-0.5 rounded-full bg-slate-950/5 p-2 text-slate-700">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
