create policy "saved events update own"
  on public.user_saved_events
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_saved_events.user_id
      and profiles.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = user_saved_events.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

create policy "recent searches update own"
  on public.user_recent_searches
  for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = user_recent_searches.user_id
      and profiles.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = user_recent_searches.user_id
      and profiles.auth_user_id = auth.uid()
    )
  );

grant update on public.user_saved_events to authenticated;
grant update on public.user_recent_searches to authenticated;
