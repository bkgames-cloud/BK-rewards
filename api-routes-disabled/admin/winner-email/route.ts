import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { emailMatchesAdmin } from "@/lib/admin-config"

/**
 * Récupère l’e-mail Auth du user (service role). Réservé à la session admin.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user?.email || !emailMatchesAdmin(user.email)) {
      return NextResponse.json({ error: "interdit" }, { status: 403 })
    }

    let body: { userId?: string }
    try {
      body = (await request.json()) as { userId?: string }
    } catch {
      return NextResponse.json({ error: "json_invalide" }, { status: 400 })
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : ""
    if (!userId) {
      return NextResponse.json({ error: "userId_requis" }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      console.warn("[winner-email] SUPABASE_SERVICE_ROLE_KEY ou URL manquant")
      return NextResponse.json({ email: null as string | null, reason: "service_role_absent" })
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error) {
      console.error("[winner-email] getUserById:", error.message)
      return NextResponse.json({ email: null as string | null, reason: error.message })
    }

    const email = data.user?.email?.trim() ?? null
    return NextResponse.json({ email })
  } catch (e) {
    console.error("[winner-email]", e)
    return NextResponse.json({ error: "serveur" }, { status: 500 })
  }
}
