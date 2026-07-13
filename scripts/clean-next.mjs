import { existsSync, rmSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const workspace = process.cwd()
const target = path.resolve(workspace, ".next")

if (!target.startsWith(workspace)) {
  throw new Error(`Refusing to remove outside workspace: ${target}`)
}

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true })
}

console.log("Cleaned .next build output.")
