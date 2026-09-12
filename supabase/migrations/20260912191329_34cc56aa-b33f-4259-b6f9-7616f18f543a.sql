CREATE OR REPLACE FUNCTION public.pool_classify_games(_pool_id uuid, _game_ids uuid[])
RETURNS TABLE (
  game_id uuid,
  eligibility text,
  linked_pool_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target AS (
    SELECT p.id, p.owner_id, p.lottery_id,
           COALESCE(p.contest_number, p.contest_number_planned) AS contest_number,
           p.status
    FROM public.pools p
    WHERE p.id = _pool_id
      AND p.owner_id = auth.uid()
  ), requested AS (
    SELECT DISTINCT selected.game_id
    FROM unnest(COALESCE(_game_ids, ARRAY[]::uuid[])) AS selected(game_id)
    LIMIT 200
  )
  SELECT
    r.game_id,
    CASE
      WHEN gg.id IS NULL OR gg.user_id <> auth.uid() THEN 'INELIGIBLE'
      WHEN pg.pool_id = t.id THEN 'LINKED_HERE'
      WHEN pg.pool_id IS NOT NULL THEN 'LINKED_OTHER'
      WHEN gg.lottery_id <> t.lottery_id THEN 'INCOMPATIBLE_LOTTERY'
      WHEN gg.contest_number IS NOT NULL
       AND t.contest_number IS NOT NULL
       AND gg.contest_number <> t.contest_number THEN 'INCOMPATIBLE_CONTEST'
      WHEN t.status IN ('CANCELLED', 'FINISHED') THEN 'POOL_CLOSED'
      ELSE 'AVAILABLE'
    END AS eligibility,
    CASE WHEN pg.pool_id IS NOT NULL AND pg.pool_id <> t.id THEN linked_pool.name ELSE NULL END
      AS linked_pool_name
  FROM requested r
  CROSS JOIN target t
  LEFT JOIN public.generated_games gg ON gg.id = r.game_id
  LEFT JOIN public.pool_games pg ON pg.game_id = r.game_id
  LEFT JOIN public.pools linked_pool ON linked_pool.id = pg.pool_id
  ORDER BY r.game_id;
$$;

REVOKE ALL ON FUNCTION public.pool_classify_games(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pool_classify_games(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pool_classify_games(uuid, uuid[]) TO service_role;

COMMENT ON FUNCTION public.pool_classify_games(uuid, uuid[]) IS
  'Classifica jogos do proprietário pela relação autoritativa pool_games antes do vínculo em massa.';