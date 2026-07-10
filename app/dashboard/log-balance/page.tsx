"use client"

import { useEffect, useState } from "react"

import { supabase } from "@/lib/supabaseClient"

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
  const [logs, setLogs] = useState<BalanceLog[]>([])
  const [deposits, setDeposits] = useState<DepositRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    const [logsResult, depositsResult] = await Promise.all([
      supabase
        .from("balance_logs")
        .select("id, amount, type, note, reference_id, created_at, users(username, telegram_id, balance)")
        .order("created_at", { ascending: false }),
      supabase
        .from("deposit_requests")
        .select("id, amount, final_amount, status, payment_method, telegram_id, created_at, confirmed_at, approved_at")
        .order("created_at", { ascending: false }),
    ])

    if (logsResult.error) {
      setError(logsResult.error.message)
      setLogs([])
    } else {
      setLogs((logsResult.data as unknown as BalanceLog[]) || [])
    }

    if (depositsResult.error) {
      setError((current) => current ?? depositsResult.error.message)
      setDeposits([])
    } else {
      setDeposits((depositsResult.data as DepositRequest[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-blue-100 px-3 py-1 text-lg leading-none text-blue-800">
          REPORTS
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Log Balance</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Read-only mutasi balance dan deposit request.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-4 text-xl text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Balance Logs</div>
          <div className="mt-2 text-[34px] leading-none">{logs.length}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Deposit Requests</div>
          <div className="mt-2 text-[34px] leading-none">{deposits.length}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Pending Deposit</div>
          <div className="mt-2 text-[34px] leading-none">
            {deposits.filter((deposit) => deposit.status !== "approved").length}
          </div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-[3px] border-[var(--insight-border)] p-4">
          <h2 className="text-[30px] leading-none">Balance Mutation</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">User</th>
                <th className="p-3">Type</th>
                <th className="p-3">Mutation</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{formatDate(log.created_at)}</td>
                  <td className="p-3">@{log.users?.username || log.users?.telegram_id || "-"}</td>
                  <td className="p-3">{log.type}</td>
                  <td className="p-3">{rupiah(log.amount)}</td>
                  <td className="p-3">{rupiah(Number(log.users?.balance || 0))}</td>
                  <td className="p-3">{log.note || log.reference_id || "-"}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Belum ada log balance.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-[3px] border-[var(--insight-border)] p-4">
          <h2 className="text-[30px] leading-none">Deposit Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">Deposit ID</th>
                <th className="p-3">Date</th>
                <th className="p-3">Telegram ID</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Final Amount</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((deposit) => (
                <tr key={deposit.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{deposit.id.slice(0, 8)}</td>
                  <td className="p-3">{formatDate(deposit.created_at)}</td>
                  <td className="p-3">{deposit.telegram_id}</td>
                  <td className="p-3">{rupiah(deposit.amount)}</td>
                  <td className="p-3">{rupiah(deposit.final_amount)}</td>
                  <td className="p-3">{deposit.payment_method}</td>
                  <td className="p-3">{deposit.status}</td>
                </tr>
              ))}
              {!loading && deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Belum ada deposit request.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
