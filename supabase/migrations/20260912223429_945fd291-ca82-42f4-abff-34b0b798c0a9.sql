CREATE OR REPLACE FUNCTION public.public_next_draws()
RETURNS TABLE (
  lottery_slug text,
  lottery_name text,
  color_key text,
  next_contest_number integer,
  next_draw_date date,
  estimated_next_prize numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    l.slug,
    l.name,
    l.color_key,
    d.next_contest_number,
    d.next_draw_date,
    d.estimated_next_prize
  FROM public.lotteries l
  LEFT JOIN LATERAL (
    SELECT
      ld.next_contest_number,
      ld.next_draw_date,
      ld.estimated_next_prize
    FROM public.lottery_draws ld
    WHERE ld.lottery_id = l.id
    ORDER BY ld.contest_number DESC
    LIMIT 1
  ) d ON true
  WHERE l.is_active = true
    AND l.slug IN ('mega-sena', 'lotofacil', 'quina')
  ORDER BY l.sort_order;
$$;
REVOKE ALL ON FUNCTION public.public_next_draws() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_next_draws() TO anon, authenticated, service_role;