import type { ReactNode } from "react"
import { BarChart3, Boxes, ShieldCheck } from "lucide-react"
import { BrandMark } from "@/components/shared/brand-mark"

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
    <div className="auth-page-bg min-h-screen px-4 py-4 text-[var(--insight-text)] transition-colors duration-300 sm:px-6 sm:py-6 lg:px-8">
      <header className="mx-auto mb-4 flex h-[52px] max-w-4xl items-center justify-between border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-4 shadow-[4px_4px_0_var(--insight-shadow)]">
        <BrandMark />
        <div className="flex items-center gap-3">
          <span className="hidden border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--insight-muted)] shadow-[2px_2px_0_var(--insight-shadow)] sm:inline-block">
            IDN SERVER • v3.0
          </span>
          {rightTop ? <div className="shrink-0">{rightTop}</div> : null}
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-4 lg:grid-cols-[1fr_0.95fr]">
        <section className="insight-card flex flex-col justify-between p-4 sm:p-5">
          <div>
            <span className="inline-block border-2 border-[var(--insight-border)] bg-violet-100 dark:bg-violet-950/40 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-violet-800 dark:text-violet-300">
              {badge}
            </span>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--insight-text)] sm:text-4xl">
              INSIGHT
            </h1>

            <h2 className="mt-2 text-base font-semibold text-[var(--insight-text)] sm:text-lg">
              {title}
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-[var(--insight-muted)]">
              {description}
            </p>
          </div>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {features.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] p-2.5 shadow-[3px_3px_0_var(--insight-shadow)]"
                >
                  <div className="mb-2 flex h-7 w-7 items-center justify-center border-2 border-[var(--insight-border)] bg-[var(--insight-cyan)] text-slate-900">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[12px] font-bold leading-tight text-[var(--insight-text)]">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-tight text-[var(--insight-muted)]">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="insight-card flex items-center justify-center p-4 sm:p-5">
          <div className="w-full max-w-sm">{children}</div>
        </section>
      </main>

      <footer className="mx-auto mt-4 flex max-w-4xl flex-col gap-1 px-1 text-center text-[11px] text-[var(--insight-muted)] sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>© 2026 SAISOKU.ID Systems · INSIGHT Platform</p>
        <p>Internal Use Only</p>
      </footer>
    </div>
  )
}

export default AuthShell
