"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionNotice, type ActionNoticeState } from "@/components/dashboard/action-notice";
import { supabase } from "@/lib/supabase/client";
import { adminWrite } from "@/services/admin/admin-api-client";
import type { User } from "@/types";

export default function UsersPage() {
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
    if (!confirm("Delete user?")) return;

    try {
      await adminWrite<User>("/api/admin/users", {
        method: "PATCH",
        body: { id, action: "soft_delete" },
      });
    } catch (error) {
      showError(`Gagal delete user: ${getErrorMessage(error)}`);
      return;
    }

    showSuccess("User berhasil dinonaktifkan.");
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
    <div className="space-y-6">
      <div className="insight-card p-4">
        <span className="inline-block border-[3px] border-[var(--insight-border)] bg-blue-100 px-3 py-1 text-lg leading-none text-blue-800">
          USER MANAGEMENT
        </span>
        <h1 className="mt-3 text-[34px] leading-none text-[var(--insight-text)]">
          User Management
        </h1>
        <p className="mt-1 text-xl leading-none text-[var(--insight-muted)]">
          Kelola status, role, dan akses pengguna Telegram bot
        </p>
      </div>

      <ActionNotice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="insight-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[var(--insight-panel)] text-[var(--insight-muted)]">
              <tr>
                <th className="p-3">No</th>
                <th className="p-3">ID Telegram</th>
                <th className="p-3">Username</th>
                <th className="p-3">Role</th>
                <th className="p-3">Last Login</th>
                <th className="p-3">Status</th>
                <th className="p-3">View</th>
                <th className="p-3">Edit</th>
                <th className="p-3">Delete</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className="transition hover:bg-blue-50 dark:hover:bg-slate-800/60">
                  <td className="p-3">{(page - 1) * limit + i + 1}</td>
                  <td className="p-3">{u.telegram_id || "-"}</td>
                  <td className="p-3">{u.username || "-"}</td>
                  <td className="p-3">
                    <span
                      className={`inline-block border-[3px] border-[var(--insight-border)] px-2 py-1 text-lg leading-none ${
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
                  <td className="p-3">
                    {u.last_checkin_at ? new Date(u.last_checkin_at).toLocaleString("id-ID") : "-"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-block border-[3px] border-[var(--insight-border)] px-2 py-1 text-lg leading-none ${
                        u.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {u.is_active ? "Active" : "Suspend"}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="insight-button px-3 py-1 text-lg leading-none"
                    >
                      View
                    </button>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => setEditUser(u)}
                      className="insight-button px-3 py-1 text-lg leading-none"
                    >
                      Edit
                    </button>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => void deleteUser(u.id)}
                      className="border-[3px] border-[var(--insight-border)] bg-red-600 px-3 py-1 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]"
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
          className="insight-button px-4 py-2 text-lg leading-none disabled:opacity-40"
        >
          Prev
        </button>
        <span className="px-4 py-2 text-lg">Page {page}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={!hasMore}
          className="insight-button px-4 py-2 text-lg leading-none disabled:opacity-40"
        >
          Next
        </button>
      </div>

      {/* VIEW USER MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="insight-card w-[440px] max-w-[95vw] p-6">
            <h2 className="mb-5 text-[28px] leading-none text-[var(--insight-text)]">
              User Details
            </h2>

            <div className="grid grid-cols-2 gap-y-3 text-xl">
              <div className="text-[var(--insight-muted)]">User ID</div>
              <div className="truncate">{selectedUser.id}</div>
              <div className="text-[var(--insight-muted)]">Telegram ID</div>
              <div>{selectedUser.telegram_id}</div>
              <div className="text-[var(--insight-muted)]">Username</div>
              <div>{selectedUser.username}</div>
              <div className="text-[var(--insight-muted)]">Email</div>
              <div>{selectedUser.email || "-"}</div>
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
                  className={`inline-block border-[3px] border-[var(--insight-border)] px-2 py-1 text-lg leading-none ${
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
                className={`border-[3px] border-[var(--insight-border)] px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)] ${
                  selectedUser.is_active ? "bg-yellow-500" : "bg-green-600"
                }`}
              >
                {selectedUser.is_active ? "Suspend User" : "Activate User"}
              </button>

              <button
                onClick={() => setSelectedUser(null)}
                className="insight-button px-4 py-2 text-lg leading-none"
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
            <h2 className="text-[28px] leading-none text-[var(--insight-text)]">Edit User</h2>

            <input
              value={editUser.email || ""}
              onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
              placeholder="Email"
              className="h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
            />

            <input
              value={editUser.name || ""}
              onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
              placeholder="Name"
              className="h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
            />

            <input
              value={editUser.whatsapp || ""}
              onChange={(e) => setEditUser({ ...editUser, whatsapp: e.target.value })}
              placeholder="WhatsApp"
              className="h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
            />

            <select
              value={editUser.role || "reguler"}
              onChange={(e) => setEditUser({ ...editUser, role: e.target.value as User["role"] })}
              className="h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 text-xl text-[var(--insight-text)] outline-none"
            >
              <option value="admin">Admin</option>
              <option value="reseller">Reseller</option>
              <option value="reguler">Reguler</option>
            </select>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditUser(null)}
                className="insight-button px-4 py-2 text-lg leading-none"
              >
                Cancel
              </button>

              <button
                onClick={() => void updateUser()}
                className="border-[3px] border-[var(--insight-border)] bg-green-600 px-4 py-2 text-lg leading-none text-white shadow-[4px_4px_0_var(--insight-shadow)]"
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
