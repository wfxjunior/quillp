/**
 * lib/deadlines/rules.ts
 *
 * Static mapping of service types → filing deadlines.
 * Month is 1-based (1 = January, 4 = April, etc.)
 * Day is the calendar day of that month.
 *
 * These are standard US federal deadlines. State deadlines vary —
 * a future extension could add a `state` field per rule.
 */

export interface DeadlineRule {
  label:    string   // filing type label, stored in deadlines.filing_type
  month:    number   // 1–12
  day:      number   // 1–31
  isExt?:   boolean  // true = extension deadline
}

export const DEADLINE_RULES: Record<string, DeadlineRule[]> = {
  '1040': [
    { label: 'Form 1040 (Individual)',           month: 4,  day: 15 },
    { label: 'Form 1040 Extension',              month: 10, day: 15, isExt: true },
  ],
  'bookkeeping': [
    // Year-end close — Jan 31 of following year
    { label: 'Bookkeeping Year-End',             month: 1,  day: 31 },
  ],
  '1120-S': [
    { label: 'Form 1120-S (S-Corp)',             month: 3,  day: 15 },
    { label: 'Form 1120-S Extension',            month: 9,  day: 15, isExt: true },
  ],
  '1065': [
    { label: 'Form 1065 (Partnership)',          month: 3,  day: 15 },
    { label: 'Form 1065 Extension',              month: 9,  day: 15, isExt: true },
  ],
  '1120': [
    { label: 'Form 1120 (C-Corp)',               month: 4,  day: 15 },
    { label: 'Form 1120 Extension',              month: 10, day: 15, isExt: true },
  ],
  '990': [
    { label: 'Form 990 (Non-Profit)',            month: 5,  day: 15 },
    { label: 'Form 990 Extension',               month: 11, day: 15, isExt: true },
  ],
  'payroll': [
    { label: 'Payroll Q1 (Form 941)',            month: 4,  day: 30 },
    { label: 'Payroll Q2 (Form 941)',            month: 7,  day: 31 },
    { label: 'Payroll Q3 (Form 941)',            month: 10, day: 31 },
    { label: 'Payroll Q4 (Form 941)',            month: 1,  day: 31 },
    { label: 'W-2 / 1099 Filing',               month: 1,  day: 31 },
  ],
  'tax_planning': [
    { label: 'Q1 Estimated Tax (1040-ES)',       month: 4,  day: 15 },
    { label: 'Q2 Estimated Tax (1040-ES)',       month: 6,  day: 15 },
    { label: 'Q3 Estimated Tax (1040-ES)',       month: 9,  day: 15 },
    { label: 'Q4 Estimated Tax (1040-ES)',       month: 1,  day: 15 },
  ],
  'sales_tax': [
    { label: 'Sales Tax Q1',                    month: 4,  day: 20 },
    { label: 'Sales Tax Q2',                    month: 7,  day: 20 },
    { label: 'Sales Tax Q3',                    month: 10, day: 20 },
    { label: 'Sales Tax Q4',                    month: 1,  day: 20 },
  ],
  'irs_representation': [
    // Responses vary — use a default notice response window
    { label: 'IRS Response Deadline',           month: 4,  day: 15 },
  ],
}

/**
 * Build the ISO due-date string for a rule in a given tax year.
 *
 * For rules where month < 4 (Jan–Mar), the due date falls in
 * `taxYear + 1` (e.g. Q4 payroll is due Jan 31 of the following year).
 * For all other months, it falls in `taxYear + 1` as well since
 * tax season generally applies to the *previous* year's returns.
 *
 * Simplified rule: all deadlines fall in taxYear + 1.
 * Month 1–3 → same as taxYear + 1 calendar year.
 * Month 4–12 → taxYear + 1.
 */
export function ruleToIsoDate(rule: DeadlineRule, taxYear: number): string {
  const calYear = taxYear + 1
  const mm = String(rule.month).padStart(2, '0')
  const dd = String(rule.day).padStart(2, '0')
  return `${calYear}-${mm}-${dd}`
}

/**
 * Return all deadline rules that apply to a client's services array.
 */
export function rulesForServices(services: string[]): DeadlineRule[] {
  const results: DeadlineRule[] = []
  for (const svc of services) {
    const rules = DEADLINE_RULES[svc]
    if (rules) results.push(...rules)
  }
  return results
}
