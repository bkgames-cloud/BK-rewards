import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Mail } from "lucide-react"
import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center bg-background p-4">
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-(--color-sky-start) to-(--color-sky-end)">
            <Mail className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl text-foreground">Vérifiez votre email</CardTitle>
          <CardDescription className="text-muted-foreground">
            Un email de confirmation vous a été envoyé
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Cliquez sur le lien dans l&apos;email pour activer votre compte et commencer à participer aux tirages.
          </p>
          <Button variant="secondary" className="w-full" asChild>
            <Link href="/auth/login">Retour à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
