import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function BalancePage() {
  return (
    <FeaturePlaceholder
      badge="BUSINESS MANAGEMENT"
      title="Wallet Balance"
      description="Manage user wallet and balance adjustment."
      features={["User Balance", "Credit/Debit Filter", "Adjust Balance", "Last Transaction"]}
      columns={["User", "Current Balance", "Last Transaction", "Action"]}
      rows={[
        ["@saisoku", "Rp250.000", "QRIS Deposit", "Adjust"],
        ["@john", "Rp145.000", "Netflix Premium", "Adjust"],
      ]}
    />
  )
}
