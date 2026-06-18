"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type StockRow = any;
type ProductRow = any;

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
  const headers = headerLine
    .split(";")
    .map((h) => cleanCell(h).toLowerCase());

  const rows: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowLine = cleanLine(lines[i]);
    const cols = rowLine.split(";").map(cleanCell);

    const obj: any = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));
    rows.push(obj);
  }

  return rows;
}

function getProductName(products: any) {
  if (!products) return "-";
  if (Array.isArray(products)) return products?.[0]?.name ?? "-";
  return products?.name ?? "-";
}

export default function StocksPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);

  const [search, setSearch] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  // Add stock form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState("");
  const [pin, setPin] = useState("");
  const [productId, setProductId] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editStockData, setEditStockData] = useState<any>(null);

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [stats, setStats] = useState({ available: 0, sold: 0 });

  useEffect(() => {
    fetchProducts();
    fetchStocks();

    const channel = supabase
      .channel("stock-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_accounts" },
        () => fetchStocks()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [page, search, filterProduct]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("name", { ascending: true });

    setProducts(data || []);
  };

  const fetchStocks = async () => {
    let query = supabase
      .from("product_accounts")
      .select(`*,products(name)`)
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) query = query.ilike("email", `%${search}%`);
    if (filterProduct) query = query.eq("product_id", filterProduct);

    const { data } = await query;
    const list = data || [];

    setStocks(list);

    const available = list.filter((x: any) => x.status === "available").length;
    const sold = list.filter((x: any) => x.status === "sold").length;
    setStats({ available, sold });
  };

  const addStock = async () => {
    if (!productId) return alert("Pilih produk dulu.");
    if (!email.trim()) return alert("Email wajib diisi.");

    const { error } = await supabase.from("product_accounts").insert({
      product_id: productId,
      email: email.trim(),
      password: password?.trim() || null,
      profile: profile?.trim() || null,
      pin: pin?.trim() || null,
      status: "available",
    });

    if (error) return alert("Gagal add stock: " + error.message);

    setEmail("");
    setPassword("");
    setProfile("");
    setPin("");
    setProductId("");
    setShowAddModal(false);

    fetchStocks();
  };

  const updateStock = async () => {
    await supabase
      .from("product_accounts")
      .update({
        email: editStockData.email,
        password: editStockData.password,
        profile: editStockData.profile,
        pin: editStockData.pin,
      })
      .eq("id", editStockData.id);

    setEditStockData(null);
    fetchStocks();
  };

  const deleteStock = async (id: any) => {
    if (!confirm("Delete stock?")) return;
    await supabase.from("product_accounts").delete().eq("id", id);
    fetchStocks();
  };

  const bulkUploadCsv = async () => {
    setUploadError("");

    if (!filterProduct) return setUploadError("Pilih produk dulu sebelum upload CSV.");
    if (!csvFile) return setUploadError("Pilih file CSV dulu.");

    setUploading(true);
    setUploadProgress(0);

    try {
      const text = await csvFile.text();
      const rows = parseCsvSemicolon(text);
      if (!rows.length) throw new Error("CSV kosong / format salah.");

      const badIndex = rows.findIndex((r: any) => !(r.email || "").trim());
      if (badIndex !== -1) {
        throw new Error(`Baris ke-${badIndex + 2} kolom Email/NoHP kosong`);
      }

      const payload = rows.map((r: any) => ({
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
        const { error } = await supabase.from("product_accounts").insert(batch);
        if (error) throw error;
        setUploadProgress(Math.round(((i + batch.length) / payload.length) * 100));
      }

      setCsvFile(null);
      setUploading(false);
      setUploadProgress(100);

      fetchStocks();
      alert("✅ Bulk upload sukses");
    } catch (e: any) {
      setUploadError(e?.message || "Upload gagal");
      setUploading(false);
    }
  };

  const nextPage = () => {
    if (stocks.length === pageSize) setPage(page + 1);
  };
  const prevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const activeProductName = products.find((p: any) => p.id === filterProduct)?.name || "All Products";

  return (
    <div className="space-y-8 text-slate-900 dark:text-white transition-colors duration-300">
      {/* 1. HEADER UPGRADE */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Stock Management
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage account inventory, stock availability and bulk uploads
          </p>
        </div>
      </div>

      {/* 2. KPI CARD PREMIUM */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="group flex min-h-[120px] flex-col justify-center rounded-[28px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.10)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Stock (Page)</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {(stats.available + stats.sold).toLocaleString("id-ID")}
          </div>
        </div>

        <div className="group flex min-h-[120px] flex-col justify-center rounded-[28px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.10)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Available</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
            {stats.available.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="group flex min-h-[120px] flex-col justify-center rounded-[28px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.10)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Sold</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-red-600 dark:text-red-400">
            {stats.sold.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="group flex min-h-[120px] flex-col justify-center rounded-[28px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(15,23,42,0.10)]">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selected Product</div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-blue-600 dark:text-blue-400 truncate">
            {activeProductName}
          </div>
        </div>
      </div>

      {/* 3. FILTER AREA PREMIUM */}
      <div className="rounded-[32px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 p-6 backdrop-blur-xl flex flex-wrap gap-4 items-center shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <input
          className="h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-900 dark:focus:border-slate-500"
          placeholder="Search email..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />

        <select
          className="h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
          value={filterProduct}
          onChange={(e) => {
            setPage(1);
            setFilterProduct(e.target.value);
          }}
        >
          <option value="">All Products</option>
          {products.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowAddModal(true)}
          className="h-11 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-medium px-5 text-sm transition shadow-md shadow-green-500/10"
        >
          + Add Stock
        </button>

        <label className="h-11 inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
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
          onClick={bulkUploadCsv}
          className="h-11 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700 text-white font-medium px-5 text-sm transition shadow-md shadow-blue-500/10"
          title={!filterProduct ? "Pilih produk dulu" : ""}
        >
          {uploading ? `Uploading ${uploadProgress}%` : "Bulk Upload"}
        </button>

        <div className="text-xs text-slate-400 dark:text-slate-500 xl:ml-auto">
          Format CSV: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-red-500 font-mono">email;password;profile;pin</code>
        </div>

        {uploadError && (
          <div className="w-full text-red-600 dark:text-red-400 text-sm font-medium mt-1">{uploadError}</div>
        )}
      </div>

      {/* 4. TABLE UPGRADE BESAR */}
      <div className="overflow-hidden rounded-[32px] border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th className="p-4 pl-6">Product</th>
                <th className="p-4">Email</th>
                <th className="p-4">Profile</th>
                <th className="p-4">PIN</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-200 text-sm">
              {stocks.map((s: any) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">{getProductName(s.products)}</td>
                  <td className="p-4 font-mono text-xs">{s.email}</td>
                  <td className="p-4">{s.profile || "—"}</td>
                  <td className="p-4 font-mono text-xs">{s.pin || "—"}</td>
                  <td className="p-4">
                    {/* 5. STATUS BADGE */}
                    <span
                      className={
                        s.status === "available"
                          ? "inline-flex rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                          : "inline-flex rounded-full bg-red-100 dark:bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700 dark:text-red-400"
                      }
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4 pr-6">
                    <div className="flex gap-2">
                      {/* 6. ACTION BUTTONS */}
                      <button
                        onClick={() => setEditStockData(s)}
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-2 text-xs font-medium text-white transition shadow-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteStock(s.id)}
                        className="rounded-xl bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-medium text-white transition shadow-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {stocks.length === 0 && (
                <tr>
                  <td className="p-8 text-sm text-center text-slate-400 dark:text-slate-500" colSpan={6}>
                    Tidak ada data persediaan akun saat ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION AREA */}
      <div className="flex gap-3 items-center">
        <button 
          onClick={prevPage} 
          disabled={page === 1}
          className="h-10 px-4 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 transition hover:bg-slate-50"
        >
          Prev
        </button>
        <div className="text-sm font-medium px-2">Page {page}</div>
        <button 
          onClick={nextPage} 
          disabled={stocks.length < pageSize}
          className="h-10 px-4 text-sm font-medium rounded-xl bg-slate-950 dark:bg-white text-white dark:text-slate-950 disabled:opacity-50 transition hover:bg-slate-800 dark:hover:bg-slate-100"
        >
          Next
        </button>
      </div>

      {/* 8. MODAL ADD STOCK PREMIUM */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl w-full max-w-md space-y-4 border border-slate-100 dark:border-white/5">
            <h2 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Add Stock</h2>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Product</label>
              <select
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Pilih produk</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email / No HP</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@saisoku.id"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password akun"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profile No</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                placeholder="Contoh: Profile 3"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">PIN</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="123456"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="h-11 px-5 text-sm font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={addStock}
                className="h-11 px-5 text-sm font-semibold rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 transition"
              >
                Save Stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDIT STOCK PREMIUM */}
      {editStockData && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl w-full max-w-md space-y-4 border border-slate-100 dark:border-white/5">
            <h2 className="font-bold text-xl text-slate-900 dark:text-white tracking-tight">Edit Stock</h2>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email / No HP</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={editStockData.email}
                onChange={(e) =>
                  setEditStockData({ ...editStockData, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={editStockData.password}
                onChange={(e) =>
                  setEditStockData({
                    ...editStockData,
                    password: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Profile No</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={editStockData.profile}
                onChange={(e) =>
                  setEditStockData({
                    ...editStockData,
                    profile: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">PIN</label>
              <input
                className="w-full h-11 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm text-slate-900 dark:text-white outline-none"
                value={editStockData.pin}
                onChange={(e) =>
                  setEditStockData({ ...editStockData, pin: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setEditStockData(null)}
                className="h-11 px-5 text-sm font-semibold rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={updateStock}
                className="h-11 px-5 text-sm font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition"
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