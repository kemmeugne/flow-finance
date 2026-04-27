export type AccountType =
  | 'checking' | 'savings' | 'cash'
  | 'credit_card' | 'line_of_credit'
  | 'mortgage' | 'auto_loan' | 'student_loan' | 'personal_loan' | 'medical_debt' | 'other_debt'
  | 'tfsa' | 'fhsa' | 'rrsp' | 'rdsp' | 'investment_other'

export type AccountGroup = 'cash' | 'credit' | 'loans' | 'investments'

export const ACCOUNT_TYPE_TO_GROUP: Record<AccountType, AccountGroup> = {
  checking: 'cash', savings: 'cash', cash: 'cash',
  credit_card: 'credit', line_of_credit: 'credit',
  mortgage: 'loans', auto_loan: 'loans', student_loan: 'loans',
  personal_loan: 'loans', medical_debt: 'loans', other_debt: 'loans',
  tfsa: 'investments', fhsa: 'investments', rrsp: 'investments',
  rdsp: 'investments', investment_other: 'investments',
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking', savings: 'Savings', cash: 'Cash',
  credit_card: 'Credit Card', line_of_credit: 'Line of Credit',
  mortgage: 'Mortgage', auto_loan: 'Auto Loan', student_loan: 'Student Loan',
  personal_loan: 'Personal Loan', medical_debt: 'Medical Debt', other_debt: 'Other Debt',
  tfsa: 'TFSA', fhsa: 'FHSA', rrsp: 'RRSP', rdsp: 'RDSP',
  investment_other: 'Other Investment',
}

export const ACCOUNT_GROUP_CONFIG: Record<AccountGroup, {
  label: string
  badge: string
  dot: string
  isDebt: boolean
}> = {
  cash:        { label: 'Cash Accounts',       badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', isDebt: false },
  credit:      { label: 'Credit Accounts',     badge: 'bg-rose-100 text-rose-700',      dot: 'bg-rose-500',    isDebt: true  },
  loans:       { label: 'Loans & Mortgages',   badge: 'bg-orange-100 text-orange-700',  dot: 'bg-orange-500',  isDebt: true  },
  investments: { label: 'Investment Accounts', badge: 'bg-indigo-100 text-indigo-700',  dot: 'bg-indigo-500',  isDebt: false },
}

export const ACCOUNT_GROUP_ORDER: AccountGroup[] = ['cash', 'credit', 'loans', 'investments']

export const DEBT_ACCOUNT_TYPES = new Set<AccountType>([
  'credit_card', 'line_of_credit',
  'mortgage', 'auto_loan', 'student_loan', 'personal_loan', 'medical_debt', 'other_debt',
])

export const REGISTERED_ACCOUNT_TYPES = new Set<AccountType>(['tfsa', 'fhsa', 'rrsp', 'rdsp'])

export const CASH_ACCOUNT_TYPES = new Set<AccountType>(['checking', 'savings', 'cash'])

// Pre-filled annual contribution limits (CAD, 2025)
export const YEARLY_CONTRIBUTION_LIMITS: Partial<Record<AccountType, number>> = {
  tfsa: 7000,
  fhsa: 8000,
}

export function isDebtAccount(type: string): boolean {
  return DEBT_ACCOUNT_TYPES.has(type as AccountType)
}

export function isRegisteredAccount(type: string): boolean {
  return REGISTERED_ACCOUNT_TYPES.has(type as AccountType)
}

export function isCashAccount(type: string): boolean {
  return CASH_ACCOUNT_TYPES.has(type as AccountType)
}

export function getAccountGroup(type: string): AccountGroup {
  return ACCOUNT_TYPE_TO_GROUP[type as AccountType] ?? 'cash'
}

export function balanceLabel(type: string): string {
  if (isDebtAccount(type)) return 'Outstanding Balance (what you owe)'
  if (type === 'investment_other' || isRegisteredAccount(type)) return 'Current Value'
  return 'Current Balance'
}
