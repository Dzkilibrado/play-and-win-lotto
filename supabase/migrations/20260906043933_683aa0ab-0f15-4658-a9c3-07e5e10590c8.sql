
-- ============ enums ============
CREATE TYPE public.app_role AS ENUM ('USER','ADMIN');
CREATE TYPE public.game_status AS ENUM ('PLANNED','BET','RECEIPTED','AWAITING_DRAW','CHECKED','PRIZED','NOT_PRIZED');
CREATE TYPE public.pool_status AS ENUM ('FORMING','OPEN','CLOSED','AWAITING_DRAW','CHECKED','PRIZED','FINISHED');
CREATE TYPE public.payment_status AS ENUM ('PENDING','PARTIAL','PAID','OVERDUE');
CREATE TYPE public.feature_status AS ENUM ('ACTIVE','BETA','MAINTENANCE','DISABLED');

-- ============ helpers ============
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  phone text,
  avatar_url text,
  theme_preference text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'USER') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

-- ============ roles ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin roles read" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'ADMIN'));

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ lotteries (reference) ============
CREATE TABLE public.lotteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL,
  universe_min int NOT NULL,
  universe_max int NOT NULL,
  min_selectable int NOT NULL,
  max_selectable int NOT NULL,
  base_selectable int NOT NULL,
  color_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lotteries TO anon, authenticated;
GRANT ALL ON public.lotteries TO service_role;
ALTER TABLE public.lotteries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lotteries public read" ON public.lotteries FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER lotteries_updated_at BEFORE UPDATE ON public.lotteries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lottery_prize_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  hits int NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE (lottery_id, hits)
);
GRANT SELECT ON public.lottery_prize_tiers TO anon, authenticated;
GRANT ALL ON public.lottery_prize_tiers TO service_role;
ALTER TABLE public.lottery_prize_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiers public read" ON public.lottery_prize_tiers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.lottery_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  numbers_selected int NOT NULL,
  combination_count bigint NOT NULL,
  price numeric(12,2) NOT NULL,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  source text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lottery_prices_lookup ON public.lottery_prices (lottery_id, numbers_selected, is_active);
GRANT SELECT ON public.lottery_prices TO anon, authenticated;
GRANT ALL ON public.lottery_prices TO service_role;
ALTER TABLE public.lottery_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prices public read" ON public.lottery_prices FOR SELECT TO anon, authenticated USING (true);

-- ============ draws ============
CREATE TABLE public.lottery_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  contest_number int NOT NULL,
  draw_date date,
  draw_location text,
  is_accumulated boolean,
  main_prize numeric(16,2),
  estimated_next_prize numeric(16,2),
  next_contest_number int,
  next_draw_date date,
  revenue numeric(16,2),
  source text,
  source_updated_at timestamptz,
  imported_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lottery_id, contest_number)
);
GRANT SELECT ON public.lottery_draws TO anon, authenticated;
GRANT ALL ON public.lottery_draws TO service_role;
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draws public read" ON public.lottery_draws FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER draws_updated_at BEFORE UPDATE ON public.lottery_draws FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.draw_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  number int NOT NULL,
  position int NOT NULL DEFAULT 0,
  UNIQUE (draw_id, number)
);
GRANT SELECT ON public.draw_numbers TO anon, authenticated;
GRANT ALL ON public.draw_numbers TO service_role;
ALTER TABLE public.draw_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draw numbers public read" ON public.draw_numbers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.draw_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id uuid NOT NULL REFERENCES public.lottery_draws(id) ON DELETE CASCADE,
  tier text NOT NULL,
  hits int NOT NULL,
  winners bigint NOT NULL DEFAULT 0,
  prize_per_winner numeric(16,2) NOT NULL DEFAULT 0,
  UNIQUE (draw_id, hits)
);
GRANT SELECT ON public.draw_prizes TO anon, authenticated;
GRANT ALL ON public.draw_prizes TO service_role;
ALTER TABLE public.draw_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "draw prizes public read" ON public.draw_prizes FOR SELECT TO anon, authenticated USING (true);

-- ============ pools ============
CREATE TABLE public.pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id),
  contest_id uuid REFERENCES public.lottery_draws(id),
  contest_number int,
  name text NOT NULL,
  draw_date date,
  quota_value numeric(12,2) NOT NULL DEFAULT 0,
  total_quotas int NOT NULL DEFAULT 0,
  payment_deadline date,
  status public.pool_status NOT NULL DEFAULT 'FORMING',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pools TO authenticated;
GRANT ALL ON public.pools TO service_role;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pools_updated_at BEFORE UPDATE ON public.pools FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.pool_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  quotas int NOT NULL DEFAULT 1,
  amount_due numeric(12,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_participants TO authenticated;
GRANT ALL ON public.pool_participants TO service_role;
ALTER TABLE public.pool_participants ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER pool_participants_updated_at BEFORE UPDATE ON public.pool_participants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_pool_owner(_pool_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pools p WHERE p.id = _pool_id AND p.owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_pool_member(_pool_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pools p WHERE p.id = _pool_id AND p.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.pool_participants pp WHERE pp.pool_id = _pool_id AND pp.user_id = auth.uid());
$$;

CREATE POLICY "pools member read" ON public.pools FOR SELECT TO authenticated USING (public.is_pool_member(id));
CREATE POLICY "pools owner insert" ON public.pools FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pools owner update" ON public.pools FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pools owner delete" ON public.pools FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "participants member read" ON public.pool_participants FOR SELECT TO authenticated USING (public.is_pool_member(pool_id));
CREATE POLICY "participants owner write" ON public.pool_participants FOR ALL TO authenticated USING (public.is_pool_owner(pool_id)) WITH CHECK (public.is_pool_owner(pool_id));

CREATE TABLE public.pool_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.pool_participants(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_at timestamptz,
  method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_payments TO authenticated;
GRANT ALL ON public.pool_payments TO service_role;
ALTER TABLE public.pool_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments member read" ON public.pool_payments FOR SELECT TO authenticated USING (public.is_pool_member(pool_id));
CREATE POLICY "payments owner write" ON public.pool_payments FOR ALL TO authenticated USING (public.is_pool_owner(pool_id)) WITH CHECK (public.is_pool_owner(pool_id));

-- ============ games ============
CREATE TABLE public.generated_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id),
  draw_id uuid REFERENCES public.lottery_draws(id),
  contest_number int,
  pool_id uuid REFERENCES public.pools(id) ON DELETE SET NULL,
  numbers_count int NOT NULL,
  status public.game_status NOT NULL DEFAULT 'PLANNED',
  hits int,
  prize_amount numeric(16,2),
  cost numeric(12,2),
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generated_games_user_idx ON public.generated_games (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_games TO authenticated;
GRANT ALL ON public.generated_games TO service_role;
ALTER TABLE public.generated_games ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER generated_games_updated_at BEFORE UPDATE ON public.generated_games FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "games own read" ON public.generated_games FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR (pool_id IS NOT NULL AND public.is_pool_member(pool_id)));
CREATE POLICY "games own write" ON public.generated_games FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.can_read_game(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.generated_games g
    WHERE g.id = _game_id
      AND (g.user_id = auth.uid() OR (g.pool_id IS NOT NULL AND public.is_pool_member(g.pool_id)))
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_game(_game_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.generated_games g WHERE g.id = _game_id AND g.user_id = auth.uid());
$$;

CREATE TABLE public.game_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.generated_games(id) ON DELETE CASCADE,
  number int NOT NULL,
  position int NOT NULL DEFAULT 0,
  UNIQUE (game_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_numbers TO authenticated;
GRANT ALL ON public.game_numbers TO service_role;
ALTER TABLE public.game_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game numbers read" ON public.game_numbers FOR SELECT TO authenticated USING (public.can_read_game(game_id));
CREATE POLICY "game numbers write" ON public.game_numbers FOR ALL TO authenticated USING (public.owns_game(game_id)) WITH CHECK (public.owns_game(game_id));

CREATE TABLE public.game_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL UNIQUE REFERENCES public.generated_games(id) ON DELETE CASCADE,
  even_count int,
  odd_count int,
  prime_count int,
  fibonacci_count int,
  sum_total int,
  max_sequence int,
  repeated_from_last int,
  row_distribution jsonb,
  column_distribution jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_analysis TO authenticated;
GRANT ALL ON public.game_analysis TO service_role;
ALTER TABLE public.game_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game analysis read" ON public.game_analysis FOR SELECT TO authenticated USING (public.can_read_game(game_id));
CREATE POLICY "game analysis write" ON public.game_analysis FOR ALL TO authenticated USING (public.owns_game(game_id)) WITH CHECK (public.owns_game(game_id));

CREATE TABLE public.pool_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.generated_games(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, game_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_games TO authenticated;
GRANT ALL ON public.pool_games TO service_role;
ALTER TABLE public.pool_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool games read" ON public.pool_games FOR SELECT TO authenticated USING (public.is_pool_member(pool_id));
CREATE POLICY "pool games write" ON public.pool_games FOR ALL TO authenticated USING (public.is_pool_owner(pool_id)) WITH CHECK (public.is_pool_owner(pool_id));

CREATE TABLE public.pool_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  participant_id uuid REFERENCES public.pool_participants(id) ON DELETE SET NULL,
  game_id uuid REFERENCES public.generated_games(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'PAYMENT_RECEIPT',
  storage_path text NOT NULL,
  mime_type text,
  file_size int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pool_documents TO authenticated;
GRANT ALL ON public.pool_documents TO service_role;
ALTER TABLE public.pool_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pool documents read" ON public.pool_documents FOR SELECT TO authenticated USING (public.is_pool_member(pool_id));
CREATE POLICY "pool documents write" ON public.pool_documents FOR ALL TO authenticated USING (public.is_pool_owner(pool_id)) WITH CHECK (public.is_pool_owner(pool_id));

-- ============ notifications ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'INFO',
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ audit ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit own read" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'ADMIN'));

-- ============ feature flags ============
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  status public.feature_status NOT NULL DEFAULT 'DISABLED',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flags public read" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER feature_flags_updated_at BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ seed (reference data only) ============
INSERT INTO public.lotteries (slug,name,short_name,universe_min,universe_max,min_selectable,max_selectable,base_selectable,color_key,sort_order) VALUES
 ('mega-sena','Mega-Sena','Mega',1,60,6,20,6,'mega',1),
 ('lotofacil','Lotofácil','Lotofácil',1,25,15,20,15,'lotofacil',2),
 ('quina','Quina','Quina',1,80,5,15,5,'quina',3);

INSERT INTO public.lottery_prize_tiers (lottery_id,hits,label,sort_order)
SELECT id,6,'Sena',1 FROM public.lotteries WHERE slug='mega-sena'
UNION ALL SELECT id,5,'Quina',2 FROM public.lotteries WHERE slug='mega-sena'
UNION ALL SELECT id,4,'Quadra',3 FROM public.lotteries WHERE slug='mega-sena'
UNION ALL SELECT id,15,'15 acertos',1 FROM public.lotteries WHERE slug='lotofacil'
UNION ALL SELECT id,14,'14 acertos',2 FROM public.lotteries WHERE slug='lotofacil'
UNION ALL SELECT id,13,'13 acertos',3 FROM public.lotteries WHERE slug='lotofacil'
UNION ALL SELECT id,12,'12 acertos',4 FROM public.lotteries WHERE slug='lotofacil'
UNION ALL SELECT id,11,'11 acertos',5 FROM public.lotteries WHERE slug='lotofacil'
UNION ALL SELECT id,5,'Quina',1 FROM public.lotteries WHERE slug='quina'
UNION ALL SELECT id,4,'Quadra',2 FROM public.lotteries WHERE slug='quina'
UNION ALL SELECT id,3,'Terno',3 FROM public.lotteries WHERE slug='quina'
UNION ALL SELECT id,2,'Duque',4 FROM public.lotteries WHERE slug='quina';

INSERT INTO public.feature_flags (key,label,status,description) VALUES
 ('generator','Gerador de jogos','MAINTENANCE','Motor de geração de jogos ainda não implementado.'),
 ('official_sync','Sincronização de resultados oficiais','DISABLED','Camada de sincronização com fonte oficial pendente.'),
 ('statistics','Estatísticas','MAINTENANCE','Estatísticas históricas dependem da carga de concursos.'),
 ('auto_check','Conferência automática','DISABLED','Conferência automática de jogos pendente.'),
 ('pools','Bolões','BETA','Estrutura de bolões em construção.'),
 ('notifications','Notificações','DISABLED','Notificações e alertas de contagem regressiva pendentes.'),
 ('whatsapp_share','Compartilhamento via WhatsApp','DISABLED','Compartilhamento por link/share nativo pendente.');
