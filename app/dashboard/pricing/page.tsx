"use client"

import { useCallback, useEffect, useState } from "react"

import { PaginationControls } from "@/components/dashboard/pagination-controls"
import { supabase } from "@/lib/supabase/client"
import { useIsViewer } from "@/components/dashboard/panel-access-context"

type PricingProduct = {
  id: string
  name: string
  product_code: string | null
  modal: number | null
  price_normal: number
  price_reseller: number | null
  reseller_discount: number
  is_active: boolean
}

function rupiah(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

export default function PricingPage() {
  const isViewer = useIsViewer()
  const pageSize = 10
  const [products, setProducts] = useState<PricingProduct[]>([])
  const [page, setPage] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [activeTotal, setActiveTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    const from = (page - 1) * pageSize
    const [productsResult, activeResult] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, product_code, modal, price_normal, price_reseller, reseller_discount, is_active", { count: "exact" })
        .order("name", { ascending: true })
        .range(from, from + pageSize - 1),
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ])

    if (productsResult.error) {
      setError(productsResult.error.message)
      setProducts([])
    } else {
      setProducts((productsResult.data as PricingProduct[]) || [])
      setTotalRows(productsResult.count || 0)
    }

    if (activeResult.error) {
      setError((current) => current ?? activeResult.error.message)
      setActiveTotal(0)
    } else {
      setActiveTotal(activeResult.count || 0)
    }

    setLoading(false)
  }, [page, pageSize])

  useEffect(() => {
    void Promise.resolve().then(loadProducts)
  }, [loadProducts])

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-violet-100 px-2.5 py-0.5 text-xs font-bold leading-none text-violet-800">
          BUSINESS MANAGEMENT
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none">Pricing</h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Read-only pricing, modal, reseller price, dan profit margin.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Products</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">{totalRows}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Active</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">{activeTotal}</div>
        </div>
        <div className="insight-card p-3.5">
          <div className="text-sm text-[var(--insight-muted)]">Mode</div>
          <div className="mt-1.5 text-2xl font-bold leading-none">Read Only</div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm">Product</th>
                <th className="px-4 py-3 text-sm">Code</th>
                <th className="px-4 py-3 text-sm">Cost</th>
                <th className="px-4 py-3 text-sm">Regular</th>
                <th className="px-4 py-3 text-sm">Reseller</th>
                <th className="px-4 py-3 text-sm">Profit</th>
                <th className="px-4 py-3 text-sm">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const cost = Number(product.modal || 0)
                const resellerPrice =
                  product.price_reseller ?? product.price_normal - Number(product.reseller_discount || 0)
                return (
                  <tr key={product.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-2.5 text-sm">{product.name}</td>
                    <td className="px-4 py-2.5 text-sm">{product.product_code || "-"}</td>
                    <td className="px-4 py-2.5 text-sm">{isViewer ? "***" : rupiah(cost)}</td>
                    <td className="px-4 py-2.5 text-sm">{rupiah(product.price_normal)}</td>
                    <td className="px-4 py-2.5 text-sm">{rupiah(resellerPrice)}</td>
                    <td className="px-4 py-2.5 text-sm">
                      {isViewer ? "R: *** / RS: ***" : `R: ${rupiah(product.price_normal - cost)} / RS: ${rupiah(resellerPrice - cost)}`}
                    </td>
                    <td className="px-4 py-2.5 text-sm">{product.is_active ? "Active" : "Disabled"}</td>
                  </tr>
                )
              })}
              {!loading && products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Belum ada produk.
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
