import { NextResponse } from "next/server"

/**
 * En-têtes CORS pour les routes API appelées en cross-origin (WebView Capacitor, domaine API ≠ origine page).
 * Avec `credentials: "include"`, le navigateur exige `Access-Control-Allow-Origin` = l’origine exacte (pas `*`)
 * quand `Origin` est présent.
 */
export function apiCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin")
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    Vary: "Origin",
  }
  if (origin) {
    h["Access-Control-Allow-Origin"] = origin
    h["Access-Control-Allow-Credentials"] = "true"
  } else {
    h["Access-Control-Allow-Origin"] = "*"
  }
  return h
}

export function nextJsonWithCors(request: Request, body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  for (const [k, v] of Object.entries(apiCorsHeaders(request))) {
    headers.set(k, v)
  }
  return NextResponse.json(body, { ...init, headers })
}

export function nextCorsPreflight(request: Request) {
  return new NextResponse(null, { status: 204, headers: apiCorsHeaders(request) })
}
