"use client"

import { useState, type FormEvent } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LifeBuoy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Spinner } from "@/components/ui/spinner"

export default function SupportPage() {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const trimmed = {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      }

      // Web / Vercel : chemin relatif (même origine), pas d’URL absolue — évite les 404 cross-domain.
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "support" as const,
          name: trimmed.name,
          email: trimmed.email,
          subject: trimmed.subject,
          message: trimmed.message,
        }),
      })

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { ok?: boolean } | null
        if (data && data.ok === false) {
          setError("Envoi impossible. Réessaie dans un instant.")
          return
        }
      } else {
        // Export statique / app native sans route API : repli sur la table Supabase.
        const supabase = createClient()
        const { error: insErr } = await supabase.from("support_tickets").insert({
          full_name: trimmed.name,
          email: trimmed.email,
          subject: trimmed.subject,
          message: trimmed.message,
        })
        if (insErr) {
          console.error("[support] send-email + fallback support_tickets:", {
            httpStatus: res.status,
            insert: insErr,
          })
          setError("Envoi impossible. Réessaie dans un instant.")
          return
        }
      }

      setSuccess(true)
      toast({
        title: "Message envoyé",
        description:
          "Message envoyé ! Nous te répondrons sur support.bkgamers@gmail.com",
      })
      setName("")
      setEmail("")
      setSubject("")
      setMessage("")
    } catch (e) {
      console.error("[support] submit catch:", e)
      setError("Envoi impossible. Réessaie dans un instant.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 py-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <LifeBuoy className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Support</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une question ou un souci ? Écris-nous, on te répond dès que possible.
        </p>
      </div>

      <Card className="border border-border/50 bg-[#1a1a1a]/80 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Nous contacter</CardTitle>
        </CardHeader>
        <CardContent>
          {success ? (
            <p className="text-center text-sm leading-relaxed text-emerald-400">
              Merci, ton message a bien été envoyé. Notre équipe te répondra sous 24/48h.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitting ? (
                <div className="flex items-center justify-center gap-2 rounded-md border border-border/60 bg-secondary/20 p-3 text-sm text-muted-foreground">
                  <Spinner className="text-primary" />
                  Envoi en cours…
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="support-name">Nom</Label>
                <Input
                  id="support-name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  maxLength={120}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-email">E-mail</Label>
                <Input
                  id="support-email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  maxLength={254}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-subject">Sujet</Label>
                <Input
                  id="support-subject"
                  name="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-message">Message</Label>
                <Textarea
                  id="support-message"
                  name="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={6}
                  className="min-h-[120px] resize-y"
                  maxLength={8000}
                  disabled={submitting}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Envoi…" : "Envoyer"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
