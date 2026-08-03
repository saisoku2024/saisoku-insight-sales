"use client"

import { useCallback, useEffect, useState } from "react"

import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice"
import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context"
import { adminWrite } from "@/services/admin/admin-api-client"
import { supabase } from "@/lib/supabase/client"

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
  const isViewer = useIsViewer()
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
  const viewerDisabledClass = " disabled:cursor-not-allowed disabled:opacity-50"

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
    <div className="space-y-4 text-[var(--insight-text)]">
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-violet-100 px-2.5 py-0.5 text-xs font-bold leading-none text-violet-800">
          LOYALTY SYSTEM
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none">Loyalty Tier</h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Atur tier loyalty, batas order, diskon, dan status aktif pelanggan.
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
          <div className="text-sm text-[var(--insight-muted)]">Tiers</div>
          <div className="mt-1 text-2xl font-bold leading-none">{totalRows}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Active Tiers</div>
          <div className="mt-1 text-2xl font-bold leading-none">{activeTotal}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Reward Source</div>
          <div className="mt-1 text-2xl font-bold leading-none">Orders</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="insight-card p-3.5 h-fit">
          <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--insight-border)] pb-2">
            <h2 className="text-sm font-bold leading-none">{editingTier ? "Edit Tier" : "Add Tier"}</h2>
            {editingTier ? (
              <button
                type="button"
                onClick={resetForm}
                className="border-2 border-[var(--insight-border)] bg-[var(--insight-card)] px-2 py-1 text-xs leading-none"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--insight-muted)]">Nama Tier</span>
              <input
                value={form.tier_name}
                onChange={(e) => setForm((current) => ({ ...current, tier_name: e.target.value }))}
                className="mt-1 h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm outline-none"
                placeholder="Gold"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-[var(--insight-muted)]">Min Order</span>
                <input
                  type="number"
                  min="0"
                  value={form.min_order}
                  onChange={(e) => setForm((current) => ({ ...current, min_order: e.target.value }))}
                  className="mt-1 h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--insight-muted)]">Max Order</span>
                <input
                  type="number"
                  min="0"
                  value={form.max_order}
                  onChange={(e) => setForm((current) => ({ ...current, max_order: e.target.value }))}
                  className="mt-1 h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm outline-none"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--insight-muted)]">Diskon Loyalty</span>
              <input
                type="number"
                min="0"
                value={form.discount_amount}
                onChange={(e) => setForm((current) => ({ ...current, discount_amount: e.target.value }))}
                className="mt-1 h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[var(--insight-muted)]">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                className="mt-1 min-h-20 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-2 text-sm outline-none"
                placeholder="Keterangan tier untuk admin"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))}
                className="h-4 w-4"
              />
              Aktif
            </label>

            <button
              type="button"
              onClick={() => void saveTier()}
              disabled={saving || isViewer}
              title={isViewer ? viewerOnlyTitle : undefined}
              className={"w-full border-2 border-[var(--insight-border)] bg-violet-700 px-3.5 py-1.5 text-sm leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:bg-violet-600 disabled:opacity-40" + viewerDisabledClass}
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
                  <th className="px-4 py-3 text-sm">Tier</th>
                  <th className="px-4 py-3 text-sm">Min Order</th>
                  <th className="px-4 py-3 text-sm">Max Order</th>
                  <th className="px-4 py-3 text-sm">Discount</th>
                  <th className="px-4 py-3 text-sm">Status</th>
                  <th className="px-4 py-3 text-sm">Description</th>
                  <th className="px-4 py-3 text-sm text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                      Loading loyalty tier...
                    </td>
                  </tr>
                ) : null}

                {!loading && tiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60 border-b border-[var(--insight-border)]/10">
                    <td className="px-4 py-2.5 text-sm font-bold">{tier.tier_name}</td>
                    <td className="px-4 py-2.5 text-sm">{tier.min_order}</td>
                    <td className="px-4 py-2.5 text-sm">{tier.max_order}</td>
                    <td className="px-4 py-2.5 text-sm">{rupiah(tier.discount_amount)}</td>
                    <td className="px-4 py-2.5 text-sm">
                      <span
                        className={`inline-block border-2 border-[var(--insight-border)] px-2 py-0.5 text-xs font-bold leading-none ${
                          tier.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tier.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-sm truncate">{tier.description || "-"}</td>
                    <td className="px-4 py-2.5 text-sm">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isViewer) return
                            startEdit(tier)
                          }}
                          disabled={isViewer}
                          title={isViewer ? viewerOnlyTitle : undefined}
                          className={"border-2 border-[var(--insight-border)] bg-[var(--insight-card)] px-2.5 py-1 text-xs leading-none" + viewerDisabledClass}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleTier(tier)}
                          disabled={isViewer}
                          title={isViewer ? viewerOnlyTitle : undefined}
                          className={`border-2 border-[var(--insight-border)] px-2.5 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] ${
                            tier.is_active ? "bg-slate-700 hover:bg-slate-600" : "bg-emerald-700 hover:bg-emerald-600"
                          }${viewerDisabledClass}`}
                        >
                          {tier.is_active ? "Off" : "On"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && tiers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
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
