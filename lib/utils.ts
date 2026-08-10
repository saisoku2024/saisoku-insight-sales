import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Masks sensitive email addresses in text or standalone email strings.
 * Example: "admin@saisoku.com" -> "ad***n@saisoku.com"
 * Example: "john.doe@gmail.com" -> "jo***e@gmail.com"
 * Example: "a@b.com" -> "a***@b.com"
 */
export function maskEmail(text: string | null | undefined): string {
  if (!text) return "-"
  return text.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (_, local: string, domain: string) => {
    if (local.length <= 2) {
      return `${local[0] || "*"}***@${domain}`
    }
    const visibleStart = local.slice(0, 2)
    const visibleEnd = local.slice(-1)
    return `${visibleStart}***${visibleEnd}@${domain}`
  })
}

