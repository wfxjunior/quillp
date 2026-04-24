'use client'

/**
 * SignNowRequiredModal
 *
 * Shown when a CPA tries to send a document for e-signature
 * without a SignNow account connected.
 */

import { useEffect, useRef } from 'react'
import { useRouter }         from 'next/navigation'
import { Plug, X }           from 'lucide-react'

interface SignNowRequiredModalProps {
  onClose: () => void
}

export function SignNowRequiredModal({ onClose }: SignNowRequiredModalProps) {
  const router     = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleGoToSettings() {
    onClose()
    router.push('/settings')
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]" />

      <div className="relative z-10 bg-white rounded-[20px] shadow-2xl border border-beige-200 w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[10px] bg-[#1565C0]/10 flex items-center justify-center shrink-0">
              <Plug size={18} strokeWidth={1.75} className="text-[#1565C0]" />
            </div>
            <div>
              <h2 className="text-[15px] font-[600] text-ink leading-tight">SignNow not connected</h2>
              <p className="text-[12px] text-ink-soft font-light mt-0.5">Integration required</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-beige-100 transition-colors text-ink-soft hover:text-ink ml-2 shrink-0"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="text-[13.5px] text-ink-mid font-light leading-relaxed mb-5">
            Connect your SignNow account in Settings to send documents for e-signature. It only takes a minute.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGoToSettings}
              className="flex-1 h-10 bg-ink text-white text-[13.5px] font-[450] rounded-[10px] hover:bg-ink/90 transition-colors"
            >
              Go to Settings
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 border border-beige-200 text-[13.5px] font-[450] text-ink-mid rounded-[10px] hover:bg-beige-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
