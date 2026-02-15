import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

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
          {params?.error ? (
            <p className="text-center text-sm text-muted-foreground">Erreur : {params.error}</p>
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
