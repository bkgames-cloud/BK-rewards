import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response("Missing env vars", { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_vip, is_vip_plus, points, last_claim_date")
    .eq("id", user.id)
    .single()

  if (error || !profile) {
    return new Response("Profile not found", { status: 404 })
  }

  if (!profile.is_vip && !profile.is_vip_plus) {
    return new Response("Not VIP", { status: 403 })
  }

  const now = new Date()
  const lastClaim = profile.last_claim_date ? new Date(profile.last_claim_date) : null
  if (lastClaim && lastClaim.toDateString() === now.toDateString()) {
    return new Response("Already claimed", { status: 409 })
  }

  const newPoints = (profile.points || 0) + 10
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      points: newPoints,
      last_claim_date: now.toISOString(),
    })
    .eq("id", user.id)

  if (updateError) {
    return new Response("Update failed", { status: 500 })
  }

  return Response.json({ points: newPoints, last_claim_date: now.toISOString() })
}
