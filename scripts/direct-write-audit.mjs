import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const roots = [
  "app/dashboard",
  "components",
  "lib",
]

const allowedFiles = new Set([
  path.normalize("lib/admin-auth.ts"),
  path.normalize("lib/admin-api-client.ts"),
])

const blockedPatterns = [
  ".insert(",
  ".update(",
  ".delete(",
  ".upsert(",
  ".rpc(",
]

function walk(dir) {
  if (!existsSync(dir)) return []

  const files = []
  for (const name of readdirSync(dir)) {
    const fullPath = path.join(dir, name)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(name)) continue
      files.push(...walk(fullPath))
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      files.push(fullPath)
    }
  }

  return files
}

const findings = []

for (const root of roots) {
  for (const file of walk(root)) {
    const normalized = path.normalize(file)
    if (allowedFiles.has(normalized)) continue

    const content = readFileSync(file, "utf8")
    const lines = content.split(/\r?\n/)

    lines.forEach((line, index) => {
      for (const pattern of blockedPatterns) {
        if (line.includes(pattern)) {
          findings.push({
            file,
            line: index + 1,
            pattern,
            text: line.trim(),
          })
        }
      }
    })
  }
}

if (findings.length) {
  console.error("Direct frontend Supabase write/RPC calls found. Move these actions to /api/admin/*:")
  for (const item of findings) {
    console.error(`- ${item.file}:${item.line} ${item.pattern} ${item.text}`)
  }
  process.exit(1)
}

console.log("Direct frontend write audit passed.")
