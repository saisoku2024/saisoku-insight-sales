"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Stock } from "@/types";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
}

export default function HistoryPage() {
  const [history, setHistory] = useState<Stock[]>([]);
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 10;

  const fetchHistory = useCallback(async () => {
    const { data, count } = await supabase
      .from("product_accounts")
      .select("*", { count: "exact" })
      .eq("status", "sold")
      .order("sold_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize);

    const rows = data || [];
    setHistory(rows.slice(0, pageSize));
    setTotalRows(count || 0);
    setHasMore(rows.length > pageSize);
  }, [page, pageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="space-y-4 text-[var(--insight-text)]">
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-violet-100 px-2.5 py-0.5 text-xs font-bold leading-none text-violet-800">
          STOCK HISTORY
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">
          Sold Account History
        </h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Audit akun produk yang sudah terjual dari inventory bot
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="insight-card flex min-h-[90px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-1">
          <div className="text-sm leading-none text-[var(--insight-muted)]">Sold Records</div>
          <div className="mt-1.5 text-2xl font-bold leading-none text-[var(--insight-text)]">
            {totalRows.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="insight-card flex min-h-[90px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-1">
          <div className="text-sm leading-none text-[var(--insight-muted)]">Latest Sold</div>
          <div className="mt-1.5 truncate text-xl font-bold leading-none text-blue-600 dark:text-blue-300">
            {formatDate(history[0]?.sold_at)}
          </div>
        </div>

        <div className="insight-card flex min-h-[90px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-1">
          <div className="text-sm leading-none text-[var(--insight-muted)]">Source Table</div>
          <div className="mt-1.5 text-xl font-bold leading-none text-emerald-600 dark:text-emerald-300">
            product_accounts
          </div>
        </div>
      </div>

      <div className="insight-card overflow-hidden">
        <div className="border-b-2 border-[var(--insight-border)] p-3 px-4 bg-[var(--insight-panel)]">
          <span className="inline-block border-2 border-[var(--insight-border)] bg-cyan-100 px-2.5 py-0.5 text-xs font-bold leading-none text-cyan-800">
            LOG
          </span>
          <h2 className="mt-1 text-lg font-bold leading-none text-[var(--insight-text)]">
            Sold Inventory
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm text-left">Email</th>
                <th className="px-4 py-3 text-sm text-left">Profile</th>
                <th className="px-4 py-3 text-sm text-left">Sold To</th>
                <th className="px-4 py-3 text-sm text-left">Date</th>
              </tr>
            </thead>

            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 text-sm">{h.email || "-"}</td>
                  <td className="px-4 py-2.5 text-sm">{h.profile || "-"}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className="inline-block border-2 border-[var(--insight-border)] bg-emerald-100 px-2.5 py-0.5 text-xs font-bold leading-none text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {h.sold_to || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm">{formatDate(h.sold_at)}</td>
                </tr>
              ))}

              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-[var(--insight-muted)]">
                    Belum ada history akun terjual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page === 1}
          className="insight-button px-3.5 py-1.5 text-sm leading-none disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm">Page {page}</span>
        <button
          onClick={() => setPage((current) => current + 1)}
          disabled={!hasMore}
          className="insight-button px-3.5 py-1.5 text-sm leading-none disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
