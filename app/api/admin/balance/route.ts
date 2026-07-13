import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  readLimitedString,
  readNumber,
  readNumberRange,
  readString,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

const allowedActions = new Set(["add", "deduct", "reset"])

type BalanceRpcRow = {
  success?: boolean
  message?: string
  new_balance?: number
}

function firstRpcRow(data: unknown): BalanceRpcRow {
  return Array.isArray(data) ? (data[0] || {}) : ((data || {}) as BalanceRpcRow)
}

async function findOwnerTelegramId(adminEmail: string) {
  const { data, error } = await adminSupabase!
    .from("users")
    .select("telegram_id")
    .eq("email", adminEmail)
    .eq("role", "owner")
    .maybeSingle()

  if (!error && data?.telegram_id) {
    return Number(data.telegram_id)
  }

  const { data: fallbackOwner, error: fallbackError } = await adminSupabase!
    .from("users")
    .select("telegram_id")
    .eq("role", "owner")
    .not("telegram_id", "is", null)
    .limit(1)
    .maybeSingle()

  if (fallbackError || !fallbackOwner?.telegram_id) {
    throw new Error("Telegram ID owner tidak ditemukan untuk menjalankan adjustment balance.")
  }

  return Number(fallbackOwner.telegram_id)
}

async function findTargetUser(telegramId: number) {
  const { data, error } = await adminSupabase!
    .from("users")
    .select("id, username, telegram_id, role, balance, is_active")
    .eq("telegram_id", telegramId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error("User target tidak ditemukan.")

  return data
}

async function runBalanceRpc(action: "add" | "deduct", actorTelegramId: number, targetTelegramId: number, amount: number) {
  const rpcName = action === "add" ? "admin_add_balance" : "admin_reduce_balance"
  const { data, error } = await adminSupabase!.rpc(rpcName, {
    p_actor_telegram_id: actorTelegramId,
    p_target_telegram_id: targetTelegramId,
    p_amount: amount,
  })

  if (error) throw new Error(error.message)

  const result = firstRpcRow(data)
  if (!result.success) {
    throw new Error(result.message || "Adjustment balance gagal.")
  }

  return result
}

async function attachNoteToLatestLog(userId: string, note: string) {
  if (!note) return

  try {
    const { data: latestLog } = await adminSupabase!
      .from("balance_logs")
      .select("id, note")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!latestLog?.id) return

    const currentNote = typeof latestLog.note === "string" ? latestLog.note.trim() : ""
    const nextNote = currentNote ? `${currentNote}\n${note}` : note
    await adminSupabase!.from("balance_logs").update({ note: nextNote }).eq("id", latestLog.id)
  } catch (error) {
    console.error("attachNoteToLatestLog error:", error)
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  const usersPage = Math.max(1, readNumber(req.nextUrl.searchParams.get("usersPage"), 1))
  const logsPage = Math.max(1, readNumber(req.nextUrl.searchParams.get("logsPage"), 1))
  const pageSize = Math.min(50, Math.max(1, readNumber(req.nextUrl.searchParams.get("pageSize"), 10)))
  const usersFrom = (usersPage - 1) * pageSize
  const logsFrom = (logsPage - 1) * pageSize

  const [usersResult, logsResult, balanceResult] = await Promise.all([
    adminSupabase!
      .from("users")
      .select("id, username, telegram_id, role, balance, is_active", { count: "exact" })
      .order("balance", { ascending: false })
      .range(usersFrom, usersFrom + pageSize - 1),
    adminSupabase!
      .from("balance_logs")
      .select("id, amount, type, note, created_at, users(username, telegram_id)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(logsFrom, logsFrom + pageSize - 1),
    adminSupabase!.from("users").select("balance"),
  ])

  if (usersResult.error) return jsonError(usersResult.error.message, 500)
  if (logsResult.error) return jsonError(logsResult.error.message, 500)
  if (balanceResult.error) return jsonError(balanceResult.error.message, 500)

  const totalBalance = ((balanceResult.data || []) as { balance: number | null }[]).reduce(
    (total, user) => total + Number(user.balance || 0),
    0
  )

  return NextResponse.json({
    data: {
      users: usersResult.data || [],
      logs: logsResult.data || [],
      usersTotal: usersResult.count || 0,
      logsTotal: logsResult.count || 0,
      totalBalance,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  if (auth.role !== "owner") return jsonError("Hanya owner yang dapat mengubah balance.", 403)
  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.balance.write", limit: 12, windowSeconds: 60 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = readString(body.action)
    const targetTelegramId = readNumber(body.telegram_id)
    const amount = readNumberRange(body.amount, "Nominal", { min: 0, max: 100_000_000 })
    const note = readLimitedString(body.note, "Note", 500)

    if (!allowedActions.has(action)) return jsonError("Action balance tidak valid.")
    if (!targetTelegramId || targetTelegramId <= 0) return jsonError("Telegram ID target wajib valid.")
    if (action !== "reset" && amount <= 0) return jsonError("Nominal wajib lebih dari 0.")

    const actorTelegramId = await findOwnerTelegramId(auth.adminEmail)
    const targetUser = await findTargetUser(targetTelegramId)

    const finalAmount = action === "reset" ? Number(targetUser.balance || 0) : amount
    if (action === "reset" && finalAmount <= 0) {
      await writeAdminAuditLog(auth, {
        action: "reset",
        entity: "balance",
        entityId: targetUser.id,
        before: targetUser,
        after: targetUser,
        metadata: {
          targetTelegramId,
          amount: 0,
          note,
          noop: true,
        },
      })

      return NextResponse.json({
        data: {
          user: targetUser,
          result: { success: true, new_balance: Number(targetUser.balance || 0), message: "Saldo sudah 0." },
        },
      })
    }

    const result = await runBalanceRpc(
      action === "add" ? "add" : "deduct",
      actorTelegramId,
      targetTelegramId,
      finalAmount
    )
    await attachNoteToLatestLog(String(targetUser.id), note)
    const refreshedUser = await findTargetUser(targetTelegramId)

    await writeAdminAuditLog(auth, {
      action,
      entity: "balance",
      entityId: targetUser.id,
      before: targetUser,
      after: refreshedUser,
      metadata: {
        targetTelegramId,
        amount: finalAmount,
        note,
        rpcResult: result,
      },
    })

    return NextResponse.json({
      data: {
        user: refreshedUser,
        result,
      },
    })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Gagal mengubah balance", 400)
  }
}
