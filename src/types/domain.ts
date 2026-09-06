import type { Database } from "@/integrations/supabase/types";

export type Tables = Database["public"]["Tables"];

export type Profile = Tables["profiles"]["Row"];
export type UserRole = Tables["user_roles"]["Row"];
export type Lottery = Tables["lotteries"]["Row"];
export type LotteryPrizeTier = Tables["lottery_prize_tiers"]["Row"];
export type LotteryPrice = Tables["lottery_prices"]["Row"];
export type LotteryDraw = Tables["lottery_draws"]["Row"];
export type DrawNumber = Tables["draw_numbers"]["Row"];
export type DrawPrize = Tables["draw_prizes"]["Row"];
export type GeneratedGame = Tables["generated_games"]["Row"];
export type GameNumber = Tables["game_numbers"]["Row"];
export type GameAnalysis = Tables["game_analysis"]["Row"];
export type Pool = Tables["pools"]["Row"];
export type PoolParticipant = Tables["pool_participants"]["Row"];
export type PoolPayment = Tables["pool_payments"]["Row"];
export type PoolGame = Tables["pool_games"]["Row"];
export type PoolDocument = Tables["pool_documents"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type AuditLog = Tables["audit_logs"]["Row"];
export type FeatureFlagRow = Tables["feature_flags"]["Row"];

export type GameStatus = Database["public"]["Enums"]["game_status"];
export type PoolStatus = Database["public"]["Enums"]["pool_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export const gameStatusLabel: Record<GameStatus, string> = {
  PLANNED: "Planejado",
  BET: "Apostado",
  RECEIPTED: "Comprovado",
  AWAITING_DRAW: "Aguardando sorteio",
  CHECKED: "Conferido",
  PRIZED: "Premiado",
  NOT_PRIZED: "Não premiado",
};

export const poolStatusLabel: Record<PoolStatus, string> = {
  FORMING: "Em formação",
  OPEN: "Aberto",
  CLOSED: "Fechado",
  AWAITING_DRAW: "Aguardando sorteio",
  CHECKED: "Conferido",
  PRIZED: "Premiado",
  FINISHED: "Encerrado",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencido",
};

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export const gameStatusTone: Record<GameStatus, StatusTone> = {
  PLANNED: "neutral",
  BET: "info",
  RECEIPTED: "info",
  AWAITING_DRAW: "warning",
  CHECKED: "neutral",
  PRIZED: "success",
  NOT_PRIZED: "danger",
};

export const poolStatusTone: Record<PoolStatus, StatusTone> = {
  FORMING: "neutral",
  OPEN: "info",
  CLOSED: "warning",
  AWAITING_DRAW: "warning",
  CHECKED: "neutral",
  PRIZED: "success",
  FINISHED: "neutral",
};

export const paymentStatusTone: Record<PaymentStatus, StatusTone> = {
  PENDING: "warning",
  PARTIAL: "info",
  PAID: "success",
  OVERDUE: "danger",
};
