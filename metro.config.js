const path = require("path")
const fs = require("fs")
const { getDefaultConfig } = require("expo/metro-config")

const projectRoot = __dirname

/**
 * @param {string} request ex. "@/lib/supabase/client" ou "@/components/foo"
 * @returns {string | null} chemin absolu d'un fichier source existant
 */
function resolveAliasAtRoot(request) {
  if (!request.startsWith("@/")) {
    return null
  }
  const rel = request.slice(2)
  const absBase = path.join(projectRoot, rel)
  const candidates = [
    absBase,
    absBase + ".tsx",
    absBase + ".ts",
    absBase + ".jsx",
    absBase + ".js",
    absBase + ".json",
    path.join(absBase, "index.tsx"),
    path.join(absBase, "index.ts"),
    path.join(absBase, "index.jsx"),
    path.join(absBase, "index.js"),
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return p
      }
    } catch {
      // ignore
    }
  }
  return null
}

const config = getDefaultConfig(projectRoot)

const upstreamResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = resolveAliasAtRoot(moduleName)
  if (resolved != null) {
    return { type: "sourceFile", filePath: resolved }
  }
  if (typeof upstreamResolveRequest === "function") {
    return upstreamResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

config.watchFolders = [...new Set([...(config.watchFolders || []), projectRoot])]

module.exports = config
