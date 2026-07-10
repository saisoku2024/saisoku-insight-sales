import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function LoyaltyPage() {
  return (
    <FeaturePlaceholder
      badge="LOYALTY SYSTEM"
      title="Reward Point Settings"
      description="Configure reward point, redeem value, and loyalty tier."
      features={["Reward Point", "Redeem Point", "Minimum Redeem", "Loyalty Tier"]}
      columns={["Tier", "Min Orders", "Discount", "Users", "Status"]}
      rows={[
        ["Regular", "0", "0%", "1258", "Active"],
        ["Silver", "25", "1%", "82", "Active"],
        ["Gold", "100", "2%", "21", "Active"],
        ["Platinum", "300", "3%", "5", "Active"],
      ]}
    />
  )
}
