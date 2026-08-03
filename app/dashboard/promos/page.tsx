"use client"

import { useState, useEffect } from "react"
import { Percent, Plus, Trash2, Calendar, Loader2, ArrowRight, ShieldAlert, Boxes } from "lucide-react"

import { adminWrite } from "@/services/admin/admin-api-client"
import { supabase } from "@/lib/supabase/client"
import { ActionNotice } from "@/components/dashboard/action-notice"

type PromoItem = {
  qty: number
  product?: {
    id: string
    name: string
    product_code: string
  }
}

type Promo = {
  id: string
  name: string
  description: string | null
  price: number
  allocated_qty: number
  current_stock: number
  start_at: string
  end_at: string | null
  is_active: boolean
  promo_items?: PromoItem[]
}

type Product = {
  id: string
  name: string
  product_code: string
}

export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Form states
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [allocatedQty, setAllocatedQty] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedItems, setSelectedItems] = useState<Record<string, { checked: boolean; qty: number }>>({})

  const showSuccess = (message: string) => setNotice({ type: "success", message })
  const showError = (message: string) => setNotice({ type: "error", message })

  const fetchPromos = async () => {
    try {
      const res = await fetch("/api/admin/promos")
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Gagal fetch data promo.")
      setPromos(result.data || [])
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Gagal memuat data promo.")
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, product_code")
        .eq("is_active", true)
        .order("name", { ascending: true })

      if (error) throw error
      setProducts(data || [])

      // Inisialisasi selectedItems map
      const initialMap: Record<string, { checked: boolean; qty: number }> = {}
      ;(data || []).forEach((p) => {
        initialMap[p.id] = { checked: false, qty: 1 }
      })
      setSelectedItems(initialMap)
    } catch (e: unknown) {
      console.error("Gagal load products:", e)
    }
  }

  useEffect(() => {
    void fetchPromos()
    void fetchProducts()
  }, [])

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault()

    const itemsPayload = Object.entries(selectedItems)
      .filter(([_, item]) => item.checked)
      .map(([productId, item]) => ({
        product_id: productId,
        qty: item.qty,
      }))

    if (!name.trim()) return showError("Nama promo wajib diisi.")
    if (itemsPayload.length === 0) return showError("Pilih minimal satu produk penyusun untuk promo.")
    if (!price || Number(price) < 0) return showError("Harga promo tidak valid.")
    if (!allocatedQty || Number(allocatedQty) <= 0) return showError("Alokasi qty harus berupa angka positif.")

    setCreating(true)
    try {
      await adminWrite<{ success: boolean; promoId: string }>("/api/admin/promos", {
        body: {
          name: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          allocated_qty: Number(allocatedQty),
          items: itemsPayload,
          end_at: endDate ? new Date(endDate).toISOString() : null,
        },
      })

      showSuccess(`Promo "${name}" berhasil dibuat dan stok dialokasikan.`)
      setName("")
      setDescription("")
      setPrice("")
      setAllocatedQty("")
      setEndDate("")
      
      // Reset checklist
      const resetMap: Record<string, { checked: boolean; qty: number }> = {}
      products.forEach((p) => {
        resetMap[p.id] = { checked: false, qty: 1 }
      })
      setSelectedItems(resetMap)

      setShowAddModal(false)
      void fetchPromos()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Gagal membuat promo campaign.")
    } finally {
      setCreating(false)
    }
  }

  const handleCancelPromo = async (id: string, promoName: string) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan promo "${promoName}"?\nSemua sisa stok yang dialokasikan akan segera dikembalikan ke stok normal.`)) {
      return
    }

    try {
      const res = await adminWrite<{ success: boolean; restored_count: number }>(`/api/admin/promos?id=${id}`, {
        method: "DELETE",
      })

      showSuccess(`Promo "${promoName}" dibatalkan. ${res.restored_count} stok dikembalikan ke stok normal.`)
      void fetchPromos()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Gagal membatalkan promo.")
    }
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)
  }

  return (
    <div className="space-y-6">
      {notice && <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Promo Campaigns & Bundling</h1>
          <p className="text-[var(--insight-muted)]">
            Kelola bundling paket pembelian, diskon harga, dan alokasi isolasi serta pemulihan stok otomatis.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="insight-button bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 px-4 py-2"
        >
          <Plus className="h-5 w-5" />
          Buat Promo Baru
        </button>
      </div>

      {/* Promos Table */}
      <div className="insight-card p-5">
        <h2 className="text-xl font-bold border-b-2 border-[var(--insight-border)] pb-2 mb-4 flex items-center gap-2">
          <Percent className="h-5 w-5 text-blue-500" />
          Promo Campaigns Aktif & Riwayat
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2 text-[var(--insight-muted)]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span>Memuat kampanye promo...</span>
          </div>
        ) : promos.length === 0 ? (
          <div className="text-center py-10 text-[var(--insight-muted)] bg-[var(--insight-panel)] border-2 border-dashed border-[var(--insight-border)] rounded-md">
            Belum ada promo campaign yang terdaftar. Silakan klik "Buat Promo Baru" di atas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="insight-table w-full text-left">
              <thead>
                <tr>
                  <th>Nama Promo</th>
                  <th>Produk Satuan / Bundling</th>
                  <th>Harga Promo</th>
                  <th className="text-center">Sisa Stok / Alokasi</th>
                  <th>Masa Berlaku</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {promos.map((p) => {
                  const isExpired = p.end_at ? new Date(p.end_at) <= new Date() : false
                  const isActive = p.is_active && !isExpired

                  return (
                    <tr key={p.id} className={!isActive ? "opacity-70 bg-slate-50/50 dark:bg-slate-900/10" : ""}>
                      <td className="font-semibold text-base">
                        {p.name}
                        {p.description && (
                          <div className="text-xs font-normal text-[var(--insight-muted)] max-w-xs truncate">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td>
                        {p.promo_items && p.promo_items.length > 0 ? (
                          <div className="space-y-1.5 my-1">
                            {p.promo_items.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <span className="font-medium text-[var(--insight-text)]">{item.product?.name}</span>
                                {item.qty > 1 && (
                                  <span className="ml-1.5 px-1 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold rounded">
                                    x{item.qty}
                                  </span>
                                )}
                                <span className="block text-xs text-[var(--insight-muted)]">Code: {item.product?.product_code}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="font-semibold text-green-600">{formatPrice(p.price)}</td>
                      <td className="text-center">
                        <span className="font-bold text-blue-600">{p.current_stock}</span>
                        <span className="text-[var(--insight-muted)]"> / {p.allocated_qty}</span>
                        {p.current_stock === 0 && isActive && (
                          <span className="block text-[10px] text-red-500 font-bold">Stok Habis ❌</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 text-xs">
                          <Calendar className="h-3 w-3 text-[var(--insight-muted)]" />
                          <span>
                            {p.end_at
                              ? new Date(p.end_at).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Selamanya / Stok Habis"}
                          </span>
                        </div>
                      </td>
                      <td className="text-center">
                        {isActive ? (
                          <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-950/20 px-2 py-1 text-xs font-bold text-green-700 dark:text-green-400 border border-green-600/30">
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-950/20 px-2 py-1 text-xs font-bold text-red-700 dark:text-red-400 border border-red-600/30">
                            {isExpired ? "Kedaluwarsa" : "Dibatalkan"}
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        {isActive ? (
                          <button
                            onClick={() => handleCancelPromo(p.id, p.name)}
                            className="insight-button bg-red-600 hover:bg-red-700 text-white p-1.5 flex items-center justify-center mx-auto text-xs gap-1"
                            title="Batalkan & Kembalikan Sisa Stok"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Batalkan
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--insight-muted)] font-medium">Selesai</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePromo}
            className="insight-card bg-[var(--insight-panel)] p-6 max-w-xl w-full border-2 border-[var(--insight-border)] shadow-[4px_4px_0_var(--insight-shadow)] space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold border-b-2 border-[var(--insight-border)] pb-2 flex items-center gap-1.5">
              <Boxes className="h-5 w-5 text-blue-500" />
              Buat Promo / Paket Bundling Baru
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Nama Promo / Bundling</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Netflix + Spotify Hemat Merdeka"
                  className="insight-input w-full"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Deskripsi Promo</label>
                <textarea
                  placeholder="Detail promo/bundling..."
                  className="insight-input w-full text-sm"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="border-2 border-[var(--insight-border)] p-3 rounded bg-[var(--insight-panel)]">
                <label className="block text-sm font-bold mb-2 text-[var(--insight-text)]">Pilih Produk & Qty (Bisa Pilih Banyak untuk Bundling)</label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {products.map((p) => {
                    const item = selectedItems[p.id] || { checked: false, qty: 1 }
                    return (
                      <div key={p.id} className="flex items-center justify-between border border-[var(--insight-border)] p-2 rounded bg-[var(--insight-card)] text-sm shadow-[1px_1px_0_var(--insight-shadow)]">
                        <label className="flex items-center gap-2 cursor-pointer font-semibold flex-1">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={(e) => {
                              setSelectedItems((prev) => ({
                                ...prev,
                                [p.id]: { checked: e.target.checked, qty: item.qty },
                              }))
                            }}
                            className="rounded border-[var(--insight-border)] text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span>
                            {p.name} <span className="text-xs font-normal text-[var(--insight-muted)]">({p.product_code})</span>
                          </span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--insight-muted)]">Qty:</span>
                          <input
                            type="number"
                            min={1}
                            disabled={!item.checked}
                            className="insight-input w-14 text-center py-0.5 text-xs"
                            value={item.qty}
                            onChange={(e) => {
                              setSelectedItems((prev) => ({
                                ...prev,
                                [p.id]: { checked: item.checked, qty: Math.max(1, Number(e.target.value)) },
                              }))
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Harga Promo Paket (Rp)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="Contoh: 35000"
                    className="insight-input w-full"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Alokasi Qty Paket</label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Contoh: 10"
                    className="insight-input w-full"
                    value={allocatedQty}
                    onChange={(e) => setAllocatedQty(e.target.value)}
                  />
                  <span className="text-[10px] text-[var(--insight-muted)]">Jumlah paket yang ingin dirakit & diisolasi.</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Tanggal Berakhir (Opsional)</label>
                <input
                  type="datetime-local"
                  className="insight-input w-full text-sm"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-950/20 border border-red-500/30 p-3 rounded text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong>PENTING:</strong> Stok produk satuan yang dipilih akan <strong>diisolasi</strong> (tidak bisa terjual eceran biasa). Sisa stok paket otomatis dikembalikan/restore ke stok eceran biasa jika promo dibatalkan/kedaluwarsa.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="insight-button bg-slate-300 hover:bg-slate-400 text-black px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creating}
                className="insight-button bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm flex items-center gap-1"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {creating ? "Membuat..." : "Simpan Promo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
