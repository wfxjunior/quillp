'use client'

/**
 * DocuSignRequiredModal — §13.8
 *
 * Shown when a CPA tries to send a document for e-signature
 * without a DocuSign account connected.
 * Provides a "Go to Settings" button and a dismiss option.
 */

import { useEffect, useRef } from 'react'
import { useRouter }         from 'next/navigation'
import { Plug, X }           from 'lucide-react'

interface DocuSignRequiredModalProps {
  onClose: () => void
}

export function DocuSignRequiredModal({ onClose }: DocuSignRequiredModalProps) {
  const router    = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]" />

      {/* Modal card */}
      <div className="relative z-10 bg-white rounded-[20px] shadow-2xl border border-beige-200 w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-[10px] bg-[#F05A28]/10 flex items-center justify-center shrink-0">
              <Plug size={18} strokeWidth={1.75} className="text-[#F05A28]" />
            </div>
            <div>
              <h2 className="text-[15px] font-[600] text-ink leading-tight">DocuSign not connected</h2>
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
            Connect your DocuSign account in Settings to send documents for e-signature. It only takes a minute.
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
