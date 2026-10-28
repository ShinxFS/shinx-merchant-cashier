alter table public.profiles
  add column if not exists currency_code text not null default 'IDR';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_currency_code_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_currency_code_check
      check (currency_code in (
        'IDR', 'USD', 'SGD', 'MYR', 'THB', 'PHP', 'JPY', 'CNY',
        'KRW', 'VND', 'EUR', 'GBP', 'AUD', 'CAD', 'KWD'
      ));
  end if;
end;
$$;

drop function if exists public.convert_business_currency(text, numeric);
