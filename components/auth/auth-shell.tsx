import type { ReactNode } from "react"
import { BarChart3, Boxes, ShieldCheck } from "lucide-react"
import { BrandMark } from "@/components/brand/brand-mark"

type AuthFeature = {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export type AuthShellProps = {
  badge?: string
  title?: string
  description?: string
  children: ReactNode
  rightTop?: ReactNode
  features?: AuthFeature[]
}

const defaultHighlights: AuthFeature[] = [
  {
    title: "Sales Reporting",
    description: "Revenue, transaksi, dan performa dalam satu panel.",
    icon: BarChart3,
  },
  {
    title: "Account Monitoring",
    description: "Kelola user, role, dan akses admin dengan cepat.",
    icon: ShieldCheck,
  },
  {
    title: "Stock Management",
    description: "Pantau stok akun dan riwayat inventory bot.",
    icon: Boxes,
  },
]

export function AuthShell({
  badge = "SALES MANAGEMENT SYSTEM",
  title = "Welcome to INSIGHT Workspace",
  description = "Optimize your business operations with integrated sales reporting, account monitoring, and inventory management in one secure workspace.",
  children,
  rightTop,
  features = defaultHighlights,
}: AuthShellProps) {
  return (
    <div className="min-h-screen px-4 py-4 text-[var(--insight-text)] transition-colors duration-300 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <header className="mx-auto mb-5 flex h-[56px] max-w-5xl items-center justify-between border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-4 shadow-[6px_6px_0_var(--insight-shadow)]">
        <BrandMark />
        <div className="flex items-center gap-2">
          <div className="insight-button flex h-10 min-w-[55px] items-center justify-center px-3 text-xl">
            ID
          </div>
          {rightTop ? <div className="shrink-0">{rightTop}</div> : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[0.9fr_0.82fr]">
        <section className="insight-card flex min-h-[470px] flex-col justify-between p-5">
          <div>
            <span className="inline-block border-[3px] border-[var(--insight-border)] bg-violet-100 px-3 py-1 text-lg leading-none text-violet-800">
              {badge}
            </span>

            <h1 className="mt-5 text-[50px] leading-none text-[var(--insight-text)] sm:text-[60px]">
              INSIGHT
            </h1>

            <h2 className="mt-3 max-w-lg text-[30px] leading-none text-[var(--insight-text)]">
              {title}
            </h2>

            <p className="mt-3 max-w-xl text-lg leading-6 text-[var(--insight-muted)]">
              {description}
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {features.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className="border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-3 shadow-[4px_4px_0_var(--insight-shadow)]"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center border-[3px] border-[var(--insight-border)] bg-[var(--insight-cyan)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-xl leading-none text-[var(--insight-text)]">{item.title}</p>
                  <p className="mt-2 text-lg leading-5 text-[var(--insight-muted)]">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="insight-card flex min-h-[470px] items-center justify-center p-5">
          <div className="w-full max-w-sm">{children}</div>
        </section>
      </main>

      <footer className="mx-auto mt-5 flex max-w-5xl flex-col gap-2 px-1 text-center text-lg leading-none text-[var(--insight-muted)] sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>© 2026 SAISOKU.ID Systems · INSIGHT Platform</p>
        <p>Internal Use Only</p>
      </footer>
    </div>
  )
}

export default AuthShell
