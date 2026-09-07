CREATE INDEX IF NOT EXISTS lottery_draws_lottery_contest_idx
  ON public.lottery_draws (lottery_id, contest_number DESC);

CREATE INDEX IF NOT EXISTS draw_numbers_draw_number_idx
  ON public.draw_numbers (draw_id, number);

CREATE OR REPLACE FUNCTION public.lottery_number_statistics(
  _lottery_slug text,
  _window integer DEFAULT NULL,
  _max_contest integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH lot AS (
    SELECT id, universe_min, universe_max
    FROM lotteries
    WHERE slug = _lottery_slug
    LIMIT 1
  ),
  base AS (
    SELECT d.id,
           d.contest_number,
           row_number() OVER (ORDER BY d.contest_number DESC) AS rn
    FROM lottery_draws d
    JOIN lot ON d.lottery_id = lot.id
    WHERE (_max_contest IS NULL OR d.contest_number < _max_contest)
  ),
  totals AS (
    SELECT count(*)::int AS total,
           max(contest_number) AS last_contest,
           min(contest_number) AS first_contest
    FROM base
  ),
  win AS (
    SELECT CASE
             WHEN _window IS NULL OR _window <= 0 THEN (SELECT total FROM totals)
             ELSE least(_window, (SELECT total FROM totals))
           END AS w
  ),
  occ AS (
    SELECT dn.number,
           count(*)::int AS total_occurrences,
           count(*) FILTER (WHERE b.rn <= (SELECT w FROM win))::int AS recent_occurrences,
           min(b.rn)::int AS last_rn
    FROM draw_numbers dn
    JOIN base b ON b.id = dn.draw_id
    GROUP BY dn.number
  ),
  nums AS (
    SELECT g AS number FROM lot, generate_series(lot.universe_min, lot.universe_max) AS g
  )
  SELECT jsonb_build_object(
    'lotterySlug', _lottery_slug,
    'contestsAnalyzed', (SELECT total FROM totals),
    'windowContests', (SELECT w FROM win),
    'requestedWindow', _window,
    'lastContestConsidered', (SELECT last_contest FROM totals),
    'firstContestConsidered', (SELECT first_contest FROM totals),
    'numbers', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'number', n.number,
          'totalOccurrences', coalesce(o.total_occurrences, 0),
          'recentOccurrences', coalesce(o.recent_occurrences, 0),
          'drawsSinceLastAppearance',
            CASE WHEN o.last_rn IS NULL THEN (SELECT total FROM totals) ELSE o.last_rn - 1 END
        ) ORDER BY n.number
      ),
      '[]'::jsonb
    )
  )
  FROM nums n
  LEFT JOIN occ o ON o.number = n.number;
$function$;

REVOKE ALL ON FUNCTION public.lottery_number_statistics(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lottery_number_statistics(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lottery_number_statistics(text, integer, integer) TO service_role;