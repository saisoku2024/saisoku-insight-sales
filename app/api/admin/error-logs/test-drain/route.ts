import { NextResponse, type NextRequest } from "next/server"

import {
  enforceAdminRateLimit,
  getExternalErrorLogDrainStatus,
  requireActiveAdmin,
  sendExternalErrorLog,
  writeErrorLog,
} from "../../_lib"

export async function POST(req: NextRequest) {
  const auth = await requireActiveAdmin(req)
  if (!auth.ok) return auth.response

  const rateLimited = await enforceAdminRateLimit(req, auth, {
    scope: "admin.error_logs.test_drain",
    limit: 5,
    windowSeconds: 60,
  })
  if (rateLimited) return rateLimited

  const drainStatus = getExternalErrorLogDrainStatus()
  const testId = `better-stack-test-${Date.now()}`
  const payload = {
    source: "web-api",
    level: "info" as const,
    message: `Better Stack drain test ${testId}`,
    stack: null,
    route: "POST /api/admin/error-logs/test-drain",
    actor: auth.adminEmail,
    metadata: { testId },
  }

  await writeErrorLog(payload)
  const drainResult = await sendExternalErrorLog(payload)

  return NextResponse.json({
    data: {
      testId,
      drain: {
        ...drainStatus,
        result: drainResult,
      },
    },
  })
}
