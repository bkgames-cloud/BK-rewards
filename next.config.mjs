/** @type {import('next').NextConfig} */
/**
 * Export statique (`out/`) uniquement pour Capacitor Android : définir `CAPACITOR_BUILD=1`
 * (ex. `npm run build:mobile`). Sinon build Next standard → routes API disponibles (Vercel, `next start`).
 */
const useCapacitorStaticExport = process.env.CAPACITOR_BUILD === "1"

console.log(
  "Build mode:",
  process.env.NODE_ENV,
  "| CAPACITOR_BUILD:",
  process.env.CAPACITOR_BUILD ?? "(unset)",
  "| static export → dossier out/:",
  useCapacitorStaticExport,
)
if (!useCapacitorStaticExport) {
  console.log(
    "[next.config] Sans CAPACITOR_BUILD=1, Next génère uniquement .next/ (pas d’export statique). Pour régénérer out/ (Capacitor), lance : npm run build:mobile",
  )
}

const nextConfig = {
  ...(useCapacitorStaticExport
    ? {
        output: "export",
        trailingSlash: true,
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
