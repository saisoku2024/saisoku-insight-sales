"use client";

import { useEffect, useState, useRef } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { supabase } from "@/lib/supabaseClient";

type Ticket = {
  id: number;
  user_id: string;
  telegram_id: number;
  status: "open" | "replied" | "resolved";
  created_at: string;
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

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [newReply, setNewReply] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [sending, setSending] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const pageSize = 10;
  const showError = (message: string) => setNotice({ type: "error", message });
  const showSuccess = (message: string) => setNotice({ type: "success", message });

  async function loadTickets() {
    setLoadingTickets(true);
    setTicketError(null);
    let query = supabase
      .from("tickets")
      .select("id, user_id, telegram_id, status, created_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("loadTickets error:", error);
      setTicketError(error.message || "Gagal memuat data tiket.");
      setTickets([]);
      setHasMore(false);
    } else {
      const rows = ((data as unknown as Ticket[]) || []);
      setTickets(rows.slice(0, pageSize));
      setHasMore(rows.length > pageSize);
    }
    setLoadingTickets(false);
  }

  async function loadReplies(ticketId: number) {
    setLoadingReplies(true);
    setReplyError(null);
    const { data, error } = await supabase
      .from("ticket_replies")
      .select("id, ticket_id, sender_type, message, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadReplies error:", error);
      setReplyError(error.message || "Gagal memuat chat tiket.");
      setReplies([]);
    } else {
      setReplies(data || []);
    }
    setLoadingReplies(false);
  }

  async function callTicketAction<T = unknown>(path: string, payload: Record<string, unknown>) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session admin tidak ditemukan. Silakan login ulang.");
    }

    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = (await res.json()) as { data?: T; error?: string };

    if (!res.ok) {
      throw new Error(result.error || "Request gagal");
    }

    return result.data as T;
  }

  async function sendReply() {
    if (!selectedTicket || !newReply.trim() || sending) return;

    setSending(true);
    const replyText = newReply.trim();

    try {
      const replyData = await callTicketAction<Reply>("/api/tickets/reply", {
        ticketId: String(selectedTicket.id),
        feedback: replyText,
      });

      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: "replied" } : t))
      );
      setSelectedTicket((prev) => (prev ? { ...prev, status: "replied" } : null));
      setReplies((prev) => [...prev, replyData]);
      setNewReply("");
      showSuccess("Balasan berhasil dikirim ke user.");
    } catch (e) {
      console.error("sendReply error:", e);
      showError(e instanceof Error ? e.message : "Gagal mengirim balasan.");
    }

    setSending(false);
  }

  async function resolveTicket() {
    if (!selectedTicket) return;

    try {
      await callTicketAction("/api/tickets/resolve", {
        ticketId: String(selectedTicket.id),
      });
    } catch (e) {
      console.error("resolveTicket error:", e);
      showError(e instanceof Error ? e.message : "Gagal menyelesaikan tiket.");
      return;
    }

    setTickets((prev) =>
      prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: "resolved" } : t))
    );
    setSelectedTicket((prev) => (prev ? { ...prev, status: "resolved" } : null));
    showSuccess("Tiket berhasil diselesaikan.");
  }

  useEffect(() => {
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  useEffect(() => {
    if (selectedTicket) {
      void loadReplies(selectedTicket.id);
    } else {
      setReplies([]);
    }
  }, [selectedTicket]);

  useEffect(() => {
    const chatBox = chatScrollRef.current;
    if (chatBox) {
      chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
    }
  }, [replies]);

  return (
    <div className="space-y-6 text-[var(--insight-text)]">
      {/* HEADER */}
      <div className="insight-card p-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <span className="inline-block border-[3px] border-[var(--insight-border)] bg-indigo-100 px-3 py-1 text-lg leading-none text-indigo-800">
            TICKET MANAGEMENT
          </span>
          <h1 className="mt-3 text-[34px] leading-none text-[var(--insight-text)]">Support Tickets</h1>
          <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
            Kelola laporan kendala dan pertanyaan pelanggan dari Telegram
          </p>
        </div>
        <div>
          <button
            onClick={() => {
              void loadTickets();
              if (selectedTicket) {
                void loadReplies(selectedTicket.id);
              }
            }}
            className="border-[3px] border-[var(--insight-border)] bg-indigo-600 px-4 py-2 text-lg font-bold leading-none text-white shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-indigo-500 transition-all flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M21 8v-5h-.58"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: TICKET LIST */}
        <div className="insight-card flex flex-col h-[600px] overflow-hidden lg:col-span-1">
          <div className="border-b-[3px] border-[var(--insight-border)] p-4 flex items-center justify-between bg-[var(--insight-panel)]">
            <span className="text-xl font-bold">List Tiket</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-2 text-lg text-[var(--insight-text)] outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="open">Open</option>
              <option value="replied">Replied</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y-[3px] divide-[var(--insight-border)]">
            {loadingTickets ? (
              <div className="p-8 text-center text-xl text-[var(--insight-muted)]">Loading...</div>
            ) : ticketError ? (
              <div className="m-4 border-[3px] border-red-600 bg-red-50 p-4 text-lg text-red-700 shadow-[3px_3px_0_var(--insight-shadow)]">
                Gagal memuat tiket: {ticketError}
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center text-xl text-[var(--insight-muted)]">Tidak ada tiket.</div>
            ) : (
              tickets.map((t) => {
                const isActive = selectedTicket?.id === t.id;
                const username = t.users?.username ? `@${t.users.username}` : `User ${t.telegram_id}`;

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`w-full text-left p-4 transition-all hover:bg-blue-50 dark:hover:bg-slate-800/40 flex flex-col gap-1 ${
                      isActive ? "bg-blue-50/80 dark:bg-slate-800/60 font-bold" : ""
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-xl">Tiket #{t.id}</span>
                      <span
                        className={`inline-block border-[2px] border-[var(--insight-border)] px-2 py-0.5 text-base leading-none ${
                          t.status === "open"
                            ? "bg-red-100 text-red-700"
                            : t.status === "replied"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-lg text-[var(--insight-muted)] flex justify-between w-full">
                      <span>{username}</span>
                      <span className="text-base">{new Date(t.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 flex items-center justify-between">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="insight-button px-3 py-1.5 text-lg leading-none disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-lg">Page {page}</span>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasMore}
              className="insight-button px-3 py-1.5 text-lg leading-none disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: CHAT THREAD */}
        <div className="insight-card flex flex-col h-[600px] overflow-hidden lg:col-span-2">
          {selectedTicket ? (
            <>
              {/* Active Ticket Header */}
              <div className="border-b-[3px] border-[var(--insight-border)] p-4 flex items-center justify-between bg-[var(--insight-panel)] shrink-0">
                <div>
                  <h3 className="text-2xl leading-none font-bold">Tiket #{selectedTicket.id}</h3>
                  <p className="text-base text-[var(--insight-muted)] mt-1">
                    Pengguna: {selectedTicket.users?.username ? `@${selectedTicket.users.username}` : `ID ${selectedTicket.telegram_id}`}
                  </p>
                </div>

                {selectedTicket.status !== "resolved" && (
                  <button
                    onClick={() => void resolveTicket()}
                    className="border-[3px] border-[var(--insight-border)] bg-emerald-600 px-3 py-1.5 text-lg leading-none text-white shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-emerald-500"
                  >
                    Selesaikan (Resolve)
                  </button>
                )}
              </div>

              {/* Chat Messages Area */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900/20">
                {loadingReplies ? (
                  <div className="text-center text-xl text-[var(--insight-muted)] py-8">Loading chat...</div>
                ) : replyError ? (
                  <div className="border-[3px] border-red-600 bg-red-50 p-4 text-lg text-red-700 shadow-[3px_3px_0_var(--insight-shadow)]">
                    Gagal memuat chat: {replyError}
                  </div>
                ) : replies.length === 0 ? (
                  <div className="text-center text-xl text-[var(--insight-muted)] py-8">Belum ada chat.</div>
                ) : (
                  replies.map((r) => {
                    const isAdmin = r.sender_type === "admin";
                    return (
                      <div
                        key={r.id}
                        className={`flex w-full ${isAdmin ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] border-[3px] border-[var(--insight-border)] p-3 shadow-[3px_3px_0_var(--insight-shadow)] flex flex-col gap-1 ${
                            isAdmin
                              ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                              : "bg-[var(--insight-card)] text-[var(--insight-text)]"
                          }`}
                        >
                          <span className="text-xs text-[var(--insight-muted)] uppercase">
                            {isAdmin ? "Admin" : "Pengguna"}
                          </span>
                          {r.message.match(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*([\s\S]+?)\]/) ? (() => {
                            const match = r.message.match(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*([\s\S]+?)\]/);
                            const fileId = match ? match[1].trim() : "";
                            const cleanMsg = r.message.replace(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*[\s\S]+?\]/, "").trim();
                            const fileUrl = `/api/tickets/file?fileId=${encodeURIComponent(fileId)}`;
                            return (
                              <div className="flex flex-col gap-2">
                                {cleanMsg && <p className="text-lg whitespace-pre-wrap leading-relaxed">{cleanMsg}</p>}
                                {fileId && (
                                  <div className="flex flex-col gap-2 mt-2">
                                    <div className="border-[3px] border-[var(--insight-border)] bg-black p-1 shadow-[3px_3px_0_var(--insight-shadow)] max-w-sm">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={fileUrl}
                                        alt="Screenshot Kendala"
                                        className="w-full h-auto object-contain max-h-[300px] block"
                                        loading="lazy"
                                      />
                                    </div>
                                    <a
                                      href={fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center justify-center text-center gap-1.5 px-3 py-1.5 border-[3px] border-[var(--insight-border)] bg-blue-600 text-white font-bold text-sm shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-blue-500 max-w-sm"
                                    >
                                      🖼️ Lihat / Download Screenshot
                                    </a>
                                  </div>
                                )}
                              </div>
                            );
                          })() : (
                            <p className="text-lg whitespace-pre-wrap leading-relaxed">{r.message}</p>
                          )}
                          <span className="text-xs text-[var(--insight-muted)] text-right mt-1">
                            {new Date(r.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input Area */}
              {selectedTicket.status === "resolved" ? (
                <div className="border-t-[3px] border-[var(--insight-border)] p-4 text-center text-lg text-[var(--insight-muted)] shrink-0 bg-[var(--insight-panel)]">
                  Tiket ini telah diselesaikan. Buka kembali atau buat tiket baru di Telegram untuk memulai percakapan baru.
                </div>
              ) : (
                <div className="border-t-[3px] border-[var(--insight-border)] p-4 flex gap-3 bg-[var(--insight-card)] shrink-0">
                  <input
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                    placeholder="Tulis balasan Anda ke pembeli..."
                    disabled={sending}
                    className="flex-1 h-11 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-lg text-[var(--insight-text)] outline-none"
                  />
                  <button
                    onClick={() => void sendReply()}
                    disabled={sending || !newReply.trim()}
                    className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-blue)] px-5 py-2 text-lg leading-none text-white shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {sending ? "Sending..." : "Kirim"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-[var(--insight-muted)] p-8">
              <span className="text-6xl">🎫</span>
              <p className="text-xl mt-4">Pilih tiket di sebelah kiri untuk melihat percakapan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
