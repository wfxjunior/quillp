'use client'

/**
 * Step1Sign — Show the engagement letter and handle SignNow signing.
 *
 * If the letter has a signnow_document_id:
 *   - Show "Check your email for the SignNow signing link"
 *   - Poll GET /api/portal/[token] every 5s for status === 'signed'
 *   - Also offer a manual "I've signed it" button that triggers one poll
 *
 * If no document (draft/sent state):
 *   - Show the letter HTML preview
 *   - "I've reviewed this letter" → proceed directly (signing is external)
 */

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle, Mail, RefreshCw } from 'lucide-react'
import type { Document } from '@/types'

interface Step1SignProps {
  token:      string
  letter:     Document
  firmName:   string
  onContinue: () => void
}

export function Step1Sign({ token, letter, firmName, onContinue }: Step1SignProps) {
  const hasEnvelope  = !!letter.signnow_document_id
  const alreadySigned = letter.status === 'signed'

  const [signed,   setSigned]   = useState(alreadySigned)
  const [checking, setChecking] = useState(false)
  const [polled,   setPolled]   = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-poll every 5s when there's an envelope and not yet signed
  useEffect(() => {
    if (!hasEnvelope || signed) return

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/portal/${token}`)
      if (!res.ok) return
      const data = await res.json() as { letterStatus?: string }
      if (data.letterStatus === 'signed') {
        setSigned(true)
        if (pollRef.current) clearInterval(pollRef.current)
      }
    }, 5000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [hasEnvelope, signed, token])

  async function handleCheckNow() {
    setChecking(true)
    try {
      const res = await fetch(`/api/portal/${token}`)
      if (res.ok) {
        const data = await res.json() as { letterStatus?: string }
        if (data.letterStatus === 'signed') {
          setSigned(true)
          if (pollRef.current) clearInterval(pollRef.current)
        }
      }
    } finally {
      setChecking(false)
      setPolled(true)
    }
  }

  if (signed) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-sage-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={24} className="text-sage-600" strokeWidth={1.75} />
        </div>
        <h2 className="font-serif text-[22px] font-medium text-ink mb-2">
          Letter signed
        </h2>
        <p className="text-[13.5px] text-ink-soft font-light mb-6">
          Your engagement letter has been signed. Let&apos;s continue.
        </p>
        <button
          onClick={onContinue}
          className="inline-flex items-center gap-2 h-10 px-6 bg-ink text-white text-[13.5px] font-[450] rounded-[10px] hover:bg-ink/90 transition-colors"
        >
          Continue
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-[26px] font-medium text-ink leading-tight mb-1">
          Engagement Letter
        </h2>
        <p className="text-[13.5px] text-ink-soft font-light">
          Please review and sign the engagement letter from {firmName}.
        </p>
      </div>

      {/* Letter preview */}
      {letter.content_html && (
        <div className="bg-white border border-beige-200 rounded-[14px] overflow-hidden shadow-sm">
          <div className="bg-beige-50 border-b border-beige-100 px-4 py-2.5 flex items-center justify-between">
            <span className="text-[12px] font-[450] text-ink-mid">
              {letter.title}
            </span>
            <span className="text-[11px] text-ink-soft">
              {new Date(letter.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <iframe
            srcDoc={`<html><head><style>
              * { box-sizing: border-box; margin: 0; }
              body { font-family: Georgia, serif; font-size: 14px; line-height: 1.7; color: #1a1a1a; padding: 28px 32px; }
              p { margin-bottom: 12px; }
              h1, h2, h3 { font-family: Georgia, serif; margin-bottom: 12px; }
            </style></head><body>${letter.content_html}</body></html>`}
            className="w-full h-[340px]"
            title="Engagement Letter"
            sandbox="allow-same-origin"
          />
        </div>
      )}

      {/* SignNow signing instructions */}
      {hasEnvelope ? (
        <div className="bg-blue-50 border border-blue-100 rounded-[12px] p-4">
          <div className="flex gap-3">
            <Mail size={17} className="text-blue-500 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="text-[13.5px] font-[500] text-blue-800 mb-0.5">
                Signing link sent to your email
              </p>
              <p className="text-[12.5px] text-blue-600 font-light">
                Check your inbox for an email from SignNow. Click the link to review and sign the letter. Once signed, this page will update automatically.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {hasEnvelope ? (
          <>
            <button
              onClick={handleCheckNow}
              disabled={checking}
              className={cn(
                'inline-flex items-center gap-2 h-10 px-5 text-[13px] font-[450] rounded-[10px] border border-beige-300',
                'bg-white text-ink hover:border-beige-400 transition-colors',
                checking && 'opacity-60 cursor-not-allowed',
              )}
            >
              <RefreshCw size={13} className={checking ? 'animate-spin' : ''} strokeWidth={1.75} />
              {checking ? 'Checking…' : "I've signed it"}
            </button>
            {polled && !signed && (
              <p className="text-[12px] text-ink-soft">
                Not signed yet — the SignNow page may take a moment to update.
              </p>
            )}
          </>
        ) : (
          // No envelope — letter is in draft/sent, allow proceeding after review
          <button
            onClick={onContinue}
            className="inline-flex items-center gap-2 h-10 px-6 bg-ink text-white text-[13.5px] font-[450] rounded-[10px] hover:bg-ink/90 transition-colors"
          >
            I&apos;ve reviewed this letter — Continue
          </button>
        )}
      </div>
    </div>
  )
}
