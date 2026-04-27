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
│   │   ├── accounts/page.tsx         # Full account CRUD, net worth summary, reconcile dialog, assign-funds trigger
│   │   ├── categories/page.tsx       # Full category CRUD with dialog + archive
│   │   ├── income/page.tsx           # 3-step income entry: form → AI/manual allocation review → confirm
│   │   ├── goals/page.tsx            # Goals progress: bars, monthly needed, completion state
│   │   ├── transactions/page.tsx     # Transaction history: month picker, account filter, income/expense/net, CSV export
│   │   ├── analytics/page.tsx        # Spending analytics: period selector, bar chart, group breakdown, top categories
│   │   └── settings/page.tsx         # Tax carve-out % slider + currency picker
│   ├── api/
│   │   ├── allocate/route.ts         # POST: Claude Haiku allocates income across categories; accepts taxable flag
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
│   │   └── afford-button.tsx         # Sheet: ask Claude if a purchase is affordable
│   └── ui/                           # shadcn/ui components (button, dialog, sheet, etc.)
├── lib/
│   ├── finance.ts                    # formatCurrency, urgencyScore, computeAllocations (2-decimal precision throughout)
│   ├── group-config.ts               # Per-group colors, labels, badge styles (GROUP_CONFIG, GROUP_ORDER)
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
└── email-confirm-signup.html         # Branded confirmation email template (paste into Supabase)
```

---

## Features (all implemented)

### Dashboard (`/dashboard`)
- 4 metric cards: total funded, overall %, category count, underfunded count
- Underfunded alert banner: categories below 50% sorted by urgency score
- **Upcoming Due Dates**: categories due in the next 45 days with progress bars and days remaining (urgent ≤7 days highlighted in rose)
- **Net worth widget**: 3 cards (Net Worth, Assets, Liabilities) shown when accounts exist; setup prompt with link to /accounts if not
- Header action buttons: **Add Income**, **Log Expense**, **Can I afford this?**
- Category group cards with colored left border, progress bars, priority badge, due-soon badge (≤14 days)

### Accounts (`/accounts`)
- Full CRUD for 15 account types across 4 groups: Cash (checking/savings/cash), Credit (credit card/LOC), Loans (mortgage/auto/student/personal/medical/other), Investments (TFSA/FHSA/RRSP/RDSP/other)
- Net worth summary: Assets, Liabilities, Net Worth
- Credit usage bar (color-coded: green/amber/rose by utilisation %)
- Contribution room bar + ytd tracking for registered accounts (TFSA/FHSA/RRSP/RDSP)
- Interest rate badge on debt accounts
- **Auto-creates payment category** (`{name} Payment`, bills group, priority 2) when a debt account is added
- Row actions: **Assign funds** (banknote icon, cash accounts only), **Adjust balance** (reconcile), **Edit**, **Archive**
- Archive confirmation dialog; type cannot be changed after creation

### Assign Funds (sheet drawer, from Accounts)
- Triggered from the banknote icon on any cash account row
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
1. **Income form** — amount, **taxable toggle** (default on; when off, tax carve-out = 0%), GST/QST inputs (deducted to compute net income), destination account, source, date, notes. Two buttons: **Assign manually** and **AI suggestions**
2. **Allocation review** — shows badge for source (AI / algorithm / manual). Manual mode: all active categories at $0, user fills freely. AI mode: Claude Haiku suggestions with per-category reasoning. Amounts editable; over/under indicator + progress bar. Non-taxable badge shown in header if taxable toggle is off.
3. **Confirm** → writes `income_events` + `allocations` + `transactions` rows, updates all `categories.current_balance`, optionally updates account balance if destination account selected

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
- **Tax carve-out %**: range slider + number input (5–50%), live example ("on $5,000 income, $X goes to taxes")
- Currency picker (CAD / USD / EUR / GBP)
- Persisted to `user_settings` table

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
Accepts `{ income, taxable? }`. If `taxable` is false (or omitted and income is a budget assignment), sets `taxCarveout = 0`. Fetches user's active categories + settings, calls Claude Haiku with `tool_choice: { type: 'tool', name: 'allocate_income' }` to force structured JSON. Post-processes: scales amounts proportionally if total overshoots income, then corrects cent-level drift on the first item. Returns `{ suggestions, categories, source, summary }` where `source` is `'ai'` or `'algorithm'`.

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

**Category group colors** (`src/lib/group-config.ts`):

| Group | Accent | Usage |
|---|---|---|
| Taxes | Rose | P1 — first allocation |
| Bills | Blue | P1–P2 fixed obligations |
| Living | Emerald | Day-to-day expenses |
| Goals | Violet | Savings targets |
| Investments | Indigo | Long-term wealth |
| Lifestyle | Amber | Discretionary spending |

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
- `amount`, `source`, `received_at`

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

**`account_transfers`** — debt payment history
- Created when an expense is logged against a payment category with a "Pay from" cash account
- Links `from_account_id` (cash) → `to_account_id` (debt), with `transaction_id` FK

**`income_events`** — each time money comes in (also has `account_id` column added by migration)

**`transactions`** — also has `account_id` column added by migration

**`user_settings`**
- `tax_carveout_percent`: default 27%
- `currency`: default CAD

### Key DB behaviors
- RLS enabled on all tables — users only see their own rows
- `seed_default_categories(user_id)` seeds 24 categories on signup
- `handle_new_user()` trigger auto-creates `user_settings` on auth signup
- `updated_at` auto-maintained via trigger on `categories` and `user_settings`

---

## Allocation logic (`src/lib/finance.ts`)

### `urgencyScore(category)`
```
priorityWeight = 6 - priority          // P1 → 5, P5 → 1
fundedRatio    = currentBalance / target
daysUntilDue   = days until due_date (365 if no due date)

score = priorityWeight × (1 - fundedRatio) × (1 / max(1, daysUntilDue/30)) × deficit
```

### `computeAllocations(income, categories, taxCarveoutPercent)`
Three-step waterfall (fallback when AI is unavailable):
1. **Tax carve-out** — reserve `taxCarveoutPercent`% for tax group categories
2. **Urgency-weighted distribution** — remaining income split proportionally by urgency score
3. **Surplus routing** — leftover goes to Emergency Fund (or first goal)

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
