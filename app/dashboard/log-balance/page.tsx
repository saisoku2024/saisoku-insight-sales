"use client"

import { useCallback, useEffect, useState } from "react"

import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { supabase } from "@/lib/supabase/client"
import { useIsViewer } from "@/components/dashboard/panel-access-context"

type BalanceLog = {
  id: string
  amount: number
  type: string
  note: string | null
  reference_id: string | null
  created_at: string | null
  users?: { username: string | null; telegram_id: number | null; balance: number } | null
}

type DepositRequest = {
  id: string
  amount: number
  final_amount: number
  status: string
  payment_method: string
  telegram_id: number
  created_at: string
  confirmed_at: string | null
  approved_at: string | null
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("id-ID")
}

export default function LogBalancePage() {
  const isViewer = useIsViewer()
  const pageSize = 10
  const [logs, setLogs] = useState<BalanceLog[]>([])
  const [deposits, setDeposits] = useState<DepositRequest[]>([])
  const [logsPage, setLogsPage] = useState(1)
  const [depositsPage, setDepositsPage] = useState(1)
  const [logsTotal, setLogsTotal] = useState(0)
  const [depositsTotal, setDepositsTotal] = useState(0)
  const [pendingDeposits, setPendingDeposits] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const logsFrom = (logsPage - 1) * pageSize
    const depositsFrom = (depositsPage - 1) * pageSize

    const [logsResult, depositsResult, pendingResult] = await Promise.all([
      supabase
        .from("balance_logs")
        .select("id, amount, type, note, reference_id, created_at, users(username, telegram_id, balance)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(logsFrom, logsFrom + pageSize - 1),
      supabase
        .from("deposit_requests")
        .select("id, amount, final_amount, status, payment_method, telegram_id, created_at, confirmed_at, approved_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(depositsFrom, depositsFrom + pageSize - 1),
      supabase
        .from("deposit_requests")
        .select("id", { count: "exact", head: true })
        .neq("status", "approved"),
    ])

    if (logsResult.error) {
      setError(logsResult.error.message)
      setLogs([])
    } else {
      setLogs((logsResult.data as unknown as BalanceLog[]) || [])
      setLogsTotal(logsResult.count || 0)
    }

    if (depositsResult.error) {
      setError((current) => current ?? depositsResult.error.message)
      setDeposits([])
    } else {
      setDeposits((depositsResult.data as DepositRequest[]) || [])
      setDepositsTotal(depositsResult.count || 0)
    }

    if (pendingResult.error) {
      setError((current) => current ?? pendingResult.error.message)
      setPendingDeposits(0)
    } else {
      setPendingDeposits(pendingResult.count || 0)
    }

    setLoading(false)
  }, [depositsPage, logsPage, pageSize])

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [loadData])

  return (
    <div className="space-y-4 text-[var(--insight-text)]">
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-blue-100 px-2.5 py-0.5 text-xs font-bold leading-none text-blue-800">
          REPORTS
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none">Log Balance</h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Read-only mutasi balance dan deposit request.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Balance Logs</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">{logsTotal}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Deposit Requests</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">{depositsTotal}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Pending Deposit</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">
            {pendingDeposits}
          </div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-2 border-[var(--insight-border)] p-3 px-4 bg-[var(--insight-panel)]">
          <h2 className="text-lg font-bold leading-none">Balance Mutation</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm">Date</th>
                <th className="px-4 py-3 text-sm">User</th>
                <th className="px-4 py-3 text-sm">Type</th>
                <th className="px-4 py-3 text-sm">Mutation</th>
                <th className="px-4 py-3 text-sm">User Current Balance</th>
                <th className="px-4 py-3 text-sm">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 text-sm">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-2.5 text-sm">
                    {isViewer ? "@***" : `@${log.users?.username || log.users?.telegram_id || "-"}`}
                  </td>
                  <td className="px-4 py-2.5 text-sm">{log.type}</td>
                  <td className="px-4 py-2.5 text-sm">{rupiah(log.amount)}</td>
                  <td className="px-4 py-2.5 text-sm">{rupiah(Number(log.users?.balance || 0))}</td>
                  <td className="px-4 py-2.5 text-sm">{log.note || log.reference_id || "-"}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Belum ada log balance.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={logsPage}
          pageSize={pageSize}
          totalRows={logsTotal}
          onPageChange={setLogsPage}
        />
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-2 border-[var(--insight-border)] p-3 px-4 bg-[var(--insight-panel)]">
          <h2 className="text-lg font-bold leading-none">Deposit Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm">Deposit ID</th>
                <th className="px-4 py-3 text-sm">Date</th>
                <th className="px-4 py-3 text-sm">Telegram ID</th>
                <th className="px-4 py-3 text-sm">Amount</th>
                <th className="px-4 py-3 text-sm">Final Amount</th>
                <th className="px-4 py-3 text-sm">Payment</th>
                <th className="px-4 py-3 text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((deposit) => (
                <tr key={deposit.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 text-sm">{deposit.id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5 text-sm">{formatDate(deposit.created_at)}</td>
                  <td className="px-4 py-2.5 text-sm">{isViewer ? "***" : deposit.telegram_id}</td>
                  <td className="px-4 py-2.5 text-sm">{rupiah(deposit.amount)}</td>
                  <td className="px-4 py-2.5 text-sm">{rupiah(deposit.final_amount)}</td>
                  <td className="px-4 py-2.5 text-sm">{deposit.payment_method}</td>
                  <td className="px-4 py-2.5 text-sm">{deposit.status}</td>
                </tr>
              ))}
              {!loading && deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Belum ada deposit request.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={depositsPage}
          pageSize={pageSize}
          totalRows={depositsTotal}
          onPageChange={setDepositsPage}
        />
      </div>
    </div>
  )
}
