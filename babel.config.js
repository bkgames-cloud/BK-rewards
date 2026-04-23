/**
 * - **Next.js** (`next build`) : `next/babel` — bundle Web compatible WebView (évite « exports is not defined »).
 * - **Expo / Metro** : définir `BKG_EXPO_METRO=1` (scripts `npm run expo*`) → `babel-preset-expo`.
 *
 * Ne pas utiliser `api.caller()` ici : Next 14 lève « Caching has already been configured ».
 *
 * Fichier chargé par Node uniquement : `module.exports` reste le format attendu.
 */
module.exports = function (api) {
  api.cache(true)
  if (process.env.BKG_EXPO_METRO === "1") {
    return { presets: ["babel-preset-expo"] }
  }
  return { presets: ["next/babel"] }
}
