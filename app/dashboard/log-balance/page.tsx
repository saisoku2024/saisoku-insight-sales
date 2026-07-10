import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function LogBalancePage() {
  return (
    <FeaturePlaceholder
      badge="REPORTS"
      title="Log Balance"
      description="View all user balance transaction history."
      features={["Top Up", "Purchase", "Adjustment", "Mutation Status"]}
      columns={["Invoice", "Date", "Username", "Type", "Mutation", "Balance", "Description", "Status"]}
      rows={[
        ["BAL240626001", "26 Jun 2026", "@saisoku", "Top Up", "+ Rp100.000", "Rp250.000", "QRIS Deposit", "Success"],
        ["BAL240626002", "26 Jun 2026", "@john", "Purchase", "- Rp55.000", "Rp145.000", "Netflix Premium", "Success"],
      ]}
    />
  )
}
