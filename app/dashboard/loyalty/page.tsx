"use client"

import { useCallback, useEffect, useState } from "react"

import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice"
import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { adminWrite } from "@/lib/admin-api-client"
import { supabase } from "@/lib/supabaseClient"

type LoyaltyTier = {
  id: number
  tier_name: string
  min_order: number
  max_order: number
  discount_amount: number
  is_active: boolean
  description: string | null
}

type LoyaltyResponse = {
  tiers: LoyaltyTier[]
  totalRows: number
  activeTotal: number
}

type LoyaltyFormState = {
  tier_name: string
  min_order: string
  max_order: string
  discount_amount: string
  description: string
  is_active: boolean
}

const emptyForm: LoyaltyFormState = {
  tier_name: "",
  min_order: "0",
  max_order: "0",
  discount_amount: "0",
  description: "",
  is_active: true,
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export default function LoyaltyPage() {
  const pageSize = 10
  const [tiers, setTiers] = useState<LoyaltyTier[]>([])
  const [form, setForm] = useState<LoyaltyFormState>(emptyForm)
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null)
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [activeTotal, setActiveTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<ActionNoticeState>(null)

  const showError = (message: string) => setNotice({ type: "error", message })
  const showSuccess = (message: string) => setNotice({ type: "success", message })
  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error")

  const loadTiers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error("Session admin tidak ditemukan. Silakan login ulang.")
      }

      const res = await fetch(`/api/admin/loyalty?page=${page}&pageSize=${pageSize}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const result = (await res.json()) as { data?: LoyaltyResponse; error?: string }

      if (!res.ok || !result.data) {
        throw new Error(result.error || "Gagal memuat loyalty tier")
      }

      setTiers(result.data.tiers)
      setTotalRows(result.data.totalRows)
      setActiveTotal(result.data.activeTotal)
    } catch (error) {
      console.error("loadTiers error:", error)
      setError(getErrorMessage(error))
      setTiers([])
      setTotalRows(0)
      setActiveTotal(0)
    }

    setLoading(false)
  }, [page])

  useEffect(() => {
    void loadTiers()
  }, [loadTiers])

  function resetForm() {
    setForm(emptyForm)
    setEditingTier(null)
  }

  function startEdit(tier: LoyaltyTier) {
    setEditingTier(tier)
    setForm({
      tier_name: tier.tier_name || "",
      min_order: String(tier.min_order ?? 0),
      max_order: String(tier.max_order ?? 0),
      discount_amount: String(tier.discount_amount ?? 0),
      description: tier.description || "",
      is_active: tier.is_active,
    })
  }

  function payloadFromForm() {
    return {
      tier_name: form.tier_name.trim(),
      min_order: Number(form.min_order || 0),
      max_order: Number(form.max_order || 0),
      discount_amount: Number(form.discount_amount || 0),
      description: form.description.trim(),
      is_active: form.is_active,
    }
  }

  async function saveTier() {
    if (saving) return

    setSaving(true)

    try {
      const payload = payloadFromForm()

      if (editingTier) {
        await adminWrite<LoyaltyTier>("/api/admin/loyalty", {
          method: "PATCH",
          body: {
            id: String(editingTier.id),
            ...payload,
          },
        })
        showSuccess("Tier loyalty berhasil diupdate.")
      } else {
        await adminWrite<LoyaltyTier>("/api/admin/loyalty", {
          body: payload,
        })
        showSuccess("Tier loyalty berhasil ditambahkan.")
      }

      resetForm()
      await loadTiers()
    } catch (error) {
      console.error("saveTier error:", error)
      showError(`Gagal menyimpan tier: ${getErrorMessage(error)}`)
    }

    setSaving(false)
  }

  async function toggleTier(tier: LoyaltyTier) {
    try {
      await adminWrite<LoyaltyTier>("/api/admin/loyalty", {
        method: "PATCH",
        body: {
          id: String(tier.id),
          action: "toggle_status",
          is_active: !tier.is_active,
        },
      })
      showSuccess(`Tier ${tier.tier_name} berhasil ${tier.is_active ? "dinonaktifkan" : "diaktifkan"}.`)
      await loadTiers()
    } catch (error) {
      console.error("toggleTier error:", error)
      showError(`Gagal mengubah status tier: ${getErrorMessage(error)}`)
    }
  }

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
          LOYALTY SYSTEM
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Loyalty Tier</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Atur tier loyalty, batas order, diskon, dan status aktif pelanggan.
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
          <div className="text-xl text-[var(--insight-muted)]">Tiers</div>
          <div className="mt-2 text-[34px] leading-none">{totalRows}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Active Tiers</div>
          <div className="mt-2 text-[34px] leading-none">{activeTotal}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Reward Source</div>
          <div className="mt-2 text-[34px] leading-none">Orders</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="insight-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl leading-none">{editingTier ? "Edit Tier" : "Add Tier"}</h2>
            {editingTier ? (
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
              <span className="text-lg text-[var(--insight-muted)]">Nama Tier</span>
              <input
                value={form.tier_name}
                onChange={(e) => setForm((current) => ({ ...current, tier_name: e.target.value }))}
                className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
                placeholder="Gold"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-lg text-[var(--insight-muted)]">Min Order</span>
                <input
                  type="number"
                  min="0"
                  value={form.min_order}
                  onChange={(e) => setForm((current) => ({ ...current, min_order: e.target.value }))}
                  className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
                />
              </label>
              <label className="block">
                <span className="text-lg text-[var(--insight-muted)]">Max Order</span>
                <input
                  type="number"
                  min="0"
                  value={form.max_order}
                  onChange={(e) => setForm((current) => ({ ...current, max_order: e.target.value }))}
                  className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-lg text-[var(--insight-muted)]">Diskon Loyalty</span>
              <input
                type="number"
                min="0"
                value={form.discount_amount}
                onChange={(e) => setForm((current) => ({ ...current, discount_amount: e.target.value }))}
                className="mt-1 h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg outline-none"
              />
            </label>

            <label className="block">
              <span className="text-lg text-[var(--insight-muted)]">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                className="mt-1 min-h-24 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-2 text-lg outline-none"
                placeholder="Keterangan tier untuk admin"
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
              onClick={() => void saveTier()}
              disabled={saving}
              className="w-full border-[3px] border-[var(--insight-border)] bg-violet-700 px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] hover:bg-violet-600 disabled:opacity-40"
            >
              {saving ? "Saving..." : editingTier ? "Update Tier" : "Add Tier"}
            </button>
          </div>
        </div>

        <div className="insight-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
                <tr>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Min Order</th>
                  <th className="p-3">Max Order</th>
                  <th className="p-3">Discount</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                      Loading loyalty tier...
                    </td>
                  </tr>
                ) : null}

                {!loading && tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                    <td className="p-3 font-bold">{tier.tier_name}</td>
                    <td className="p-3">{tier.min_order}</td>
                    <td className="p-3">{tier.max_order}</td>
                    <td className="p-3">{rupiah(tier.discount_amount)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block border-[2px] border-[var(--insight-border)] px-2 py-0.5 text-base leading-none ${
                          tier.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tier.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="max-w-xs p-3">{tier.description || "-"}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(tier)}
                          className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-3 py-1.5 text-lg leading-none"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleTier(tier)}
                          className={`border-[3px] border-[var(--insight-border)] px-3 py-1.5 text-lg leading-none text-white shadow-[3px_3px_0_var(--insight-shadow)] ${
                            tier.is_active ? "bg-slate-700 hover:bg-slate-600" : "bg-emerald-700 hover:bg-emerald-600"
                          }`}
                        >
                          {tier.is_active ? "Off" : "On"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && tiers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                      Belum ada loyalty tier.
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
