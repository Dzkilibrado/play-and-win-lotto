CREATE TYPE public.sync_job_status AS ENUM ('pending','running','completed','completed_with_errors','failed');
CREATE TYPE public.sync_job_type AS ENUM ('LATEST','RECENT','HISTORICAL','REPROCESS');

CREATE TABLE public.lottery_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  type public.sync_job_type NOT NULL,
  status public.sync_job_status NOT NULL DEFAULT 'pending',
  start_contest integer,
  end_contest integer,
  current_contest integer,
  processed integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lottery_sync_jobs TO authenticated;
GRANT ALL ON public.lottery_sync_jobs TO service_role;
ALTER TABLE public.lottery_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync jobs admin read" ON public.lottery_sync_jobs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER lottery_sync_jobs_updated_at BEFORE UPDATE ON public.lottery_sync_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lottery_sync_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.lottery_sync_jobs(id) ON DELETE CASCADE,
  lottery_id uuid NOT NULL REFERENCES public.lotteries(id) ON DELETE CASCADE,
  contest_number integer,
  error_type text NOT NULL,
  message text NOT NULL,
  payload_summary text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lottery_sync_errors TO authenticated;
GRANT ALL ON public.lottery_sync_errors TO service_role;
ALTER TABLE public.lottery_sync_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync errors admin read" ON public.lottery_sync_errors FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE INDEX idx_sync_jobs_lottery_status ON public.lottery_sync_jobs (lottery_id, status, created_at DESC);
CREATE INDEX idx_sync_errors_job ON public.lottery_sync_errors (job_id, created_at DESC);
CREATE INDEX idx_sync_errors_lottery_contest ON public.lottery_sync_errors (lottery_id, contest_number) WHERE resolved_at IS NULL;

CREATE UNIQUE INDEX lottery_prices_unique_version ON public.lottery_prices (lottery_id, numbers_selected, valid_from);

CREATE INDEX idx_draws_lottery_contest ON public.lottery_draws (lottery_id, contest_number DESC);
CREATE INDEX idx_draws_draw_date ON public.lottery_draws (draw_date DESC);
CREATE INDEX idx_draws_lottery_accumulated ON public.lottery_draws (lottery_id, is_accumulated);
CREATE INDEX idx_draw_numbers_draw ON public.draw_numbers (draw_id);
CREATE INDEX idx_draw_prizes_draw ON public.draw_prizes (draw_id);