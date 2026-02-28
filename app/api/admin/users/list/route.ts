import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const ADMIN_EMAIL = "bkgamers@icloud.com"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, first_name, last_name, points, is_vip, is_vip_plus, vip_until")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const emailEntries = await Promise.all(
    (profiles || []).map(async (profile) => {
      const { data } = await admin.auth.admin.getUserById(profile.id)
      return [profile.id, data?.user?.email || ""] as const
    }),
  )
  const emailMap = new Map(emailEntries)

  const result = (profiles || []).map((profile) => ({
    ...profile,
    email: emailMap.get(profile.id) || "",
  }))

  return NextResponse.json({ users: result })
}
