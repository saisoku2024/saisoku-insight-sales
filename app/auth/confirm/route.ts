import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const tokenHash = requestUrl.searchParams.get("token_hash")
  const type = requestUrl.searchParams.get("type")
  const next = requestUrl.searchParams.get("next")
  const redirectPath = next?.startsWith("/") ? next : "/auth/update-password"
  const redirectUrl = new URL(redirectPath, requestUrl.origin)

  if (tokenHash) redirectUrl.searchParams.set("token_hash", tokenHash)
  if (type) redirectUrl.searchParams.set("type", type)

  return NextResponse.redirect(redirectUrl)
}
