# Flow Finance — User Manual

## What is Flow Finance?

Flow Finance is a personal budget app built for **freelancers and people with variable income**. Unlike traditional budgets that assume you get paid the same amount every month, Flow Finance works around how freelancers actually get paid: irregular amounts, at irregular times.

The core idea is simple: **every time money comes in, you decide exactly where it goes before you spend it.** The app — powered by an AI — suggests how to split your income across all your budget categories based on what's most urgent, what's due soon, and what's already funded. You review the suggestion, adjust if needed, and confirm. From that point on, your balances are always up to date.

**Live app:** https://flow-finance-ebon.vercel.app

---

## The five money layers

Every category belongs to one of five layers. The layer is what tells the app whether that
money is yours to spend.

| Layer | What lives here | Yours to spend? |
| --- | --- | --- |
| **Protected** | Income tax, GST/QST, emergency fund | No — it is the government's or your safety net |
| **Operating** | Rent, groceries, bills, lifestyle | **Yes** — this is your living money |
| **Debt** | Credit card and loan payments | No — it is owed |
| **Sinking Funds** | Gifts, trips, courses, big purchases with a date | No — promised to a deadline |
| **Wealth Building** | TFSA, FHSA, RRSP, down payment, retirement | No — promised to your future |

Only **Operating** money is available to spend. That single distinction is what powers the
"Actually available" number on your dashboard.

---

## The core concept: budget categories

Everything in Flow Finance revolves around **categories** — named buckets of money, each with a purpose. Think of them like envelopes: when income arrives, you stuff money into the right envelopes. When you spend, you take it out of the right envelope.

Each category belongs to one of six **groups**, which determine its color and general priority:

| Group | Color | Examples |
|---|---|---|
| **Taxes** | Rose | Federal tax, provincial tax, HST remittances |
| **Bills & Obligations** | Blue | Rent, internet, phone, insurance |
| **Living Expenses** | Emerald | Groceries, transport, gas, subscriptions |
| **Goals** | Violet | Emergency fund, vacation, new laptop, car |
| **Investments** | Indigo | TFSA, RRSP, index funds |
| **Lifestyle** | Amber | Restaurants, entertainment, clothing, hobbies |

---

## Getting started

### 1. Create an account

Go to the app and click **Sign up**. Enter your email and a password. You will see a "check your email" screen.

Open the confirmation email from Flow Finance and click **Confirm my account**. You will land on a confirmation page that tells you your email has been verified.

For security, you are **not** logged in automatically at this point. Click **Sign in to your account**, enter your password, and you will be taken to your dashboard.

**24 default categories are automatically created** for you when you sign up, covering the most common budget buckets for a Canadian freelancer. You can rename, edit, or remove any of them.

### 2. Add your accounts (optional but recommended)

Go to **Accounts** in the sidebar and add your real-world financial accounts — your checking account, savings, credit cards, loans, and investment accounts. This unlocks the net worth view and lets you track exactly which account money flows through.

### 3. Review your categories

Go to **Categories** in the sidebar. Adjust the target amounts, priorities, and due dates to match your actual life.

### 4. Assign your existing funds

If you already have money in your accounts that hasn't been budgeted yet, go to **Accounts**, hover over any cash account row, and click the **banknote icon** to assign that money to your categories.

### 5. Enter income as it arrives

Go to **Add Income** in the sidebar each time you receive a payment. The AI will suggest how to split it. Review, adjust, confirm.

---

## Screens

### Dashboard

The dashboard is your home screen. It gives you a full picture of your financial health at a glance.

**Net Worth widget**
If you have accounts set up, three cards show your total Net Worth, Assets (cash + investments), and Liabilities (credit + loans). This updates automatically as you log income, expenses, and debt payments.

**Actually available** (top of the page)
The most important number in the app. It answers "what can I safely use right now?"

```
Cash in bank        $40,452
Spoken for          $36,000   ← protected + debt + sinking + wealth
──────────────────────────
Actually available   $4,452
```

Seeing $33,000 in a savings account feels like $33,000 of spending power, even when $16,000
belongs to the CRA and $10,000 is your emergency fund. This card removes that illusion. A
breakdown beside it shows which layers are holding the reserved money.

Underneath, **Unassigned cash** shows money you have not yet given a job to. In a well-run
month it sits near zero.

If your categories ever claim more than your accounts actually hold, an amber warning appears
— that means the two have drifted apart and it is time to reconcile an account.

**Runway**
How many months you are covered for:
- **This month funded** — your Operating balance against one month of operating costs
- **Next month funded** — whatever is left over after this month
- **Emergency runway** — how many months your emergency fund alone would carry you
  (green at 3+ months, amber at 1–3, red below 1)

**Summary row**
Four cards showing total funded, overall funded %, category count, and underfunded count.

**Needs funding alert**
If any categories are below 50% of their target, a banner lists them in order of urgency.

**Upcoming Due Dates**
Categories with a due date in the next 45 days, sorted by how soon they're due. Items due within 7 days are highlighted in red.

**Action buttons (top right)**
- **Add Income** — enter a new income payment
- **Log Expense** — record a purchase against a category
- **Can I afford this?** — ask the AI whether a purchase is a good idea right now

**Start over (bottom of the page)**
A **Reset all data** button that erases your entire financial plan so you can rebuild it from
scratch — useful if your first setup no longer matches how you actually budget.

Because this cannot be undone, it asks twice:
1. A warning screen listing exactly how many categories, accounts, income events, transactions
   and transfers will be deleted.
2. A final screen where you must type `RESET` before the delete button becomes clickable.

A checkbox (on by default) puts the standard starter categories back afterwards, so you land on
a fresh budget rather than an empty app. Your login, password and tax settings are kept — only
your financial data is erased.

> There is no undo and no backup. If you might want your history later, export it first from
> **Transactions → Export CSV**.

---

### Accounts

This screen is your financial account manager. Add every account you have — checking, savings, credit cards, loans, investments — to get a complete net worth picture.

**Account types supported**

| Group | Types |
|---|---|
| Cash | Checking, Savings, Cash |
| Credit | Credit Card, Line of Credit |
| Loans & Mortgages | Mortgage, Auto Loan, Student Loan, Personal Loan, Medical Debt, Other Debt |
| Investments | TFSA, FHSA, RRSP, RDSP, Other Investment |

**Adding an account**
Click **Add Account** and fill in:
- *Name* — e.g. "RBC Checking", "TD Visa"
- *Type* — cannot be changed after creation
- *Balance* — current balance (what you have for cash/investments, what you owe for debts)
- *Credit limit* and *Interest rate* — for credit cards and lines of credit
- *Minimum monthly payment* — for debt accounts; creates a linked payment category automatically
- *Contribution room*, *Annual limit*, *Contributed this year* — for registered accounts (TFSA, FHSA, etc.)

**Debt accounts and payment categories**
When you add a credit card, loan, or any other debt account, Flow Finance automatically creates a payment category (e.g. "TD Visa Payment") in your Bills group. When you log an expense against that payment category, the app reduces both your category balance and the debt account's outstanding balance.

**Row actions (hover to reveal)**
- **Banknote icon** — Assign existing funds to categories (cash accounts only)
- **Sliders icon** — Adjust balance (reconcile with your real bank balance)
- **Pencil icon** — Edit account details
- **Trash icon** — Archive (hides the account; history is preserved)

**Adjust Balance (reconciliation)**
If your in-app balance drifts from your real bank statement, click the sliders icon. Enter the actual balance — the dialog shows the current amount and the difference — then click **Update balance**.

---

### Assign Funds (from Accounts)

When you have money sitting in a cash account that hasn't been assigned to any categories yet, use this flow to budget it.

**How to open it:** hover over any checking, savings, or cash account row on the Accounts screen and click the banknote icon.

**The flow:**
1. Enter the amount to assign (pre-filled with your account balance, editable)
2. Choose how to allocate:
   - **Manual** — all your active categories appear at $0; fill in the amounts yourself
   - **AI suggestions** — the app calls Claude to suggest how to split the money across your categories (same as the income allocation flow, but with no tax carve-out)
3. Review the allocation — adjust any amounts, watch the progress bar
4. Click **Confirm & apply** — your category balances are updated immediately

> **Note:** The account balance does not change — the money was already in the account. This flow only updates category balances to reflect how that money is designated.

---

### Add Income

Use this screen every time you receive a payment.

**Step 1 — Enter the income**

- *Amount* — gross amount received
- **Taxable income toggle** — on by default. Turn it **off** for non-taxable income (reimbursements, gifts, GST refunds) — this skips the tax carve-out entirely so no money is routed to your tax categories
- *GST / QST* — optional. Enter the tax amounts collected from your client. The app subtracts them from the gross to compute your **net income** (the amount you actually earned). All allocations are calculated on the net amount.
- *Destination account* — optional. If selected, the income amount is added to that account's balance
- *Source* — who paid you?
- *Date received*
- *Notes*

At the bottom, two buttons:

- **Assign manually** — skips the AI; opens the review step with all your active categories at $0. You fill in the amounts yourself.
- **AI suggestions** — calls Claude Haiku (or the built-in algorithm as fallback) to suggest how to split the income

**Step 2 — Review the allocation**

The review screen shows a badge identifying the allocation source:
- ✨ *Claude AI suggestion* — with a one-sentence strategy summary
- *Built-in algorithm* — when the API is unavailable
- *Manual allocation* — when you chose to assign manually

Every category receiving money is shown with the suggested amount and a reasoning note. You can change any amount. The footer shows:
- How much is allocated vs the total
- *Fully allocated* (green), *X unallocated* (amber), or *Over by X* (red, blocks confirm)
- A progress bar

**Step 3 — Confirm**

Click **Confirm & apply**. The app records the income event, saves the allocations, and updates all category balances. If a destination account was selected, its balance is also updated.

---

### Goals

Dedicated view for your **Goals** group categories.

Each goal card shows:
- Progress bar (violet) and % funded
- Current balance vs target
- **Monthly amount needed** = `(target − current balance) ÷ months until due date`
- "Goal reached!" state at 100%

The summary row shows: total saved, active goals, completed goals.

---

### Transactions

A complete history of all financial activity, by month.

**Month picker** — use ← → to navigate. Current month is the default.

**Account filter** — if you have accounts set up, a dropdown appears next to the month picker. Select an account to see only income and expenses linked to that account. Select "All accounts" to see everything.

**Summary cards** — Income, Spent, Net for the selected month (and account filter, if active).

**Activity list**
- Income events appear at the top with a green icon, source name, date, and account badge (if linked)
- Expenses appear below, grouped by date newest-first, showing description, category, and account badge

**Export CSV**
Downloads `flow-finance-YYYY-MM.csv` with columns:

```
Date | Type | Description | Category | Account | Amount (CAD)
```

---

### Analytics

Spending trends and income history across a rolling period.

**Period selector** — 3M, 6M, or 12M toggle in the top-right corner.

**Summary cards**
- *Income* — total received in the period
- *Spent* — total spent
- *Saved* — net (income minus spending)
- *Savings Rate* — % of income saved. ≥20% = green, ≥10% = amber, below 10% = red

**Monthly Overview chart**
Side-by-side bars for each month: emerald = income, rose = spending. Below the chart, the best income month and highest spending month are highlighted.

**Spending by Group**
Horizontal progress bars showing each category group's share of total spending, in descending order.

**Top Categories**
The 8 highest-spend categories in the period, ranked with colored bars.

---

### Settings

**Income Tax Carve-out**
The share of every income payment reserved for taxes before anything else is allocated. It is
split into two separate percentages, each routed to its own category:

- **Federal Income Tax** — slider or number, 0% to 40%. Default 15%. (Canada: 15–33%)
- **Provincial Income Tax** — slider or number, 0% to 25%. Default 12%. (Canada: 5–25%)

A live example breaks down a $5,000 income into federal, provincial, total reserved, and what
is left available to allocate.

> You can also bypass this per income entry using the **Taxable income toggle** on the Add Income form.

**Currency**
Display currency for all amounts (CAD / USD / EUR / GBP). Cosmetic only — stored amounts are in the currency you entered them in.

---

### Log Expense (expense drawer)

Opened from **Log Expense** on the dashboard.

**Fields:** Category, Amount, Description, Date, and (for payment categories) Pay from account.

**Payment category detection**
If you select a category linked to a debt account (e.g. "TD Visa Payment"), the app shows a banner confirming which debt account will be reduced, auto-selects your first checking account as the payment source, and on save:
1. Deducts from the category balance
2. Reduces the debt account's outstanding balance
3. Reduces the cash account's balance
4. Records an account transfer for history

**Live balance preview** — shows current → balance after this expense (red if it would go negative).

---

### Can I Afford This? (AI advisor)

Opened from **Can I afford this?** on the dashboard.

Enter an amount and what it's for, then click **Ask Claude**. The AI reads your current category balances in real time and returns:

- A **verdict**: green (yes), amber (caution), or red (not recommended)
- A **headline** and 2–3 sentence reasoning with specific numbers
- The **suggested category** and remaining balance after the purchase

---

## Recommended workflow

### When income arrives
1. Go to **Add Income**
2. Enter amount — toggle off "Taxable" if it's a reimbursement or gift; enter GST/QST if collected
3. Choose **AI suggestions** or **Assign manually**
4. Review, adjust, confirm

### When you have existing money to budget
1. Go to **Accounts**
2. Hover a cash account row → click the **banknote icon**
3. Enter the amount, choose AI or manual, confirm

### When you spend money
1. Click **Log Expense** from the dashboard
2. Select category, enter amount and description, confirm

### Before a big purchase
1. Click **Can I afford this?** from the dashboard
2. Enter amount and description — get an instant AI verdict

### Once a month
1. Go to **Transactions** — review activity, export CSV if needed for bookkeeping
2. Go to **Analytics** — check your savings rate and where money is going
3. Go to **Goals** — confirm you're on track
4. Go to **Accounts** — reconcile balances against your actual bank statements (sliders icon)

---

## Frequently asked questions

**Why doesn't my savings account count as "available"?**
Because most of it is already promised. The app subtracts everything in the Protected, Debt,
Sinking Funds and Wealth layers, and leaves you with Operating money — the money you are
actually meant to live on this month.

**What order does money get funded in?**
A waterfall, shown as numbered steps on the income review screen: Protected (1) → Operating
(2) → Debt (3) → Sinking Funds (4) → Wealth Building (5). Within each step, priority and how
soon something is due decide what gets funded first — so a tax bill due in three weeks is not
starved by a step that sits above it.

**Why does the AI always take taxes out first?**
As a freelancer, a portion of every payment belongs to the government. The tax carve-out ensures that money is set aside the moment income arrives. If a payment is non-taxable (a reimbursement, gift, etc.), turn off the Taxable toggle.

**What if I disagree with the AI's allocation?**
Edit any amount on the review screen before confirming. Or choose "Assign manually" to start from scratch with $0 in every category.

**Can I use this if I have a regular salary?**
Yes. Enter your net salary as income each pay period and set both the federal and provincial percentages to 0% (tax is already deducted at source), or use the Taxable toggle.

**What is the difference between account balance and category balance?**
The account balance is the real-world number (what your bank says). Category balances are your budget envelopes — how that money is designated. They track in parallel. Logging income updates both (account gets the deposit, categories get funded). Logging a regular expense only updates the category. Logging a debt payment updates both the cash account and the debt account.

**What if a category goes negative?**
The app allows negative balances. It means you spent more than you allocated to that bucket — a signal to fund it more on your next income entry.

**What happens to history if I archive a category or account?**
History is preserved. Archived items are hidden from the UI but all their transactions remain in your records.

**How do I start my whole plan over?**
Scroll to the bottom of the dashboard and use **Reset all data** under "Start over". It deletes
every category, account, income event, transaction and transfer, then optionally restores the
default starter categories. You have to confirm twice and type `RESET` to go through with it.

**Can I undo a reset?**
No. The deletion is permanent and there is no backup. Export your history from **Transactions →
Export CSV** first if you may want it later. Your account itself is not deleted — you stay
logged in and your tax settings are preserved.

**Is my data private?**
Yes. All database queries are protected by Row Level Security (RLS) — you only ever see your own data. AI calls send only your budget numbers (no personal details) to Anthropic's API.

**What does the AI cost?**
Each AI call costs roughly $0.001–$0.004 CAD. For typical usage (a few income entries and affordability checks per month), total AI cost is under $0.10/month.
