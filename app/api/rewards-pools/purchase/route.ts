import { NextResponse } from "next/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

// Mapper le nom du lot vers le reward_type
function getRewardType(poolName: string): string {
  const lowerName = poolName.toLowerCase()
  
  if (lowerName.includes("iphone")) return "iphone"
  if (lowerName.includes("samsung")) return "samsung"
  if (lowerName.includes("ps5") || lowerName.includes("playstation")) return "ps5"
  if (lowerName.includes("nintendo") || lowerName.includes("switch")) return "nintendo_switch"
  if (lowerName.includes("amazon")) {
    if (lowerName.includes("20")) return "gift_card_amazon_20"
    return "gift_card_amazon"
  }
  if (lowerName.includes("google") || lowerName.includes("play")) {
    if (lowerName.includes("10")) return "gift_card_google_10"
    return "gift_card_google"
  }
  if (lowerName.includes("psn")) {
    if (lowerName.includes("5")) return "gift_card_psn_5"
    return "gift_card_psn"
  }
  
  // Fallback: utiliser le nom du lot en format snake_case
  return poolName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
}

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
    return NextResponse.json({ success: false, message: "invalid_payload" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: "missing_env" }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  // Récupérer le lot
  const { data: pool, error: poolError } = await admin
    .from("rewards_pools")
    .select("id, name, ticket_cost")
    .eq("id", poolId)
    .single()

  if (poolError || !pool) {
    return NextResponse.json({ success: false, message: "pool_not_found" }, { status: 404 })
  }

  // Récupérer le profil utilisateur
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("points")
    .eq("id", user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ success: false, message: "profile_not_found" }, { status: 404 })
  }

  // Calculer le coût (utiliser ticket_cost comme prix en points)
  const cost = pool.ticket_cost || 10
  const currentPoints = profile.points || 0

  if (currentPoints < cost) {
    return NextResponse.json({ success: false, message: "insufficient_points" }, { status: 400 })
  }

  // Déduire les points
  const newPoints = currentPoints - cost
  const { error: updateError } = await admin
    .from("profiles")
    .update({ points: newPoints })
    .eq("id", user.id)

  if (updateError) {
    return NextResponse.json({ success: false, message: "update_failed" }, { status: 500 })
  }

  // Créer l'entrée dans rewards
  const rewardType = getRewardType(pool.name)
  const { error: rewardError } = await admin
    .from("rewards")
    .insert({
      user_id: user.id,
      reward_type: rewardType,
      status: "pending",
    })

  if (rewardError) {
    // Rollback: remettre les points si l'insertion échoue
    await admin
      .from("profiles")
      .update({ points: currentPoints })
      .eq("id", user.id)
    return NextResponse.json({ success: false, message: "reward_creation_failed" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    new_points: newPoints,
    reward_type: rewardType,
  })
}
