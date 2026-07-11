"use client"

import { useEffect, useMemo, useState } from "react"

import { supabase } from "@/lib/supabaseClient"

type UserBalance = {
  id: string
  username: string | null
  telegram_id: number | null
  role: string
  balance: number
  is_active: boolean
}

type BalanceLog = {
  id: string
  amount: number
  type: string
  note: string | null
  created_at: string | null
  users?: { username: string | null; telegram_id: number | null } | null
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

export default function BalancePage() {
  const [users, setUsers] = useState<UserBalance[]>([])
  const [logs, setLogs] = useState<BalanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const totalBalance = useMemo(
    () => users.reduce((total, user) => total + Number(user.balance || 0), 0),
    [users]
  )

  async function loadBalanceData() {
    const [usersResult, logsResult] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, telegram_id, role, balance, is_active")
        .order("balance", { ascending: false })
        .limit(10),
      supabase
        .from("balance_logs")
        .select("id, amount, type, note, created_at, users(username, telegram_id)")
        .order("created_at", { ascending: false })
        .limit(10),
    ])

    if (usersResult.error) {
      setError(usersResult.error.message)
      setUsers([])
    } else {
      setUsers((usersResult.data as UserBalance[]) || [])
    }

    if (logsResult.error) {
      setError((current) => current ?? logsResult.error.message)
      setLogs([])
    } else {
      setLogs((logsResult.data as unknown as BalanceLog[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadBalanceData)
  }, [])

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
          BUSINESS MANAGEMENT
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Wallet Balance</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Read-only view saldo user dan mutasi balance terbaru.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-4 text-xl text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Total User Balance</div>
          <div className="mt-2 text-[34px] leading-none">{rupiah(totalBalance)}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Users</div>
          <div className="mt-2 text-[34px] leading-none">{users.length}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Balance Logs</div>
          <div className="mt-2 text-[34px] leading-none">{logs.length}</div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-[3px] border-[var(--insight-border)] p-4">
          <h2 className="text-[30px] leading-none">User Balance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Telegram ID</th>
                <th className="p-3">Role</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">@{user.username || "-"}</td>
                  <td className="p-3">{user.telegram_id || "-"}</td>
                  <td className="p-3">{user.role}</td>
                  <td className="p-3">{rupiah(user.balance)}</td>
                  <td className="p-3">{user.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
              {!loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Belum ada data user.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-[3px] border-[var(--insight-border)] p-4">
          <h2 className="text-[30px] leading-none">Latest Balance Logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">User</th>
                <th className="p-3">Type</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{formatDate(log.created_at)}</td>
                  <td className="p-3">@{log.users?.username || log.users?.telegram_id || "-"}</td>
                  <td className="p-3">{log.type}</td>
                  <td className="p-3">{rupiah(log.amount)}</td>
                  <td className="p-3">{log.note || "-"}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Belum ada mutasi saldo.
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
