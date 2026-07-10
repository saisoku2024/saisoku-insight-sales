import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function PricingPage() {
  return (
    <FeaturePlaceholder
      badge="BUSINESS MANAGEMENT"
      title="Pricing"
      description="Manage product selling prices."
      features={["Cost Price", "Regular Price", "Reseller Price", "Profit Margin"]}
      columns={["Product", "Cost", "Regular", "Reseller", "Profit", "Status"]}
      rows={[
        ["Netflix Premium UHD", "Rp25.000", "Rp38.000", "Rp35.000", "Rp13.000", "Active"],
        ["Spotify Premium", "Rp20.000", "Rp30.000", "Rp27.000", "Rp10.000", "Active"],
      ]}
    />
  )
}
