import { gzipSync } from "node:zlib"
import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  jsonError,
  readNumber,
  readString,
  requireActiveAdmin,
} from "../_lib"

export const runtime = "nodejs"
export const maxDuration = 60

const backupBucket = process.env.SAISOKU_BACKUP_BUCKET || "saisoku-backups"

const fullTables = [
  "users",
  "products",
  "product_accounts",
  "sold_accounts",
  "transactions",
  "pending_orders",
  "deposit_requests",
  "balance_logs",
  "vouchers",
  "voucher_claims",
  "loyalty_settings",
  "tickets",
  "ticket_replies",
  "ticket_sessions",
  "warranty_sessions",
  "search_sessions",
  "upload_sessions",
  "upload_stock_session",
  "user_states",
  "users_profile",
  "debug_webhook_logs",
]

const criticalTables = [
  "users",
  "transactions",
  "product_accounts",
  "sold_accounts",
  "deposit_requests",
  "balance_logs",
  "vouchers",
  "voucher_claims",
  "loyalty_settings",
  "tickets",
  "ticket_replies",
]

type BackupMode = "critical" | "full"

function backupMode(value: string): BackupMode {
  return value === "full" ? "full" : "critical"
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, "-")
}

function cronAuthorized(req: NextRequest) {
  const cronSecret = process.env.BACKUP_CRON_SECRET
  if (!cronSecret) return false

  const authHeader = req.headers.get("authorization") || ""
  return authHeader === `Bearer ${cronSecret}`
}

async function ensureBackupBucket() {
  const { data: buckets, error: listError } = await adminSupabase!.storage.listBuckets()
  if (listError) throw new Error(listError.message)

  if (buckets?.some((bucket) => bucket.name === backupBucket)) return

  const { error } = await adminSupabase!.storage.createBucket(backupBucket, {
    public: false,
    fileSizeLimit: "50MB",
  })
  if (error) throw new Error(error.message)
}

async function exportTable(table: string, batchSize = 1000) {
  let from = 0
  let rowsCount = 0
  let totalCount = 0
  const rows: Record<string, unknown>[] = []

  while (true) {
    const to = from + batchSize - 1
    const { data, error, count } = await adminSupabase!
      .from(table)
      .select("*", { count: from === 0 ? "exact" : undefined })
      .range(from, to)

    if (error) throw new Error(`${table}: ${error.message}`)
    if (from === 0) totalCount = count || 0

    const batch = (data || []) as Record<string, unknown>[]
    rows.push(...batch)
    rowsCount += batch.length

    if (batch.length < batchSize) break
    from += batchSize
  }

  return {
    rows,
    manifest: {
      table,
      rows: rowsCount,
      total: totalCount,
    },
  }
}

async function createBackupRun(mode: BackupMode, triggeredBy: string) {
  const { data, error } = await adminSupabase!
    .from("backup_runs")
    .insert({
      mode,
      status: "running",
      triggered_by: triggeredBy,
      storage_bucket: backupBucket,
    })
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return String(data.id)
}

async function finishBackupRun(
  id: string,
  update: {
    status: "success" | "failed"
    storage_path?: string
    tables_count?: number
    rows_count?: number
    manifest?: Record<string, unknown>
    error?: string
  }
) {
  await adminSupabase!
    .from("backup_runs")
    .update({
      ...update,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id)
}

async function runBackup(mode: BackupMode, triggeredBy: string) {
  if (!adminSupabase) throw new Error("Missing service role client")

  await ensureBackupBucket()
  const runId = await createBackupRun(mode, triggeredBy)
  const tables = mode === "full" ? fullTables : criticalTables
  const tableData: Record<string, unknown[]> = {}
  const tableManifests: Array<Record<string, unknown>> = []
  const errors: Array<Record<string, string>> = []

  try {
    for (const table of tables) {
      try {
        const result = await exportTable(table)
        tableData[table] = result.rows
        tableManifests.push(result.manifest)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push({ table, error: message })
      }
    }

    const rowsCount = tableManifests.reduce((total, item) => total + Number(item.rows || 0), 0)
    const manifest = {
      backup_run_id: runId,
      mode,
      triggered_by: triggeredBy,
      created_at: new Date().toISOString(),
      tables: tableManifests,
      errors,
    }
    const payload = {
      manifest,
      tables: tableData,
    }
    const storagePath = `${mode}/${timestampId()}-${runId}.json.gz`
    const body = gzipSync(Buffer.from(JSON.stringify(payload)))
    const { error: uploadError } = await adminSupabase!.storage
      .from(backupBucket)
      .upload(storagePath, body, {
        contentType: "application/gzip",
        upsert: false,
      })

    if (uploadError) throw new Error(uploadError.message)

    await finishBackupRun(runId, {
      status: errors.length ? "failed" : "success",
      storage_path: storagePath,
      tables_count: tableManifests.length,
      rows_count: rowsCount,
      manifest,
      error: errors.length ? `Backup completed with ${errors.length} table error(s).` : undefined,
    })

    return {
      id: runId,
      mode,
      status: errors.length ? "failed" : "success",
      storage_bucket: backupBucket,
      storage_path: storagePath,
      tables_count: tableManifests.length,
      rows_count: rowsCount,
      errors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup gagal"
    await finishBackupRun(runId, {
      status: "failed",
      error: message,
      manifest: { mode, triggered_by: triggeredBy, errors },
    })
    throw error
  }
}

export async function GET(req: NextRequest) {
  if (cronAuthorized(req)) {
    const mode = backupMode(readString(req.nextUrl.searchParams.get("mode")))
    try {
      const data = await runBackup(mode, "vercel-cron")
      return NextResponse.json({ data })
    } catch (error) {
      return jsonError(error instanceof Error ? error.message : "Auto backup gagal", 500)
    }
  }

  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  if (auth.role !== "owner") return jsonError("Hanya owner yang dapat melihat backup.", 403)

  const page = Math.max(1, readNumber(req.nextUrl.searchParams.get("page"), 1))
  const pageSize = Math.min(50, Math.max(1, readNumber(req.nextUrl.searchParams.get("pageSize"), 10)))
  const from = (page - 1) * pageSize

  const { data, error, count } = await adminSupabase!
    .from("backup_runs")
    .select("id, mode, status, triggered_by, storage_bucket, storage_path, tables_count, rows_count, error, created_at, finished_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1)

  if (error) return jsonError(error.message, 500)

  return NextResponse.json({
    data: {
      runs: data || [],
      totalRows: count || 0,
    },
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  if (auth.role !== "owner") return jsonError("Hanya owner yang dapat menjalankan backup.", 403)

  try {
    const body = (await req.json()) as Record<string, unknown>
    const mode = backupMode(readString(body.mode))
    const data = await runBackup(mode, auth.adminEmail)
    return NextResponse.json({ data })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Backup gagal", 500)
  }
}
