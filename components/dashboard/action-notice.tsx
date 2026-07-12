"use client"

export type ActionNoticeState = {
  type: "success" | "error" | "info"
  message: string
} | null

type ActionNoticeProps = {
  notice: ActionNoticeState
  onDismiss: () => void
}

export function ActionNotice({ notice, onDismiss }: ActionNoticeProps) {
  if (!notice) return null

  const colorClass =
    notice.type === "success"
      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
      : notice.type === "error"
      ? "border-red-600 bg-red-50 text-red-800"
      : "border-blue-600 bg-blue-50 text-blue-800"

  return (
    <div
      role="status"
      className={`insight-card flex items-start justify-between gap-3 p-4 text-xl ${colorClass}`}
    >
      <span>{notice.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="border-[3px] border-current px-2 leading-none"
        aria-label="Dismiss notification"
      >
        x
      </button>
    </div>
  )
}
