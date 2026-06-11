"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen"
import { HeaderBar } from "@/components/dashboard/header-bar"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { dashboardNavigation, getPageMeta } from "@/lib/navigation"
import { supabase } from "@/lib/supabaseClient"

function formatCurrentDate() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
}

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [isReady, setIsReady] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname])
  const currentDateLabel = useMemo(() => formatCurrentDate(), [])

  useEffect(() => {
    let mounted = true

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session) {
        router.replace("/login")
        return
      }

      setUserEmail(session.user.email ?? null)
      setIsReady(true)
    }

    void syncSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session) {
        setUserEmail(null)
        setIsReady(false)
        router.replace("/login")
        return
      }

      setUserEmail(session.user.email ?? null)
      setIsReady(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  async function handleLogout() {
    try {
      setIsLoggingOut(true)
      await supabase.auth.signOut()
      router.replace("/login")
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (!isReady) {
    return <AuthLoadingScreen title="Memverifikasi sesi" description="Checking access ke dashboard admin..." />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f8fafc,white_45%,#eef2ff)] px-4 py-4 text-slate-900 lg:px-6 lg:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1600px] gap-6">
        <aside className="hidden w-[320px] shrink-0 lg:block">
          <SidebarNav
            pathname={pathname}
            groups={dashboardNavigation}
            userEmail={userEmail}
            isLoggingOut={isLoggingOut}
            onLogout={handleLogout}
          />
        </aside>

        {sidebarOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden">
            <div className="absolute left-4 top-4 bottom-4 w-[min(92vw,340px)]">
              <div className="relative h-full">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>

                <SidebarNav
                  pathname={pathname}
                  groups={dashboardNavigation}
                  userEmail={userEmail}
                  isLoggingOut={isLoggingOut}
                  onNavigate={() => setSidebarOpen(false)}
                  onLogout={handleLogout}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <HeaderBar
            title={pageMeta.title}
            description={pageMeta.description}
            userEmail={userEmail}
            currentDateLabel={currentDateLabel}
            onOpenSidebar={() => setSidebarOpen(true)}
          />

          <main className="min-w-0 rounded-[32px] border border-white/70 bg-white/70 p-4 shadow-xl shadow-slate-200/40 backdrop-blur sm:p-5 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
