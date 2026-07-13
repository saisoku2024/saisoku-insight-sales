"use client"

import { useCallback, useEffect, useState } from "react"

import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { supabase } from "@/lib/supabaseClient"

type ErrorLog = {
  id: string
  source: string
  level: "error" | "warn" | "info"
  message: string
  route: string | null
  actor: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

type ErrorLogsResponse = {
  logs: ErrorLog[]
  totalRows: number
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID")
}

function levelClass(level: ErrorLog["level"]) {
  if (level === "warn") return "bg-amber-100 text-amber-800"
  if (level === "info") return "bg-blue-100 text-blue-800"
  return "bg-red-100 text-red-700"
}

function shortText(value: string | null | undefined, max = 48) {
  if (!value) return "-"
  return value.length > max ? `${value.slice(0, max)}...` : value
}

export default function ErrorLogsPage() {
  const pageSize = 10
  const [logs, setLogs] = useState<ErrorLog[]>([])
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

      const res = await fetch(`/api/admin/error-logs?page=${page}&pageSize=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await res.json()) as { data?: ErrorLogsResponse; error?: string }

      if (!res.ok || !result.data) {
        throw new Error(result.error || "Gagal memuat error logs.")
      }

      setLogs(result.data.logs)
      setTotalRows(result.data.totalRows)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal memuat error logs.")
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
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-red-100 px-2.5 py-1 text-base leading-none text-red-800">
          REPORTS
        </span>
        <h1 className="mt-2 text-[28px] leading-none">Error Logs</h1>
        <p className="mt-1 text-lg leading-none text-[var(--insight-muted)]">
          Central log untuk error API, backup, restore, dan laporan client.
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
                <th className="p-3">Level</th>
                <th className="p-3">Source</th>
                <th className="p-3">Route</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-lg text-[var(--insight-muted)]">
                    Loading error logs...
                  </td>
                </tr>
              ) : null}

              {!loading && logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{formatDate(log.created_at)}</td>
                  <td className="p-3">
                    <span className={`inline-block border-[2px] border-[var(--insight-border)] px-2 py-0.5 text-base leading-none ${levelClass(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="p-3">{log.source}</td>
                  <td className="max-w-xs truncate p-3" title={log.route || ""}>{shortText(log.route)}</td>
                  <td className="max-w-xs truncate p-3" title={log.actor || ""}>{shortText(log.actor, 32)}</td>
                  <td className="max-w-md truncate p-3" title={log.message}>{shortText(log.message, 80)}</td>
                </tr>
              ))}

              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-lg text-[var(--insight-muted)]">
                    Belum ada error log.
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
