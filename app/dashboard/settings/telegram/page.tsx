import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function TelegramSettingsPage() {
  return (
    <FeaturePlaceholder
      badge="SYSTEM SETTINGS"
      title="Telegram Settings"
      description="Configure Telegram Bot integration and notification settings."
      features={["Bot Information", "Webhook Mode", "Admin Chat", "Connection Test"]}
      columns={["Setting", "Current Value", "Safety"]}
      rows={[
        ["Bot Username", "@saisoku_bot", "Public"],
        ["Bot Token", "Hidden", "Secret"],
        ["Webhook URL", "Supabase Edge Function", "Protected"],
      ]}
      note="Token bot tidak boleh ditampilkan di frontend. Halaman ini hanya struktur awal; data secret tetap di Supabase/Vercel env."
    />
  )
}
