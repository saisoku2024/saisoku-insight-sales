import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function NotificationSettingsPage() {
  return (
    <FeaturePlaceholder
      badge="SYSTEM SETTINGS"
      title="Notification Settings"
      description="Configure notification channels, events and recipients."
      features={["Notification Channels", "Event Notification", "Recipient Rules", "Low Stock Alert"]}
      columns={["Event", "Channel", "Default"]}
      rows={[
        ["Deposit Success", "Telegram", "Enabled"],
        ["Purchase Success", "Telegram", "Enabled"],
        ["Ticket Created", "Web/Telegram", "Enabled"],
        ["System Error", "Owner", "Enabled"],
      ]}
    />
  )
}
