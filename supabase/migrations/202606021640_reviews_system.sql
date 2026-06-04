create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  event_title text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) between 0 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reviews_user_created_at_idx
  on public.reviews(user_id, created_at desc);

create index if not exists reviews_event_created_at_idx
  on public.reviews(event_id, created_at desc);

alter table public.reviews enable row level security;

create policy "reviews insert own"
  on public.reviews
  for insert
  with check (auth.uid() = user_id);

create policy "reviews select own"
  on public.reviews
  for select
  using (auth.uid() = user_id);

create policy "reviews select public event"
  on public.reviews
  for select
  using (true);

grant select, insert on public.reviews to authenticated;
grant select on public.reviews to anon;
