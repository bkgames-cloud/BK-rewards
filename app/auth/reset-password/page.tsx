"use client"

import type React from "react"
import { Suspense } from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Sparkles, ArrowLeft, CheckCircle2 } from "lucide-react"

function ResetPasswordContent() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Vérifier si on a un token dans l'URL (fourni par Supabase après le clic sur le lien email)
    const token = searchParams.get("token")
    if (!token) {
      setError("Lien de réinitialisation invalide ou expiré")
    }
  }, [searchParams])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => {
        router.push("/auth/login")
      }, 2000)
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
            <CardTitle className="text-xl text-foreground">Nouveau mot de passe</CardTitle>
            <CardDescription className="text-muted-foreground">
              Entrez votre nouveau mot de passe
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
                  <CheckCircle2 className="h-8 w-8 text-accent" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Mot de passe modifié !</p>
                  <p className="mt-2 text-sm text-muted-foreground">Redirection en cours...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPassword}>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="password" className="text-foreground">
                      Nouveau mot de passe
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-input text-foreground"
                      minLength={6}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword" className="text-foreground">
                      Confirmer le mot de passe
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-input text-foreground"
                      minLength={6}
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end) text-primary-foreground"
                    disabled={isLoading}
                  >
                    {isLoading ? "Modification..." : "Modifier le mot de passe"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement...</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
