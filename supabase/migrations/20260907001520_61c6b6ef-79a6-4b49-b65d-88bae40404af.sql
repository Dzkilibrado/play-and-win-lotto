ALTER TYPE public.game_status ADD VALUE IF NOT EXISTS 'AWAITING_CHECK' AFTER 'AWAITING_DRAW';

ALTER TABLE public.generated_games ADD COLUMN IF NOT EXISTS sequence_number integer;
ALTER TABLE public.generated_games ADD COLUMN IF NOT EXISTS image_path text;

UPDATE public.generated_games SET source = 'GENERATED' WHERE source IN ('generator','GENERATOR');
UPDATE public.generated_games SET source = 'MANUAL' WHERE source NOT IN ('GENERATED','MANUAL','PHOTO_TICKET','PHOTO_RECEIPT');

WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.generated_games
)
UPDATE public.generated_games g
SET sequence_number = numbered.rn
FROM numbered
WHERE g.id = numbered.id AND g.sequence_number IS NULL;

CREATE OR REPLACE FUNCTION public.set_game_sequence_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sequence_number IS NULL THEN
    SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO NEW.sequence_number
    FROM public.generated_games WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS generated_games_sequence_number ON public.generated_games;
CREATE TRIGGER generated_games_sequence_number
BEFORE INSERT ON public.generated_games
FOR EACH ROW EXECUTE FUNCTION public.set_game_sequence_number();

CREATE UNIQUE INDEX IF NOT EXISTS generated_games_user_sequence_idx
  ON public.generated_games (user_id, sequence_number);