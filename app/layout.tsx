import "./globals.css"
import { VT323 } from "next/font/google"

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={vt323.className}>{children}</body>
    </html>
  )
}
