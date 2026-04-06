import { updateSession } from "@/lib/supabase/proxy"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  // Ne pas rediriger /admin → /admin/ : sur Vercel (sans trailingSlash), Next peut
  // renvoyer /admin/ → /admin, ce qui boucle avec une redirection inverse (Too many redirects).
  // Les routes `/api/*` sont exclues du matcher : évite les 307 / effets de bord sur préflight CORS (OPTIONS).
  return await updateSession(request)
}

/** Tout ce qui commence par `/api` est exclu (pas de proxy / session sur les routes API → évite 307 sur OPTIONS). */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
