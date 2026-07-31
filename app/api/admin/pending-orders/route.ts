import { NextRequest, NextResponse } from "next/server";
import { adminSupabase, requireActiveAdmin } from "../_lib";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireActiveAdmin(req);
    if (!authResult.ok) return authResult.response;

    if (!adminSupabase) {
      return NextResponse.json({ error: "Supabase admin not initialized" }, { status: 500 });
    }

    const { data: pendingOrders, error } = await adminSupabase
      .from("pending_orders")
      .select(`
        *,
        products (name, product_code),
        users (telegram_id, username, role)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("GET pending_orders error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ pending_orders: pendingOrders || [] });
  } catch (err: any) {
    console.error("GET pending_orders catch error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireActiveAdmin(req);
    if (!authResult.ok) return authResult.response;

    if (!adminSupabase) {
      return NextResponse.json({ error: "Supabase admin not initialized" }, { status: 500 });
    }

    const body = await req.json();
    const { action, order_id, telegram_id } = body;

    if (!order_id || !action) {
      return NextResponse.json({ error: "Missing order_id or action" }, { status: 400 });
    }

    const actorId = telegram_id ? Number(telegram_id) : 72246533; // Default to owner telegram ID

    if (action === "approve") {
      const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("approve_pending_order", {
        p_order_id: order_id,
        p_actor_telegram_id: actorId,
      });

      if (rpcErr) {
        console.error("RPC approve_pending_order error:", rpcErr);
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      const result = rpcRes?.[0];
      if (!result?.success) {
        return NextResponse.json({ error: result?.message || "Approve failed" }, { status: 400 });
      }

      return NextResponse.json({ success: true, result });
    } else if (action === "reject") {
      const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("reject_order_atomic", {
        p_order_id: order_id,
        p_actor_telegram_id: actorId,
      });

      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, result: rpcRes?.[0] });
    } else if (action === "delete") {
      const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("delete_order_atomic", {
        p_order_id: order_id,
        p_actor_telegram_id: actorId,
        p_reason: "Deleted from Web Admin Panel",
      });

      if (rpcErr) {
        return NextResponse.json({ error: rpcErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, result: rpcRes?.[0] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("POST pending-orders catch error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
