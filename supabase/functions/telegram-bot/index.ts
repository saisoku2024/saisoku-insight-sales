export const config = {
  verify_jwt: false,
};

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SB_URL")!,
  Deno.env.get("SB_SERVICE_ROLE")!
);

serve(async (req) => {
	//TELEGRAM_WEBHOOK_SECRET
  try {
    const body = await req.json();
    const message = body.message;
    const callback = body.callback_query;

    if (!message && !callback) return new Response("ok");

    const msg = message || callback.message;
    const chatId = msg.chat.id;
    const telegramId = (message?.from?.id || callback?.from?.id) as number;
    const username =
      message?.from?.username || callback?.from?.username || null;
    const text = message?.text;

    // ===============================
    // AUTO REGISTER USER
    // ===============================

    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", telegramId)
      .single();

    if (!user) {
      const { data: newUser } = await supabase
        .from("users")
        .insert({
          telegram_id: telegramId,
          username: username,
          role: "reguler",
          balance: 0,
        })
        .select()
        .single();

      user = newUser;
    }

    const userRole = user.role;

    // ===============================
    // COMMAND /setrole
    // ===============================

    if (text?.startsWith("/setrole")) {
      if (userRole !== "owner") {
        await fetch(
          `https://api.telegram.org/bot${Deno.env.get(
            "TELEGRAM_BOT_TOKEN"
          )}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "❌ Hanya OWNER yang bisa mengubah role user.",
            }),
          }
        );
        return new Response("ok");
      }

      const parts = text.split(" ");

      if (parts.length < 3) {
        await fetch(
          `https://api.telegram.org/bot${Deno.env.get(
            "TELEGRAM_BOT_TOKEN"
          )}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "Format:\n/setrole <telegram_id> <reguler|reseller|admin|owner>",
            }),
          }
        );
        return new Response("ok");
      }

      const targetTelegramId = Number(parts[1]);
      const newRole = parts[2].toLowerCase();

      if (!["reguler", "reseller", "admin", "owner"].includes(newRole)) {
        await fetch(
          `https://api.telegram.org/bot${Deno.env.get(
            "TELEGRAM_BOT_TOKEN"
          )}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "Role tidak valid.",
            }),
          }
        );
        return new Response("ok");
      }

      await supabase
        .from("users")
        .update({ role: newRole })
        .eq("telegram_id", targetTelegramId);

      await fetch(
        `https://api.telegram.org/bot${Deno.env.get(
          "TELEGRAM_BOT_TOKEN"
        )}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ Role user berhasil diubah menjadi ${newRole}`,
          }),
        }
      );

      return new Response("ok");
    }

    // ===============================
    // START COMMAND
    // ===============================

    if (text === "/start") {
      const { count: totalUsers } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true });

      const { data: trxPaid } = await supabase
        .from("transactions")
        .select("price")
        .eq("status", "paid");

      const revenueSum =
        trxPaid?.reduce((sum, trx) => sum + trx.price, 0) || 0;

      const { data: userTrx } = await supabase
        .from("transactions")
        .select("price")
        .eq("user_id", user.id)
        .eq("status", "paid");

      const totalBuy = userTrx?.length || 0;
      const totalSpent =
        userTrx?.reduce((sum, trx) => sum + trx.price, 0) || 0;

      const displayName = username ? `@${username}` : `User ${telegramId}`;

      const textMessage = `
Halo ${displayName} 👋
Selamat datang di SAISOKU.ID 🚀

User Info
└ ID : ${telegramId}
└ Username : ${username ? `@${username}` : "-"}
└ Saldo : Rp.${user.balance}
└ Total Beli : ${totalBuy} pcs
└ Total Transaksi : Rp.${totalSpent.toLocaleString()}

Bot Info
└ Total Transaksi : Rp. ${revenueSum.toLocaleString()}
└ Total Pengguna : ${totalUsers}

Shortcuts :
/start – Mulai Bot
/stok – Cek Stok Produk
/info – Info Bot
`;

      await fetch(
        `https://api.telegram.org/bot${Deno.env.get(
          "TELEGRAM_BOT_TOKEN"
        )}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: textMessage,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📦 List Produk", callback_data: "list_produk" },
                  { text: "💰 Saldo", callback_data: "saldo" },
                ],
                [
                  {
                    text: "📂 Riwayat Transaksi",
                    callback_data: "riwayat",
                  },
                ],
                [
                  { text: "✨ Produk Populer", callback_data: "populer" },
                  { text: "⏭ Menu Lain", callback_data: "menu_lain" },
                ],
              ],
            },
          }),
        }
      );

      return new Response("ok");
    }

    // ===============================
    // LIST PRODUK
    // ===============================

    if (callback && callback.data === "list_produk") {
      await fetch(
        `https://api.telegram.org/bot${Deno.env.get(
          "TELEGRAM_BOT_TOKEN"
        )}/answerCallbackQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callback.id,
          }),
        }
      );

      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (!products || products.length === 0) {
        await fetch(
          `https://api.telegram.org/bot${Deno.env.get(
            "TELEGRAM_BOT_TOKEN"
          )}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "❌ Produk belum tersedia.",
            }),
          }
        );
        return new Response("ok");
      }

      const { data: stockRows } = await supabase
        .from("product_accounts")
        .select("product_id")
        .eq("status", "available");

      const stockMap: Record<string, number> = {};

      (stockRows || []).forEach((row) => {
        stockMap[row.product_id] = (stockMap[row.product_id] || 0) + 1;
      });

      let listText = `LIST PRODUCT\n\n`;

      products.forEach((p, i) => {
        const stock = stockMap[p.id] || 0;
        listText += `[${i + 1}]. ${p.name} (${stock})\n`;
      });

      await fetch(
        `https://api.telegram.org/bot${Deno.env.get(
          "TELEGRAM_BOT_TOKEN"
        )}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: listText,
            reply_markup: {
              inline_keyboard: [
                [{ text: "➡️ Selanjutnya", callback_data: "produk_next_1" }],
                [{ text: "🔥 Produk Populer", callback_data: "populer" }],
              ],
            },
          }),
        }
      );

      return new Response("ok");
    }

    return new Response("ok");
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 });
  }
});