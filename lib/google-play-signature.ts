function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, "")
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function importGooglePlayPublicKeySpki(publicKeyBase64: string, hash: "SHA-1" | "SHA-256") {
  const bytes = base64ToBytes(publicKeyBase64)
  return await crypto.subtle.importKey(
    "spki",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash },
    false,
    ["verify"],
  )
}

/**
 * Vérifie la signature RSA d'un reçu Google Play quand `cordova-plugin-purchase` fournit
 * `receipt` (données signées) et `signature` (base64).
 *
 * Note: selon les implémentations, l'algorithme est souvent SHA1withRSA.
 * On tente SHA-1 puis SHA-256 pour compat.
 */
export async function verifyGooglePlayReceiptSignature(params: {
  signedData: string
  signatureBase64: string
  publicKeyBase64: string
}): Promise<{ ok: boolean; algorithm: "SHA-1" | "SHA-256" | null; error?: string }> {
  try {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      return { ok: false, algorithm: null, error: "webcrypto_unavailable" }
    }

    const sigBytes = base64ToBytes(params.signatureBase64)
    const dataBytes = new TextEncoder().encode(params.signedData)

    for (const hash of ["SHA-1", "SHA-256"] as const) {
      try {
        const key = await importGooglePlayPublicKeySpki(params.publicKeyBase64, hash)
        const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, sigBytes, dataBytes)
        if (ok) return { ok: true, algorithm: hash }
      } catch {
        // essayer l'autre hash
      }
    }

    return { ok: false, algorithm: null, error: "signature_invalid" }
  } catch (e) {
    return { ok: false, algorithm: null, error: e instanceof Error ? e.message : String(e) }
  }
}

