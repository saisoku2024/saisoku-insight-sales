"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
import { useRouter } from "next/navigation"

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle"
import { supabase } from "@/lib/supabaseClient"

const THEME_STORAGE_KEY = "saisoku-theme"

export default function LoginPage() {
  const router = useRouter()
  const [isBooting, setIsBooting] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canSubmit = useMemo(() => Boolean(email.trim() && password.trim()), [email, password])

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const nextIsDark = storedTheme ? storedTheme === "dark" : true
    setIsDark(nextIsDark)
    document.documentElement.classList.toggle("dark", nextIsDark)
  }, [])

  useEffect(() => {
    let mounted = true
    const hydrateSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      if (session) {
        router.replace("/dashboard")
        return
      }
      setIsBooting(false)
    }
    void hydrateSession()
    return () => { mounted = false }
  }, [router])

  function toggleTheme() {
    setIsDark((currentValue) => {
      const nextValue = !currentValue
      document.documentElement.classList.toggle("dark", nextValue)
      window.localStorage.setItem(THEME_STORAGE_KEY, nextValue ? "dark" : "light")
      return nextValue
    })
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) {
      setErrorMessage("Email dan password wajib diisi.")
      setSuccessMessage(null)
      return
    }
    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setErrorMessage(error.message)
        return
      }
      router.replace("/dashboard")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleGoogleLogin() {
    try {
      setIsGoogleLoading(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined,
        },
      })
      if (error) setErrorMessage(error.message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setErrorMessage("Masukkan email admin terlebih dahulu untuk reset password.")
      setSuccessMessage(null)
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/update-password` : undefined,
    })
    if (error) {
      setErrorMessage(error.message)
      setSuccessMessage(null)
      return
    }
    setErrorMessage(null)
    setSuccessMessage("Link reset password sudah dikirim. Cek inbox lalu lanjutkan pembaruan password.")
  }

  if (isBooting) {
    return <AuthLoadingScreen title="Mengecek sesi login" description="Redirect otomatis bila admin sudah login..." />
  }

  return (
    <AuthShell
      badge="SALES MANAGEMENT SYSTEM"
      title="Welcome to INSIGHT Workspace"
      description="Optimize your business operations with integrated sales reporting, account monitoring, and inventory management in one secure workspace."
      rightTop={<AuthThemeToggle isDark={isDark} onToggle={toggleTheme} />}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">Admin access</p>
        <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-slate-950 dark:text-white">Sign in to your account</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Enter your credentials to access the INSIGHT dashboard</p>
      </div>

      <form onSubmit={handleLogin} className="mt-7 space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-200">Email admin</label>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-slate-900 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-slate-600 dark:focus-within:bg-slate-950 dark:focus-within:ring-white/5">
            <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input id="email" type="email" placeholder="admin@saisoku.id" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500" autoComplete="email" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</label>
            <button type="button" onClick={handleResetPassword} className="text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Forgot your password?</button>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition focus-within:border-slate-900 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-slate-600 dark:focus-within:bg-slate-950 dark:focus-within:ring-white/5">
            <LockKeyhole className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input id="password" type={showPassword ? "text" : "password"} placeholder="Masukkan password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500" autoComplete="current-password" />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {errorMessage ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">{errorMessage}</div> : null}
        {successMessage ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">{successMessage}</div> : null}

        <button type="submit" disabled={!canSubmit || isSubmitting} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-300">
          {isSubmitting ? "Signing in..." : "Sign in to dashboard"}
          {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200 dark:border-slate-800" /></div>
          <div className="relative flex justify-center text-[11px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500"><span className="bg-white px-3 dark:bg-slate-950">or continue with</span></div>
        </div>

        <button type="button" onClick={handleGoogleLogin} disabled={isGoogleLoading} className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:hover:bg-slate-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true"><path d="M21.805 10.023H12v3.955h5.613c-.242 1.273-.967 2.35-2.06 3.072v2.548h3.327c1.946-1.79 3.07-4.426 2.925-7.378-.003-.742-.086-1.474-.245-2.197Z" fill="#4285F4" /><path d="M12 22c2.7 0 4.964-.894 6.619-2.402l-3.327-2.548c-.925.62-2.11.986-3.292.986-2.528 0-4.67-1.706-5.437-4.004H3.13v2.632A9.996 9.996 0 0 0 12 22Z" fill="#34A853" /><path d="M6.563 14.032A6.005 6.005 0 0 1 6.26 12c0-.706.122-1.39.303-2.032V7.336H3.13A10.002 10.002 0 0 0 2 12c0 1.61.384 3.13 1.13 4.664l3.433-2.632Z" fill="#FBBC04" /><path d="M12 5.964c1.468 0 2.785.505 3.822 1.496l2.867-2.867C16.96 2.979 14.696 2 12 2A9.996 9.996 0 0 0 3.13 7.336l3.433 2.632C7.33 7.67 9.472 5.964 12 5.964Z" fill="#EA4335" /></svg>
          {isGoogleLoading ? "Redirecting to Google..." : "Continue with Google"}
        </button>
      </form>
    </AuthShell>
  )
}
