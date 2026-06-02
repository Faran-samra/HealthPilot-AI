-- WHO GHO Pakistan stats cache (24h TTL, written by who-pakistan-stats edge function)
create table if not exists public.who_pakistan_stats_cache (
  cache_key text primary key default 'pakistan',
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists who_pakistan_stats_cache_expires_idx
  on public.who_pakistan_stats_cache (expires_at);

alter table public.who_pakistan_stats_cache enable row level security;

-- No public policies: only service role (edge function) reads/writes this table.
