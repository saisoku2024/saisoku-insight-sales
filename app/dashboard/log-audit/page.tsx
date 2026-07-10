import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function LogAuditPage() {
  return (
    <FeaturePlaceholder
      badge="REPORTS"
      title="Audit Logs"
      description="View all administrator activity history."
      features={["Login/Logout", "Product Changes", "Balance Changes", "Settings Changes"]}
      columns={["Date & Time", "Admin", "Activity", "Description"]}
      rows={[
        ["26 Jun 2026 08:15:23", "@owner", "Login", "Login to Admin Panel"],
        ["26 Jun 2026 08:45:18", "@owner", "Pricing", "Updated Netflix Premium price"],
        ["26 Jun 2026 09:18:12", "@admin", "Voucher", "Created voucher WELCOME10"],
      ]}
    />
  )
}
