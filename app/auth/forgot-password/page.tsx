"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { Sparkles, ArrowLeft, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      setSuccess(true)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Une erreur est survenue")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col bg-background p-4">
      {/* Back Button */}
      <Link href="/auth/login" className="mb-4 flex items-center gap-2 text-muted-foreground">
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Retour</span>
      </Link>

      <div className="flex flex-1 flex-col items-center justify-center">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2">
          <div className="rounded-full bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) p-3">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            BK&apos;reward
          </h1>
        </div>

        <Card className="w-full max-w-sm border-border bg-card">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-foreground">Mot de passe oublié</CardTitle>
            <CardDescription className="text-muted-foreground">
              Entrez votre adresse email pour recevoir un lien de réinitialisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
                  <CheckCircle2 className="h-8 w-8 text-accent" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Email envoyé !</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Vérifiez votre boîte de réception pour le lien de réinitialisation.
                  </p>
                </div>
                <Link href="/auth/login" className="text-sm text-foreground underline underline-offset-4">
                  Retour à la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vous@exemple.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-input text-foreground"
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) text-primary-foreground"
                    disabled={isLoading}
                  >
                    {isLoading ? "Envoi..." : "Envoyer le lien de réinitialisation"}
                  </Button>
                </div>
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  <Link href="/auth/login" className="text-foreground underline underline-offset-4">
                    Retour à la connexion
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
