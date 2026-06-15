create table if not exists public.review_likes (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (review_id, user_id)
);

create index if not exists review_likes_review_idx
  on public.review_likes(review_id);

create index if not exists review_likes_user_idx
  on public.review_likes(user_id);

alter table public.review_likes enable row level security;

drop policy if exists "review_likes insert own" on public.review_likes;
create policy "review_likes insert own"
  on public.review_likes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "review_likes delete own" on public.review_likes;
create policy "review_likes delete own"
  on public.review_likes
  for delete
  using (auth.uid() = user_id);

drop policy if exists "review_likes select public" on public.review_likes;
create policy "review_likes select public"
  on public.review_likes
  for select
  using (true);

grant select, insert, delete on public.review_likes to authenticated;
grant select on public.review_likes to anon;
