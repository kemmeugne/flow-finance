# Flow Finance — User Manual

## What is Flow Finance?

Flow Finance is a personal budget app built for **freelancers and people with variable income**. Unlike traditional budgets that assume you get paid the same amount every month, Flow Finance works around how freelancers actually get paid: irregular amounts, at irregular times.

The core idea is simple: **every time money comes in, you decide exactly where it goes before you spend it.** The app — powered by an AI — suggests how to split your income across all your budget categories based on what's most urgent, what's due soon, and what's already funded. You review the suggestion, adjust if needed, and confirm. From that point on, your balances are always up to date.

**Live app:** https://flow-finance-ebon.vercel.app

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

### 2. Review your categories

Go to **Categories** in the sidebar. You will see all your budget categories. For each one, check:

- **Target amount** — how much should ideally be in this bucket (e.g. $1,500 for rent, $10,000 for emergency fund)
- **Current balance** — how much is actually in it right now
- **Priority** — how critical it is (P1 = must fund first, P5 = nice to have)
- **Due date** — when it next needs to be paid (optional, but helps the AI prioritize)

Take 10 minutes to adjust these to match your actual life. The more accurate your targets and priorities, the better the AI allocations will be.

### 3. Enter your first income

Go to **Add Income** in the sidebar. Enter the amount and where it came from. The AI will instantly suggest how to split it across all your categories. Review the suggestion, adjust any amounts if you want, then confirm. Your category balances update immediately.

---

## Screens

### Dashboard

The dashboard is your home screen. It gives you a full picture of your financial health at a glance.

**Summary row (top)**
Four cards showing:
- *Total Funded* — sum of all current balances across every category
- *Overall Funded %* — how funded you are relative to all your targets combined
- *Categories* — how many active budget buckets you have
- *Underfunded* — how many categories are below 50% of their target

**Needs funding alert**
If any categories are below 50% of their target, a red banner lists them in order of urgency. This is your action list for your next income entry.

**Upcoming Due Dates**
Any category with a due date in the next 45 days appears here, sorted by how soon it's due. Each row shows:
- How many days until it's due
- The category name and group
- A mini progress bar showing how funded it is
- How much money is still needed

Items due within 7 days are highlighted in red. This section is designed to make sure nothing sneaks up on you.

**Category cards**
Below the alerts, all your categories are shown grouped by type (Taxes, Bills, etc.), each with a progress bar, current balance vs target, priority badge, and a yellow "Due in Xd" badge if it's due within 14 days.

**Action buttons (top right)**
Three buttons are always available from the dashboard:
- **Add Income** — enter a new income payment
- **Log Expense** — record a purchase against a specific category
- **Can I afford this?** — ask the AI whether a purchase is a good idea right now

---

### Categories

This screen lets you manage all your budget buckets.

**Adding a category**
Click **Add category** (top right). Fill in:
- *Name* — what is this bucket for? (e.g. "Rent", "MacBook fund")
- *Group* — which type does it belong to?
- *Target amount* — how much should it hold? (leave at 0 if you just want a spending bucket with no target)
- *Current balance* — how much is already in it? (useful when setting up for the first time)
- *Priority* — P1 = critical (always fund first), P2 = important, P3 = standard, P4 = optional, P5 = nice to have
- *Due date* — when does this next need to be paid? (optional)
- *Due frequency* — monthly, quarterly, annual, one-time, or none
- *Notes* — any extra context you want to remember

**Editing a category**
Click the pencil icon on any category card. All fields are editable.

**Archiving a category**
Click the archive (trash) icon. The category is hidden from all screens but your transaction history is preserved. Archived categories do not receive AI allocations.

> **Tip:** Never delete a category that has transaction history — archive it instead. This keeps your past records intact.

---

### Add Income

This is where you use the app's core feature. Use this screen every time you receive a payment.

**Step 1 — Enter the income**
- *Amount* — how much did you receive (gross, before anything)?
- *Source* — who paid you? (e.g. "Client ABC", "Freelance project")
- *Date* — when was it received?

Click **Get AI allocation**.

**Step 2 — Review the AI suggestion**

The AI (Claude Haiku) reads your current category balances, targets, priorities, and due dates, then suggests exactly how to split your income. The screen shows:

- An **AI strategy summary** — one sentence explaining the overall approach (e.g. "Prioritized tax reserve and rent, then distributed surplus to emergency fund")
- A list of every category receiving money, with the suggested amount and a one-line reason
- An editable amount field for each category so you can override any suggestion

The AI always sets aside your **tax carve-out percentage** (configurable in Settings, default 27%) before allocating the rest. This ensures you never accidentally spend money that belongs to the government.

You can increase or decrease any amount. The total remaining shows you how much is left to allocate.

**Step 3 — Confirm**

Click **Confirm allocation**. The app:
1. Records the income event
2. Saves the allocations
3. Updates all category balances instantly

You are redirected to the dashboard where you can see the updated balances.

> **What if there's no internet or the AI fails?** The app automatically falls back to a built-in algorithm that does the same prioritisation logic. You will see a small notice saying "Calculated by algorithm" instead of the AI summary. The result is very similar.

---

### Goals

This screen shows only your **Goals group** categories in a dedicated view, making it easy to track progress toward longer-term savings targets.

Each goal card shows:
- Goal name and target date (if set)
- A violet progress bar and percentage funded
- Current balance vs target amount
- **Monthly amount needed** — automatically calculated as `(amount still needed) ÷ (months until due date)`. This tells you exactly how much to allocate each month to hit the goal on time.
- A "Goal reached! 🎉" state when the balance meets or exceeds the target

The summary at the top shows your total saved across all goals, how many goals are active, and how many are fully funded.

> **Example:** You want $6,000 for a vacation by December (8 months away). You currently have $1,200. The app shows "$600/month needed" and "$4,800 remaining · 8 months to go".

---

### Transactions

A complete history of all your financial activity, organised by month.

**Month picker**
Use the left and right arrows to navigate between months. The current month is the default. You cannot go past the current month.

**Summary cards**
Three cards at the top show the totals for the selected month:
- *Income* — total of all income events received that month (green)
- *Spent* — total of all expenses logged that month (red)
- *Net* — income minus spending. Green if positive (you saved money), red if negative

**Activity list**
- Income events appear first, labelled with the source name and date
- Expenses appear below, grouped by date (newest first), showing the description and which category the money came from

**Export CSV**
The **Export CSV** button appears whenever there is data for the selected month. Clicking it downloads a `.csv` file named `flow-finance-YYYY-MM.csv` with these columns:

```
Date | Type | Description | Category | Amount (CAD)
```

This file can be opened in Excel, Google Sheets, or any spreadsheet software for your own analysis, accounting, or tax preparation.

---

### Settings

**Tax Carve-out %**
The single most important setting in the app. This is the percentage of every income payment that gets reserved for taxes *before* anything else is allocated. The default is 27%, which is a reasonable starting point for a Canadian freelancer earning $60,000–$80,000/year.

- Use the slider or type a number directly (range: 5% to 50%)
- A live example shows the exact impact: "On a $5,000 income, $1,350 goes to taxes, leaving $3,650 to allocate"

> **Canadian freelancers:** If you're incorporated, your effective rate may be lower (15–20%). If you're a sole proprietor in a higher tax bracket, consider 30–35%. When in doubt, set it higher — you can always move money out of the tax bucket, but you can't pay the CRA with money you already spent.

**Currency**
Selects the display currency for all amounts. Options: CAD, USD, EUR, GBP. This is cosmetic — all stored amounts remain in the currency you entered them in.

Click **Save settings** to apply changes. A "Saved" confirmation appears briefly.

---

### Can I afford this? (AI advisor)

Accessible from the **Can I afford this?** button on the dashboard.

This feature lets you quickly gut-check any potential purchase against your current budget before committing to it.

**How to use it:**
1. Enter the amount (e.g. $800)
2. Describe what it's for (e.g. "New monitor for my home office")
3. Click **Ask Claude**

The AI reads your current category balances in real time and returns:

- A **verdict**: green (yes, go ahead), amber (possible but be careful), or red (not recommended)
- A **headline**: one-sentence summary of the verdict
- **Reasoning**: 2–3 sentences with specific numbers explaining why
- **Suggested category**: which category this should logically come from, and what the balance would be after the purchase

> **Example response:**
> *Verdict: Yes*
> *"You can comfortably cover this from your Lifestyle budget."*
> *"Your Lifestyle category has $1,240 available, well above the $800 cost. All critical P1/P2 categories are fully funded this month, so this purchase won't affect anything important. You'll have $440 left in Lifestyle after."*
> *Take it from: Lifestyle → $440 remaining*

Use this feature before any non-routine purchase. It takes about 2 seconds and costs a fraction of a cent.

---

### Log Expense (expense drawer)

Accessible from the **Log Expense** button on the dashboard.

Use this every time you spend money from one of your budget categories.

**Fields:**
- *Category* — which budget bucket is this coming from? The dropdown shows all active categories with their current balance.
- *Amount* — how much did you spend?
- *Description* — what did you buy? (e.g. "Groceries at Metro", "Adobe CC subscription")
- *Date* — when did you spend it? (defaults to today)

A **live balance preview** under the category selector shows: current balance → balance after this expense. It turns red if the expense would put the category into a negative balance.

After logging, your category balance updates instantly and the transaction appears in the Transactions history.

> **Important:** Log Expense only records the spend and updates the balance. It does not transfer money between categories. If you overspend one category, you need to move money manually by editing the category's current balance, or by allocating more to it on your next income entry.

---

## Recommended workflow

### When income arrives

1. Open the app
2. Go to **Add Income**
3. Enter the amount and source
4. Review the AI allocation — check that taxes are covered and any urgent categories are funded
5. Adjust if needed, then confirm
6. Done — your balances are current

### When you spend money

1. Open the app
2. Click **Log Expense** from the dashboard
3. Select the category, enter amount and description
4. Confirm

> Try to log expenses the same day you make them. It takes 15 seconds and keeps your balances accurate.

### Before a significant purchase

1. Click **Can I afford this?** from the dashboard
2. Enter the amount and what it's for
3. Read the AI's verdict
4. Decide accordingly

### Once a month

1. Go to **Transactions** and review the month's activity
2. Export CSV if you need it for bookkeeping or taxes
3. Check the Goals screen to see if you're on track
4. Adjust category targets or priorities in Settings if your situation has changed

---

## Frequently asked questions

**Why does the AI always take taxes out first?**
Because as a freelancer, the money in your bank account is not all yours. A portion belongs to the government. The tax carve-out ensures that money is mentally (and in the app) separated the moment income arrives, so you never accidentally spend it.

**What if I disagree with the AI's allocation?**
You can edit any amount on the allocation review screen before confirming. The AI's suggestion is a starting point, not a mandate.

**Can I use this if I have a regular salary?**
Yes. Just enter your net salary as income each pay period and set your tax carve-out to 0% (since tax is already deducted at source).

**What happens to old transactions if I archive a category?**
Nothing — they are preserved. The category is hidden from the UI, but all its historical transactions remain in your records and will still appear in the Transactions history.

**What if a category goes negative?**
The app allows negative balances. This just means you spent more than you had allocated to that bucket. It's a signal to allocate more to it next time income arrives.

**Is my data private?**
Yes. Every database query is protected by Row Level Security (RLS) — you can only ever see your own data. The AI calls send only your budget numbers (no personal details) to Anthropic's API.

**What does the AI cost?**
Each AI call (allocation or affordability check) costs roughly $0.001–$0.004 CAD. For typical usage (a few income entries and a few affordability checks per month), the total AI cost is under $0.10/month.
