'use client'

/**
 * SettingsShell — client component for the settings page.
 *
 * Sections:
 *   1. Firm Profile — name, CPA name, address, email, phone, logo
 *   2. Integrations — DocuSign connect/disconnect
 *   3. Notifications — toggles per alert type
 */

import { useState, useRef, useEffect, useTransition } from 'react'
import { CheckCircle, XCircle, ExternalLink, Plug, Upload, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/NotificationToast'
import { cn } from '@/lib/utils'
import type { FirmAddress } from '@/types'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

interface NotificationPrefs {
  deadline_alerts:  boolean
  document_signed:  boolean
  portal_submitted: boolean
  invoice_overdue:  boolean
}

interface SettingsShellProps {
  firmId:             string
  firmName:           string
  firmAddress:        FirmAddress | null
  firmLogoUrl:        string | null
  userRole:           string
  cpaName:            string
  userEmail:          string
  docuSignConnected:  boolean
  docuSignAccountId:  string | null
  oauthSuccess:       boolean
  oauthError:         string | null
  notificationPrefs:  NotificationPrefs
}

export function SettingsShell({
  firmId,
  firmName,
  firmAddress,
  firmLogoUrl,
  userRole,
  cpaName,
  userEmail,
  docuSignConnected,
  docuSignAccountId,
  oauthSuccess,
  oauthError,
  notificationPrefs: initialPrefs,
}: SettingsShellProps) {
  const { show: toast } = useToast()
  const isOwner = userRole === 'owner'

  // ── Profile form state ──
  const [name,     setName]     = useState(firmName)
  const [cpa,      setCpa]      = useState(cpaName)
  const [email,    setEmail]    = useState(userEmail)
  const [street,   setStreet]   = useState(firmAddress?.street  ?? '')
  const [city,     setCity]     = useState(firmAddress?.city    ?? '')
  const [state,    setState_]   = useState(firmAddress?.state   ?? '')
  const [zip,      setZip]      = useState(firmAddress?.zip     ?? '')
  const [logoUrl,  setLogoUrl]  = useState<string | null>(firmLogoUrl)
  const [saving,   setSaving]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Notification prefs ──
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs)
  const [savingPrefs, startPrefTransition] = useTransition()

  // ── OAuth toasts ──
  useEffect(() => {
    if (oauthSuccess) toast({ variant: 'success', message: 'DocuSign connected successfully!' })
    if (oauthError)   toast({ variant: 'error',   message: `DocuSign error: ${decodeURIComponent(oauthError)}` })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!isOwner) return
    setSaving(true)
    try {
      const res = await fetch(`/api/firms/${firmId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          cpaName: cpa,
          address: { street, city, state, zip },
          logo_url: logoUrl,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast({ variant: 'success', message: 'Settings saved.' })
    } catch {
      toast({ variant: 'error', message: 'Could not save settings.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoUpload(file: File) {
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/firms/${firmId}/logo`, { method: 'POST', body: form })
      if (!res.ok) throw new Error('Upload failed')
      const { logo_url } = await res.json() as { logo_url: string }
      setLogoUrl(logo_url)
      toast({ variant: 'success', message: 'Logo updated.' })
    } catch {
      toast({ variant: 'error', message: 'Logo upload failed.' })
    }
  }

  async function savePrefs(next: NotificationPrefs) {
    startPrefTransition(async () => {
      try {
        const res = await fetch(`/api/firms/${firmId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ notification_prefs: next }),
        })
        if (!res.ok) throw new Error()
        toast({ variant: 'success', message: 'Notification preferences saved.' })
      } catch {
        toast({ variant: 'error', message: 'Could not save preferences.' })
      }
    })
  }

  function togglePref(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    savePrefs(next)
  }

  return (
    <div className="px-6 py-6 max-w-[860px] mx-auto space-y-10">
      {/* Page heading */}
      <div>
        <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
          Settings
        </h1>
        <p className="text-[13.5px] text-ink-soft font-light mt-1">
          Manage your firm profile, integrations, and preferences.
        </p>
      </div>

      {/* ════════════════════════════════════
          1. FIRM PROFILE
          ════════════════════════════════════ */}
      <section>
        <SectionHeader>Firm Profile</SectionHeader>
        <form
          onSubmit={handleSaveProfile}
          className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card p-6 space-y-5"
        >
          {/* Logo */}
          <div>
            <label className="block text-[12px] font-[450] text-ink-mid mb-2">Firm logo</label>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-[10px] border border-beige-200 bg-beige-50 flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[18px] font-bold text-ink-soft">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!isOwner}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-[450] rounded-[8px]',
                    'border border-beige-300 bg-white text-ink-mid hover:text-ink hover:border-beige-400 transition-colors',
                    !isOwner && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Upload size={12} strokeWidth={1.75} />
                  Upload logo
                </button>
                <p className="text-[11.5px] text-ink-soft font-light mt-1">JPG, PNG or WebP · max 5 MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleLogoUpload(f)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Firm name + CPA name */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Firm name" htmlFor="firm-name">
              <input
                id="firm-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!isOwner}
                className={inputCls(!isOwner)}
              />
            </FormField>
            <FormField label="Your name (CPA)" htmlFor="cpa-name">
              <input
                id="cpa-name"
                type="text"
                value={cpa}
                onChange={e => setCpa(e.target.value)}
                disabled={!isOwner}
                className={inputCls(!isOwner)}
              />
            </FormField>
          </div>

          {/* Email */}
          <FormField label="Email" htmlFor="firm-email">
            <input
              id="firm-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={!isOwner}
              className={inputCls(!isOwner)}
            />
          </FormField>

          {/* Address */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-soft mb-2.5">
              Office Address
            </p>
            <div className="space-y-3">
              <FormField label="Street" htmlFor="street">
                <input
                  id="street"
                  type="text"
                  value={street}
                  onChange={e => setStreet(e.target.value)}
                  disabled={!isOwner}
                  className={inputCls(!isOwner)}
                  autoComplete="street-address"
                />
              </FormField>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="City" htmlFor="city">
                  <input
                    id="city"
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    disabled={!isOwner}
                    className={inputCls(!isOwner)}
                  />
                </FormField>
                <FormField label="State" htmlFor="state">
                  <select
                    id="state"
                    value={state}
                    onChange={e => setState_(e.target.value)}
                    disabled={!isOwner}
                    className={inputCls(!isOwner)}
                  >
                    <option value="">—</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="ZIP" htmlFor="zip">
                  <input
                    id="zip"
                    type="text"
                    value={zip}
                    onChange={e => setZip(e.target.value)}
                    disabled={!isOwner}
                    className={inputCls(!isOwner)}
                    maxLength={10}
                  />
                </FormField>
              </div>
            </div>
          </div>

          {/* Save button */}
          {isOwner && (
            <div className="pt-1 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 h-9 px-5 bg-ink text-white text-[13px] font-[450] rounded-[9px] hover:bg-ink/90 transition-colors disabled:opacity-60"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* ════════════════════════════════════
          2. INTEGRATIONS — DocuSign
          ════════════════════════════════════ */}
      <section>
        <SectionHeader>Integrations</SectionHeader>
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden divide-y divide-beige-100">

          {/* DocuSign row */}
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={cn(
                'h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0',
                docuSignConnected ? 'bg-[#F05A28]/10' : 'bg-beige-100',
              )}>
                <Plug size={17} strokeWidth={1.75} className={docuSignConnected ? 'text-[#F05A28]' : 'text-ink-soft'} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-[500] text-ink">DocuSign</p>
                  {docuSignConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-[450] text-sage-600 bg-sage-50 border border-sage-200 rounded-full px-2 py-0.5">
                      <CheckCircle size={10} strokeWidth={2.5} /> Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-[450] text-ink-soft bg-beige-100 border border-beige-200 rounded-full px-2 py-0.5">
                      <XCircle size={10} strokeWidth={2} /> Not connected
                    </span>
                  )}
                </div>
                <p className="text-[12px] text-ink-soft font-light mt-0.5">
                  {docuSignConnected
                    ? `Account ${docuSignAccountId ?? '—'} · Send documents for e-signature`
                    : 'Send engagement letters and documents for e-signature via DocuSign'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {docuSignConnected ? (
                <>
                  <a
                    href="https://app.docusign.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-[450] border-[0.5px] border-beige-300 rounded-[8px] bg-white text-ink-mid hover:text-ink hover:border-beige-400 transition-colors"
                  >
                    <ExternalLink size={12} strokeWidth={1.75} /> Open DocuSign
                  </a>
                  {isOwner && <DisconnectButton />}
                </>
              ) : (
                isOwner ? (
                  <a
                    href="/api/auth/docusign"
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-[450] bg-[#F05A28] text-white rounded-[8px] hover:bg-[#d14a1e] transition-colors"
                  >
                    <Plug size={13} strokeWidth={2} /> Connect DocuSign
                  </a>
                ) : (
                  <p className="text-[12px] text-ink-soft italic">Ask your firm owner to connect DocuSign.</p>
                )
              )}
            </div>
          </div>

          {/* Stripe placeholder */}
          <div className="px-5 py-4 flex items-center justify-between gap-4 opacity-50">
            <div className="flex items-center gap-3.5">
              <div className="h-9 w-9 rounded-[8px] bg-beige-100 flex items-center justify-center shrink-0">
                <span className="text-[13px] font-bold text-ink-soft">S</span>
              </div>
              <div>
                <p className="text-[13.5px] font-[500] text-ink">Stripe</p>
                <p className="text-[12px] text-ink-soft font-light mt-0.5">Accept invoice payments online — coming soon</p>
              </div>
            </div>
            <span className="text-[11.5px] text-ink-soft border-[0.5px] border-beige-200 rounded-full px-2.5 py-1">Coming soon</span>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          3. NOTIFICATION PREFERENCES
          ════════════════════════════════════ */}
      <section>
        <SectionHeader>Notification Preferences</SectionHeader>
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden divide-y divide-beige-100">
          {([
            { key: 'deadline_alerts',  label: 'Deadline alerts',                desc: 'Email reminders at 30, 14, and 7 days before filing deadlines' },
            { key: 'document_signed',  label: 'Document signed',                desc: 'Notify when a client signs an engagement letter via DocuSign' },
            { key: 'portal_submitted', label: 'Portal submitted',               desc: 'Notify when a client completes the onboarding portal' },
            { key: 'invoice_overdue',  label: 'Invoice overdue',                desc: 'Notify when an invoice passes its due date unpaid' },
          ] as { key: keyof NotificationPrefs; label: string; desc: string }[]).map(item => (
            <div key={item.key} className="px-5 py-3.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13.5px] font-[500] text-ink">{item.label}</p>
                <p className="text-[12px] text-ink-soft font-light mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                enabled={prefs[item.key]}
                onChange={() => togglePref(item.key)}
                disabled={!isOwner || savingPrefs}
              />
            </div>
          ))}
        </div>
        {!isOwner && (
          <p className="text-[12px] text-ink-soft font-light mt-2">
            Only the firm owner can change notification preferences.
          </p>
        )}
      </section>
    </div>
  )
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft mb-3">
      {children}
    </h2>
  )
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-[12px] font-[450] text-ink-mid mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

function inputCls(disabled: boolean) {
  return cn(
    'w-full h-10 px-3 text-[13.5px] text-ink bg-white border border-beige-200 rounded-[10px] outline-none',
    'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors',
    disabled && 'opacity-60 cursor-not-allowed bg-beige-50',
  )
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-[22px] w-[40px] shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
        enabled ? 'bg-ink' : 'bg-beige-300',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out',
          enabled ? 'translate-x-[18px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}

function DisconnectButton() {
  async function handleDisconnect() {
    if (!confirm('Disconnect DocuSign? Documents already sent will not be affected.')) return
    await fetch('/api/auth/docusign/disconnect', { method: 'POST' })
    window.location.reload()
  }
  return (
    <button
      type="button"
      onClick={handleDisconnect}
      className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-[450] border-[0.5px] border-red-200 rounded-[8px] bg-white text-red-500 hover:text-red-600 hover:border-red-300 transition-colors"
    >
      Disconnect
    </button>
  )
}
