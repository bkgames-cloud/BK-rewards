import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, message: "not_authenticated" }, { status: 401 })
  }

  const { poolId, tickets } = await req.json().catch(() => ({ poolId: null, tickets: 0 }))
  const ticketsToSpend = Math.max(1, Math.floor(Number(tickets || 0)))
  if (!poolId || ticketsToSpend <= 0) {
    return NextResponse.json({ success: false, message: "invalid_payload" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: "missing_env" }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  const { data: lastContribution } = await admin
    .from("contributions")
    .select("created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastContribution?.created_at) {
    const lastTs = new Date(lastContribution.created_at).getTime()
    if (Date.now() - lastTs < 1000) {
      return NextResponse.json({ success: false, message: "rate_limited" }, { status: 429 })
    }
  }

  const { data: pool, error: poolError } = await admin
    .from("rewards_pools")
    .select("id, current_videos, target_videos, ticket_cost")
    .eq("id", poolId)
    .single()

  if (poolError || !pool) {
    return NextResponse.json({ success: false, message: "pool_not_found" }, { status: 404 })
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("points")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ success: false, message: "profile_not_found" }, { status: 404 })
  }

  const ticketCost = pool.ticket_cost || 10
  const pointsToSpend = ticketsToSpend * ticketCost
  const currentPoints = profile.points || 0
  if (currentPoints < pointsToSpend) {
    return NextResponse.json({ success: false, message: "insufficient_points" }, { status: 400 })
  }

  const newPoints = currentPoints - pointsToSpend
  const { error: updateError } = await admin
    .from("profiles")
    .update({ points: newPoints })
    .eq("id", user.id)

  if (updateError) {
    return NextResponse.json({ success: false, message: "update_failed" }, { status: 500 })
  }

  const { error: contributionError } = await admin
    .from("contributions")
    .insert({
      user_id: user.id,
      pool_id: poolId,
      tickets_earned: ticketsToSpend,
    })

  if (contributionError) {
    return NextResponse.json({ success: false, message: "contribution_failed" }, { status: 500 })
  }

  const newCurrent = (pool.current_videos || 0) + ticketsToSpend
  const { error: poolUpdateError } = await admin
    .from("rewards_pools")
    .update({ current_videos: newCurrent })
    .eq("id", poolId)

  if (poolUpdateError) {
    return NextResponse.json({ success: false, message: "pool_update_failed" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    new_points: newPoints,
    current_videos: newCurrent,
  })
}
