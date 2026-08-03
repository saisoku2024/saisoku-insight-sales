import { NextResponse } from "next/server"

export async function GET() {
  const email = process.env.GUEST_EMAIL || "guest@ssidmail.my.id"
  const password = process.env.GUEST_PASSWORD || "guestonly123"
  
  return NextResponse.json({ email, password })
}
