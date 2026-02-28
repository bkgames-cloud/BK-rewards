/**
 * Retourne une image de fallback adaptée au nom du cadeau.
 * Permet d'afficher une image cohérente si l'URL en base est manquante ou vide.
 */
export function getPrizeFallbackImage(cadeauNom: string): string {
  const name = cadeauNom.toLowerCase()

  if (name.includes("iphone")) return "/iphone15.jpg"
  if (name.includes("samsung") || name.includes("galaxy")) return "/samsungs24.jpg"
  if (name.includes("ps5") || name.includes("playstation")) return "/ps5console.jpg"
  if (name.includes("xbox")) return "/xboxseriesx.jpg"
  if (name.includes("airpods")) return "/airpodspro.jpg"
  if (name.includes("switch")) return "/placeholder.jpg" // pas d'image dédiée dans /public

  if (name.includes("20€") || name.includes("20 €")) return "/giftcard20.jpg"
  if (name.includes("10€") || name.includes("10 €")) return "/placeholder.jpg"
  if (name.includes("5€") || name.includes("5 €")) return "/placeholder.jpg"

  // Fallback générique si aucun mapping ne matche
  return "/placeholder.jpg"
}

