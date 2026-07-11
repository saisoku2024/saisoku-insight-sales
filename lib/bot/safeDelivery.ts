export async function deliverAccount(): Promise<never> {
  throw new Error(
    "deliverAccount is disabled in the browser panel. Delivery must run through the Telegram bot Edge Function or a server-side API."
  )
}
