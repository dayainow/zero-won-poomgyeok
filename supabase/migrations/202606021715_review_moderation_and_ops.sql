alter table public.reviews
  add column if not exists status text not null default 'visible'
    check (status in ('visible', 'hidden')),
  add column if not exists hidden_reason text,
  add column if not exists hidden_at timestamptz;

create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) between 0 and 300),
  created_at timestamptz not null default now(),
  unique (review_id, reporter_user_id)
);

create index if not exists review_reports_review_created_idx
  on public.review_reports(review_id, created_at desc);

create index if not exists review_reports_reporter_created_idx
  on public.review_reports(reporter_user_id, created_at desc);

alter table public.review_reports enable row level security;

drop policy if exists "review_reports insert own" on public.review_reports;
create policy "review_reports insert own"
  on public.review_reports
  for insert
  with check (auth.uid() = reporter_user_id);

drop policy if exists "review_reports select own" on public.review_reports;
create policy "review_reports select own"
  on public.review_reports
  for select
  using (auth.uid() = reporter_user_id);

grant select, insert on public.review_reports to authenticated;
