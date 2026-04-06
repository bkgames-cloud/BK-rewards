import coreWebVitals from "eslint-config-next/core-web-vitals"

/** Presets Next.js 16 (flat config). Équivalent recommandé à l’ancien extends dans .eslintrc.json. */
/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["node_modules/**", "android/**", "ios/**"],
  },
  ...coreWebVitals,
]
