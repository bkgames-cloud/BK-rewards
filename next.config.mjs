/** @type {import('next').NextConfig} */
/**
 * Export statique (`out/`) uniquement pour Capacitor Android : définir `CAPACITOR_BUILD=1`
 * (ex. `npm run build:mobile`). Sinon build Next standard → routes API disponibles (Vercel, `next start`).
 */
const useCapacitorStaticExport = process.env.CAPACITOR_BUILD === "1"

/** Même origine que `capacitor.config` (`hostname: bkg-rewards.com`) — sans préfixe absolu, `/_next/static/...` peut ne pas être résolu vers le bundle dans la WebView Android. */
const capacitorAssetOrigin = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://bkg-rewards.com"
).replace(/\/$/, "")

const nextConfig = {
  // Vérification "obfuscation légère": en prod, Next minifie via SWC (noms raccourcis a,b,c…).
  // On l'active explicitement pour éviter toute divergence.
  swcMinify: true,
  ...(useCapacitorStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        assetPrefix: capacitorAssetOrigin,
      }
    : {
        /** Vercel / prod : pas de slash final sur les URLs (évite redirections 307 sur `/api/...`). */
        trailingSlash: false,
      }),
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
