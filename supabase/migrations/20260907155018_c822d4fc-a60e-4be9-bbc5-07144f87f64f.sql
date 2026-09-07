CREATE OR REPLACE FUNCTION public.pool_public_summary(_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH p AS (
    SELECT * FROM pools WHERE public_token = _token AND is_public = true
  ),
  d AS (
    SELECT ld.* FROM lottery_draws ld JOIN p ON p.lottery_id = ld.lottery_id
    WHERE ld.contest_number = COALESCE(p.contest_number, p.contest_number_planned)
    LIMIT 1
  ),
  g AS (
    SELECT gg.id,
           row_number() OVER (ORDER BY gg.created_at, gg.id) AS ordinal,
           gg.status,
           COALESCE((SELECT array_agg(gn.number ORDER BY gn.number)
                     FROM game_numbers gn WHERE gn.game_id = gg.id), '{}') AS numbers,
           r.hits, r.is_prized, r.prize_label, r.total_prize
    FROM pool_games pg
    JOIN p ON p.id = pg.pool_id
    JOIN generated_games gg ON gg.id = pg.game_id
    LEFT JOIN game_check_results r ON r.game_id = gg.id
    WHERE gg.status <> 'PLANNED'
  )
  SELECT jsonb_build_object(
    'name', p.name,
    'lottery', l.name,
    'lotterySlug', l.slug,
    'contestNumber', COALESCE(p.contest_number, p.contest_number_planned),
    'drawDate', COALESCE(p.draw_date, p.draw_date_planned),
    'drawDatePlanned', (p.draw_date IS NULL),
    'status', p.status,
    'totalQuotas', p.total_quotas,
    'assignedQuotas', COALESCE((SELECT SUM(pp.quotas) FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE'), 0),
    'paidQuotas', COALESCE((SELECT SUM(pp.quotas) FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'), 0),
    'confirmedParticipants', COALESCE((SELECT COUNT(*) FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'), 0),
    'availableQuotas', CASE WHEN p.total_quotas IS NULL THEN NULL ELSE GREATEST(
        p.total_quotas - COALESCE((SELECT SUM(pp.quotas) FROM pool_participants pp
          WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE'), 0), 0) END,
    'games', (SELECT COUNT(*) FROM g),
    'participants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', pp.name, 'quotas', pp.quotas)
                         ORDER BY pp.name, pp.created_at)
        FROM pool_participants pp
        WHERE pp.pool_id = p.id AND pp.status = 'ACTIVE' AND pp.payment_status = 'PAID'
      ), '[]'::jsonb),
    'gameList', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
                 'ordinal', g.ordinal,
                 'numbers', g.numbers,
                 'status', g.status,
                 'hits', g.hits,
                 'isPrized', g.is_prized,
                 'prizeLabel', g.prize_label,
                 'prizeAmount', g.total_prize
               ) ORDER BY g.ordinal)
        FROM g
      ), '[]'::jsonb),
    'result', (
      SELECT CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
        'contestNumber', d.contest_number,
        'drawDate', d.draw_date,
        'drawnNumbers', COALESCE((SELECT array_agg(dn.number ORDER BY dn.number)
                                  FROM draw_numbers dn WHERE dn.draw_id = d.id), '{}'),
        'checkedGames', (SELECT COUNT(*) FROM g WHERE g.hits IS NOT NULL),
        'prizedGames', (SELECT COUNT(*) FROM g WHERE g.is_prized),
        'totalPrize', (SELECT SUM(g.total_prize) FROM g WHERE g.is_prized)
      ) END FROM d
    )
  )
  FROM p JOIN lotteries l ON l.id = p.lottery_id;
$function$;