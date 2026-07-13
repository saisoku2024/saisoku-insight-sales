import { gunzipSync } from "node:zlib"
import { NextResponse, type NextRequest } from "next/server"

import {
  adminSupabase,
  enforceAdminRateLimit,
  jsonError,
  readString,
  readStringArray,
  requireActiveAdmin,
  writeAdminAuditLog,
  writeRouteErrorLog,
} from "../../_lib"

export const runtime = "nodejs"
export const maxDuration = 60

const backupBucket = process.env.SAISOKU_BACKUP_BUCKET || "saisoku-backups"
const confirmationPhrase = "RESTORE SAISOKU"
const batchSize = 250

type BackupPayload = {
  manifest?: {
    backup_run_id?: string
    mode?: string
    created_at?: string
    tables?: Array<{ table?: string; rows?: number; total?: number }>
    errors?: Array<Record<string, unknown>>
  }
  tables?: Record<string, Array<Record<string, unknown>>>
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function sanitizeTables(value: unknown) {
  return readStringArray(value)
    .map((table) => table.replace(/[^a-zA-Z0-9_]/g, ""))
    .filter(Boolean)
    .slice(0, 30)
}

async function readBackupPayload(runId: string) {
  const { data: run, error: runError } = await adminSupabase!
    .from("backup_runs")
    .select("id, mode, status, storage_bucket, storage_path, rows_count, tables_count, created_at")
    .eq("id", runId)
    .single()

  if (runError) throw new Error(runError.message)
  if (!run?.storage_path) throw new Error("Backup ini belum punya storage path.")
  if (run.status !== "success") throw new Error("Hanya backup dengan status success yang bisa direstore.")

  const bucket = String(run.storage_bucket || backupBucket)
  const { data: blob, error: downloadError } = await adminSupabase!.storage
    .from(bucket)
    .download(String(run.storage_path))

  if (downloadError) throw new Error(downloadError.message)

  const buffer = Buffer.from(await blob.arrayBuffer())
  const json = gunzipSync(buffer).toString("utf8")
  const payload = JSON.parse(json) as BackupPayload

  if (!isObjectRecord(payload) || !isObjectRecord(payload.tables)) {
    throw new Error("Format backup tidak valid.")
  }

  return { run, payload }
}

function buildPreview(payload: BackupPayload) {
  const tablePayload = payload.tables || {}
  const manifestTables = Array.isArray(payload.manifest?.tables) ? payload.manifest.tables : []
  const manifestMap = new Map(manifestTables.map((item) => [String(item.table || ""), item]))

  return Object.entries(tablePayload)
    .map(([table, rows]) => ({
      table,
      rows: Array.isArray(rows) ? rows.length : 0,
      manifestRows: Number(manifestMap.get(table)?.rows || 0),
    }))
    .sort((a, b) => a.table.localeCompare(b.table))
}

async function upsertTable(table: string, rows: Array<Record<string, unknown>>) {
  let restored = 0
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize)
    if (!batch.length) continue

    const { error } = await adminSupabase!.from(table).upsert(batch)
    if (error) throw new Error(`${table}: ${error.message}`)
    restored += batch.length
  }

  return restored
}

async function runPreRestoreBackup(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || ""
  const response = await fetch(new URL("/api/admin/backups", req.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({ mode: "critical" }),
  })
  const result = (await response.json()) as { data?: { id?: string }; error?: string }
  if (!response.ok) {
    throw new Error(result.error || "Pre-restore backup gagal.")
  }
  return result.data?.id || null
}

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response
  if (auth.role !== "owner") return jsonError("Hanya owner yang dapat menjalankan restore.", 403)

  const rateLimited = await enforceAdminRateLimit(req, auth, { scope: "admin.backups.restore", limit: 5, windowSeconds: 3600 })
  if (rateLimited) return rateLimited

  try {
    const body = (await req.json()) as Record<string, unknown>
    const runId = readString(body.runId)
    const action = readString(body.action) || "preview"
    const requestedTables = sanitizeTables(body.tables)

    if (!runId) throw new Error("Backup run ID wajib diisi.")
    if (!["preview", "append"].includes(action)) throw new Error("Action restore tidak valid.")

    const { run, payload } = await readBackupPayload(runId)
    const preview = buildPreview(payload)
    const availableTables = new Set(preview.map((item) => item.table))

    if (action === "preview") {
      return NextResponse.json({
        data: {
          run,
          manifest: payload.manifest || null,
          tables: preview,
          confirmationPhrase,
          allowedModes: ["preview", "append"],
        },
      })
    }

    const confirmation = readString(body.confirmation)
    if (confirmation !== confirmationPhrase) {
      throw new Error(`Ketik "${confirmationPhrase}" untuk menjalankan restore append.`)
    }

    const tables = (requestedTables.length ? requestedTables : preview.map((item) => item.table))
      .filter((table) => availableTables.has(table))

    if (!tables.length) throw new Error("Tidak ada tabel valid untuk restore.")

    const preRestoreBackupId = await runPreRestoreBackup(req)
    const restoredTables: Array<{ table: string; rows: number }> = []
    const errors: Array<{ table: string; error: string }> = []

    for (const table of tables) {
      try {
        const rows = payload.tables?.[table] || []
        const restored = await upsertTable(table, rows)
        restoredTables.push({ table, rows: restored })
      } catch (error) {
        errors.push({ table, error: error instanceof Error ? error.message : String(error) })
      }
    }

    const restoredRows = restoredTables.reduce((total, item) => total + item.rows, 0)
    const status = errors.length ? "failed" : "success"

    await writeAdminAuditLog(auth, {
      action: "append_restore",
      entity: "backup_runs",
      entityId: runId,
      after: {
        restoredTables,
        restoredRows,
        errors,
      },
      metadata: {
        sourceBackupRunId: runId,
        preRestoreBackupId,
        mode: "append",
      },
      status,
      error: errors.length ? `Restore completed with ${errors.length} table error(s).` : null,
    })

    return NextResponse.json({
      data: {
        ok: errors.length === 0,
        mode: "append",
        sourceBackupRunId: runId,
        preRestoreBackupId,
        restoredTables,
        restoredRows,
        errors,
      },
    })
  } catch (error) {
    await writeRouteErrorLog(req, auth, "POST /api/admin/backups/restore", error)
    return jsonError(error instanceof Error ? error.message : "Restore gagal.", 500)
  }
}
