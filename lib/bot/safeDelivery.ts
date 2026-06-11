import { supabase } from "@/lib/supabaseClient";

export async function deliverAccount(productId:string,userId:string,price:number){

const { data, error } = await supabase
.rpc("take_available_account",{
product_id_input:productId
});

if(error || !data || data.length === 0){
throw new Error("Stock habis");
}

const account = data[0];

/* UPDATE ACCOUNT SOLD */

await supabase
.from("product_accounts")
.update({
status:"sold",
sold_to:userId,
sold_at:new Date(),
reserved_at:null
})
.eq("id",account.id);

/* INSERT TRANSACTION */

await supabase
.from("transactions")
.insert({
user_id:userId,
product_id:productId,
account_id:account.id,
price:price
});

/* AUTO DISABLE PRODUCT */

const { count } = await supabase
.from("product_accounts")
.select("*",{count:"exact",head:true})
.eq("product_id",productId)
.eq("status","available");

if(count === 0){

await supabase
.from("products")
.update({is_active:false})
.eq("id",productId);

}

return account;

}