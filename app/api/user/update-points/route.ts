import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// Champs de timestamp autorisés (pour les cooldowns des mini-jeux)
const ALLOWED_TIMESTAMP_FIELDS = [
  "last_scratch_at",
  "last_wheel_at",
  "last_vip_slot_at",
] as const

export async function POST(req: Request) {
  // 1. Récupérer l'utilisateur depuis la session serveur (cookie)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  // 2. Lire le body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 })
  }

  const pointsToAdd = body.pointsToAdd as number | undefined
  const timestamps = body.timestamps as Record<string, string> | undefined

  // Au moins un champ doit être fourni
  if (pointsToAdd === undefined && !timestamps) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 })
  }

  if (pointsToAdd !== undefined && (typeof pointsToAdd !== "number" || !Number.isFinite(pointsToAdd))) {
    return NextResponse.json({ error: "pointsToAdd invalide" }, { status: 400 })
  }

  // 3. Utiliser le client admin pour contourner les RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[update-points] Missing SUPABASE_URL or SERVICE_ROLE_KEY")
    return NextResponse.json({ error: "Configuration serveur manquante" }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey)

  // 4. Construire le payload de mise à jour
  const updatePayload: Record<string, unknown> = {}

  // Points : lire l'ancien solde puis calculer le nouveau
  if (typeof pointsToAdd === "number") {
    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("points")
      .eq("id", user.id)
      .single()

    if (readError || !profile) {
      console.error("[update-points] Profile read error:", readError)
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })
    }

    updatePayload.points = Math.max(0, (profile.points || 0) + pointsToAdd)
  }

  // Timestamps : n'accepter que les champs autorisés
  if (timestamps && typeof timestamps === "object") {
    for (const field of ALLOWED_TIMESTAMP_FIELDS) {
      if (typeof timestamps[field] === "string") {
        updatePayload[field] = timestamps[field]
      }
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 })
  }

  // 5. Écrire en une seule requête
  const { error: updateError } = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id)

  if (updateError) {
    console.error("[update-points] Update error:", updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    ...(updatePayload.points !== undefined ? { points: updatePayload.points } : {}),
  })
}
