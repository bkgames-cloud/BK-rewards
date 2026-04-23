import type { SupabaseClient } from "@supabase/supabase-js"

/** Aligné sur `add_reward_points` / `video_views` (scripts/042_video_reward_first_lifetime.sql). */
export const VIDEO_VIEWS_PER_HOUR_LIMIT = 5

export async function countVideoViewsLastHour(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const hourStartIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from("video_views")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", hourStartIso)
  if (error) {
    console.warn("[video-quota] countVideoViewsLastHour:", error.message)
    return 0
  }
  return Math.max(0, Math.floor(count ?? 0))
}

export function isHourlyVideoQuotaExceeded(viewCountLastHour: number): boolean {
  return viewCountLastHour >= VIDEO_VIEWS_PER_HOUR_LIMIT
}
