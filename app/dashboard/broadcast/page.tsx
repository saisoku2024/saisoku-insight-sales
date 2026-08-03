"use client"

import { useState, useEffect } from "react"
import { Send, Copy, Check, MessageSquare, Loader2 } from "lucide-react"

import { adminWrite } from "@/services/admin/admin-api-client"
import { supabase } from "@/lib/supabase/client"
import { ActionNotice } from "@/components/dashboard/action-notice"

type PopularProduct = {
  id: string
  name: string
  stock: number
}

type BroadcastResult = {
  success: number
  failed: number
  total: number
  error: string | null
}

export default function BroadcastPage() {
  const [greeting, setGreeting] = useState("Selamat Pagi, Saisoku Family! 🌤️")
  const [customText, setCustomText] = useState(
    "Restok produk\n✅ Capcut 30 Day member tim harga  22.500\n✅ Capcut 7 Day individual harga 4.000\n\nWeb capcut join : capcuto.my.id diskon 17% \nJadi 49.000/month\n\nWeb payment gateaway : vitopediapay.com\n\nYang nak beli gsuite ready banyak ya , start bot aja nanti ada button beli gsuite"
  )
  const [promoText, setPromoText] = useState(
    "├ Promo Reseller Merdeka — Cashback 5% (s/d 17 Aug)\n└ Bonus Loyalty Point double setiap transaksi!"
  )
  const [botUser, setBotUser] = useState("t.me/saisoku_bot")
  const [adminWa, setAdminWa] = useState("wa.me/6281222492222")
  const [footer, setFooter] = useState("Terima kasih sudah menggunakan layanan kami 🙏")

  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([])
  const [loadingPopular, setLoadingPopular] = useState(true)
  const [sending, setSending] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedTelegram, setCopiedTelegram] = useState(false)
  const [result, setResult] = useState<BroadcastResult | null>(null)
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const showSuccess = (message: string) => setNotice({ type: "success", message })
  const showError = (message: string) => setNotice({ type: "error", message })

  useEffect(() => {
    async function loadPopular() {
      try {
        const { data: trx, error: trxErr } = await supabase
          .from("transactions")
          .select("product_id")
          .eq("status", "paid")

        if (trxErr) throw trxErr
        if (!trx || trx.length === 0) {
          setPopularProducts([])
          setLoadingPopular(false)
          return
        }

        const counts: Record<string, number> = {}
        trx.forEach((r: { product_id: string }) => {
          if (r.product_id) counts[r.product_id] = (counts[r.product_id] || 0) + 1
        })

        const sortedIds = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id]) => id)

        if (sortedIds.length === 0) {
          setPopularProducts([])
          setLoadingPopular(false)
          return
        }

        const { data: prods, error: prodErr } = await supabase
          .from("products")
          .select("id, name")
          .in("id", sortedIds)

        if (prodErr) throw prodErr

        const { data: stocks, error: stockErr } = await supabase
          .from("product_accounts")
          .select("product_id")
          .eq("status", "available")
          .in("product_id", sortedIds)

        if (stockErr) throw stockErr

        const stockCounts: Record<string, number> = {};
        (stocks || []).forEach((row: { product_id: string }) => {
          if (row.product_id) stockCounts[row.product_id] = (stockCounts[row.product_id] || 0) + 1
        })

        const result = sortedIds.map((id) => {
          const p = (prods || []).find((x) => x.id === id)
          return {
            id,
            name: p?.name || "Produk",
            stock: stockCounts[id] || 0,
          }
        })

        setPopularProducts(result)
      } catch (err) {
        console.error("Gagal memuat produk populer:", err)
      } finally {
        setLoadingPopular(false)
      }
    }
    void loadPopular()
  }, [])

  const getPopularProductsText = (isHtml: boolean) => {
    if (loadingPopular) {
      return isHtml ? "<i>Loading produk populer...</i>" : "Loading produk populer..."
    }
    if (popularProducts.length === 0) {
      return isHtml ? "<i>Belum ada produk populer.</i>" : "Belum ada produk populer."
    }

    return popularProducts
      .map((p, idx) => {
        const stockText = p.stock > 0 ? `Stok: ${p.stock}` : (isHtml ? "<b>Habis ❌</b>" : "Habis ❌")
        return `${idx + 1}. ${p.name} — ${stockText}`
      })
      .join("\n")
  };

  const compileTelegramHtml = () => {
    const popularText = getPopularProductsText(true)
    return `📢 <b>PESAN BROADCAST</b>
${greeting}

📦 <b>RESTOK PRODUK</b>
${customText}

━━━━━━━━━━━━━━━━━ 
🎁 <b>PROMO AKTIF</b>
${promoText}

━━━━━━━━━━━━━━━━━
🔥 <b>PRODUK TERPOPULER HARI INI</b>
${popularText}

━━━━━━━━━━━━━━━━━
🤖 Order: ${botUser}
📱 Admin: ${adminWa}

${footer}`
  }

  const compileWhatsappMarkdown = () => {
    const popularText = getPopularProductsText(false)
    return `📢 *PESAN BROADCAST*
${greeting}

📦 *RESTOK PRODUK*
${customText}

━━━━━━━━━━━━━━━━━ 
🎁 *PROMO AKTIF*
${promoText}

━━━━━━━━━━━━━━━━━
🔥 *PRODUK TERPOPULER HARI INI*
${popularText}

━━━━━━━━━━━━━━━━━
🤖 Order: ${botUser}
📱 Admin: ${adminWa}

${footer}`
  }

  const handleCopyWhatsapp = async () => {
    try {
      await navigator.clipboard.writeText(compileWhatsappMarkdown())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showError("Gagal menyalin teks ke clipboard.")
    }
  }

  const handleCopyTelegram = async () => {
    try {
      await navigator.clipboard.writeText(compileTelegramHtml())
      setCopiedTelegram(true)
      setTimeout(() => setCopiedTelegram(false), 2000)
    } catch {
      showError("Gagal menyalin teks ke clipboard.")
    }
  }

  const handleSendBroadcast = async () => {
    setSending(true)
    setShowConfirm(false)
    setResult(null)

    try {
      const htmlText = compileTelegramHtml()
      const data = await adminWrite<{ success: number; failed: number; total: number; error: string | null }>(
        "/api/admin/broadcast",
        {
          body: { text: htmlText },
        }
      )

      setResult(data)
      showSuccess("Broadcast selesai dikirim!")
    } catch (e: unknown) {
      showError(e instanceof Error ? e.message : "Gagal mengirim broadcast.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {notice && <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />}

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Telegram Broadcast</h1>
        <p className="text-[var(--insight-muted)]">
          Kirim pesan pengumuman massal ke seluruh pengguna bot Telegram aktif.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Editor Form */}
        <div className="insight-card p-5 space-y-4">
          <h2 className="text-xl font-bold border-b-2 border-[var(--insight-border)] pb-2">Editor Template</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Salam Pembuka (Greeting)</label>
              <input
                type="text"
                className="insight-input w-full"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Restok & Informasi Utama (Custom)</label>
              <textarea
                rows={7}
                className="insight-input w-full font-mono text-sm"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Promo Aktif (Custom)</label>
              <textarea
                rows={3}
                className="insight-input w-full font-mono text-sm"
                value={promoText}
                onChange={(e) => setPromoText(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Bot Username</label>
                <input
                  type="text"
                  className="insight-input w-full text-sm"
                  value={botUser}
                  onChange={(e) => setBotUser(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Admin WA Link</label>
                <input
                  type="text"
                  className="insight-input w-full text-sm"
                  value={adminWa}
                  onChange={(e) => setAdminWa(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1 text-[var(--insight-text)]">Penutup</label>
              <input
                type="text"
                className="insight-input w-full"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleCopyWhatsapp}
              className="insight-button bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 px-3 py-2 text-sm"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Tersalin!" : "Copy untuk WA"}
            </button>

            <button
              onClick={handleCopyTelegram}
              className="insight-button bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 px-3 py-2 text-sm"
            >
              {copiedTelegram ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedTelegram ? "Tersalin!" : "Copy HTML Telegram"}
            </button>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={sending}
              className="insight-button bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 px-4 py-2 ml-auto text-sm"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? "Mengirim..." : "Kirim Telegram"}
            </button>
          </div>
        </div>

        {/* Live Preview */}
        <div className="insight-card p-5 flex flex-col h-full min-h-[500px]">
          <h2 className="text-xl font-bold border-b-2 border-[var(--insight-border)] pb-2 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Live Chat Preview (Telegram Style)
          </h2>

          <div className="flex-1 bg-[#0e1621] p-4 rounded-md border-2 border-[var(--insight-border)] mt-4 font-sans text-white text-sm overflow-y-auto space-y-4 max-h-[550px]">
            {/* Telegram Message Box */}
            <div className="bg-[#182533] p-3 rounded-lg max-w-[85%] border border-slate-700/50 shadow-md">
              <div className="font-semibold text-sky-400 mb-1 text-xs">Saisoku Bot Sales</div>
              <div
                className="whitespace-pre-wrap leading-relaxed break-words"
                dangerouslySetInnerHTML={{
                  __html: compileTelegramHtml()
                    .replace(/\n/g, "<br />")
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, "<strong>$1</strong>")
                    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, "<em>$1</em>")
                    .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code class="bg-[#24303f] px-1 py-0.5 rounded text-red-400 text-xs">$1</code>')
                    .replace(/&lt;a\s+href="([^"]+)"&gt;(.*?)&lt;\/a&gt;/g, '<a href="$1" target="_blank" class="text-sky-400 hover:underline">$2</a>'),
                }}
              />
              <div className="text-right text-[10px] text-slate-400 mt-1.5">10:00 AM</div>
            </div>
          </div>

          {result && (
            <div className="insight-card bg-slate-800 text-white border-2 border-[var(--insight-border)] p-4 mt-4 space-y-2">
              <h3 className="font-bold border-b border-slate-700 pb-1 flex items-center gap-1.5">
                📢 Hasil Laporan Broadcast
              </h3>
              <div className="grid grid-cols-3 gap-2 text-center text-sm font-semibold">
                <div className="bg-slate-700 p-2 rounded">
                  <div className="text-slate-400 text-xs">Total Target</div>
                  <div className="text-lg">{result.total}</div>
                </div>
                <div className="bg-green-950 p-2 rounded border border-green-800">
                  <div className="text-green-400 text-xs">Berhasil</div>
                  <div className="text-lg text-green-300">{result.success}</div>
                </div>
                <div className="bg-red-950 p-2 rounded border border-red-800">
                  <div className="text-red-400 text-xs">Gagal</div>
                  <div className="text-lg text-red-300">{result.failed}</div>
                </div>
              </div>
              {result.error && (
                <div className="text-red-400 text-xs mt-1 bg-red-950/30 p-2 rounded border border-red-900/50">
                  Detail Error: {result.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="insight-card bg-[var(--insight-panel)] p-6 max-w-md w-full border-2 border-[var(--insight-border)] shadow-[4px_4px_0_var(--insight-shadow)] space-y-4">
            <h3 className="text-xl font-bold text-red-600">Konfirmasi Kirim Broadcast?</h3>
            <p className="text-sm text-[var(--insight-muted)]">
              Apakah Anda yakin ingin mengirim pesan broadcast ini ke seluruh user Telegram terdaftar? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="insight-button bg-slate-300 hover:bg-slate-400 text-black px-4 py-2 text-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSendBroadcast}
                className="insight-button bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm"
              >
                Ya, Kirim Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
