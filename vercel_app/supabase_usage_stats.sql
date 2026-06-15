create table if not exists public.usage_visitors (
  id text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('visit', 'quote')),
  visitor_id text references public.usage_visitors(id),
  status text,
  path text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_event_type_idx on public.usage_events(event_type);
create index if not exists usage_events_created_at_idx on public.usage_events(created_at desc);
