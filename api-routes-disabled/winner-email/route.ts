/**
 * Alias de `/api/admin/winner-email` — même logique (e-mail Auth via service role, session admin).
 * Évite les 404 si le client appelle `/api/winner-email` au lieu du chemin sous `admin/`.
 */
export { POST } from "../admin/winner-email/route"
