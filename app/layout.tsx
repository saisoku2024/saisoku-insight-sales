import { Geist_Mono } from "next/font/google"

import { AppProviders } from "@/providers/app-providers"
import "@/styles/globals.css"

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={geistMono.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
