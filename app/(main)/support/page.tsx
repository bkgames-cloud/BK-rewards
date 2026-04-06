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
import { logSupportResendFailure } from "@/lib/support-resend-log"
import { Spinner } from "@/components/ui/spinner"

/** Export statique Capacitor : pas de route `/api/send-email` — enregistrement uniquement via Supabase. */
const SUPPORT_RESEND_PLACEHOLDER = "static_export_no_server_email"

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

      const supabase = createClient()
      // Insert sans .select() : avec RLS, les anonymes n’ont souvent pas de politique SELECT ;
      // PostgREST refuserait alors le RETURNING (même si l’INSERT a réussi).
      const { error: insertErr } = await supabase.from("support_messages").insert({
        full_name: trimmed.name,
        email: trimmed.email,
        subject: trimmed.subject,
        message: trimmed.message,
        resend_sent: false,
        resend_error: SUPPORT_RESEND_PLACEHOLDER,
      })

      if (insertErr) {
        logSupportResendFailure({
          httpStatus: 0,
          error: "support_messages_insert",
          detail: insertErr.message,
        })
        setError(
          insertErr.message.includes("row-level security")
            ? "Enregistrement refusé (sécurité base de données). Exécute le script scripts/046_support_messages_rls_fix.sql dans Supabase."
            : insertErr.message,
        )
        return
      }

      toast({
        title: "Message envoyé et sauvegardé !",
        description: "Nous te répondrons sur support.bkgamers@gmail.com",
      })
      setSuccess(true)
      setName("")
      setEmail("")
      setSubject("")
      setMessage("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Envoi impossible (réseau ou exception)."
      logSupportResendFailure({
        httpStatus: 0,
        error: "exception_client",
        detail: msg,
      })
      setError("Erreur — voir la console.")
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
              Message envoyé et sauvegardé ! Notre équipe te répondra sous 24/48h.
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
