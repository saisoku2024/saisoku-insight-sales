import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function VouchersPage() {
  return (
    <FeaturePlaceholder
      badge="BUSINESS"
      title="Voucher Management"
      description="Manage all active vouchers."
      features={["Add Voucher", "Discount Type", "Quota Tracking", "Expired Date"]}
      columns={["Code", "Name", "Type", "Value", "Qty", "Used", "Remaining", "Expired", "Status"]}
      rows={[
        ["WELCOME10", "Welcome User", "Discount %", "10%", "100", "24", "76", "30 Jul 2026", "Active"],
      ]}
    />
  )
}
