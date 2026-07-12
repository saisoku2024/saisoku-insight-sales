"use client"

import { useCallback, useEffect, useState } from "react"

import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { supabase } from "@/lib/supabaseClient"

type AuditLog = {
  id: string
  admin_email: string | null
  admin_role: string | null
  action: string
  entity: string
  entity_id: string | null
  status: "success" | "failed"
  error: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type AuditResponse = {
  logs: AuditLog[]
  totalRows: number
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID")
}

function statusClass(status: AuditLog["status"]) {
  if (status === "failed") return "bg-red-100 text-red-700"
  return "bg-emerald-100 text-emerald-700"
}

function shortText(value: string | null | undefined) {
  if (!value) return "-"
  return value.length > 38 ? `${value.slice(0, 38)}...` : value
}

export default function LogAuditPage() {
  const pageSize = 10
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Session admin tidak ditemukan. Silakan login ulang.")
      }

      const res = await fetch(`/api/admin/audit?page=${page}&pageSize=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await res.json()) as { data?: AuditResponse; error?: string }

      if (!res.ok || !result.data) {
        throw new Error(result.error || "Gagal memuat audit logs.")
      }

      setLogs(result.data.logs)
      setTotalRows(result.data.totalRows)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal memuat audit logs.")
      setLogs([])
      setTotalRows(0)
    }

    setLoading(false)
  }, [page])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  return (
    <div className="space-y-4 text-[var(--insight-text)]">
      <div className="insight-card p-3">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-2.5 py-1 text-base leading-none text-violet-800">
          REPORTS
        </span>
        <h1 className="mt-2 text-[28px] leading-none">Audit Logs</h1>
        <p className="mt-1 text-lg leading-none text-[var(--insight-muted)]">
          Riwayat aksi admin/owner yang mengubah data penting.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-3 text-lg text-red-700">
          {error}
        </div>
      ) : null}

      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">Admin</th>
                <th className="p-3">Role</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3">Status</th>
                <th className="p-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-lg text-[var(--insight-muted)]">
                    Loading audit logs...
                  </td>
                </tr>
              ) : null}

              {!loading && logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{formatDate(log.created_at)}</td>
                  <td className="p-3">{shortText(log.admin_email)}</td>
                  <td className="p-3">{log.admin_role || "-"}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">{log.entity}</td>
                  <td className="p-3">{shortText(log.entity_id)}</td>
                  <td className="p-3">
                    <span className={`inline-block border-[2px] border-[var(--insight-border)] px-2 py-0.5 text-base leading-none ${statusClass(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate p-3" title={log.error || ""}>
                    {log.error || "-"}
                  </td>
                </tr>
              ))}

              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-lg text-[var(--insight-muted)]">
                    Belum ada audit log.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls page={page} pageSize={pageSize} totalRows={totalRows} onPageChange={setPage} />
      </div>
    </div>
  )
}
