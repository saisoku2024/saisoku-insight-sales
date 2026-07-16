import { VT323 } from "next/font/google"

import { AppProviders } from "@/providers/app-providers"
import "@/styles/globals.css"

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
      <body className={vt323.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
