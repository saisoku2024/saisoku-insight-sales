import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  jsonRouteError,
  ownerOnly,
  readString,
  requireActiveAdmin,
  writeAdminAuditLog,
} from "../_lib"

export const runtime = "nodejs"
export const maxDuration = 60

const confirmationPhrase = "RESET HISTORY"

const resetTables = [
  { table: "ticket_replies", key: "id" },
  { table: "tickets", key: "id" },
  { table: "warranty_sessions", key: "telegram_id" },
  { table: "ticket_sessions", key: "telegram_id" },
  { table: "search_sessions", key: "telegram_id" },
  { table: "sold_accounts", key: "id" },
  { table: "pending_orders", key: "id" },
  { table: "transactions", key: "id" },
] as const

type StockCleanupMode = "keep" | "return_available" | "soft_delete"

function stockCleanupMode(value: string): StockCleanupMode {
  if (value === "return_available" || value === "soft_delete") return value
  return "keep"
}

async function countTable(table: string) {
  const { count, error } = await adminSupabase!
    .from(table)
    .select("*", { count: "exact", head: true })

  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function countStockCleanupCandidates() {
  const { count, error } = await adminSupabase!
    .from("product_accounts")
    .select("*", { count: "exact", head: true })
    .in("status", ["sold", "reserved"])

  if (error) throw new Error(`product_accounts: ${error.message}`)
  return count || 0
}

async function previewReset() {
  const tables = []
  for (const item of resetTables) {
    tables.push({
      table: item.table,
      rows: await countTable(item.table),
    })
  }

  return {
    confirmationPhrase,
    tables,
    totalRows: tables.reduce((total, item) => total + item.rows, 0),
    stockCleanupCandidates: await countStockCleanupCandidates(),
    stockCleanupModes: ["keep", "return_available", "soft_delete"] as StockCleanupMode[],
    warnings: [
      "Order aktif, refund calculator, ticket dummy, revenue, dan loyalty berbasis transaksi akan reset.",
      "Users, products, stock available, vouchers, balance, backup runs, dan audit logs tidak dihapus.",
      "Sistem wajib membuat full backup sukses sebelum reset dieksekusi.",
    ],
  }
}

async function runPreResetBackup(req: NextRequest) {
  const authorization = req.headers.get("authorization") || ""
  const response = await fetch(new URL("/api/admin/backups", req.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
    },
    body: JSON.stringify({ mode: "full" }),
  })
  const result = (await response.json()) as {
    data?: {
      id: string
      status: "success" | "failed"
      storage_path?: string | null
      rows_count?: number | null
      errors?: Array<Record<string, unknown>>
    }
    error?: string
  }

  if (!response.ok || !result.data || result.data.status !== "success") {
    throw new Error(result.error || "Pre-reset full backup gagal. Reset dibatalkan.")
  }

  return result.data
}

async function deleteAllFrom(table: string, key: string) {
  const { count, error } = await adminSupabase!
    .from(table)
    .delete({ count: "exact" })
    .not(key, "is", null)

  if (error) throw new Error(`${table}: ${error.message}`)
  return count || 0
}

async function cleanupStock(mode: StockCleanupMode) {
  if (mode === "keep") return { mode, affectedRows: 0 }

  const nextStatus = mode === "return_available" ? "available" : "deleted"
  const { count, error } = await adminSupabase!
    .from("product_accounts")
    .update({ status: nextStatus }, { count: "exact" })
    .in("status", ["sold", "reserved"])

  if (error) throw new Error(`product_accounts cleanup: ${error.message}`)
  return { mode, affectedRows: count || 0, nextStatus }
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  const ownerError = ownerOnly(auth.role, "Hanya owner yang dapat reset history transaksi.")
  if (ownerError) return ownerError

  const rateLimited = await enforceAdminRateLimit(req, auth, {
    scope: "admin.history_reset",
    limit: 5,
    windowSeconds: 3600,
  })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const action = readString(body.action) || "preview"
    const stockMode = stockCleanupMode(readString(body.stockCleanupMode))

    if (action === "preview") {
      return NextResponse.json({ data: await previewReset() })
    }

    if (action !== "reset") {
      return jsonError("Action reset history tidak valid.")
    }

    const confirmation = readString(body.confirmation)
    if (confirmation !== confirmationPhrase) {
      return jsonError(`Konfirmasi wajib mengetik ${confirmationPhrase}.`, 400)
    }

    const before = await previewReset()
    const backup = await runPreResetBackup(req)
    const deletedTables = []

    for (const item of resetTables) {
      deletedTables.push({
        table: item.table,
        rows: await deleteAllFrom(item.table, item.key),
      })
    }

    const stockCleanup = await cleanupStock(stockMode)
    const deletedRows = deletedTables.reduce((total, item) => total + item.rows, 0)

    const data = {
      ok: true,
      backup,
      deletedTables,
      deletedRows,
      stockCleanup,
    }

    await writeAdminAuditLog(auth, {
      action: "reset_history",
      entity: "transactions",
      before,
      after: data,
      metadata: {
        confirmation,
        stockCleanupMode: stockMode,
        backupRunId: backup.id,
        backupStoragePath: backup.storage_path || null,
      },
    })

    return NextResponse.json({ data })
  } catch (error) {
    return jsonRouteError(req, auth, "POST /api/admin/history-reset", error, "Reset history gagal.", 500)
  }
}
