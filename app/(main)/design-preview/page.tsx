import { notFound } from "next/navigation"

import { DashboardPreview } from "@/components/design/dashboard-preview"

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound()

  return <DashboardPreview />
}
