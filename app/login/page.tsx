"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRoundCheck } from "lucide-react"
import { useRouter } from "next/navigation"

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle"
import { recordPanelAccessEvent } from "@/services/admin/access-log-client"
import { getActiveAdminProfile, getAdminAccessErrorMessage } from "@/services/auth/admin-auth.service"
import { supabase } from "@/lib/supabase/client"

const THEME_STORAGE_KEY = "saisoku-theme"
const RESET_COOLDOWN_SECONDS = 60
const RESET_COOLDOWN_KEY = "saisoku-reset-password-next-at"

function getCleanAuthErrorMessage(msg: string): string {
  const lowercase = msg.toLowerCase()
  if (
    lowercase.includes("invalid login credentials") ||
    lowercase.includes("user not found") ||
    lowercase.includes("invalid claim")
  ) {
    return "Email atau password salah."
  }
  if (lowercase.includes("rate limit") || lowercase.includes("too many requests")) {
    return "Terlalu banyak permintaan. Silakan coba beberapa saat lagi."
  }
  return msg
}

export default function LoginPage() {
  const router = useRouter()
  const [isBooting, setIsBooting] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [guestData, setGuestData] = useState<{ email: string; password: string } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResetLoading, setIsResetLoading] = useState(false)
  const [resetCooldown, setResetCooldown] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canSubmit = useMemo(
    () => Boolean((email.trim() && password.trim()) || guestData),
    [email, password, guestData]
  )

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const nextIsDark = storedTheme ? storedTheme === "dark" : true
    setIsDark(nextIsDark)
    document.documentElement.classList.toggle("dark", nextIsDark)

    const error = new URLSearchParams(window.location.search).get("error")
    if (error === "unauthorized") {
      setErrorMessage(getAdminAccessErrorMessage())
    }

    const reset = new URLSearchParams(window.location.search).get("reset")
    if (reset === "success") {
      setSuccessMessage("Password berhasil diperbarui. Silakan login dengan password baru.")
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextAt = Number(window.localStorage.getItem(RESET_COOLDOWN_KEY) || 0)
      const secondsLeft = Math.max(0, Math.ceil((nextAt - Date.now()) / 1000))
      setResetCooldown(secondsLeft)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let mounted = true
    const hydrateSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (session) {
          const { profile } = await getActiveAdminProfile()
          if (!mounted) return

          if (profile) {
            router.replace("/dashboard")
            return
          }

          await supabase.auth.signOut()
          if (!mounted) return
          setErrorMessage(getAdminAccessErrorMessage())
          setIsBooting(false)
          return
        }
        setIsBooting(false)
      } catch (err) {
        console.error("hydrateSession error:", err)
        if (mounted) {
          setErrorMessage("Gagal memverifikasi sesi login.")
          setIsBooting(false)
        }
      }
    }
    
    void hydrateSession()
    
    return () => {
      mounted = false
    }
  }, [router])

  function toggleTheme() {
    setIsDark((currentValue) => {
      const nextValue = !currentValue
      document.documentElement.classList.toggle("dark", nextValue)
      window.localStorage.setItem(THEME_STORAGE_KEY, nextValue ? "dark" : "light")
      return nextValue
    })
  }

  async function fillGuestLogin() {
    try {
      setErrorMessage(null)
      setSuccessMessage("Menghubungi server kredensial guest...")
      const res = await fetch("/api/auth/guest")
      if (!res.ok) throw new Error("Gagal mengambil kredensial guest dari server.")
      const data = await res.json()

      setGuestData(data)
      setSuccessMessage("Mode guest aktif. Klik Sign in to dashboard untuk masuk.")
    } catch (e: any) {
      setErrorMessage(e instanceof Error ? e.message : "Gagal memproses mode guest.")
      setSuccessMessage(null)
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      setErrorMessage("Email dan password wajib diisi.")
      setSuccessMessage(null)
      return
    }

    const loginEmail = guestData ? guestData.email : email.trim()
    const loginPassword = guestData ? guestData.password : password

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      })
      
      if (error) {
        setErrorMessage(getCleanAuthErrorMessage(error.message))
        return
      }

      const { profile, error: profileError } = await getActiveAdminProfile()
      if (profileError || !profile) {
        await supabase.auth.signOut()
        setErrorMessage(getAdminAccessErrorMessage())
        return
      }

      void recordPanelAccessEvent({
        eventType: "login_success",
        path: "/login",
        metadata: { role: profile.role },
      })
      router.replace("/dashboard")
    } catch (e: any) {
      setErrorMessage(e instanceof Error ? e.message : "Terjadi kesalahan jaringan.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResetPassword() {
    if (resetCooldown > 0) {
      setErrorMessage(`Tunggu ${resetCooldown} detik sebelum kirim ulang reset password.`)
      setSuccessMessage(null)
      return
    }

    if (!email.trim()) {
      setErrorMessage("Masukkan email admin terlebih dahulu untuk reset password.")
      setSuccessMessage(null)
      return
    }

    try {
      setIsResetLoading(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })

      if (error) {
        setErrorMessage(getCleanAuthErrorMessage(error.message))
        return
      }

      setSuccessMessage("Link reset password sudah dikirim. Cek inbox email admin lalu buka link recovery.")
      window.localStorage.setItem(
        RESET_COOLDOWN_KEY,
        String(Date.now() + RESET_COOLDOWN_SECONDS * 1000)
      )
      setResetCooldown(RESET_COOLDOWN_SECONDS)
    } catch (e: any) {
      setErrorMessage(e instanceof Error ? e.message : "Gagal mengirim link reset password.")
    } finally {
      setIsResetLoading(false)
    }
  }

  if (isBooting) {
    return (
      <AuthLoadingScreen
        title="Mengecek sesi login"
        description="Redirect otomatis bila admin sudah login..."
      />
    )
  }

  return (
    <AuthShell
      badge="ADMIN PANEL"
      title="Sales & Stock Management System"
      description="Manage Users, Orders, Deposits and Products. Access restricted to Admin and Owner only."
      rightTop={<AuthThemeToggle isDark={isDark} onToggle={toggleTheme} />}
    >
      <div>
        <p className="text-base leading-none text-[var(--insight-muted)]">
          Admin access
        </p>
        <h2 className="mt-2 text-[28px] leading-none text-[var(--insight-text)]">
          Sign in to your account
        </h2>
        <p className="mt-2 text-lg leading-5 text-[var(--insight-muted)]">
          Enter your credentials to access the INSIGHT dashboard
        </p>
      </div>

      <form
        onSubmit={handleLogin}
        className="mt-5 space-y-3 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-4 shadow-[6px_6px_0_var(--insight-shadow)]"
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-lg leading-none text-[var(--insight-text)]">
            Email admin
          </label>
          <div className="flex items-center gap-2.5 border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-3 shadow-[4px_4px_0_var(--insight-shadow)]">
            <Mail className="h-4 w-4 text-[var(--insight-muted)]" />
            <input
              id="email"
              type="email"
              placeholder="admin@saisoku.id"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                if (guestData) setGuestData(null)
              }}
              className="h-11 w-full border-0 bg-transparent text-lg outline-none placeholder:text-[var(--insight-muted)]"
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-lg leading-none text-[var(--insight-text)]">
              Password
            </label>
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={isResetLoading || resetCooldown > 0}
              className="border-0 bg-transparent p-0 text-base leading-none text-[var(--insight-muted)] shadow-none transition hover:text-[var(--insight-text)]"
            >
              {isResetLoading
                ? "Sending reset..."
                : resetCooldown > 0
                  ? `Wait ${resetCooldown}s`
                  : "Forgot your password?"}
            </button>
          </div>
          <div className="flex items-center gap-2.5 border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-3 shadow-[4px_4px_0_var(--insight-shadow)]">
            <LockKeyhole className="h-4 w-4 text-[var(--insight-muted)]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Masukkan password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                if (guestData) setGuestData(null)
              }}
              className="h-11 w-full border-0 bg-transparent text-lg outline-none placeholder:text-[var(--insight-muted)]"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="border-0 bg-transparent p-0 text-[var(--insight-muted)] shadow-none transition hover:text-[var(--insight-text)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="border-[3px] border-red-700 bg-red-50 px-3 py-2 text-lg leading-5 text-red-700 dark:bg-red-950/30 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}
        
        {successMessage ? (
          <div className="border-[3px] border-emerald-700 bg-emerald-50 px-3 py-2 text-lg leading-5 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="inline-flex h-12 w-full items-center justify-center gap-2 border-[3px] border-[var(--insight-border)] bg-slate-950 px-4 text-lg text-white shadow-[4px_4px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
        >
          {isSubmitting ? "Signing in..." : "Sign in to dashboard"}
          {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
        </button>

        <button
          type="button"
          onClick={fillGuestLogin}
          disabled={isSubmitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-4 text-lg text-[var(--insight-text)] shadow-[4px_4px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserRoundCheck className="h-4 w-4" />
          Login as Guest
        </button>

      </form>
    </AuthShell>
  )
}
