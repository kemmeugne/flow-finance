@AGENTS.md

# Flow Finance — Project Documentation

## What this app is

A personal finance web app for people with **variable/freelance income**. The core idea: when money comes in, the app tells you exactly how to split it across your budget categories based on priorities, due dates, and current balances. Includes an AI allocation engine powered by Claude Haiku 4.5.

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
| AI | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Cheap (~$0.004/call), sufficient for structured JSON allocation |
| Deployment | Vercel (auto-deploy on push to `main`) | |

---

## Important Next.js 16 conventions

- **Middleware is now `proxy`** — auth guard lives in `src/proxy.ts`, exports `proxy` function (not `middleware`)
- **`SidebarMenuButton`** uses `render` prop, not `asChild`
- All app pages under `(app)/` use `export const dynamic = 'force-dynamic'` to prevent static prerendering with Supabase
- Supabase client is instantiated **inside event handlers**, never at component module level (causes build-time errors)

---

## Project structure

```
src/
├── app/
│   ├── (app)/                    # Authenticated route group
│   │   ├── layout.tsx            # App shell: desktop sidebar + mobile header
│   │   ├── dashboard/page.tsx    # Main dashboard
│   │   ├── categories/page.tsx   # Category CRUD (stub — Week 2)
│   │   ├── income/page.tsx       # Income entry + AI allocation (stub — Week 2)
│   │   └── goals/page.tsx        # Goal tracking (stub — Week 4)
│   ├── auth/callback/route.ts    # Supabase OAuth callback
│   ├── login/page.tsx            # Split-screen login
│   ├── signup/page.tsx           # Split-screen signup
│   ├── globals.css               # Tailwind theme + sage color scale
│   ├── layout.tsx                # Root layout (Geist font)
│   └── page.tsx                  # Redirects → /dashboard
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx       # Dark sage sidebar (SidebarContent component)
│   │   └── mobile-header.tsx     # Mobile hamburger + Sheet drawer
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── finance.ts                # formatCurrency, urgencyScore, computeAllocations
│   ├── group-config.ts           # Per-group colors, labels, badge styles
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   ├── server.ts             # Server Supabase client (uses cookies)
│   │   └── types.ts              # TypeScript types for all DB tables
│   └── utils.ts                  # shadcn cn() utility
├── hooks/
│   └── use-mobile.ts             # Mobile breakpoint hook
└── proxy.ts                      # Auth guard (Next.js 16 middleware replacement)

supabase/
└── schema.sql                    # Full DB schema — run this in Supabase SQL Editor
```

---

## Design system

**Color palette:** Sage green throughout. Custom `sage` scale registered in Tailwind `@theme`:

| Token | Usage |
|---|---|
| `sage-900` | Sidebar background, auth panel |
| `sage-800` | Sidebar hover state, borders |
| `sage-600` | Primary buttons, active nav item |
| `sage-500` | Sidebar inactive text, icons |
| `sage-400` | Muted text |
| `sage-200` | Card borders |
| `sage-100` | Muted backgrounds |
| `sage-50` | Page background |

**Category group colors** (defined in `src/lib/group-config.ts`):

| Group | Color |
|---|---|
| Taxes | Rose |
| Bills | Blue |
| Living | Emerald |
| Goals | Violet |
| Investments | Indigo |
| Lifestyle | Amber |

**Layout:** Dark sage sidebar (260px, desktop) + content area. Mobile: sidebar collapses to Sheet drawer triggered by hamburger in a dark sage top bar.

---

## Database schema

### Tables

**`categories`** — budget buckets
- `group_name`: `taxes | bills | living | goals | investments | lifestyle`
- `target_amount`: how much should be in this bucket
- `current_balance`: running total (updated when income is allocated or expense logged)
- `priority`: 1 (critical) → 5 (nice to have)
- `due_date`: next due date (nullable)
- `due_frequency`: `monthly | quarterly | annual | one_time | none`

**`income_events`** — each time money comes in
- `amount`, `source`, `received_at`

**`allocations`** — one row per category per income event
- `suggested_amount`: what the AI proposed
- `confirmed_amount`: what the user approved

**`transactions`** — individual debits from categories
- `amount`: positive = funded, negative = spent
- Links to `allocation_id` when created from an income event

**`user_settings`**
- `tax_carveout_percent`: default 27% (set aside from gross income before other allocations)
- `currency`: default CAD

### Key DB behaviors
- RLS enabled on all tables — users can only see their own data
- `seed_default_categories(user_id)` PostgreSQL function seeds 24 categories on signup
- `handle_new_user()` trigger auto-creates `user_settings` row on auth signup
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
Three-step waterfall:
1. **Tax carve-out** — reserve `taxCarveoutPercent`% of gross income for tax categories first
2. **Urgency-weighted distribution** — remaining income split proportionally by urgency score
3. **Surplus routing** — any leftover goes to Emergency Fund (or first goal if no emergency fund)

This function is used as the **fallback** when the AI API is unavailable. The AI (Claude Haiku) is given the same data and asked to return a JSON array with the same shape, with more nuanced reasoning.

---

## Authentication flow

1. User signs up → Supabase sends confirmation email
2. User clicks link → `/auth/callback` exchanges code for session
3. `src/proxy.ts` runs on every request:
   - Unauthenticated + non-auth route → redirect to `/login`
   - Authenticated + auth route → redirect to `/dashboard`
4. Server components use `createClient()` from `src/lib/supabase/server.ts`
5. Client components use `createClient()` from `src/lib/supabase/client.ts`

---

## Environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://utoqkqgzbqfdcjppvfnl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...       # Claude Haiku 4.5 — add for Week 3
```

Set in Vercel: Project → Settings → Environment Variables.

---

## Build plan

### ✅ Week 1 — Foundation (complete)
- [x] Next.js 16 + Tailwind v4 + shadcn/ui scaffold
- [x] Supabase project, schema, RLS, seed function
- [x] Email auth (login/signup) with split-screen design
- [x] App shell: dark sage sidebar + mobile drawer
- [x] Dashboard: metric cards, category group cards, underfunded alerts
- [x] Sage green design system with custom color scale
- [x] Deployed to Vercel, connected to GitHub (auto-deploy on push)

### 🔲 Week 2 — Core data flow
- [ ] Category CRUD screen (add/edit/delete/reorder)
- [ ] Income entry form
- [ ] Allocation review screen (editable per-category amounts)
- [ ] Confirm allocation → update `allocations` table → update `categories.current_balance`
- [ ] Log expense → deduct from category balance

### 🔲 Week 3 — AI layer
- [ ] `/api/allocate` route calling Claude Haiku 4.5
- [ ] Allocation prompt with full category context as JSON
- [ ] Parse Claude's JSON response → populate allocation review screen
- [ ] Show Claude's reasoning per category as tooltip/explanation
- [ ] Fallback to `computeAllocations()` if API fails

### 🔲 Week 4 — Tracking & polish
- [ ] Transaction log: log a spend → deduct from category balance
- [ ] Goals screen with progress bars
- [ ] Dashboard underfunded alerts (red if < 50% funded and due within 14 days)
- [ ] Tax carve-out setting in user settings

### 🔲 Week 5 — V2 features
- [ ] "Can I afford this?" — enter purchase amount, Claude checks balances and advises
- [ ] Due date calendar view
- [ ] Export to CSV

---

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (also runs type check)
npm run lint     # ESLint
npx tsc --noEmit # Type check only
```

Push to `main` → auto-deploys to Vercel.
