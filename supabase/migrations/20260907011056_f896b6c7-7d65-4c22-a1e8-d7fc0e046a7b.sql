ALTER TABLE public.generated_games
  ADD COLUMN IF NOT EXISTS generation_constraints jsonb,
  ADD COLUMN IF NOT EXISTS generation_rules_version integer;

ALTER TABLE public.generated_games
  ADD CONSTRAINT generated_games_constraints_size_chk
  CHECK (generation_constraints IS NULL OR pg_column_size(generation_constraints) <= 8192);

ALTER TABLE public.generated_games
  ADD CONSTRAINT generated_games_rules_version_chk
  CHECK (generation_rules_version IS NULL OR (generation_rules_version >= 1 AND generation_rules_version <= 1000));

COMMENT ON COLUMN public.generated_games.generation_constraints IS 'Snapshot estruturado dos filtros de geracao aplicados (Fase 3B).';
COMMENT ON COLUMN public.generated_games.generation_rules_version IS 'Versao do conjunto de regras de geracao usado.';