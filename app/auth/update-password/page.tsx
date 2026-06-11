"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { AuthLoadingScreen } from "@/components/auth/auth-loading-screen"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthThemeToggle } from "@/components/auth/auth-theme-toggle"
import { supabase } from "@/lib/supabaseClient"

const THEME_STORAGE_KEY = "saisoku-theme"

export default function UpdatePasswordPage() {
  const router = useRouter()

  const [isDark, setIsDark] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return password.trim().length >= 8 && confirmPassword.trim().length >= 8
  }, [confirmPassword, password])

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const nextIsDark = storedTheme ? storedTheme === "dark" : true
    setIsDark(nextIsDark)
    document.documentElement.classList.toggle("dark", nextIsDark)
  }, [])

  useEffect(() => {
    let mounted = true

    const bootstrapRecovery = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (session) {
        setIsReady(true)
        return
      }

      setErrorMessage("Link reset tidak valid atau sudah expired. Silakan kirim ulang reset password dari halaman login.")
      setIsReady(true)
    }

    void bootstrapRecovery()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === "PASSWORD_RECOVERY" || session) {
        setErrorMessage(null)
        setIsReady(true)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  function toggleTheme() {
    setIsDark((currentValue) => {
      const nextValue = !currentValue
      document.documentElement.classList.toggle("dark", nextValue)
      window.localStorage.setItem(THEME_STORAGE_KEY, nextValue ? "dark" : "light")
      return nextValue
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password !== confirmPassword) {
      setErrorMessage("Password baru dan konfirmasi password harus sama.")
      setSuccessMessage(null)
      return
    }

    if (password.trim().length < 8) {
      setErrorMessage("Password minimal 8 karakter.")
      setSuccessMessage(null)
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setSuccessMessage("Password berhasil diperbarui. Anda akan diarahkan kembali ke halaman login.")
      setPassword("")
      setConfirmPassword("")

      window.setTimeout(() => {
        router.replace("/login")
      }, 1800)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isReady) {
    return <AuthLoadingScreen title="Memvalidasi link recovery" description="Menyiapkan halaman update password..." />
  }

  return (
    <AuthShell
      badge="Password recovery"
      title="Set a new password for your admin account"
      description="Gunakan password baru yang kuat agar akses dashboard tetap aman dan hanya dipakai oleh tim internal yang berwenang."
      rightTop={<AuthThemeToggle isDark={isDark} onToggle={toggleTheme} />}
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          Recovery access
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Update your password
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Masukkan password baru untuk menyelesaikan proses reset dari email recovery.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            New password
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-slate-900 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-slate-600 dark:focus-within:bg-slate-950 dark:focus-within:ring-white/5">
            <KeyRound className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-14 w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Confirm password
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 transition focus-within:border-slate-900 focus-within:bg-white focus-within:ring-4 focus-within:ring-slate-950/5 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-slate-600 dark:focus-within:bg-slate-950 dark:focus-within:ring-white/5">
            <KeyRound className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Ulangi password baru"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-14 w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
        >
          {isSubmitting ? "Updating password..." : "Save new password"}
          {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </form>
    </AuthShell>
  )
}
