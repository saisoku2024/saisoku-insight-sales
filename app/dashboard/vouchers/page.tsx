"use client"

import { useCallback, useEffect, useState } from "react"

import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice"
import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { adminWrite } from "@/lib/admin-api-client"
import { supabase } from "@/lib/supabaseClient"

type TargetRole = "reguler" | "reseller" | "both"

type Voucher = {
  id: string
  code: string
  reward_type: string
  reward_amount: number
  quota: number
  used_count: number
  is_active: boolean
  expired_at: string | null
  target_role?: TargetRole | null
}

type VoucherResponse = {
  vouchers: Voucher[]
  totalRows: number
  activeTotal: number
  claimCount: number
}

type VoucherForm = {
  code: string
  reward_amount: string
  quota: string
  target_role: TargetRole
  expired_at: string
  is_active: boolean
}

const emptyForm: VoucherForm = {
  code: "",
  reward_amount: "0",
  quota: "1",
  target_role: "both",
  expired_at: "",
  is_active: true,
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
  return new Date(value).toLocaleDateString("id-ID")
}

function roleLabel(role?: string | null) {
  if (role === "reguler") return "Reguler"
  if (role === "reseller") return "Reseller"
  return "Both"
}

export default function VouchersPage() {
  const pageSize = 10
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [form, setForm] = useState<VoucherForm>(emptyForm)
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null)
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [activeTotal, setActiveTotal] = useState(0)
  const [claimCount, setClaimCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<ActionNoticeState>(null)

  const showError = (message: string) => setNotice({ type: "error", message })
  const showSuccess = (message: string) => setNotice({ type: "success", message })
  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error")

  const loadVouchers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Session admin tidak ditemukan. Silakan login ulang.")
      }

      const res = await fetch(`/api/admin/vouchers?page=${page}&pageSize=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await res.json()) as { data?: VoucherResponse; error?: string }

      if (!res.ok || !result.data) {
        throw new Error(result.error || "Gagal memuat voucher.")
      }

      setVouchers(result.data.vouchers)
      setTotalRows(result.data.totalRows)
      setActiveTotal(result.data.activeTotal)
      setClaimCount(result.data.claimCount)
    } catch (error) {
      console.error("loadVouchers error:", error)
      setError(getErrorMessage(error))
      setVouchers([])
      setTotalRows(0)
      setActiveTotal(0)
      setClaimCount(0)
    }

    setLoading(false)
  }, [page])

  useEffect(() => {
    void loadVouchers()
  }, [loadVouchers])

  function resetForm() {
    setForm(emptyForm)
    setEditingVoucher(null)
  }

  function startEdit(voucher: Voucher) {
    setEditingVoucher(voucher)
    setForm({
      code: voucher.code || "",
      reward_amount: String(voucher.reward_amount ?? 0),
      quota: String(voucher.quota ?? 1),
      target_role: voucher.target_role || "both",
      expired_at: voucher.expired_at ? voucher.expired_at.slice(0, 10) : "",
      is_active: voucher.is_active,
    })
  }

  function payloadFromForm() {
    return {
      code: form.code.trim(),
      reward_amount: Number(form.reward_amount || 0),
      quota: Number(form.quota || 0),
      target_role: form.target_role,
      expired_at: form.expired_at || null,
      is_active: form.is_active,
    }
  }

  async function saveVoucher() {
    if (saving) return

    setSaving(true)

    try {
      const payload = payloadFromForm()

      if (editingVoucher) {
        await adminWrite<Voucher>("/api/admin/vouchers", {
          method: "PATCH",
          body: {
            id: editingVoucher.id,
            ...payload,
          },
        })
        showSuccess("Voucher berhasil diupdate.")
      } else {
        await adminWrite<Voucher>("/api/admin/vouchers", {
          body: payload,
        })
        showSuccess("Voucher berhasil ditambahkan.")
      }

      resetForm()
      await loadVouchers()
    } catch (error) {
      console.error("saveVoucher error:", error)
      showError(`Gagal menyimpan voucher: ${getErrorMessage(error)}`)
    }

    setSaving(false)
  }

  async function toggleVoucher(voucher: Voucher) {
    try {
      await adminWrite<Voucher>("/api/admin/vouchers", {
        method: "PATCH",
        body: {
          id: voucher.id,
          action: "toggle_status",
          is_active: !voucher.is_active,
        },
      })
      showSuccess(`Voucher ${voucher.code} berhasil ${voucher.is_active ? "dinonaktifkan" : "diaktifkan"}.`)
      await loadVouchers()
    } catch (error) {
      console.error("toggleVoucher error:", error)
      showError(`Gagal mengubah status voucher: ${getErrorMessage(error)}`)
    }
  }

  async function deleteVoucher(voucher: Voucher) {
    const confirmed = confirm(`Hapus voucher ${voucher.code}?`)
    if (!confirmed) return

    try {
      await adminWrite("/api/admin/vouchers", {
        method: "DELETE",
        body: { id: voucher.id },
      })
      showSuccess(`Voucher ${voucher.code} berhasil dihapus.`)
      await loadVouchers()
    } catch (error) {
      console.error("deleteVoucher error:", error)
      showError(`Gagal hapus voucher: ${getErrorMessage(error)}`)
    }
  }

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
          BUSINESS
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Voucher Management</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Kelola voucher deposit bonus untuk role reguler, reseller, atau keduanya.
        </p>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-4 text-xl text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Vouchers</div>
          <div className="mt-2 text-[34px] leading-none">{totalRows}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Active</div>
          <div className="mt-2 text-[34px] leading-none">{activeTotal}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Claims</div>
          <div className="mt-2 text-[34px] leading-none">{claimCount}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="insight-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl leading-none">{editingVoucher ? "Edit Voucher" : "Add Voucher"}</h2>
            {editingVoucher ? (
              <button
                type="button"
                onClick={resetForm}
                className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-3 py-1.5 text-lg leading-none"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-lg text-[var(--insight-muted)]">Kode Voucher</span>
              <input
                value={form.code}
                onChange={(e) => setForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))}
                className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
                placeholder="WELCOME10"
              />
            </label>

            <label className="block">
              <span className="text-lg text-[var(--insight-muted)]">Nominal Deposit Bonus</span>
              <input
                type="number"
                min="0"
                value={form.reward_amount}
                onChange={(e) => setForm((current) => ({ ...current, reward_amount: e.target.value }))}
                className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-lg text-[var(--insight-muted)]">Kuota</span>
                <input
                  type="number"
                  min="1"
                  value={form.quota}
                  onChange={(e) => setForm((current) => ({ ...current, quota: e.target.value }))}
                  className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
                />
              </label>
              <label className="block">
                <span className="text-lg text-[var(--insight-muted)]">Target Role</span>
                <select
                  value={form.target_role}
                  onChange={(e) => setForm((current) => ({ ...current, target_role: e.target.value as TargetRole }))}
                  className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
                >
                  <option value="both">Both</option>
                  <option value="reguler">Reguler</option>
                  <option value="reseller">Reseller</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-lg text-[var(--insight-muted)]">Expired</span>
              <input
                type="date"
                value={form.expired_at}
                onChange={(e) => setForm((current) => ({ ...current, expired_at: e.target.value }))}
                className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
              />
            </label>

            <label className="inline-flex items-center gap-3 text-lg">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))}
                className="h-5 w-5"
              />
              Aktif
            </label>

            <button
              type="button"
              onClick={() => void saveVoucher()}
              disabled={saving}
              className="w-full border-[3px] border-[var(--insight-border)] bg-violet-700 px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] hover:bg-violet-600 disabled:opacity-40"
            >
              {saving ? "Saving..." : editingVoucher ? "Update Voucher" : "Add Voucher"}
            </button>
          </div>
        </div>

        <div className="insight-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Value</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Quota</th>
                  <th className="p-3">Used</th>
                  <th className="p-3">Remaining</th>
                  <th className="p-3">Expired</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                      Loading voucher...
                    </td>
                  </tr>
                ) : null}

                {!loading && vouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                    <td className="p-3 font-bold">{voucher.code}</td>
                    <td className="p-3">Deposit Bonus</td>
                    <td className="p-3">{rupiah(voucher.reward_amount)}</td>
                    <td className="p-3">{roleLabel(voucher.target_role)}</td>
                    <td className="p-3">{voucher.quota}</td>
                    <td className="p-3">{voucher.used_count}</td>
                    <td className="p-3">{Math.max(0, voucher.quota - voucher.used_count)}</td>
                    <td className="p-3">{formatDate(voucher.expired_at)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block border-[2px] border-[var(--insight-border)] px-2 py-0.5 text-base leading-none ${
                          voucher.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {voucher.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(voucher)}
                          className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-3 py-1.5 text-lg leading-none"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleVoucher(voucher)}
                          className={`border-[3px] border-[var(--insight-border)] px-3 py-1.5 text-lg leading-none text-white shadow-[3px_3px_0_var(--insight-shadow)] ${
                            voucher.is_active ? "bg-slate-700 hover:bg-slate-600" : "bg-emerald-700 hover:bg-emerald-600"
                          }`}
                        >
                          {voucher.is_active ? "Off" : "On"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteVoucher(voucher)}
                          className="border-[3px] border-[var(--insight-border)] bg-red-700 px-3 py-1.5 text-lg leading-none text-white shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-red-600"
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                      Belum ada voucher.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  )
}
