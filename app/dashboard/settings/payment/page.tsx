import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function PaymentSettingsPage() {
  return (
    <FeaturePlaceholder
      badge="SYSTEM SETTINGS"
      title="Payment Gateway"
      description="Configure payment providers, deposit settings and payment notifications."
      features={["Payment Status", "QRIS Configuration", "Bank Account", "Deposit Rules"]}
      columns={["Provider", "Purpose", "Status"]}
      rows={[
        ["QRIS Manual", "Default Provider", "Enabled"],
        ["Midtrans", "Payment Provider", "Planned"],
        ["Xendit", "Payment Provider", "Planned"],
        ["Tripay", "Payment Provider", "Planned"],
      ]}
    />
  )
}
