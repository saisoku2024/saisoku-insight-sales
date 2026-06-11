import { User } from "@/types/user"

import {
  getUsersRepository,
  deleteUserRepository,
  toggleUserStatusRepository,
  updateUserRepository,
} from "@/repositories/user.repository"

export async function getUsers(
  page = 1,
  limit = 50
) {
  return await getUsersRepository(page, limit)
}

export async function deleteUser(id: string) {
  return await deleteUserRepository(id)
}

export async function toggleUserStatus(user: User) {
  return await toggleUserStatusRepository(
    user.id,
    user.is_active
  )
}

export async function updateUser(user: Partial<User>) {
  return await updateUserRepository(user)
}