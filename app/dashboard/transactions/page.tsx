"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useIsViewer } from "@/components/dashboard/panel-access-context";
import type { Transaction } from "@/types";

type ProductAccount = {
  email: string | null;
  password: string | null;
  pin: string | null;
  profile?: string | null;
  sold_at: string | null;
};

export default function TransactionsPage() {
  const isViewer = useIsViewer();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  const [filterBy, setFilterBy] = useState("invoice");
  const [searchText, setSearchText] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  const limit = 10;

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
        products(name, modal),
        users(username),
        product_accounts(email,password,pin,profile,sold_at),
        sold_accounts(account_snapshot)
      `)
      .order("created_at", { ascending: false });

    if (withPagination) {
      query = query.range((page - 1) * limit, page * limit);
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

  const loadTransactions = useCallback(async () => {
    setLoading(true);

    const { data, error } = await buildTransactionQuery(true);

    if (error) {
      console.error("loadTransactions error:", error);
      setTransactions([]);
      setLoading(false);
      return;
    }

    const rows = ((data as unknown as Transaction[]) || []);
    setTransactions(rows.slice(0, limit));
    setHasMore(rows.length > limit);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterBy, searchText, productFilter, dateFrom, dateTo]);

  function getProductAccount(t: Transaction): ProductAccount | null {
    if (!t.product_accounts) return null;
    return Array.isArray(t.product_accounts)
      ? (t.product_accounts[0] ?? null)
      : t.product_accounts;
  }

  function getSnapshotAccount(t: Transaction): ProductAccount | null {
    const soldAccount = Array.isArray(t.sold_accounts)
      ? (t.sold_accounts[0] ?? null)
      : t.sold_accounts;
    const snapshot = soldAccount?.account_snapshot;
    if (!snapshot) return null;

    return {
      email: snapshot.email ?? null,
      password: snapshot.password ?? null,
      pin: snapshot.pin ?? null,
      profile: snapshot.profile ?? null,
      sold_at: snapshot.sold_at ?? null,
    };
  }

  function getTransactionAccount(t: Transaction): ProductAccount | null {
    return getSnapshotAccount(t) ?? getProductAccount(t);
  }

  function getStatus(t: Transaction) {
    const pa = getTransactionAccount(t);
    const soldAt = pa?.sold_at;
    const baseDate = soldAt || t.purchased_at || t.created_at;

    if (!baseDate) return "unknown";

    const start = new Date(baseDate);
    const now = new Date();

    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.floor(
      (nowDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays <= 27) return "active";
    if (diffDays <= 30) return "expiring";
    return "expired";
  }

  function getStatusBadgeClass(status: string) {
    if (status === "active") return "bg-green-100 text-green-700";
    if (status === "expiring") return "bg-yellow-100 text-yellow-700";
    if (status === "expired") return "bg-red-100 text-red-700";
    return "bg-gray-100 text-gray-700";
  }

  function csvValue(value: unknown) {
    const normalized = String(value ?? "").replace(/\r?\n/g, " ");
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
    if (!rows.length) return;

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.map(csvValue).join(","),
      ...rows.map((row) => headers.map((header) => csvValue(row[header])).join(",")),
    ].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportCsv() {
    if (isViewer) return;
    const { data, error } = await buildTransactionQuery(false);

    if (error) {
      console.error("exportCsv error:", error);
      return;
    }

    const rows = (data as unknown as Transaction[])?.map((t: Transaction) => {
      const pa = getTransactionAccount(t);
      const modal = Number(t.products?.modal || 0);
      const profit = t.status === "paid" ? (t.price || 0) - modal : 0;
      return {
        Invoice: t.invoice || "-",
        TrxCode: t.trx_code || "-",
        Product: t.products?.name || "-",
        Email: pa?.email || "-",
        Password: pa?.password || "-",
        PIN: pa?.pin || "-",
        Price: t.price || 0,
        Profit: profit,
        Username: t.users?.username ? `@${t.users.username}` : "-",
        PaymentMethod: t.payment_method || "-",
        PaymentStatus: t.status || "-",
        AccountStatus: getStatus(t),
        PurchasedAt: t.purchased_at ? new Date(t.purchased_at).toLocaleString("id-ID") : "-",
        CreatedAt: t.created_at ? new Date(t.created_at).toLocaleString("id-ID") : "-",
      };
    }) || [];

    downloadCsv("transactions.csv", rows);
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  return (
    <div className="space-y-4 text-[var(--insight-text)]">
      {/* HEADER */}
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-cyan-100 px-2.5 py-0.5 text-xs font-bold leading-none text-cyan-800">
          TRANSACTIONS
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">Transactions</h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Filter, ekspor, dan audit seluruh transaksi
        </p>
      </div>

      {/* FILTER PANEL */}
      <div className="insight-card p-3">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value)}
            className="h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
          >
            <option value="invoice">Invoice</option>
            <option value="buyer">User ID</option>
            <option value="product">Product</option>
          </select>

          {filterBy === "product" ? (
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
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
              placeholder={filterBy === "invoice" ? "Search invoice..." : "Search user_id..."}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
            />
          )}

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
          />

          <button
            onClick={() => {
              setPage(1);
              void loadTransactions();
            }}
            className="h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-blue)] px-3.5 py-1.5 text-sm leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]"
          >
            Search
          </button>

          <button
            onClick={() => { if (isViewer) return; void exportCsv(); }}
            disabled={isViewer}
            title={isViewer ? "Viewer mode: read-only" : undefined}
            className="h-9 border-2 border-[var(--insight-border)] bg-emerald-600 px-3.5 py-1.5 text-sm leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm">No</th>
                <th className="px-4 py-3 text-sm">Invoice</th>
                <th className="px-4 py-3 text-sm">Produk</th>
                <th className="px-4 py-3 text-sm">Email</th>
                <th className="px-4 py-3 text-sm">Pass</th>
                <th className="px-4 py-3 text-sm">PIN</th>
                <th className="px-4 py-3 text-sm">Harga</th>
                <th className="px-4 py-3 text-sm">Profit</th>
                <th className="px-4 py-3 text-sm">User</th>
                <th className="px-4 py-3 text-sm">Payment</th>
                <th className="px-4 py-3 text-sm">Status Bayar</th>
                <th className="px-4 py-3 text-sm">Masa Aktif</th>
                <th className="px-4 py-3 text-sm">Tanggal</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Loading...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Tidak ada transaksi.
                  </td>
                </tr>
              ) : (
                transactions.map((t, i) => {
                  const pa = getTransactionAccount(t);
                  const status = getStatus(t);
                  const profit = t.status === "paid" ? (t.price || 0) - Number(t.products?.modal || 0) : 0;

                  return (
                    <tr
                      key={t.id}
                      className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60"
                    >
                      <td className="px-4 py-2.5 text-sm">{(page - 1) * limit + i + 1}</td>
                      <td className="px-4 py-2.5 text-sm">{t.invoice || "-"}</td>
                      <td className="px-4 py-2.5 text-sm">{t.products?.name || "-"}</td>
                      <td className="px-4 py-2.5 text-sm">
                         {isViewer
                           ? (pa?.email && pa.email.includes("@")
                             ? pa.email.split("@")[0].slice(0, 2) + "***@" + pa.email.split("@")[1]
                             : "***")
                           : (pa?.email || "-")}
                       </td>
                       <td className="px-4 py-2.5 text-sm">{isViewer ? "***" : (pa?.password || "-")}</td>
                       <td className="px-4 py-2.5 text-sm">{isViewer ? "***" : (pa?.pin || "-")}</td>
                       <td className="px-4 py-2.5 text-sm">Rp {Number(t.price || 0).toLocaleString("id-ID")}</td>
                       <td className="px-4 py-2.5 text-sm text-green-600 dark:text-green-400">
                         {t.status === "paid" ? (isViewer ? "***" : `Rp ${profit.toLocaleString("id-ID")}`) : "-"}
                       </td>
                      <td className="px-4 py-2.5 text-sm">{t.users?.username ? `@${t.users.username}` : "-"}</td>
                      <td className="px-4 py-2.5 text-sm">{t.payment_method || "-"}</td>
                      <td className="px-4 py-2.5 text-sm">
                        <span
                          className={`inline-block border-2 border-[var(--insight-border)] px-2.5 py-0.5 text-xs font-bold leading-none ${
                            t.status === "paid"
                              ? "bg-green-100 text-green-700"
                              : t.status === "pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {t.status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        <span
                          className={`inline-block border-2 border-[var(--insight-border)] px-2.5 py-0.5 text-xs font-bold leading-none ${getStatusBadgeClass(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        {t.created_at ? new Date(t.created_at).toLocaleString("id-ID") : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className="insight-button px-3.5 py-1.5 text-sm leading-none disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm">Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={!hasMore}
          className="insight-button px-3.5 py-1.5 text-sm leading-none disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
