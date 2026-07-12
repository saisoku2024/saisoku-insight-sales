import { createClient } from "@supabase/supabase-js"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import process from "node:process"

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

function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    mode: "full",
    out: process.env.SAISOKU_BACKUP_DIR || path.resolve("..", "SAISOKU_BACKUPS", "data"),
    batchSize: 1000,
    retentionDays: 30,
    check: false,
  }

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === "--mode") options.mode = args[++i] || options.mode
    else if (arg === "--out") options.out = args[++i] || options.out
    else if (arg === "--batch-size") options.batchSize = Number(args[++i] || options.batchSize)
    else if (arg === "--retention-days") options.retentionDays = Number(args[++i] || options.retentionDays)
    else if (arg === "--check") options.check = true
  }

  if (!["full", "critical"].includes(options.mode)) {
    throw new Error("Invalid --mode. Use full or critical.")
  }

  return options
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return

  const content = readFileSync(filePath, "utf8")
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const key = match[1]
    const value = match[2].replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = value
  }
}

function loadEnv() {
  const explicitEnv = process.env.SAISOKU_BACKUP_ENV
  if (explicitEnv) loadEnvFile(path.resolve(explicitEnv))
  loadEnvFile(path.resolve(".env.backup.local"))
  loadEnvFile(path.resolve(".env.local"))
}

function getGitCommit(repoPath) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoPath, encoding: "utf8" }).trim()
  } catch {
    return null
  }
}

function getTimestamp() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const hh = String(now.getHours()).padStart(2, "0")
  const min = String(now.getMinutes()).padStart(2, "0")
  const sec = String(now.getSeconds()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}_${hh}-${min}-${sec}`
}

async function exportTable(supabase, table, outDir, batchSize) {
  let from = 0
  let rowCount = 0
  let totalCount = null
  const rows = []

  while (true) {
    const to = from + batchSize - 1
    const query = supabase.from(table).select("*", {
      count: from === 0 ? "exact" : undefined,
    }).range(from, to)

    const { data, error, count } = await query
    if (error) throw new Error(`${table}: ${error.message}`)

    if (from === 0 && typeof count === "number") totalCount = count
    const batch = data || []
    rows.push(...batch)
    rowCount += batch.length

    if (batch.length < batchSize) break
    from += batchSize
  }

  writeFileSync(path.join(outDir, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`, "utf8")

  return {
    table,
    rows: rowCount,
    total: totalCount,
    file: `${table}.json`,
  }
}

function cleanupRetention(rootDir, retentionDays) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0 || !existsSync(rootDir)) return []

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  const removed = []

  for (const name of readdirSync(rootDir)) {
    if (!/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/.test(name)) continue

    const stamp = name.replace("_", "T").replace(/-(\d{2})-(\d{2})$/, ":$1:$2")
    const time = new Date(stamp).getTime()
    if (!Number.isFinite(time) || time >= cutoff) continue

    const target = path.join(rootDir, name)
    rmSync(target, { recursive: true, force: true })
    removed.push(name)
  }

  return removed
}

async function main() {
  loadEnv()
  const options = parseArgs()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || process.env.SB_SERVICE_ROLE

  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.")
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Put it in .env.backup.local or environment variables.")

  const tables = options.mode === "critical" ? criticalTables : fullTables
  const rootOut = path.resolve(options.out)

  if (options.check) {
    console.log(JSON.stringify({
      ok: true,
      mode: options.mode,
      tables,
      output: rootOut,
      hasServiceRoleKey: Boolean(serviceRoleKey),
    }, null, 2))
    return
  }

  const backupId = getTimestamp()
  const outDir = path.join(rootOut, backupId)
  mkdirSync(outDir, { recursive: true })

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const manifest = {
    backup_id: backupId,
    mode: options.mode,
    created_at: new Date().toISOString(),
    supabase_url: supabaseUrl,
    output_dir: outDir,
    commits: {
      web: getGitCommit(process.cwd()),
      bot: getGitCommit(path.resolve("..", "saisoku-bot-sales")),
    },
    tables: [],
    errors: [],
    retention_removed: [],
  }

  for (const table of tables) {
    try {
      const result = await exportTable(supabase, table, outDir, options.batchSize)
      manifest.tables.push(result)
      console.log(`OK ${table}: ${result.rows} rows`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      manifest.errors.push({ table, error: message })
      console.error(`ERR ${message}`)
    }
  }

  manifest.retention_removed = cleanupRetention(rootOut, options.retentionDays)
  writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  if (manifest.errors.length) {
    process.exitCode = 1
  }

  console.log(`Backup written to ${outDir}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
