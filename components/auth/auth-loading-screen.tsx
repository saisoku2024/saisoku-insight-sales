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
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="insight-card w-full max-w-md p-6">
        <BrandMark />

        <div className="mt-8 flex items-start gap-4 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-4 shadow-[4px_4px_0_var(--insight-shadow)]">
          <div className="mt-0.5 border-[3px] border-[var(--insight-border)] bg-[var(--insight-cyan)] p-2 text-[var(--insight-text)]">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>

          <div>
            <p className="text-2xl leading-none text-[var(--insight-text)]">{title}</p>
            <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">{description}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
