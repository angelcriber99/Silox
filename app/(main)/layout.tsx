import { AppFrame } from "@/components/layout/app-frame"
import { TwoFactorModal } from "@/components/auth/two-factor-modal"
import { NotesModal } from "@/components/dashboard/notes-modal"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppFrame>
      {children}
      <TwoFactorModal />
      <NotesModal />
    </AppFrame>
  )
}
