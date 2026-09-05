-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: replace the six category groups with five money layers.
--
--   taxes | bills | living | goals | investments | lifestyle
--        ↓
--   protected | operating | debt | sinking | wealth
--
-- The column keeps the name `group_name` so every existing query, index and
-- foreign key stays valid — only the permitted values change.
--
-- This is a ONE-WAY migration. Run it once, in the Supabase SQL Editor.
-- It is wrapped in a transaction: if any step fails, nothing is applied.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- 1. Drop the old constraint so rows can be remapped.
alter table public.categories
  drop constraint if exists categories_group_name_check;

-- 2. Remap existing rows. Order matters — the debt rule must run before the
--    generic bills→operating rule, and the goals rules are name-sensitive.

-- Any category that a debt account points at is a debt payment category.
update public.categories c
   set group_name = 'debt'
  from public.accounts a
 where a.payment_category_id = c.id;

-- Taxes are protected money.
update public.categories
   set group_name = 'protected'
 where group_name = 'taxes';

-- Emergency fund is protection, not a goal.
update public.categories
   set group_name = 'protected'
 where group_name = 'goals'
   and lower(name) like '%emergency%';

-- Long-horizon goals are wealth building.
update public.categories
   set group_name = 'wealth'
 where group_name = 'goals'
   and (lower(name) like '%down payment%'
     or lower(name) like '%retirement%'
     or lower(name) like '%pension%');

-- Everything else previously in goals is a dated commitment.
update public.categories
   set group_name = 'sinking'
 where group_name = 'goals';

-- Investments become wealth building.
update public.categories
   set group_name = 'wealth'
 where group_name = 'investments';

-- Day-to-day money is one layer now.
update public.categories
   set group_name = 'operating'
 where group_name in ('bills', 'living', 'lifestyle');

-- 3. Safety net: anything unmapped (a value we did not anticipate) becomes
--    operating rather than blocking the constraint below.
update public.categories
   set group_name = 'operating'
 where group_name not in ('protected', 'operating', 'debt', 'sinking', 'wealth');

-- 4. Apply the new constraint.
alter table public.categories
  add constraint categories_group_name_check
  check (group_name in ('protected', 'operating', 'debt', 'sinking', 'wealth'));

-- 5. Reseed function for new signups, using the five layers and the priority
--    convention: P1 must be funded, P2 safety, P3 near-term, P4 medium, P5 long.
create or replace function public.seed_default_categories(p_user_id uuid)
returns void as $$
begin
  insert into public.categories (user_id, name, group_name, target_amount, priority, due_frequency, sort_order) values
    -- Protected — the government's money and your safety net
    (p_user_id, 'GST/QST',                'protected',  0, 1, 'quarterly', 0),
    (p_user_id, 'Federal Income Tax',     'protected',  0, 1, 'annual',    1),
    (p_user_id, 'Provincial Income Tax',  'protected',  0, 1, 'annual',    2),
    (p_user_id, 'Emergency Fund',         'protected',  0, 2, 'none',      3),
    -- Operating — this month's living costs
    (p_user_id, 'Rent',                   'operating',  0, 1, 'monthly',   0),
    (p_user_id, 'Groceries',              'operating',  0, 1, 'monthly',   1),
    (p_user_id, 'Phone',                  'operating',  0, 1, 'monthly',   2),
    (p_user_id, 'Insurance',              'operating',  0, 1, 'monthly',   3),
    (p_user_id, 'Transportation',         'operating',  0, 1, 'monthly',   4),
    (p_user_id, 'Gas',                    'operating',  0, 2, 'monthly',   5),
    (p_user_id, 'Medications',            'operating',  0, 1, 'none',      6),
    (p_user_id, 'Subscriptions',          'operating',  0, 3, 'monthly',   7),
    (p_user_id, 'Personal Care',          'operating',  0, 3, 'monthly',   8),
    (p_user_id, 'Professional Fees',      'operating',  0, 2, 'annual',    9),
    (p_user_id, 'Eating Out',             'operating',  0, 4, 'monthly',  10),
    (p_user_id, 'Shopping',               'operating',  0, 5, 'monthly',  11),
    (p_user_id, 'Activities',             'operating',  0, 5, 'monthly',  12),
    (p_user_id, 'Coffee & Small Pleasures','operating', 0, 5, 'monthly',  13),
    -- Sinking funds — known future costs with a date
    (p_user_id, 'Trip Fund',              'sinking',    0, 4, 'none',      0),
    (p_user_id, 'Osteopathy School',      'sinking',    0, 3, 'none',      1),
    -- Wealth building — long-term
    (p_user_id, 'TFSA',                   'wealth',     0, 5, 'annual',    0),
    (p_user_id, 'FHSA',                   'wealth',     0, 5, 'annual',    1),
    (p_user_id, 'REEI',                   'wealth',     0, 5, 'annual',    2),
    (p_user_id, 'Down Payment',           'wealth',     0, 5, 'none',      3);
end;
$$ language plpgsql security definer;

commit;

-- ── Verify (run separately after committing) ───────────────────────────────
-- select group_name, count(*), sum(current_balance)
--   from public.categories group by group_name order by group_name;
