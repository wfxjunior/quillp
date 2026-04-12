'use client'

/**
 * Step2Info — Personal information form (Blueprint §14.5)
 *
 * Fields:
 *   - First name, Last name
 *   - Date of birth (18+ validation)
 *   - SSN last 4 (exactly 4 digits)
 *   - Street, City, State, ZIP
 *   - Filing status (select)
 *   - Number of dependents (number input)
 *   - Bank routing (optional, 9 digits)
 *   - Bank account (optional, 4–17 digits, masked)
 */

import { useState } from 'react'
import { cn } from '@/lib/utils'

const FILING_STATUSES = [
  { value: 'single',              label: 'Single' },
  { value: 'married_jointly',     label: 'Married Filing Jointly' },
  { value: 'married_separately',  label: 'Married Filing Separately' },
  { value: 'head_of_household',   label: 'Head of Household' },
  { value: 'qualifying_widow',    label: 'Qualifying Widow(er)' },
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export interface PersonalData {
  firstName:    string
  lastName:     string
  dob:          string
  ssnLast4:     string
  street:       string
  city:         string
  state:        string
  zip:          string
  filingStatus: string
  dependents:   string
  bankRouting:  string
  bankAccount:  string
}

interface Step2InfoProps {
  data:       PersonalData
  onChange:   (patch: Partial<PersonalData>) => void
  onContinue: () => void
}

function isAtLeast18(dob: string): boolean {
  if (!dob) return false
  const birth    = new Date(dob)
  const cutoff   = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 18)
  return birth <= cutoff
}

export function Step2Info({ data, onChange, onContinue }: Step2InfoProps) {
  const [errors, setErrors] = useState<Partial<Record<keyof PersonalData, string>>>({})
  const [bankVisible, setBankVisible] = useState(false)

  function set(field: keyof PersonalData, value: string) {
    onChange({ [field]: value })
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
  }

  function validate(): boolean {
    const e: Partial<Record<keyof PersonalData, string>> = {}

    if (!data.firstName.trim())  e.firstName    = 'Required'
    if (!data.lastName.trim())   e.lastName     = 'Required'
    if (!data.dob)               e.dob          = 'Required'
    else if (!isAtLeast18(data.dob)) e.dob      = 'You must be 18 or older'
    if (!/^\d{4}$/.test(data.ssnLast4)) e.ssnLast4 = 'Enter the last 4 digits of your SSN'
    if (!data.street.trim())     e.street       = 'Required'
    if (!data.city.trim())       e.city         = 'Required'
    if (!data.state)             e.state        = 'Required'
    if (!/^\d{5}(-\d{4})?$/.test(data.zip)) e.zip = 'Enter a valid ZIP code'
    if (!data.filingStatus)      e.filingStatus = 'Required'

    // Bank fields — optional but validated if provided
    if (data.bankRouting && !/^\d{9}$/.test(data.bankRouting))
      e.bankRouting = 'Routing number must be exactly 9 digits'
    if (data.bankAccount && !/^\d{4,17}$/.test(data.bankAccount))
      e.bankAccount = 'Account number must be 4–17 digits'

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validate()) onContinue()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <div>
        <h2 className="font-serif text-[26px] font-medium text-ink leading-tight mb-1">
          Your information
        </h2>
        <p className="text-[13.5px] text-ink-soft font-light">
          This information is shared only with your accountant and kept secure.
        </p>
      </div>

      {/* ── Name ── */}
      <FieldGroup label="Full name">
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="First name"
            id="firstName"
            value={data.firstName}
            onChange={v => set('firstName', v)}
            error={errors.firstName}
            autoComplete="given-name"
          />
          <Field
            label="Last name"
            id="lastName"
            value={data.lastName}
            onChange={v => set('lastName', v)}
            error={errors.lastName}
            autoComplete="family-name"
          />
        </div>
      </FieldGroup>

      {/* ── DOB + SSN ── */}
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Date of birth"
          id="dob"
          type="date"
          value={data.dob}
          onChange={v => set('dob', v)}
          error={errors.dob}
          autoComplete="bday"
        />
        <Field
          label="SSN — last 4 digits"
          id="ssnLast4"
          type="tel"
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          value={data.ssnLast4}
          onChange={v => set('ssnLast4', v.replace(/\D/g, '').slice(0, 4))}
          error={errors.ssnLast4}
          autoComplete="off"
        />
      </div>

      {/* ── Address ── */}
      <FieldGroup label="Home address">
        <div className="space-y-3">
          <Field
            label="Street address"
            id="street"
            value={data.street}
            onChange={v => set('street', v)}
            error={errors.street}
            autoComplete="street-address"
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Field
                label="City"
                id="city"
                value={data.city}
                onChange={v => set('city', v)}
                error={errors.city}
                autoComplete="address-level2"
              />
            </div>
            <div>
              <label htmlFor="state" className="block text-[12px] font-[450] text-ink-mid mb-1.5">
                State
              </label>
              <select
                id="state"
                value={data.state}
                onChange={e => set('state', e.target.value)}
                autoComplete="address-level1"
                className={cn(
                  'w-full h-10 px-3 text-[13.5px] text-ink bg-white border rounded-[10px] outline-none',
                  'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors',
                  errors.state ? 'border-red-300' : 'border-beige-200',
                )}
              >
                <option value="">State</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.state && <p className="text-[11.5px] text-red-500 mt-1">{errors.state}</p>}
            </div>
            <div>
              <Field
                label="ZIP"
                id="zip"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={data.zip}
                onChange={v => set('zip', v)}
                error={errors.zip}
                autoComplete="postal-code"
              />
            </div>
          </div>
        </div>
      </FieldGroup>

      {/* ── Filing status + Dependents ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="filingStatus" className="block text-[12px] font-[450] text-ink-mid mb-1.5">
            Filing status
          </label>
          <select
            id="filingStatus"
            value={data.filingStatus}
            onChange={e => set('filingStatus', e.target.value)}
            className={cn(
              'w-full h-10 px-3 text-[13.5px] text-ink bg-white border rounded-[10px] outline-none',
              'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors',
              errors.filingStatus ? 'border-red-300' : 'border-beige-200',
            )}
          >
            <option value="">Select…</option>
            {FILING_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {errors.filingStatus && (
            <p className="text-[11.5px] text-red-500 mt-1">{errors.filingStatus}</p>
          )}
        </div>
        <Field
          label="Dependents"
          id="dependents"
          type="number"
          inputMode="numeric"
          min="0"
          max="20"
          value={data.dependents}
          onChange={v => set('dependents', v)}
          error={errors.dependents}
        />
      </div>

      {/* ── Bank info (optional) ── */}
      <div>
        <button
          type="button"
          onClick={() => setBankVisible(v => !v)}
          className="text-[13px] text-sage-600 font-[450] hover:text-sage-700 transition-colors"
        >
          {bankVisible ? '− Hide' : '+ Add'} direct deposit information (optional)
        </button>

        {bankVisible && (
          <div className="mt-3 p-4 bg-beige-50 border border-beige-200 rounded-[12px] space-y-3">
            <p className="text-[12px] text-ink-soft font-light">
              For your tax refund via direct deposit. Routing and account numbers are shared only with your accountant.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Routing number (9 digits)"
                id="bankRouting"
                type="tel"
                inputMode="numeric"
                maxLength={9}
                value={data.bankRouting}
                onChange={v => set('bankRouting', v.replace(/\D/g, '').slice(0, 9))}
                error={errors.bankRouting}
                autoComplete="off"
              />
              <BankAccountField
                value={data.bankAccount}
                onChange={v => set('bankAccount', v)}
                error={errors.bankAccount}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <div className="pt-2">
        <button
          type="submit"
          className="inline-flex items-center gap-2 h-10 px-6 bg-ink text-white text-[13.5px] font-[450] rounded-[10px] hover:bg-ink/90 transition-colors"
        >
          Continue
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

interface FieldGroupProps {
  label:    string
  children: React.ReactNode
}
function FieldGroup({ label, children }: FieldGroupProps) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft mb-2.5">
        {label}
      </p>
      {children}
    </div>
  )
}

interface FieldProps {
  label:        string
  id:           string
  value:        string
  onChange:     (v: string) => void
  error?:       string
  type?:        string
  inputMode?:   React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?:   number
  min?:         string
  max?:         string
  placeholder?: string
  autoComplete?: string
}
function Field({
  label, id, value, onChange, error, type = 'text',
  inputMode, maxLength, min, max, placeholder, autoComplete,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-[450] text-ink-mid mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        inputMode={inputMode}
        maxLength={maxLength}
        min={min}
        max={max}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(
          'w-full h-10 px-3 text-[13.5px] text-ink bg-white border rounded-[10px] outline-none',
          'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors',
          'placeholder:text-ink-soft/60',
          error ? 'border-red-300 focus:ring-red-200' : 'border-beige-200',
        )}
      />
      {error && <p className="text-[11.5px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}

interface BankAccountFieldProps {
  value:    string
  onChange: (v: string) => void
  error?:   string
}
function BankAccountField({ value, onChange, error }: BankAccountFieldProps) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor="bankAccount" className="block text-[12px] font-[450] text-ink-mid mb-1.5">
        Account number
      </label>
      <div className="relative">
        <input
          id="bankAccount"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 17))}
          inputMode="numeric"
          maxLength={17}
          autoComplete="off"
          className={cn(
            'w-full h-10 px-3 pr-10 text-[13.5px] text-ink bg-white border rounded-[10px] outline-none',
            'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors',
            error ? 'border-red-300 focus:ring-red-200' : 'border-beige-200',
          )}
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-soft hover:text-ink transition-colors"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {error && <p className="text-[11.5px] text-red-500 mt-1">{error}</p>}
    </div>
  )
}
