import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const ADMIN_EMAIL = "bkgamers@icloud.com"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const name = body.name as string
  const target_videos = Number(body.target_videos || 0)
  const ticket_cost = Number(body.ticket_cost || 10)
  const image_url = body.image_url ? String(body.image_url) : null

  if (!name || target_videos <= 0) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  const { error } = await admin
    .from("rewards_pools")
    .insert({ name, target_videos, current_videos: 0, image_url, ticket_cost })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
