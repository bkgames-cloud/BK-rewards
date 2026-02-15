"use client"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Ticket } from "lucide-react"
import Image from "next/image"
import { getPrizeFallbackImage } from "@/lib/prizes"
import type { Cadeau, Ticket as TicketType } from "@/lib/types"

export default function TicketsPage() {
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketType[]>([])
  const [cadeauxMap, setCadeauxMap] = useState<Record<string, { nom: string; image_url: string | null }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTickets() {
      const supabase = createClient()
      
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      // Get user tickets - requête simple sans jointure
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (ticketsError) {
        console.error("[TicketsPage] Error loading tickets:", ticketsError)
        setLoading(false)
        return
      }

      setTickets(ticketsData || [])

      // Récupérer les cadeaux associés aux tickets
      if (ticketsData && ticketsData.length > 0) {
        const cadeauIds = [...new Set(ticketsData.map((t) => t.cadeau_id).filter(Boolean) as string[])]
        if (cadeauIds.length > 0) {
          const { data: cadeaux, error: cadeauxError } = await supabase
            .from("cadeaux")
            .select("id, nom, image_url")
            .in("id", cadeauIds)

          if (cadeauxError) {
            console.error("[TicketsPage] Error loading cadeaux:", cadeauxError)
          } else if (cadeaux) {
            const map = cadeaux.reduce(
              (acc, c) => {
                acc[c.id] = { nom: c.nom, image_url: c.image_url }
                return acc
              },
              {} as Record<string, { nom: string; image_url: string | null }>,
            )
            setCadeauxMap(map)
          }
        }
      }
      
      setLoading(false)
    }

    loadTickets()
  }, [router])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h2 className="text-xl font-semibold text-foreground">Mes Tickets</h2>
        <p className="text-sm text-muted-foreground">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-xl font-semibold text-foreground">Mes Tickets</h2>

      <p className="text-sm text-muted-foreground">{tickets.length || 0} ticket(s) obtenus</p>

      {tickets.length === 0 ? (
        <Card className="border border-border/50 bg-[#1a1a1a] shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-center text-muted-foreground">
              Vous n&apos;avez pas encore de tickets.
              <br />
              Gagnez des points pour participer aux tirages !
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => {
            const cadeau = ticket.cadeau_id ? cadeauxMap[ticket.cadeau_id] : null
            // Utiliser image_url si disponible, non vide, et ne contient pas 'unsplash', sinon fallback
            const imageSrc = (cadeau?.image_url && cadeau.image_url.trim() !== "" && !cadeau.image_url.includes("unsplash"))
              ? cadeau.image_url
              : (cadeau?.nom ? getPrizeFallbackImage(cadeau.nom) : "/placeholder.svg")
            
            return (
              <Card key={ticket.id} className="border border-border/50 bg-[#1a1a1a] shadow-lg transition-all hover:border-accent/50 hover:shadow-xl">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {cadeau && (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary/50 ring-1 ring-border/50">
                          <Image
                            src={imageSrc}
                            alt={cadeau.nom}
                            fill
                            className="object-cover"
                            unoptimized
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              const fallback = cadeau.nom ? getPrizeFallbackImage(cadeau.nom) : "/placeholder.svg"
                              if (!target.src.includes(fallback)) {
                                target.src = fallback
                              }
                            }}
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                          <Trophy className="h-5 w-5 text-accent" />
                          <span className="font-bold">{cadeau?.nom || "Cadeau"}</span>
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Ticket #{ticket.ticket_number}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground shadow-md">
                      #{ticket.ticket_number}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Obtenu le {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
