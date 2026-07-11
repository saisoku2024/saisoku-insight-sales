export async function createTransaction(): Promise<never> {
  throw new Error(
    "createTransaction is disabled in the browser panel. Use a validated server-side API/RPC flow instead."
  )
}
