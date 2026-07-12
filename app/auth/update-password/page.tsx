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
  const [canUpdatePassword, setCanUpdatePassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    return canUpdatePassword && password.trim().length >= 8 && confirmPassword.trim().length >= 8
  }, [canUpdatePassword, confirmPassword, password])

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const nextIsDark = storedTheme ? storedTheme === "dark" : true
    setIsDark(nextIsDark)
    document.documentElement.classList.toggle("dark", nextIsDark)
  }, [])

  useEffect(() => {
    let mounted = true

    const bootstrapRecovery = async () => {
      const code = new URLSearchParams(window.location.search).get("code")

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!mounted) return

        if (error) {
          setErrorMessage("Link reset tidak valid atau sudah expired. Silakan kirim ulang reset password dari halaman login.")
          setCanUpdatePassword(false)
          setIsReady(true)
          return
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (session) {
        setCanUpdatePassword(true)
        setIsReady(true)
        return
      }

      setErrorMessage("Link reset tidak valid atau sudah expired. Silakan kirim ulang reset password dari halaman login.")
      setCanUpdatePassword(false)
      setIsReady(true)
    }

    void bootstrapRecovery()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === "PASSWORD_RECOVERY" || session) {
        setErrorMessage(null)
        setCanUpdatePassword(Boolean(session))
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
        password: password.trim(),
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setSuccessMessage("Password berhasil diperbarui. Anda akan diarahkan kembali ke halaman login.")
      setPassword("")
      setConfirmPassword("")
      await supabase.auth.signOut()

      window.setTimeout(() => {
        router.replace("/login?reset=success")
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
      badge="PASSWORD RECOVERY"
      title="Set a new password"
      description="Gunakan password baru yang kuat agar akses dashboard tetap aman dan hanya dipakai oleh tim internal yang berwenang."
      rightTop={<AuthThemeToggle isDark={isDark} onToggle={toggleTheme} />}
    >
      <div>
        <p className="text-lg leading-none text-[var(--insight-muted)]">
          Recovery access
        </p>
        <h2 className="mt-3 text-[34px] leading-none text-[var(--insight-text)]">
          Update your password
        </h2>
        <p className="mt-2 text-xl leading-6 text-[var(--insight-muted)]">
          Masukkan password baru untuk menyelesaikan proses reset dari email recovery.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4 border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] p-5 shadow-[6px_6px_0_var(--insight-shadow)]">
        <div className="space-y-2">
          <label htmlFor="password" className="text-xl leading-none text-[var(--insight-text)]">
            New password
          </label>
          <div className="flex items-center gap-3 border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-4 shadow-[4px_4px_0_var(--insight-shadow)]">
            <KeyRound className="h-4 w-4 text-[var(--insight-muted)]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-14 w-full border-0 bg-transparent text-xl outline-none placeholder:text-[var(--insight-muted)]"
              autoComplete="new-password"
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

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-xl leading-none text-[var(--insight-text)]">
            Confirm password
          </label>
          <div className="flex items-center gap-3 border-[3px] border-[var(--insight-border)] bg-[var(--insight-card)] px-4 shadow-[4px_4px_0_var(--insight-shadow)]">
            <KeyRound className="h-4 w-4 text-[var(--insight-muted)]" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Ulangi password baru"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-14 w-full border-0 bg-transparent text-xl outline-none placeholder:text-[var(--insight-muted)]"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="border-0 bg-transparent p-0 text-[var(--insight-muted)] shadow-none transition hover:text-[var(--insight-text)]"
              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="border-[3px] border-red-700 bg-red-50 px-4 py-3 text-xl leading-none text-red-700 dark:bg-red-950/30 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="border-[3px] border-emerald-700 bg-emerald-50 px-4 py-3 text-xl leading-none text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="inline-flex h-14 w-full items-center justify-center gap-2 border-[3px] border-[var(--insight-border)] bg-slate-950 px-5 text-xl text-white shadow-[4px_4px_0_var(--insight-shadow)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
        >
          {isSubmitting ? "Updating password..." : "Save new password"}
          {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </form>
    </AuthShell>
  )
}
