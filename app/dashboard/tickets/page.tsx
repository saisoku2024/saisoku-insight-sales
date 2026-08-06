"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context";
import { supabase } from "@/lib/supabase/client";



type Ticket = {
  id: number;
  user_id: string;
  telegram_id: number;
  status: TicketStatus;
  created_at: string;
  users?: {
    username: string | null;
    name: string | null;
  } | null;
};

type TicketStatus = "open" | "on_progress" | "assigned" | "replied" | "resolved";

type Reply = {
  id: string;
  ticket_id: number;
  sender_type: "user" | "admin";
  message: string;
  created_at: string;
};

const legacyDirectFileProxyEnabled = false;

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
      <div className="border-[3px] border-red-500 bg-red-50 p-3 text-base text-red-700 shadow-[3px_3px_0_var(--insight-shadow)]">
        {error}
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 text-base text-[var(--insight-muted)] shadow-[3px_3px_0_var(--insight-shadow)]">
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
          className="w-full h-auto object-contain max-h-[300px] block"
          loading="lazy"
        />
      </div>
      <a
        href={objectUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center text-center gap-1.5 px-3 py-1.5 border-[3px] border-[var(--insight-border)] bg-blue-600 text-white font-bold text-sm shadow-[3px_3px_0_var(--insight-shadow)] hover:bg-blue-500 max-w-sm"
      >
        Lihat / Download Screenshot
      </a>
    </div>
  );
}

export default function TicketsPage() {
  const isViewer = useIsViewer();
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
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [nextStatus, setNextStatus] = useState<TicketStatus>("on_progress");
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const pageSize = 10;
  const viewerDisabledClass = isViewer ? " cursor-not-allowed opacity-50 grayscale" : "";
  const showError = (message: string) => setNotice({ type: "error", message });
  const showSuccess = (message: string) => setNotice({ type: "success", message });
  const statusLabels: Record<TicketStatus, string> = {
    open: "Open",
    on_progress: "On Progress",
    assigned: "Assigned",
    replied: "Assigned",
    resolved: "Resolved",
  };
  const statusClasses: Record<TicketStatus, string> = {
    open: "bg-red-100 text-red-700",
    on_progress: "bg-blue-100 text-blue-700",
    assigned: "bg-yellow-100 text-yellow-700",
    replied: "bg-yellow-100 text-yellow-700",
    resolved: "bg-green-100 text-green-700",
  };

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
    if (isViewer || !selectedTicket || !newReply.trim() || sending) return;

    setSending(true);
    const replyText = newReply.trim();

    try {
      const replyData = await callTicketAction<Reply>("/api/tickets/reply", {
        ticketId: String(selectedTicket.id),
        feedback: replyText,
      });

      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: "assigned" } : t))
      );
      setSelectedTicket((prev) => (prev ? { ...prev, status: "assigned" } : null));
      setReplies((prev) => [...prev, replyData]);
      setNewReply("");
      showSuccess("Balasan berhasil dikirim ke user.");
    } catch (e) {
      console.error("sendReply error:", e);
      showError(e instanceof Error ? e.message : "Gagal mengirim balasan.");
    }

    setSending(false);
  }

  const [replacingAccount, setReplacingAccount] = useState(false);

  async function handleReplaceAccount() {
    if (isViewer || !selectedTicket || replacingAccount) return;
    if (!confirm("Apakah Anda yakin ingin mengganti akun dari stok otomatis untuk tiket ini?")) return;

    setReplacingAccount(true);
    try {
      const result = await callTicketAction<{ ok: boolean; message: string }>("/api/tickets/replace-account", {
        ticketId: String(selectedTicket.id),
      });

      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: "resolved" } : t))
      );
      setSelectedTicket((prev) => (prev ? { ...prev, status: "resolved" } : null));
      showSuccess(result?.message || "Akun pengganti dari stok berhasil dikirim ke pembeli!");
      void loadReplies(selectedTicket.id);
    } catch (e) {
      console.error("handleReplaceAccount error:", e);
      showError(e instanceof Error ? e.message : "Gagal melakukan replace akun.");
    }
    setReplacingAccount(false);
  }

  async function updateTicketStatus(status: TicketStatus) {
    if (isViewer || !selectedTicket) return;

    setUpdatingStatus(true);
    try {
      const result = await callTicketAction<{ status: TicketStatus }>("/api/tickets/status", {
        ticketId: String(selectedTicket.id),
        status,
      });
      const updatedStatus = result?.status || status;
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: updatedStatus } : t))
      );
      setSelectedTicket((prev) => (prev ? { ...prev, status: updatedStatus } : null));
      setNextStatus(updatedStatus === "resolved" ? "resolved" : updatedStatus);
      showSuccess(`Status tiket diubah ke ${statusLabels[updatedStatus]}.`);
    } catch (e) {
      console.error("updateTicketStatus error:", e);
      showError(e instanceof Error ? e.message : "Gagal mengubah status tiket.");
    }
    setUpdatingStatus(false);
  }

  useEffect(() => {
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  useEffect(() => {
    if (selectedTicket) {
      void loadReplies(selectedTicket.id);
      setNextStatus(
        selectedTicket.status === "open"
          ? "on_progress"
          : selectedTicket.status === "replied"
          ? "assigned"
          : selectedTicket.status
      );
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
      <div className="insight-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="inline-block border-2 border-[var(--insight-border)] bg-indigo-100 px-2.5 py-0.5 text-xs font-bold leading-none text-indigo-800">
              TICKET MANAGEMENT
            </span>
            <h1 className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">Support Tickets (Aktif)</h1>
            <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
              Kelola laporan kendala dan pertanyaan aktif dari pelanggan Telegram
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="border-2 border-[var(--insight-border)] bg-indigo-600 px-3 py-1.5 text-sm font-bold leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]">
              🎫 Tiket Aktif
            </span>
            <Link
              href="/dashboard/tickets/history"
              className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 py-1.5 text-sm font-bold leading-none text-[var(--insight-text)] shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition-transform"
            >
              📜 History (Resolved)
            </Link>
            <button
              onClick={() => {
                void loadTickets();
                if (selectedTicket) {
                  void loadReplies(selectedTicket.id);
                }
              }}
              className="border-2 border-[var(--insight-border)] bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-3 py-1.5 text-sm font-bold leading-none shadow-[2px_2px_0_var(--insight-shadow)] hover:-translate-y-0.5 transition-all flex items-center gap-1.5 ml-2"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: TICKET LIST */}
        <div className="insight-card flex flex-col h-[600px] overflow-hidden lg:col-span-1">
          <div className="border-b-2 border-[var(--insight-border)] p-3 px-4 flex items-center justify-between bg-[var(--insight-panel)]">
            <span className="text-sm font-bold">List Tiket</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-8 border-2 border-[var(--insight-border)] bg-[var(--insight-card)] px-2 text-xs text-[var(--insight-text)] outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="open">Open</option>
              <option value="on_progress">On Progress</option>
              <option value="assigned">Assigned</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto divide-y-[3px] divide-[var(--insight-border)]">
            {loadingTickets ? (
              <div className="p-6 text-center text-sm text-[var(--insight-muted)]">Loading...</div>
            ) : ticketError ? (
              <div className="m-3 border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700 shadow-[2px_2px_0_var(--insight-shadow)]">
                Gagal memuat tiket: {ticketError}
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--insight-muted)]">Tidak ada tiket.</div>
            ) : (
              tickets.map((t) => {
                const isActive = selectedTicket?.id === t.id;
                const username = t.users?.username ? `@${t.users.username}` : `User ${t.telegram_id}`;

                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className={`w-full text-left p-3 transition-all hover:bg-blue-50 dark:hover:bg-slate-800/40 flex flex-col gap-1 ${
                      isActive ? "bg-blue-50/80 dark:bg-slate-800/60 font-bold" : ""
                    }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span className="text-sm">Tiket #{t.id}</span>
                      <span
                        className={`inline-block border-2 border-[var(--insight-border)] px-2 py-0.5 text-xs font-bold leading-none ${
                          statusClasses[t.status] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabels[t.status] || t.status}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--insight-muted)] flex justify-between w-full">
                      <span>{username}</span>
                      <span>{new Date(t.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-2.5 flex items-center justify-between">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="insight-button px-2.5 py-1 text-xs leading-none disabled:opacity-40"
            >
              Prev
            </button>
            <span className="text-xs">Page {page}</span>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasMore}
              className="insight-button px-2.5 py-1 text-xs leading-none disabled:opacity-40"
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
              <div className="border-b-2 border-[var(--insight-border)] p-3 px-4 flex flex-wrap items-center justify-between bg-[var(--insight-panel)] shrink-0 gap-3">
                <div>
                  <h3 className="text-sm leading-none font-bold">Tiket #{selectedTicket.id}</h3>
                  <p className="text-xs text-[var(--insight-muted)] mt-1">
                    Pengguna: {selectedTicket.users?.username ? `@${selectedTicket.users.username}` : `ID ${selectedTicket.telegram_id}`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value as TicketStatus)}
                    disabled={updatingStatus || isViewer}
                    title={isViewer ? viewerOnlyTitle : undefined}
                    className={`h-8 border-2 border-[var(--insight-border)] bg-[var(--insight-card)] px-2 text-xs text-[var(--insight-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60${viewerDisabledClass}`}
                  >
                    <option value="on_progress">On Progress</option>
                    <option value="assigned">Assigned</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button
                    onClick={() => void updateTicketStatus(nextStatus)}
                    disabled={isViewer || updatingStatus || nextStatus === selectedTicket.status}
                    title={isViewer ? viewerOnlyTitle : undefined}
                    className={`border-2 border-[var(--insight-border)] bg-emerald-600 px-2.5 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none${viewerDisabledClass}`}
                  >
                    {updatingStatus ? "Updating..." : "Update Status"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReplaceAccount}
                    disabled={isViewer || replacingAccount || selectedTicket.status === "resolved"}
                    title={isViewer ? viewerOnlyTitle : undefined}
                    className={`border-2 border-[var(--insight-border)] bg-amber-500 px-2.5 py-1 text-xs font-bold leading-none text-black shadow-[2px_2px_0_var(--insight-shadow)] hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none${viewerDisabledClass}`}
                  >
                    {replacingAccount ? "Replacing..." : "🔄 Replace Akun (Stok)"}
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 dark:bg-slate-900/20">
                {loadingReplies ? (
                  <div className="text-center text-sm text-[var(--insight-muted)] py-6">Loading chat...</div>
                ) : replyError ? (
                  <div className="border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700 shadow-[2px_2px_0_var(--insight-shadow)]">
                    Gagal memuat chat: {replyError}
                  </div>
                ) : replies.length === 0 ? (
                  <div className="text-center text-sm text-[var(--insight-muted)] py-6">Belum ada chat.</div>
                ) : (
                  replies.map((r) => {
                    const isAdmin = r.sender_type === "admin";
                    return (
                      <div
                        key={r.id}
                        className={`flex w-full ${isAdmin ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] border-2 border-[var(--insight-border)] p-2.5 shadow-[2px_2px_0_var(--insight-shadow)] flex flex-col gap-1 ${
                            isAdmin
                              ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                              : "bg-[var(--insight-card)] text-[var(--insight-text)]"
                          }`}
                        >
                          <span className="text-[10px] text-[var(--insight-muted)] uppercase">
                            {isAdmin ? "Admin" : "Pengguna"}
                          </span>
                          {r.message.match(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*([\s\S]+?)\]/) ? (() => {
                            const match = r.message.match(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*([\s\S]+?)\]/);
                            const fileId = match ? match[1].trim() : "";
                            const cleanMsg = r.message.replace(/\[Screenshot Kendala:\s*Telegram File ID\s*=\s*[\s\S]+?\]/, "").trim();
                            const fileUrl = `/api/tickets/file?fileId=${encodeURIComponent(fileId)}`;
                            return (
                              <div className="flex flex-col gap-2">
                                {cleanMsg && <p className="text-sm whitespace-pre-wrap leading-relaxed">{cleanMsg}</p>}
                                {legacyDirectFileProxyEnabled && fileId && (
                                  <div className="flex flex-col gap-2 mt-2">
                                    <div className="border-2 border-[var(--insight-border)] bg-black p-1 shadow-[2px_2px_0_var(--insight-shadow)] max-w-sm">
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
                                      className="inline-flex items-center justify-center text-center gap-1.5 px-2.5 py-1 border-2 border-[var(--insight-border)] bg-blue-600 text-white font-bold text-xs shadow-[2px_2px_0_var(--insight-shadow)] hover:bg-blue-500 max-w-sm"
                                    >
                                      🖼️ Lihat / Download Screenshot
                                    </a>
                                  </div>
                                )}
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
                <div className="border-t-2 border-[var(--insight-border)] p-3 text-center text-sm text-[var(--insight-muted)] shrink-0 bg-[var(--insight-panel)]">
                  Tiket ini telah diselesaikan. Buka kembali atau buat tiket baru di Telegram untuk memulai percakapan baru.
                </div>
              ) : (
                <div className="border-t-2 border-[var(--insight-border)] p-3 flex gap-3 bg-[var(--insight-card)] shrink-0">
                  <input
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (!isViewer && e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendReply();
                      }
                    }}
                    placeholder="Tulis balasan Anda ke pembeli..."
                    disabled={isViewer || sending}
                    title={isViewer ? viewerOnlyTitle : undefined}
                    className={`flex-1 h-9 border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none disabled:cursor-not-allowed disabled:opacity-60${viewerDisabledClass}`}
                  />
                  <button
                    onClick={() => void sendReply()}
                    disabled={isViewer || sending || !newReply.trim()}
                    title={isViewer ? viewerOnlyTitle : undefined}
                    className={`border-2 border-[var(--insight-border)] bg-[var(--insight-blue)] px-4 py-1.5 text-sm leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none${viewerDisabledClass}`}
                  >
                    {sending ? "Sending..." : "Kirim"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-[var(--insight-muted)] p-8">
              <span className="text-4xl">🎫</span>
              <p className="text-sm mt-2">Pilih tiket di sebelah kiri untuk melihat percakapan.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
