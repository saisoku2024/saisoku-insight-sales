"use client"

type PaginationControlsProps = {
  page: number
  pageSize: number
  totalRows: number
  onPageChange: (page: number) => void
}

export function PaginationControls({
  page,
  pageSize,
  totalRows,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const from = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalRows)

  return (
    <div className="flex flex-col gap-3 border-t-[3px] border-[var(--insight-border)] p-4 text-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="text-[var(--insight-muted)]">
        Showing {from}-{to} of {totalRows.toLocaleString("id-ID")}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Prev
        </button>
        <span className="min-w-[86px] text-center">
          {page}/{totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
