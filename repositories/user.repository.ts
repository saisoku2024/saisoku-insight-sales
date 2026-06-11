import { supabase } from "@/lib/supabaseClient"
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
  const { error } = await supabase
    .from("users")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) throw error
}

export async function toggleUserStatusRepository(
  id: string,
  isActive: boolean
) {
  const { error } = await supabase
    .from("users")
    .update({
      is_active: !isActive,
    })
    .eq("id", id)

  if (error) throw error
}

export async function updateUserRepository(user: Partial<User>) {
  const { error } = await supabase
    .from("users")
    .update({
      email: user.email,
      phone: user.phone,
      role: user.role,
    })
    .eq("id", user.id)

  if (error) throw error
}