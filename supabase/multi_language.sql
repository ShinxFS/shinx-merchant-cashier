alter table public.profiles
  add column if not exists language_code text not null default 'id';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_language_code_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_language_code_check
      check (language_code in ('id', 'en'));
  end if;
end;
$$;
