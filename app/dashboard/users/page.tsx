"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { useIsViewer, viewerOnlyTitle } from "@/components/dashboard/panel-access-context";
import { supabase } from "@/lib/supabase/client";
import { maskEmail } from "@/lib/utils";
import { adminWrite } from "@/services/admin/admin-api-client";
import type { User } from "@/types";

export default function UsersPage() {
  const isViewer = useIsViewer();
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<ActionNoticeState>(null);

  const limit = 10;
  const showError = (message: string) => setNotice({ type: "error", message });
  const showSuccess = (message: string) => setNotice({ type: "success", message });
  const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : "Unknown error";
  const viewerDisabledClass = " disabled:cursor-not-allowed disabled:opacity-50";

  const loadUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit);

    if (error) {
      console.error(error);
      return;
    }

    setUsers((data || []).slice(0, limit));
    setHasMore((data?.length || 0) > limit);
  }, [page]);

  async function deleteUser(id: string) {
    if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) return;

    try {
      const res = await adminWrite<{ ok?: boolean; softDeleted?: boolean; message?: string }>("/api/admin/users", {
        method: "DELETE",
        body: { id },
      });
      if (res?.softDeleted) {
        showSuccess(res.message || "User yang memiliki riwayat transaksi telah dinonaktifkan.");
      } else {
        showSuccess("User berhasil dihapus.");
      }
    } catch (error) {
      showError(`Gagal delete user: ${getErrorMessage(error)}`);
      return;
    }

    void loadUsers();
  }

  async function toggleUserStatus(user: User) {
    const newStatus = !user.is_active;

    try {
      await adminWrite<User>("/api/admin/users", {
        method: "PATCH",
        body: { id: user.id, action: "toggle_status", is_active: newStatus },
      });
    } catch (error) {
      showError(`Gagal ubah status user: ${getErrorMessage(error)}`);
      return;
    }

    setSelectedUser({ ...user, is_active: newStatus });
    showSuccess("Status user berhasil diubah.");
    void loadUsers();
  }

  async function updateUser() {
    if (!editUser) return;

    try {
      await adminWrite<User>("/api/admin/users", {
        method: "PATCH",
        body: {
          id: editUser.id,
        email: editUser.email,
        name: editUser.name,
        whatsapp: editUser.whatsapp,
        role: editUser.role,
        },
      });
    } catch (error) {
      showError(`Gagal update user: ${getErrorMessage(error)}`);
      return;
    }

    setEditUser(null);
    showSuccess("User berhasil diupdate.");
    void loadUsers();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadUsers();
  }, [loadUsers]);

  return (
    <div className="space-y-4 text-[var(--insight-text)]">
      <div className="insight-card p-3 px-4">
        <span className="inline-block border-2 border-[var(--insight-border)] bg-blue-100 px-2.5 py-0.5 text-xs font-bold leading-none text-blue-800">
          USER MANAGEMENT
        </span>
        <h1 className="mt-2 text-2xl font-bold leading-none text-[var(--insight-text)]">
          User Management
        </h1>
        <p className="mt-1 text-sm leading-none text-[var(--insight-muted)]">
          Kelola status, role, dan akses pengguna Telegram bot
        </p>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="px-4 py-3 text-sm">No</th>
                <th className="px-4 py-3 text-sm">ID Telegram</th>
                <th className="px-4 py-3 text-sm">Username</th>
                <th className="px-4 py-3 text-sm">Role</th>
                <th className="px-4 py-3 text-sm">Last Login</th>
                <th className="px-4 py-3 text-sm">Status</th>
                <th className="px-4 py-3 text-sm">View</th>
                <th className="px-4 py-3 text-sm">Edit</th>
                <th className="px-4 py-3 text-sm">Delete</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 text-sm">{(page - 1) * limit + i + 1}</td>
                  <td className="px-4 py-2.5 text-sm">{u.telegram_id || "-"}</td>
                  <td className="px-4 py-2.5 text-sm">{u.username || "-"}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span
                      className={`inline-block border-2 border-[var(--insight-border)] px-2.5 py-0.5 text-xs font-bold leading-none ${
                        u.role === "owner"
                          ? "bg-red-100 text-red-700"
                          : u.role === "admin"
                          ? "bg-blue-100 text-blue-700"
                          : u.role === "reseller"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {u.role || "reguler"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    {u.last_checkin_at ? new Date(u.last_checkin_at).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <span
                      className={`inline-block border-2 border-[var(--insight-border)] px-2.5 py-0.5 text-xs font-bold leading-none ${
                        u.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {u.is_active ? "Active" : "Suspend"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="insight-button px-2.5 py-1 text-xs leading-none"
                    >
                      View
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <button
                      onClick={() => {
                        if (isViewer) return;
                        setEditUser(u);
                      }}
                      disabled={isViewer}
                      title={isViewer ? viewerOnlyTitle : undefined}
                      className={"insight-button px-2.5 py-1 text-xs leading-none" + viewerDisabledClass}
                    >
                      Edit
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-sm">
                    <button
                      onClick={() => void deleteUser(u.id)}
                      disabled={isViewer}
                      title={isViewer ? viewerOnlyTitle : undefined}
                      className={"border-2 border-[var(--insight-border)] bg-red-600 px-2.5 py-1 text-xs leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]" + viewerDisabledClass}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      <div className="flex gap-3">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page === 1}
          className="insight-button px-3.5 py-1.5 text-sm leading-none disabled:opacity-40"
        >
          Prev
        </button>
        <span className="px-3 py-1.5 text-sm">Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={!hasMore}
          className="insight-button px-3.5 py-1.5 text-sm leading-none disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* VIEW USER MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="insight-card w-[440px] max-w-[95vw] p-6">
            <h2 className="mb-4 text-xl font-bold leading-none text-[var(--insight-text)]">
              User Details
            </h2>

            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <div className="text-[var(--insight-muted)]">User ID</div>
              <div className="truncate">{selectedUser.id}</div>
              <div className="text-[var(--insight-muted)]">Telegram ID</div>
              <div>{selectedUser.telegram_id}</div>
              <div className="text-[var(--insight-muted)]">Username</div>
              <div>{selectedUser.username}</div>
              <div className="text-[var(--insight-muted)]">Email</div>
              <div>{maskEmail(selectedUser.email)}</div>
              <div className="text-[var(--insight-muted)]">Name</div>
              <div>{selectedUser.name || "-"}</div>
              <div className="text-[var(--insight-muted)]">WhatsApp</div>
              <div>{selectedUser.whatsapp || "-"}</div>
              <div className="text-[var(--insight-muted)]">Role</div>
              <div>{selectedUser.role || "reguler"}</div>
              <div className="text-[var(--insight-muted)]">Balance</div>
              <div>Rp {Number(selectedUser.balance || 0).toLocaleString("id-ID")}</div>
              <div className="text-[var(--insight-muted)]">Status</div>
              <div>
                <span
                  className={`inline-block border-2 border-[var(--insight-border)] px-2.5 py-0.5 text-xs font-bold leading-none ${
                    selectedUser.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {selectedUser.is_active ? "Active" : "Suspend"}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <button
                onClick={() => void toggleUserStatus(selectedUser)}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={`border-2 border-[var(--insight-border)] px-3.5 py-1.5 text-sm leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)] ${
                  selectedUser.is_active ? "bg-yellow-500" : "bg-green-600"
                }${viewerDisabledClass}`}
              >
                {selectedUser.is_active ? "Suspend User" : "Activate User"}
              </button>

              <button
                onClick={() => setSelectedUser(null)}
                className="insight-button px-3.5 py-1.5 text-sm leading-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="insight-card w-[440px] max-w-[95vw] space-y-4 p-6">
            <h2 className="text-xl font-bold mb-4 text-[var(--insight-text)]">Edit User</h2>

            <input
              value={editUser.email || ""}
              onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
              placeholder="Email"
              className="h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
            />

            <input
              value={editUser.name || ""}
              onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
              placeholder="Name"
              className="h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
            />

            <input
              value={editUser.whatsapp || ""}
              onChange={(e) => setEditUser({ ...editUser, whatsapp: e.target.value })}
              placeholder="WhatsApp"
              className="h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
            />

            <select
              value={editUser.role || "reguler"}
              onChange={(e) => setEditUser({ ...editUser, role: e.target.value as User["role"] })}
              className="h-9 w-full border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-sm text-[var(--insight-text)] outline-none"
            >
              <option value="admin">Admin</option>
              <option value="reseller">Reseller</option>
              <option value="reguler">Reguler</option>
            </select>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditUser(null)}
                className="insight-button px-3.5 py-1.5 text-sm leading-none"
              >
                Cancel
              </button>

              <button
                onClick={() => void updateUser()}
                disabled={isViewer}
                title={isViewer ? viewerOnlyTitle : undefined}
                className={"border-2 border-[var(--insight-border)] bg-green-600 px-3.5 py-1.5 text-sm leading-none text-white shadow-[2px_2px_0_var(--insight-shadow)]" + viewerDisabledClass}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
