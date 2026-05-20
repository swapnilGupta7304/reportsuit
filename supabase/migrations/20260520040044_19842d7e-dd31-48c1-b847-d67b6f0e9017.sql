ALTER TABLE public.ga4_properties
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS currency_code TEXT;

ALTER TABLE public.play_console_apps
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS developer_account TEXT;

-- Schedule daily Play Console sync (GA4 daily cron already exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cmrs-sync-daily-play');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cmrs-sync-daily-play',
  '30 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://reportsuit.lovable.app/api/public/hooks/sync-daily-play',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeWJnc29kZWNjdHBhZGlub2dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTMxODEsImV4cCI6MjA5NDY4OTE4MX0.NO07Et1udynEOiQIpGKtDc_eML9nuJFIFGyXyrraBHI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);