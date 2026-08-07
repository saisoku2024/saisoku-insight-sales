"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Brain,
  Plus,
  Trash2,
  Search,
  FileText,
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Tag,
} from "lucide-react"

import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice"
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context"
import { adminWrite } from "@/services/admin/admin-api-client"
import { supabase } from "@/lib/supabase/client"

export type KnowledgeBaseItem = {
  id: string
  title: string
  category: string
  content: string
  tags?: string[]
  source_file?: string | null
  status: "active" | "inactive" | "archived"
  created_by?: string | null
  created_at: string
  updated_at?: string
}

const INITIAL_MOCK_DATA: KnowledgeBaseItem[] = [
  {
    id: "kb-001",
    title: "SOP Restok CapCut 30-Day Member Team & Individual",
    category: "Product Info",
    content: "Ketentuan akun CapCut 30 Day member tim harga 22.500 dan CapCut 7 Day individual harga 4.000. Bergabung via capcuto.my.id diskon 17% menjadi Rp 49.000/bulan.",
    tags: ["capcut", "restok", "pricing"],
    source_file: "capcut_guidelines_v2.pdf",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-08-07T08:00:00Z",
  },
  {
    id: "kb-002",
    title: "Prosedur Pembelian & Garansi GSuite Ready Stock",
    category: "Product Info",
    content: "Pembelian GSuite ready stock dapat diakses via button 'Beli GSuite' pada bot Telegram. Garansi replace berlaku 7 hari jika ada kendala login pertama kali.",
    tags: ["gsuite", "garansi", "telegram"],
    source_file: "gsuite_rules_2026.docx",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-08-06T14:20:00Z",
  },
  {
    id: "kb-003",
    title: "Syarat & Ketentuan Promo Reseller Merdeka Cashback 5%",
    category: "Promo & Rules",
    content: "Cashback 5% berlaku untuk role Reseller sampai tanggal 17 Agustus. Bonus Loyalty Point double otomatis ditambahkan pada tiap transaksi yang berhasil.",
    tags: ["promo", "cashback", "merdeka"],
    source_file: "promo_merdeka_terms.txt",
    status: "active",
    created_by: "owner@saisoku.id",
    created_at: "2026-08-05T10:15:00Z",
  },
  {
    id: "kb-004",
    title: "Panduan Integrasi Payment Gateway Vitopediapay",
    category: "SOP System",
    content: "Sistem pembayaran otomatis terhubung dengan Vitopediapay.com. Deposit saldo instan QRIS dan Bank Transfer dengan verifikasi webhook otomatis.",
    tags: ["payment", "qris", "deposit"],
    source_file: "vitopediapay_api_docs.pdf",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-08-04T16:45:00Z",
  },
  {
    id: "kb-005",
    title: "Kebijakan Pengembalian Saldo & Refund Transaksi Gagal",
    category: "General FAQ",
    content: "Apabila stok akun habis secara tak terduga saat checkout, saldo user otomatis dikembalikan 100% tanpa potongan dalam waktu maksimal 10 detik.",
    tags: ["refund", "saldo", "policy"],
    source_file: "refund_policy_v1.pdf",
    status: "active",
    created_by: "owner@saisoku.id",
    created_at: "2026-08-03T11:00:00Z",
  },
  {
    id: "kb-006",
    title: "Aturan Daily Absen Check-in Reward User Telegram",
    category: "General FAQ",
    content: "Absen harian memberikan bonus Rp 100 per hari. Klaim dilakukan lewat button Absen Harian di menu bot Telegram dengan cooldown 24 jam.",
    tags: ["absen", "daily", "reward"],
    source_file: "daily_checkin_rules.txt",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-08-02T09:30:00Z",
  },
  {
    id: "kb-007",
    title: "Daftar Command Khusus Owner & Admin Telegram Bot",
    category: "SOP System",
    content: "Command admin mencakup /setrole, /broadcast, /ban, /unban, /addsaldo, /remsaldo. Akses terbatas khusus role admin dan owner yang terdaftar.",
    tags: ["admin", "commands", "bot"],
    source_file: "bot_admin_commands.md",
    status: "active",
    created_by: "owner@saisoku.id",
    created_at: "2026-08-01T15:00:00Z",
  },
  {
    id: "kb-008",
    title: "Skema Tier Member & Penukaran Reward Loyalty Point",
    category: "Promo & Rules",
    content: "Loyalty point dihitung dari setiap transaksi paid. Tier Silver, Gold, Platinum mendapatkan diskon bertingkat untuk pembelian akun premium.",
    tags: ["loyalty", "tier", "reward"],
    source_file: "loyalty_program_spec.pdf",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-07-30T13:10:00Z",
  },
  {
    id: "kb-009",
    title: "Troubleshooting Kendala Gagal Webhook Telegram Bot",
    category: "Operational",
    content: "Langkah penanganan jika webhook Telegram terputus: Cek URL webhook di dashboard settings, pastikan secret_token sesuai, dan trigger /setWebhook.",
    tags: ["webhook", "telegram", "debug"],
    source_file: "webhook_troubleshoot.md",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-07-28T18:20:00Z",
  },
  {
    id: "kb-010",
    title: "Spesifikasi Format Upload Massal Stok Akun Premium",
    category: "Operational",
    content: "Upload stok akun via CSV/TXT menggunakan delimiter titik dua (email:password) atau format satu baris per akun dengan auto validasi keunikan.",
    tags: ["stock", "upload", "csv"],
    source_file: "stock_upload_format.txt",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-07-25T10:00:00Z",
  },
  {
    id: "kb-011",
    title: "Ketentuan Penggunaan Kode Voucher Diskon SAISOKU100",
    category: "Promo & Rules",
    content: "Voucher SAISOKU100 memberikan potongan harga nominal Rp 1.000 dengan minimal belanja Rp 10.000. Satu klaim per user Telegram.",
    tags: ["voucher", "diskon", "saisoku100"],
    source_file: "voucher_rules.txt",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-07-20T08:45:00Z",
  },
  {
    id: "kb-012",
    title: "Panduan Penanganan Tiket Support Komplain Pelanggan",
    category: "Operational",
    content: "Tiket komplain masuk ke menu Active Tickets. Admin wajib memberikan tanggapan dalam 15 menit dan menyelesaikan tiket jika replacement telah terikirim.",
    tags: ["support", "ticket", "sla"],
    source_file: "support_sop.pdf",
    status: "active",
    created_by: "admin@saisoku.id",
    created_at: "2026-07-15T12:00:00Z",
  },
]

const CATEGORY_OPTIONS = [
  "Semua Kategori",
  "Product Info",
  "Promo & Rules",
  "SOP System",
  "General FAQ",
  "Operational",
]

export default function KnowledgeBasePage() {
  const isViewer = useIsViewer()

  const [items, setItems] = useState<KnowledgeBaseItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<ActionNoticeState>(null)

  // Filters & Pagination (Strict 10 per page)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Semua Kategori")
  const [statusFilter, setStatusFilter] = useState("all")

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState<KnowledgeBaseItem | null>(null)
  const [itemToDelete, setItemToDelete] = useState<KnowledgeBaseItem | null>(null)

  // Form State
  const [formTitle, setFormTitle] = useState("")
  const [formCategory, setFormCategory] = useState("Product Info")
  const [formContent, setFormContent] = useState("")
  const [formTags, setFormTags] = useState("")
  const [formSourceFile, setFormSourceFile] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Copy State
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const showError = (message: string) => setNotice({ type: "error", message })
  const showSuccess = (message: string) => setNotice({ type: "success", message })

  const fetchKnowledgeBase = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const token = session?.access_token

      const queryCategory = selectedCategory === "Semua Kategori" ? "" : selectedCategory
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search: search.trim(),
        category: queryCategory,
        status: statusFilter,
      })

      const res = await fetch(`/api/admin/knowledge-base?${queryParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (res.ok) {
        const result = await res.json()
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          setItems(result.data)
          setTotalCount(result.total || result.data.length)
          return
        }
      }

      // Fallback filtering on mock data if API is empty or table not migrated yet
      let filtered = [...INITIAL_MOCK_DATA]
      if (search.trim()) {
        const q = search.toLowerCase()
        filtered = filtered.filter(
          (x) =>
            x.title.toLowerCase().includes(q) ||
            x.content.toLowerCase().includes(q) ||
            (x.tags && x.tags.some((t) => t.toLowerCase().includes(q)))
        )
      }
      if (selectedCategory !== "Semua Kategori") {
        filtered = filtered.filter((x) => x.category === selectedCategory)
      }
      if (statusFilter !== "all") {
        filtered = filtered.filter((x) => x.status === statusFilter)
      }

      setTotalCount(filtered.length)
      const start = (page - 1) * pageSize
      setItems(filtered.slice(start, start + pageSize))
    } catch (err) {
      console.error("Gagal memuat data knowledge base:", err)
    } finally {
      setLoading(false)
    }
  }, [page, search, selectedCategory, statusFilter])

  useEffect(() => {
    void fetchKnowledgeBase()
  }, [fetchKnowledgeBase])

  const handleResetForm = () => {
    setFormTitle("")
    setFormCategory("Product Info")
    setFormContent("")
    setFormTags("")
    setFormSourceFile("")
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isViewer) return
    if (!formTitle.trim()) return showError("Judul dokumen wajib diisi.")
    if (!formContent.trim()) return showError("Isi konten dokumen wajib diisi.")

    setSubmitting(true)
    try {
      const parsedTags = formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)

      await adminWrite("/api/admin/knowledge-base", {
        body: {
          title: formTitle.trim(),
          category: formCategory,
          content: formContent.trim(),
          tags: parsedTags,
          source_file: formSourceFile.trim() || null,
        },
      })

      showSuccess("Data Knowledge Base berhasil ditambahkan!")
      setShowAddModal(false)
      handleResetForm()
      setPage(1)
      await fetchKnowledgeBase()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Gagal menambahkan data KB.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteItem = async () => {
    if (!itemToDelete || isViewer) return
    setSubmitting(true)
    try {
      await adminWrite(`/api/admin/knowledge-base/${itemToDelete.id}`, {
        method: "DELETE",
      })

      showSuccess(`Data "${itemToDelete.title}" berhasil dihapus.`)
      setItemToDelete(null)

      // Fallback local update if using mock data
      setItems((prev) => prev.filter((x) => x.id !== itemToDelete.id))
      setTotalCount((prev) => Math.max(0, prev - 1))

      await fetchKnowledgeBase()
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Gagal menghapus data KB.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyContent = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      showError("Gagal menyalin teks.")
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1

  return (
    <div className="space-y-4">
      {notice && <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />}

      {/* Header Card */}
      <div className="insight-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 border-2 border-[var(--insight-border)] bg-purple-100 px-2.5 py-0.5 text-xs font-bold leading-none text-purple-900 dark:bg-purple-950 dark:text-purple-300">
            <Brain className="h-3.5 w-3.5" />
            AI / OMNIX KNOWLEDGE BASE
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-none">Rekap & Monitoring Knowledge Base</h1>
          <p className="mt-1 text-xs leading-relaxed text-[var(--insight-muted)]">
            Monitoring data & dokumen training AI (SIVA / Omnix System) dengan tombol <b>Hapus</b> untuk membuang upload ganda / duplikat. (Pagination: 10 per halaman)
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void fetchKnowledgeBase()}
            disabled={loading}
            className="insight-button bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs px-3 py-2 flex items-center gap-1.5"
            title="Refresh Data KB"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            disabled={isViewer}
            title={isViewer ? viewerOnlyTitle : undefined}
            className="insight-button bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Data KB</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="insight-card p-3 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        <div className="sm:col-span-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul, tag, atau isi konten KB..."
            className="insight-input w-full pl-9 text-xs py-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className="sm:col-span-4">
          <select
            className="insight-input w-full text-xs py-2"
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value)
              setPage(1)
            }}
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            className="insight-input w-full text-xs py-2"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Semua Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table Data Section */}
      <div className="insight-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--insight-panel)] border-b-2 border-[var(--insight-border)] font-bold text-[var(--insight-text)] uppercase tracking-wider text-[11px]">
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 min-w-[200px]">Judul Dokumen / Data</th>
                <th className="p-3 w-32">Kategori</th>
                <th className="p-3 min-w-[280px]">Ringkasan Isi Content</th>
                <th className="p-3 w-36">Tanggal Upload</th>
                <th className="p-3 w-24 text-center">Status</th>
                <th className="p-3 w-32 text-right pr-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--insight-border)]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--insight-muted)]">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Memuat data Knowledge Base...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[var(--insight-muted)]">
                    Tidak ada data Knowledge Base yang ditemukan.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const globalIdx = (page - 1) * pageSize + idx + 1
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3 text-center font-mono font-semibold text-[var(--insight-muted)]">
                        {globalIdx}
                      </td>

                      <td className="p-3 font-medium">
                        <div className="font-bold text-[var(--insight-text)] text-xs flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>{item.title}</span>
                        </div>
                        {item.source_file && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            📄 {item.source_file}
                          </div>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-0.5 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] rounded font-mono text-slate-600 dark:text-slate-300"
                              >
                                <Tag className="h-2.5 w-2.5" />
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="inline-block border border-[var(--insight-border)] bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold rounded">
                          {item.category}
                        </span>
                      </td>

                      <td className="p-3 text-[11px] text-[var(--insight-muted)]">
                        <p className="line-clamp-2 leading-relaxed">{item.content}</p>
                        <button
                          onClick={() => setShowDetailModal(item)}
                          className="text-blue-500 hover:underline text-[10px] font-semibold mt-0.5 inline-flex items-center gap-1"
                        >
                          <Eye className="h-3 w-3" /> Lihat Detail
                        </button>
                      </td>

                      <td className="p-3 font-mono text-[10px] text-[var(--insight-muted)]">
                        {new Date(item.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="p-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded border ${
                            item.status === "active"
                              ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300"
                              : "bg-gray-100 text-gray-800 border-gray-300"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="p-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleCopyContent(item.id, `${item.title}\n\n${item.content}`)}
                            title="Salin Isi Teks"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition"
                          >
                            {copiedId === item.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => setItemToDelete(item)}
                            disabled={isViewer}
                            title={isViewer ? viewerOnlyTitle : "Hapus Data (Jika Upload Ganda)"}
                            className="insight-button bg-red-600 hover:bg-red-700 text-white p-1.5 text-xs flex items-center gap-1 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Strict Pagination 10 per Page */}
        <div className="p-3 border-t-2 border-[var(--insight-border)] bg-[var(--insight-panel)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-[var(--insight-muted)] text-xs">
            Menampilkan{" "}
            <span className="font-bold text-[var(--insight-text)]">
              {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}
            </span>{" "}
            -{" "}
            <span className="font-bold text-[var(--insight-text)]">
              {Math.min(page * pageSize, totalCount)}
            </span>{" "}
            dari <span className="font-bold text-[var(--insight-text)]">{totalCount}</span> data KB (10 per halaman)
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="insight-button bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs px-2.5 py-1 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Prev</span>
            </button>

            <span className="px-3 py-1 font-bold text-xs bg-blue-600 text-white rounded font-mono">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="insight-button bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs px-2.5 py-1 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="insight-card bg-[var(--insight-panel)] p-5 max-w-md w-full border-2 border-[var(--insight-border)] shadow-[4px_4px_0_var(--insight-shadow)] space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h3 className="text-lg font-bold">Konfirmasi Hapus Data KB?</h3>
            </div>
            <p className="text-xs text-[var(--insight-muted)] leading-relaxed">
              Apakah Anda yakin ingin menghapus data Knowledge Base ini? Gunakan fitur ini jika terdapat <b>upload ganda / duplikat</b>. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="bg-slate-100 dark:bg-slate-900 p-2.5 rounded border border-[var(--insight-border)] text-xs font-mono">
              <div className="font-bold text-blue-600 dark:text-blue-400">{itemToDelete.title}</div>
              <div className="text-[10px] text-slate-400 mt-1">Kategori: {itemToDelete.category}</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                disabled={submitting}
                className="insight-button bg-slate-300 hover:bg-slate-400 text-black px-3.5 py-1.5 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={submitting || isViewer}
                className="insight-button bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 text-xs flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {submitting ? "Menghapus..." : "Ya, Hapus Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Content View Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="insight-card bg-[var(--insight-panel)] p-5 max-w-xl w-full border-2 border-[var(--insight-border)] shadow-[4px_4px_0_var(--insight-shadow)] space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b-2 border-[var(--insight-border)] pb-2">
              <div className="font-bold text-sm text-blue-500 flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Detail Dokumen Knowledge Base
              </div>
              <button
                onClick={() => setShowDetailModal(null)}
                className="insight-button bg-slate-200 dark:bg-slate-800 text-xs px-2 py-1"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              <h2 className="text-base font-bold text-[var(--insight-text)]">{showDetailModal.title}</h2>

              <div className="flex flex-wrap gap-2 text-[10px] text-[var(--insight-muted)]">
                <span className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                  {showDetailModal.category}
                </span>
                <span className="font-mono">ID: {showDetailModal.id}</span>
                <span className="font-mono">
                  {new Date(showDetailModal.created_at).toLocaleString("id-ID")}
                </span>
              </div>

              <div className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 mt-2">
                {showDetailModal.content}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--insight-border)]">
              <button
                onClick={() => handleCopyContent(showDetailModal.id, showDetailModal.content)}
                className="insight-button bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                {copiedId === showDetailModal.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedId === showDetailModal.id ? "Tersalin!" : "Salin Isi Content"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New KB Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="insight-card bg-[var(--insight-panel)] p-5 max-w-lg w-full border-2 border-[var(--insight-border)] shadow-[4px_4px_0_var(--insight-shadow)] space-y-4">
            <h3 className="text-lg font-bold border-b-2 border-[var(--insight-border)] pb-2 flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-500" />
              Tambah Data Knowledge Base Baru
            </h3>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Judul Dokumen / Informasi *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: SOP Garansi Replace Akun CapCut 30 Hari"
                  className="insight-input w-full"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Kategori *</label>
                <select
                  className="insight-input w-full"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.filter((c) => c !== "Semua Kategori").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Isi Dokumen / Teks Knowledge Base *</label>
                <textarea
                  rows={5}
                  required
                  placeholder="Tuliskan isi detail aturan, SOP, deskripsi produk, atau instruksi AI di sini..."
                  className="insight-input w-full font-mono text-xs"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Tags (Pisahkan koma)</label>
                  <input
                    type="text"
                    placeholder="capcut, garansi, sop"
                    className="insight-input w-full"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nama File Sumber (Opsional)</label>
                  <input
                    type="text"
                    placeholder="capcut_rules.pdf"
                    className="insight-input w-full"
                    value={formSourceFile}
                    onChange={(e) => setFormSourceFile(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--insight-border)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="insight-button bg-slate-300 hover:bg-slate-400 text-black px-3.5 py-1.5"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting || isViewer}
                  className="insight-button bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {submitting ? "Menyimpan..." : "Simpan Data KB"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
