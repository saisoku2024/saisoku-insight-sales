"use client";

import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { supabase } from "@/lib/supabaseClient";
import type { SalesStats, RecentTransaction } from "@/types";

export default function SalesPage() {
  const pageSize = 10;
  const [stats, setStats] = useState<SalesStats>({
    today: 0,
    month: 0,
    year: 0,
    revenue: 0,
  });

  const [recent, setRecent] = useState<RecentTransaction[]>([]);
  const [recentPage, setRecentPage] = useState(1);
  const [recentTotal, setRecentTotal] = useState(0);

  async function fetchStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: today, error: todayError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid")
      .gte("created_at", todayStart.toISOString());

    if (todayError) console.error("today count error:", todayError);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: month, error: monthError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid")
      .gte("created_at", monthStart.toISOString());

    if (monthError) console.error("month count error:", monthError);

    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    const { count: year, error: yearError } = await supabase
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("status", "paid")
      .gte("created_at", yearStart.toISOString());

    if (yearError) console.error("year count error:", yearError);

    const { data: revData, error: revError } = await supabase
      .from("transactions")
      .select("price")
      .eq("status", "paid");

    if (revError) console.error("revenue error:", revError);

    let revenue = 0;
    revData?.forEach((r: { price: number | null }) => {
      revenue += Number(r.price || 0);
    });

    setStats({
      today: today || 0,
      month: month || 0,
      year: year || 0,
      revenue,
    });
  }

  async function fetchRecent() {
    const from = (recentPage - 1) * pageSize;
    const { data, error, count } = await supabase
      .from("transactions")
      .select(`
        id,
        invoice,
        user_id,
        price,
        payment_method,
        status,
        created_at,
        products(name)
      `, { count: "exact" })
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("fetchRecent error:", error);
      return;
    }

    setRecent((data as unknown as RecentTransaction[]) || []);
    setRecentTotal(count || 0);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStats();
  }, []);

  useEffect(() => {
    void fetchRecent();
  }, [recentPage]);

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      {/* HEADER */}
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-blue-100 px-3 py-1 text-lg leading-none text-blue-800">
          SALES REPORT
        </span>
        <h1 className="mt-3 text-[34px] leading-none text-[var(--insight-text)]">
          Sales Dashboard
        </h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Ringkasan penjualan dan transaksi terkonfirmasi
        </p>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Sales Today</div>
          <div className="mt-2 text-[34px] leading-none text-blue-600 dark:text-blue-300">
            {stats.today}
          </div>
        </div>

        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Sales Month</div>
          <div className="mt-2 text-[34px] leading-none text-emerald-600 dark:text-emerald-300">
            {stats.month}
          </div>
        </div>

        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Sales Year</div>
          <div className="mt-2 text-[34px] leading-none text-violet-600 dark:text-violet-300">
            {stats.year}
          </div>
        </div>

        <div className="insight-card flex min-h-[120px] flex-col justify-center p-4 transition-all duration-200 hover:-translate-y-1">
          <div className="text-xl leading-none text-[var(--insight-muted)]">Revenue</div>
          <div className="mt-2 text-[28px] leading-none text-amber-600 dark:text-amber-300">
            Rp {stats.revenue.toLocaleString("id-ID")}
          </div>
        </div>
      </div>

      {/* RECENT TRANSACTIONS */}
      <div className="insight-card overflow-hidden">
        <div className="border-b-[3px] border-[var(--insight-border)] p-4">
          <span className="inline-block border-[3px] border-[var(--insight-border)] bg-green-100 px-3 py-1 text-lg leading-none text-green-800">
            LATEST
          </span>
          <h2 className="mt-3 text-[30px] leading-none text-[var(--insight-text)]">
            Recent Transactions
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">No</th>
                <th className="p-3">Invoice</th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Produk</th>
                <th className="p-3">Harga</th>
                <th className="p-3">Payment</th>
                <th className="p-3">Status</th>
                <th className="p-3">User ID</th>
              </tr>
            </thead>

            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xl text-[var(--insight-muted)]">
                    Tidak ada transaksi.
                  </td>
                </tr>
              ) : (
                recent.map((t, index) => (
                  <tr key={t.id} className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60">
                    <td className="p-3">{(recentPage - 1) * pageSize + index + 1}</td>
                    <td className="p-3">{t.invoice || "-"}</td>
                    <td className="p-3">
                      {t.created_at ? new Date(t.created_at).toLocaleString("id-ID") : "-"}
                    </td>
                    <td className="p-3">{t.products?.name || "-"}</td>
                    <td className="p-3">Rp {Number(t.price || 0).toLocaleString("id-ID")}</td>
                    <td className="p-3">{t.payment_method || "-"}</td>
                    <td className="p-3">{t.status || "-"}</td>
                    <td className="p-3">{t.user_id}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={recentPage}
          pageSize={pageSize}
          totalRows={recentTotal}
          onPageChange={setRecentPage}
        />
      </div>
    </div>
  );
}
