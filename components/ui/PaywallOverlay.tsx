'use client'

/**
 * PaywallOverlay — §13.11
 *
 * Full-screen overlay shown when the firm's trial has expired
 * and there is no active subscription.
 *
 * Only dismissible by navigating to /settings/billing.
 * Data is NOT deleted — 30-day grace period before any deletion.
 */

import { useRouter } from 'next/navigation'
import { Lock }      from 'lucide-react'

interface PaywallOverlayProps {
  firmName:      string
  trialEndsAt:   string | null   // ISO date string
  daysRemaining: number | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function PaywallOverlay({ firmName, trialEndsAt }: PaywallOverlayProps) {
  const router = useRouter()

  const expiredDate = trialEndsAt ? formatDate(trialEndsAt) : null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-beige-50/95 backdrop-blur-sm">
      <div className="bg-white border border-beige-200 rounded-[24px] shadow-2xl w-full max-w-md mx-4 p-8 text-center">
        {/* Icon */}
        <div className="h-16 w-16 rounded-full bg-ink/5 flex items-center justify-center mx-auto mb-5">
          <Lock size={26} strokeWidth={1.5} className="text-ink" />
        </div>

        {/* Heading */}
        <h1 className="font-serif text-[26px] font-medium text-ink tracking-[-0.5px] mb-2">
          Your trial has ended
        </h1>

        <p className="text-[14px] text-ink-soft font-light leading-relaxed mb-1">
          {expiredDate
            ? `Your 30-day free trial for ${firmName} ended on ${expiredDate}.`
            : `Your free trial for ${firmName} has ended.`}
        </p>
        <p className="text-[13.5px] text-ink-soft font-light leading-relaxed mb-7">
          Upgrade to continue using Quilp. Your data is safe and will remain for 30 days.
        </p>

        {/* Plans teaser */}
        <div className="grid grid-cols-3 gap-3 mb-7 text-left">
          {[
            { name: 'Solo',         price: '$49',  desc: '1 user · unlimited clients' },
            { name: 'Small Firm',   price: '$99',  desc: 'Up to 3 users'             },
            { name: 'Growing Firm', price: '$179', desc: 'Unlimited users'            },
          ].map(plan => (
            <div key={plan.name} className="bg-beige-50 border border-beige-200 rounded-[12px] p-3">
              <p className="text-[12px] font-[500] text-ink mb-0.5">{plan.name}</p>
              <p className="text-[18px] font-bold text-ink leading-none mb-1">{plan.price}<span className="text-[11px] font-normal text-ink-soft">/mo</span></p>
              <p className="text-[11px] text-ink-soft font-light">{plan.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => router.push('/settings/billing')}
          className="w-full h-11 bg-ink text-white text-[14px] font-[500] rounded-[12px] hover:bg-ink/90 transition-colors"
        >
          Upgrade now
        </button>

        <p className="text-[11.5px] text-ink-soft font-light mt-3">
          Questions? Email{' '}
          <a href="mailto:support@quilp.com" className="underline hover:text-ink transition-colors">
            support@quilp.com
          </a>
        </p>
      </div>
    </div>
  )
}
