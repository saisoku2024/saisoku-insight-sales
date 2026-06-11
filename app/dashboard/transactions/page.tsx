"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import * as XLSX from "xlsx";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [filterBy, setFilterBy] = useState("invoice");
  const [searchText, setSearchText] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const limit = 50;

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("loadProducts error:", error);
      return;
    }

    setProducts(data || []);
  }

  function buildTransactionQuery(withPagination = true) {
    let query = supabase
      .from("transactions")
      .select(`
        id,
        trx_code,
        user_id,
        product_id,
        price,
        payment_method,
        status,
        account_id,
        purchased_at,
        approved_at,
        expired_at,
        created_at,
        invoice,
        products(name),
        product_accounts(email,password,pin,sold_at)
      `)
      .order("created_at", { ascending: false });

    if (withPagination) {
      query = query.range((page - 1) * limit, page * limit - 1);
    }

    if (filterBy === "product" && productFilter) {
      query = query.eq("product_id", productFilter);
    }

    if (filterBy === "invoice" && searchText.trim()) {
      query = query.ilike("invoice", `%${searchText.trim()}%`);
    }

    if (filterBy === "buyer" && searchText.trim()) {
      query = query.ilike("user_id", `%${searchText.trim()}%`);
    }

    if (dateFrom) {
      query = query.gte("created_at", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
      query = query.lte("created_at", `${dateTo}T23:59:59`);
    }

    return query;
  }

  async function loadTransactions() {
    setLoading(true);

    const { data, error } = await buildTransactionQuery(true);

    if (error) {
      console.error("loadTransactions error:", error);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setTransactions(data || []);
    setLoading(false);
  }

  function getStatus(t: any) {
    const soldAt = Array.isArray(t.product_accounts)
      ? t.product_accounts?.[0]?.sold_at
      : t.product_accounts?.sold_at;

    const baseDate = soldAt || t.purchased_at || t.created_at;

    if (!baseDate) return "unknown";

    const start = new Date(baseDate);
    const now = new Date();

    const startDateOnly = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

    const nowDateOnly = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const diffDays = Math.floor(
      (nowDateOnly.getTime() - startDateOnly.getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 27) return "active";
    if (diffDays <= 30) return "expiring";
    return "expired";
  }

  function getStatusBadgeClass(status: string) {
    if (status === "active") {
      return "bg-green-100 text-green-700";
    }

    if (status === "expiring") {
      return "bg-yellow-100 text-yellow-700";
    }

    if (status === "expired") {
      return "bg-red-100 text-red-700";
    }

    return "bg-gray-100 text-gray-700";
  }

  async function exportExcel() {
    const { data, error } = await buildTransactionQuery(false);

    if (error) {
      console.error("exportExcel error:", error);
      return;
    }

    const rows =
      data?.map((t: any) => {
        const pa = Array.isArray(t.product_accounts)
          ? t.product_accounts?.[0]
          : t.product_accounts;

        return {
          Invoice: t.invoice || "-",
          TrxCode: t.trx_code || "-",
          Product: t.products?.name || "-",
          Email: pa?.email || "-",
          Password: pa?.password || "-",
          PIN: pa?.pin || "-",
          Price: t.price || 0,
          UserID: t.user_id || "-",
          PaymentMethod: t.payment_method || "-",
          Status: getStatus(t),
          PurchasedAt: t.purchased_at
            ? new Date(t.purchased_at).toLocaleString()
            : "-",
          CreatedAt: t.created_at
            ? new Date(t.created_at).toLocaleString()
            : "-",
        };
      }) || [];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, "transactions.xlsx");
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [page]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Transactions</h1>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="border rounded p-2"
          >
            <option value="invoice">Invoice</option>
            <option value="buyer">User ID</option>
            <option value="product">Product</option>
          </select>

          {filterBy === "product" ? (
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="border rounded p-2"
            >
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              placeholder={
                filterBy === "invoice"
                  ? "Search invoice..."
                  : "Search user_id..."
              }
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="border rounded p-2"
            />
          )}

          <button
            onClick={() => {
              setPage(1);
              loadTransactions();
            }}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <div className="grid grid-cols-3 gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded p-2"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded p-2"
          />

          <button
            onClick={exportExcel}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Export Excel
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            <tr>
              <th className="p-3">No</th>
              <th className="p-3">Invoice</th>
              <th className="p-3">Produk</th>
              <th className="p-3">Email</th>
              <th className="p-3">Pass</th>
              <th className="p-3">PIN</th>
              <th className="p-3">Harga</th>
              <th className="p-3">User ID</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Tanggal</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="p-4 text-center">
                  Loading...
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-4 text-center">
                  Tidak ada transaksi.
                </td>
              </tr>
            ) : (
              transactions.map((t, i) => {
                const pa = Array.isArray(t.product_accounts)
                  ? t.product_accounts?.[0]
                  : t.product_accounts;

                const status = getStatus(t);

                return (
                  <tr key={t.id} className="border-b">
                    <td className="p-3">{(page - 1) * limit + i + 1}</td>
                    <td className="p-3">{t.invoice || "-"}</td>
                    <td className="p-3">{t.products?.name || "-"}</td>
                    <td className="p-3">{pa?.email || "-"}</td>
                    <td className="p-3">{pa?.password || "-"}</td>
                    <td className="p-3">{pa?.pin || "-"}</td>
                    <td className="p-3">
                      Rp {Number(t.price || 0).toLocaleString("id-ID")}
                    </td>
                    <td className="p-3">{t.user_id}</td>
                    <td className="p-3">{t.payment_method || "-"}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="p-3">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className="border px-3 py-1 rounded disabled:opacity-50"
        >
          Prev
        </button>

        <span>Page {page}</span>

        <button
          onClick={() => setPage(page + 1)}
          className="border px-3 py-1 rounded"
        >
          Next
        </button>
      </div>
    </div>
  );
}