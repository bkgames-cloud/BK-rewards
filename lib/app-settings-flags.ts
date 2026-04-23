import { createClient } from "@/lib/supabase/client"

/** Phase test interne : `scripts/053_internal_test_vip_bonus.sql` + `UPDATE app_settings SET internal_test_vip_bonus = TRUE WHERE id = 1`. */
export async function fetchInternalTestVipBonusEnabled(): Promise<boolean> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("app_settings")
    .select("internal_test_vip_bonus")
    .eq("id", 1)
    .maybeSingle()
  if (error) return false
  const row = data as { internal_test_vip_bonus?: boolean | null } | null
  return Boolean(row?.internal_test_vip_bonus)
}
