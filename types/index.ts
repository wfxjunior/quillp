// ══════════════════════════════════════════════════════════════════
//  Quilp — TypeScript Entity Interfaces
//  Source: CONTEXT.md §7 + blueprint-part1.md §4
//  Migration order: users → firms → clients → documents → invoices →
//    tax_documents → deadlines → timeline_events → firm_templates →
//    notifications
// ══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// 1. USER
// ─────────────────────────────────────────
export type UserRole = 'owner' | 'staff' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  password_hash?: string          // never returned from API
  firm_id: string
  role: UserRole
  created_at: string
  last_login_at: string | null
  onboarding_completed: boolean
}

// ─────────────────────────────────────────
// 2. FIRM
// ─────────────────────────────────────────
export type FeeModel = 'flat_fee' | 'hourly' | 'retainer' | 'hybrid'
export type SubscriptionPlan = 'solo' | 'small_firm' | 'growing_firm'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

export interface FirmAddress {
  street: string
  city: string
  state: string
  zip: string
}

export interface FirmDescriptionParsed {
  firm_name: string | null
  primary_state: string | null
  services: string[]
  fee_model: FeeModel | null
  client_types: string[]
  entity_types: string[]
  revenue_range: string | null
  firm_size: 'solo' | 'small_team' | 'growing' | null
}

export interface Firm {
  id: string
  name: string
  owner_id: string
  logo_url: string | null
  address: FirmAddress | null
  primary_state: string | null
  fee_model: FeeModel | null
  services: string[]
  entity_types: string[]
  client_types: string[]
  description_raw: string | null
  description_parsed: FirmDescriptionParsed | null
  docusign_token: string | null   // encrypted at rest
  stripe_account_id: string | null
  subscription_plan: SubscriptionPlan
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  created_at: string
}

// ─────────────────────────────────────────
// 3. CLIENT
// ─────────────────────────────────────────
export type EntityType = 'individual' | 's_corp' | 'llc' | 'partnership' | 'c_corp'
export type FeeStructure = 'flat_fee' | 'hourly' | 'retainer'
export type PipelineStage =
  | 'engaged'
  | 'onboarding'
  | 'docs_received'
  | 'in_progress'
  | 'review'
  | 'filed_invoiced'

export interface Client {
  id: string
  firm_id: string
  name: string
  email: string
  phone: string | null
  entity_type: EntityType
  services: string[]
  filing_state: string | null
  tax_year: number | null
  fee_amount: number | null
  fee_structure: FeeStructure | null
  pipeline_stage: PipelineStage
  portal_token: string
  portal_submitted_at: string | null
  internal_notes: string | null
  created_at: string
  archived_at: string | null
}

// ─────────────────────────────────────────
// 4. DOCUMENT
// ─────────────────────────────────────────
export type DocumentType =
  | 'engagement_letter'
  | 'proposal'
  | 'form_2848'
  | 'invoice'
  | 'checklist'
  | 'onboarding_portal'
  | 'delivery_summary'

export type DocumentStatus =
  | 'draft'
  | 'sent'
  | 'awaiting_signature'
  | 'signed'
  | 'paid'
  | 'archived'

export interface DocumentGenerationParams {
  client_id?: string
  service_type?: string
  fee_amount?: number
  jurisdiction?: string
  special_terms?: string
  [key: string]: unknown
}

export interface Document {
  id: string
  firm_id: string
  client_id: string | null
  type: DocumentType
  status: DocumentStatus
  title: string
  content_html: string | null
  pdf_url: string | null
  docusign_envelope_id: string | null
  signed_at: string | null
  service_type: string | null
  fee_amount: number | null
  jurisdiction: string | null
  generation_params: DocumentGenerationParams | null
  created_at: string
}

// ─────────────────────────────────────────
// 5. INVOICE
// ─────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'
export type PaymentMethod = 'stripe' | 'manual'

export interface Invoice {
  id: string
  firm_id: string
  client_id: string
  invoice_number: string
  description: string
  amount: number
  status: InvoiceStatus
  due_date: string
  paid_at: string | null
  payment_method: PaymentMethod | null
  stripe_payment_intent_id: string | null
  stripe_payment_link: string | null
  pdf_url: string | null
  created_at: string
}

// ─────────────────────────────────────────
// 6. TAX DOCUMENT
// ─────────────────────────────────────────
export type TaxDocumentStatus = 'missing' | 'requested' | 'received'
export type TaxDocumentUploadedBy = 'client' | 'cpa'

export interface TaxDocument {
  id: string
  client_id: string
  document_type: string           // e.g. "W-2", "1099-INT", "K-1", "1098"
  required: boolean
  status: TaxDocumentStatus
  file_url: string | null
  file_name: string | null
  uploaded_at: string | null
  uploaded_by: TaxDocumentUploadedBy | null
}

// ─────────────────────────────────────────
// 7. DEADLINE
// ─────────────────────────────────────────
export type DeadlineStatus = 'pending' | 'filed' | 'extended'

export interface Deadline {
  id: string
  firm_id: string
  client_id: string
  filing_type: string             // e.g. "Form 1040", "Form 1120-S"
  due_date: string
  status: DeadlineStatus
  extension_due_date: string | null
  alert_sent_30: boolean
  alert_sent_14: boolean
  alert_sent_7: boolean
  notes: string | null
}

// ─────────────────────────────────────────
// 8. TIMELINE EVENT
// ─────────────────────────────────────────
export type TimelineEventType =
  | 'note'
  | 'stage_change'
  | 'document_sent'
  | 'document_signed'
  | 'file_uploaded'
  | 'invoice_paid'
  | 'reminder_sent'

export interface TimelineEvent {
  id: string
  client_id: string
  type: TimelineEventType
  title: string
  detail: string | null
  created_by: string | null       // User.id; null for automated events
  created_at: string
}

// ─────────────────────────────────────────
// 9. FIRM TEMPLATE
// ─────────────────────────────────────────
export interface FirmTemplateDiff {
  field: string
  original: string
  modified: string
}

export interface FirmTemplate {
  id: string
  firm_id: string
  document_type: DocumentType
  service_type: string
  content_html: string
  diff_from_default: FirmTemplateDiff[] | null
  updated_at: string
}

// ─────────────────────────────────────────
// 10. NOTIFICATION
// ─────────────────────────────────────────
export type NotificationType =
  | 'deadline_alert'
  | 'document_signed'
  | 'portal_submitted'
  | 'invoice_overdue'
  | 'missing_document'

export interface Notification {
  id: string
  firm_id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  link: string | null
  created_at: string
}

// ══════════════════════════════════════════════════════════════════
//  API / UI Helpers
// ══════════════════════════════════════════════════════════════════

/** Client with their latest deadline and invoice status pre-joined */
export interface ClientWithContext extends Client {
  next_deadline: Deadline | null
  unpaid_invoice_count: number
  latest_document: Document | null
}

/** Firm + authenticated user bundled for FirmContext */
export interface FirmContextValue {
  firm: Firm
  user: User
  subscription: {
    plan: SubscriptionPlan
    status: SubscriptionStatus
    trial_ends_at: string | null
    days_remaining: number | null
  }
}
