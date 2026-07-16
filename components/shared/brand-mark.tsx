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
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-9 w-9 items-center justify-center border-[3px] border-[var(--insight-border)] bg-[var(--insight-cyan)] text-[var(--insight-text)] shadow-[3px_3px_0_var(--insight-shadow)]">
        <Activity className="h-5 w-5" />
      </div>

      {!compact ? (
        <div>
          <div
            className={cn(
              "text-[28px] leading-none tracking-normal",
              inverted ? "text-white" : "text-[var(--insight-text)]"
            )}
          >
            INSIGHT
          </div>
        </div>
      ) : null}
    </div>
  )
}
