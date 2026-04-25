-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Categories
create table public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  group_name text not null check (group_name in ('taxes', 'bills', 'living', 'goals', 'investments', 'lifestyle')),
  target_amount numeric(12,2) not null default 0,
  current_balance numeric(12,2) not null default 0,
  priority integer not null default 3 check (priority between 1 and 5),
  due_date date,
  due_frequency text not null default 'none' check (due_frequency in ('monthly', 'quarterly', 'annual', 'one_time', 'none')),
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Income events
create table public.income_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(12,2) not null,
  source text not null,
  received_at date not null default current_date,
  notes text,
  created_at timestamptz default now() not null
);

-- Allocations (one row per category per income event)
create table public.allocations (
  id uuid default uuid_generate_v4() primary key,
  income_event_id uuid references public.income_events(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  suggested_amount numeric(12,2) not null default 0,
  confirmed_amount numeric(12,2) not null default 0,
  created_at timestamptz default now() not null
);

-- Transactions (individual debits from categories)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  amount numeric(12,2) not null, -- positive = funded, negative = spent
  description text not null,
  date date not null default current_date,
  allocation_id uuid references public.allocations(id) on delete set null,
  created_at timestamptz default now() not null
);

-- User settings
create table public.user_settings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  tax_carveout_percent numeric(5,2) not null default 27.00,
  currency text not null default 'CAD',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger categories_updated_at before update on public.categories
  for each row execute procedure public.handle_updated_at();

create trigger user_settings_updated_at before update on public.user_settings
  for each row execute procedure public.handle_updated_at();

-- Auto-create user settings on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_settings (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table public.categories enable row level security;
alter table public.income_events enable row level security;
alter table public.allocations enable row level security;
alter table public.transactions enable row level security;
alter table public.user_settings enable row level security;

-- RLS Policies
create policy "Users own their categories" on public.categories
  for all using (auth.uid() = user_id);

create policy "Users own their income events" on public.income_events
  for all using (auth.uid() = user_id);

create policy "Users own their allocations" on public.allocations
  for all using (
    exists (
      select 1 from public.income_events
      where id = allocations.income_event_id and user_id = auth.uid()
    )
  );

create policy "Users own their transactions" on public.transactions
  for all using (auth.uid() = user_id);

create policy "Users own their settings" on public.user_settings
  for all using (auth.uid() = user_id);

-- Seed default categories for a new user (call this after signup)
create or replace function public.seed_default_categories(p_user_id uuid)
returns void as $$
begin
  insert into public.categories (user_id, name, group_name, target_amount, priority, due_frequency, sort_order) values
    -- Taxes (priority 1 = critical)
    (p_user_id, 'GST/QST',               'taxes',       0, 1, 'quarterly', 0),
    (p_user_id, 'Federal Income Tax',     'taxes',       0, 1, 'annual',    1),
    (p_user_id, 'Provincial Income Tax',  'taxes',       0, 1, 'annual',    2),
    -- Bills (priority 2)
    (p_user_id, 'Rent',                   'bills',       0, 2, 'monthly',   0),
    (p_user_id, 'Phone',                  'bills',       0, 2, 'monthly',   1),
    (p_user_id, 'Insurance',              'bills',       0, 2, 'monthly',   2),
    (p_user_id, 'Transportation',         'bills',       0, 2, 'monthly',   3),
    (p_user_id, 'Subscriptions',          'bills',       0, 3, 'monthly',   4),
    (p_user_id, 'Professional Fees',      'bills',       0, 2, 'annual',    5),
    -- Living (priority 2)
    (p_user_id, 'Groceries',              'living',      0, 2, 'monthly',   0),
    (p_user_id, 'Medications',            'living',      0, 2, 'none',      1),
    (p_user_id, 'Gas',                    'living',      0, 2, 'monthly',   2),
    (p_user_id, 'Personal Care',          'living',      0, 3, 'monthly',   3),
    -- Goals (priority 3)
    (p_user_id, 'Emergency Fund',         'goals',       0, 2, 'none',      0),
    (p_user_id, 'Osteopathy School',      'goals',       0, 3, 'none',      1),
    (p_user_id, 'Trip Fund',              'goals',       0, 4, 'none',      2),
    (p_user_id, 'Down Payment',           'goals',       0, 3, 'none',      3),
    -- Investments (priority 3)
    (p_user_id, 'TFSA',                   'investments', 0, 3, 'annual',    0),
    (p_user_id, 'FHSA',                   'investments', 0, 3, 'annual',    1),
    (p_user_id, 'REEI',                   'investments', 0, 3, 'annual',    2),
    -- Lifestyle (priority 4-5)
    (p_user_id, 'Eating Out',             'lifestyle',   0, 4, 'monthly',   0),
    (p_user_id, 'Shopping',               'lifestyle',   0, 5, 'monthly',   1),
    (p_user_id, 'Activities',             'lifestyle',   0, 5, 'monthly',   2),
    (p_user_id, 'Coffee & Small Pleasures','lifestyle',  0, 5, 'monthly',   3);
end;
$$ language plpgsql security definer;
