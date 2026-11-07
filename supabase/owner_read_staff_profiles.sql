-- Allow an owner to read only their own staff profiles, including cashier names
-- needed when reprinting transaction receipts.
drop policy if exists "profiles_owner_select_staff" on public.profiles;
create policy "profiles_owner_select_staff" on public.profiles
  for select using (
    role = 'staff'
    and owner_id = auth.uid()
    and public.current_user_is_owner()
  );
