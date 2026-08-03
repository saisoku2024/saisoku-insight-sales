"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { ToolbarSelect } from "@/components/dashboard/toolbar-select";
import { SearchableFilter } from "@/components/dashboard/searchable-filter";
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context";
import { supabase } from "@/lib/supabase/client";
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

function productBrand(product: Pick<Product, "name" | "product_code">) {
  const raw = product.product_code || product.name || "OTHER";
  return raw.split(/[-_\s/]+/)[0]?.trim().toUpperCase() || "OTHER";
}

function statusClass(status: Stock["status"]) {
  if (status === "available") return "bg-emerald-100 text-emerald-700";
  if (status === "deleted") return "bg-slate-200 text-slate-700";
  if (status === "reserved") return "bg-amber-100 text-amber-800";
  if (status === "inactive") return "bg-zinc-100 text-zinc-700";
  return "bg-red-100 text-red-700";
}

export default function StocksPage() {
  const isViewer = useIsViewer();
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);

  const [search, setSearch] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterProductCode, setFilterProductCode] = useState("");
  const [stockView, setStockView] = useState<"active" | "deleted" | "all">("active");

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

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [notice, setNotice] = useState<ActionNoticeState>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [stats, setStats] = useState({ total: 0, available: 0, sold: 0, deleted: 0 });
  const showError = (message: string) => setNotice({ type: "error", message });
  const showSuccess = (message: string) => setNotice({ type: "success", message });
  const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Unknown error";
  const viewerDisabledClass = " disabled:cursor-not-allowed disabled:opacity-50";
  const controlClass = "box-border h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-0 text-sm leading-none text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] outline-none";
  const actionClass = "inline-flex box-border h-9 min-w-[110px] items-center justify-center border-2 border-[var(--insight-border)] px-4 py-0 text-sm leading-none shadow-[2px_2px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:hover:translate-y-0";

  async function fetchProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });
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
    let statsQuery = supabase
      .from("product_accounts")
      .select("status");

    if (search) statsQuery = statsQuery.ilike("email", `%${search}%`);
    if (targetProductIds !== null) statsQuery = statsQuery.in("product_id", targetProductIds);

    const { data: statsData } = await statsQuery;
    const allMatching = statsData || [];

    const available = allMatching.filter((x) => x.status === "available").length;
    const sold = allMatching.filter((x) => x.status === "sold").length;
    const deleted = allMatching.filter((x) => x.status === "deleted").length;
    const total = allMatching.length;
    setStats({ total, available, sold, deleted });

    // Query paginated stocks for active/deleted/all stockView
    let query = supabase
      .from("product_accounts")
      .select(`*,products(name,product_code)`)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) query = query.ilike("email", `%${search}%`);
    if (targetProductIds !== null) query = query.in("product_id", targetProductIds);
    if (stockView === "active") query = query.neq("status", "deleted");
    if (stockView === "deleted") query = query.eq("status", "deleted");

    const { data } = await query;
    const list = (data || []) as Stock[];

    setStocks(list);
    setSelectedStockIds((current) => current.filter((id) => list.some((stock) => stock.id === id)));
  }, [page, search, filterBrand, filterProductCode, products, stockView]);

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

    setEmail("");
    setPassword("");
    setProfile("");
    setPin("");
    setProductId("");
    setShowAddModal(false);
    showSuccess("Stock berhasil ditambahkan.");

    void fetchStocks();
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

  async function restoreStock(stock: Stock) {
    if (isViewer) return;
    try {
      await adminWrite<Stock>("/api/admin/stocks", {
        method: "PATCH",
        body: {
          id: stock.id,
          email: stock.email,
          password: stock.password,
          profile: stock.profile,
          pin: stock.pin,
          status: "available",
        },
      });
    } catch (error) {
      showError(`Gagal restore stock: ${getErrorMessage(error)}`);
      return;
    }

    showSuccess("Stock berhasil direstore ke available.");
    void fetchStocks();
  }

  async function bulkUploadCsv() {
    setUploadError("");

    const targetProd = products.find((p) =>
      filterProductCode ? p.product_code === filterProductCode : filterBrand ? p.name === filterBrand : false
    );
    const targetProductId = targetProd?.id || "";

    if (!targetProductId) return setUploadError("Pilih Product Code / Product Name yang spesifik dulu sebelum upload file.");
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
        product_id: targetProductId,
        email: (r.email || "").trim(),
        password: (r.password || "").trim() || null,
        profile: (r.profile || "").trim() || null,
        pin: (r.pin || "").trim() || null,
        status: "available",
      }));

      const batchSize = 200;
      for (let i = 0; i < payload.length; i += batchSize) {
        const batch = payload.slice(i, i + batchSize);
        await adminWrite<Stock[]>("/api/admin/stocks", {
          body: { items: batch },
        });
        setUploadProgress(Math.round(((i + batch.length) / payload.length) * 100));
      }

      setCsvFile(null);
      setUploading(false);
      setUploadProgress(100);
      void fetchStocks();
      showSuccess("Bulk upload sukses.");
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

  const activeProductName =
    filterBrand || "All Products";
  const brandFilterOptions = Array.from(
    new Set(products.map((p) => p.name).filter(Boolean))
  )
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
  const selectableStocks = stocks.filter((stock) => stock.status !== "deleted");
  const allVisibleSelected = selectableStocks.length > 0 && selectableStocks.every((stock) => selectedStockIds.includes(stock.id));

  function toggleSelectStock(id: string) {
    setSelectedStockIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function toggleSelectVisible() {
    if (allVisibleSelected) {
      setSelectedStockIds((current) => current.filter((id) => !selectableStocks.some((stock) => stock.id === id)));
      return;
    }

    setSelectedStockIds((current) => Array.from(new Set([...current, ...selectableStocks.map((stock) => stock.id)])));
  }

  useEffect(() => {
    void fetchProducts();
  }, []);

  useEffect(() => {
    void fetchStocks();

    const channel = supabase
      .channel("stock-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_accounts" },
        () => void fetchStocks()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchStocks]);

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      {/* HEADER */}
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-emerald-100 px-2.5 py-0.5 text-xs font-bold leading-none text-emerald-800">
          STOCK MANAGEMENT
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">
          Stock Management
        </h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Manage account inventory, stock availability and bulk uploads
        </p>
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
          <div className="text-sm leading-none text-[var(--insight-muted)]">Available</div>
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
              { value: "active", label: "Active Stock" },
              { value: "deleted", label: "Deleted Stock" },
              { value: "all", label: "All Stock" },
            ]}
            onChange={(nextView) => {
              setPage(1);
              setStockView(nextView as "active" | "deleted" | "all");
            }}
            minWidth={170}
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

          <button
            onClick={() => {
              if (isViewer || selectedStockIds.length === 0) return;
              setBulkDeleteOpen(true);
            }}
            disabled={isViewer || selectedStockIds.length === 0}
            title={isViewer ? viewerOnlyTitle : selectedStockIds.length === 0 ? "Pilih stock dulu" : undefined}
            className={`${actionClass} min-w-[130px] bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-40`}
          >
            Delete Bulk
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label
            className={`${actionClass} min-w-[130px] bg-[var(--insight-panel)] text-[var(--insight-text)] ${isViewer ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            title={isViewer ? viewerOnlyTitle : undefined}
          >
            Pilih CSV/TXT
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              disabled={isViewer}
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
            />
          </label>

          <button
            disabled={isViewer || (!filterBrand && !filterProductCode) || !csvFile || uploading}
            onClick={() => void bulkUploadCsv()}
            className={`${actionClass} min-w-[130px] bg-[var(--insight-blue)] text-white disabled:cursor-not-allowed disabled:opacity-40`}
            title={isViewer ? viewerOnlyTitle : !filterBrand && !filterProductCode ? "Pilih produk dulu" : ""}
          >
            {uploading ? `Uploading ${uploadProgress}%` : "Bulk Upload"}
          </button>

          <div className="flex h-11 items-center xl:ml-auto text-lg text-[var(--insight-muted)]">
            View: <span className="ml-1 text-[var(--insight-text)]">{filterBrand || "All Products"}</span>
            {filterProductCode ? <span> / {filterProductCode}</span> : null}
            {selectedStockIds.length > 0 ? <span> / Selected {selectedStockIds.length}</span> : null}
          </div>
        </div>

        <div className="text-lg text-[var(--insight-muted)]">
          Format CSV/TXT:{" "}
          <code className="border-[2px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-2 py-0.5 text-red-500">
            email;password;profile;pin
          </code>
        </div>

        {uploadError && (
          <div className="text-lg font-medium text-red-600">{uploadError}</div>
        )}
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
                    disabled={isViewer || selectableStocks.length === 0}
                    onChange={toggleSelectVisible}
                    className="h-5 w-5 accent-[var(--insight-blue)] disabled:opacity-40"
                    title={isViewer ? viewerOnlyTitle : "Select visible stock"}
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
                <tr
                  key={s.id}
                  className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60"
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedStockIds.includes(s.id)}
                      disabled={isViewer || s.status === "deleted"}
                      onChange={() => toggleSelectStock(s.id)}
                      className="h-5 w-5 accent-[var(--insight-blue)] disabled:opacity-40"
                      title={s.status === "deleted" ? "Deleted stock tidak bisa dipilih" : isViewer ? viewerOnlyTitle : "Select stock"}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-sm font-medium">
                    <div>{getProductName(s.products)}</div>
                    <div className="text-xs text-[var(--insight-muted)]">{getProductCode(s.products) || "-"}</div>
                  </td>
                  <td className="px-4 py-2.5 text-sm">{getProductCode(s.products)?.split(/[-_\s/]+/)[0]?.toUpperCase() || "-"}</td>
                  <td className="px-4 py-2.5 font-mono text-sm">
                    {isViewer
                      ? (s.email && s.email.includes("@")
                        ? s.email.split("@")[0].slice(0, 2) + "***@" + s.email.split("@")[1]
                        : "***")
                      : s.email}
                  </td>
                  <td className="px-4 py-2.5 text-sm">{isViewer ? "***" : (s.profile || "—")}</td>
                  <td className="px-4 py-2.5 font-mono text-sm">{isViewer ? "***" : (s.pin || "—")}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-block border-2 border-[var(--insight-border)] px-2 py-0.5 text-xs font-bold leading-none ${
                        statusClass(s.status)
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      {s.status === "deleted" ? (
                        <button
                          onClick={() => void restoreStock(s)}
                          disabled={isViewer}
                          title={isViewer ? viewerOnlyTitle : undefined}
                          className={"border-2 border-[var(--insight-border)] bg-emerald-600 px-2 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]" + viewerDisabledClass}
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              if (isViewer) return;
                              setEditStockData(s);
                            }}
                            disabled={isViewer}
                            title={isViewer ? viewerOnlyTitle : undefined}
                            className={"border-2 border-[var(--insight-border)] bg-[var(--insight-blue)] px-2 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]" + viewerDisabledClass}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (isViewer) return;
                              setDeleteCandidate(s);
                            }}
                            disabled={isViewer}
                            title={isViewer ? viewerOnlyTitle : undefined}
                            className={"border-2 border-[var(--insight-border)] bg-red-600 px-2 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]" + viewerDisabledClass}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {stocks.length === 0 && (
                <tr>
                  <td
                    className="p-8 text-center text-xl text-[var(--insight-muted)]"
                    colSpan={8}
                  >
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
          className="insight-button px-4 py-2 text-lg leading-none disabled:opacity-40"
        >
          Prev
        </button>
        <div className="px-2 text-lg">Page {page}</div>
        <button
          onClick={nextPage}
          disabled={stocks.length < pageSize}
          className="insight-button px-4 py-2 text-lg leading-none disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* MODAL ADD STOCK */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="insight-card w-full max-w-md space-y-4 p-6">
            <h2 className="text-[28px] leading-none text-[var(--insight-text)]">Add Stock</h2>

            {(
              [
                { label: "Product", isSelect: true },
                { label: "Email / No HP", state: email, setter: setEmail, placeholder: "admin@saisoku.id" },
                { label: "Password", state: password, setter: setPassword, placeholder: "Password akun" },
                { label: "Profile No", state: profile, setter: setProfile, placeholder: "Contoh: Profile 3" },
                { label: "PIN", state: pin, setter: setPin, placeholder: "123456" },
              ] as const
            ).map((field, i) =>
              i === 0 ? (
                <div key="product" className="space-y-1">
                  <label className="text-lg text-[var(--insight-muted)]">Product</label>
                  <select
                    className="h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    <option value="">Pilih produk</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null
            )}

            {[
              { label: "Email / No HP", state: email, setter: setEmail, placeholder: "admin@saisoku.id" },
              { label: "Password", state: password, setter: setPassword, placeholder: "Password akun" },
              { label: "Profile No", state: profile, setter: setProfile, placeholder: "Contoh: Profile 3" },
              { label: "PIN", state: pin, setter: setPin, placeholder: "123456" },
            ].map(({ label, state, setter, placeholder }) => (
              <div key={label} className="space-y-1">
                <label className="text-lg text-[var(--insight-muted)]">{label}</label>
                <input
                  className="h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
                  value={state}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                />
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="insight-button px-4 py-2 text-lg leading-none"
              >
                Cancel
              </button>
              <button
                onClick={() => void addStock()}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={"border-[3px] border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]" + viewerDisabledClass}
              >
                Save Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DELETE STOCK */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="insight-card w-full max-w-md space-y-4 p-6">
            <span className="inline-block border-[3px] border-[var(--insight-border)] bg-red-100 px-2.5 py-1 text-base leading-none text-red-800">
              DELETE STOCK
            </span>
            <h2 className="text-[28px] leading-none text-[var(--insight-text)]">Verifikasi Hapus Stock</h2>
            <div className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-lg">
              <div>Product: {getProductName(deleteCandidate.products)}</div>
              <div>Email: {deleteCandidate.email}</div>
              <div>Profile: {deleteCandidate.profile || "-"}</div>
            </div>
            <p className="text-lg leading-tight text-[var(--insight-muted)]">
              Stock tidak dihapus permanen. Status akan dipindahkan ke <b>deleted</b> agar tetap bisa diaudit dan direstore.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="insight-button px-4 py-2 text-lg leading-none"
              >
                Cancel
              </button>
              <button
                onClick={() => void deleteStock(deleteCandidate.id)}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={"border-[3px] border-[var(--insight-border)] bg-red-600 px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]" + viewerDisabledClass}
              >
                Ya, Pindahkan ke Deleted
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BULK DELETE STOCK */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="insight-card w-full max-w-md space-y-4 p-6">
            <span className="inline-block border-[3px] border-[var(--insight-border)] bg-red-100 px-2.5 py-1 text-base leading-none text-red-800">
              BULK DELETE
            </span>
            <h2 className="text-[28px] leading-none text-[var(--insight-text)]">Verifikasi Bulk Delete</h2>
            <div className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-lg">
              <div>Total dipilih: {selectedStockIds.length.toLocaleString("id-ID")} stock</div>
              <div>Mode: pindahkan ke status deleted</div>
            </div>
            <p className="text-lg leading-tight text-[var(--insight-muted)]">
              Stock yang dipilih tidak dihapus permanen. Semua akan masuk ke <b>Deleted Stock</b> dan bisa direstore satu per satu.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className="insight-button px-4 py-2 text-lg leading-none"
              >
                Cancel
              </button>
              <button
                onClick={() => void bulkDeleteStock()}
                disabled={isViewer || selectedStockIds.length === 0}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={"border-[3px] border-[var(--insight-border)] bg-red-600 px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] disabled:cursor-not-allowed disabled:opacity-40"}
              >
                Ya, Delete {selectedStockIds.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT STOCK */}
      {editStockData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="insight-card w-full max-w-md space-y-4 p-6">
            <h2 className="text-[28px] leading-none text-[var(--insight-text)]">Edit Stock</h2>

            {[
              { label: "Email / No HP", field: "email" as const },
              { label: "Password", field: "password" as const },
              { label: "Profile No", field: "profile" as const },
              { label: "PIN", field: "pin" as const },
            ].map(({ label, field }) => (
              <div key={field} className="space-y-1">
                <label className="text-lg text-[var(--insight-muted)]">{label}</label>
                <input
                  className="h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
                  value={editStockData[field] ?? ""}
                  onChange={(e) =>
                    setEditStockData({ ...editStockData, [field]: e.target.value })
                  }
                />
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditStockData(null)}
                className="insight-button px-4 py-2 text-lg leading-none"
              >
                Cancel
              </button>
              <button
                onClick={() => void updateStock()}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={"border-[3px] border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]" + viewerDisabledClass}
              >
                Update Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
