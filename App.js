import { DashboardHomeNative } from "./components/mobile/DashboardHomeNative"

/**
 * Point d’entrée Expo (`package.json` → `"main": "expo/AppEntry.js"` → `../../App`).
 * L’UI reprend le design du dashboard web dans `components/mobile/DashboardHomeNative.tsx`
 * (React Native + StyleSheet + expo-linear-gradient + expo-web-browser).
 * Aucun import depuis `app/` (Next / Vercel).
 */
export default function App() {
  return <DashboardHomeNative />
}
