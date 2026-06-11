import { supabase } from "@/lib/supabaseClient";

export async function deliverAccount(productId:string,userId:string){

  const { data:account } = await supabase
    .from("product_accounts")
    .select("*")
    .eq("product_id",productId)
    .eq("status","available")
    .limit(1)
    .single();

  if(!account){
    throw new Error("Stock habis");
  }

  await supabase
    .from("product_accounts")
    .update({
      status:"sold",
      sold_to:userId,
      sold_at:new Date()
    })
    .eq("id",account.id);

  return account;

}