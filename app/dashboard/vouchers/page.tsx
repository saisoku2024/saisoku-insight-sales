"use client"

import { useEffect, useState } from "react"

import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { supabase } from "@/lib/supabaseClient"

type Voucher = {
  id: string
  code: string
  reward_type: string
  reward_amount: number
  quota: number
  used_count: number
  is_active: boolean
  expired_at: string | null
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

export default function VouchersPage() {
  const pageSize = 10
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [activeTotal, setActiveTotal] = useState(0)
  const [claimCount, setClaimCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadVouchers() {
    setLoading(true)
    setError(null)

    const from = (page - 1) * pageSize
    const [voucherResult, activeResult, claimResult] = await Promise.all([
      supabase
        .from("vouchers")
        .select("id, code, reward_type, reward_amount, quota, used_count, is_active, expired_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1),
      supabase
        .from("vouchers")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("voucher_claims")
        .select("id", { count: "exact", head: true }),
    ])

    if (voucherResult.error) {
      setError(voucherResult.error.message)
      setVouchers([])
    } else {
      setVouchers((voucherResult.data as Voucher[]) || [])
      setTotalRows(voucherResult.count || 0)
    }

    if (activeResult.error) {
      setError((current) => current ?? activeResult.error.message)
      setActiveTotal(0)
    } else {
      setActiveTotal(activeResult.count || 0)
    }

    if (claimResult.error) {
      setError((current) => current ?? claimResult.error.message)
      setClaimCount(0)
    } else {
      setClaimCount(claimResult.count || 0)
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadVouchers)
  }, [page])

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
          BUSINESS
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Voucher Management</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Read-only voucher list dan klaim voucher.
        </p>
      </div>

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
          <div className="mt-2 text-[34px] leading-none">
            {activeTotal}
          </div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Claims</div>
          <div className="mt-2 text-[34px] leading-none">{claimCount}</div>
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
                <th className="p-3">Quota</th>
                <th className="p-3">Used</th>
                <th className="p-3">Remaining</th>
                <th className="p-3">Expired</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{voucher.code}</td>
                  <td className="p-3">{voucher.reward_type}</td>
                  <td className="p-3">{rupiah(voucher.reward_amount)}</td>
                  <td className="p-3">{voucher.quota}</td>
                  <td className="p-3">{voucher.used_count}</td>
                  <td className="p-3">{Math.max(0, voucher.quota - voucher.used_count)}</td>
                  <td className="p-3">{formatDate(voucher.expired_at)}</td>
                  <td className="p-3">{voucher.is_active ? "Active" : "Disabled"}</td>
                </tr>
              ))}
              {!loading && vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xl text-[var(--insight-muted)]">
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
  )
}
