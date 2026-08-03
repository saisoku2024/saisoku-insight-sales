"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { X } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen"
import { HeaderBar } from "@/components/dashboard/header-bar"
import { PanelRoleProvider } from "@/components/dashboard/panel-access-context"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { recordPanelAccessEvent } from "@/services/admin/access-log-client"
import { getActiveAdminProfile } from "@/services/auth/admin-auth.service"
import { dashboardNavigation, getPageMeta } from "@/config/navigation"
import { supabase } from "@/lib/supabase/client"

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [userRole, setUserRole] = useState<"owner" | "admin" | "viewer" | null>(null)
  const [isDark, setIsDark] = useState(false)

  const pageMeta = useMemo(() => getPageMeta(pathname), [pathname])
  const currentDateLabel = useMemo(() => formatCurrentDate(), [])

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("saisoku-theme")
    const nextIsDark = storedTheme ? storedTheme === "dark" : true
    setIsDark(nextIsDark)
    document.documentElement.classList.toggle("dark", nextIsDark)

    setSidebarCollapsed(window.localStorage.getItem("saisoku-sidebar-collapsed") === "true")
  }, [])

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue
      window.localStorage.setItem("saisoku-sidebar-collapsed", String(nextValue))
      return nextValue
    })
  }

  function toggleTheme() {
    setIsDark((currentValue) => {
      const nextValue = !currentValue
      document.documentElement.classList.toggle("dark", nextValue)
      window.localStorage.setItem("saisoku-theme", nextValue ? "dark" : "light")
      return nextValue
    })
  }

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

      const { profile } = await getActiveAdminProfile()

      if (!profile) {
        await supabase.auth.signOut()
        router.replace("/login?error=unauthorized")
        return
      }

      setUserRole(profile.role)
      setIsReady(true)
    }

    void syncSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      if (!session) {
        setUserRole(null)
        setIsReady(false)
        router.replace("/login")
        return
      }

      void getActiveAdminProfile().then(async ({ profile }) => {
        if (!mounted) return

        if (!profile) {
          await supabase.auth.signOut()
          if (!mounted) return
          setUserRole(null)
          setIsReady(false)
          router.replace("/login?error=unauthorized")
          return
        }

        setUserRole(profile.role)
        setIsReady(true)
      })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isReady || !userRole) return

    void recordPanelAccessEvent({
      eventType: "page_view",
      path: pathname,
      metadata: { role: userRole },
    })
  }, [isReady, pathname, userRole])

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
    return (
      <AuthLoadingScreen 
        title="Memverifikasi sesi" 
        description="Checking access ke dashboard admin..." 
      />
    )
  }

  return (
    <PanelRoleProvider role={userRole || "viewer"}>
      <div
        className="
          min-h-screen
          text-[var(--insight-text)]
          transition-colors duration-300
        "
      >
      <HeaderBar
        title={pageMeta.title}
        description={pageMeta.description}
        userRole={userRole}
        currentDateLabel={currentDateLabel}
        onOpenSidebar={() => setSidebarOpen(true)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebarCollapsed={toggleSidebarCollapsed}
      />

      <div className="flex min-h-[calc(100vh-60px)]">
        {!sidebarCollapsed ? (
          <aside className="hidden w-[220px] shrink-0 lg:block">
            <SidebarNav
              pathname={pathname}
              groups={dashboardNavigation}
              isLoggingOut={isLoggingOut}
              onLogout={handleLogout}
            />
          </aside>
        ) : null}

        {sidebarOpen ? (
          <div 
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 top-0 w-[min(92vw,280px)]"
            >
              <div className="relative h-full">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="insight-button absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center text-2xl"
                  aria-label="Close navigation"
                >
                  <X className="h-4 w-4" />
                </button>

                <SidebarNav
                  pathname={pathname}
                  groups={dashboardNavigation}
                  isLoggingOut={isLoggingOut}
                  onNavigate={() => setSidebarOpen(false)}
                  onLogout={handleLogout}
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1 p-3 sm:p-4 lg:p-4">
          <main
            className="
              insight-dashboard
              min-w-0
              border-[3px] border-[var(--insight-border)]
              bg-[var(--insight-card)]
              p-3 sm:p-4 lg:p-4
              shadow-[5px_5px_0_var(--insight-shadow)]
            "
          >
            {children}
          </main>
        </div>
      </div>
      </div>
    </PanelRoleProvider>
  )
}
