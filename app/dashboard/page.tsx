"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { supabase } from "@/lib/supabase/client"
import { useIsViewer } from "@/components/dashboard/panel-access-context"

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  Title,
  type TooltipItem,
  type ChartData,
} from "chart.js"
import { Bar } from "react-chartjs-2"

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// --- TYPES ---
type TxRow = {
  price: number | null
  created_at: string | null
  purchased_at: string | null
  status: string | null
  products?: {
    name: string | null
    product_code: string | null
    modal: number | null
  } | null
}

// --- UTILS ---
function currencyIDR(v: number) {
  return `Rp ${Number(v || 0).toLocaleString("id-ID")}`
}

// --- COMPONENTS ---
function Panel({
  title,
  subtitle,
  right,
  children,
  className = "",
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`insight-card ${className}`}>
      <div className="mb-2 flex items-start justify-between gap-3 p-3 pb-0">
        <div>
          <h2 className="text-lg font-bold leading-none text-[var(--insight-text)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-none text-[var(--insight-muted)]">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="p-3 pt-2">
        {children}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accentClass = "text-gray-900 dark:text-white",
}: {
  label: string
  value: ReactNode
  accentClass?: string
}) {
  return (
    <div className="insight-card group flex min-h-[80px] flex-col justify-center p-3.5 transition-all duration-200 hover:-translate-y-0.5">
      <div className="text-sm leading-none text-[var(--insight-muted)]">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold leading-none ${accentClass}`}>
        {value}
      </div>
    </div>
  )
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 ${className}`} />
}

function StatCardSkeleton() {
  return (
    <div className="insight-card flex min-h-[80px] flex-col justify-center p-3.5">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-2 h-6 w-32" />
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-52 w-full" />
    </div>
  )
}

// --- MAIN PAGE ---
export default function DashboardPage() {
  const isViewer = useIsViewer()
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const [meta, setMeta] = useState({
    gmvToday: 0,
    gmvMonth: 0,
    profitToday: 0,
    profitMonth: 0,
    profitYear: 0,
    transactions: 0,
    newUsers: 0,
    activeUsers: 0,
    bannedUsers: 0,
  })

  const [todayChart, setTodayChart] = useState<ChartData<"bar"> | null>(null)
  const [monthlySalesChart, setMonthlySalesChart] = useState<ChartData<"bar"> | null>(null)

  const months = useMemo(
    () => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    []
  )

  // Chart Options
  const chartOptionsCount = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      color: "#6b7280", 
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: TooltipItem<"bar">) => {
              const v = ctx.raw
              return typeof v === "number" ? `${v.toLocaleString("id-ID")} transaksi` : String(v)
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { 
            maxRotation: 0, 
            autoSkip: true,
            color: "#6b7280"
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            precision: 0,
            color: "#6b7280",
            callback: (v: number | string) => Number(v).toLocaleString("id-ID"),
          },
        },
      },
    }),
    []
  )

  // Fetching Data
  async function fetchTransactionsOnce(): Promise<TxRow[]> {
    const { data, error } = await supabase
      .from("transactions")
      .select("price,created_at,purchased_at,status,products(name,product_code,modal)")
      .order("purchased_at", { ascending: false })

    if (error) throw error
    return (data ?? []) as unknown as TxRow[]
  }

  async function fetchUserCounts() {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

    const [
      { count: newUserCount, error: newUserError },
      { count: activeCount, error: activeError },
      { count: bannedCount, error: bannedError },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }).gte("created_at", startOfDay),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("users").select("*", { count: "exact", head: true }).eq("is_banned", true),
    ])

    if (newUserError) throw newUserError
    if (activeError) throw activeError
    if (bannedError) throw bannedError

    return {
      newUsers: newUserCount ?? 0,
      activeUsers: activeCount ?? 0,
      bannedUsers: bannedCount ?? 0,
    }
  }

  function computeAll(txs: TxRow[], userCounts: { newUsers: number; activeUsers: number; bannedUsers: number }) {
    const now = new Date()
    const todayStr = now.toDateString()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    let gmvToday = 0, gmvMonth = 0, profitToday = 0, profitMonth = 0, profitYear = 0
    const todayProductCounts: Record<string, number> = {}
    const monthlySales = new Array(12).fill(0) as number[]

    const paidTransactions = txs.filter((t) => t.status === "paid")

    for (const t of paidTransactions) {
      const price = Number(t.price ?? 0)
      const modal = Number(t.products?.modal ?? 0)
      const profit = price - modal

      const txDateRaw = t.purchased_at || t.created_at
      const txDate = txDateRaw ? new Date(txDateRaw) : null

      if (!txDate || Number.isNaN(txDate.getTime())) continue

      const txYear = txDate.getFullYear()
      const txMonth = txDate.getMonth()
      const productCode = t.products?.product_code?.trim() || t.products?.name?.trim() || "Unknown"

      if (txDate.toDateString() === todayStr) {
        gmvToday += price
        profitToday += profit
        todayProductCounts[productCode] = (todayProductCounts[productCode] || 0) + 1
      }

      if (txYear === currentYear && txMonth === currentMonth) {
        gmvMonth += price
        profitMonth += profit
      }

      if (txYear === currentYear) {
        profitYear += profit
        monthlySales[txMonth] += 1
      }
    }

    setTodayChart({
      labels: Object.keys(todayProductCounts),
      datasets: [
        {
          label: "Today Sales",
          data: Object.values(todayProductCounts),
          borderRadius: 8,
          backgroundColor: "rgba(59,130,246,0.85)",
          hoverBackgroundColor: "rgba(59,130,246,1)",
        },
      ],
    })

    setMonthlySalesChart({
      labels: months,
      datasets: [
        {
          label: "Monthly Sales",
          data: monthlySales,
          borderRadius: 8,
          backgroundColor: "rgba(34,197,94,0.85)",
          hoverBackgroundColor: "rgba(34,197,94,1)",
        },
      ],
    })

    setMeta({
      gmvToday, gmvMonth, profitToday, profitMonth, profitYear,
      transactions: paidTransactions.length,
      newUsers: userCounts.newUsers,
      activeUsers: userCounts.activeUsers,
      bannedUsers: userCounts.bannedUsers,
    })
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setErrorMsg(null)

        const [txs, userCounts] = await Promise.all([
          fetchTransactionsOnce(),
          fetchUserCounts(),
        ])

        if (cancelled) return

        computeAll(txs, userCounts)
        setUpdatedAt(new Date())
      } catch (e: unknown) {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : "Failed to load dashboard")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4 transition-colors">
      
      {/* HEADER */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-none text-[var(--insight-text)]">
            Overview
          </h1>
          <p className="text-sm leading-none text-[var(--insight-muted)]">Dashboard analytics summary</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="border-2 border-[var(--insight-border)] bg-[var(--insight-panel)] px-2 py-0.5 text-xs leading-none text-[var(--insight-muted)] shadow-[2px_2px_0_var(--insight-shadow)]">
            {updatedAt ? `Updated: ${updatedAt.toLocaleString("id-ID")}` : "—"}
          </div>
        </div>
      </div>

      {errorMsg ? (
        <div className="border-2 border-red-700 bg-red-50 p-2.5 text-sm leading-none text-red-700 shadow-[2px_2px_0_#7f1d1d] dark:bg-red-950/30 dark:text-red-300">
          {errorMsg}
        </div>
      ) : null}

      {/* ROW 1: REVENUE STATS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="GMV Hari Ini"
              value={currencyIDR(meta.gmvToday)}
              accentClass="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              label="GMV Bulan Ini"
              value={currencyIDR(meta.gmvMonth)}
              accentClass="text-green-600 dark:text-green-400"
            />
            <StatCard
              label="Profit Bulan Ini"
              value={isViewer ? "***" : currencyIDR(meta.profitMonth)}
              accentClass="text-purple-600 dark:text-purple-400"
            />
            <StatCard
              label="Profit Tahun Ini"
              value={isViewer ? "***" : currencyIDR(meta.profitYear)}
              accentClass="text-fuchsia-600 dark:text-fuchsia-400"
            />
            <StatCard
              label="Transaction"
              value={meta.transactions.toLocaleString("id-ID")}
              accentClass="text-gray-900 dark:text-gray-100"
            />
          </>
        )}
      </div>

      {/* ROW 2: CHARTS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Today Sales"
          subtitle="Jumlah transaksi paid hari ini per produk"
          right={<span className="border-2 border-[var(--insight-border)] bg-violet-100 px-2 py-0.5 text-xs font-bold leading-none text-violet-800">Today</span>}
          className="h-[280px]"
        >
          {loading ? (
            <ChartSkeleton />
          ) : todayChart && (todayChart.labels?.length ?? 0) > 0 ? (
            <Bar data={todayChart} options={chartOptionsCount} />
          ) : (
            <div className="text-sm text-[var(--insight-muted)]">No sales today.</div>
          )}
        </Panel>

        <Panel
          title="Monthly Sales"
          subtitle="Jumlah transaksi paid per bulan (Jan–Des tahun berjalan)"
          right={<span className="border-2 border-[var(--insight-border)] bg-cyan-100 px-2 py-0.5 text-xs font-bold leading-none text-cyan-800">Year</span>}
          className="h-[280px]"
        >
          {loading ? (
            <ChartSkeleton />
          ) : monthlySalesChart ? (
            <Bar data={monthlySalesChart} options={chartOptionsCount} />
          ) : (
            <div className="text-sm text-[var(--insight-muted)]">No data.</div>
          )}
        </Panel>
      </div>

      {/* ROW 3: USER STATS */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="New User"
              value={meta.newUsers.toLocaleString("id-ID")}
              accentClass="text-indigo-600 dark:text-indigo-400"
            />
            <StatCard
              label="Active User"
              value={meta.activeUsers.toLocaleString("id-ID")}
              accentClass="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="Banned User"
              value={meta.bannedUsers.toLocaleString("id-ID")}
              accentClass="text-red-600 dark:text-red-400"
            />
          </>
        )}
      </div>
    </div>
  )
}
