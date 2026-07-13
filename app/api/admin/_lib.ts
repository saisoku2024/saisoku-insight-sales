import { createClient } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

type AdminAuthResult =
  | {
      ok: true
      adminEmail: string
      role: "owner" | "admin"
    }
  | {
      ok: false
      response: NextResponse
    }

type AuditActor = {
  adminEmail: string
  role?: "owner" | "admin"
}

type AdminAuditLogInput = {
  action: string
  entity: string
  entityId?: string | number | null
  before?: unknown
  after?: unknown
  metadata?: Record<string, unknown> | null
  status?: "success" | "failed"
  error?: string | null
}

type RateLimitInput = {
  scope: string
  limit: number
  windowSeconds: number
}

type ErrorLogInput = {
  source: string
  level?: "error" | "warn" | "info"
  message: string
  stack?: string | null
  route?: string | null
  actor?: string | null
  metadata?: Record<string, unknown> | null
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SB_SERVICE_ROLE
const errorLogDrainUrl = normalizeDrainUrl(
  process.env.BETTER_STACK_INGESTING_HOST ||
  process.env.BETTER_STACK_ENDPOINT ||
  process.env.ERROR_LOG_DRAIN_URL ||
  process.env.LOGTAIL_INGEST_URL ||
  ""
)
const errorLogDrainToken =
  process.env.BETTER_STACK_SOURCE_TOKEN ||
  process.env.ERROR_LOG_DRAIN_TOKEN ||
  process.env.LOGTAIL_SOURCE_TOKEN ||
  ""

type ExternalErrorLogPayload = {
  source: string
  level: string
  message: string
  stack: string | null
  route: string | null
  actor: string | null
  metadata: unknown
}

export const adminSupabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function readLimitedString(value: unknown, field: string, maxLength: number) {
  const text = readString(value)
  if (text.length > maxLength) {
    throw new Error(`${field} maksimal ${maxLength} karakter.`)
  }
  return text
}

export function readNullableString(value: unknown) {
  const text = readString(value)
  return text ? text : null
}

export function readLimitedNullableString(value: unknown, field: string, maxLength: number) {
  const text = readLimitedString(value, field, maxLength)
  return text ? text : null
}

export function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return fallback
}

export function readNumberRange(
  value: unknown,
  field: string,
  options: { fallback?: number; min?: number; max?: number } = {}
) {
  const numberValue = readNumber(value, options.fallback ?? 0)
  if (options.min !== undefined && numberValue < options.min) {
    throw new Error(`${field} minimal ${options.min}.`)
  }
  if (options.max !== undefined && numberValue > options.max) {
    throw new Error(`${field} maksimal ${options.max}.`)
  }
  return numberValue
}

export function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null
}

export function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => readString(item)).filter(Boolean)
}

export function ownerOnly(role: "owner" | "admin", message = "Hanya owner yang dapat menjalankan aksi ini.") {
  return role === "owner" ? null : jsonError(message, 403)
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown"
  return req.headers.get("x-real-ip") || "unknown"
}

function rateLimitResponse(limit: number, windowSeconds: number, remainingSeconds: number) {
  return NextResponse.json(
    {
      error: `Terlalu banyak request. Maksimal ${limit} request per ${windowSeconds} detik.`,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, remainingSeconds)),
      },
    }
  )
}

function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactAuditValue(item))
  if (!value || typeof value !== "object") return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const lowerKey = key.toLowerCase()
      const shouldRedact =
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("key") ||
        lowerKey === "pin" ||
        lowerKey.includes("authorization")

      return [key, shouldRedact ? "[REDACTED]" : redactAuditValue(item)]
    })
  )
}

function truncateText(value: string | null | undefined, maxLength: number) {
  if (!value) return null
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}

function normalizeDrainUrl(value: string) {
  const text = value.trim()
  if (!text) return ""
  return /^https?:\/\//i.test(text) ? text : `https://${text}`
}

export function getErrorMessage(error: unknown, fallback = "Terjadi kesalahan") {
  return error instanceof Error ? error.message : fallback
}

export async function writeAdminAuditLog(actor: AuditActor, input: AdminAuditLogInput) {
  if (!adminSupabase) return

  try {
    await adminSupabase.from("admin_audit_logs").insert({
      admin_email: actor.adminEmail,
      admin_role: actor.role || "admin",
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
      before_data: input.before === undefined ? null : redactAuditValue(input.before),
      after_data: input.after === undefined ? null : redactAuditValue(input.after),
      metadata: input.metadata ? redactAuditValue(input.metadata) : null,
      status: input.status || "success",
      error: input.error || null,
    })
  } catch (error) {
    console.error("writeAdminAuditLog error:", error)
  }
}

export async function writeErrorLog(input: ErrorLogInput) {
  if (!adminSupabase) return

  const payload = {
    source: truncateText(input.source, 120) || "web",
    level: input.level || "error",
    message: truncateText(input.message, 500) || "Unknown error",
    stack: truncateText(input.stack, 2000),
    route: truncateText(input.route, 240),
    actor: truncateText(input.actor, 240),
    metadata: input.metadata ? redactAuditValue(input.metadata) : null,
  }

  try {
    await adminSupabase.from("error_logs").insert(payload)
  } catch (error) {
    console.error("writeErrorLog error:", error)
  }

  if (!errorLogDrainUrl) return

  try {
    const drainResult = await sendExternalErrorLog(payload)
    if (!drainResult.ok) {
      console.error("external error log drain rejected:", drainResult.status, drainResult.body)
    }
  } catch (error) {
    console.error("external error log drain failed:", error)
  }
}

export function getExternalErrorLogDrainStatus() {
  return {
    configured: Boolean(errorLogDrainUrl && errorLogDrainToken),
    hasUrl: Boolean(errorLogDrainUrl),
    hasToken: Boolean(errorLogDrainToken),
    urlHost: errorLogDrainUrl ? new URL(errorLogDrainUrl).host : null,
  }
}

export async function sendExternalErrorLog(payload: ExternalErrorLogPayload) {
  if (!errorLogDrainUrl) {
    return { ok: false, status: 0, body: "Missing error log drain URL" }
  }

  if (!errorLogDrainToken) {
    return { ok: false, status: 0, body: "Missing error log drain token" }
  }

  const response = await fetch(errorLogDrainUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${errorLogDrainToken}`,
    },
    body: JSON.stringify({
      ...payload,
      service: "saisoku-insight-sales",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      dt: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(2500),
  })

  const body = await response.text().catch(() => "")
  return {
    ok: response.ok,
    status: response.status,
    body: truncateText(body, 500),
  }
}

export async function writeRouteErrorLog(req: NextRequest, actor: AuditActor | null, route: string, error: unknown, metadata?: Record<string, unknown>) {
  await writeErrorLog({
    source: "web-api",
    level: "error",
    message: getErrorMessage(error),
    stack: error instanceof Error ? error.stack || null : null,
    route,
    actor: actor?.adminEmail || null,
    metadata: {
      method: req.method,
      url: req.nextUrl.pathname,
      ...metadata,
    },
  })
}

export async function jsonRouteError(
  req: NextRequest,
  actor: AuditActor | null,
  route: string,
  error: unknown,
  fallback: string,
  status = 400,
  metadata?: Record<string, unknown>
) {
  await writeRouteErrorLog(req, actor, route, error, { status, ...metadata })
  return jsonError(getErrorMessage(error, fallback), status)
}

export async function enforceAdminRateLimit(
  req: NextRequest,
  actor: AuditActor | null,
  input: RateLimitInput
) {
  if (!adminSupabase) return null

  const actorKey = actor?.adminEmail || getClientIp(req)
  const key = `${input.scope}:${actorKey}`.slice(0, 240)
  const now = new Date()

  try {
    const { data, error } = await adminSupabase
      .from("api_rate_limits")
      .select("key, count, window_start")
      .eq("key", key)
      .maybeSingle()

    if (error) throw error

    const windowStart = data?.window_start ? new Date(String(data.window_start)) : null
    const elapsedSeconds = windowStart ? Math.floor((now.getTime() - windowStart.getTime()) / 1000) : input.windowSeconds + 1
    const isInsideWindow = windowStart && elapsedSeconds < input.windowSeconds

    if (data && isInsideWindow) {
      const currentCount = Number(data.count || 0)
      if (currentCount >= input.limit) {
        return rateLimitResponse(input.limit, input.windowSeconds, input.windowSeconds - elapsedSeconds)
      }

      const { error: updateError } = await adminSupabase
        .from("api_rate_limits")
        .update({
          count: currentCount + 1,
          updated_at: now.toISOString(),
        })
        .eq("key", key)

      if (updateError) throw updateError
      return null
    }

    const { error: upsertError } = await adminSupabase
      .from("api_rate_limits")
      .upsert({
        key,
        scope: input.scope,
        actor: actorKey,
        count: 1,
        window_start: now.toISOString(),
        updated_at: now.toISOString(),
      })

    if (upsertError) throw upsertError
  } catch (error) {
    console.error("enforceAdminRateLimit error:", error)
  }

  return null
}

export async function requireActiveAdmin(req: NextRequest): Promise<AdminAuthResult> {
  if (!supabaseUrl || !supabaseAnonKey || !adminSupabase) {
    return {
      ok: false,
      response: jsonError(
        "Missing server env. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
        500
      ),
    }
  }

  const authHeader = req.headers.get("authorization") || ""
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""

  if (!token) {
    return { ok: false, response: jsonError("Unauthorized", 401) }
  }

  const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  })

  const { data: userData, error: userError } = await userSupabase.auth.getUser(token)
  if (userError || !userData.user) {
    return { ok: false, response: jsonError("Invalid session", 401) }
  }

  const { data: profileData, error: profileError } = await userSupabase.rpc("get_admin_profile")
  const profile = Array.isArray(profileData) ? profileData[0] : null

  if (profileError || !profile?.is_active || !["owner", "admin"].includes(String(profile.role))) {
    return { ok: false, response: jsonError("Akses ditolak. Admin aktif diperlukan.", 403) }
  }

  return {
    ok: true,
    adminEmail: userData.user.email || profile.email || "admin",
    role: String(profile.role) === "owner" ? "owner" : "admin",
  }
}
