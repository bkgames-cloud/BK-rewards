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

  const { code } = await req.json().catch(() => ({ code: "" }))
  const referralCode = String(code || "").trim().toUpperCase()
  if (!referralCode) {
    return NextResponse.json({ success: false, message: "invalid_code" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ success: false, message: "missing_env" }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  const { data: currentProfile, error: currentError } = await admin
    .from("profiles")
    .select("id, referred_by, points")
    .eq("id", user.id)
    .single()

  if (currentError || !currentProfile) {
    return NextResponse.json({ success: false, message: "profile_not_found" }, { status: 404 })
  }

  if (currentProfile.referred_by) {
    return NextResponse.json({ success: false, message: "already_referred" }, { status: 409 })
  }

  const { data: referrer, error: referrerError } = await admin
    .from("profiles")
    .select("id, points")
    .eq("referral_code", referralCode)
    .single()

  if (referrerError || !referrer) {
    return NextResponse.json({ success: false, message: "invalid_code" }, { status: 404 })
  }

  if (referrer.id === user.id) {
    return NextResponse.json({ success: false, message: "self_referral" }, { status: 400 })
  }

  const referrerPoints = (referrer.points || 0) + 10
  const currentPoints = (currentProfile.points || 0) + 5

  const { error: referrerUpdateError } = await admin
    .from("profiles")
    .update({ points: referrerPoints })
    .eq("id", referrer.id)

  if (referrerUpdateError) {
    return NextResponse.json({ success: false, message: "update_failed" }, { status: 500 })
  }

  const { error: currentUpdateError } = await admin
    .from("profiles")
    .update({ points: currentPoints, referred_by: referrer.id })
    .eq("id", user.id)

  if (currentUpdateError) {
    return NextResponse.json({ success: false, message: "update_failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true, new_points: currentPoints })
}
