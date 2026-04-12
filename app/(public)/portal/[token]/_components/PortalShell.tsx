'use client'

/**
 * PortalShell — client component that coordinates the 4-step portal flow.
 *
 * Steps:
 *   1. Sign  — Engagement letter / DocuSign  (skipped if no letter)
 *   2. Info  — Personal information form
 *   3. Upload — Required tax documents
 *   4. Review — Summary + submit
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Step1Sign }   from './Step1Sign'
import { Step2Info }   from './Step2Info'
import { Step3Upload } from './Step3Upload'
import { Step4Review } from './Step4Review'
import type { Client, Document, TaxDocument, Firm } from '@/types'

interface PortalShellProps {
  token:            string
  client:           Client
  firm:             Pick<Firm, 'id' | 'name' | 'logo_url' | 'primary_state'>
  engagementLetter: Document | null
  taxDocuments:     TaxDocument[]
}

type StepId = 1 | 2 | 3 | 4

interface PortalData {
  // Step 2 — personal info
  firstName:       string
  lastName:        string
  dob:             string
  ssnLast4:        string
  street:          string
  city:            string
  state:           string
  zip:             string
  filingStatus:    string
  dependents:      string
  bankRouting:     string
  bankAccount:     string
}

const EMPTY_DATA: PortalData = {
  firstName: '', lastName: '', dob: '', ssnLast4: '',
  street: '', city: '', state: '', zip: '',
  filingStatus: '', dependents: '0',
  bankRouting: '', bankAccount: '',
}

export function PortalShell({
  token, client, firm, engagementLetter, taxDocuments,
}: PortalShellProps) {
  const hasLetter = !!engagementLetter

  // Determine visible steps (skip Step 1 if no engagement letter)
  const steps: { id: StepId; label: string }[] = useMemo(() => {
    const base: { id: StepId; label: string }[] = [
      { id: 2, label: 'Your Info'  },
      { id: 3, label: 'Documents'  },
      { id: 4, label: 'Review'     },
    ]
    if (hasLetter) base.unshift({ id: 1, label: 'Sign'  })
    return base
  }, [hasLetter])

  const [currentStep, setCurrentStep] = useState<StepId>(steps[0].id)
  const [portalData, setPortalData]   = useState<PortalData>(EMPTY_DATA)
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, boolean>>({})

  function advance() {
    const idx = steps.findIndex(s => s.id === currentStep)
    if (idx < steps.length - 1) setCurrentStep(steps[idx + 1].id)
  }

  const stepIndex = steps.findIndex(s => s.id === currentStep)

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* ── Header ── */}
      <header className="bg-white border-b border-beige-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {firm.logo_url ? (
              <img src={firm.logo_url} alt={firm.name} className="h-8 w-auto" />
            ) : (
              <div className="h-8 w-8 rounded-lg bg-sage-100 flex items-center justify-center">
                <span className="text-[13px] font-semibold text-sage-700">
                  {firm.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-[14px] font-[500] text-ink">{firm.name}</span>
          </div>
          <span className="text-[12px] text-ink-soft font-light">
            Client Portal
          </span>
        </div>
      </header>

      {/* ── Progress bar ── */}
      <div className="bg-white border-b border-beige-100 px-6 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-0">
            {steps.map((step, i) => {
              const done    = i < stepIndex
              const active  = i === stepIndex
              const isLast  = i === steps.length - 1
              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <div className="flex items-center gap-2 shrink-0">
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors',
                      done   ? 'bg-sage-500 text-white'    :
                      active ? 'bg-ink text-white'         :
                               'bg-beige-100 text-ink-soft',
                    )}>
                      {done ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    <span className={cn(
                      'text-[12px] font-[450] hidden sm:block',
                      active ? 'text-ink' : done ? 'text-sage-600' : 'text-ink-soft',
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={cn(
                      'flex-1 h-[1px] mx-3 transition-colors',
                      done ? 'bg-sage-300' : 'bg-beige-200',
                    )} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Step content ── */}
      <main className="max-w-2xl mx-auto px-6 py-8">
        {currentStep === 1 && engagementLetter && (
          <Step1Sign
            token={token}
            letter={engagementLetter}
            firmName={firm.name}
            onContinue={advance}
          />
        )}
        {currentStep === 2 && (
          <Step2Info
            data={portalData}
            onChange={patch => setPortalData(prev => ({ ...prev, ...patch }))}
            onContinue={advance}
          />
        )}
        {currentStep === 3 && (
          <Step3Upload
            token={token}
            clientId={client.id}
            taxDocuments={taxDocuments}
            uploadedDocs={uploadedDocs}
            onUploaded={docId => setUploadedDocs(prev => ({ ...prev, [docId]: true }))}
            onContinue={advance}
          />
        )}
        {currentStep === 4 && (
          <Step4Review
            token={token}
            client={client}
            firmName={firm.name}
            portalData={portalData}
            taxDocuments={taxDocuments}
            uploadedDocs={uploadedDocs}
          />
        )}
      </main>
    </div>
  )
}
