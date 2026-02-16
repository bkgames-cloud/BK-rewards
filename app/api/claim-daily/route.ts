import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_vip, points, last_claim_date")
    .eq("id", user.id)
    .single()

  if (error || !profile) {
    return new Response("Profile not found", { status: 404 })
  }

  if (!profile.is_vip) {
    return new Response("Not VIP", { status: 403 })
  }

  const now = new Date()
  const lastClaim = profile.last_claim_date ? new Date(profile.last_claim_date) : null
  if (lastClaim && lastClaim.toDateString() === now.toDateString()) {
    return new Response("Already claimed", { status: 409 })
  }

  const newPoints = (profile.points || 0) + 10
  const { error: updateError } = await supabase
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
