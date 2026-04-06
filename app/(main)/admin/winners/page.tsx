"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient as supabaseBrowser } from "@/lib/supabase/client"

type RewardRow = {
  id: string
  display_name: string
  email: string
  reward_type: string
  status: "pending" | "sent"
  created_at: string
}

const rewardLabel = (type: string) => {
  if (type === "points_500") return "500 points"
  if (type === "gift_card_10") return "Carte 10€"
  return type
}

export default function AdminWinnersPage() {
  const [rewards, setRewards] = useState<RewardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [testingEmail, setTestingEmail] = useState(false)

  const fetchRewards = async () => {
    setLoading(true)
    const supabase = supabaseBrowser()
    const { data: rewardsData } = await supabase
      .from("rewards")
      .select("id, user_id, reward_type, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
    const rows = (rewardsData || []) as Array<{ id: string; user_id: string; reward_type: string; status: "pending" | "sent"; created_at: string }>
    const ids = Array.from(new Set(rows.map((r) => r.user_id)))
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, first_name, last_name").in("id", ids)
      : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }> }
    const nameMap = new Map((profiles || []).map((p) => [p.id, `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Utilisateur"]))
    setRewards(rows.map((r) => ({ ...r, display_name: nameMap.get(r.user_id) || "Utilisateur", email: "" })))
    setLoading(false)
  }

  useEffect(() => {
    fetchRewards()
  }, [])

  const markSent = async (rewardId: string) => {
    setUpdatingId(rewardId)
    const supabase = supabaseBrowser()
    await supabase.from("rewards").update({ status: "sent" }).eq("id", rewardId)
    await fetchRewards()
    setUpdatingId(null)
  }

  const testEmail = async () => {
    setTestingEmail(true)
    // Sans backend API, test email non disponible.
    setTestingEmail(false)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Gains Tap-Tap VIP+</h2>
        <p className="text-sm text-muted-foreground">
          Gagnants en attente d&apos;envoi (carte) ou déjà crédités.
        </p>
      </div>
      <Button onClick={testEmail} disabled={testingEmail} className="w-full sm:w-auto">
        {testingEmail ? "Test en cours..." : "Tester l'envoi email"}
      </Button>

      {loading ? (
        <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Chargement...
          </CardContent>
        </Card>
      ) : rewards.length > 0 ? (
        <div className="grid gap-4">
          {rewards.map((reward) => (
            <Card key={reward.id} className="border border-border/50 bg-[#1a1a1a] shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">
                  {rewardLabel(reward.reward_type)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Gagnant : <span className="font-semibold text-foreground">{reward.display_name}</span></p>
                <p>Email : <span className="font-semibold text-foreground">{reward.email}</span></p>
                <p>Statut : <span className="font-semibold text-foreground">{reward.status}</span></p>
                <p>Créé le : {new Date(reward.created_at).toLocaleDateString("fr-FR")}</p>
                {reward.status === "pending" && (
                  <Button
                    className="w-full"
                    onClick={() => markSent(reward.id)}
                    disabled={updatingId === reward.id}
                  >
                    {updatingId === reward.id ? "Mise à jour..." : "Marquer comme envoyé"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun gain en attente.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
