"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient as supabaseBrowser } from "@/lib/supabase/client"
import { REWARDS_POOLS_SELECT } from "@/lib/rewards-pools-columns"
import {
  getNumFromRow,
  getPoolCurrent,
  getPoolTarget,
} from "@/lib/rewards-pool-normalize"
import { formatCooldownMmSs, remainingCooldownMs } from "@/lib/draw-cooldown"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { getApiUrl } from "@/lib/api-origin"
import type { ProfileAddressColumns } from "@/lib/profile-address"
import { insertPrizeShippedNotification } from "@/lib/db-notifications"
import { updateUserPoints } from "@/lib/update-user-points"

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
  is_active?: boolean
  ticket_count?: number
  /** Au moins un gagnant enregistre pour ce lot (affiche « Tirage termine » si le lot n’est pas encore replein). */
  has_winner?: boolean
  last_draw_at: string | null
}

type RewardRow = {
  id: string
  user_id: string
  display_name: string
  /** Copie de winner_email (affichage). */
  email: string
  winner_email: string
  prize_name: string
  status: "pending" | "sent" | "shipped" | "received"
  created_at: string
}

type DrawHistoryRow = {
  id: string
  winner_name: string
  prize_name: string
  created_at: string | null
  pool_id?: string | null
}

function normalizePool(row: Record<string, unknown>): RewardPoolRow {
  const rawLast = row.last_draw_at
  const last_draw_at =
    typeof rawLast === "string" && rawLast.trim() !== "" ? rawLast : null
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Lot"),
    target_videos: getPoolTarget(row),
    current_videos: getPoolCurrent(row),
    image_url: typeof row.image_url === "string" ? row.image_url : null,
    ticket_cost: getNumFromRow(row, ["ticket_cost", "cost", "points_cost"], 10),
    is_active: row.is_active === false ? false : true,
    last_draw_at,
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

async function parseResponseJson(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    console.warn("[admin] Reponse non JSON (status", res.status, ")")
    return null
  }
}

async function sendWinnerEmailViaApi(
  params: {
    winnerEmail: string
    winnerName: string
    poolName: string
  } & Partial<ProfileAddressColumns>,
): Promise<{ ok: boolean; message?: string }> {
  try {
    const url = getApiUrl("/api/send-email")
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        mode: "draw" as const,
        winnerEmail: params.winnerEmail.trim() || undefined,
        winnerName: params.winnerName,
        poolName: params.poolName,
        adresse: params.adresse?.trim() || undefined,
        code_postal: params.code_postal?.trim() || undefined,
        ville: params.ville?.trim() || undefined,
      }),
    })
    const data = await parseResponseJson(res)
    if (!res.ok) {
      console.error("[admin] send-email:", data, "status", res.status)
      const err = data && typeof data.error === "string" ? data.error : `http_${res.status}`
      return { ok: false, message: err }
    }
    if (!data) {
      return { ok: false, message: "reponse_vide" }
    }
    if (data.skipped === true) {
      console.warn("[admin] Email non envoye:", data.message)
    }
    return { ok: true, message: typeof data.message === "string" ? data.message : undefined }
  } catch (e) {
    console.error("[admin] send-email fetch:", e)
    return { ok: false, message: "reseau" }
  }
}

async function sendPrizeShippedEmailViaApi(params: {
  winnerEmail: string
  winnerName: string
  poolName: string
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const url = getApiUrl("/api/send-email")
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        mode: "prize_shipped" as const,
        winnerEmail: params.winnerEmail.trim() || undefined,
        winnerName: params.winnerName,
        poolName: params.poolName,
      }),
    })
    const data = await parseResponseJson(res)
    if (!res.ok) {
      console.error("[admin] send-email prize_shipped:", data, "status", res.status)
      const err = data && typeof data.error === "string" ? data.error : `http_${res.status}`
      return { ok: false, message: err }
    }
    if (!data) {
      return { ok: false, message: "reponse_vide" }
    }
    if (data.skipped === true) {
      console.warn("[admin] Email expédition non envoye:", data.message)
    }
    return { ok: true, message: typeof data.message === "string" ? data.message : undefined }
  } catch (e) {
    console.error("[admin] send-email prize_shipped fetch:", e)
    return { ok: false, message: "reseau" }
  }
}

async function insertWinnerNotification(
  supabase: ReturnType<typeof supabaseBrowser>,
  winnerId: string,
  poolName: string,
) {
  const lot = String(poolName || "lot")
  const msg = `Félicitations, tu as remporté le lot ${lot}. Vérifie tes emails pour les détails de livraison.`
  const { error } = await supabase.from("notifications").insert({
    user_id: winnerId,
    title: "🎉 Tu as gagné !",
    message: msg,
    created_at: new Date().toISOString(),
  })
  return error ? error.message : null
}

export function AdminPanel() {
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [pools, setPools] = useState<RewardPoolRow[]>([])
  const [rewards, setRewards] = useState<RewardRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPools, setLoadingPools] = useState(true)
  const [loadingRewards, setLoadingRewards] = useState(true)
  const [testingEmail, setTestingEmail] = useState(false)
  const [emailTestMessage, setEmailTestMessage] = useState<string | null>(null)
  const [updatingReward, setUpdatingReward] = useState<string | null>(null)
  const [prizeShipError, setPrizeShipError] = useState<string | null>(null)
  const [drawingPoolId, setDrawingPoolId] = useState<string | null>(null)
  const [drawMessage, setDrawMessage] = useState<string | null>(null)
  const [showDrawModal, setShowDrawModal] = useState(false)
  const [drawRollingName, setDrawRollingName] = useState<string>("...")
  const [drawFinalName, setDrawFinalName] = useState<string | null>(null)
  const [drawHistory, setDrawHistory] = useState<DrawHistoryRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  /** Lot vient d'etre tire : affiche « Tirage termine » jusqu'au prochain plein du seuil. */
  const [drawCompletedPoolIds, setDrawCompletedPoolIds] = useState<Set<string>>(new Set())
  const [drawCooldownTick, setDrawCooldownTick] = useState(0)

  const [newPool, setNewPool] = useState({
    name: "",
    target_videos: 0,
    image_url: "",
    ticket_cost: 10,
  })

  const fetchUsers = async () => {
    setLoadingUsers(true)
    const supabase = supabaseBrowser()
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, points, is_vip, is_vip_plus, vip_until")
    if (error) {
      console.error("Erreur Supabase:", error)
      setUsers([])
      setLoadingUsers(false)
      return
    }
    const rows = (data as Array<Record<string, unknown>> | null) || []
    const normalized = rows.map((row) => ({
      id: String(row.id ?? ""),
      email: typeof row.email === "string" ? row.email : "",
      first_name: (row.first_name as string | null | undefined) ?? null,
      last_name: (row.last_name as string | null | undefined) ?? null,
      points: Number(row.points ?? 0),
      is_vip: Boolean(row.is_vip),
      is_vip_plus: Boolean(row.is_vip_plus),
      vip_until: (row.vip_until as string | null | undefined) ?? null,
    }))
    setUsers(normalized)
    setLoadingUsers(false)
  }

  const fetchPools = async () => {
    setLoadingPools(true)
    const supabase = supabaseBrowser()
    const { data, error } = await supabase
      .from("rewards_pools")
      .select("*")
    if (error) {
      console.error("Erreur Supabase:", error)
      setPools([])
      setLoadingPools(false)
      return
    }
    const { data: winnersRows } = await supabase.from("winners").select("pool_id")
    const poolIdsWithWinner = new Set(
      ((winnersRows ?? []) as Array<{ pool_id?: string | null }>)
        .map((r) => r.pool_id)
        .filter((id): id is string => Boolean(id)),
    )
    const enriched = await Promise.all(
      ((data as Array<Record<string, unknown>> | null) || []).map(async (row) => {
        const pool = normalizePool(row)
        const { count } = await supabase
          .from("tickets")
          .select("id", { head: true, count: "exact" })
          .eq("pool_id", pool.id)
        return {
          ...pool,
          ticket_count: count || 0,
          has_winner: poolIdsWithWinner.has(pool.id),
        }
      }),
    )
    enriched.sort((a, b) => b.target_videos - a.target_videos)
    setPools(enriched)
    setLoadingPools(false)
  }

  const fetchPoolsRef = useRef(fetchPools)
  fetchPoolsRef.current = fetchPools

  useEffect(() => {
    const supabase = supabaseBrowser()
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const schedulePoolsRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        void fetchPoolsRef.current()
      }, 450)
    }
    const channel = supabase
      .channel("admin-rewards-pools-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rewards_pools" },
        schedulePoolsRefetch,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rewards_pools" },
        schedulePoolsRefetch,
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "rewards_pools" },
        schedulePoolsRefetch,
      )
      .subscribe()
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      void supabase.removeChannel(channel)
    }
  }, [])

  const fetchRewards = async () => {
    setPrizeShipError(null)
    setLoadingRewards(true)
    const supabase = supabaseBrowser()
    const { data: rows, error } = await supabase
      .from("winners")
      .select("id, user_id, winner_name, winner_email, prize_name, status, created_at")
      .in("status", ["pending", "shipped"])
      .order("created_at", { ascending: false })
    if (error) {
      console.error("[admin] fetchRewards winners:", error.message)
      setRewards([])
      setLoadingRewards(false)
      return
    }
    const list = (rows ?? []) as Array<{
      id: string
      user_id: string
      winner_name: string | null
      winner_email: string | null
      prize_name: string | null
      status: "pending" | "sent" | "shipped" | "received"
      created_at: string
    }>

    const idsSansEmail = [
      ...new Set(
        list
          .filter((r) => {
            const we = typeof r.winner_email === "string" ? r.winner_email.trim() : ""
            return !we && r.user_id
          })
          .map((r) => String(r.user_id)),
      ),
    ]

    const profileEmailByUserId = new Map<string, string>()
    if (idsSansEmail.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, email").in("id", idsSansEmail)
      for (const p of profs ?? []) {
        const row = p as { id?: string; email?: string | null }
        const id = String(row.id ?? "")
        const em = typeof row.email === "string" ? row.email.trim() : ""
        if (id && em) profileEmailByUserId.set(id, em)
      }
    }

    setRewards(
      list.map((r) => {
        let winnerEmailFromDb =
          typeof r.winner_email === "string" ? r.winner_email.trim() : ""
        if (!winnerEmailFromDb && r.user_id) {
          winnerEmailFromDb = profileEmailByUserId.get(String(r.user_id)) ?? ""
        }
        return {
          id: r.id,
          user_id: String(r.user_id ?? ""),
          prize_name: String(r.prize_name ?? "Lot"),
          status: r.status,
          created_at: r.created_at,
          display_name: String(r.winner_name || "").trim() || "Utilisateur",
          email: winnerEmailFromDb,
          winner_email: winnerEmailFromDb,
        }
      }),
    )
    setLoadingRewards(false)
  }

  const fetchDrawHistory = async () => {
    setLoadingHistory(true)
    const supabase = supabaseBrowser()
    let data: Array<Record<string, unknown>> | null = null
    const primary = await supabase
      .from("winners")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
    if (primary.error) {
      const fallback = await supabase
        .from("winners")
        .select("*")
        .order("id", { ascending: false })
        .limit(20)
      data = (fallback.data as Array<Record<string, unknown>> | null) ?? null
    } else {
      data = (primary.data as Array<Record<string, unknown>> | null) ?? null
    }
    setDrawHistory(
      (data || []).map((row, idx) => ({
        id: String(row.id ?? `${row.created_at ?? "row"}-${idx}`),
        winner_name: String(row.winner_name ?? row.user_name ?? row.name ?? "Gagnant"),
        prize_name: String(row.prize_name ?? row.reward_name ?? row.prize ?? "Lot"),
        created_at: (row.created_at as string | undefined) ?? null,
        pool_id: (row.pool_id as string | undefined) ?? null,
      })),
    )
    setLoadingHistory(false)
  }

  useEffect(() => {
    fetchUsers()
    fetchPools()
    fetchRewards()
    fetchDrawHistory()
  }, [])

  useEffect(() => {
    setDrawCompletedPoolIds((prev) => {
      const next = new Set(prev)
      for (const pool of pools) {
        if (pool.target_videos > 0 && pool.current_videos >= pool.target_videos) {
          next.delete(pool.id)
        }
      }
      return next
    })
  }, [pools])

  useEffect(() => {
    const id = window.setInterval(() => setDrawCooldownTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const updateUser = async (userId: string, payload: Partial<UserRow>) => {
    const supabase = supabaseBrowser()
    const cleaned = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined && v !== null),
    ) as Record<string, unknown>
    if ("points" in cleaned) {
      const p = Number(cleaned.points)
      cleaned.points = Number.isFinite(p) ? Math.max(0, Math.floor(p)) : 0
    }
    if (Object.keys(cleaned).length === 0) return
    if ("points" in cleaned) {
      const points = Number(cleaned.points ?? 0)
      const { points: _ignored, ...rest } = cleaned
      const res = await updateUserPoints(supabase, { userId, points, extra: rest })
      if (!res.ok) {
        console.error("[admin] updateUserPoints failed:", { error: res.error, details: res.details })
      }
    } else {
      await supabase.from("profiles").update(cleaned).eq("id", userId)
    }
    await fetchUsers()
  }

  const createPool = async () => {
    const supabase = supabaseBrowser()
    const payload = {
      name: newPool.name.trim(),
      target_videos: Math.max(0, Math.floor(Number(newPool.target_videos)) || 0),
      current_videos: 0,
      image_url: newPool.image_url?.trim() || null,
      ticket_cost: Math.max(0, Math.floor(Number(newPool.ticket_cost)) || 10),
    }
    const { error } = await supabase.from("rewards_pools").insert(payload)
    if (error) {
      console.error("Erreur Supabase:", error)
      setDrawMessage(`Erreur creation lot: ${error.message}`)
      return
    }
    setNewPool({ name: "", target_videos: 0, image_url: "", ticket_cost: 10 })
    await fetchPools()
  }

  const deletePool = async (poolId: string) => {
    const supabase = supabaseBrowser()
    await supabase.from("rewards_pools").delete().eq("id", poolId)
    await fetchPools()
  }

  const launchDraw = async (poolId: string) => {
    setDrawingPoolId(poolId)
    setDrawMessage(null)
    setDrawFinalName(null)
    try {
      const supabase = supabaseBrowser()
      const { data: pool } = await supabase
        .from("rewards_pools")
        .select("*")
        .eq("id", poolId)
        .maybeSingle()
      const normalizedPool = pool ? normalizePool(pool as Record<string, unknown>) : null
      if (!normalizedPool) {
        setDrawMessage("Lot introuvable.")
      } else {
        const { count: existingWinnersCount, error: winCheckErr } = await supabase
          .from("winners")
          .select("id", { count: "exact", head: true })
          .eq("pool_id", poolId)
        if (winCheckErr) {
          console.error("winners count:", winCheckErr)
        }
        if (
          !winCheckErr &&
          (existingWinnersCount ?? 0) > 0 &&
          (normalizedPool.current_videos ?? 0) === 0
        ) {
          setDrawMessage(
            "Tirage impossible : un tirage existe deja pour ce lot vide. Remplissez le lot jusqu'au seuil pour un nouveau tirage.",
          )
          return
        }
        if ((normalizedPool.current_videos ?? 0) < (normalizedPool.target_videos ?? 0)) {
          setDrawMessage("Objectif non atteint.")
          return
        }
        if (remainingCooldownMs(normalizedPool.last_draw_at, Date.now()) > 0) {
          setDrawMessage(
            "Delai de 60 minutes entre deux tirages sur ce lot : attendez la fin du compte a rebours.",
          )
          return
        }
        const { data: ticketRows } = await supabase.from("tickets").select("id, user_id").eq("pool_id", poolId)
        const candidates = (ticketRows || []).filter(
          (r: { id?: string; user_id?: string }) => r?.id && r?.user_id,
        ) as Array<{ id: string; user_id: string }>
        if (candidates.length === 0) {
          setDrawMessage("Aucun participant pour ce lot.")
          setDrawingPoolId(null)
          return
        }
        const picked = candidates[Math.floor(Math.random() * candidates.length)]
        const winnerId = picked.user_id

        let winnerEmail = ""
        const authEmailRes = await fetch(getApiUrl("/api/admin/winner-email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ userId: winnerId }),
        })
        const authPayload = await parseResponseJson(authEmailRes)
        if (
          authPayload &&
          typeof authPayload.email === "string" &&
          authPayload.email.trim() !== ""
        ) {
          winnerEmail = authPayload.email.trim()
          console.log("[admin] Email gagnant depuis auth.users (auth.admin)")
        } else {
          console.warn("[admin] Pas d'email auth pour le gagnant — verifiez SUPABASE_SERVICE_ROLE_KEY sur le serveur.")
        }

        const uniqueUserIds = Array.from(new Set(candidates.map((c) => c.user_id)))
        const { data: participantsProfiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", uniqueUserIds)
        const participantNameById = new Map<string, string>()
        for (const p of participantsProfiles || []) {
          const display = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Joueur"
          participantNameById.set(String(p.id), display)
        }

        const { data: winnerProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name, points, email, adresse, code_postal, ville")
          .eq("id", winnerId)
          .maybeSingle()
        if (!winnerProfile) {
          setDrawMessage("Profil gagnant introuvable.")
          setDrawingPoolId(null)
          return
        }
        const winnerName = `${winnerProfile.first_name || ""} ${winnerProfile.last_name || ""}`.trim() || "Gagnant"
        if (
          !winnerEmail &&
          typeof winnerProfile.email === "string" &&
          winnerProfile.email.trim() !== ""
        ) {
          winnerEmail = winnerProfile.email.trim()
          console.log("[admin] Email gagnant depuis profiles.email (secondaire)")
        }
        const lotCost = Math.max(0, Math.floor(Number(normalizedPool.ticket_cost ?? 0)) || 0)
        const winnerPoints = Math.max(0, Math.floor(Number(winnerProfile.points ?? 0)) || 0)
        if (!Number.isFinite(lotCost) || !Number.isFinite(winnerPoints)) {
          setDrawMessage("Solde ou cout lot invalide.")
          setDrawingPoolId(null)
          return
        }
        if (winnerPoints < lotCost) {
          setDrawMessage("Points insuffisants")
          setDrawingPoolId(null)
          return
        }
        const newPoints = Math.max(0, winnerPoints - lotCost)

        const winnerData = {
          user_id: winnerId,
          winner_name: winnerName,
          winner_email: winnerEmail,
          pool_id: normalizedPool.id,
          prize_name: normalizedPool.name,
          status: "pending" as const,
        }
        if (!winnerEmail) {
          console.warn("[admin] Aucun e-mail (profil + auth) pour le gagnant — pas d'envoi au joueur, admin notifie par API.")
        }
        console.log("Données du gagnant avant insert:", winnerData)

        const { error: winnerInsertError } = await supabase.from("winners").insert(winnerData)
        if (winnerInsertError) {
          setDrawMessage(`Erreur insertion winners: ${winnerInsertError.message}`)
          setDrawingPoolId(null)
          return
        }

        const { error: finalizeError } = await supabase.rpc("finalize_draw", {
          p_pool_id: poolId,
        })
        if (finalizeError) {
          console.error("finalize_draw:", finalizeError)
          const { error: poolResetError } = await supabase
            .from("rewards_pools")
            .update({ current_videos: 0, last_draw_at: new Date().toISOString() })
            .eq("id", poolId)
          if (poolResetError) {
            setDrawMessage(`Erreur reinitialisation lot: ${poolResetError.message}`)
            setDrawingPoolId(null)
            return
          }
          const { error: ticketDelErr } = await supabase.from("tickets").delete().eq("pool_id", poolId)
          if (ticketDelErr) {
            setDrawMessage(`Erreur purge tickets: ${ticketDelErr.message}`)
            setDrawingPoolId(null)
            return
          }
        }

        if (!finalizeError) {
          const notificationError = await insertWinnerNotification(supabase, winnerId, normalizedPool.name)
          if (notificationError) {
            console.error("Erreur Supabase notifications (insert winners):", notificationError)
          }

          const emailResult = await sendWinnerEmailViaApi({
            winnerEmail,
            winnerName,
            poolName: normalizedPool.name,
            adresse: winnerProfile.adresse,
            code_postal: winnerProfile.code_postal,
            ville: winnerProfile.ville,
          })
          if (!emailResult.ok) {
            console.error("Erreur envoi email gagnant:", emailResult.message)
          }
        }

        router.refresh()
        await fetchPools()
        setDrawCompletedPoolIds((prev) => new Set([...prev, poolId]))

        if (lotCost > 0) {
          const { error: debitRpcError } = await supabase.rpc("debit_draw_winner_points", {
            p_user_id: winnerId,
            p_amount: lotCost,
          })
          if (debitRpcError) {
            console.error("debit_draw_winner_points:", debitRpcError)
            const { error: pointsUpdateError } = await supabase
              .from("profiles")
              .update({ points: newPoints, updated_at: new Date().toISOString() })
              .eq("id", winnerId)
            if (pointsUpdateError) {
              setDrawMessage(`Erreur deduction points: ${pointsUpdateError.message}`)
              setDrawingPoolId(null)
              return
            }
          }
        }

        await fetchDrawHistory()
        await fetchRewards()

        const { error: profileNotifError } = await supabase
          .from("profiles")
          .update({ notification_message: `Felicitation ${winnerName} ! Vous avez gagne ${normalizedPool.name}.` })
          .eq("id", winnerId)
        if (profileNotifError) {
          setDrawMessage(`Erreur notification profil: ${profileNotifError.message}`)
          setDrawingPoolId(null)
          return
        }

        const payload = {
          winner_name: winnerName,
          pool_name: normalizedPool.name,
          participant_names: uniqueUserIds.map((id) => participantNameById.get(id) || "Joueur"),
        }
        const names = Array.isArray(payload?.participant_names) && payload.participant_names.length > 0
          ? (payload.participant_names as string[])
          : [payload.winner_name || "Joueur"]

        setShowDrawModal(true)
        setDrawRollingName(names[0] || "Joueur")
        let i = 0
        const intervalId = window.setInterval(() => {
          i += 1
          setDrawRollingName(names[i % names.length] || "Joueur")
        }, 90)

        window.setTimeout(() => {
          window.clearInterval(intervalId)
          setDrawFinalName(payload.winner_name || "Gagnant")
        }, 3500)

        setDrawMessage(`Tirage effectue : ${payload.winner_name} gagne ${payload.pool_name}.`)
        await fetchPools()
        await fetchDrawHistory()
        await fetchRewards()
      }
    } finally {
      setDrawingPoolId(null)
    }
  }

  const testEmail = async () => {
    setTestingEmail(true)
    setEmailTestMessage(null)
    try {
      const supabase = supabaseBrowser()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        setEmailTestMessage("Session requise pour appeler l'API d'envoi.")
        return
      }
      const to = ADMIN_EMAIL
      const res = await fetch(getApiUrl("/api/send-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          to,
          subject: "[BKG Rewards] Test d'envoi email",
          html: "<p>L'envoi d'email est operationnel (tunnel Resend).</p>",
        }),
      })
      const data = await parseResponseJson(res)
      if (!res.ok) {
        setEmailTestMessage(`Echec : ${data && typeof data.error === "string" ? data.error : res.status}`)
        return
      }
      if (!data) {
        setEmailTestMessage("Reponse vide du serveur.")
        return
      }
      setEmailTestMessage(
        data.skipped === true
          ? (typeof data.message === "string" ? data.message : "Resend non configure (RESEND_API_KEY).")
          : "E-mail de test envoye.",
      )
    } catch (e) {
      console.error(e)
      setEmailTestMessage("Erreur reseau.")
    } finally {
      setTestingEmail(false)
    }
  }

  const resolveWinnerEmail = (reward: RewardRow): string => {
    const fromRow = (reward.winner_email || reward.email || "").trim()
    if (fromRow) return fromRow
    const u = users.find((x) => x.id === reward.user_id)
    return (u?.email || "").trim()
  }

  const markPrizeShipped = async (reward: RewardRow) => {
    if (!reward.user_id) {
      console.error("[admin] markPrizeShipped: user_id manquant")
      return
    }
    const emailResolved = resolveWinnerEmail(reward)
    console.log("Tentative d'envoi à :", emailResolved || "(vide)")
    if (!emailResolved) {
      setPrizeShipError("Email manquant pour ce gagnant")
      return
    }
    setPrizeShipError(null)

    setUpdatingReward(reward.id)
    const supabase = supabaseBrowser()
    const { error } = await supabase.from("winners").update({ status: "shipped" }).eq("id", reward.id)
    if (error) {
      console.error("[admin] winners shipped:", error)
      await fetchRewards()
      setUpdatingReward(null)
      return
    }

    setRewards((prev) =>
      prev.map((r) =>
        r.id === reward.id
          ? { ...r, status: "shipped" as const, winner_email: emailResolved, email: emailResolved }
          : r,
      ),
    )

    const notifErr = await insertPrizeShippedNotification(supabase, reward.user_id)
    if (notifErr) {
      console.error("[admin] notification expédition:", notifErr)
    }

    const emailResult = await sendPrizeShippedEmailViaApi({
      winnerEmail: emailResolved,
      winnerName: reward.display_name,
      poolName: reward.prize_name,
    })
    if (!emailResult.ok) {
      console.error("[admin] email expédition:", emailResult.message)
    }

    setUpdatingReward(null)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {showDrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <Card className="w-full max-w-md border border-border/60 bg-[#111111] shadow-2xl">
            <CardHeader>
              <CardTitle className="text-center text-lg text-foreground">Tirage en cours...</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <div className="rounded-xl border border-border/40 bg-black/40 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Slot Machine</p>
                <p className={`mt-2 text-2xl font-bold ${drawFinalName ? "text-emerald-300" : "text-yellow-300"}`}>
                  {drawFinalName || drawRollingName}
                </p>
              </div>
              {drawFinalName ? (
                <Button className="w-full" onClick={() => setShowDrawModal(false)}>
                  Fermer
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Selection aleatoire du gagnant...</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Administration</h2>
        <p className="text-sm text-muted-foreground">Gestion VIP, points, lots et gagnants.</p>
      </div>

      <Tabs defaultValue="vip">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="vip">VIP & Points</TabsTrigger>
          <TabsTrigger value="pools">Lots</TabsTrigger>
          <TabsTrigger value="draw">Tirage au sort</TabsTrigger>
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

        <TabsContent value="draw" className="space-y-3">
          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Tirage au sort</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {drawMessage && <p className="text-sm text-muted-foreground">{drawMessage}</p>}
              {loadingPools ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : (
                pools
                  .filter((pool) => pool.is_active !== false)
                  .map((pool) => {
                    const cooldownMs = remainingCooldownMs(
                      pool.last_draw_at,
                      Date.now() + drawCooldownTick * 0,
                    )
                    const reached =
                      pool.target_videos > 0 && pool.current_videos >= pool.target_videos
                    const canDraw = reached && cooldownMs === 0
                    const tirageTermine =
                      pool.target_videos > 0 &&
                      pool.current_videos < pool.target_videos &&
                      (pool.has_winner === true || drawCompletedPoolIds.has(pool.id))
                    const drawBusy = drawingPoolId === pool.id
                    const drawLabel = drawBusy
                      ? "Tirage..."
                      : canDraw
                        ? "Lancer le tirage"
                        : tirageTermine
                          ? "Tirage terminé"
                          : !reached
                            ? "Objectif non atteint"
                            : "Lancer le tirage"
                    return (
                      <div key={pool.id} className="rounded-lg border border-border/40 p-3 text-sm">
                        <p className="font-semibold text-foreground">{pool.name}</p>
                        <p className="text-muted-foreground">
                          Participations : {pool.current_videos}/{pool.target_videos}
                        </p>
                        {cooldownMs > 0 ? (
                          <p className="mt-2 text-center text-sm tabular-nums text-muted-foreground">
                            Prochain tirage disponible dans : {formatCooldownMmSs(cooldownMs)}
                          </p>
                        ) : (
                          <Button
                            variant="outline"
                            className={`mt-2 w-full ${tirageTermine && !canDraw ? "opacity-50" : ""}`}
                            onClick={() => launchDraw(pool.id)}
                            disabled={drawBusy || !canDraw}
                          >
                            {drawLabel}
                          </Button>
                        )}
                      </div>
                    )
                  })
              )}
            </CardContent>
          </Card>
          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Tirages terminés</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingHistory ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : drawHistory.length > 0 ? (
                drawHistory.map((row) => (
                  <div key={row.id} className="rounded-lg border border-border/40 p-3 text-sm">
                    <p className="text-foreground">
                      <span className="font-semibold">{row.winner_name}</span> a gagne{" "}
                      <span className="font-semibold">{row.prize_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.created_at ? new Date(row.created_at).toLocaleString("fr-FR") : "Date inconnue"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Aucun tirage terminé pour le moment.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="winners" className="space-y-3">
          <div className="space-y-2">
            <Button onClick={testEmail} disabled={testingEmail} className="w-full sm:w-auto">
              {testingEmail ? "Test en cours..." : "Tester l'envoi email"}
            </Button>
            {emailTestMessage ? (
              <p className="text-sm text-muted-foreground">{emailTestMessage}</p>
            ) : null}
          </div>

          <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Gains en attente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prizeShipError ? (
                <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {prizeShipError}
                </p>
              ) : null}
              {loadingRewards ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : rewards.length > 0 ? (
                rewards.map((reward) => (
                  <div key={reward.id} className="rounded-lg border border-border/40 p-3 text-sm">
                    <p>Gagnant : <span className="font-semibold text-foreground">{reward.display_name}</span></p>
                    <p>
                      E-mail gagnant :{" "}
                      <span className="font-semibold break-all text-foreground">
                        {(reward.winner_email || "").trim() || "—"}
                      </span>
                    </p>
                    <p>Lot : <span className="font-semibold text-foreground">{reward.prize_name}</span></p>
                    <p>Statut : <span className="font-semibold text-foreground">{reward.status}</span></p>
                    {reward.status === "pending" && (
                      <Button
                        className="mt-2 w-full"
                        onClick={() => void markPrizeShipped(reward)}
                        disabled={updatingReward === reward.id}
                      >
                        {updatingReward === reward.id ? "Mise à jour..." : "Marquer comme envoyé"}
                      </Button>
                    )}
                    {reward.status === "shipped" && (
                      <p className="mt-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-center text-sm font-medium text-emerald-400">
                        Expédié
                      </p>
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
