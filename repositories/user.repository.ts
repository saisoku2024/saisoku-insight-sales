import { supabase } from "@/lib/supabase/client"
import { adminWrite } from "@/services/admin/admin-api-client"
import { User } from "@/types/user"

export async function getUsersRepository(
  page = 1,
  limit = 50
): Promise<User[]> {

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) throw error

  return (data || []) as User[]
}

export async function deleteUserRepository(id: string) {
  return await adminWrite<User>("/api/admin/users", {
    method: "PATCH",
    body: { id, action: "soft_delete" },
  })
}

export async function toggleUserStatusRepository(
  id: string,
  isActive: boolean
) {
  return await adminWrite<User>("/api/admin/users", {
    method: "PATCH",
    body: { id, action: "toggle_status", is_active: !isActive },
  })
}

export async function updateUserRepository(user: Partial<User>) {
  return await adminWrite<User>("/api/admin/users", {
    method: "PATCH",
    body: {
      id: user.id,
      email: user.email,
      name: user.name,
      whatsapp: user.whatsapp,
      role: user.role,
    },
  })
}
