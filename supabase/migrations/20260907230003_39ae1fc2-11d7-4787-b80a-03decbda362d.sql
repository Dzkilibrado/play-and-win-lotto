CREATE OR REPLACE FUNCTION public.search_draws(
  _lottery_slug text DEFAULT NULL,
  _contest integer DEFAULT NULL,
  _date_from date DEFAULT NULL,
  _date_to date DEFAULT NULL,
  _situation text DEFAULT NULL,
  _numbers integer[] DEFAULT NULL,
  _sort text DEFAULT 'recent',
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit integer := least(greatest(coalesce(_page_size, 25), 1), 100);
  _offset integer := (greatest(coalesce(_page, 1), 1) - 1) * _limit;
  _count integer := coalesce(array_length(_numbers, 1), 0);
  _total bigint;
  _rows jsonb;
BEGIN
  WITH base AS (
    SELECT d.id, d.contest_number, d.draw_date, d.is_accumulated, d.main_prize, d.revenue,
           l.slug, l.name, l.color_key
    FROM public.lottery_draws d
    JOIN public.lotteries l ON l.id = d.lottery_id
    WHERE (_lottery_slug IS NULL OR l.slug = _lottery_slug)
      AND (_contest IS NULL OR d.contest_number = _contest)
      AND (_date_from IS NULL OR d.draw_date >= _date_from)
      AND (_date_to IS NULL OR d.draw_date <= _date_to)
      AND (
        _situation IS NULL
        OR (_situation = 'accumulated' AND d.is_accumulated IS TRUE)
        OR (_situation = 'winner' AND coalesce(d.main_prize, 0) > 0)
        OR (_situation = 'done' AND d.draw_date IS NOT NULL AND d.draw_date <= current_date
            AND EXISTS (SELECT 1 FROM public.draw_numbers n WHERE n.draw_id = d.id))
        OR (_situation = 'pending' AND (d.draw_date IS NULL OR d.draw_date > current_date
            OR NOT EXISTS (SELECT 1 FROM public.draw_numbers n WHERE n.draw_id = d.id)))
      )
      AND (
        _count = 0
        OR (SELECT count(*) FROM public.draw_numbers n
            WHERE n.draw_id = d.id AND n.number = ANY(_numbers)) = _count
      )
  ), counted AS (
    SELECT count(*) AS total FROM base
  ), page AS (
    SELECT * FROM base
    ORDER BY
      CASE WHEN _sort = 'oldest' THEN contest_number END ASC,
      CASE WHEN _sort = 'prize_desc' THEN main_prize END DESC NULLS LAST,
      CASE WHEN _sort = 'prize_asc' THEN main_prize END ASC NULLS LAST,
      CASE WHEN _sort = 'revenue_desc' THEN revenue END DESC NULLS LAST,
      CASE WHEN _sort IS NULL OR _sort NOT IN ('oldest','prize_desc','prize_asc','revenue_desc')
           THEN draw_date END DESC NULLS LAST,
      contest_number DESC
    LIMIT _limit OFFSET _offset
  )
  SELECT (SELECT total FROM counted),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'contestNumber', p.contest_number,
           'drawDate', p.draw_date,
           'isAccumulated', p.is_accumulated,
           'mainPrize', p.main_prize,
           'revenue', p.revenue,
           'lotterySlug', p.slug,
           'lotteryName', p.name,
           'colorKey', p.color_key,
           'numbers', coalesce((SELECT jsonb_agg(n.number ORDER BY n.number)
                                FROM public.draw_numbers n WHERE n.draw_id = p.id), '[]'::jsonb)
         )), '[]'::jsonb)
  INTO _total, _rows
  FROM page p;

  RETURN jsonb_build_object('total', _total, 'page', greatest(coalesce(_page,1),1),
                            'pageSize', _limit, 'rows', _rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.lottery_combination_stats(
  _lottery_slug text,
  _numbers integer[],
  _window integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _lottery_id uuid;
  _count integer := coalesce(array_length(_numbers, 1), 0);
  _analyzed integer;
  _occurrences integer;
  _recent jsonb;
BEGIN
  SELECT id INTO _lottery_id FROM public.lotteries WHERE slug = _lottery_slug;
  IF _lottery_id IS NULL OR _count = 0 THEN
    RETURN jsonb_build_object('contestsAnalyzed', 0, 'occurrences', 0, 'draws', '[]'::jsonb);
  END IF;

  WITH scope AS (
    SELECT d.id, d.contest_number, d.draw_date
    FROM public.lottery_draws d
    WHERE d.lottery_id = _lottery_id
    ORDER BY d.contest_number DESC
    LIMIT CASE WHEN _window IS NULL THEN NULL ELSE _window END
  ), hits AS (
    SELECT s.* FROM scope s
    WHERE (SELECT count(*) FROM public.draw_numbers n
           WHERE n.draw_id = s.id AND n.number = ANY(_numbers)) = _count
  )
  SELECT (SELECT count(*) FROM scope),
         (SELECT count(*) FROM hits),
         coalesce((SELECT jsonb_agg(jsonb_build_object(
             'id', h.id, 'contestNumber', h.contest_number, 'drawDate', h.draw_date
           ) ORDER BY h.contest_number DESC)
           FROM (SELECT * FROM hits ORDER BY contest_number DESC LIMIT 10) h), '[]'::jsonb)
  INTO _analyzed, _occurrences, _recent;

  RETURN jsonb_build_object(
    'contestsAnalyzed', _analyzed,
    'occurrences', _occurrences,
    'draws', _recent
  );
END;
$$;