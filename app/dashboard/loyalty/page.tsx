"use client"

import { useEffect, useState } from "react"

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

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

export default function LoyaltyPage() {
  const [tiers, setTiers] = useState<LoyaltyTier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadTiers() {
    const { data, error } = await supabase
      .from("loyalty_settings")
      .select("id, tier_name, min_order, max_order, discount_amount, is_active, description")
      .order("min_order", { ascending: true })

    if (error) {
      setError(error.message)
      setTiers([])
    } else {
      setTiers((data as LoyaltyTier[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadTiers)
  }, [])

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
          LOYALTY SYSTEM
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Loyalty Tier</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Read-only loyalty settings dari tabel `loyalty_settings`.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-4 text-xl text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Tiers</div>
          <div className="mt-2 text-[34px] leading-none">{tiers.length}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Active Tiers</div>
          <div className="mt-2 text-[34px] leading-none">
            {tiers.filter((tier) => tier.is_active).length}
          </div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Reward Source</div>
          <div className="mt-2 text-[34px] leading-none">Orders</div>
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
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{tier.tier_name}</td>
                  <td className="p-3">{tier.min_order}</td>
                  <td className="p-3">{tier.max_order}</td>
                  <td className="p-3">{rupiah(tier.discount_amount)}</td>
                  <td className="p-3">{tier.is_active ? "Active" : "Disabled"}</td>
                  <td className="p-3">{tier.description || "-"}</td>
                </tr>
              ))}
              {!loading && tiers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Belum ada loyalty tier.
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
