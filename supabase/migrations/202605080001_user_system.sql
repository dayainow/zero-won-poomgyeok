create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  nickname text not null,
  district text,
  avatar_url text,
  interests text[] not null default '{}',
  marketing_consent boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_region text not null default '서울',
  radius_km integer not null default 5,
  push_enabled boolean not null default true,
  event_push_enabled boolean not null default true,
  marketing_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id text not null,
  event_source text not null default 'seoul-open-api',
  event_title text not null,
  event_category text not null,
  event_location text,
  event_start_date date,
  event_end_date date,
  event_snapshot jsonb not null,
  saved_at timestamptz not null default now(),
  unique(user_id, event_id)
);

create table if not exists public.user_recent_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  query text not null,
  searched_at timestamptz not null default now(),
  unique(user_id, query)
);

create index if not exists profiles_auth_user_id_idx
  on public.profiles(auth_user_id);

create index if not exists user_saved_events_user_saved_at_idx
  on public.user_saved_events(user_id, saved_at desc);

create index if not exists user_recent_searches_user_searched_at_idx
  on public.user_recent_searches(user_id, searched_at desc);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_saved_events enable row level security;
alter table public.user_recent_searches enable row level security;

create policy "profiles select own"
  on public.profiles
  for select
  using (auth.uid() = auth_user_id);

create policy "profiles insert own"
  on public.profiles
  for insert
  with check (auth.uid() = auth_user_id);

create policy "profiles update own"
  on public.profiles
  for update
  using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "preferences select own"
  on public.user_preferences
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_preferences.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "preferences insert own"
  on public.user_preferences
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = user_preferences.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "preferences update own"
  on public.user_preferences
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_preferences.user_id
      and profiles.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = user_preferences.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "saved events select own"
  on public.user_saved_events
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_saved_events.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "saved events insert own"
  on public.user_saved_events
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = user_saved_events.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "saved events delete own"
  on public.user_saved_events
  for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_saved_events.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "recent searches select own"
  on public.user_recent_searches
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_recent_searches.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "recent searches insert own"
  on public.user_recent_searches
  for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = user_recent_searches.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, delete on public.user_saved_events to authenticated;
grant select, insert, delete on public.user_recent_searches to authenticated;
