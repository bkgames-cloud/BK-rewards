import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? ""
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "bkgamers@icloud.com"
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "BKG Rewards <no-reply@bkg-rewards.com>"

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

Deno.serve(async () => {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const previousWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const previousWeekEnd = new Date(weekStart)

  const { data: winnerRows, error: winnerError } = await supabase
    .from("tap_tap_leaderboard")
    .select("user_id, score")
    .gte("created_at", previousWeekStart.toISOString())
    .lt("created_at", previousWeekEnd.toISOString())
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)

  if (winnerError) {
    return new Response(JSON.stringify({ error: winnerError.message }), { status: 500 })
  }

  if (!winnerRows || winnerRows.length === 0) {
    return new Response(JSON.stringify({ ok: true, message: "No scores for previous week." }), { status: 200 })
  }

  const winner = winnerRows[0] as { user_id: string; score: number }

  const getIsoWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  }

  const weekNumber = getIsoWeek(previousWeekStart)

  const { data: already, error: alreadyError } = await supabase
    .from("history_leaderboard")
    .select("id")
    .eq("week_number", weekNumber)
    .limit(1)

  if (alreadyError) {
    return new Response(JSON.stringify({ error: alreadyError.message }), { status: 500 })
  }

  if (already && already.length > 0) {
    return new Response(JSON.stringify({ ok: true, message: "Winner already processed." }), { status: 200 })
  }

  const { data: vipPlusCountData, error: vipPlusError } = await supabase
    .rpc("get_vip_plus_count")

  if (vipPlusError) {
    return new Response(JSON.stringify({ error: vipPlusError.message }), { status: 500 })
  }

  const vipPlusCount = typeof vipPlusCountData === "number" ? vipPlusCountData : 0
  const isCashTournament = vipPlusCount >= 5

  const { data: winnerProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, points")
    .eq("id", winner.user_id)
    .maybeSingle()

  const displayName =
    (winnerProfile?.first_name || winnerProfile?.last_name)
      ? `${winnerProfile?.first_name || ""} ${winnerProfile?.last_name || ""}`.trim()
      : winnerProfile?.email || "VIP+"

  let prizeLabel = "500 points"
  let prizeType = "points"
  let status = "attribue"
  let rewardStatus: "pending" | "sent" = "sent"
  let rewardType = "points_500"

  if (isCashTournament) {
    prizeLabel = "Carte 10€"
    prizeType = "gift_card"
    status = "a_envoyer"
    rewardStatus = "pending"
    rewardType = "gift_card_10"
  } else {
    const newPoints = (winnerProfile?.points || 0) + 500
    await supabase
      .from("profiles")
      .update({ points: newPoints })
      .eq("id", winner.user_id)
  }

  await supabase.from("history_leaderboard").insert({
    user_id: winner.user_id,
    display_name: displayName,
    score: winner.score,
    week_number: weekNumber,
    prize_type: prizeType,
    prize_label: prizeLabel,
    status,
  })

  await supabase.from("rewards").insert({
    user_id: winner.user_id,
    reward_type: rewardType,
    status: rewardStatus,
  })

  if (RESEND_API_KEY) {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [ADMIN_EMAIL],
        subject: "🏆 [BKG Rewards] Nouveau Vainqueur Mini-Jeu !",
        html: `
          <p>Le tournoi hebdomadaire Tap-Tap est terminé.</p>
          <p><strong>Gagnant :</strong> ${displayName}</p>
          <p><strong>Score :</strong> ${winner.score}</p>
          <p><strong>Lot remporté :</strong> ${prizeLabel}</p>
          <p>Ce gain est lié au Mini-jeu Tap-Tap VIP+.</p>
        `,
      }),
    })
    if (!emailResponse.ok) {
      const error = await emailResponse.text()
      console.error("[VIP+ Weekly] Resend error:", error)
    }
  }

  return new Response(JSON.stringify({ ok: true, winner: displayName, prize: prizeLabel }), { status: 200 })
})
