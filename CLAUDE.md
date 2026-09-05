@AGENTS.md

# Flow Finance — Project Documentation

## What this app is

A personal finance web app for people with **variable/freelance income**. The core idea: when money comes in, the app tells you exactly how to split it across your budget categories based on priorities, due dates, and current balances. Includes an AI allocation engine and an AI affordability advisor, both powered by Claude Haiku 4.5.

**Target user:** Freelancers, self-employed, people with inconsistent income who want to reduce financial stress.

**Live app:** https://flow-finance-ebon.vercel.app
**GitHub:** https://github.com/kemmeugne/flow-finance
**Supabase project:** https://utoqkqgzbqfdcjppvfnl.supabase.co

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16.2 (App Router) | Latest, Turbopack, server components |
| Language | TypeScript | Full type safety |
| Styling | Tailwind CSS v4 + shadcn/ui | Fast, consistent UI |
| Database + Auth | Supabase | Postgres + RLS + email auth |
| AI | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | ~$0.001–0.004/call, structured JSON via forced tool_use |
| Deployment | Vercel (auto-deploy on push to `main`) | |

---

## Important Next.js 16 conventions

- **Middleware is now `proxy`** — auth guard lives in `src/proxy.ts`, exports `proxy` function (not `middleware`)
- **`SidebarMenuButton`** uses `render` prop, not `asChild`
- All app pages under `(app)/` use `export const dynamic = 'force-dynamic'` to prevent static prerendering with Supabase
- Supabase client is instantiated **inside event handlers**, never at component module level (causes build-time errors)
- **Supabase mutation types resolve as `never`** — always cast: `const db = supabase as any` before `.insert()` / `.update()`
- **Sheet component** (`src/components/ui/sheet.tsx`) has no hardcoded max-width — consumers set their own via `className`. Use `sm:max-w-lg` for drawer panels.

---

## Project structure

```
src/
├── app/
│   ├── (app)/                        # Authenticated route group
│   │   ├── layout.tsx                # App shell: desktop sidebar + mobile header
│   │   ├── dashboard/page.tsx        # Dashboard: metrics, category cards, due dates, action buttons, net worth widget
│   │   ├── accounts/page.tsx         # Full account CRUD, net worth summary, reconcile dialog, transfer dialog, assign-funds trigger
│   │   ├── categories/page.tsx       # Full category CRUD with dialog + archive
│   │   ├── income/page.tsx           # 3-step income entry: form → AI/manual allocation review → confirm
│   │   ├── goals/page.tsx            # Goals progress: bars, monthly needed, completion state
│   │   ├── transactions/page.tsx     # Transaction history: month picker, account filter, income/expense/net, CSV export
│   │   ├── analytics/page.tsx        # Spending analytics: period selector, bar chart, group breakdown, top categories
│   │   └── settings/page.tsx         # Federal + provincial tax % sliders + currency picker
│   ├── api/
│   │   ├── allocate/route.ts         # POST: pre-allocates taxes by category name, passes remainder to Claude Haiku
│   │   └── afford/route.ts           # POST: Claude Haiku checks if a purchase is affordable
│   ├── auth/callback/route.ts        # Confirms email, signs out, redirects to ?next= param
│   ├── login/page.tsx                # Split-screen login
│   ├── signup/page.tsx               # Split-screen signup + seed_default_categories RPC
│   ├── globals.css                   # Tailwind theme + sage color scale (@theme inline)
│   ├── layout.tsx                    # Root layout (Geist font)
│   ├── welcome/page.tsx              # Post-confirmation page (unauthenticated, prompts sign in)
│   └── page.tsx                      # Redirects → /dashboard
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx           # Dark sage sidebar (Dashboard, Accounts, Categories, Add Income, Goals, Transactions, Analytics)
│   │   ├── mobile-header.tsx         # Mobile hamburger + Sheet drawer
│   │   ├── log-expense-button.tsx    # Sheet: log expense → deducts from category balance; detects payment categories
│   │   ├── assign-funds-sheet.tsx    # Sheet: assign existing cash account money to categories (manual or AI)
│   │   ├── afford-button.tsx         # Sheet: ask Claude if a purchase is affordable
│   │   └── reset-data-button.tsx     # Dialog: two-step confirmed wipe of all user data + optional reseed
│   └── ui/                           # shadcn/ui components (button, dialog, sheet, etc.)
├── lib/
│   ├── finance.ts                    # formatCurrency, urgencyScore, isTaxCategory, computeAllocations (no tax step — handled upstream)
│   ├── planning.ts                   # computeAvailableToSpend, computeRunway, monthlyCost — the two-ledger maths
│   ├── group-config.ts               # Per-LAYER colors, labels, blurbs, spokenFor flag (GROUP_CONFIG, GROUP_ORDER, SPOKEN_FOR_LAYERS)
│   ├── account-config.ts             # Account types/groups, helpers: isDebtAccount, isCashAccount, getAccountGroup, balanceLabel
│   ├── supabase/
│   │   ├── client.ts                 # createBrowserClient for client components
│   │   ├── server.ts                 # createServerClient with cookie store for server components
│   │   └── types.ts                  # TypeScript interfaces: Category, IncomeEvent, Allocation, Transaction, UserSettings, Account, AccountTransfer
│   └── utils.ts                      # shadcn cn() utility
├── hooks/
│   └── use-mobile.ts                 # Mobile breakpoint hook
└── proxy.ts                          # Auth guard (Next.js 16 middleware replacement)

supabase/
├── schema.sql                        # Full DB schema — run this in Supabase SQL Editor
├── migration-accounts.sql            # Adds accounts + account_transfers tables; adds account_id to income_events + transactions
├── migration-tax-settings.sql        # Adds federal_tax_percent + provincial_tax_percent to user_settings
├── migration-layers.sql              # Replaces the 6 groups with the 5 money layers (one-way, transactional)
├── migration-priority-convention.sql # Retro-applies the P1–P5 convention; snapshots priorities for rollback
└── email-confirm-signup.html         # Branded confirmation email template (paste into Supabase)
```

---

## Features (all implemented)

### Dashboard (`/dashboard`)
- 4 metric cards: total funded, overall %, category count, underfunded count
- Underfunded alert banner: categories below 50% sorted by urgency score
- **Upcoming Due Dates**: categories due in the next 45 days with progress bars and days remaining (urgent ≤7 days highlighted in rose)
- **Net worth widget**: 3 cards (Net Worth, Assets, Liabilities) shown when accounts exist; setup prompt with link to /accounts if not
- **Actually available** headline card: cash − spoken-for, with a per-layer breakdown, an
  `unassigned cash` secondary line, and a drift warning when the two ledgers disagree
- **Runway** card: this month funded %, next month funded %, emergency runway in months
- Header action buttons: **Add Income**, **Log Expense**, **Can I afford this?**
- Category group cards with colored left border, progress bars, priority badge, due-soon badge (≤14 days)
- **Start over (danger zone)** at the bottom: `ResetDataButton` — erases all financial data so the user can rebuild their plan

### Reset all data (dialog, from Dashboard danger zone)
Two-step confirmation before anything is deleted:
1. **Warning step** — live counts of what will be destroyed (categories, accounts, income events, transactions, account transfers). States that the account, password and tax settings are kept.
2. **Final step** — user must type `RESET` to enable the delete button; checkbox (on by default) to restore the 24 default starter categories afterwards.

Deletes in FK-safe order: `account_transfers` → `transactions` → `income_events` (cascades `allocations`) → `accounts` → `categories`. Then optionally calls `seed_default_categories` RPC. All deletes are scoped by `user_id` and further constrained by RLS. Aborts with an inline error if any step fails.

### Accounts (`/accounts`)
- Full CRUD for 15 account types across 4 groups: Cash (checking/savings/cash), Credit (credit card/LOC), Loans (mortgage/auto/student/personal/medical/other), Investments (TFSA/FHSA/RRSP/RDSP/other)
- Net worth summary: Assets, Liabilities, Net Worth
- Credit usage bar (color-coded: green/amber/rose by utilisation %)
- Contribution room bar + ytd tracking for registered accounts (TFSA/FHSA/RRSP/RDSP)
- Interest rate badge on debt accounts
- **Auto-creates payment category** (`{name} Payment`, bills group, priority 2) when a debt account is added
- Row actions: **Assign funds** (banknote icon, cash/investment accounts), **Adjust balance** (reconcile), **Edit**, **Archive**
- Archive confirmation dialog; type cannot be changed after creation
- **Transfer button** in header — opens dialog to move funds between any two accounts; shows live balance preview; records in `account_transfers`

### Account Transfer (dialog, from Accounts header)
- Pick From and To accounts (any two accounts, mutually exclusive dropdowns)
- Enter amount, date, optional notes
- Live preview: shows both account balances after the transfer before confirming
- On confirm: updates both account balances + inserts `account_transfers` record
- Debt account logic: transferring to a debt account reduces the owed balance (paying it down)

### Assign Funds (sheet drawer, from Accounts)
- Triggered from the banknote icon on any cash or investment account row
- Amount pre-filled with account balance (editable)
- Two paths: **Manual** (all categories shown at $0, user fills freely) or **AI suggestions** (calls `/api/allocate` with `taxable: false`)
- Same allocation review UI as income: grouped categories, editable amounts, progress bar, over/under indicator
- On confirm: only category balances are updated — account balance unchanged (money already there), no income_event created (keeps analytics clean)

### Categories (`/categories`)
- Full CRUD: add, edit, archive (soft-delete: `is_active = false` preserves history)
- Fields: name, group, target amount, current balance, priority (P1–P5), due date, due frequency, notes
- Grouped select in dialogs, AlertDialog confirmation for archive

### Add Income (`/income`)
Three-step flow:
1. **Income form** — gross amount, **taxable toggle** (default on; when off, income tax carve-outs = 0%), GST/QST inputs, destination account, source, date, notes. Two buttons: **Assign manually** and **AI suggestions**
2. **Allocation review** — taxes are pre-allocated before AI sees anything:
   - **GST/QST** amounts → "GST/QST" category (matched by name in taxes group)
   - **Federal income tax** (% × net income) → "Federal Income Tax" category
   - **Provincial income tax** (% × net income) → "Provincial Income Tax" category
   - **Remainder** → Claude Haiku or algorithm for bills/living/goals/etc.
   - Income event and account balance record the **gross amount** (what actually hits the account)
   - Review header shows gross with "(net $X + GST $X + QST $X)" parenthetical when applicable
3. **Confirm** → writes `income_events` (gross) + `allocations` + `transactions` rows, updates all `categories.current_balance`, optionally updates account balance

### Goals (`/goals`)
- Cards for all "Goals" group categories
- Violet progress bar, % funded, deficit remaining
- **Monthly amount needed** = `deficit ÷ months until due date`
- "Goal reached!" state at 100%
- Summary row: total saved, active goals, completed count

### Transactions (`/transactions`)
- Month picker (← →), defaults to current month
- **Account filter dropdown** — filters both income and expense rows by linked account
- Summary cards: income received / spent / net (updated by filter)
- Income events listed with account badge when linked to an account
- Expenses grouped by date (newest first), account badge shown under description
- **Export CSV** button: downloads `flow-finance-YYYY-MM.csv` with Date, Type, Description, Category, Account, Amount columns

### Analytics (`/analytics`)
- **Period selector**: 3M / 6M / 12M toggle
- **4 summary cards**: Income, Spent, Saved, Savings Rate (color-coded: ≥20% emerald, ≥10% amber, else rose)
- **Monthly bar chart**: CSS vertical bars, income (emerald) vs spending (rose) side by side per month; best income/highest spending month summary
- **Spending by group**: horizontal progress bars with group colors, % of spending
- **Top 8 categories**: ranked list with colored bars
- No external charting library — pure CSS

### Settings (`/settings`)
- **Federal Income Tax %**: range slider 0–40% + number input (default 15%)
- **Provincial Income Tax %**: range slider 0–25% + number input (default 12%)
- Live example breakdown: "On $5,000 income → federal $X + provincial $X + available $X"
- Combined total tax % shown (federal + provincial)
- Currency picker (CAD / USD / EUR / GBP)
- Persisted to `user_settings` table (`federal_tax_percent`, `provincial_tax_percent`, `tax_carveout_percent` kept in sync as their sum)

### Log Expense (sheet drawer)
- Triggered from dashboard header
- Select category (grouped by type, shows available balance)
- **Payment category detection**: if the selected category is linked to a debt account, shows a banner, auto-selects first checking account as "Pay from", and on confirm: reduces debt account balance + reduces cash account balance + creates `account_transfers` record
- Live balance preview: current → after deduction (red if overdraft)
- Button label changes to "Record payment" for payment categories

### Can I Afford This? (sheet drawer)
- Triggered from dashboard header
- Enter amount + description, calls `/api/afford`
- Claude Haiku returns verdict: **yes** (green) / **caution** (amber) / **no** (red)
- Shows headline, 2–3 sentence reasoning, suggested category and balance remaining after purchase

---

## AI routes

### `POST /api/allocate`
Accepts `{ income, gst?, qst?, taxable? }` where `income` is the **gross** amount.

**Pre-allocation step (before AI):**
1. Finds "GST/QST" category (taxes group, name contains "gst" or "qst") → allocates `gst + qst`
2. Finds "Federal Income Tax" category (taxes group, name contains "federal") → allocates `federal_tax_percent % × net income`
3. Finds "Provincial Income Tax" category (taxes group, name contains "provincial") → allocates `provincial_tax_percent % × net income`
4. Passes only the **remainder** and **non-pre-allocated categories** to Claude Haiku

Claude Haiku receives `remainingForAI` and only non-tax categories — it never touches taxes. Post-processes AI output: scales proportionally if total overshoots remainder, corrects cent-level drift. Returns `{ suggestions, categories, source, summary }` where suggestions include pre-allocations + AI allocations merged.

If `taxable: false`, income tax carve-outs are skipped (GST/QST still applied if provided).

### Available to Spend (`src/lib/planning.ts`)

The app keeps **two parallel ledgers that nothing reconciles**: `accounts.balance` (what the
bank holds) and `categories.current_balance` (how that money is designated). Both dashboard
figures derive one against the other:

```
cash       = Σ active cash accounts
assets     = cash + Σ active investment accounts
spokenFor  = Σ category balances where layer.spokenFor   (everything but operating)
available  = cash − spokenFor        ← headline
assigned   = Σ every category balance
unassigned = assets − assigned       ← secondary line
drifted    = assigned > assets       ← ledgers disagree, prompt a reconcile
```

`unassigned` compares against **assets, not cash** — wealth categories are usually already
sitting in an investment account, so comparing them to cash alone made the drift warning
fire permanently.

**Runway** (`computeRunway`): `monthlyCost()` amortises each operating category
(monthly → target, quarterly → ÷3, annual → ÷12; one_time/none → 0). Then
`monthsCovered = operatingBalance ÷ monthlyNeed`, yielding "this month funded %" (capped 100)
and "next month funded %" (`monthsCovered − 1`). Emergency runway uses protected categories
that are *not* tax reserves, matched by `isTaxCategoryName`.

### `POST /api/afford`
Fetches categories, calls Claude Haiku with `tool_choice: { type: 'tool', name: 'afford_check' }`. Returns `{ verdict, headline, reasoning, suggested_category, balance_after }`. Falls back to a simple lifestyle/living balance check if no API key.

Both routes use **forced `tool_use`** to guarantee structured JSON output — no text parsing needed.

---

## Design system

**Color palette:** Sage green throughout. Custom `sage` scale in `globals.css` via `@theme inline`:

| Token | Usage |
|---|---|
| `sage-900` | Sidebar background, auth panel |
| `sage-800` | Sidebar hover state, borders |
| `sage-600` | Primary buttons, active nav item |
| `sage-500` | Sidebar inactive text, icons |
| `sage-400` | Muted text |
| `sage-200` | Input borders, form focus ring |
| `sage-100` | Muted backgrounds |
| `sage-50` | Page background |

**Money layers** (`src/lib/group-config.ts`) — stored in `categories.group_name`.
The column keeps its old name so existing rows/queries stay valid; the *values* are layers.
`GROUP_ORDER` is both the display order and the funding waterfall.

| # | Layer | Accent | Spoken for? | Holds |
|---|---|---|---|---|
| 1 | `protected` | Rose | yes | Income tax, GST/QST, emergency fund |
| 2 | `operating` | Emerald | **no** | Rent, groceries, bills, lifestyle — this month's living |
| 3 | `debt` | Slate | yes | Credit card / loan payment categories |
| 4 | `sinking` | Amber | yes | Dated commitments: gifts, trips, courses, purchases |
| 5 | `wealth` | Indigo | yes | TFSA, FHSA, RRSP, down payment, retirement |

`spokenFor: false` on `operating` alone — it is the only money you are meant to spend,
which is what makes "Actually available" computable.

**Layout:** Dark sage sidebar (fixed, desktop) + scrollable content area. Mobile: sidebar collapses to Sheet drawer triggered by hamburger in a fixed dark sage top bar.

**Sheet drawers:** `sm:max-w-lg` (512px), `px-6` horizontal padding, `py-5` header, `py-6` body. The Sheet component in `ui/sheet.tsx` has no hardcoded max-width — consumers control it entirely.

---

## Database schema

### Tables

**`categories`** — budget buckets
- `group_name`: `taxes | bills | living | goals | investments | lifestyle`
- `target_amount`: how much should be in this bucket
- `current_balance`: running total (updated on allocation confirm and expense log)
- `priority`: 1 (critical) → 5 (nice to have)
- `due_date`: next due date (nullable)
- `due_frequency`: `monthly | quarterly | annual | one_time | none`
- `is_active`: false = soft-deleted (hidden from UI, history preserved)

**`income_events`** — each time money comes in
- `amount`: **gross** amount (including GST/QST collected — what actually hits the bank account)
- `source`, `received_at`, `account_id` (nullable FK to accounts)

**`allocations`** — one row per category per income event
- `suggested_amount`: what the AI proposed
- `confirmed_amount`: what the user approved

**`transactions`** — individual debits/credits from categories
- `amount`: positive = funded (from allocation), negative = spent (from expense log)
- Links to `allocation_id` when created from an income event

**`accounts`** — financial accounts
- `type`: one of 15 AccountType values (checking/savings/cash/credit_card/line_of_credit/mortgage/auto_loan/student_loan/personal_loan/medical_debt/other_debt/tfsa/fhsa/rrsp/rdsp/investment_other)
- `balance`: positive = you have (cash/investments) OR you owe (debts)
- `credit_limit`, `interest_rate`: nullable, for credit/loan accounts
- `contribution_room`, `yearly_contribution_limit`, `contributions_ytd`: nullable, for registered investment accounts
- `payment_category_id`: FK to categories — auto-created when a debt account is added; used by log-expense to detect payment flow
- `is_active`: false = archived

**`account_transfers`** — transfer history between accounts
- Created by: (1) debt payment via log-expense, (2) manual transfer via Transfer dialog
- `from_account_id` → `to_account_id`, `amount`, `date`, `description`
- `transaction_id`: nullable FK (only set for debt payment flow, null for manual transfers)

**`user_settings`**
- `federal_tax_percent`: default 15% — carve-out routed to "Federal Income Tax" category
- `provincial_tax_percent`: default 12% — carve-out routed to "Provincial Income Tax" category
- `tax_carveout_percent`: kept in sync as `federal + provincial` (legacy field, still written on save)
- `currency`: default CAD

### Migrations (run in order)
1. `supabase/schema.sql` — base schema
2. `supabase/migration-accounts.sql` — adds accounts + account_transfers + account_id columns
3. `supabase/migration-tax-settings.sql` — adds federal_tax_percent + provincial_tax_percent to user_settings
4. `supabase/migration-layers.sql` — **one-way**: remaps `group_name` to the five layers, swaps the CHECK constraint, rewrites `seed_default_categories`
5. `supabase/migration-priority-convention.sql` — retro-applies the priority convention. Snapshots into `categories_priority_backup` first; a rollback query is at the bottom of the file.

Note: `schema.sql` still declares the OLD six groups. It is the historical baseline; migration 4 replaces them. Do not "fix" it.

### Key DB behaviors
- RLS enabled on all tables — users only see their own rows
- `seed_default_categories(user_id)` seeds 24 categories on signup, including "GST/QST", "Federal Income Tax", "Provincial Income Tax" in the taxes group
- `handle_new_user()` trigger auto-creates `user_settings` on auth signup
- `updated_at` auto-maintained via trigger on `categories` and `user_settings`

---

## Known correctness fix

Debt payments used to be **double-counted as spending**. `log-expense-button.tsx` writes a
negative `transactions` row for a payment *and* an `account_transfers` row, while analytics
counted every negative transaction — so a Visa purchase logged to Groceries was counted again
when the Visa was paid. Analytics now excludes any transaction whose id appears in
`account_transfers.transaction_id`. Keep that filter if you touch the analytics query.

## Priority convention

`priority` is not decorative — `urgencyScore` multiplies by `6 - priority`, so P1 pulls 5× a P5.

| P | Meaning | Typically |
|---|---|---|
| 1 | Must be funded | Tax reserves, rent, monthly essentials, debt minimums |
| 2 | Safety | Emergency fund |
| 3 | Near-term commitments | Sinking funds due inside 12 months |
| 4 | Medium-term | Sinking funds beyond 12 months, discretionary spending |
| 5 | Long-term wealth | TFSA, FHSA, RRSP, down payment, retirement |

**Known wart:** discretionary operating categories (Shopping, Coffee) sit at P5 next to
long-term wealth, because the convention has no level below P5. Since `urgencyScore` also
weighs days-until-due, a monthly discretionary category can out-pull a no-deadline TFSA at
the same priority. Fix by demoting wealth or adding a sixth level if it becomes a problem.

The retroactive migration infers operating essentials from the *existing* priority (≤2 →
P1), because `migration-layers.sql` collapsed bills/living/lifestyle and destroyed that
distinction in the data.

## Allocation logic (`src/lib/finance.ts`)

### `urgencyScore(category)`
```
priorityWeight = 6 - priority          // P1 → 5, P5 → 1
fundedRatio    = currentBalance / target
daysUntilDue   = days until due_date (365 if no due date)

score = priorityWeight × (1 - fundedRatio) × (1 / max(1, daysUntilDue/30)) × deficit
```

### Waterfall
`GROUP_ORDER` is the funding waterfall and is surfaced in the UI: the income review screen
numbers each layer "Step 1…5" with its blurb, and `/api/allocate`'s prompt states the same
order. The maths *within* a step stays urgency-weighted rather than strictly sequential — a
strict waterfall would starve a near-due annual tax bill behind the current month's expenses.

### `computeAllocations(remaining, categories)`
Two-step waterfall (fallback when AI is unavailable). **Note: tax pre-allocation is done upstream in `/api/allocate` before this is called — this function only handles non-tax categories.**
1. **Urgency-weighted distribution** — `remaining` split proportionally by urgency score across non-tax categories. Tax reserves are excluded via `isTaxCategory()` (protected layer **and** a tax-shaped name) — filtering the whole `protected` layer would wrongly starve the emergency fund.
2. **Surplus routing** — leftover goes to Emergency Fund (or first goal)

### Tax pre-allocation (in `/api/allocate`)
Before calling `computeAllocations` or the AI:
1. Find "GST/QST" category → allocate collected GST + QST
2. Find "Federal Income Tax" category → allocate `federal_tax_percent % × net income`
3. Find "Provincial Income Tax" category → allocate `provincial_tax_percent % × net income`
4. Subtract total pre-allocated from gross income → `remainingForAI`
5. Pass `remainingForAI` + non-pre-allocated categories to AI/algorithm

Category matching is by substring of `name` (case-insensitive) within `group_name = 'protected'`:
- "gst" or "qst" → GST/QST category
- "federal" → Federal Income Tax
- "provincial" → Provincial Income Tax

---

## Authentication flow

1. User signs up → `seed_default_categories` RPC called → Supabase sends branded confirmation email
2. User clicks confirmation link → `/auth/callback`:
   - Exchanges code for session (confirms email in Supabase)
   - **Immediately signs out** (security: user must log in explicitly)
   - Redirects to `/welcome` (reads `?next=` param, default `/dashboard`)
3. `/welcome` page — unauthenticated, shows "Email confirmed!" + "Sign in to your account" → `/login`
4. User logs in → dashboard
5. `src/proxy.ts` runs on every request:
   - Unauthenticated + non-public route → redirect to `/login`
   - Authenticated + `/login` or `/signup` → redirect to `/dashboard`
   - `/welcome` and `/auth/*` are public (accessible unauthenticated, no redirect for authenticated)
6. Server components: `createClient()` from `src/lib/supabase/server.ts`
7. Client components: `createClient()` from `src/lib/supabase/client.ts`

---

## Supabase configuration (dashboard settings)

These must be set in the Supabase dashboard — they are not in code.

**Authentication → URL Configuration**
- Site URL: `https://flow-finance-ebon.vercel.app`
- Redirect URLs: `https://flow-finance-ebon.vercel.app/**` and `http://localhost:3000/**`

Without the redirect URL allowlist entries, Supabase ignores the `emailRedirectTo` option set in the signup call and falls back to the Site URL, breaking the `/welcome` redirect.

**Authentication → Email Templates → Confirm signup**
- Subject: `Confirm your Flow Finance account`
- Body: paste contents of `supabase/email-confirm-signup.html`
- Requires a custom SMTP provider (e.g. Resend) — Supabase's built-in mailer blocks custom HTML templates

**Authentication → SMTP Settings (if using Resend)**
- Host: `smtp.resend.com` · Port: `465` · Username: `resend`
- Password: Resend API key (`re_...`)
- Sender name: `Flow Finance` · Sender email: `onboarding@resend.dev` (or your domain)

---

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://utoqkqgzbqfdcjppvfnl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...       # Required for AI allocation and afford check
```

Set in Vercel: Project → Settings → Environment Variables.

---

## Known ESLint rules to watch

- `react-hooks/set-state-in-effect` — fires when an async data-fetch function called inside `useEffect` internally calls `setState`. Fix: define the async function **inside** the `useEffect` body, or add `// eslint-disable-next-line react-hooks/set-state-in-effect`.
- `react-hooks/purity` — fires on `Date.now()` / `Math.random()` in server component render scope. Suppress with `// eslint-disable-next-line react-hooks/purity` (rule doesn't distinguish server vs client components).
- `react/no-unescaped-entities` — quotes in JSX text must be escaped: `&quot;` for `"`, `&apos;` for `'`.
- `react-hooks/immutability` — function referenced in `useEffect` before it is declared. Fix: wrap with `useCallback` above the effect.

---

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (type check + lint + compile)
npm run lint     # ESLint only
npx tsc --noEmit # Type check only
```

Push to `main` → auto-deploys to Vercel.
