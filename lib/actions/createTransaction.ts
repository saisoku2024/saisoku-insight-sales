import { supabase } from "@/lib/supabaseClient"

export async function createTransaction({
  productId,
  buyerUsername,
  price
}: {
  productId: string
  buyerUsername: string
  price: number
}) {

  // 1️⃣ Ambil stock available
  const { data: account, error: accountError } = await supabase
    .from("product_accounts")
    .select("*")
    .eq("product_id", productId)
    .eq("status", "available")
    .limit(1)
    .single()

  if (accountError || !account) {
    throw new Error("Stock tidak tersedia")
  }

  // 2️⃣ Insert transaction
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .insert({
      product_id: productId,
      account_id: account.id,
      buyer_username: buyerUsername,
      price: price,
      status: "completed"
    })
    .select()
    .single()

  if (transactionError) {
    throw transactionError
  }

  // 3️⃣ Update stock → SOLD
  const { error: updateError } = await supabase
    .from("product_accounts")
    .update({
      status: "sold",
      transaction_id: transaction.id,
      sold_at: new Date()
    })
    .eq("id", account.id)

  if (updateError) {
    throw updateError
  }

  // 4️⃣ Return account untuk delivery
  return {
    transaction,
    account
  }
}