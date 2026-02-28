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

  const body = await req.json().catch(() => ({ userId: null, payload: null }))
  const userId = body.userId as string | null
  const payload = body.payload as Record<string, unknown> | null
  if (!userId || !payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  const safePayload: Record<string, unknown> = {}
  if (typeof payload.points === "number") safePayload.points = payload.points
  if (typeof payload.is_vip === "boolean") safePayload.is_vip = payload.is_vip
  if (typeof payload.is_vip_plus === "boolean") safePayload.is_vip_plus = payload.is_vip_plus
  if (payload.vip_until !== undefined) {
    if (payload.vip_until === null || typeof payload.vip_until === "string") {
      safePayload.vip_until = payload.vip_until
    }
  }

  const { error } = await admin
    .from("profiles")
    .update(safePayload)
    .eq("id", userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
