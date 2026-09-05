-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: apply the priority convention to existing categories.
--
--   P1  must be funded      taxes, rent, monthly essentials, debt minimums
--   P2  safety              emergency fund
--   P3  near-term           dated commitments inside 12 months
--   P4  medium-term         dated commitments beyond 12 months, discretionary
--   P5  long-term wealth    TFSA, FHSA, RRSP, down payment, retirement
--
-- Run AFTER migration-layers.sql. Wrapped in a transaction, and it snapshots
-- the current priorities first so the change can be undone (see the rollback
-- query at the bottom).
--
-- Note on operating categories: migration-layers.sql collapsed bills, living
-- and lifestyle into one layer, so that distinction no longer exists in the
-- data. The existing priority is used as the proxy — the old seed put
-- essentials at P1–P2 and discretionary spending at P4–P5, so rows at P3 or
-- below are treated as essentials and anything already at P4+ is left alone.
-- Check the verify query afterwards and hand-correct anything you disagree with.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- 0. Snapshot current priorities so this is reversible.
create table if not exists public.categories_priority_backup as
  select id, user_id, name, group_name, priority, now() as backed_up_at
    from public.categories;

-- 1. Tax reserves — the government's money, funded before anything else.
update public.categories
   set priority = 1
 where group_name = 'protected'
   and (lower(name) like '%gst%'
     or lower(name) like '%qst%'
     or lower(name) like '%federal%'
     or lower(name) like '%provincial%'
     or lower(name) like '%income tax%');

-- 2. The rest of protected money is the safety net.
update public.categories
   set priority = 2
 where group_name = 'protected'
   and not (lower(name) like '%gst%'
         or lower(name) like '%qst%'
         or lower(name) like '%federal%'
         or lower(name) like '%provincial%'
         or lower(name) like '%income tax%');

-- 3. Debt minimums must be funded.
update public.categories
   set priority = 1
 where group_name = 'debt';

-- 4. Operating essentials. Rows already at P4/P5 were discretionary under the
--    old grouping and keep their priority.
update public.categories
   set priority = 1
 where group_name = 'operating'
   and priority <= 2;

-- 5. Sinking funds: inside 12 months is near-term, everything else medium-term.
update public.categories
   set priority = 3
 where group_name = 'sinking'
   and due_date is not null
   and due_date <= (current_date + interval '12 months');

update public.categories
   set priority = 4
 where group_name = 'sinking'
   and (due_date is null or due_date > (current_date + interval '12 months'));

-- 6. Wealth building is the longest horizon.
update public.categories
   set priority = 5
 where group_name = 'wealth';

commit;

-- ── Verify (run separately after committing) ───────────────────────────────
-- select group_name, priority, count(*), string_agg(name, ', ' order by name)
--   from public.categories
--  where is_active
--  group by group_name, priority
--  order by group_name, priority;

-- ── Rollback (restores the priorities as they were before this migration) ──
-- update public.categories c
--    set priority = b.priority
--   from public.categories_priority_backup b
--  where b.id = c.id;
