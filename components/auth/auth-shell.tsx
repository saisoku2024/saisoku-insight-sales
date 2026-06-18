import type { ReactNode } from "react"
import { BarChart3, Boxes, ShieldCheck, Sparkles } from "lucide-react"
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
    description:
      "Track revenue, transactions, and performance in a centralized dashboard.",
    icon: BarChart3,
  },
  {
    title: "Account Monitoring",
    description:
      "Monitor user activity and manage secure access across the system.",
    icon: ShieldCheck,
  },
  {
    title: "Stock Management",
    description:
      "Manage inventory, track stock levels, and ensure product availability.",
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
    <div className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,#020617_0%,#020617_40%,#000000_100%)] dark:text-white sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 backdrop-blur-xl transition-colors duration-300 lg:grid-cols-[1.08fr_0.92fr] dark:border-white/10 dark:bg-white/5 dark:shadow-black/50">

        {/* LEFT */}
        <section className="relative flex flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#eff6ff_35%,#ffffff_70%,#f8fafc_100%)] px-6 py-8 transition-colors duration-300 dark:bg-[radial-gradient(circle_at_top_left,#1e293b_0%,#0f172a_35%,#0b1120_70%,#020617_100%)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.20),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.10),transparent_28%)]" />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <BrandMark />
            {rightTop ? <div className="shrink-0">{rightTop}</div> : null}
          </div>

          <div className="relative z-10 mt-10 max-w-xl lg:mt-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-slate-200">
              <Sparkles className="h-4 w-4" />
              {badge}
            </div>

            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
              {title}
            </h1>

            <p className="mt-5 max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
              {description}
            </p>
          </div>

          <div className="relative z-10 mt-10 grid gap-4 md:grid-cols-3 lg:mt-16">
            {features.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className="rounded-3xl border border-slate-200 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/10"
                >
                  <div className="mb-4 inline-flex rounded-2xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/10">
                    <Icon className="h-4 w-4 text-slate-700 dark:text-white" />
                  </div>

                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {item.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        {/* RIGHT */}
        <section className="flex flex-col justify-center px-5 py-8 text-slate-900 transition-colors duration-300 dark:text-white sm:px-8 lg:px-10 lg:py-12">
          <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center">
            {children}
          </div>
        </section>
      </div>

      <footer className="mx-auto mt-4 flex max-w-7xl flex-col gap-2 px-1 text-center text-xs text-slate-500 transition-colors duration-300 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p>© 2026 SAISOKU.ID Systems · INSIGHT Platform · Internal Use Only</p>

        <p className="text-slate-400 dark:text-slate-500">
          Integrated Sales Intelligence & Growth Hub
        </p>
      </footer>
    </div>
  )
}

export default AuthShell