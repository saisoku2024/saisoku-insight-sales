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

  // Hapus kutip pembungkus di awal-akhir baris kalau ada: "...."
  const cleanLine = (line: string) => {
    if (line.startsWith('"') && line.endsWith('"')) {
      return line.slice(1, -1);
    }
    return line;
  };

  const cleanCell = (cell: string) => {
    const c = cell.trim();
    // hapus kutip pembungkus cell kalau ada
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

// ✅ Aman untuk join supabase: kadang products object, kadang array
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // ✅ email field = identifier (boleh email/noHP), wajib tidak kosong
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

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Stock Management</h1>

        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded shadow">
            Available : {stats.available}
          </div>
          <div className="bg-white px-4 py-2 rounded shadow">
            Sold : {stats.sold}
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow flex flex-wrap gap-3 items-center">
          <input
            className="border p-2 rounded"
            placeholder="Search email..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />

          <select
            className="border p-2 rounded"
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
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            + Add Stock
          </button>

          <label className="border px-4 py-2 rounded cursor-pointer">
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
            className="bg-purple-600 disabled:bg-purple-300 text-white px-4 py-2 rounded"
            title={!filterProduct ? "Pilih produk dulu" : ""}
          >
            {uploading ? `Uploading ${uploadProgress}%` : "Bulk Upload"}
          </button>

          <div className="text-sm text-gray-600">
            Format CSV: <b>email;password;profile;pin</b>
          </div>

          {uploadError && (
            <div className="w-full text-red-600 text-sm">{uploadError}</div>
          )}
        </div>

        <table className="w-full bg-white rounded shadow">
          <thead>
            <tr className="border-b bg-gray-50 text-sm">
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Profile</th>
              <th className="p-3 text-left">PIN</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {stocks.map((s: any) => (
              <tr key={s.id} className="border-b text-sm">
                <td className="p-3">{getProductName(s.products)}</td>
                <td className="p-3">{s.email}</td>
                <td className="p-3">{s.profile}</td>
                <td className="p-3">{s.pin}</td>
                <td className="p-3">{s.status}</td>

                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => setEditStockData(s)}
                    className="bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => deleteStock(s.id)}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {stocks.length === 0 && (
              <tr>
                <td className="p-4 text-sm text-gray-500" colSpan={6}>
                  Tidak ada data.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex gap-3 items-center">
          <button onClick={prevPage} className="bg-gray-300 px-4 py-2 rounded">
            Prev
          </button>
          <div>Page {page}</div>
          <button onClick={nextPage} className="bg-black text-white px-4 py-2 rounded">
            Next
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-6 rounded-xl w-[420px] shadow-xl space-y-4">
            <h2 className="font-semibold text-lg">Add Stock</h2>

            <div>
              <label className="text-sm font-medium">Product</label>
              <select
                className="border p-2 rounded w-full"
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

            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                className="border p-2 rounded w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                className="border p-2 rounded w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Profile</label>
              <input
                className="border p-2 rounded w-full"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">PIN</label>
              <input
                className="border p-2 rounded w-full"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={addStock}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {editStockData && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white p-6 rounded-xl w-[420px] shadow-xl space-y-4">
            <h2 className="font-semibold text-lg">Edit Stock</h2>

            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                className="border p-2 rounded w-full"
                value={editStockData.email}
                onChange={(e) =>
                  setEditStockData({ ...editStockData, email: e.target.value })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                className="border p-2 rounded w-full"
                value={editStockData.password}
                onChange={(e) =>
                  setEditStockData({
                    ...editStockData,
                    password: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">Profile</label>
              <input
                className="border p-2 rounded w-full"
                value={editStockData.profile}
                onChange={(e) =>
                  setEditStockData({
                    ...editStockData,
                    profile: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="text-sm font-medium">PIN</label>
              <input
                className="border p-2 rounded w-full"
                value={editStockData.pin}
                onChange={(e) =>
                  setEditStockData({ ...editStockData, pin: e.target.value })
                }
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditStockData(null)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={updateStock}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}