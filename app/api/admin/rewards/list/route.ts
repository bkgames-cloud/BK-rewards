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

  const { data: rewards, error } = await admin
    .from("rewards")
    .select("id, user_id, reward_type, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = Array.from(new Set((rewards || []).map((row) => row.user_id)))
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds)

  const profileMap = new Map(
    (profiles || []).map((p) => [
      p.id,
      {
        name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "VIP+",
      },
    ]),
  )

  const emailEntries = await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id)
      return [id, data?.user?.email || ""] as const
    }),
  )
  const emailMap = new Map(emailEntries)

  const result = (rewards || []).map((reward) => ({
    id: reward.id,
    reward_type: reward.reward_type,
    status: reward.status,
    created_at: reward.created_at,
    display_name: profileMap.get(reward.user_id)?.name || "VIP+",
    email: emailMap.get(reward.user_id) || "",
  }))

  return NextResponse.json({ rewards: result })
}
