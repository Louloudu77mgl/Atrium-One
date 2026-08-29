-- Exécuter dans le SQL Editor Supabase après avoir remplacé {{CRON_SECRET}}
-- par la valeur CRON_SECRET configurée dans Vercel.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

do $$
declare
  existing_secret_id uuid;
begin
  select id
  into existing_secret_id
  from vault.secrets
  where name = 'atrium_social_publish_cron'
  limit 1;

  if existing_secret_id is null then
    perform vault.create_secret(
      '{{CRON_SECRET}}',
      'atrium_social_publish_cron',
      'Authentification du cron Supabase qui publie les posts Instagram planifiés.'
    );
  else
    perform vault.update_secret(
      existing_secret_id,
      '{{CRON_SECRET}}',
      'atrium_social_publish_cron',
      'Authentification du cron Supabase qui publie les posts Instagram planifiés.'
    );
  end if;
end
$$;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'atrium-social-publish-every-minute'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'atrium-social-publish-every-minute',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://atrium-one-self.vercel.app/api/cron/social-publish',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'atrium_social_publish_cron'
          limit 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cron$
);
