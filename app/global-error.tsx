"use client"

/**
 * Fallback App Router si une erreur non gérée remonte jusqu’à la racine.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600 }}>BKG Rewards</p>
        <p style={{ fontSize: 14, color: "#a3a3a3", textAlign: "center", maxWidth: 360 }}>
          Erreur au chargement. Réessayez ou mettez à jour l’application.
        </p>
        {error?.message ? (
          <p style={{ fontSize: 11, color: "#737373", marginTop: 12 }}>{error.message}</p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 24,
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid #d4af37",
            background: "transparent",
            color: "#d4af37",
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  )
}
