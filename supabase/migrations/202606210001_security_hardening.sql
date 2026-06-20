-- Shared, database-backed rate limiting for server actions.

create table if not exists public.security_rate_limits (
  request_key text primary key,
  request_count int not null default 0 check (request_count >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists security_rate_limits_window_idx
on public.security_rate_limits(window_started_at);

alter table public.security_rate_limits enable row level security;

create or replace function public.consume_rate_limit(
  checked_key text,
  max_requests int,
  window_seconds int
)
returns table (
  allowed boolean,
  retry_after int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.security_rate_limits%rowtype;
  window_end timestamptz;
begin
  if checked_key is null or length(checked_key) < 16 or length(checked_key) > 160 then
    raise exception 'INVALID_RATE_LIMIT_KEY';
  end if;

  if max_requests < 1 or max_requests > 50 or window_seconds < 1 or window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT_WINDOW';
  end if;

  delete from public.security_rate_limits
  where window_started_at < now() - interval '2 days';

  select * into current_row
  from public.security_rate_limits
  where request_key = checked_key
  for update;

  if current_row.request_key is null then
    insert into public.security_rate_limits(request_key, request_count, window_started_at, updated_at)
    values (checked_key, 1, now(), now());

    allowed := true;
    retry_after := 0;
    return next;
    return;
  end if;

  window_end := current_row.window_started_at + make_interval(secs => window_seconds);

  if window_end <= now() then
    update public.security_rate_limits
    set request_count = 1, window_started_at = now(), updated_at = now()
    where request_key = checked_key;

    allowed := true;
    retry_after := 0;
    return next;
    return;
  end if;

  if current_row.request_count >= max_requests then
    allowed := false;
    retry_after := greatest(1, ceil(extract(epoch from (window_end - now())))::int);
    return next;
    return;
  end if;

  update public.security_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where request_key = checked_key;

  allowed := true;
  retry_after := 0;
  return next;
end;
$$;

revoke all on table public.security_rate_limits from anon, authenticated;
revoke all on function public.consume_rate_limit(text, int, int) from public;
grant execute on function public.consume_rate_limit(text, int, int) to anon, authenticated;
