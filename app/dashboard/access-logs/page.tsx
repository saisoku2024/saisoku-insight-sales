"use client"

import { useCallback, useEffect, useState } from "react"

import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { supabase } from "@/lib/supabase/client"

type AccessLog = {
  id: string
  admin_email: string | null
  admin_role: string | null
  event_type: string
  path: string | null
  ip_address: string | null
  city: string | null
  region: string | null
  country: string | null
  user_agent: string | null
  created_at: string
}

type AccessLogsResponse = {
  logs: AccessLog[]
  totalRows: number
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID")
}

function shortText(value: string | null | undefined, max = 44) {
  if (!value) return "-"
  return value.length > max ? `${value.slice(0, max)}...` : value
}

function locationText(log: AccessLog) {
  const parts = [log.city, log.region, log.country].filter(Boolean)
  return parts.length ? parts.join(", ") : "-"
}

export default function AccessLogsPage() {
  const pageSize = 10
  const [logs, setLogs] = useState<AccessLog[]>([])
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

      const res = await fetch(`/api/admin/access-logs?page=${page}&pageSize=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await res.json()) as { data?: AccessLogsResponse; error?: string }

      if (!res.ok || !result.data) {
        throw new Error(result.error || "Gagal memuat access logs.")
      }

      setLogs(result.data.logs)
      setTotalRows(result.data.totalRows)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal memuat access logs.")
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
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-sky-100 px-2.5 py-1 text-base leading-none text-sky-800">
          REPORTS
        </span>
        <h1 className="mt-2 text-[28px] leading-none">Access Logs</h1>
        <p className="mt-1 text-lg leading-none text-[var(--insight-muted)]">
          Catatan login dan page view panel berdasarkan IP, lokasi kasar, role, dan browser.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-3 text-lg text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="insight-card p-3">
          <div className="text-base text-[var(--insight-muted)]">Total Access</div>
          <div className="mt-1 text-3xl leading-none">{totalRows.toLocaleString("id-ID")}</div>
        </div>
        <div className="insight-card p-3">
          <div className="text-base text-[var(--insight-muted)]">Latest IP</div>
          <div className="mt-1 truncate text-xl leading-none" title={logs[0]?.ip_address || ""}>
            {logs[0]?.ip_address || "-"}
          </div>
        </div>
        <div className="insight-card p-3">
          <div className="text-base text-[var(--insight-muted)]">Latest Location</div>
          <div className="mt-1 truncate text-xl leading-none" title={logs[0] ? locationText(logs[0]) : ""}>
            {logs[0] ? locationText(logs[0]) : "-"}
          </div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">Event</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Path</th>
                <th className="p-3">IP</th>
                <th className="p-3">Location</th>
                <th className="p-3">Browser</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-lg text-[var(--insight-muted)]">
                    Loading access logs...
                  </td>
                </tr>
              ) : null}

              {!loading && logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{formatDate(log.created_at)}</td>
                  <td className="p-3">{log.event_type}</td>
                  <td className="p-3">{shortText(log.admin_email)}</td>
                  <td className="p-3">{log.admin_role || "-"}</td>
                  <td className="max-w-[180px] truncate p-3" title={log.path || ""}>{log.path || "-"}</td>
                  <td className="p-3">{log.ip_address || "-"}</td>
                  <td className="max-w-[180px] truncate p-3" title={locationText(log)}>{locationText(log)}</td>
                  <td className="max-w-xs truncate p-3" title={log.user_agent || ""}>{shortText(log.user_agent, 54)}</td>
                </tr>
              ))}

              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-lg text-[var(--insight-muted)]">
                    Belum ada access log.
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
