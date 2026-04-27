-- Accounts table
create table public.accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in (
    'checking', 'savings', 'cash',
    'credit_card', 'line_of_credit',
    'mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'medical_debt', 'other_debt',
    'tfsa', 'fhsa', 'rrsp', 'rdsp', 'investment_other'
  )),
  -- cash/investment: amount you have; debt: outstanding amount owed (positive)
  balance numeric(12,2) not null default 0,
  credit_limit numeric(12,2),                   -- credit_card / line_of_credit
  interest_rate numeric(5,2),                    -- debt accounts, annual %
  -- registered accounts (tfsa, fhsa, rrsp, rdsp)
  contribution_room numeric(12,2),               -- available room (user enters from CRA)
  yearly_contribution_limit numeric(12,2),       -- annual cap
  contributions_ytd numeric(12,2) default 0,     -- contributed this calendar year
  -- auto-created payment category (debt accounts only)
  payment_category_id uuid references public.categories(id) on delete set null,
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Account transfers (debt payments: checking → visa)
create table public.account_transfers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  from_account_id uuid references public.accounts(id) on delete cascade not null,
  to_account_id uuid references public.accounts(id) on delete cascade not null,
  amount numeric(12,2) not null,
  date date not null default current_date,
  description text,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz default now() not null
);

-- Link existing tables to accounts
alter table public.income_events
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- RLS
alter table public.accounts enable row level security;
alter table public.account_transfers enable row level security;

create policy "Users own their accounts" on public.accounts
  for all using (auth.uid() = user_id);

create policy "Users own their account transfers" on public.account_transfers
  for all using (auth.uid() = user_id);

-- updated_at trigger for accounts
create trigger accounts_updated_at before update on public.accounts
  for each row execute procedure public.handle_updated_at();
