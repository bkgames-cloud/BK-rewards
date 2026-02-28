"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type UserRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  points: number
  is_vip: boolean
  is_vip_plus: boolean
  vip_until: string | null
}

type RewardPoolRow = {
  id: string
  name: string
  target_videos: number
  current_videos: number
  image_url: string | null
  ticket_cost: number | null
}

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

export function AdminPanel() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [pools, setPools] = useState<RewardPoolRow[]>([])
  const [rewards, setRewards] = useState<RewardRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPools, setLoadingPools] = useState(true)
  const [loadingRewards, setLoadingRewards] = useState(true)
  const [testingEmail, setTestingEmail] = useState(false)
  const [updatingReward, setUpdatingReward] = useState<string | null>(null)

  const [newPool, setNewPool] = useState({
    name: "",
    target_videos: 0,
    image_url: "",
    ticket_cost: 10,
  })

  const fetchUsers = async () => {
    setLoadingUsers(true)
    const response = await fetch("/api/admin/users/list", { cache: "no-store" })
    const data = await response.json().catch(() => ({ users: [] }))
    setUsers(data.users || [])
    setLoadingUsers(false)
  }

  const fetchPools = async () => {
    setLoadingPools(true)
    const response = await fetch("/api/admin/rewards-pools/list", { cache: "no-store" })
    const data = await response.json().catch(() => ({ pools: [] }))
    setPools(data.pools || [])
    setLoadingPools(false)
  }

  const fetchRewards = async () => {
    setLoadingRewards(true)
    const response = await fetch("/api/admin/rewards/list", { cache: "no-store" })
    const data = await response.json().catch(() => ({ rewards: [] }))
    setRewards(data.rewards || [])
    setLoadingRewards(false)
  }

  useEffect(() => {
    fetchUsers()
    fetchPools()
    fetchRewards()
  }, [])

  const updateUser = async (userId: string, payload: Partial<UserRow>) => {
    await fetch("/api/admin/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, payload }),
    })
    await fetchUsers()
  }

  const createPool = async () => {
    await fetch("/api/admin/rewards-pools/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPool),
    })
    setNewPool({ name: "", target_videos: 0, image_url: "", ticket_cost: 10 })
    await fetchPools()
  }

  const deletePool = async (poolId: string) => {
    await fetch("/api/admin/rewards-pools/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId }),
    })
    await fetchPools()
  }

  const testEmail = async () => {
    setTestingEmail(true)
    await fetch("/api/admin/rewards/test-email", { method: "POST" })
    setTestingEmail(false)
  }

  const markSent = async (rewardId: string) => {
    setUpdatingReward(rewardId)
    await fetch("/api/admin/rewards/mark-sent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rewardId }),
    })
    await fetchRewards()
    setUpdatingReward(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Administration</h2>
        <p className="text-sm text-muted-foreground">Gestion VIP, points, lots et gagnants.</p>
      </div>

      <Tabs defaultValue="vip">
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="vip">VIP & Points</TabsTrigger>
          <TabsTrigger value="pools">Lots</TabsTrigger>
          <TabsTrigger value="winners">Gagnants</TabsTrigger>
        </TabsList>

        <TabsContent value="vip" className="space-y-3">
          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Gestion VIP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingUsers ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-lg border border-border/40 p-3">
                      <div className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {user.first_name || "Utilisateur"} {user.last_name || ""}
                        </span>{" "}
                        — {user.email}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <Label>Points</Label>
                          <Input
                            type="number"
                            value={user.points}
                            onChange={(e) => updateUser(user.id, { points: Number(e.target.value) })}
                          />
                        </div>
                        <div>
                          <Label>VIP</Label>
                          <Button
                            className="w-full"
                            variant={user.is_vip ? "secondary" : "outline"}
                            onClick={() => updateUser(user.id, { is_vip: !user.is_vip })}
                          >
                            {user.is_vip ? "Désactiver VIP" : "Activer VIP"}
                          </Button>
                        </div>
                        <div>
                          <Label>VIP+</Label>
                          <Button
                            className="w-full"
                            variant={user.is_vip_plus ? "secondary" : "outline"}
                            onClick={() => updateUser(user.id, { is_vip_plus: !user.is_vip_plus })}
                          >
                            {user.is_vip_plus ? "Désactiver VIP+" : "Activer VIP+"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pools" className="space-y-3">
          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Gestion des lots</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Nom du lot"
                  value={newPool.name}
                  onChange={(e) => setNewPool((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="Image URL"
                  value={newPool.image_url}
                  onChange={(e) => setNewPool((prev) => ({ ...prev, image_url: e.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Cible vidéos"
                  value={newPool.target_videos}
                  onChange={(e) => setNewPool((prev) => ({ ...prev, target_videos: Number(e.target.value) }))}
                />
                <Input
                  type="number"
                  placeholder="Coût points"
                  value={newPool.ticket_cost}
                  onChange={(e) => setNewPool((prev) => ({ ...prev, ticket_cost: Number(e.target.value) }))}
                />
              </div>
              <Button onClick={createPool}>Créer le lot</Button>
            </CardContent>
          </Card>

          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Lots existants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingPools ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (
                pools.map((pool) => (
                  <div key={pool.id} className="flex items-center justify-between rounded-lg border border-border/40 p-2 text-sm">
                    <div>
                      <p className="font-semibold text-foreground">{pool.name}</p>
                      <p className="text-muted-foreground">
                        {pool.current_videos} / {pool.target_videos} • {pool.ticket_cost ?? 10} points
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => deletePool(pool.id)}>
                      Supprimer
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="winners" className="space-y-3">
          <Button onClick={testEmail} disabled={testingEmail} className="w-full sm:w-auto">
            {testingEmail ? "Test en cours..." : "Tester l'envoi email"}
          </Button>

          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Gains en attente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingRewards ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : rewards.length > 0 ? (
                rewards.map((reward) => (
                  <div key={reward.id} className="rounded-lg border border-border/40 p-3 text-sm">
                    <p>Gagnant : <span className="font-semibold text-foreground">{reward.display_name}</span></p>
                    <p>Email : <span className="font-semibold text-foreground">{reward.email}</span></p>
                    <p>Lot : <span className="font-semibold text-foreground">{rewardLabel(reward.reward_type)}</span></p>
                    <p>Statut : <span className="font-semibold text-foreground">{reward.status}</span></p>
                    {reward.status === "pending" && (
                      <Button
                        className="mt-2 w-full"
                        onClick={() => markSent(reward.id)}
                        disabled={updatingReward === reward.id}
                      >
                        {updatingReward === reward.id ? "Mise à jour..." : "Marquer comme envoyé"}
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun gain en attente.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
