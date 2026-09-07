/**
 * Preferências pessoais da tela inicial.
 * Sempre pelo cliente autenticado: a RLS garante que cada pessoa só lê e
 * altera a própria linha. A ausência de linha significa "padrão do sistema",
 * o que mantém usuários antigos com a tela inicial completa.
 */
import { supabase } from "@/integrations/supabase/client";
import type { HomeBlockPreference } from "@/config/home.config";

export interface UserPreferencesRow {
  user_id: string;
  /** `null` = acompanha todas as modalidades ativas. `[]` = nenhuma. */
  followed_lottery_ids: string[] | null;
  favorite_lottery_id: string | null;
  home_blocks: unknown;
}

export interface PreferencesPatch {
  followedLotteryIds?: string[] | null;
  favoriteLotteryId?: string | null;
  homeBlocks?: HomeBlockPreference[];
}

export const preferencesService = {
  async get(userId: string) {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("user_id, followed_lottery_ids, favorite_lottery_id, home_blocks")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as UserPreferencesRow | null;
  },

  async save(userId: string, patch: PreferencesPatch) {
    const row: Record<string, unknown> = { user_id: userId };
    if (patch.followedLotteryIds !== undefined)
      row["followed_lottery_ids"] = patch.followedLotteryIds;
    if (patch.favoriteLotteryId !== undefined) row["favorite_lottery_id"] = patch.favoriteLotteryId;
    if (patch.homeBlocks !== undefined) row["home_blocks"] = patch.homeBlocks;

    const { error } = await supabase
      .from("user_preferences")
      .upsert(row as never, { onConflict: "user_id" });
    if (error) throw error;
  },

  /** Volta ao padrão sem apagar nenhum jogo, bolão ou conferência. */
  async reset(userId: string) {
    const { error } = await supabase.from("user_preferences").delete().eq("user_id", userId);
    if (error) throw error;
  },
};
