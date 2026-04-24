'use client'

/**
 * SettingsShell — client component for the settings page.
 *
 * Sections:
 *   1. Firm Profile — name, CPA name, address, email, phone, logo
 *   2. Integrations — SignNow connect/disconnect
 *   3. Notifications — toggles per alert type
 */

import { useState, useRef, useEffect, useTransition } from 'react'
import { CheckCircle, XCircle, ExternalLink, Plug, Upload, Loader2, UserPlus, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/NotificationToast'
import { cn } from '@/lib/utils'
import type { FirmAddress, UserRole } from '@/types'

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

interface TeamMember {
  id:            string
  name:          string
  email:         string
  role:          UserRole
  created_at:    string
  last_login_at: string | null
}

interface SettingsShellProps {
  firmId:              string
  firmName:            string
  firmAddress:         FirmAddress | null
  firmLogoUrl:         string | null
  userRole:            string
  userId:              string
  cpaName:             string
  userEmail:           string
  signNowConnected:    boolean
  signNowEmail:        string | null
  stripeConnected:     boolean
  stripeAccountId:     string | null
  oauthSuccess:        boolean
  oauthError:          string | null
  stripeOauthSuccess:  boolean
  stripeOauthError:    string | null
  notificationPrefs:   NotificationPrefs
  initialTeam:         TeamMember[]
}

export function SettingsShell({
  firmId,
  firmName,
  firmAddress,
  firmLogoUrl,
  userRole,
  userId,
  cpaName,
  userEmail,
  signNowConnected,
  signNowEmail,
  stripeConnected,
  stripeAccountId,
  oauthSuccess,
  oauthError,
  stripeOauthSuccess,
  stripeOauthError,
  notificationPrefs: initialPrefs,
  initialTeam,
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

  // ── Team management ──
  const [team,         setTeam]         = useState<TeamMember[]>(initialTeam)
  const [showInvite,   setShowInvite]   = useState(false)
  const [inviteName,   setInviteName]   = useState('')
  const [inviteEmail,  setInviteEmail]  = useState('')
  const [inviteRole,   setInviteRole]   = useState<'staff' | 'admin'>('staff')
  const [inviting,     setInviting]     = useState(false)
  const [removingId,   setRemovingId]   = useState<string | null>(null)

  // ── OAuth toasts ──
  useEffect(() => {
    if (oauthSuccess)       toast({ variant: 'success', message: 'SignNow connected successfully!' })
    if (oauthError)         toast({ variant: 'error',   message: `SignNow error: ${decodeURIComponent(oauthError)}` })
    if (stripeOauthSuccess) toast({ variant: 'success', message: 'Stripe connected successfully!' })
    if (stripeOauthError)   toast({ variant: 'error',   message: `Stripe error: ${decodeURIComponent(stripeOauthError)}` })
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

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteName.trim() || !inviteEmail.trim()) return
    setInviting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { toast({ variant: 'error', message: json.error ?? 'Invite failed.' }); return }
      toast({ variant: 'success', message: `Invite sent to ${inviteEmail}.` })
      setInviteName(''); setInviteEmail(''); setInviteRole('staff'); setShowInvite(false)
    } finally {
      setInviting(false)
    }
  }

  async function handleChangeRole(memberId: string, role: 'staff' | 'admin') {
    const res = await fetch(`/api/team/${memberId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ role }),
    })
    if (!res.ok) { toast({ variant: 'error', message: 'Failed to update role.' }); return }
    setTeam(t => t.map(m => m.id === memberId ? { ...m, role } : m))
    toast({ variant: 'success', message: 'Role updated.' })
  }

  async function handleRemoveMember(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the firm? This cannot be undone.`)) return
    setRemovingId(memberId)
    try {
      const res = await fetch(`/api/team/${memberId}`, { method: 'DELETE' })
      if (!res.ok) { toast({ variant: 'error', message: 'Failed to remove member.' }); return }
      setTeam(t => t.filter(m => m.id !== memberId))
      toast({ variant: 'success', message: `${memberName} removed.` })
    } finally {
      setRemovingId(null)
    }
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
                  // eslint-disable-next-line @next/next/no-img-element
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
          2. INTEGRATIONS — SignNow
          ════════════════════════════════════ */}
      <section>
        <SectionHeader>Integrations</SectionHeader>
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden divide-y divide-beige-100">

          {/* SignNow row */}
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={cn(
                'h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0',
                signNowConnected ? 'bg-[#1565C0]/10' : 'bg-beige-100',
              )}>
                <Plug size={17} strokeWidth={1.75} className={signNowConnected ? 'text-[#1565C0]' : 'text-ink-soft'} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-[500] text-ink">SignNow</p>
                  {signNowConnected ? (
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
                  {signNowConnected
                    ? `${signNowEmail ?? '—'} · Send documents for e-signature`
                    : 'Send engagement letters and documents for e-signature via SignNow'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {signNowConnected ? (
                <>
                  <a
                    href="https://app.signnow.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-[450] border-[0.5px] border-beige-300 rounded-[8px] bg-white text-ink-mid hover:text-ink hover:border-beige-400 transition-colors"
                  >
                    <ExternalLink size={12} strokeWidth={1.75} /> Open SignNow
                  </a>
                  {isOwner && <DisconnectButton />}
                </>
              ) : (
                isOwner ? (
                  <a
                    href="/api/auth/signnow"
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-[450] bg-[#1565C0] text-white rounded-[8px] hover:bg-[#0d47a1] transition-colors"
                  >
                    <Plug size={13} strokeWidth={2} /> Connect SignNow
                  </a>
                ) : (
                  <p className="text-[12px] text-ink-soft italic">Ask your firm owner to connect SignNow.</p>
                )
              )}
            </div>
          </div>

          {/* Stripe row */}
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={cn(
                'h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0',
                stripeConnected ? 'bg-[#635BFF]/10' : 'bg-beige-100',
              )}>
                <span className={cn(
                  'text-[13px] font-bold',
                  stripeConnected ? 'text-[#635BFF]' : 'text-ink-soft',
                )}>
                  S
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13.5px] font-[500] text-ink">Stripe</p>
                  {stripeConnected ? (
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
                  {stripeConnected
                    ? `${stripeAccountId ?? '—'} · Accept invoice payments online`
                    : 'Connect Stripe to accept invoice payments from clients'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {stripeConnected ? (
                <>
                  <a
                    href="https://dashboard.stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-[450] border-[0.5px] border-beige-300 rounded-[8px] bg-white text-ink-mid hover:text-ink hover:border-beige-400 transition-colors"
                  >
                    <ExternalLink size={12} strokeWidth={1.75} /> Stripe Dashboard
                  </a>
                  {isOwner && <StripeDisconnectButton />}
                </>
              ) : (
                isOwner ? (
                  <a
                    href="/api/auth/stripe"
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-[450] bg-[#635BFF] text-white rounded-[8px] hover:bg-[#5147d8] transition-colors"
                  >
                    <Plug size={13} strokeWidth={2} /> Connect Stripe
                  </a>
                ) : (
                  <p className="text-[12px] text-ink-soft italic">Ask your firm owner to connect Stripe.</p>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════
          3. TEAM
          ════════════════════════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionHeader>Team</SectionHeader>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowInvite(v => !v)}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-[450] border border-beige-300 rounded-[8px] bg-white text-ink-mid hover:text-ink hover:border-beige-400 transition-colors"
            >
              <UserPlus size={12} strokeWidth={1.75} />
              Invite member
            </button>
          )}
        </div>

        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden">

          {/* Invite form */}
          {showInvite && isOwner && (
            <form
              onSubmit={handleInvite}
              className="px-5 py-4 border-b border-beige-100 bg-beige-50/60 flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[11px] font-[500] text-ink-mid mb-1">Full name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className={teamInputCls}
                />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-[11px] font-[500] text-ink-mid mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                  className={teamInputCls}
                />
              </div>
              <div>
                <label className="block text-[11px] font-[500] text-ink-mid mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as 'staff' | 'admin')}
                  className={teamInputCls}
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center gap-1.5 h-9 px-4 bg-ink text-white text-[12.5px] font-[450] rounded-[8px] hover:bg-ink/90 transition-colors disabled:opacity-60"
                >
                  {inviting ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} strokeWidth={2} />}
                  {inviting ? 'Sending…' : 'Send invite'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="h-9 px-3 text-[12.5px] text-ink-soft hover:text-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Member list */}
          <div className="divide-y divide-beige-100">
            {team.map(member => (
              <div key={member.id} className="px-5 py-3.5 flex items-center gap-3">
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-beige-200 flex items-center justify-center shrink-0">
                  <span className="text-[12px] font-semibold text-ink-mid">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-[500] text-ink truncate">{member.name}</p>
                    {member.id === userId && (
                      <span className="text-[10.5px] text-ink-soft bg-beige-100 border border-beige-200 rounded-full px-1.5 py-0.5">You</span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-ink-soft font-light truncate">{member.email}</p>
                </div>

                {/* Role — editable by owner for non-self non-owner members */}
                {isOwner && member.id !== userId && member.role !== 'owner' ? (
                  <select
                    value={member.role}
                    onChange={e => handleChangeRole(member.id, e.target.value as 'staff' | 'admin')}
                    className="h-7 px-2 text-[12px] font-[450] text-ink-mid border border-beige-200 rounded-[7px] outline-none focus:ring-1 focus:ring-ink/20 bg-white transition-colors"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className={cn(
                    'inline-flex items-center text-[11px] font-[450] px-2 py-1 rounded-full border',
                    member.role === 'owner' ? 'bg-ink text-white border-ink' :
                    member.role === 'admin' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                              'bg-beige-100 text-ink-mid border-beige-200',
                  )}>
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </span>
                )}

                {/* Remove button */}
                {isOwner && member.id !== userId && member.role !== 'owner' && (
                  <button
                    type="button"
                    disabled={removingId === member.id}
                    onClick={() => handleRemoveMember(member.id, member.name)}
                    title="Remove member"
                    className="shrink-0 p-1.5 text-ink-soft hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {removingId === member.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} strokeWidth={1.75} />
                    }
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
        {!isOwner && (
          <p className="text-[12px] text-ink-soft font-light mt-2">
            Contact your firm owner to manage team members.
          </p>
        )}
      </section>

      {/* ════════════════════════════════════
          4. NOTIFICATION PREFERENCES
          ════════════════════════════════════ */}
      <section>
        <SectionHeader>Notification Preferences</SectionHeader>
        <div className="bg-white border-[0.5px] border-beige-200 rounded-[16px] shadow-card overflow-hidden divide-y divide-beige-100">
          {([
            { key: 'deadline_alerts',  label: 'Deadline alerts',                desc: 'Email reminders at 30, 14, and 7 days before filing deadlines' },
            { key: 'document_signed',  label: 'Document signed',                desc: 'Notify when a client signs an engagement letter via SignNow' },
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
    if (!confirm('Disconnect SignNow? Documents already sent will not be affected.')) return
    await fetch('/api/auth/signnow/disconnect', { method: 'POST' })
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

const teamInputCls = cn(
  'h-9 px-2.5 text-[12.5px] text-ink bg-white border border-beige-200 rounded-[8px] outline-none',
  'focus:ring-1 focus:ring-ink/20 focus:border-ink/30 transition-colors w-full',
)

function StripeDisconnectButton() {
  async function handleDisconnect() {
    if (!confirm('Disconnect Stripe? Existing payment links will stop working.')) return
    await fetch('/api/auth/stripe/disconnect', { method: 'POST' })
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
