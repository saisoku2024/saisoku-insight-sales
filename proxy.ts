import { NextResponse, type NextRequest } from "next/server"

const WINDOW_MS = 60_000
const PUBLIC_AUTH_LIMIT = 60
const buckets = new Map<string, { count: number; resetAt: number }>()

function getClientKey(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = req.headers.get("x-real-ip")?.trim()
  const ip = forwardedFor || realIp || "unknown"
  return `${ip}:${req.nextUrl.pathname}`
}

function rateLimited(req: NextRequest) {
  const now = Date.now()
  const key = getClientKey(req)
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return null
  }

  bucket.count += 1
  if (bucket.count <= PUBLIC_AUTH_LIMIT) return null

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(PUBLIC_AUTH_LIMIT),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
      },
    }
  )
}

export function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (pathname === "/login" || pathname.startsWith("/auth/")) {
    const limited = rateLimited(req)
    if (limited) return limited
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/login", "/auth/:path*"],
}
