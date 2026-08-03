import { Activity } from "lucide-react"

import { cn } from "@/lib/utils"

type BrandMarkProps = {
  compact?: boolean
  inverted?: boolean
  className?: string
}

export function BrandMark({
  compact = false,
  inverted = false,
  className,
}: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex h-9 w-9 items-center justify-center border-[3px] border-[var(--insight-border)] bg-[var(--insight-cyan)] text-[var(--insight-text)] shadow-[3px_3px_0_var(--insight-shadow)]">
        <Activity className="h-5 w-5" />
      </div>

      {!compact ? (
        <div>
          <div
            className={cn(
              "text-[14px] font-bold leading-none tracking-[0.12em] uppercase",
              inverted ? "text-white" : "text-[var(--insight-text)]"
            )}
          >
            INSIGHT
          </div>
          <div
            className={cn(
              "mt-0.5 text-[9px] leading-none tracking-[0.2em] uppercase",
              inverted ? "text-white/60" : "text-[var(--insight-muted)]"
            )}
          >
            by SAISOKU
          </div>
        </div>
      ) : null}
    </div>
  )
}
