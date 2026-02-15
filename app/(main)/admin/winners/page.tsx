import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"

export default async function AdminWinnersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.id) {
    redirect("/auth/login")
  }

  let profile = null
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()
    
    if (!profileError) {
      profile = profileData
    }
  } catch (error) {
    console.error("[AdminWinnersPage] Error loading profile:", error)
  }

  if (!profile?.is_admin) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-semibold text-foreground">Administration</h2>
        <p className="text-sm text-muted-foreground">Accès réservé à l&apos;administration.</p>
      </div>
    )
  }

  const { data: winners, error: winnersError } = await supabase
    .from("gagnants")
    .select("*")
    .order("created_at", { ascending: false })

  if (winnersError) {
    console.error("[AdminWinnersPage] Error loading winners:", winnersError)
  }

  // Get cadeaux info separately to avoid 404 on relation
  let cadeauxMap: Record<string, { nom: string }> = {}
  if (winners && winners.length > 0) {
    const cadeauIds = [...new Set(winners.map((w) => w.cadeau_id).filter(Boolean))]
    if (cadeauIds.length > 0) {
      const { data: cadeaux, error: cadeauxError } = await supabase
        .from("cadeaux")
        .select("id, nom")
        .in("id", cadeauIds)

      if (cadeauxError) {
        console.error("[AdminWinnersPage] Error loading cadeaux:", cadeauxError)
      } else if (cadeaux) {
        cadeauxMap = cadeaux.reduce(
          (acc, c) => {
            acc[c.id] = { nom: c.nom }
            return acc
          },
          {} as Record<string, { nom: string }>,
        )
      }
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold text-foreground">Gagnants</h2>
      <p className="text-sm text-muted-foreground">Liste des gagnants et leurs emails.</p>

      {!winners || winners.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Trophy className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-center text-muted-foreground">Aucun gagnant pour le moment.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {winners.map((winner) => {
            const cadeau = winner.cadeau_id ? cadeauxMap[winner.cadeau_id] : null
            return (
              <Card key={winner.id} className="border-accent bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-foreground">
                    {cadeau?.nom || "Cadeau"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>Email : {winner.email || "Non renseigné"}</p>
                  <p>Gagnant le {new Date(winner.created_at).toLocaleDateString("fr-FR")}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
