"use client"

import { supabase } from "@/lib/supabase/client"

type AccessEventInput = {
  eventType: "login_success" | "page_view"
  path?: string
  metadata?: Record<string, unknown>
}

export async function recordPanelAccessEvent(input: AccessEventInput) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) return

    await fetch("/api/admin/access-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        eventType: input.eventType,
        path: input.path || window.location.pathname,
        metadata: input.metadata || {},
      }),
      keepalive: true,
    })
  } catch (error) {
    console.error("recordPanelAccessEvent error:", error)
  }
}
