"use client"

import { useEffect, useMemo, useState } from "react"

import { supabase } from "@/lib/supabaseClient"

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
  const [products, setProducts] = useState<PricingProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active).length,
    [products]
  )

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, product_code, modal, price_normal, price_reseller, reseller_discount, is_active")
      .order("name", { ascending: true })
      .limit(10)

    if (error) {
      setError(error.message)
      setProducts([])
    } else {
      setProducts((data as PricingProduct[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    void Promise.resolve().then(loadProducts)
  }, [])

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
          BUSINESS MANAGEMENT
        </span>
        <h1 className="mt-3 text-[34px] leading-none">Pricing</h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Read-only pricing, modal, reseller price, dan profit margin.
        </p>
      </div>

      {error ? (
        <div className="insight-card border-red-500 bg-red-50 p-4 text-xl text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Products</div>
          <div className="mt-2 text-[34px] leading-none">{products.length}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Active</div>
          <div className="mt-2 text-[34px] leading-none">{activeProducts}</div>
        </div>
        <div className="insight-card p-4">
          <div className="text-xl text-[var(--insight-muted)]">Mode</div>
          <div className="mt-2 text-[34px] leading-none">Read Only</div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3">Code</th>
                <th className="p-3">Cost</th>
                <th className="p-3">Regular</th>
                <th className="p-3">Reseller</th>
                <th className="p-3">Profit</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const cost = Number(product.modal || 0)
                const resellerPrice =
                  product.price_reseller ?? product.price_normal - Number(product.reseller_discount || 0)
                return (
                  <tr key={product.id} className="hover:bg-blue-50 dark:hover:bg-slate-800/60">
                    <td className="p-3">{product.name}</td>
                    <td className="p-3">{product.product_code || "-"}</td>
                    <td className="p-3">{rupiah(cost)}</td>
                    <td className="p-3">{rupiah(product.price_normal)}</td>
                    <td className="p-3">{rupiah(resellerPrice)}</td>
                    <td className="p-3">
                      R: {rupiah(product.price_normal - cost)} / RS: {rupiah(resellerPrice - cost)}
                    </td>
                    <td className="p-3">{product.is_active ? "Active" : "Disabled"}</td>
                  </tr>
                )
              })}
              {!loading && products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Belum ada produk.
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
