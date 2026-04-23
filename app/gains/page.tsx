"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { getApiUrl } from "@/lib/api-origin"
import { SUPPORT_INBOX_EMAIL } from "@/lib/admin-config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"

type WinRow = {
  id: string
  prize_name: string | null
  status: string
  created_at: string
}

export default function MesGainsPage() {
  const [wins, setWins] = useState<WinRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackType, setFeedbackType] = useState<"success" | "error" | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user?.id) {
        setLoading(false)
        return
      }
      setUserId(user.id)
      const { data, error } = await supabase
        .from("winners")
        .select("id, prize_name, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (!error && data) {
        setWins(data as WinRow[])
      }
      setLoading(false)
    }
    void load()
  }, [])

  /** Met à jour `winners.status` → `received` sans condition sur pending/sent/shipped ; e-mail via `/api/send-email`. */
  const confirmReceipt = async (winnerId: string) => {
    setConfirming(winnerId)
    setFeedback(null)
    setFeedbackType(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!user?.id || user.id !== userId) {
        setFeedbackType("error")
        setFeedback("Vous devez être connecté.")
        return
      }

      const uid = user.id
      const apiUrl = getApiUrl("/api/send-email")
      const apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ mode: "receipt_confirmed", winnerId }),
      })

      const apiJson = (await apiRes.json().catch(() => ({}))) as {
        ok?: boolean
        already?: boolean
        error?: string
      }

      if (apiRes.ok && apiJson.ok) {
        setWins((prev) => prev.map((w) => (w.id === winnerId ? { ...w, status: "received" } : w)))
        setFeedbackType("success")
        setFeedback(apiJson.already ? "Réception déjà enregistrée." : "Merci, ta réception est bien enregistrée.")
        return
      }

      // Fallback : API indisponible (export statique, CORS) — mise à jour directe + file d’attente admin.
      const { data: row, error: qErr } = await supabase
        .from("winners")
        .select("id, status")
        .eq("id", winnerId)
        .eq("user_id", uid)
        .maybeSingle()
      if (qErr || !row) {
        setFeedbackType("error")
        setFeedback("Gain introuvable.")
        return
      }
      if (String(row.status ?? "").toLowerCase() === "received") {
        setWins((prev) => prev.map((w) => (w.id === winnerId ? { ...w, status: "received" } : w)))
        setFeedbackType("success")
        setFeedback("Merci, ta réception est bien enregistrée.")
        return
      }
      const { data: updated, error: upErr } = await supabase
        .from("winners")
        .update({ status: "received" })
        .eq("id", winnerId)
        .eq("user_id", uid)
        .select("id")

      if (upErr || !updated?.length) {
        setFeedbackType("error")
        setFeedback(
          apiJson.error === "non_authentifie"
            ? "Session expirée. Reconnecte-toi et réessaie."
            : "Action impossible pour le moment. Réessaie plus tard.",
        )
        return
      }

      try {
        const { error: notifErr } = await supabase.from("notifications_admin").insert({
          type: "receipt_confirmed",
          target_email: SUPPORT_INBOX_EMAIL,
          payload: { winner_id: winnerId, user_id: user.id },
        })
        if (notifErr) console.warn("[gains] notifications_admin insert:", notifErr)
      } catch (e) {
        console.warn("[gains] notifications_admin insert catch:", e)
      }

      setWins((prev) => prev.map((w) => (w.id === winnerId ? { ...w, status: "received" } : w)))
      setFeedbackType("success")
      setFeedback(
        "Merci, ta réception est enregistrée. (Notification envoyée dès que le serveur mail est joignable.)",
      )
    } catch (e) {
      console.warn("[gains] confirmReceipt:", e)
      setFeedbackType("error")
      setFeedback("Erreur réseau.")
    } finally {
      setConfirming(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold text-foreground">Mes gains</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary underline">
            Connecte-toi
          </Link>{" "}
          pour voir tes lots gagnés.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Trophy className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Mes gains</h1>
        <p className="mt-2 text-sm text-muted-foreground">Lots remportés aux tirages et suivi de livraison.</p>
      </div>

      {feedback ? (
        <p className={`text-center text-sm ${feedbackType === "error" ? "text-destructive" : "text-emerald-400"}`}>
          {feedback}
        </p>
      ) : null}

      <Card className="border border-border/50 bg-[#1a1a1a]/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Tes lots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {wins.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tu n&apos;as pas encore de gain enregistré. Participe aux cagnottes pour tenter ta chance.
            </p>
          ) : (
            wins.map((w) => {
              const label = w.prize_name?.trim() || "Lot"
              const date = w.created_at ? new Date(w.created_at).toLocaleDateString("fr-FR") : ""
              const shipped = w.status === "shipped"
              const received = w.status === "received"
              const canConfirmReceipt = !received

              return (
                <div key={w.id} className="rounded-lg border border-border/40 p-3 text-sm">
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{date}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Statut :{" "}
                    <span className="font-medium text-foreground">
                      {received
                        ? "Réception confirmée"
                        : shipped
                          ? "Expédié"
                          : w.status === "pending"
                            ? "En attente d’expédition"
                            : w.status === "sent"
                              ? "Envoyé"
                              : w.status}
                    </span>
                  </p>
                  {canConfirmReceipt && (
                    <Button
                      className="mt-3 w-full"
                      size="sm"
                      onClick={() => void confirmReceipt(w.id)}
                      disabled={confirming === w.id}
                    >
                      {confirming === w.id ? "Confirmation…" : "Confirmer la réception du lot"}
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}

