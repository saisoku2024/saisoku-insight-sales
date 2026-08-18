"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { ToolbarSelect } from "@/components/dashboard/toolbar-select";
import { SearchableFilter } from "@/components/dashboard/searchable-filter";
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context";
import { supabase } from "@/lib/supabase/client";
import { maskEmail } from "@/lib/utils";
import { adminWrite } from "@/services/admin/admin-api-client";
import type { Product, Stock } from "@/types";

// CSV format (semicolon):
// email;password;profile;pin
function parseCsvSemicolon(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 1) return [];

  const cleanLine = (line: string) => {
    if (line.startsWith('"') && line.endsWith('"')) {
      return line.slice(1, -1);
    }
    return line;
  };

  const cleanCell = (cell: string) => {
    const c = cell.trim();
    if (c.startsWith('"') && c.endsWith('"')) return c.slice(1, -1).trim();
    return c;
  };

  // Deteksi separator secara dinamis berdasarkan baris pertama
  const firstLine = lines[0];
  let separator = ";";
  if (firstLine.includes("|")) {
    separator = "|";
  } else if (firstLine.includes(";")) {
    separator = ";";
  } else if (firstLine.includes(":")) {
    separator = ":";
  }

  const defaultHeaders = ["email", "password", "profile", "pin"];
  const headerLine = cleanLine(lines[0]);
  const firstColumns = headerLine.split(separator).map((h) => cleanCell(h).toLowerCase());
  const hasHeader = firstColumns.some((value) => defaultHeaders.includes(value));
  const headers = hasHeader ? firstColumns : defaultHeaders;
  const startIndex = hasHeader ? 1 : 0;

  const rows: Record<string, string>[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rowLine = cleanLine(lines[i]);
    const cols = rowLine.split(separator).map(cleanCell);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    obj.__line = String(i + 1);
    rows.push(obj);
  }

  return rows;
}

function getProductName(products: Stock["products"]) {
  if (!products) return "-";
  if (Array.isArray(products)) return products[0]?.name ?? "-";
  return products?.name ?? "-";
}

function getProductCode(products: Stock["products"]) {
  if (!products) return "";
  if (Array.isArray(products)) return products[0]?.product_code ?? "";
  return products?.product_code ?? "";
}

function statusClass(status: Stock["status"]) {
  if (status === "available") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300";
  if (status === "deleted") return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  if (status === "reserved") return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
  if (status === "inactive") return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
}

type BroadcastCandidate = {
  product: Product;
  addedCount: number;
  templateText: string;
};

function buildRestockTemplate(product: Product, addedCount: number) {
  return `📢 <b>RESTOCK NOTIFICATION</b> 📢
━━━━━━━━━━━━━━━━━━━
✨ Stok untuk produk berikut sudah tersedia kembali!

📦 <b>Produk:</b> ${product.name}
⚡ <b>Status:</b> Ready Stock (+${addedCount} Akun)
⏳ <b>Durasi:</b> ${product.duration_days || 30} Hari

🔥 <i>Yuk jajan!</i>
━━━━━━━━━━━━━━━━━━━`;
}

type StockViewType = "active" | "available" | "non_available" | "deleted" | "all";

export default function StocksPage() {
  const isViewer = useIsViewer();
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);

  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterProductCode, setFilterProductCode] = useState("");
  const [stockView, setStockView] = useState<StockViewType>("active");

  // Add stock form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState("");
  const [pin, setPin] = useState("");
  const [productId, setProductId] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editStockData, setEditStockData] = useState<Stock | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Stock | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false);
  const [bulkRestoreReasonMode, setBulkRestoreReasonMode] = useState<"regular" | "cancel_trx">("regular");

  // Single Restore Modal Candidate
  const [singleRestoreCandidate, setSingleRestoreCandidate] = useState<Stock | null>(null);
  const [singleRestoreReasonMode, setSingleRestoreReasonMode] = useState<"regular" | "cancel_trx">("regular");
  const [singleRestoreSubmitting, setSingleRestoreSubmitting] = useState(false);

  // Restore Modal State (Dedicated by Product Code / Garansi)
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreProductId, setRestoreProductId] = useState<string>("");
  const [restoreProductStocks, setRestoreProductStocks] = useState<Stock[]>([]);
  const [restoreSearch, setRestoreSearch] = useState("");
  const [restoreStatusFilter, setRestoreStatusFilter] = useState<string>("all");
  const [restoreModalTab, setRestoreModalTab] = useState<"list" | "paste" | "status">("list");
  const [restorePasteText, setRestorePasteText] = useState("");
  const [restoreModalSelectedIds, setRestoreModalSelectedIds] = useState<string[]>([]);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSubmitting, setRestoreSubmitting] = useState(false);
  const [restoreReasonMode, setRestoreReasonMode] = useState<"regular" | "cancel_trx">("regular");

  // Restock Broadcast Candidate
  const [broadcastCandidate, setBroadcastCandidate] = useState<BroadcastCandidate | null>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"insert" | "update">("insert");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [notice, setNotice] = useState<ActionNoticeState>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [stats, setStats] = useState({ total: 0, available: 0, sold: 0, deleted: 0 });
  const showError = (message: string) => setNotice({ type: "error", message });
  const showSuccess = (message: string) => setNotice({ type: "success", message });
  const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unknown error");
  const viewerDisabledClass = " disabled:cursor-not-allowed disabled:opacity-50";
  const controlClass =
    "box-border h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-0 text-sm leading-none text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] outline-none";
  const actionClass =
    "inline-flex box-border h-9 min-w-[110px] items-center justify-center border-2 border-[var(--insight-border)] px-4 py-0 text-sm font-semibold leading-none shadow-[2px_2px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:hover:translate-y-0";

  async function fetchProducts() {
    const { data } = await supabase.from("products").select("*").order("name", { ascending: true });
    setProducts(data || []);
  }

  const fetchStocks = useCallback(async () => {
    const brandProductIds = filterBrand
      ? products.filter((product) => product.name === filterBrand).map((product) => product.id)
      : [];

    const codeProductIds = filterProductCode
      ? products.filter((product) => product.product_code === filterProductCode).map((product) => product.id)
      : [];

    if (filterBrand && brandProductIds.length === 0) {
      setStocks([]);
      setStats({ total: 0, available: 0, sold: 0, deleted: 0 });
      return;
    }

    if (filterProductCode && codeProductIds.length === 0) {
      setStocks([]);
      setStats({ total: 0, available: 0, sold: 0, deleted: 0 });
      return;
    }

    let targetProductIds: string[] | null = null;
    if (filterBrand && filterProductCode) {
      targetProductIds = brandProductIds.filter((id) => codeProductIds.includes(id));
    } else if (filterBrand) {
      targetProductIds = brandProductIds;
    } else if (filterProductCode) {
      targetProductIds = codeProductIds;
    }

    if (targetProductIds !== null && targetProductIds.length === 0) {
      setStocks([]);
      setStats({ total: 0, available: 0, sold: 0, deleted: 0 });
      return;
    }

    // Query stats across all matching stock (all statuses, all pages)
    let statsQuery = supabase.from("product_accounts").select("status");

    if (search) statsQuery = statsQuery.ilike("email", `%${search}%`);
    if (targetProductIds !== null) statsQuery = statsQuery.in("product_id", targetProductIds);

    const { data: statsData } = await statsQuery;
    const allMatching = statsData || [];

    const available = allMatching.filter((x) => x.status === "available").length;
    const sold = allMatching.filter((x) => x.status === "sold").length;
    const deleted = allMatching.filter((x) => x.status === "deleted").length;
    const total = allMatching.length;
    setStats({ total, available, sold, deleted });

    // Query paginated stocks based on stockView
    let query = supabase
      .from("product_accounts")
      .select(`*,products(name,product_code)`)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) query = query.ilike("email", `%${search}%`);
    if (targetProductIds !== null) query = query.in("product_id", targetProductIds);

    if (stockView === "active") query = query.neq("status", "deleted");
    else if (stockView === "available") query = query.eq("status", "available");
    else if (stockView === "non_available") query = query.neq("status", "available").neq("status", "deleted");
    else if (stockView === "deleted") query = query.eq("status", "deleted");

    const { data } = await query;
    const list = (data || []) as Stock[];

    setStocks(list);
    setSelectedStockIds((current) => current.filter((id) => list.some((stock) => stock.id === id)));
  }, [page, search, filterBrand, filterProductCode, products, stockView]);

  // Fetch stocks for the dedicated Restore Modal for selected product
  const fetchRestoreStocksForProduct = useCallback(async (pId: string) => {
    if (!pId) {
      setRestoreProductStocks([]);
      return;
    }
    setRestoreLoading(true);
    try {
      const { data, error } = await supabase
        .from("product_accounts")
        .select(`*,products(name,product_code)`)
        .eq("product_id", pId)
        .order("created_at", { ascending: false });

      if (error) {
        showError(`Gagal mengambil data akun produk: ${error.message}`);
        return;
      }
      setRestoreProductStocks((data || []) as Stock[]);
      setRestoreModalSelectedIds([]);
    } finally {
      setRestoreLoading(false);
    }
  }, []);

  const openRestoreModalForCurrentProduct = () => {
    let targetPId = "";
    if (filterProductCode) {
      const p = products.find((prod) => prod.product_code === filterProductCode);
      if (p) targetPId = p.id;
    } else if (filterBrand) {
      const p = products.find((prod) => prod.name === filterBrand);
      if (p) targetPId = p.id;
    }

    if (!targetPId && products.length > 0) {
      targetPId = products[0].id;
    }

    setRestoreProductId(targetPId);
    setRestoreSearch("");
    setRestoreStatusFilter("all");
    setRestorePasteText("");
    setShowRestoreModal(true);
    if (targetPId) {
      void fetchRestoreStocksForProduct(targetPId);
    }
  };

  async function addStock() {
    if (!productId) {
      showError("Pilih produk dulu.");
      return;
    }
    if (!email.trim()) {
      showError("Email wajib diisi.");
      return;
    }

    try {
      await adminWrite<Stock[]>("/api/admin/stocks", {
        body: {
          product_id: productId,
          email: email.trim(),
          password: password?.trim() || null,
          profile: profile?.trim() || null,
          pin: pin?.trim() || null,
          status: "available",
        },
      });
    } catch (error) {
      showError(`Gagal add stock: ${getErrorMessage(error)}`);
      return;
    }

    const targetProd = products.find((p) => p.id === productId);

    setEmail("");
    setPassword("");
    setProfile("");
    setPin("");
    setProductId("");
    setShowAddModal(false);
    showSuccess("Stock berhasil ditambahkan.");

    void fetchStocks();

    if (targetProd) {
      setBroadcastCandidate({
        product: targetProd,
        addedCount: 1,
        templateText: buildRestockTemplate(targetProd, 1),
      });
    }
  }

  async function sendRestockBroadcast() {
    if (!broadcastCandidate) return;
    setIsBroadcasting(true);
    try {
      const res = await adminWrite<{ data?: { success?: number; failed?: number }; success?: number; failed?: number }>("/api/admin/broadcast", {
        body: {
          text: broadcastCandidate.templateText,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🛍️ Beli Sekarang", callback_data: `pick_product_${broadcastCandidate.product.id}` },
                { text: "📋 List Produk", callback_data: "list_produk" },
              ],
            ],
          },
        },
      });

      setBroadcastCandidate(null);
      const successNum = res?.success ?? res?.data?.success ?? 0;
      showSuccess(`Broadcast restock berhasil terkirim ke ${successNum} user Telegram.`);
    } catch (err) {
      showError(`Gagal kirim broadcast: ${getErrorMessage(err)}`);
    } finally {
      setIsBroadcasting(false);
    }
  }

  async function updateStock() {
    if (!editStockData) return;

    try {
      await adminWrite<Stock>("/api/admin/stocks", {
        method: "PATCH",
        body: {
          id: editStockData.id,
          email: editStockData.email,
          password: editStockData.password,
          profile: editStockData.profile,
          pin: editStockData.pin,
          status: editStockData.status,
        },
      });
    } catch (error) {
      showError(`Gagal update stock: ${getErrorMessage(error)}`);
      return;
    }

    setEditStockData(null);
    showSuccess("Stock berhasil diupdate.");
    void fetchStocks();
  }

  async function deleteStock(id: string) {
    try {
      await adminWrite("/api/admin/stocks", {
        method: "DELETE",
        body: { id },
      });
    } catch (error) {
      showError(`Gagal delete stock: ${getErrorMessage(error)}`);
      return;
    }
    setDeleteCandidate(null);
    showSuccess("Stock berhasil dihapus.");
    void fetchStocks();
  }

  async function bulkDeleteStock() {
    if (isViewer || selectedStockIds.length === 0) return;

    try {
      await adminWrite("/api/admin/stocks", {
        method: "DELETE",
        body: { ids: selectedStockIds },
      });
    } catch (error) {
      showError(`Gagal bulk delete stock: ${getErrorMessage(error)}`);
      return;
    }

    setBulkDeleteOpen(false);
    setSelectedStockIds([]);
    showSuccess(`${selectedStockIds.length} stock berhasil dipindahkan ke deleted.`);
    void fetchStocks();
  }

  // Restore single stock item to available
  async function restoreStock(stock: Stock, mode: "regular" | "cancel_trx" = "regular") {
    if (isViewer) return;
    setSingleRestoreSubmitting(true);
    try {
      const res = await adminWrite<{ data?: { cancelledTxsCount?: number } }>("/api/admin/stocks", {
        method: "PATCH",
        body: {
          id: stock.id,
          email: stock.email,
          password: stock.password,
          profile: stock.profile,
          pin: stock.pin,
          status: "available",
          restore_mode: mode,
        },
      });

      const cancelledCount = res?.data?.cancelledTxsCount || 0;
      if (mode === "cancel_trx" && cancelledCount > 0) {
        showSuccess(`Stock ${stock.email} direstore ke available & ${cancelledCount} transaksi dibatalkan (GMV terkoreksi).`);
      } else {
        showSuccess(`Stock ${stock.email} berhasil direstore ke available.`);
      }
      setSingleRestoreCandidate(null);
      void fetchStocks();
      if (showRestoreModal && restoreProductId) {
        void fetchRestoreStocksForProduct(restoreProductId);
      }
    } catch (error) {
      showError(`Gagal restore stock: ${getErrorMessage(error)}`);
    } finally {
      setSingleRestoreSubmitting(false);
    }
  }

  // Bulk restore selected stock IDs to available
  async function bulkRestoreStock(targetIds?: string[], mode: "regular" | "cancel_trx" = "regular") {
    if (isViewer) return;
    const idsToRestore = targetIds || selectedStockIds;
    if (!idsToRestore.length) return;

    try {
      const res = await adminWrite<{ data?: { cancelledTxsCount?: number } }>("/api/admin/stocks", {
        method: "PATCH",
        body: {
          ids: idsToRestore,
          status: "available",
          restore_mode: mode,
        },
      });

      const cancelledCount = res?.data?.cancelledTxsCount || 0;
      if (mode === "cancel_trx" && cancelledCount > 0) {
        showSuccess(`${idsToRestore.length} stock direstore ke available & ${cancelledCount} transaksi dibatalkan (GMV terkoreksi).`);
      } else {
        showSuccess(`${idsToRestore.length} stock berhasil direstore ke available.`);
      }
      setBulkRestoreOpen(false);
      setSelectedStockIds((current) => current.filter((id) => !idsToRestore.includes(id)));
      void fetchStocks();
      if (showRestoreModal && restoreProductId) {
        void fetchRestoreStocksForProduct(restoreProductId);
      }
    } catch (error) {
      showError(`Gagal bulk restore stock: ${getErrorMessage(error)}`);
    }
  }

  // Dedicated Restore Modal: Restore selected in modal
  async function executeModalSelectedRestore() {
    if (isViewer || restoreModalSelectedIds.length === 0) return;
    setRestoreSubmitting(true);
    try {
      const res = await adminWrite<{ data?: { cancelledTxsCount?: number } }>("/api/admin/stocks", {
        method: "PATCH",
        body: {
          ids: restoreModalSelectedIds,
          status: "available",
          restore_mode: restoreReasonMode,
        },
      });

      const cancelledCount = res?.data?.cancelledTxsCount || 0;
      if (restoreReasonMode === "cancel_trx" && cancelledCount > 0) {
        showSuccess(`${restoreModalSelectedIds.length} akun berhasil direstore (${cancelledCount} transaksi dibatalkan, GMV terkoreksi).`);
      } else {
        showSuccess(`${restoreModalSelectedIds.length} akun berhasil direstore ke available.`);
      }
      setRestoreModalSelectedIds([]);
      void fetchRestoreStocksForProduct(restoreProductId);
      void fetchStocks();
    } catch (error) {
      showError(`Gagal restore akun: ${getErrorMessage(error)}`);
    } finally {
      setRestoreSubmitting(false);
    }
  }

  // Dedicated Restore Modal: Restore via pasted emails
  async function executeModalPasteRestore() {
    if (isViewer || !restorePasteText.trim()) return;
    const emails = restorePasteText
      .split(/[\r\n,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      showError("Harap masukkan setidaknya satu email.");
      return;
    }

    // Match against stocks for this product
    const matchingStocks = restoreProductStocks.filter((s) => emails.includes(s.email.toLowerCase()));
    const nonAvailableMatching = matchingStocks.filter((s) => s.status !== "available");

    if (nonAvailableMatching.length === 0) {
      if (matchingStocks.length > 0) {
        showError(`Semua (${matchingStocks.length}) akun yang dicocokkan sudah berstatus available.`);
      } else {
        showError("Tidak ada akun pada produk ini yang cocok dengan email yang dimasukkan.");
      }
      return;
    }

    setRestoreSubmitting(true);
    try {
      const ids = nonAvailableMatching.map((s) => s.id);
      const res = await adminWrite<{ data?: { cancelledTxsCount?: number } }>("/api/admin/stocks", {
        method: "PATCH",
        body: {
          ids,
          status: "available",
          restore_mode: restoreReasonMode,
        },
      });

      const cancelledCount = res?.data?.cancelledTxsCount || 0;
      const cancelMsg = restoreReasonMode === "cancel_trx" && cancelledCount > 0
        ? ` (${cancelledCount} transaksi dibatalkan, GMV terkoreksi)`
        : "";

      showSuccess(
        `Sukses: ${ids.length} akun cocok berhasil direstore ke available${
          matchingStocks.length > ids.length ? ` (${matchingStocks.length - ids.length} sudah available sebelumnya)` : ""
        }${cancelMsg}.`
      );
      setRestorePasteText("");
      void fetchRestoreStocksForProduct(restoreProductId);
      void fetchStocks();
    } catch (error) {
      showError(`Gagal restore akun dari daftar email: ${getErrorMessage(error)}`);
    } finally {
      setRestoreSubmitting(false);
    }
  }

  // Dedicated Restore Modal: Restore all in specific status
  async function executeModalRestoreByStatus(fromStatus: string) {
    if (isViewer || !restoreProductId) return;
    const targetStocks = restoreProductStocks.filter((s) => s.status === fromStatus);
    if (targetStocks.length === 0) {
      showError(`Tidak ada akun dengan status '${fromStatus}' untuk produk ini.`);
      return;
    }

    setRestoreSubmitting(true);
    try {
      const ids = targetStocks.map((s) => s.id);
      const res = await adminWrite<{ data?: { cancelledTxsCount?: number } }>("/api/admin/stocks", {
        method: "PATCH",
        body: {
          ids,
          status: "available",
          restore_mode: restoreReasonMode,
        },
      });

      const cancelledCount = res?.data?.cancelledTxsCount || 0;
      const cancelMsg = restoreReasonMode === "cancel_trx" && cancelledCount > 0
        ? ` (${cancelledCount} transaksi dibatalkan, GMV terkoreksi)`
        : "";

      showSuccess(`Sukses: ${ids.length} akun (${fromStatus}) berhasil direstore ke available${cancelMsg}.`);
      void fetchRestoreStocksForProduct(restoreProductId);
      void fetchStocks();
    } catch (error) {
      showError(`Gagal restore akun: ${getErrorMessage(error)}`);
    } finally {
      setRestoreSubmitting(false);
    }
  }

  async function bulkUploadCsv() {
    setUploadError("");

    const targetProd = products.find((p) =>
      filterProductCode ? p.product_code === filterProductCode : filterBrand ? p.name === filterBrand : false
    );
    const targetProductId = targetProd?.id || "";

    if (uploadMode === "insert" && !targetProductId) {
      return setUploadError("Pilih Product Code / Product Name yang spesifik dulu sebelum upload file.");
    }
    if (!csvFile) return setUploadError("Pilih file CSV/TXT dulu.");

    setUploading(true);
    setUploadProgress(0);

    try {
      const text = await csvFile.text();
      const rows = parseCsvSemicolon(text);
      if (!rows.length) throw new Error("CSV kosong / format salah.");

      const badIndex = rows.findIndex((r) => !(r.email || "").trim());
      if (badIndex !== -1) {
        throw new Error(`Baris ke-${rows[badIndex].__line || badIndex + 1} kolom Email/NoHP kosong`);
      }

      const payload = rows.map((r) => ({
        product_id: targetProductId || undefined,
        email: (r.email || "").trim(),
        password: (r.password || "").trim() || null,
        profile: (r.profile || "").trim() || null,
        pin: (r.pin || "").trim() || null,
        status: "available",
      }));

      const batchSize = 200;
      let totalUpdated = 0;
      let totalNotFound = 0;

      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);

        if (uploadMode === "update") {
          const res = await adminWrite<{ updatedCount: number; notFoundCount: number }>("/api/admin/stocks", {
            method: "PATCH",
            body: { items: batch },
          });
          totalUpdated += res?.updatedCount || 0;
          totalNotFound += res?.notFoundCount || 0;
        } else {
          await adminWrite<Stock[]>("/api/admin/stocks", {
            method: "POST",
            body: { items: batch },
          });
        }
        setUploadProgress(Math.round(((i + batch.length) / payload.length) * 100));
      }

      setCsvFile(null);
      setUploading(false);
      setUploadProgress(100);
      void fetchStocks();

      if (uploadMode === "update") {
        showSuccess(
          `Bulk update sukses: ${totalUpdated} akun berhasil di-update${
            totalNotFound > 0 ? `, ${totalNotFound} email tidak ditemukan` : ""
          }.`
        );
      } else {
        showSuccess("Bulk upload stok baru sukses.");
        if (targetProd && payload.length > 0) {
          setBroadcastCandidate({
            product: targetProd,
            addedCount: payload.length,
            templateText: buildRestockTemplate(targetProd, payload.length),
          });
        }
      }
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Upload gagal");
      setUploading(false);
    }
  }

  const nextPage = () => {
    if (stocks.length === pageSize) setPage(page + 1);
  };
  const prevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const brandFilterOptions = Array.from(new Set(products.map((p) => p.name).filter(Boolean)))
    .sort()
    .map((name) => ({
      value: name,
      label: name,
    }));

  const productCodeFilterOptions = Array.from(
    new Set(
      products
        .filter((p) => !filterBrand || p.name === filterBrand)
        .map((p) => p.product_code)
        .filter(Boolean)
    )
  )
    .sort()
    .map((code) => {
      const matchedProd = products.find((p) => p.product_code === code);
      return {
        value: code,
        label: code,
        sublabel: matchedProd?.name || undefined,
      };
    });

  const allVisibleSelected = stocks.length > 0 && stocks.every((stock) => selectedStockIds.includes(stock.id));

  function toggleSelectStock(id: string) {
    setSelectedStockIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleSelectVisible() {
    if (allVisibleSelected) {
      setSelectedStockIds((current) => current.filter((id) => !stocks.some((stock) => stock.id === id)));
      return;
    }

    setSelectedStockIds((current) => Array.from(new Set([...current, ...stocks.map((stock) => stock.id)])));
  }

  // Filtered stocks for Dedicated Restore Modal
  const restoreModalSelectedProduct = useMemo(
    () => products.find((p) => p.id === restoreProductId) || null,
    [products, restoreProductId]
  );

  const restoreProductStats = useMemo(() => {
    const total = restoreProductStocks.length;
    const available = restoreProductStocks.filter((s) => s.status === "available").length;
    const sold = restoreProductStocks.filter((s) => s.status === "sold").length;
    const reserved = restoreProductStocks.filter((s) => s.status === "reserved").length;
    const inactive = restoreProductStocks.filter((s) => s.status === "inactive").length;
    const deleted = restoreProductStocks.filter((s) => s.status === "deleted").length;
    const nonAvailable = total - available;
    return { total, available, sold, reserved, inactive, deleted, nonAvailable };
  }, [restoreProductStocks]);

  const filteredRestoreModalStocks = useMemo(() => {
    let list = restoreProductStocks.filter((s) => s.status !== "available");
    if (restoreStatusFilter !== "all") {
      list = list.filter((s) => s.status === restoreStatusFilter);
    }
    if (restoreSearch.trim()) {
      const term = restoreSearch.trim().toLowerCase();
      list = list.filter((s) => s.email.toLowerCase().includes(term) || (s.profile || "").toLowerCase().includes(term));
    }
    return list;
  }, [restoreProductStocks, restoreStatusFilter, restoreSearch]);

  const allRestoreModalVisibleSelected =
    filteredRestoreModalStocks.length > 0 &&
    filteredRestoreModalStocks.every((s) => restoreModalSelectedIds.includes(s.id));

  function toggleSelectAllRestoreModal() {
    if (allRestoreModalVisibleSelected) {
      setRestoreModalSelectedIds((prev) =>
        prev.filter((id) => !filteredRestoreModalStocks.some((s) => s.id === id))
      );
    } else {
      setRestoreModalSelectedIds((prev) =>
        Array.from(new Set([...prev, ...filteredRestoreModalStocks.map((s) => s.id)]))
      );
    }
  }

  useEffect(() => {
    void fetchProducts();
  }, []);

  useEffect(() => {
    void fetchStocks();

    const channel = supabase
      .channel("stock-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_accounts" }, () => {
        void fetchStocks();
        if (showRestoreModal && restoreProductId) {
          void fetchRestoreStocksForProduct(restoreProductId);
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchStocks, showRestoreModal, restoreProductId, fetchRestoreStocksForProduct]);

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      {/* HEADER */}
      <div className="insight-card flex flex-wrap items-center justify-between gap-3 p-3 px-4">
        <div>
          <span className="inline-block border-2 border-[var(--insight-border)] bg-emerald-100 px-2.5 py-0.5 text-xs font-bold leading-none text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
            STOCK MANAGEMENT
          </span>
          <h1 className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">
            Stock Management
          </h1>
          <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
            Manage account inventory, stock availability, bulk uploads and warranty restore
          </p>
        </div>

        {/* TOP QUICK ACTION: RESTORE BY PRODUCT CODE */}
        <div>
          <button
            onClick={openRestoreModalForCurrentProduct}
            disabled={isViewer || products.length === 0}
            title={isViewer ? viewerOnlyTitle : "Buka panel restore stock ke available sesuai kode produk"}
            className={`${actionClass} bg-emerald-600 font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-emerald-700${viewerDisabledClass}`}
          >
            ♻️ Restore Stock (Kode Produk / Garansi)
          </button>
        </div>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      {/* KPI CARDS */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="insight-card flex min-h-[90px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-1">
          <div className="text-sm leading-none text-[var(--insight-muted)]">Total Stock</div>
          <div className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">
            {stats.total.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="insight-card flex min-h-[90px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-1">
          <div className="text-sm leading-none text-[var(--insight-muted)]">Available (Ready)</div>
          <div className="mt-2 text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-300">
            {stats.available.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="insight-card flex min-h-[90px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-1">
          <div className="text-sm leading-none text-[var(--insight-muted)]">Sold</div>
          <div className="mt-2 text-2xl font-bold leading-none text-red-600 dark:text-red-300">
            {stats.sold.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="insight-card flex min-h-[90px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-1">
          <div className="text-sm leading-none text-[var(--insight-muted)]">Deleted</div>
          <div className="mt-2 text-2xl font-bold leading-none text-slate-600 dark:text-slate-300">
            {stats.deleted.toLocaleString("id-ID")}
          </div>
        </div>
      </div>

      {/* FILTER AREA */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className={`${controlClass} w-[180px]`}
            placeholder="Search email..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
          <SearchableFilter
            value={filterBrand}
            options={brandFilterOptions}
            placeholder="Brand (Name)"
            minChars={3}
            minWidth={200}
            ariaLabel="Filter stocks by product name"
            onChange={(nextBrand) => {
              setPage(1);
              setFilterBrand(nextBrand);
              if (!nextBrand) {
                setFilterProductCode("");
              } else {
                const matchingProds = products.filter((p) => p.name === nextBrand);
                if (matchingProds.length > 0 && matchingProds[0].product_code) {
                  setFilterProductCode(matchingProds[0].product_code);
                }
              }
            }}
          />

          <SearchableFilter
            value={filterProductCode}
            options={productCodeFilterOptions}
            placeholder="Product Code"
            minChars={3}
            minWidth={200}
            ariaLabel="Filter stocks by product code"
            onChange={(nextCode) => {
              setPage(1);
              setFilterProductCode(nextCode);
              if (nextCode) {
                const matchedProd = products.find((p) => p.product_code === nextCode);
                if (matchedProd?.name) {
                  setFilterBrand(matchedProd.name);
                }
              }
            }}
          />

          <ToolbarSelect
            value={stockView}
            options={[
              { value: "active", label: "Active (Non-Deleted)" },
              { value: "available", label: "Available (Ready)" },
              { value: "non_available", label: "Sold / Inactive / Garansi" },
              { value: "deleted", label: "Deleted Stock" },
              { value: "all", label: "All Stock" },
            ]}
            onChange={(nextView) => {
              setPage(1);
              setStockView(nextView as StockViewType);
            }}
            minWidth={200}
            ariaLabel="Filter stock status"
          />

          <button
            onClick={() => {
              if (isViewer) return;
              setShowAddModal(true);
            }}
            disabled={isViewer}
            title={isViewer ? viewerOnlyTitle : undefined}
            className={`${actionClass} bg-emerald-600 text-white${viewerDisabledClass}`}
          >
            + Add Stock
          </button>

          {/* BULK ACTIONS WHEN ROWS SELECTED */}
          {selectedStockIds.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (isViewer) return;
                  setBulkRestoreOpen(true);
                  setBulkRestoreReasonMode("regular");
                }}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : "Restore akun yang dipilih ke status available"}
                className={`${actionClass} min-w-[130px] bg-emerald-600 text-white shadow-[2px_2px_0_var(--insight-shadow)]`}
              >
                ♻️ Restore ({selectedStockIds.length})
              </button>
              <button
                onClick={() => {
                  if (isViewer || selectedStockIds.length === 0) return;
                  setBulkDeleteOpen(true);
                }}
                disabled={isViewer || selectedStockIds.length === 0}
                title={isViewer ? viewerOnlyTitle : selectedStockIds.length === 0 ? "Pilih stock dulu" : undefined}
                className={`${actionClass} min-w-[120px] bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Delete ({selectedStockIds.length})
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={uploadMode}
            onChange={(e) => setUploadMode(e.target.value as "insert" | "update")}
            disabled={isViewer || uploading}
            className={`${controlClass} h-9 min-w-[200px] text-sm font-semibold`}
          >
            <option value="insert">Mode: Tambah Stok Baru</option>
            <option value="update">Mode: Update Stok Existing (Mass Edit)</option>
          </select>

          <label
            className={`${actionClass} min-w-[130px] bg-[var(--insight-panel)] text-[var(--insight-text)] ${
              isViewer ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
            title={isViewer ? viewerOnlyTitle : undefined}
          >
            {csvFile ? `File: ${csvFile.name.slice(0, 15)}...` : "Pilih CSV/TXT"}
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              disabled={isViewer}
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            />
          </label>

          <button
            disabled={isViewer || (uploadMode === "insert" && !filterBrand && !filterProductCode) || !csvFile || uploading}
            onClick={() => void bulkUploadCsv()}
            className={`${actionClass} min-w-[140px] ${
              uploadMode === "update" ? "bg-amber-600" : "bg-[var(--insight-blue)]"
            } text-white disabled:cursor-not-allowed disabled:opacity-40`}
            title={
              isViewer
                ? viewerOnlyTitle
                : uploadMode === "insert" && !filterBrand && !filterProductCode
                ? "Pilih produk dulu untuk Mode Tambah Stok Baru"
                : ""
            }
          >
            {uploading ? `Uploading ${uploadProgress}%` : uploadMode === "update" ? "Bulk Update" : "Bulk Upload"}
          </button>

          <div className="flex h-9 items-center text-sm text-[var(--insight-muted)] xl:ml-auto">
            View: <span className="ml-1 font-semibold text-[var(--insight-text)]">{filterBrand || "All Products"}</span>
            {filterProductCode ? <span className="font-semibold"> / {filterProductCode}</span> : null}
            {selectedStockIds.length > 0 ? (
              <span className="ml-2 font-bold text-emerald-600 dark:text-emerald-400">
                (Selected: {selectedStockIds.length})
              </span>
            ) : null}
          </div>
        </div>

        <div className="space-y-1 text-xs text-[var(--insight-muted)]">
          <div>
            Format CSV/TXT:{" "}
            <code className="border-[2px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-2 py-0.5 font-mono text-red-500">
              email;password;profile;pin
            </code>
          </div>
          {uploadMode === "update" && (
            <p className="font-medium text-amber-700 dark:text-amber-300">
              * Mode Update akan memperbarui password, profile, dan PIN pada akun yang cocok berdasarkan email (berlaku untuk semua status: available, sold, reserved, expired, dll).
            </p>
          )}
        </div>

        {uploadError && <div className="text-sm font-medium text-red-600">{uploadError}</div>}
      </div>

      {/* TABLE */}
      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={isViewer || stocks.length === 0}
                    onChange={toggleSelectVisible}
                    className="h-5 w-5 accent-[var(--insight-blue)] disabled:opacity-40"
                    title={isViewer ? viewerOnlyTitle : "Select all visible stocks"}
                  />
                </th>
                <th className="px-4 py-3 text-sm">Product</th>
                <th className="px-4 py-3 text-sm">Brand</th>
                <th className="px-4 py-3 text-sm">Email</th>
                <th className="px-4 py-3 text-sm">Profile</th>
                <th className="px-4 py-3 text-sm">PIN</th>
                <th className="px-4 py-3 text-sm">Status</th>
                <th className="px-4 py-3 text-sm">Action</th>
              </tr>
            </thead>

            <tbody>
              {stocks.map((s) => (
                <tr key={s.id} className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedStockIds.includes(s.id)}
                      disabled={isViewer}
                      onChange={() => toggleSelectStock(s.id)}
                      className="h-5 w-5 accent-[var(--insight-blue)] disabled:opacity-40"
                      title={isViewer ? viewerOnlyTitle : "Select stock"}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium">
                    <div>{getProductName(s.products)}</div>
                    <div className="text-xs text-[var(--insight-muted)]">{getProductCode(s.products) || "-"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    {getProductCode(s.products)?.split(/[-_\s/]+/)[0]?.toUpperCase() || "-"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sm" title={maskEmail(s.email)}>
                    {maskEmail(s.email)}
                  </td>
                  <td className="px-4 py-2.5 text-sm">{isViewer ? "***" : s.profile || "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-sm">{isViewer ? "***" : s.pin || "—"}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block border-2 border-[var(--insight-border)] px-2 py-0.5 text-xs font-bold leading-none ${statusClass(
                        s.status
                      )}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {/* QUICK RESTORE BUTTON FOR ANY NON-AVAILABLE STATUS */}
                      {s.status !== "available" && (
                        <button
                          onClick={() => {
                            if (isViewer) return;
                            setSingleRestoreCandidate(s);
                            setSingleRestoreReasonMode("regular");
                          }}
                          disabled={isViewer}
                          title={isViewer ? viewerOnlyTitle : "Restore akun ini ke status available"}
                          className={
                            "border-2 border-[var(--insight-border)] bg-emerald-600 px-2 py-1 text-xs font-bold leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5" +
                            viewerDisabledClass
                          }
                        >
                          ♻️ Restore
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (isViewer) return;
                          setEditStockData(s);
                        }}
                        disabled={isViewer}
                        title={isViewer ? viewerOnlyTitle : undefined}
                        className={
                          "border-2 border-[var(--insight-border)] bg-[var(--insight-blue)] px-2 py-1 text-xs font-bold leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5" +
                          viewerDisabledClass
                        }
                      >
                        Edit
                      </button>

                      {s.status !== "deleted" && (
                        <button
                          onClick={() => {
                            if (isViewer) return;
                            setDeleteCandidate(s);
                          }}
                          disabled={isViewer}
                          title={isViewer ? viewerOnlyTitle : undefined}
                          className={
                            "border-2 border-[var(--insight-border)] bg-red-600 px-2 py-1 text-xs font-bold leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5" +
                            viewerDisabledClass
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {stocks.length === 0 && (
                <tr>
                  <td className="p-8 text-center text-base text-[var(--insight-muted)]" colSpan={8}>
                    Tidak ada data persediaan akun saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevPage}
          disabled={page === 1}
          className="insight-button px-4 py-2 text-sm leading-none disabled:opacity-40"
        >
          Prev
        </button>
        <div className="px-2 text-sm font-semibold">Page {page}</div>
        <button
          onClick={nextPage}
          disabled={stocks.length < pageSize}
          className="insight-button px-4 py-2 text-sm leading-none disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* MODAL ADD STOCK */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="insight-card w-full max-w-md space-y-4 p-6 shadow-[6px_6px_0_var(--insight-shadow)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--insight-border)] pb-2">
              <h2 className="text-xl font-bold text-[var(--insight-text)]">Add Stock</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-lg font-bold text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--insight-muted)]">Product</label>
                <select
                  className="h-10 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">Pilih produk...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.product_code || "CODE"}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {[
                { label: "Email / No HP", state: email, setter: setEmail, placeholder: "admin@saisoku.id" },
                { label: "Password", state: password, setter: setPassword, placeholder: "Password akun" },
                { label: "Profile No", state: profile, setter: setProfile, placeholder: "Contoh: Profile 3" },
                { label: "PIN", state: pin, setter: setPin, placeholder: "123456" },
              ].map(({ label, state, setter, placeholder }) => (
                <div key={label} className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--insight-muted)]">{label}</label>
                  <input
                    className="h-10 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
                    value={state}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowAddModal(false)} className="insight-button px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void addStock()}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={
                  "border-2 border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] hover:-translate-y-0.5" +
                  viewerDisabledClass
                }
              >
                Save Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT STOCK (INCLUDES STATUS SELECTOR) */}
      {editStockData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="insight-card w-full max-w-md space-y-4 p-6 shadow-[6px_6px_0_var(--insight-shadow)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--insight-border)] pb-2">
              <div>
                <span className="inline-block border-2 border-[var(--insight-border)] bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                  EDIT STOCK
                </span>
                <h2 className="mt-1 text-xl font-bold text-[var(--insight-text)]">Edit Akun</h2>
              </div>
              <button
                onClick={() => setEditStockData(null)}
                className="text-lg font-bold text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--insight-muted)]">Status Akun</label>
                <select
                  className="h-10 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm font-bold text-[var(--insight-text)] outline-none"
                  value={editStockData.status}
                  onChange={(e) =>
                    setEditStockData({ ...editStockData, status: e.target.value as Stock["status"] })
                  }
                >
                  <option value="available">🟢 available (Siap Dijual / Garansi Replenish)</option>
                  <option value="sold">🔴 sold (Terjual)</option>
                  <option value="reserved">🟡 reserved (Sedang Dipesan)</option>
                  <option value="inactive">⚪ inactive (Non-Aktif)</option>
                  <option value="deleted">⚫ deleted (Terhapus)</option>
                </select>
                {editStockData.status === "available" && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    * Menyimpan status sebagai available akan mereset data sold sehingga akun langsung siap dijual kembali.
                  </p>
                )}
              </div>

              {[
                { label: "Email / No HP", field: "email" as const },
                { label: "Password", field: "password" as const },
                { label: "Profile No", field: "profile" as const },
                { label: "PIN", field: "pin" as const },
              ].map(({ label, field }) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--insight-muted)]">{label}</label>
                  <input
                    className="h-10 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
                    value={editStockData[field] ?? ""}
                    onChange={(e) => setEditStockData({ ...editStockData, [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setEditStockData(null)} className="insight-button px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void updateStock()}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={
                  "border-2 border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] hover:-translate-y-0.5" +
                  viewerDisabledClass
                }
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEDICATED RESTORE BY PRODUCT CODE (GARANSI) */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="insight-card flex max-h-[90vh] w-full max-w-3xl flex-col space-y-4 overflow-hidden p-6 shadow-[8px_8px_0_var(--insight-shadow)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-[var(--insight-border)] pb-3">
              <div className="space-y-0.5">
                <span className="inline-block border-2 border-[var(--insight-border)] bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  ♻️ RESTORE STOCK KE AVAILABLE
                </span>
                <h2 className="text-xl font-bold text-[var(--insight-text)]">
                  Restore Stok Akun Garansi per Kode Produk
                </h2>
                <p className="text-xs text-[var(--insight-muted)]">
                  Kembalikan akun yang pernah dipakai untuk garansi/sold/inactive menjadi <b>available</b> sesuai kode produk.
                </p>
              </div>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="text-xl font-bold text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
              >
                ✕
              </button>
            </div>

            {/* Product Selector & Stats Header */}
            <div className="grid gap-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-6">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--insight-muted)]">
                  Pilih Produk / Kode Produk
                </label>
                <select
                  value={restoreProductId}
                  onChange={(e) => {
                    setRestoreProductId(e.target.value);
                    if (e.target.value) {
                      void fetchRestoreStocksForProduct(e.target.value);
                    }
                  }}
                  className="h-10 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm font-bold text-[var(--insight-text)] outline-none shadow-[2px_2px_0_var(--insight-shadow)]"
                >
                  <option value="">Pilih Produk...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.product_code || "CODE"}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Real-time stock counts for chosen product */}
              <div className="flex flex-wrap items-center gap-2 md:col-span-6 md:justify-end">
                <div className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-2.5 py-1 text-center shadow-[2px_2px_0_var(--insight-shadow)]">
                  <div className="text-[10px] uppercase text-[var(--insight-muted)]">Available</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {restoreProductStats.available}
                  </div>
                </div>
                <div className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-2.5 py-1 text-center shadow-[2px_2px_0_var(--insight-shadow)]">
                  <div className="text-[10px] uppercase text-[var(--insight-muted)]">Sold</div>
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">
                    {restoreProductStats.sold}
                  </div>
                </div>
                <div className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-2.5 py-1 text-center shadow-[2px_2px_0_var(--insight-shadow)]">
                  <div className="text-[10px] uppercase text-[var(--insight-muted)]">Inactive/Del</div>
                  <div className="text-sm font-bold text-slate-600 dark:text-slate-400">
                    {restoreProductStats.inactive + restoreProductStats.deleted}
                  </div>
                </div>
                <div className="border-2 border-[var(--insight-border)] bg-amber-50 px-2.5 py-1 text-center shadow-[2px_2px_0_var(--insight-shadow)] dark:bg-amber-950/40">
                  <div className="text-[10px] uppercase text-amber-800 dark:text-amber-300">Bisa Direstore</div>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    {restoreProductStats.nonAvailable}
                  </div>
                </div>
              </div>
            </div>

            {/* Mode & Alasan Restore Selector */}
            <div className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 shadow-[2px_2px_0_var(--insight-shadow)]">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--insight-text)]">
                ⚙️ Mode & Alasan Restore:
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label
                  onClick={() => setRestoreReasonMode("regular")}
                  className={`flex cursor-pointer items-start gap-2.5 border-2 p-2.5 transition ${
                    restoreReasonMode === "regular"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                      : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)] opacity-75 hover:opacity-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="restore_modal_mode"
                    value="regular"
                    checked={restoreReasonMode === "regular"}
                    onChange={() => setRestoreReasonMode("regular")}
                    className="mt-0.5 accent-emerald-600"
                  />
                  <div>
                    <div className="text-xs font-bold">♻️ Restore Biasa (Bekas / Masa Pakai Selesai)</div>
                    <div className="mt-0.5 text-[11px] text-[var(--insight-muted)]">
                      Stok kembali <b>available</b>. Transaksi lama tetap sah (<b>paid</b>), <b>GMV & Revenue TIDAK berkurang</b>.
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setRestoreReasonMode("cancel_trx")}
                  className={`flex cursor-pointer items-start gap-2.5 border-2 p-2.5 transition ${
                    restoreReasonMode === "cancel_trx"
                      ? "border-rose-600 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200"
                      : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)] opacity-75 hover:opacity-100"
                  }`}
                >
                  <input
                    type="radio"
                    name="restore_modal_mode"
                    value="cancel_trx"
                    checked={restoreReasonMode === "cancel_trx"}
                    onChange={() => setRestoreReasonMode("cancel_trx")}
                    className="mt-0.5 accent-rose-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-400">❌ Batal Trx / Invalid Trx (Void & Refund)</div>
                    <div className="mt-0.5 text-[11px] text-[var(--insight-muted)]">
                      Stok kembali <b>available</b> + Transaksi terkait otomatis dibatalkan (<b>cancelled</b>). <b>GMV & Profit di laporan berkurang</b>.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Mode Tabs */}
            <div className="flex border-b-2 border-[var(--insight-border)]">
              <button
                type="button"
                onClick={() => setRestoreModalTab("list")}
                className={`px-4 py-2 text-xs font-bold uppercase transition ${
                  restoreModalTab === "list"
                    ? "border-b-2 border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
                }`}
              >
                📋 Pilih dari Daftar ({restoreProductStats.nonAvailable})
              </button>
              <button
                type="button"
                onClick={() => setRestoreModalTab("paste")}
                className={`px-4 py-2 text-xs font-bold uppercase transition ${
                  restoreModalTab === "paste"
                    ? "border-b-2 border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
                }`}
              >
                📝 Paste List Email Garansi
              </button>
              <button
                type="button"
                onClick={() => setRestoreModalTab("status")}
                className={`px-4 py-2 text-xs font-bold uppercase transition ${
                  restoreModalTab === "status"
                    ? "border-b-2 border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
                }`}
              >
                ⚡ Restore Cepat per Status
              </button>
            </div>

            {/* TAB 1: LIST SELECTION */}
            {restoreModalTab === "list" && (
              <div className="flex flex-1 flex-col space-y-3 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className={`${controlClass} w-[200px]`}
                    placeholder="Cari email/profile..."
                    value={restoreSearch}
                    onChange={(e) => setRestoreSearch(e.target.value)}
                  />

                  <select
                    value={restoreStatusFilter}
                    onChange={(e) => setRestoreStatusFilter(e.target.value)}
                    className={`${controlClass} min-w-[150px] font-semibold`}
                  >
                    <option value="all">Semua Non-Available ({restoreProductStats.nonAvailable})</option>
                    <option value="sold">Status: sold ({restoreProductStats.sold})</option>
                    <option value="inactive">Status: inactive ({restoreProductStats.inactive})</option>
                    <option value="reserved">Status: reserved ({restoreProductStats.reserved})</option>
                    <option value="deleted">Status: deleted ({restoreProductStats.deleted})</option>
                  </select>

                  <div className="ml-auto text-xs text-[var(--insight-muted)]">
                    Dipilih:{" "}
                    <b className="text-emerald-600 dark:text-emerald-400">
                      {restoreModalSelectedIds.length}
                    </b>{" "}
                    dari {filteredRestoreModalStocks.length}
                  </div>
                </div>

                <div className="max-h-[280px] flex-1 overflow-y-auto border-2 border-[var(--insight-border)] bg-[var(--insight-panel)]">
                  {restoreLoading ? (
                    <div className="p-8 text-center text-sm text-[var(--insight-muted)]">Memuat daftar akun...</div>
                  ) : filteredRestoreModalStocks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-[var(--insight-muted)]">
                      {restoreProductStocks.length === 0
                        ? "Pilih produk terlebih dahulu."
                        : "Tidak ada akun non-available pada filter ini (semua akun sudah berstatus available)."}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-[var(--insight-panel)] shadow-sm">
                        <tr className="border-b-2 border-[var(--insight-border)]">
                          <th className="p-2.5">
                            <input
                              type="checkbox"
                              checked={allRestoreModalVisibleSelected}
                              onChange={toggleSelectAllRestoreModal}
                              className="h-4 w-4 accent-emerald-600"
                            />
                          </th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Profile</th>
                          <th className="p-2.5">PIN</th>
                          <th className="p-2.5">Status Saat Ini</th>
                          <th className="p-2.5">Aksi Cepat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRestoreModalStocks.map((stock) => (
                          <tr
                            key={stock.id}
                            className="border-b border-[var(--insight-border)]/40 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
                          >
                            <td className="p-2.5">
                              <input
                                type="checkbox"
                                checked={restoreModalSelectedIds.includes(stock.id)}
                                onChange={() => {
                                  setRestoreModalSelectedIds((prev) =>
                                    prev.includes(stock.id) ? prev.filter((id) => id !== stock.id) : [...prev, stock.id]
                                  );
                                }}
                                className="h-4 w-4 accent-emerald-600"
                              />
                            </td>
                            <td className="p-2.5 font-mono font-medium">{stock.email}</td>
                            <td className="p-2.5">{stock.profile || "—"}</td>
                            <td className="p-2.5 font-mono">{stock.pin || "—"}</td>
                            <td className="p-2.5">
                              <span
                                className={`inline-block border-2 border-[var(--insight-border)] px-2 py-0.5 text-[11px] font-bold leading-none ${statusClass(
                                  stock.status
                                )}`}
                              >
                                {stock.status}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <button
                                type="button"
                                onClick={() => void restoreStock(stock, restoreReasonMode)}
                                disabled={restoreSubmitting || isViewer}
                                className="border-2 border-[var(--insight-border)] bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white shadow-[1px_1px_0_var(--insight-shadow)] hover:-translate-y-0.5"
                              >
                                ♻️ Restore
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-[var(--insight-muted)]">
                    Produk terpilih: <b>{restoreModalSelectedProduct?.name || "-"}</b> (
                    {restoreModalSelectedProduct?.product_code || "-"})
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRestoreModal(false)}
                      className="insight-button px-4 py-2 text-xs font-semibold"
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      onClick={() => void executeModalSelectedRestore()}
                      disabled={
                        isViewer ||
                        restoreSubmitting ||
                        restoreModalSelectedIds.length === 0
                      }
                      className="border-2 border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      {restoreSubmitting
                        ? "Memproses..."
                        : `♻️ Restore ${restoreModalSelectedIds.length} Akun Terpilih`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PASTE EMAILS */}
            {restoreModalTab === "paste" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--insight-muted)]">
                    Paste Daftar Email Akun Garansi
                  </label>
                  <p className="text-xs text-[var(--insight-muted)]">
                    Masukkan email akun yang ingin direstore (bisa 1 per baris, atau dipisah koma/titik koma/spasi). Sistem akan mencari akun dengan email tersebut di produk <b>{restoreModalSelectedProduct?.name}</b> dan mengubah statusnya menjadi available.
                  </p>
                  <textarea
                    rows={6}
                    placeholder="contoh:
garansi1@gmail.com
garansi2@gmail.com
garansi3@gmail.com"
                    value={restorePasteText}
                    onChange={(e) => setRestorePasteText(e.target.value)}
                    className="w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-2.5 font-mono text-xs text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(false)}
                    className="insight-button px-4 py-2 text-xs font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => void executeModalPasteRestore()}
                    disabled={isViewer || restoreSubmitting || !restorePasteText.trim()}
                    className="border-2 border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:opacity-40"
                  >
                    {restoreSubmitting ? "Memproses..." : "🔍 Cocokkan & Restore ke Available"}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: RESTORE BY STATUS CARDS */}
            {restoreModalTab === "status" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--insight-muted)]">
                  Restore seluruh akun pada status tertentu untuk produk <b>{restoreModalSelectedProduct?.name}</b> ({restoreModalSelectedProduct?.product_code}) sekaligus:
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="insight-card flex flex-col justify-between p-3.5 shadow-[2px_2px_0_var(--insight-shadow)]">
                    <div>
                      <div className="text-xs font-bold uppercase text-red-600 dark:text-red-400">Sold Accounts</div>
                      <div className="mt-1 text-2xl font-bold">{restoreProductStats.sold}</div>
                      <p className="mt-1 text-[11px] text-[var(--insight-muted)]">
                        Akun yang saat ini berstatus sold
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void executeModalRestoreByStatus("sold")}
                      disabled={isViewer || restoreSubmitting || restoreProductStats.sold === 0}
                      className="mt-3 border-2 border-[var(--insight-border)] bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      Restore Semua Sold ({restoreProductStats.sold})
                    </button>
                  </div>

                  <div className="insight-card flex flex-col justify-between p-3.5 shadow-[2px_2px_0_var(--insight-shadow)]">
                    <div>
                      <div className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Inactive Accounts</div>
                      <div className="mt-1 text-2xl font-bold">{restoreProductStats.inactive}</div>
                      <p className="mt-1 text-[11px] text-[var(--insight-muted)]">
                        Akun yang saat ini berstatus inactive
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void executeModalRestoreByStatus("inactive")}
                      disabled={isViewer || restoreSubmitting || restoreProductStats.inactive === 0}
                      className="mt-3 border-2 border-[var(--insight-border)] bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      Restore Inactive ({restoreProductStats.inactive})
                    </button>
                  </div>

                  <div className="insight-card flex flex-col justify-between p-3.5 shadow-[2px_2px_0_var(--insight-shadow)]">
                    <div>
                      <div className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Deleted Accounts</div>
                      <div className="mt-1 text-2xl font-bold">{restoreProductStats.deleted}</div>
                      <p className="mt-1 text-[11px] text-[var(--insight-muted)]">
                        Akun yang saat ini berstatus deleted
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void executeModalRestoreByStatus("deleted")}
                      disabled={isViewer || restoreSubmitting || restoreProductStats.deleted === 0}
                      className="mt-3 border-2 border-[var(--insight-border)] bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      Restore Deleted ({restoreProductStats.deleted})
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(false)}
                    className="insight-button px-4 py-2 text-xs font-semibold"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL SINGLE RESTORE STOCK WITH MODE SELECTION */}
      {singleRestoreCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="insight-card w-full max-w-lg space-y-4 p-6 shadow-[8px_8px_0_var(--insight-shadow)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--insight-border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-block border-2 border-[var(--insight-border)] bg-emerald-100 px-2.5 py-1 text-xs font-bold leading-none text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  ♻️ RESTORE AKUN
                </span>
                <h2 className="text-lg font-bold text-[var(--insight-text)]">Pilih Jenis Restore Akun</h2>
              </div>
              <button
                onClick={() => setSingleRestoreCandidate(null)}
                className="text-lg font-bold text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-xs">
              <div>
                <b>Produk:</b> {getProductName(singleRestoreCandidate.products)}
              </div>
              <div>
                <b>Email:</b> {singleRestoreCandidate.email}
              </div>
              <div>
                <b>Status Saat Ini:</b>{" "}
                <span className="font-bold text-amber-700 dark:text-amber-400">{singleRestoreCandidate.status}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--insight-text)]">
                Pilih Alasan / Dampak Ke Laporan:
              </label>

              <label
                onClick={() => setSingleRestoreReasonMode("regular")}
                className={`flex cursor-pointer items-start gap-2.5 border-2 p-3 transition ${
                  singleRestoreReasonMode === "regular"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)] opacity-75 hover:opacity-100"
                }`}
              >
                <input
                  type="radio"
                  name="single_restore_mode"
                  value="regular"
                  checked={singleRestoreReasonMode === "regular"}
                  onChange={() => setSingleRestoreReasonMode("regular")}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <div className="text-xs font-bold">♻️ Restore Biasa (Habis Masa Pakai / Garansi Selesai)</div>
                  <div className="mt-0.5 text-[11px] text-[var(--insight-muted)]">
                    Akun kembali <b>available</b>. Transaksi lama tetap sah (<b>paid</b>), <b>GMV & Revenue TIDAK berkurang</b>.
                  </div>
                </div>
              </label>

              <label
                onClick={() => setSingleRestoreReasonMode("cancel_trx")}
                className={`flex cursor-pointer items-start gap-2.5 border-2 p-3 transition ${
                  singleRestoreReasonMode === "cancel_trx"
                    ? "border-rose-600 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200"
                    : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)] opacity-75 hover:opacity-100"
                }`}
              >
                <input
                  type="radio"
                  name="single_restore_mode"
                  value="cancel_trx"
                  checked={singleRestoreReasonMode === "cancel_trx"}
                  onChange={() => setSingleRestoreReasonMode("cancel_trx")}
                  className="mt-0.5 accent-rose-600"
                />
                <div>
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400">❌ Batal Trx / Invalid Trx (Void & Refund)</div>
                  <div className="mt-0.5 text-[11px] text-[var(--insight-muted)]">
                    Akun kembali <b>available</b> + Transaksi terkait otomatis dibatalkan (<b>cancelled</b>). <b>GMV & Profit di laporan berkurang</b>.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSingleRestoreCandidate(null)}
                disabled={singleRestoreSubmitting}
                className="insight-button px-4 py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void restoreStock(singleRestoreCandidate, singleRestoreReasonMode)}
                disabled={isViewer || singleRestoreSubmitting}
                title={isViewer ? viewerOnlyTitle : undefined}
                className="border-2 border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                {singleRestoreSubmitting ? "Memproses..." : "Ya, Restore Akun"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK RESTORE STOCK WITH MODE SELECTION */}
      {bulkRestoreOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="insight-card w-full max-w-lg space-y-4 p-6 shadow-[8px_8px_0_var(--insight-shadow)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--insight-border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-block border-2 border-[var(--insight-border)] bg-emerald-100 px-2.5 py-1 text-xs font-bold leading-none text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                  ♻️ BULK RESTORE
                </span>
                <h2 className="text-lg font-bold text-[var(--insight-text)]">Restore {selectedStockIds.length} Akun</h2>
              </div>
              <button
                onClick={() => setBulkRestoreOpen(false)}
                className="text-lg font-bold text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-xs">
              <div>
                <b>Total akun dipilih:</b> {selectedStockIds.length.toLocaleString("id-ID")} akun
              </div>
              <div className="text-[var(--insight-muted)]">
                Semua akun yang dipilih akan dikembalikan statusnya ke <b>available</b>.
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--insight-text)]">
                Pilih Alasan / Dampak Ke Laporan:
              </label>

              <label
                onClick={() => setBulkRestoreReasonMode("regular")}
                className={`flex cursor-pointer items-start gap-2.5 border-2 p-3 transition ${
                  bulkRestoreReasonMode === "regular"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-950 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)] opacity-75 hover:opacity-100"
                }`}
              >
                <input
                  type="radio"
                  name="bulk_restore_mode"
                  value="regular"
                  checked={bulkRestoreReasonMode === "regular"}
                  onChange={() => setBulkRestoreReasonMode("regular")}
                  className="mt-0.5 accent-emerald-600"
                />
                <div>
                  <div className="text-xs font-bold">♻️ Restore Biasa (Habis Masa Pakai / Garansi Selesai)</div>
                  <div className="mt-0.5 text-[11px] text-[var(--insight-muted)]">
                    Akun kembali <b>available</b>. Transaksi lama tetap sah (<b>paid</b>), <b>GMV & Revenue TIDAK berkurang</b>.
                  </div>
                </div>
              </label>

              <label
                onClick={() => setBulkRestoreReasonMode("cancel_trx")}
                className={`flex cursor-pointer items-start gap-2.5 border-2 p-3 transition ${
                  bulkRestoreReasonMode === "cancel_trx"
                    ? "border-rose-600 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-200"
                    : "border-[var(--insight-border)] bg-[var(--insight-card)] text-[var(--insight-text)] opacity-75 hover:opacity-100"
                }`}
              >
                <input
                  type="radio"
                  name="bulk_restore_mode"
                  value="cancel_trx"
                  checked={bulkRestoreReasonMode === "cancel_trx"}
                  onChange={() => setBulkRestoreReasonMode("cancel_trx")}
                  className="mt-0.5 accent-rose-600"
                />
                <div>
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-400">❌ Batal Trx / Invalid Trx (Void & Refund)</div>
                  <div className="mt-0.5 text-[11px] text-[var(--insight-muted)]">
                    Akun kembali <b>available</b> + Transaksi terkait otomatis dibatalkan (<b>cancelled</b>). <b>GMV & Profit di laporan berkurang</b>.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBulkRestoreOpen(false)}
                className="insight-button px-4 py-2 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void bulkRestoreStock(selectedStockIds, bulkRestoreReasonMode)}
                disabled={isViewer || selectedStockIds.length === 0}
                title={isViewer ? viewerOnlyTitle : undefined}
                className="border-2 border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                Ya, Restore {selectedStockIds.length} Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DELETE STOCK */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="insight-card w-full max-w-md space-y-4 p-6 shadow-[6px_6px_0_var(--insight-shadow)]">
            <span className="inline-block border-2 border-[var(--insight-border)] bg-red-100 px-2.5 py-1 text-xs font-bold leading-none text-red-800 dark:bg-red-950/70 dark:text-red-300">
              DELETE STOCK
            </span>
            <h2 className="text-xl font-bold text-[var(--insight-text)]">Verifikasi Hapus Stock</h2>
            <div className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-sm">
              <div>
                <b>Product:</b> {getProductName(deleteCandidate.products)}
              </div>
              <div>
                <b>Email:</b> {deleteCandidate.email}
              </div>
              <div>
                <b>Profile:</b> {deleteCandidate.profile || "-"}
              </div>
            </div>
            <p className="text-xs leading-tight text-[var(--insight-muted)]">
              Stock tidak dihapus permanen. Status akan dipindahkan ke <b>deleted</b> agar tetap bisa diaudit dan direstore.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDeleteCandidate(null)} className="insight-button px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void deleteStock(deleteCandidate.id)}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={
                  "border-2 border-[var(--insight-border)] bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)]" +
                  viewerDisabledClass
                }
              >
                Ya, Pindahkan ke Deleted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK DELETE STOCK */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="insight-card w-full max-w-md space-y-4 p-6 shadow-[6px_6px_0_var(--insight-shadow)]">
            <span className="inline-block border-2 border-[var(--insight-border)] bg-red-100 px-2.5 py-1 text-xs font-bold leading-none text-red-800 dark:bg-red-950/70 dark:text-red-300">
              BULK DELETE
            </span>
            <h2 className="text-xl font-bold text-[var(--insight-text)]">Verifikasi Bulk Delete</h2>
            <div className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-sm">
              <div>
                <b>Total dipilih:</b> {selectedStockIds.length.toLocaleString("id-ID")} stock
              </div>
              <div>
                <b>Mode:</b> pindahkan ke status deleted
              </div>
            </div>
            <p className="text-xs leading-tight text-[var(--insight-muted)]">
              Stock yang dipilih tidak dihapus permanen. Semua akan masuk ke <b>Deleted Stock</b> dan bisa direstore kapan saja.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setBulkDeleteOpen(false)} className="insight-button px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={() => void bulkDeleteStock()}
                disabled={isViewer || selectedStockIds.length === 0}
                title={isViewer ? viewerOnlyTitle : undefined}
                className="border-2 border-[var(--insight-border)] bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Ya, Delete {selectedStockIds.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI BROADCAST RESTOCK */}
      {broadcastCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="insight-card w-full max-w-lg space-y-4 p-6 shadow-[6px_6px_0_var(--insight-shadow)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--insight-border)] pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-block border-2 border-[var(--insight-border)] bg-amber-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                  📢 Auto Broadcast
                </span>
                <h2 className="text-lg font-bold text-[var(--insight-text)]">Konfirmasi Blasting Telegram</h2>
              </div>
              <button
                onClick={() => setBroadcastCandidate(null)}
                className="text-lg font-bold text-[var(--insight-muted)] hover:text-[var(--insight-text)]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--insight-text)]">
              Upload stok <b>{broadcastCandidate.product.name}</b> (+{broadcastCandidate.addedCount} akun) berhasil! Apakah Anda ingin mengirim notifikasi restock ke seluruh user Telegram aktif?
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--insight-muted)]">
                Preview Template Pesan (Bisa diedit jika perlu):
              </label>
              <textarea
                rows={8}
                className="w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-2.5 font-mono text-xs text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] outline-none"
                value={broadcastCandidate.templateText}
                onChange={(e) =>
                  setBroadcastCandidate({
                    ...broadcastCandidate,
                    templateText: e.target.value,
                  })
                }
              />
            </div>

            <div className="border-2 border-dashed border-[var(--insight-border)] bg-[var(--insight-bg)] p-3">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--insight-muted)]">
                Tombol Inline yang Disertakan:
              </span>
              <div className="flex gap-2">
                <div className="flex-1 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-1.5 text-center text-xs font-bold text-[var(--insight-text)] shadow-[1px_1px_0_var(--insight-shadow)]">
                  🛍️ Beli Sekarang
                </div>
                <div className="flex-1 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-1.5 text-center text-xs font-bold text-[var(--insight-text)] shadow-[1px_1px_0_var(--insight-shadow)]">
                  📋 List Produk
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBroadcastCandidate(null)}
                disabled={isBroadcasting}
                className="insight-button px-4 py-2 text-xs font-semibold"
              >
                ✕ Lewati
              </button>
              <button
                type="button"
                onClick={() => void sendRestockBroadcast()}
                disabled={isBroadcasting || isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className="border-2 border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {isBroadcasting ? "⏳ Mengirim..." : "🚀 Kirim Broadcast Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
