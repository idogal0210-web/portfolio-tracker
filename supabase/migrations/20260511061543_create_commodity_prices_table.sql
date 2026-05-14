create table public.commodity_prices (
  id            serial primary key,
  symbol        text    not null,
  name_he       text    not null,
  category      text    not null,
  price         numeric not null,
  change_daily  numeric,
  change_weekly numeric,
  source        text,
  collected_at  timestamptz default now()
);

create index idx_commodity_prices_symbol       on public.commodity_prices (symbol);
create index idx_commodity_prices_collected_at on public.commodity_prices (collected_at);
create index idx_commodity_prices_category     on public.commodity_prices (category);
