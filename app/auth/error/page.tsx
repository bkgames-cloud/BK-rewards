"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get("error")

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-foreground">Une erreur est survenue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorParam ? (
            <p className="text-center text-sm text-muted-foreground">Erreur : {errorParam}</p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">Une erreur inattendue s&apos;est produite.</p>
          )}
          <Button variant="secondary" className="w-full" asChild>
            <Link href="/auth/login">Retour à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
