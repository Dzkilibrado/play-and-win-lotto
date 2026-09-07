/**
 * Persistence Service dos bolões.
 * Sempre pelo cliente autenticado (RLS). Regras críticas — situação, rateio,
 * pagamentos e vínculo de jogos — passam por funções protegidas no banco.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  PaymentStatus,
  PoolStatus,
  ParticipantStatus,
  DistributionStatus,
} from "@/types/domain";

const POOL_SELECT =
  "*, lotteries!inner(slug, name, short_name, color_key), pool_participants(id, quotas, amount_due, total_paid, payment_status, status, eligible_for_prize_share), pool_games(id)";

export interface PoolLotteryRef {
  slug: string;
  name: string;
  short_name: string;
  color_key: string;
}

export interface PoolParticipantRow {
  id: string;
  pool_id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  quotas: number;
  amount_due: number;
  amount_adjustment: number;
  adjustment_reason: string | null;
  total_paid: number;
  payment_status: PaymentStatus;
  status: ParticipantStatus;
  eligible_for_prize_share: boolean;
  ineligible_reason: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PoolRow {
  id: string;
  owner_id: string;
  lottery_id: string;
  contest_id: string | null;
  contest_number: number | null;
  contest_number_planned: number | null;
  draw_date: string | null;
  draw_date_planned: string | null;
  name: string;
  quota_value: number;
  total_quotas: number | null;
  payment_deadline: string | null;
  status: PoolStatus;
  notes: string | null;
  is_public: boolean;
  public_token: string | null;
  cancel_reason: string | null;
  closed_at: string | null;
  created_at: string;
  lotteries: PoolLotteryRef | null;
  pool_participants: Pick<
    PoolParticipantRow,
    "id" | "quotas" | "amount_due" | "total_paid" | "payment_status" | "status" | "eligible_for_prize_share"
  >[];
  pool_games: { id: string }[];
}

export interface PoolFilters {
  query?: string | null;
  lotterySlug?: string | null;
  status?: string | null;
  payment?: string | null;
  contestNumber?: number | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  sort?: string | null;
}

export interface CreatePoolInput {
  ownerId: string;
  lotteryId: string;
  name: string;
  contestNumber: number | null;
  drawDate: string | null;
  quotaValue: number;
  /** `null` = bolão sem limite de cotas definido. */
  totalQuotas: number | null;
  paymentDeadline: string | null;
  notes: string | null;
}

/** Campos que o organizador pode corrigir depois da criação. */
export interface UpdatePoolInput {
  name?: string;
  lotteryId?: string;
  contestNumber?: number | null;
  drawDate?: string | null;
  quotaValue?: number;
  totalQuotas?: number | null;
  paymentDeadline?: string | null;
  notes?: string | null;
}


export interface DistributionRow {
  id: string;
  pool_id: string;
  version: number;
  total_prize: number;
  rateable_prize: number;
  total_eligible_quotas: number;
  value_per_quota: number;
  rounding_remainder: number;
  status: DistributionStatus;
  calculation_version: number;
  calculated_at: string;
  confirmed_at: string | null;
  pool_prize_participants: {
    id: string;
    participant_id: string;
    eligible_quotas: number;
    share_amount: number;
    rounding_adjustment: number;
    payment_status_at_calc: PaymentStatus;
  }[];
}

export const poolService = {
  async list(filters: PoolFilters = {}) {
    let query = supabase.from("pools").select(POOL_SELECT);

    if (filters.lotterySlug) query = query.eq("lotteries.slug", filters.lotterySlug);
    if (filters.status) query = query.eq("status", filters.status as PoolStatus);
    if (filters.contestNumber) {
      query = query.or(
        `contest_number.eq.${filters.contestNumber},contest_number_planned.eq.${filters.contestNumber}`,
      );
    }
    if (filters.query) query = query.ilike("name", `%${filters.query}%`);
    if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
    if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59`);

    if (filters.sort === "name") query = query.order("name", { ascending: true });
    else if (filters.sort === "draw") query = query.order("draw_date", { ascending: true, nullsFirst: false });
    else query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    let rows = (data ?? []) as unknown as PoolRow[];

    // Filtro por situação de pagamento depende do agregado dos participantes.
    if (filters.payment) {
      rows = rows.filter((pool) =>
        pool.pool_participants.some(
          (participant) =>
            participant.status === "ACTIVE" && participant.payment_status === filters.payment,
        ),
      );
    }
    return rows;
  },

  async get(id: string) {
    const { data, error } = await supabase.from("pools").select(POOL_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return (data ?? null) as unknown as PoolRow | null;
  },

  async create(input: CreatePoolInput) {
    const { data, error } = await supabase
      .from("pools")
      .insert({
        owner_id: input.ownerId,
        lottery_id: input.lotteryId,
        name: input.name,
        contest_number_planned: input.contestNumber,
        draw_date_planned: input.drawDate,
        quota_value: input.quotaValue,
        total_quotas: input.totalQuotas,
        payment_deadline: input.paymentDeadline,
        notes: input.notes,
        status: "FORMING",
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  },

  async update(id: string, patch: Partial<Pick<PoolRow, "name" | "notes" | "payment_deadline" | "total_quotas" | "quota_value">>) {
    const { error } = await supabase.from("pools").update(patch).eq("id", id);
    if (error) throw error;
  },

  async setStatus(poolId: string, status: PoolStatus, reason?: string) {
    const { error } = await supabase.rpc("pool_set_status", {
      _pool_id: poolId,
      _status: status,
      ...(reason ? { _reason: reason } : {}),
    });
    if (error) throw error;
  },

  async setPublic(poolId: string, enabled: boolean) {
    const { data, error } = await supabase.rpc("pool_set_public", {
      _pool_id: poolId,
      _enabled: enabled,
    });
    if (error) throw error;
    return (data ?? null) as string | null;
  },

  /* ---------------- participantes ---------------- */

  async participants(poolId: string) {
    const { data, error } = await supabase
      .from("pool_participants")
      .select("*")
      .eq("pool_id", poolId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as PoolParticipantRow[];
  },

  async addParticipant(input: {
    poolId: string;
    name: string;
    phone: string | null;
    quotas: number;
    adjustment: number;
    adjustmentReason: string | null;
    notes: string | null;
  }) {
    const { error } = await supabase.from("pool_participants").insert({
      pool_id: input.poolId,
      name: input.name,
      phone: input.phone,
      quotas: input.quotas,
      amount_adjustment: input.adjustment,
      adjustment_reason: input.adjustmentReason,
      notes: input.notes,
      amount_due: 0,
    });
    if (error) throw error;
  },

  async updateParticipant(
    id: string,
    patch: { name?: string; phone?: string | null; quotas?: number; amount_adjustment?: number; adjustment_reason?: string | null; notes?: string | null },
  ) {
    const { error } = await supabase.from("pool_participants").update(patch).eq("id", id);
    if (error) throw error;
  },

  async cancelParticipant(id: string, reason: string) {
    const { error } = await supabase.rpc("pool_cancel_participant", {
      _participant_id: id,
      _reason: reason,
    });
    if (error) throw error;
  },

  async setEligibility(id: string, eligible: boolean, reason?: string) {
    const { error } = await supabase.rpc("pool_set_participant_eligibility", {
      _participant_id: id,
      _eligible: eligible,
      ...(reason ? { _reason: reason } : {}),
    });
    if (error) throw error;
  },

  /* ---------------- pagamentos ---------------- */

  async payments(poolId: string) {
    const { data, error } = await supabase
      .from("pool_payments")
      .select("*")
      .eq("pool_id", poolId)
      .order("paid_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async registerPayment(input: {
    participantId: string;
    amount: number;
    paidAt: string;
    method: string | null;
    notes: string | null;
    allowOverpay?: boolean;
  }) {
    const { error } = await supabase.rpc("pool_register_payment", {
      _participant_id: input.participantId,
      _amount: input.amount,
      _paid_at: input.paidAt,
      ...(input.method ? { _method: input.method } : {}),
      ...(input.notes ? { _notes: input.notes } : {}),
      _allow_overpay: input.allowOverpay ?? false,
    });
    if (error) throw error;
  },

  async cancelPayment(paymentId: string, reason: string) {
    const { error } = await supabase.rpc("pool_cancel_payment", {
      _payment_id: paymentId,
      _reason: reason,
    });
    if (error) throw error;
  },

  /* ---------------- jogos ---------------- */

  async games(poolId: string) {
    const { data, error } = await supabase
      .from("pool_games")
      .select(
        "id, game_id, generated_games!inner(id, sequence_number, numbers_count, status, contest_number, cost, game_numbers(number, position))",
      )
      .eq("pool_id", poolId);
    if (error) throw error;
    return data ?? [];
  },

  async attachGame(poolId: string, gameId: string) {
    const { error } = await supabase.rpc("pool_attach_game", { _pool_id: poolId, _game_id: gameId });
    if (error) throw error;
  },

  async detachGame(poolId: string, gameId: string) {
    const { error } = await supabase.rpc("pool_detach_game", { _pool_id: poolId, _game_id: gameId });
    if (error) throw error;
  },

  /* ---------------- histórico ---------------- */

  async events(poolId: string) {
    const { data, error } = await supabase
      .from("pool_events")
      .select("*")
      .eq("pool_id", poolId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },

  /* ---------------- rateio ---------------- */

  async prizeTotal(poolId: string) {
    const { data, error } = await supabase.rpc("pool_prize_total", { _pool_id: poolId });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async distributions(poolId: string) {
    const { data, error } = await supabase
      .from("pool_prize_distributions")
      .select("*, pool_prize_participants(*)")
      .eq("pool_id", poolId)
      .order("version", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as DistributionRow[];
  },

  async calculateDistribution(poolId: string) {
    const { data, error } = await supabase.rpc("pool_calculate_distribution", { _pool_id: poolId });
    if (error) throw error;
    return data as string;
  },

  async confirmDistribution(distributionId: string) {
    const { error } = await supabase.rpc("pool_confirm_distribution", {
      _distribution_id: distributionId,
    });
    if (error) throw error;
  },

  /* ---------------- documentos ---------------- */

  async documents(poolId: string) {
    const { data, error } = await supabase
      .from("pool_documents")
      .select("*")
      .eq("pool_id", poolId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
