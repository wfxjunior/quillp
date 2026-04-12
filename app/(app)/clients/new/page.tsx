'use client'

/**
 * /clients/new — Create Client
 * blueprint-part1.md §1.3, §14.2
 *
 * On save:
 *  1. Create Client record (with portal_token)
 *  2. Call /api/ai/generate-document for each selected service
 *  3. Create Deadline records per service mapping
 *  4. Show success toast
 *  5. Redirect to /clients/[id]
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/NotificationToast'
import { PrimaryButton } from '@/components/buttons/PrimaryButton'
import { GhostButton } from '@/components/buttons/GhostButton'
import { SERVICE_OPTIONS, SERVICE_DOC_MAPPINGS } from '@/lib/onboarding/service-mappings'
import { cn } from '@/lib/utils'
import type { EntityType, FeeStructure } from '@/types'

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const US_STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
  ['DC','Washington D.C.'],
] as const

const ENTITY_TYPES: { value: EntityType; label: string }[] = [
  { value: 'individual',  label: 'Individual' },
  { value: 's_corp',      label: 'S-Corporation' },
  { value: 'llc',         label: 'LLC' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'c_corp',      label: 'C-Corporation' },
]

const FEE_STRUCTURES: { value: FeeStructure; label: string }[] = [
  { value: 'flat_fee',  label: 'Flat fee' },
  { value: 'hourly',    label: 'Hourly' },
  { value: 'retainer',  label: 'Retainer' },
]

const CURRENT_YEAR = new Date().getFullYear()
const TAX_YEARS    = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2, CURRENT_YEAR - 3]

// ─────────────────────────────────────────
// Shared form input components
// ─────────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}

function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[11.5px] text-ink-soft font-light">{hint}</p>
      )}
      {error && (
        <p className="text-[12px] text-red-500 leading-snug">{error}</p>
      )}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean
  prefix?: string
}

function Input({ hasError, prefix, className, ...props }: InputProps) {
  if (prefix) {
    return (
      <div className={cn(
        'flex items-center bg-white border-[0.5px] rounded',
        hasError ? 'border-red-400' : 'border-beige-300 focus-within:border-sage-400',
        'transition-colors duration-150'
      )}>
        <span className="pl-4 pr-2 text-[14px] text-ink-soft select-none">{prefix}</span>
        <input
          className={cn(
            'flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-soft',
            'py-[13px] pr-4 outline-none',
            className
          )}
          {...props}
        />
      </div>
    )
  }
  return (
    <input
      className={cn(
        'w-full bg-white text-[14px] text-ink placeholder:text-ink-soft',
        'border-[0.5px] rounded px-4 py-[13px]',
        'outline-none transition-colors duration-150',
        hasError ? 'border-red-400 focus:border-red-400' : 'border-beige-300 focus:border-sage-400',
        className
      )}
      {...props}
    />
  )
}

function Select({ hasError, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }) {
  return (
    <select
      className={cn(
        'w-full bg-white text-[14px] text-ink',
        'border-[0.5px] rounded px-4 py-[13px]',
        'outline-none transition-colors duration-150 cursor-pointer',
        hasError ? 'border-red-400' : 'border-beige-300 focus:border-sage-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
}

// ─────────────────────────────────────────
// Service chip group
// ─────────────────────────────────────────

function ServiceChips({
  selected,
  onChange,
  hasError,
}: {
  selected: string[]
  onChange: (v: string[]) => void
  hasError?: boolean
}) {
  function toggle(value: string) {
    onChange(selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]
    )
  }

  return (
    <div className={cn(
      'p-3 bg-white border-[0.5px] rounded',
      hasError ? 'border-red-400' : 'border-beige-300',
    )}>
      {(['tax', 'advisory', 'compliance'] as const).map(cat => {
        const opts = SERVICE_OPTIONS.filter(o => o.category === cat)
        const catLabel = cat === 'tax' ? 'Tax Returns' : cat === 'advisory' ? 'Advisory & Bookkeeping' : 'Compliance'
        return (
          <div key={cat} className="mb-3 last:mb-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-1.5">
              {catLabel}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {opts.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    'h-7 px-3 text-[12px] font-[450] rounded-[6px]',
                    'border-[0.5px] transition-colors duration-150 select-none',
                    selected.includes(opt.value)
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-ink-mid border-beige-300 hover:border-beige-400 hover:text-ink',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────

function validatePhone(v: string): string {
  if (!v) return ''
  const digits = v.replace(/\D/g, '')
  if (digits.length !== 10) return 'Enter a valid 10-digit US phone number'
  return ''
}

function validateEmail(v: string): string {
  if (!v) return ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address'
  return ''
}

// ─────────────────────────────────────────
// Form state
// ─────────────────────────────────────────

interface FormState {
  name: string
  email: string
  phone: string
  entity_type: EntityType | ''
  services: string[]
  filing_state: string
  tax_year: string
  fee_amount: string
  fee_structure: FeeStructure | ''
}

interface FormErrors {
  name?: string
  email?: string
  phone?: string
  entity_type?: string
  services?: string
  filing_state?: string
  tax_year?: string
  fee_amount?: string
}

// ─────────────────────────────────────────
// Page
// ─────────────────────────────────────────

export default function NewClientPage() {
  const router = useRouter()
  const { show: showToast } = useToast()

  const [form, setForm] = useState<FormState>({
    name: '', email: '', phone: '',
    entity_type: '',
    services: [],
    filing_state: '',
    tax_year: String(CURRENT_YEAR),
    fee_amount: '',
    fee_structure: '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    // Clear error on change
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  // ── Validation ────────────────────────────────────────────────────

  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!form.name.trim() || form.name.trim().length < 2) {
      e.name = 'Full name is required (min 2 characters)'
    }
    const emailErr = validateEmail(form.email)
    if (emailErr) e.email = emailErr
    const phoneErr = validatePhone(form.phone)
    if (phoneErr) e.phone = phoneErr
    if (!form.entity_type) e.entity_type = 'Select an entity type'
    if (!form.services.length) e.services = 'Select at least one service'
    if (!form.filing_state) e.filing_state = 'Select a filing state'
    if (!form.tax_year) e.tax_year = 'Select a tax year'
    if (!form.fee_amount || Number(form.fee_amount) <= 0) {
      e.fee_amount = 'Enter a fee amount greater than 0'
    } else if (Number(form.fee_amount) > 999999) {
      e.fee_amount = 'Fee amount cannot exceed $999,999'
    }
    return e
  }

  // ── Submit ────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const validationErrors = validate()
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.push('/login'); return }

      const { data: userRow } = await supabase
        .from('users')
        .select('firm_id')
        .eq('id', authUser.id)
        .single()

      if (!userRow?.firm_id) throw new Error('No firm found')

      // 1. Create client record
      const portalToken = crypto.randomUUID()
      const phoneNormalized = form.phone ? form.phone.replace(/\D/g, '') : null

      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          firm_id:        userRow.firm_id,
          name:           form.name.trim(),
          email:          form.email.toLowerCase().trim() || null,
          phone:          phoneNormalized,
          entity_type:    form.entity_type as EntityType,
          services:       form.services,
          filing_state:   form.filing_state,
          tax_year:       Number(form.tax_year),
          fee_amount:     Number(form.fee_amount),
          fee_structure:  form.fee_structure || null,
          pipeline_stage: 'engaged',
          portal_token:   portalToken,
          created_at:     new Date().toISOString(),
        })
        .select('id')
        .single()

      if (clientError || !newClient) throw new Error(clientError?.message ?? 'Failed to create client')

      const clientId = newClient.id

      // 2. Auto-generate engagement letter for each service (fire and forget)
      for (const svc of form.services) {
        const mapping = SERVICE_DOC_MAPPINGS[svc]
        if (mapping) {
          fetch('/api/ai/generate-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientId, service_type: svc }),
          }).catch(console.error) // intentionally not awaited
        }
      }

      // 3. Create deadline records for tax-filing services
      const deadlineInserts = form.services
        .map(svc => SERVICE_DOC_MAPPINGS[svc])
        .filter(m => m?.hasTaxDeadline && m.primaryDeadline && m.filingType)
        .map(m => ({
          firm_id:       userRow.firm_id,
          client_id:     clientId,
          filing_type:   m!.filingType!,
          due_date:      m!.primaryDeadline!,
          status:        'pending',
          alert_sent_30: false,
          alert_sent_14: false,
          alert_sent_7:  false,
        }))

      if (deadlineInserts.length) {
        await supabase.from('deadlines').insert(deadlineInserts)
      }

      // 4. Success
      showToast({
        message: `${form.name.trim()} added successfully.`,
        variant: 'success',
      })

      router.push(`/clients/${clientId}`)
    } catch (err) {
      console.error('[new-client] error:', err)
      showToast({
        message: 'Something went wrong. Please try again.',
        variant: 'error',
      })
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────

  return (
    <div className="px-6 py-6 max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-[13px] text-ink-mid hover:text-ink transition-colors mb-5"
      >
        <ArrowLeft size={14} strokeWidth={2} />
        Back to clients
      </Link>

      {/* Page header */}
      <div className="mb-7">
        <h1 className="font-serif text-[28px] font-medium text-ink tracking-[-0.5px] leading-tight mb-1">
          Add new client
        </h1>
        <p className="text-[13.5px] text-ink-soft font-light">
          Quilp will generate an engagement letter and configure deadlines automatically.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card px-6 py-6 flex flex-col gap-5">

          {/* ── Section: Contact info ──────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-3">
              Contact Information
            </p>
            <div className="flex flex-col gap-4">
              <Field label="Full name" required error={errors.name}>
                <Input
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  onBlur={() => {
                    if (!form.name.trim() || form.name.trim().length < 2)
                      setErrors(p => ({ ...p, name: 'Full name is required (min 2 characters)' }))
                  }}
                  hasError={!!errors.name}
                  autoComplete="name"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Email address" error={errors.email}>
                  <Input
                    type="email"
                    placeholder="jane@example.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                    onBlur={() => {
                      const err = validateEmail(form.email)
                      if (err) setErrors(p => ({ ...p, email: err }))
                    }}
                    hasError={!!errors.email}
                    autoComplete="email"
                  />
                </Field>
                <Field label="Phone number" error={errors.phone} hint="Optional — US format">
                  <Input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value)}
                    onBlur={() => {
                      const err = validatePhone(form.phone)
                      if (err) setErrors(p => ({ ...p, phone: err }))
                    }}
                    hasError={!!errors.phone}
                    autoComplete="tel"
                  />
                </Field>
              </div>
            </div>
          </div>

          <hr className="border-beige-100" />

          {/* ── Section: Engagement details ────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-3">
              Engagement Details
            </p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Entity type" required error={errors.entity_type}>
                  <Select
                    value={form.entity_type}
                    onChange={e => set('entity_type', e.target.value as EntityType)}
                    hasError={!!errors.entity_type}
                  >
                    <option value="">Select entity type…</option>
                    {ENTITY_TYPES.map(et => (
                      <option key={et.value} value={et.value}>{et.label}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Filing state" required error={errors.filing_state}>
                  <Select
                    value={form.filing_state}
                    onChange={e => set('filing_state', e.target.value)}
                    hasError={!!errors.filing_state}
                  >
                    <option value="">Select state…</option>
                    {US_STATES.map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Services" required error={errors.services}>
                <ServiceChips
                  selected={form.services}
                  onChange={v => set('services', v)}
                  hasError={!!errors.services}
                />
              </Field>

              <Field label="Tax year" required error={errors.tax_year}>
                <Select
                  value={form.tax_year}
                  onChange={e => set('tax_year', e.target.value)}
                  hasError={!!errors.tax_year}
                >
                  {TAX_YEARS.map(y => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <hr className="border-beige-100" />

          {/* ── Section: Fees ───────────────────────────────── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-3">
              Fee Structure
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Fee amount" required error={errors.fee_amount}>
                <Input
                  type="number"
                  prefix="$"
                  placeholder="2,500"
                  value={form.fee_amount}
                  onChange={e => set('fee_amount', e.target.value)}
                  onBlur={() => {
                    if (!form.fee_amount || Number(form.fee_amount) <= 0)
                      setErrors(p => ({ ...p, fee_amount: 'Enter a fee amount greater than 0' }))
                  }}
                  hasError={!!errors.fee_amount}
                  min="0"
                  max="999999"
                />
              </Field>

              <Field label="Fee structure">
                <Select
                  value={form.fee_structure}
                  onChange={e => set('fee_structure', e.target.value as FeeStructure)}
                >
                  <option value="">Select structure…</option>
                  {FEE_STRUCTURES.map(fs => (
                    <option key={fs.value} value={fs.value}>{fs.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-5">
          <GhostButton
            type="button"
            size="md"
            onClick={() => router.push('/clients')}
            disabled={loading}
          >
            Cancel
          </GhostButton>
          <PrimaryButton
            type="submit"
            size="md"
            loading={loading}
          >
            Create client →
          </PrimaryButton>
        </div>
      </form>
    </div>
  )
}
