import { NextResponse, type NextRequest } from "next/server"

export const runtime = "nodejs"

type TelegramFileResponse = {
  ok?: boolean
  description?: string
  result?: {
    file_path?: string
  }
}

export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const fileId = req.nextUrl.searchParams.get("fileId")?.trim()

  if (!token) {
    return NextResponse.json({ error: "Missing TELEGRAM_BOT_TOKEN env" }, { status: 500 })
  }

  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId" }, { status: 400 })
  }

  const fileInfoRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
    { cache: "no-store" }
  )
  const fileInfo = (await fileInfoRes.json()) as TelegramFileResponse

  if (!fileInfoRes.ok || !fileInfo.ok || !fileInfo.result?.file_path) {
    return NextResponse.json(
      { error: fileInfo.description || "Gagal mengambil info file Telegram" },
      { status: 502 }
    )
  }

  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${token}/${fileInfo.result.file_path}`,
    { cache: "no-store" }
  )

  if (!fileRes.ok || !fileRes.body) {
    return NextResponse.json({ error: "Gagal mengambil file Telegram" }, { status: 502 })
  }

  return new Response(fileRes.body, {
    status: 200,
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": fileRes.headers.get("content-type") || "application/octet-stream",
    },
  })
}
