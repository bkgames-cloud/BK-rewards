import type { CapacitorConfig } from "@capacitor/cli"

/**
 * App Android : bundle web local `out/`. Les appels API utilisent `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL`
 * (voir `npm run build:mobile` → https://bkg-rewards.com).
 * Ne pas définir `server.url` en prod : sinon le WebView chargerait le site distant au lieu du bundle.
 */
const config = {
  appId: "com.bkrewards.rewards",
  appName: "BKG Rewards",
  webDir: "out",
  bundledWebRuntime: false,
  /**
   * Capacitor 8 : le plugin natif `SystemBars` appelle `show()` au démarrage si `hidden` est false,
   * ce qui réaffiche les barres après tout réglage dans MainActivity — d’où `hidden: true`.
   */
  plugins: {
    SystemBars: {
      hidden: true,
      style: "DARK",
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
    },
  },
  /** Aligné sur les App Links Android (https://bkg-rewards.com). */
  server: {
    androidScheme: "https",
    hostname: "bkg-rewards.com",
    /** WebView : autoriser monlix.com et sous-domaines (offres partenaires). */
    allowNavigation: ["monlix.com", "*.monlix.com"],
  },
} satisfies CapacitorConfig & { bundledWebRuntime?: boolean }

export default config
