import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder"

export default function TicketsPage() {
  return (
    <FeaturePlaceholder
      badge="TICKET MANAGEMENT"
      title="Tickets"
      description="The Ticket Management features are currently being deployed."
      features={["Open Tickets", "User Support", "Resolution Status", "Admin Assignment"]}
      note="Mengikuti mockup final: halaman Tickets masih under construction. Route sudah tersedia agar sidebar final tidak menghasilkan 404."
    />
  )
}
