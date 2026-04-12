/**
 * Service → document + deadline mappings
 * blueprint-part2.md §19.1
 *
 * Used by both the Step 3 "will generate" preview
 * and the Step 4 generation pipeline.
 */

// ─────────────────────────────────────────
// Service display config (for chip labels)
// ─────────────────────────────────────────

export interface ServiceOption {
  value: string          // matches firms.services array values
  label: string          // display label in chip
  category: 'tax' | 'advisory' | 'compliance'
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  { value: '1040',               label: 'Individual (1040)',       category: 'tax' },
  { value: '1120-S',             label: 'S-Corp (1120-S)',         category: 'tax' },
  { value: '1065',               label: 'Partnership (1065)',      category: 'tax' },
  { value: '1120',               label: 'C-Corp (1120)',           category: 'tax' },
  { value: '990',                label: 'Non-Profit (990)',        category: 'tax' },
  { value: 'bookkeeping',        label: 'Bookkeeping',             category: 'advisory' },
  { value: 'payroll',            label: 'Payroll',                 category: 'compliance' },
  { value: 'tax_planning',       label: 'Tax Planning',            category: 'advisory' },
  { value: 'sales_tax',          label: 'Sales Tax',               category: 'compliance' },
  { value: 'irs_representation', label: 'IRS Representation',      category: 'compliance' },
  { value: 'cfo_advisory',       label: 'CFO Advisory',            category: 'advisory' },
  { value: 'business_formation', label: 'Business Formation',      category: 'advisory' },
]

// ─────────────────────────────────────────
// Service → what documents it generates
// ─────────────────────────────────────────

export interface ServiceDocMapping {
  serviceValue: string
  engagementLetterLabel: string   // human label for the document title
  hasPortal: boolean
  hasTaxDeadline: boolean
  /** ISO date string like "YYYY-MM-DD" using 2025 as base year */
  primaryDeadline?: string
  /** Filing type label for the Deadline record */
  filingType?: string
}

const CURRENT_YEAR = new Date().getFullYear()

export const SERVICE_DOC_MAPPINGS: Record<string, ServiceDocMapping> = {
  '1040': {
    serviceValue:           '1040',
    engagementLetterLabel:  'Engagement Letter — Individual (1040)',
    hasPortal:              true,
    hasTaxDeadline:         true,
    primaryDeadline:        `${CURRENT_YEAR}-04-15`,
    filingType:             'Form 1040',
  },
  '1120-S': {
    serviceValue:           '1120-S',
    engagementLetterLabel:  'Engagement Letter — S-Corp (1120-S)',
    hasPortal:              true,
    hasTaxDeadline:         true,
    primaryDeadline:        `${CURRENT_YEAR}-03-15`,
    filingType:             'Form 1120-S',
  },
  '1065': {
    serviceValue:           '1065',
    engagementLetterLabel:  'Engagement Letter — Partnership (1065)',
    hasPortal:              true,
    hasTaxDeadline:         true,
    primaryDeadline:        `${CURRENT_YEAR}-03-15`,
    filingType:             'Form 1065',
  },
  '1120': {
    serviceValue:           '1120',
    engagementLetterLabel:  'Engagement Letter — C-Corp (1120)',
    hasPortal:              true,
    hasTaxDeadline:         true,
    primaryDeadline:        `${CURRENT_YEAR}-04-15`,
    filingType:             'Form 1120',
  },
  '990': {
    serviceValue:           '990',
    engagementLetterLabel:  'Engagement Letter — Non-Profit (990)',
    hasPortal:              true,
    hasTaxDeadline:         true,
    primaryDeadline:        `${CURRENT_YEAR}-05-15`,
    filingType:             'Form 990',
  },
  bookkeeping: {
    serviceValue:           'bookkeeping',
    engagementLetterLabel:  'Engagement Letter — Monthly Bookkeeping',
    hasPortal:              true,
    hasTaxDeadline:         false,
  },
  payroll: {
    serviceValue:           'payroll',
    engagementLetterLabel:  'Engagement Letter — Payroll Services',
    hasPortal:              false,
    hasTaxDeadline:         false,
  },
  tax_planning: {
    serviceValue:           'tax_planning',
    engagementLetterLabel:  'Engagement Letter — Tax Planning',
    hasPortal:              false,
    hasTaxDeadline:         false,
  },
  sales_tax: {
    serviceValue:           'sales_tax',
    engagementLetterLabel:  'Engagement Letter — Sales Tax',
    hasPortal:              false,
    hasTaxDeadline:         false,
  },
  irs_representation: {
    serviceValue:           'irs_representation',
    engagementLetterLabel:  'Engagement Letter — IRS Representation',
    hasPortal:              false,
    hasTaxDeadline:         false,
  },
  cfo_advisory: {
    serviceValue:           'cfo_advisory',
    engagementLetterLabel:  'Engagement Letter — CFO Advisory',
    hasPortal:              false,
    hasTaxDeadline:         false,
  },
  business_formation: {
    serviceValue:           'business_formation',
    engagementLetterLabel:  'Engagement Letter — Business Formation',
    hasPortal:              false,
    hasTaxDeadline:         false,
  },
}

// ─────────────────────────────────────────
// "Will generate" preview calculator
// ─────────────────────────────────────────

export interface GenerationPreview {
  engagementLetterCount: number
  portalCount: number
  hasDeadlineCalendar: boolean
}

export function calcGenerationPreview(selectedServices: string[]): GenerationPreview {
  let engagementLetterCount = 0
  let portalCount = 0
  let hasDeadlineCalendar = false

  for (const svc of selectedServices) {
    const mapping = SERVICE_DOC_MAPPINGS[svc]
    if (!mapping) continue
    engagementLetterCount++
    if (mapping.hasPortal)      portalCount++
    if (mapping.hasTaxDeadline) hasDeadlineCalendar = true
  }

  return { engagementLetterCount, portalCount, hasDeadlineCalendar }
}

// ─────────────────────────────────────────
// Generation checklist (for step 4 UI)
// ─────────────────────────────────────────

export interface GenerationChecklistItem {
  id: string
  label: string
}

export function buildGenerationChecklist(selectedServices: string[]): GenerationChecklistItem[] {
  const items: GenerationChecklistItem[] = [
    { id: 'analyze', label: 'Analyzing your practice description' },
  ]

  // Engagement letters for each service
  for (const svc of selectedServices) {
    const mapping = SERVICE_DOC_MAPPINGS[svc]
    if (!mapping) continue
    items.push({
      id: `letter-${svc}`,
      label: mapping.engagementLetterLabel,
    })
  }

  const preview = calcGenerationPreview(selectedServices)

  if (preview.portalCount > 0) {
    items.push({ id: 'portal',    label: 'Creating onboarding portal templates' })
  }
  if (preview.hasDeadlineCalendar) {
    items.push({ id: 'deadlines', label: 'Configuring IRS deadline calendar' })
  }

  items.push({ id: 'invoices',  label: 'Setting up invoice templates' })
  items.push({ id: 'complete',  label: 'Finalizing your Quilp workspace' })

  return items
}
