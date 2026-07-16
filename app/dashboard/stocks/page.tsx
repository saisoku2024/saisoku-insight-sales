"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
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

  if (lines.length < 2) return [];

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

  const headerLine = cleanLine(lines[0]);
  const headers = headerLine.split(";").map((h) => cleanCell(h).toLowerCase());

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowLine = cleanLine(lines[i]);
    const cols = rowLine.split(";").map(cleanCell);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    rows.push(obj);
  }

  return rows;
}

function getProductName(products: Stock["products"]) {
  if (!products) return "-";
  if (Array.isArray(products)) return products[0]?.name ?? "-";
  return products?.name ?? "-";
}

export default function StocksPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);

  const [search, setSearch] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  // Add stock form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState("");
  const [pin, setPin] = useState("");
  const [productId, setProductId] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editStockData, setEditStockData] = useState<Stock | null>(null);

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [notice, setNotice] = useState<ActionNoticeState>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [stats, setStats] = useState({ available: 0, sold: 0 });
  const showError = (message: string) => setNotice({ type: "error", message });
  const showSuccess = (message: string) => setNotice({ type: "success", message });
  const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Unknown error";

  async function fetchProducts() {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });
    setProducts(data || []);
  }

  const fetchStocks = useCallback(async () => {
    let query = supabase
      .from("product_accounts")
      .select(`*,products(name)`)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) query = query.ilike("email", `%${search}%`);
    if (filterProduct) query = query.eq("product_id", filterProduct);

    const { data } = await query;
    const list = (data || []) as Stock[];

    setStocks(list);

    const available = list.filter((x) => x.status === "available").length;
    const sold = list.filter((x) => x.status === "sold").length;
    setStats({ available, sold });
  }, [page, search, filterProduct]);

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
    if (!confirm("Delete stock?")) return;
    try {
      await adminWrite("/api/admin/stocks", {
        method: "DELETE",
        body: { id },
      });
    } catch (error) {
      showError(`Gagal delete stock: ${getErrorMessage(error)}`);
      return;
    }
    showSuccess("Stock berhasil dihapus.");
    void fetchStocks();
  }

  async function bulkUploadCsv() {
    setUploadError("");

    if (!filterProduct) return setUploadError("Pilih produk dulu sebelum upload CSV.");
    if (!csvFile) return setUploadError("Pilih file CSV dulu.");

    setUploading(true);
    setUploadProgress(0);

    try {
      const text = await csvFile.text();
      const rows = parseCsvSemicolon(text);
      if (!rows.length) throw new Error("CSV kosong / format salah.");

      const badIndex = rows.findIndex((r) => !(r.email || "").trim());
      if (badIndex !== -1) {
        throw new Error(`Baris ke-${badIndex + 2} kolom Email/NoHP kosong`);
      }

      const payload = rows.map((r) => ({
        product_id: filterProduct,
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
    products.find((p) => p.id === filterProduct)?.name || "All Products";

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
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-emerald-100 px-3 py-1 text-lg leading-none text-emerald-800">
          STOCK MANAGEMENT
        </span>
        <h1 className="mt-3 text-[34px] leading-none text-[var(--insight-text)]">
          Stock Management
        </h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Manage account inventory, stock availability and bulk uploads
        </p>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      {/* KPI CARDS */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Total Stock (Page)</div>
          <div className="mt-2 text-[34px] leading-none text-[var(--insight-text)]">
            {(stats.available + stats.sold).toLocaleString("id-ID")}
          </div>
        </div>

        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Available</div>
          <div className="mt-2 text-[34px] leading-none text-emerald-600 dark:text-emerald-300">
            {stats.available.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Sold</div>
          <div className="mt-2 text-[34px] leading-none text-red-600 dark:text-red-300">
            {stats.sold.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Selected Product</div>
          <div className="mt-2 truncate text-[28px] leading-none text-blue-600 dark:text-blue-300">
            {activeProductName}
          </div>
        </div>
      </div>

      {/* FILTER AREA */}
      <div className="insight-card flex flex-wrap items-center gap-4 p-4">
        <input
          className="h-11 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
          placeholder="Search email..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />

        <select
          className="h-11 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
          value={filterProduct}
          onChange={(e) => {
            setPage(1);
            setFilterProduct(e.target.value);
          }}
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowAddModal(true)}
          className="border-[3px] border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]"
        >
          + Add Stock
        </button>

        <label className="inline-flex h-11 cursor-pointer items-center border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-4 text-xl text-[var(--insight-text)] shadow-[4px_4px_0_var(--insight-shadow)]">
          Pilih CSV
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
          />
        </label>

        <button
          disabled={!filterProduct || !csvFile || uploading}
          onClick={() => void bulkUploadCsv()}
          className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 py-2 text-xl leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] disabled:opacity-40"
          title={!filterProduct ? "Pilih produk dulu" : ""}
        >
          {uploading ? `Uploading ${uploadProgress}%` : "Bulk Upload"}
        </button>

        <div className="xl:ml-auto text-lg text-[var(--insight-muted)]">
          Format CSV:{" "}
          <code className="border-[2px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-2 py-0.5 text-red-500">
            email;password;profile;pin
          </code>
        </div>

        {uploadError && (
          <div className="w-full text-lg font-medium text-red-600">{uploadError}</div>
        )}
      </div>

      {/* TABLE */}
      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-4">Product</th>
                <th className="p-4">Email</th>
                <th className="p-4">Profile</th>
                <th className="p-4">PIN</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>

            <tbody>
              {stocks.map((s) => (
                <tr
                  key={s.id}
                  className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60"
                >
                  <td className="p-4 font-medium">{getProductName(s.products)}</td>
                  <td className="p-4 font-mono text-base">{s.email}</td>
                  <td className="p-4">{s.profile || "—"}</td>
                  <td className="p-4 font-mono text-base">{s.pin || "—"}</td>
                  <td className="p-4">
                    <span
                      className={`inline-block border-[3px] border-[var(--insight-border)] px-3 py-1 text-lg leading-none ${
                        s.status === "available"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditStockData(s)}
                        className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-blue)] px-3 py-1 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void deleteStock(s.id)}
                        className="border-[3px] border-[var(--insight-border)] bg-red-600 px-3 py-1 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {stocks.length === 0 && (
                <tr>
                  <td
                    className="p-8 text-center text-xl text-[var(--insight-muted)]"
                    colSpan={6}
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
                className="border-[3px] border-[var(--insight-border)] bg-emerald-600 px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]"
              >
                Save Stock
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
                className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]"
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
