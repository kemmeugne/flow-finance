# Flow Finance

A personal finance app for people with **variable income**. When money comes in, it tells you
exactly how to split it across your budget categories — based on priorities, due dates and what
each bucket already holds.

Built for freelancers and the self-employed, where "what can I actually spend this month?" has no
obvious answer.

**Live:** https://flow-finance-ebon.vercel.app

---

## How it works

Your budget is a set of **categories** — Rent, Groceries, Emergency Fund, Federal Income Tax —
each with a target amount, a priority (P1–P5) and an optional due date. Every category sits in
one of **five money layers**, and the layer decides whether that money is yours to spend:

| Layer | Holds | Yours to spend? |
| --- | --- | --- |
| Protected | Income tax, GST/QST, emergency fund | No |
| **Operating** | Rent, groceries, bills, lifestyle | **Yes** |
| Debt | Credit card and loan payments | No |
| Sinking Funds | Gifts, trips, courses, dated purchases | No |
| Wealth Building | TFSA, FHSA, RRSP, down payment | No |

That single distinction produces the headline number on the dashboard — **Actually available**
= cash minus everything already spoken for. Seeing $33,000 in savings feels like $33,000 of
spending power even when $16,000 belongs to the CRA; this is what removes the illusion.

When income arrives:

1. **Taxes are carved out first.** GST/QST you collected, then federal and provincial income tax
   at your configured percentages, routed to their own categories.
2. **The rest gets allocated.** Either Claude suggests a split across the remaining categories, or
   you assign it manually.
3. **You review and confirm.** Every amount is editable before anything is saved.

From there the app tracks what each bucket holds, warns you about underfunded categories and
upcoming due dates, and can tell you whether a specific purchase is affordable.

---

## Features

| Screen | What it does |
| --- | --- |
| **Dashboard** | Funding metrics, net worth, underfunded alerts, due dates in the next 45 days, category cards |
| **Accounts** | 15 account types across cash, credit, loans and investments; net worth, credit utilisation, contribution room, transfers, reconciliation |
| **Categories** | Full CRUD with soft-delete archiving that preserves history |
| **Add Income** | 3-step flow: entry → AI or manual allocation review → confirm |
| **Goals** | Progress bars and the monthly amount needed to hit each goal by its due date |
| **Transactions** | Month picker, account filter, CSV export |
| **Analytics** | 3/6/12-month spending trends, savings rate, breakdown by group and category |
| **Settings** | Federal and provincial tax percentages, display currency |

Plus three actions available from the dashboard header:

- **Log Expense** — deducts from a category; detects debt-payment categories and updates both the
  cash and debt account balances
- **Can I afford this?** — Claude weighs the purchase against your actual balances
- **Assign funds** — distribute money already sitting in an account across categories

The dashboard also carries a **Runway** card — this month funded, next month funded, and how
many months your emergency fund alone would cover — and a **Reset all data** button behind a
two-step confirmation.

Money is allocated down a **waterfall**: Protected → Operating → Debt → Sinking Funds →
Wealth Building, shown as numbered steps on the income review screen. Within a step, priority
and days-until-due decide the order, so a tax bill due in three weeks is never starved by the
step above it.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database + auth | Supabase (Postgres, RLS, email auth) |
| AI | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Hosting | Vercel — auto-deploys on push to `main` |

---

## Running it locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev                        # http://localhost:3000
```

### Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
ANTHROPIC_API_KEY=sk-ant-...       # AI allocation + affordability check
```

Without `ANTHROPIC_API_KEY` the app still runs — both AI routes fall back to a deterministic
algorithm.

### Database setup

Run these in the Supabase SQL Editor, in order:

1. `supabase/schema.sql` — categories, income events, allocations, transactions, user settings, RLS policies, seed function
2. `supabase/migration-accounts.sql` — accounts and account transfers
3. `supabase/migration-tax-settings.sql` — federal/provincial tax split
4. `supabase/migration-layers.sql` — replaces the six groups with the five money layers

> Migration 4 is **one-way** and must be applied *before* deploying code that expects layers.
> `schema.sql` still declares the old six groups on purpose — it is the historical baseline.

Then in the Supabase dashboard, under **Authentication → URL Configuration**, add
`http://localhost:3000/**` to the redirect allowlist. Without it, Supabase ignores the app's
`emailRedirectTo` and the post-confirmation flow breaks.

Email template setup (branded confirmation email, custom SMTP) is covered in
[CLAUDE.md](CLAUDE.md#supabase-configuration-dashboard-settings).

---

## Commands

```bash
npm run dev        # dev server
npm run build      # production build
npm run lint       # ESLint
npx tsc --noEmit   # type check only
```

---

## Documentation

- **[USER_MANUAL.md](USER_MANUAL.md)** — how to actually use the app, screen by screen, with a
  recommended workflow and FAQ
- **[CLAUDE.md](CLAUDE.md)** — architecture, database schema, allocation logic, Next.js 16
  conventions and known gotchas. Read this before changing code.
