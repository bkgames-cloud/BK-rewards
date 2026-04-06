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
import { getSupportFallbackEmail } from "@/lib/support-fallback-email"
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

      type SendEmailJson = {
        ok?: boolean
        skipped?: boolean
        saved?: boolean
        email_sent?: boolean
        resend_failed?: boolean
        error?: string
        detail?: string
      }
      const rawText = await res.text()
      let data: SendEmailJson | null = null
      try {
        if (rawText) data = JSON.parse(rawText) as SendEmailJson
      } catch {
        data = null
      }

      const buildErrMsg = (): string | null => {
        if (!data) return null
        const parts = [data.error, data.detail].filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        )
        return parts.length ? parts.join(" — ") : null
      }

      const isSuccess =
        res.ok && data?.ok === true && data?.skipped !== true

      if (isSuccess) {
        if (data.resend_failed || data.email_sent === false) {
          const fallback = getSupportFallbackEmail()
          window.alert(
            `Ton message a bien été enregistré, mais l’envoi par e-mail (Resend) a échoué. Écris-nous en secours à : ${fallback}`,
          )
          logSupportResendFailure({
            httpStatus: res.status,
            httpStatusText: res.statusText,
            error: "resend_failed_after_save",
            detail: data.detail,
            rawResponseBody: rawText || undefined,
          })
        } else {
          toast({
            title: "Message envoyé",
            description:
              "Message envoyé ! Nous te répondrons sur support.bkgamers@gmail.com",
          })
        }
        setSuccess(true)
        setName("")
        setEmail("")
        setSubject("")
        setMessage("")
        return
      }

      const precise = buildErrMsg()
      if (precise) {
        logSupportResendFailure({
          httpStatus: res.status,
          httpStatusText: res.statusText,
          error: data?.error,
          detail: data?.detail,
          rawResponseBody: rawText || undefined,
        })
        setError("Échec d’envoi — le détail exact est dans la console de l’app (Resend).")
        return
      }

      // Pas de détail JSON : export statique / route absente → repli Supabase uniquement si 404.
      if (!res.ok && res.status === 404) {
        const supabase = createClient()
        const { error: insErr } = await supabase.from("support_messages").insert({
          full_name: trimmed.name,
          email: trimmed.email,
          subject: trimmed.subject,
          message: trimmed.message,
          resend_sent: false,
          resend_error: "api_route_404_fallback",
        })
        if (insErr) {
          logSupportResendFailure({
            httpStatus: res.status,
            httpStatusText: res.statusText,
            error: "support_tickets_insert",
            detail: insErr.message,
            rawResponseBody: rawText || undefined,
          })
          setError("Enregistrement local impossible — voir la console.")
          return
        }
        setSuccess(true)
        toast({
          title: "Message enregistré",
          description: "Ton message a été enregistré. Nous te recontacterons bientôt.",
        })
        setName("")
        setEmail("")
        setSubject("")
        setMessage("")
        return
      }

      logSupportResendFailure({
        httpStatus: res.status,
        httpStatusText: res.statusText,
        error: data?.error,
        detail:
          !res.ok
            ? `Erreur HTTP sans détail JSON (${res.statusText || "sans détail"}).`
            : "Réponse serveur inattendue (envoi non confirmé).",
        rawResponseBody: rawText || undefined,
      })
      setError("Échec — détail dans la console (Resend).")
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Envoi impossible (réseau ou exception)."
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
