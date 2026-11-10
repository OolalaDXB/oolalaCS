-- Oolala — schedules for the BEAU Solo functions (pg_cron + pg_net). Replace
-- <ANON_KEY> by the project's publishable key (the same as the site's) before
-- running. Re-runnable: cron.schedule replaces a job of the same name.
select cron.schedule('beau-solo-news', '7,37 * * * *', $$
  select net.http_post(url := 'https://ejulkzxohloxfvpbnyyw.supabase.co/functions/v1/solo-news',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'), body := '{}'::jsonb, timeout_milliseconds := 60000)
$$);
select cron.schedule('beau-solo-calendar', '*/15 * * * *', $$
  select net.http_post(url := 'https://ejulkzxohloxfvpbnyyw.supabase.co/functions/v1/solo-calendar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>'), body := '{}'::jsonb, timeout_milliseconds := 60000)
$$);
