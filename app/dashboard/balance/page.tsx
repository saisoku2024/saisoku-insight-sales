"use client"

import { useCallback, useEffect, useState } from "react"

import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice"
import { ToolbarSelect } from "@/components/dashboard/toolbar-select"
import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context"
import { adminWrite } from "@/services/admin/admin-api-client"
import { supabase } from "@/lib/supabase/client"

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

type BalanceData = {
  users: UserBalance[]
  logs: BalanceLog[]
  usersTotal: number
  logsTotal: number
  totalBalance: number
}

type BalanceAction = "add" | "deduct" | "reset"

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

function actionLabel(action: BalanceAction) {
  if (action === "add") return "Add Balance"
  if (action === "deduct") return "Deduct Balance"
  return "Reset Balance"
}

export default function BalancePage() {
  const isViewer = useIsViewer()
  const pageSize = 10
  const [users, setUsers] = useState<UserBalance[]>([])
  const [logs, setLogs] = useState<BalanceLog[]>([])
  const [usersPage, setUsersPage] = useState(1)
  const [logsPage, setLogsPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [logsTotal, setLogsTotal] = useState(0)
  const [totalBalance, setTotalBalance] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserBalance | null>(null)
  const [telegramId, setTelegramId] = useState("")
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [action, setAction] = useState<BalanceAction>("add")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<ActionNoticeState>(null)

  const showError = (message: string) => setNotice({ type: "error", message })
  const showSuccess = (message: string) => setNotice({ type: "success", message })
  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error")
  const viewerDisabledClass = " disabled:cursor-not-allowed disabled:opacity-50"
  const balanceControlClass = "box-border h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-0 text-sm leading-none text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] outline-none"
  const balanceSubmitClass = "inline-flex box-border h-9 items-center justify-center border-2 border-[var(--insight-border)] bg-violet-700 px-3.5 py-0 text-sm leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:bg-violet-600 disabled:opacity-40"

  const loadBalanceData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Session admin tidak ditemukan. Silakan login ulang.")
      }

      const params = new URLSearchParams({
        usersPage: String(usersPage),
        logsPage: String(logsPage),
        pageSize: String(pageSize),
      })
      const res = await fetch(`/api/admin/balance?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await res.json()) as { data?: BalanceData; error?: string }

      if (!res.ok || !result.data) {
        throw new Error(result.error || "Gagal memuat data balance.")
      }

      setUsers(result.data.users)
      setLogs(result.data.logs)
      setUsersTotal(result.data.usersTotal)
      setLogsTotal(result.data.logsTotal)
      setTotalBalance(result.data.totalBalance)
    } catch (error) {
      console.error("loadBalanceData error:", error)
      setError(getErrorMessage(error))
      setUsers([])
      setLogs([])
      setUsersTotal(0)
      setLogsTotal(0)
      setTotalBalance(0)
    }

    setLoading(false)
  }, [logsPage, usersPage])

  useEffect(() => {
    void loadBalanceData()
  }, [loadBalanceData])

  function chooseUser(user: UserBalance, nextAction: BalanceAction) {
    setSelectedUser(user)
    setTelegramId(user.telegram_id ? String(user.telegram_id) : "")
    setAction(nextAction)
    setAmount(nextAction === "reset" ? "" : amount)
    setNote("")
  }

  async function submitBalanceAction() {
    if (saving) return

    const numericTelegramId = Number(telegramId)
    const numericAmount = Number(amount || 0)

    if (!numericTelegramId || numericTelegramId <= 0) {
      showError("Telegram ID target wajib valid.")
      return
    }

    if (action !== "reset" && numericAmount <= 0) {
      showError("Nominal wajib lebih dari 0.")
      return
    }

    setSaving(true)

    try {
      const response = await adminWrite<{ user: UserBalance; result: { new_balance?: number } }>(
        "/api/admin/balance",
        {
          body: {
            action,
            telegram_id: numericTelegramId,
            amount: numericAmount,
            note,
          },
        }
      )

      const newBalance = Number(response?.user?.balance ?? response?.result?.new_balance ?? 0)
      showSuccess(`${actionLabel(action)} berhasil. Saldo baru: ${rupiah(newBalance)}.`)
      setSelectedUser(response?.user || null)
      setAmount("")
      setNote("")
      await loadBalanceData()
    } catch (error) {
      console.error("submitBalanceAction error:", error)
      showError(`Gagal mengubah balance: ${getErrorMessage(error)}`)
    }

    setSaving(false)
  }

  return (
    <div className="space-y-4 text-[var(--insight-text)]">
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-violet-100 px-2.5 py-0.5 text-xs font-bold leading-none text-violet-800">
          BUSINESS MANAGEMENT
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none">Wallet Balance</h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Kelola saldo user, adjustment owner, dan mutasi balance terbaru.
        </p>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Total User Balance</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">{rupiah(totalBalance)}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Users</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">{usersTotal}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Balance Logs</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">{logsTotal}</div>
        </div>
      </div>

      <div className="insight-card p-3.5">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold leading-none">Balance Adjustment</h2>
          <p className="text-sm text-[var(--insight-muted)]">
            Aksi ini khusus owner. Pilih user dari tabel atau masukkan Telegram ID manual.
          </p>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[180px_1fr_1fr_1.5fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs text-[var(--insight-muted)]">Action</span>
            <div className="mt-1">
              <ToolbarSelect
                value={action}
                options={[
                  { value: "add", label: "Add Balance" },
                  { value: "deduct", label: "Deduct Balance" },
                  { value: "reset", label: "Reset Balance" },
                ]}
                onChange={(nextAction) => setAction(nextAction as BalanceAction)}
                minWidth={180}
                ariaLabel="Balance action"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs text-[var(--insight-muted)]">Telegram ID</span>
            <input
              value={telegramId}
              onChange={(e) => {
                setTelegramId(e.target.value)
                setSelectedUser(null)
              }}
              className={`mt-1 ${balanceControlClass}`}
              placeholder="123456789"
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--insight-muted)]">Nominal</span>
            <input
              type="number"
              min="0"
              value={amount}
              disabled={action === "reset"}
              onChange={(e) => setAmount(e.target.value)}
              className={`mt-1 ${balanceControlClass} disabled:opacity-50`}
              placeholder={action === "reset" ? "Auto" : "10000"}
            />
          </label>

          <label className="block">
            <span className="text-xs text-[var(--insight-muted)]">Note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`mt-1 ${balanceControlClass}`}
              placeholder="Adjustment owner"
            />
          </label>

          <button
            type="button"
            onClick={() => void submitBalanceAction()}
            disabled={saving || isViewer}
            title={isViewer ? viewerOnlyTitle : undefined}
            className={balanceSubmitClass + viewerDisabledClass}
          >
            {saving ? "Saving..." : actionLabel(action)}
          </button>
        </div>

        {selectedUser ? (
          <div className="mt-2 text-xs text-[var(--insight-muted)]">
            Target: @{selectedUser.username || "-"} / {selectedUser.telegram_id || "-"} / saldo {rupiah(selectedUser.balance)}
          </div>
        ) : null}
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-2 border-[var(--insight-border)] p-3 px-4 bg-[var(--insight-panel)]">
          <h2 className="text-lg font-bold leading-none">User Balance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm">User</th>
                <th className="px-4 py-3 text-sm">Telegram ID</th>
                <th className="px-4 py-3 text-sm">Role</th>
                <th className="px-4 py-3 text-sm">Balance</th>
                <th className="px-4 py-3 text-sm">Status</th>
                <th className="px-4 py-3 text-sm text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Loading balance...
                  </td>
                </tr>
              ) : null}

              {!loading && users.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 text-sm">@{user.username || "-"}</td>
                  <td className="px-4 py-2.5 text-sm">{user.telegram_id || "-"}</td>
                  <td className="px-4 py-2.5 text-sm">{user.role}</td>
                  <td className="px-4 py-2.5 text-sm">{rupiah(user.balance)}</td>
                  <td className="px-4 py-2.5 text-sm">{user.is_active ? "Active" : "Inactive"}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (isViewer) return
                          chooseUser(user, "add")
                        }}
                        disabled={isViewer}
                        title={isViewer ? viewerOnlyTitle : undefined}
                        className={"border-2 border-[var(--insight-border)] bg-emerald-700 px-2.5 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition" + viewerDisabledClass}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isViewer) return
                          chooseUser(user, "deduct")
                        }}
                        disabled={isViewer}
                        title={isViewer ? viewerOnlyTitle : undefined}
                        className={"border-2 border-[var(--insight-border)] bg-amber-600 px-2.5 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition" + viewerDisabledClass}
                      >
                        Deduct
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isViewer) return
                          chooseUser(user, "reset")
                        }}
                        disabled={isViewer}
                        title={isViewer ? viewerOnlyTitle : undefined}
                        className={"border-2 border-[var(--insight-border)] bg-slate-700 px-2.5 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition" + viewerDisabledClass}
                      >
                        Reset
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Belum ada data user.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={usersPage}
          pageSize={pageSize}
          totalRows={usersTotal}
          onPageChange={setUsersPage}
        />
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-2 border-[var(--insight-border)] p-3 px-4 bg-[var(--insight-panel)]">
          <h2 className="text-lg font-bold leading-none">Latest Balance Logs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm">Date</th>
                <th className="px-4 py-3 text-sm">User</th>
                <th className="px-4 py-3 text-sm">Type</th>
                <th className="px-4 py-3 text-sm">Amount</th>
                <th className="px-4 py-3 text-sm">Note</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 text-sm">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-2.5 text-sm">@{log.users?.username || log.users?.telegram_id || "-"}</td>
                  <td className="px-4 py-2.5 text-sm">{log.type}</td>
                  <td className="px-4 py-2.5 text-sm">{rupiah(log.amount)}</td>
                  <td className="px-4 py-2.5 text-sm">{log.note || "-"}</td>
                </tr>
              ))}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Belum ada mutasi saldo.
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
    </div>
  )
}
