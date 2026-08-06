"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { useIsViewer } from "@/components/dashboard/panel-access-context";
import { supabase } from "@/lib/supabase/client";

type Ticket = {
  id: number;
  user_id: string;
  telegram_id: number;
  status: string;
  created_at: string;
  resolved_at?: string | null;
  users?: {
    username: string | null;
    name: string | null;
  } | null;
};

type Reply = {
  id: string;
  ticket_id: number;
  sender_type: "user" | "admin";
  message: string;
  created_at: string;
};

function TicketScreenshot({ fileId }: { fileId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let nextObjectUrl: string | null = null;

    async function loadImage() {
      setError(null);
      setObjectUrl(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("Session panel tidak ditemukan.");
        return;
      }

      const response = await fetch(`/api/tickets/file?fileId=${encodeURIComponent(fileId)}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        setError("Gagal memuat screenshot.");
        return;
      }

      const blob = await response.blob();
      nextObjectUrl = URL.createObjectURL(blob);
      if (active) setObjectUrl(nextObjectUrl);
    }

    void loadImage().catch(() => {
      if (active) setError("Gagal memuat screenshot.");
    });

    return () => {
      active = false;
      if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    };
  }, [fileId]);

  if (error) {
    return (
      <div className="border-[3px] border-red-500 bg-red-50 p-3 text-sm text-red-700 shadow-[3px_3px_0_var(--insight-shadow)]">
        {error}
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-xs text-[var(--insight-muted)] shadow-[3px_3px_0_var(--insight-shadow)]">
        Loading screenshot...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border-[3px] border-[var(--insight-border)] bg-black p-1 shadow-[3px_3px_0_var(--insight-shadow)] max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={objectUrl}
          alt="Screenshot Kendala"
          className="w-full h-auto object-contain max-h-[250px] block"
          loading="lazy"
        />
      </div>
      <a
        href={objectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center text-center gap-1.5 px-3 py-1 border-[3px] border-[var(--insight-border)] bg-blue-600 text-white font-bold text-xs shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-blue-500 max-w-sm"
      >
        Lihat / Download Screenshot
      </a>
    </div>
  );
}

export default function TicketHistoryPage() {
  const isViewer = useIsViewer();
  const pageSize = 10;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Detail State
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const loadHistoryTickets = useCallback(async () => {
    setLoading(true);
    setError(null);

    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    try {
      let countQuery = supabase
        .from("tickets")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved");

      let dataQuery = supabase
        .from("tickets")
        .select("id, user_id, telegram_id, status, created_at, resolved_at, users(username, name)")
        .eq("status", "resolved")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (searchQuery.trim()) {
        const queryStr = searchQuery.trim();
        if (!isNaN(Number(queryStr))) {
          countQuery = countQuery.or(`id.eq.${queryStr},telegram_id.eq.${queryStr}`);
          dataQuery = dataQuery.or(`id.eq.${queryStr},telegram_id.eq.${queryStr}`);
        }
      }

      const [{ count }, { data, error: fetchError }] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      if (fetchError) {
        throw new Error(fetchError.message || "Gagal memuat history tiket.");
      }

      setTotalCount(count || 0);
      setTickets((data as unknown as Ticket[]) || []);
    } catch (err) {
      console.error("loadHistoryTickets error:", err);
      setError(err instanceof Error ? err.message : "Terjadi kesalahan saat memuat data.");
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, pageSize]);

  async function openDetailModal(ticket: Ticket) {
    setDetailTicket(ticket);
    setLoadingReplies(true);
    setReplies([]);

    try {
      const { data, error: replyErr } = await supabase
        .from("ticket_replies")
        .select("id, ticket_id, sender_type, message, created_at")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });

      if (replyErr) throw replyErr;
      setReplies(data || []);
    } catch (err) {
      console.error("openDetailModal error:", err);
    } finally {
      setLoadingReplies(false);
    }
  }

  useEffect(() => {
    void loadHistoryTickets();
  }, [loadHistoryTickets]);

  useEffect(() => {
    if (modalScrollRef.current) {
      modalScrollRef.current.scrollTo({ top: modalScrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [replies]);

  function formatDate(dateStr?: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      {/* HEADER & TAB SWITCHER */}
      <div className="insight-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-block border-2 border-[var(--insight-border)] bg-emerald-100 px-2.5 py-0.5 text-xs font-bold leading-none text-emerald-800">
              REKAP & HISTORY
            </span>
            <h1 className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">
              History Tiket Selesai (Resolved)
            </h1>
            <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
              Arsip dan rekapitulasi seluruh tiket kendala yang telah diselesaikan oleh Admin / Auto-Replace.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dashboard/tickets"
              className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-1.5 text-sm font-bold leading-none text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition-transform"
            >
              🎫 Tiket Aktif
            </Link>
            <span className="border-2 border-[var(--insight-border)] bg-emerald-600 px-3 py-1.5 text-sm font-bold leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]">
              📜 History (Resolved)
            </span>
          </div>
        </div>

        {/* SEARCH TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t-2 border-[var(--insight-border)]">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Cari ID Tiket atau Telegram ID..."
              value={searchQuery}
              onChange={(e) => {
                setPage(1);
                setSearchQuery(e.target.value);
              }}
              className="h-9 w-64 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
            />
            <button
              onClick={() => void loadHistoryTickets()}
              className="h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 text-sm font-bold text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition-transform"
            >
              Cari
            </button>
          </div>

          <div className="text-sm font-semibold text-[var(--insight-muted)]">
            Total Resolved: <span className="text-[var(--insight-text)]">{totalCount} Tiket</span> (10 / Page)
          </div>
        </div>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      {/* TABLE REKAP */}
      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)] text-sm">
              <tr>
                <th className="px-4 py-3">ID Tiket</th>
                <th className="px-4 py-3">User Telegram</th>
                <th className="px-4 py-3">Telegram ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat Pada</th>
                <th className="px-4 py-3">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y-2 divide-[var(--insight-border)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-[var(--insight-muted)]">
                    Memuat history tiket...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-red-600 font-bold">
                    Gagal memuat: {error}
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-[var(--insight-muted)]">
                    Belum ada history tiket selesai (Resolved).
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const username = t.users?.username ? `@${t.users.username}` : (t.users?.name || "-");
                  return (
                    <tr
                      key={t.id}
                      className="transition hover:bg-blue-50/50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-sm">
                        #{t.id}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">
                        {username}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {t.telegram_id || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block border-2 border-[var(--insight-border)] bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                          Resolved
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--insight-muted)]">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void openDetailModal(t)}
                          className="border-2 border-[var(--insight-border)] bg-[var(--insight-blue)] px-3 py-1 text-xs font-bold text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition-transform"
                        >
                          👁️ Detail & Thread
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION (10 PER PAGE) */}
        <div className="border-t-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 flex items-center justify-between">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || loading}
            className="insight-button px-4 py-1.5 text-sm leading-none disabled:opacity-40"
          >
            Prev
          </button>

          <span className="text-sm font-semibold">
            Halaman {page} dari {totalPages}
          </span>

          <button
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || loading}
            className="insight-button px-4 py-1.5 text-sm leading-none disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {/* DETAIL MODAL THREAD */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="insight-card w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden bg-[var(--insight-card)] p-0">
            {/* Modal Header */}
            <div className="border-b-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--insight-text)]">
                  Rekap Detail Tiket #{detailTicket.id}
                </h2>
                <p className="text-xs text-[var(--insight-muted)]">
                  User: {detailTicket.users?.username ? `@${detailTicket.users.username}` : `Telegram ID ${detailTicket.telegram_id}`}
                </p>
              </div>
              <button
                onClick={() => setDetailTicket(null)}
                className="border-2 border-[var(--insight-border)] bg-red-600 text-white px-3 py-1 text-xs font-bold shadow-[2px_2px_0_var(--insight-shadow)] hover:bg-red-500"
              >
                Tutup (X)
              </button>
            </div>

            {/* Chat Messages */}
            <div ref={modalScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-900/20 min-h-[300px]">
              {loadingReplies ? (
                <div className="text-center text-sm text-[var(--insight-muted)] py-8">Memuat detail chat...</div>
              ) : replies.length === 0 ? (
                <div className="text-center text-sm text-[var(--insight-muted)] py-8">Tidak ada pesan chat tercatat.</div>
              ) : (
                replies.map((r) => {
                  const isAdmin = r.sender_type === "admin";
                  return (
                    <div
                      key={r.id}
                      className={`flex w-full ${isAdmin ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] border-2 border-[var(--insight-border)] p-3 shadow-[2px_2px_0_var(--insight-shadow)] flex flex-col gap-1 ${
                          isAdmin
                            ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                            : "bg-[var(--insight-card)] text-[var(--insight-text)]"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-[var(--insight-muted)] uppercase">
                          {isAdmin ? "Admin" : "Pengguna"}
                        </span>
                        {r.message.match(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*([\s\S]+?)\]/) ? (() => {
                          const match = r.message.match(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*([\s\S]+?)\]/);
                          const fileId = match ? match[1].trim() : "";
                          const cleanMsg = r.message.replace(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*[\s\S]+?\]/, "").trim();
                          return (
                            <div className="flex flex-col gap-2">
                              {cleanMsg && <p className="text-sm whitespace-pre-wrap leading-relaxed">{cleanMsg}</p>}
                              {fileId && (
                                <div className="mt-2">
                                  <TicketScreenshot fileId={fileId} />
                                </div>
                              )}
                            </div>
                          );
                        })() : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.message}</p>
                        )}
                        <span className="text-[10px] text-[var(--insight-muted)] text-right mt-1">
                          {formatDate(r.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 flex justify-between items-center text-xs text-[var(--insight-muted)]">
              <span>Status: <strong className="text-green-600 uppercase">Resolved</strong></span>
              <button
                onClick={() => setDetailTicket(null)}
                className="insight-button px-4 py-1.5 text-xs font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
