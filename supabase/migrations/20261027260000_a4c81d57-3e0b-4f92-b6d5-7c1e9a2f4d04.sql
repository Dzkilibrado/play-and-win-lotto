-- Meu Destino: leituras já realizadas.
--
-- Guarda só o identificador da leitura (hash preso ao usuário, sem nome, data
-- ou local de nascimento) e os números gerados. Serve para avisar "esta
-- análise já foi feita" e mostrar os mesmos números. O usuário vê e apaga as
-- próprias leituras (LGPD).
CREATE TABLE IF NOT EXISTS public.mystic_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL CHECK (char_length(fingerprint) = 32),
  lottery_slug text NOT NULL,
  games jsonb NOT NULL,
  rules_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS mystic_readings_user_created_idx
  ON public.mystic_readings (user_id, created_at DESC);

ALTER TABLE public.mystic_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mystic readings select own" ON public.mystic_readings;
CREATE POLICY "mystic readings select own" ON public.mystic_readings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "mystic readings insert own" ON public.mystic_readings;
CREATE POLICY "mystic readings insert own" ON public.mystic_readings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mystic readings delete own" ON public.mystic_readings;
CREATE POLICY "mystic readings delete own" ON public.mystic_readings
  FOR DELETE TO authenticated USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.mystic_readings TO authenticated;
GRANT ALL ON public.mystic_readings TO service_role;

-- Verificação (somente leitura): deve retornar 0 logo após a migração.
-- SELECT count(*) FROM public.mystic_readings;
