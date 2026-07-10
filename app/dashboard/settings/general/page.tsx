import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function GeneralSettingsPage() {
  return (
    <FeaturePlaceholder
      badge="SYSTEM SETTINGS"
      title="General Settings"
      description="Configure application information and default system preferences."
      features={["Application Info", "Business Config", "Dashboard Preference", "Date & Number Format"]}
      columns={["Setting", "Current Value", "Scope"]}
      rows={[
        ["Application Name", "SAISOKU INSIGHT", "Global"],
        ["Currency", "IDR (Rp)", "Business"],
        ["Timezone", "Asia/Jakarta", "System"],
      ]}
    />
  )
}
