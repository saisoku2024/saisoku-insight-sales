import { Activity } from "lucide-react"

import { cn } from "@/lib/utils"

type BrandMarkProps = {
  compact?: boolean
  inverted?: boolean
  className?: string
}

export function BrandMark({ compact = false, inverted = false, className }: BrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-950 text-white shadow-lg shadow-gray-950/20 ring-1 ring-white/10">
        <Activity className="h-5 w-5" />
      </div>
      {!compact ? (
        <div>
          <div className={cn("text-sm font-semibold uppercase tracking-[0.24em]", inverted ? "text-slate-300" : "text-gray-500")}>INSIGHT</div>
          <div className={cn("text-lg font-semibold tracking-tight", inverted ? "text-white" : "text-gray-950")}>
            Integrated Sales Intelligence &amp; Growth Hub
          </div>
        </div>
      ) : null}
    </div>
  )
}
