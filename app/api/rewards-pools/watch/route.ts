import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

const DAILY_LIMIT = 25

export async function POST(req: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, message: "not_authenticated" }, { status: 401 })
  }

  const { poolId } = await req.json().catch(() => ({ poolId: null }))
  if (!poolId) {
    return NextResponse.json({ success: false, message: "missing_pool_id" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: "missing_env" }, { status: 500 })
  }

  const supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey)

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: todayCount } = await supabaseAdmin
    .from("rewards_pool_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", todayStart.toISOString())

  if ((todayCount || 0) >= DAILY_LIMIT) {
    return NextResponse.json({ success: false, message: "day_limit" }, { status: 429 })
  }

  const { data: pool, error: poolError } = await supabaseAdmin
    .from("rewards_pools")
    .select("id, current_videos, target_videos")
    .eq("id", poolId)
    .single()

  if (poolError || !pool) {
    return NextResponse.json({ success: false, message: "pool_not_found" }, { status: 404 })
  }

  const { error: insertError } = await supabaseAdmin
    .from("rewards_pool_views")
    .insert({
      pool_id: poolId,
      user_id: user.id,
    })

  if (insertError) {
    return NextResponse.json({ success: false, message: "insert_failed" }, { status: 500 })
  }

  const updatedCurrent = (pool.current_videos || 0) + 1
  const { error: updateError } = await supabaseAdmin
    .from("rewards_pools")
    .update({ current_videos: updatedCurrent })
    .eq("id", poolId)

  if (updateError) {
    return NextResponse.json({ success: false, message: "update_failed" }, { status: 500 })
  }

  const { count: userViews } = await supabaseAdmin
    .from("rewards_pool_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("pool_id", poolId)

  const userTickets = Math.floor((userViews || 0) / 10)

  return NextResponse.json({
    success: true,
    current_videos: updatedCurrent,
    target_videos: pool.target_videos,
    user_views: userViews || 0,
    user_tickets: userTickets,
  })
}
