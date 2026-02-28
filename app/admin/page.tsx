import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminPanel } from "@/components/admin-panel"

const ADMIN_EMAIL = "bkgamers@icloud.com"

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || user.email !== ADMIN_EMAIL) {
    redirect("/")
  }

  return <AdminPanel />
}
