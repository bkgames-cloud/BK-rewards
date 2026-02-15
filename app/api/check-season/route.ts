import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// API route to check and potentially reset the season
// This can be called by a cron job or manually
export async function GET() {
  const supabase = await createClient()

  // Get current active season (utiliser limit(1).maybeSingle pour éviter l'erreur si plusieurs saisons actives)
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()

  if (!season) {
    return NextResponse.json({ message: "No active season found" }, { status: 404 })
  }

  const endDate = new Date(season.end_date)
  const now = new Date()

  if (endDate <= now) {
    // Season has expired - trigger reset
    // This calls the SQL function we created
    const { error } = await supabase.rpc("reset_season")

    if (error) {
      return NextResponse.json({ message: "Error resetting season", error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: "Season reset successfully" })
  }

  return NextResponse.json({
    message: "Season is still active",
    endsAt: season.end_date,
    timeRemaining: endDate.getTime() - now.getTime(),
  })
}
