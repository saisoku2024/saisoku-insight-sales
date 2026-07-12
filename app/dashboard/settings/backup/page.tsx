"use client"

import { useCallback, useEffect, useState } from "react"

import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice"
import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { adminWrite } from "@/lib/admin-api-client"
import { supabase } from "@/lib/supabaseClient"

type BackupMode = "critical" | "full"

type BackupRun = {
  id: string
  mode: BackupMode
  status: "running" | "success" | "failed"
  triggered_by: string | null
  storage_bucket: string | null
  storage_path: string | null
  tables_count: number
  rows_count: number
  error: string | null
  created_at: string
  finished_at: string | null
}

type BackupListResponse = {
  runs: BackupRun[]
  totalRows: number
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("id-ID")
}

function statusClass(status: BackupRun["status"]) {
  if (status === "success") return "bg-emerald-100 text-emerald-700"
  if (status === "failed") return "bg-red-100 text-red-700"
  return "bg-blue-100 text-blue-700"
}

export default function BackupSettingsPage() {
  const pageSize = 10
  const [runs, setRuns] = useState<BackupRun[]>([])
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const [runningMode, setRunningMode] = useState<BackupMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<ActionNoticeState>(null)

  const showError = (message: string) => setNotice({ type: "error", message })
  const showSuccess = (message: string) => setNotice({ type: "success", message })
  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error")

  const loadRuns = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Session admin tidak ditemukan. Silakan login ulang.")
      }

      const res = await fetch(`/api/admin/backups?page=${page}&pageSize=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await res.json()) as { data?: BackupListResponse; error?: string }

      if (!res.ok || !result.data) {
        throw new Error(result.error || "Gagal memuat riwayat backup.")
      }

      setRuns(result.data.runs)
      setTotalRows(result.data.totalRows)
    } catch (error) {
      console.error("loadRuns error:", error)
      setError(getErrorMessage(error))
      setRuns([])
      setTotalRows(0)
    }

    setLoading(false)
  }, [page])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  async function runManualBackup(mode: BackupMode) {
    if (runningMode) return

    setRunningMode(mode)

    try {
      const result = await adminWrite<BackupRun>("/api/admin/backups", {
        body: { mode },
      })
      showSuccess(`${mode === "full" ? "Full" : "Critical"} backup selesai: ${Number(result.rows_count || 0).toLocaleString("id-ID")} rows.`)
      await loadRuns()
    } catch (error) {
      console.error("runManualBackup error:", error)
      showError(`Backup gagal: ${getErrorMessage(error)}`)
      await loadRuns()
    }

    setRunningMode(null)
  }

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-blue-100 px-3 py-1 text-lg leading-none text-blue-800">
          SETTINGS
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Backup</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Manual backup dan auto backup data SAISOKU ke Supabase Storage private bucket.
        </p>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-4 text-xl text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Manual Critical</div>
          <div className="mt-2 text-lg text-[var(--insight-muted)]">
            Tabel transaksi, saldo, stok, voucher, loyalty, dan tiket.
          </div>
          <button
            type="button"
            onClick={() => void runManualBackup("critical")}
            disabled={Boolean(runningMode)}
            className="mt-4 border-[3px] border-[var(--insight-border)] bg-blue-700 px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] hover:bg-blue-600 disabled:opacity-40"
          >
            {runningMode === "critical" ? "Running..." : "Run Critical"}
          </button>
        </div>

        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Manual Full</div>
          <div className="mt-2 text-lg text-[var(--insight-muted)]">
            Semua tabel utama yang tercatat di sistem backup SAISOKU.
          </div>
          <button
            type="button"
            onClick={() => void runManualBackup("full")}
            disabled={Boolean(runningMode)}
            className="mt-4 border-[3px] border-[var(--insight-border)] bg-violet-700 px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] hover:bg-violet-600 disabled:opacity-40"
          >
            {runningMode === "full" ? "Running..." : "Run Full"}
          </button>
        </div>

        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Auto Backup</div>
          <div className="mt-2 text-lg text-[var(--insight-muted)]">
            Vercel Cron disiapkan untuk critical per jam dan full harian 00:10 UTC.
          </div>
          <div className="mt-4 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-2 text-lg">
            Butuh env <code>BACKUP_CRON_SECRET</code> di Vercel.
          </div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-[3px] border-[var(--insight-border)] p-4">
          <h2 className="text-[30px] leading-none">Backup Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">Created</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Status</th>
                <th className="p-3">Trigger</th>
                <th className="p-3">Tables</th>
                <th className="p-3">Rows</th>
                <th className="p-3">Storage</th>
                <th className="p-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Loading backup runs...
                  </td>
                </tr>
              ) : null}

              {!loading && runs.map((run) => (
                <tr key={run.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{formatDate(run.created_at)}</td>
                  <td className="p-3">{run.mode}</td>
                  <td className="p-3">
                    <span className={`inline-block border-[2px] border-[var(--insight-border)] px-2 py-0.5 text-base leading-none ${statusClass(run.status)}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="p-3">{run.triggered_by || "-"}</td>
                  <td className="p-3">{run.tables_count}</td>
                  <td className="p-3">{Number(run.rows_count || 0).toLocaleString("id-ID")}</td>
                  <td className="max-w-xs truncate p-3" title={run.storage_path || ""}>
                    {run.storage_bucket && run.storage_path ? `${run.storage_bucket}/${run.storage_path}` : "-"}
                  </td>
                  <td className="max-w-xs truncate p-3" title={run.error || ""}>{run.error || "-"}</td>
                </tr>
              ))}

              {!loading && runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Belum ada riwayat backup.
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
