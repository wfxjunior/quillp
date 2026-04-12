'use client'

/**
 * Step3Upload — Upload required tax documents.
 *
 * Renders one FileUploadCard per required TaxDocument.
 * Calls POST /api/portal/[token]/upload with multipart/form-data.
 * Each card transitions to "Uploaded ✓" state on success.
 *
 * User may continue once all required docs are uploaded,
 * OR skip any remaining and continue anyway (with a warning).
 */

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Upload, CheckCircle, FileText, AlertCircle, Loader2 } from 'lucide-react'
import type { TaxDocument } from '@/types'

interface Step3UploadProps {
  token:        string
  clientId:     string
  taxDocuments: TaxDocument[]
  uploadedDocs: Record<string, boolean>
  onUploaded:   (docId: string) => void
  onContinue:   () => void
}

export function Step3Upload({
  token, clientId, taxDocuments, uploadedDocs, onUploaded, onContinue,
}: Step3UploadProps) {
  // Docs already uploaded from server (status === 'received') or uploaded this session
  const serverUploaded = new Set(
    taxDocuments.filter(d => d.status === 'received').map(d => d.id)
  )

  const allUploadedCount = taxDocuments.filter(
    d => serverUploaded.has(d.id) || uploadedDocs[d.id]
  ).length

  const allDone = allUploadedCount === taxDocuments.length
  const [showSkipWarning, setShowSkipWarning] = useState(false)

  function handleContinue() {
    if (!allDone && !showSkipWarning) {
      setShowSkipWarning(true)
      return
    }
    onContinue()
  }

  if (taxDocuments.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-serif text-[26px] font-medium text-ink leading-tight mb-1">
            Documents
          </h2>
          <p className="text-[13.5px] text-ink-soft font-light">
            No documents are required at this time.
          </p>
        </div>
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
          Upload documents
        </h2>
        <p className="text-[13.5px] text-ink-soft font-light">
          Please upload the following documents. PDF, JPG, or PNG — max 25 MB each.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-beige-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage-400 rounded-full transition-all duration-500"
            style={{ width: `${taxDocuments.length ? (allUploadedCount / taxDocuments.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[12px] text-ink-soft shrink-0">
          {allUploadedCount} / {taxDocuments.length}
        </span>
      </div>

      {/* Document cards */}
      <div className="space-y-3">
        {taxDocuments.map(doc => {
          const isUploaded = serverUploaded.has(doc.id) || uploadedDocs[doc.id]
          return (
            <FileUploadCard
              key={doc.id}
              doc={doc}
              token={token}
              clientId={clientId}
              uploaded={isUploaded}
              onUploaded={() => onUploaded(doc.id)}
            />
          )
        })}
      </div>

      {/* Skip warning */}
      {showSkipWarning && !allDone && (
        <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-[12px] p-4">
          <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="text-[13px] font-[450] text-amber-800 mb-0.5">
              Some documents are still missing
            </p>
            <p className="text-[12.5px] text-amber-700 font-light">
              Your accountant may follow up to request the remaining documents. You can still continue.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleContinue}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-6 text-[13.5px] font-[450] rounded-[10px] transition-colors',
            allDone
              ? 'bg-ink text-white hover:bg-ink/90'
              : 'bg-ink text-white hover:bg-ink/90',
          )}
        >
          {!allDone && !showSkipWarning ? 'Continue anyway' : 'Continue'}
        </button>
        {allDone && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-sage-600 font-[450]">
            <CheckCircle size={13} strokeWidth={2} />
            All documents uploaded
          </span>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// FileUploadCard
// ─────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

interface FileUploadCardProps {
  doc:       TaxDocument
  token:     string
  clientId:  string
  uploaded:  boolean
  onUploaded: () => void
}

function FileUploadCard({ doc, token, clientId, uploaded, onUploaded }: FileUploadCardProps) {
  const [state,    setState]    = useState<UploadState>(uploaded ? 'done' : 'idle')
  const [fileName, setFileName] = useState<string | null>(doc.file_name)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    // Client-side validation
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) {
      setErrorMsg('Only PDF, JPG, or PNG files are accepted.')
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('File must be under 25 MB.')
      return
    }

    setState('uploading')
    setErrorMsg(null)

    const form = new FormData()
    form.append('file',    file)
    form.append('docId',   doc.id)
    form.append('clientId', clientId)

    try {
      const res = await fetch(`/api/portal/${token}/upload`, {
        method: 'POST',
        body:   form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Upload failed (${res.status})`)
      }
      setState('done')
      setFileName(file.name)
      onUploaded()
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so same file can be re-selected after error
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className={cn(
      'border rounded-[12px] overflow-hidden transition-colors',
      state === 'done'  ? 'border-sage-200 bg-sage-50/50' :
      state === 'error' ? 'border-red-200 bg-red-50/30'   :
                          'border-beige-200 bg-white',
    )}>
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        {/* Left: icon + name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0',
            state === 'done' ? 'bg-sage-100' : 'bg-beige-100',
          )}>
            {state === 'done' ? (
              <CheckCircle size={16} className="text-sage-600" strokeWidth={2} />
            ) : (
              <FileText size={16} className="text-ink-soft" strokeWidth={1.75} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-[500] text-ink truncate">{doc.document_type}</p>
            {state === 'done' && fileName && (
              <p className="text-[12px] text-sage-600 font-light truncate">{fileName}</p>
            )}
            {state === 'error' && errorMsg && (
              <p className="text-[12px] text-red-500 font-light">{errorMsg}</p>
            )}
          </div>
        </div>

        {/* Right: action */}
        <div className="shrink-0">
          {state === 'done' ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-[12px] text-ink-soft hover:text-ink transition-colors font-light"
            >
              Replace
            </button>
          ) : state === 'uploading' ? (
            <Loader2 size={16} className="text-ink-soft animate-spin" />
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3.5 text-[12.5px] font-[450] rounded-[8px]',
                'border border-beige-300 bg-white text-ink-mid hover:text-ink hover:border-beige-400 transition-colors',
              )}
            >
              <Upload size={12} strokeWidth={1.75} />
              {state === 'error' ? 'Try again' : 'Upload'}
            </button>
          )}
        </div>
      </div>

      {/* Drag-and-drop zone (idle/error only) */}
      {(state === 'idle' || state === 'error') && (
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          className="mx-4 mb-3 border border-dashed border-beige-200 rounded-[8px] py-3 text-center cursor-pointer hover:bg-beige-50 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <p className="text-[12px] text-ink-soft font-light">
            or drag & drop here
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleChange}
        className="hidden"
        aria-label={`Upload ${doc.document_type}`}
      />
    </div>
  )
}
