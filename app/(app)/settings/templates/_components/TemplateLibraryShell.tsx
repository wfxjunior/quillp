'use client'

/**
 * TemplateLibraryShell — lists all FirmTemplates with inline HTML editor.
 *
 * Clicking "Edit" on a template opens an inline editor panel with:
 *   - A contenteditable div showing the template HTML
 *   - "Save changes" → PATCH /api/firms/[id]/templates/[templateId]
 *     (computes diff_from_default as changed sections)
 */

import { useState, useRef, useCallback } from 'react'
import { Pencil, Save, X, Loader2, FileText } from 'lucide-react'
import { useToast } from '@/components/ui/NotificationToast'
import { cn } from '@/lib/utils'
import type { FirmTemplate, DocumentType } from '@/types'

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  engagement_letter: 'Engagement Letter',
  proposal:          'Proposal',
  form_2848:         'Form 2848',
  invoice:           'Invoice',
  checklist:         'Checklist',
  onboarding_portal: 'Onboarding Portal',
  delivery_summary:  'Delivery Summary',
}

interface TemplateLibraryShellProps {
  firmId:    string
  userRole:  string
  templates: FirmTemplate[]
}

export function TemplateLibraryShell({ firmId, userRole, templates }: TemplateLibraryShellProps) {
  const { show: toast }       = useToast()
  const [editing, setEditing] = useState<string | null>(null)          // templateId
  const [localTemplates, setLocalTemplates] = useState<FirmTemplate[]>(templates)

  const isOwner = userRole === 'owner'

  if (templates.length === 0) {
    return (
      <div className="px-6 py-6 max-w-[860px] mx-auto">
        <PageHeader />
        <div className="text-center py-16 text-[13.5px] text-ink-soft font-light">
          No templates yet. Generate documents for clients to create firm templates.
        </div>
      </div>
    )
  }

  function handleSaved(templateId: string, html: string) {
    setLocalTemplates(prev =>
      prev.map(t => t.id === templateId ? { ...t, content_html: html, updated_at: new Date().toISOString() } : t)
    )
    setEditing(null)
    toast({ variant: 'success', message: 'Template saved.' })
  }

  return (
    <div className="px-6 py-6 max-w-[860px] mx-auto space-y-3">
      <PageHeader />

      <p className="text-[13px] text-ink-soft font-light mb-5">
        {localTemplates.length} template{localTemplates.length !== 1 ? 's' : ''} ·{' '}
        Edits here become the default for future document generation.
      </p>

      {localTemplates.map(template => (
        <div key={template.id}>
          <TemplateCard
            template={template}
            isEditing={editing === template.id}
            isOwner={isOwner}
            onEdit={() => setEditing(template.id)}
            onCancel={() => setEditing(null)}
            onSaved={html => handleSaved(template.id, html)}
            firmId={firmId}
          />
        </div>
      ))}
    </div>
  )
}

function PageHeader() {
  return (
    <div className="mb-6">
      <h1 className="font-serif text-[32px] font-medium text-ink tracking-[-0.5px] leading-tight">
        Template Library
      </h1>
      <p className="text-[13.5px] text-ink-soft font-light mt-1">
        Customize the default content for each document type.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────
// Template card + editor
// ─────────────────────────────────────────

interface TemplateCardProps {
  template:  FirmTemplate
  isEditing: boolean
  isOwner:   boolean
  firmId:    string
  onEdit:    () => void
  onCancel:  () => void
  onSaved:   (html: string) => void
}

function TemplateCard({ template, isEditing, isOwner, firmId, onEdit, onCancel, onSaved }: TemplateCardProps) {
  const { show: toast } = useToast()
  const editorRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)

  const typeLabel    = DOC_TYPE_LABELS[template.document_type] ?? template.document_type
  const updatedLabel = new Date(template.updated_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  // Compute a simple diff: record what the user changed vs the original
  function computeDiff(originalHtml: string, newHtml: string) {
    if (originalHtml === newHtml) return null
    // Simple paragraph-level diff — record which <p> blocks changed
    const oldParas = originalHtml.split('</p>').filter(s => s.includes('<p'))
    const newParas = newHtml.split('</p>').filter(s => s.includes('<p'))

    const diffs: { field: string; original: string; modified: string }[] = []
    const maxLen = Math.max(oldParas.length, newParas.length)

    for (let i = 0; i < maxLen; i++) {
      const orig = oldParas[i] ?? ''
      const next = newParas[i] ?? ''
      if (orig !== next) {
        diffs.push({
          field:    `paragraph_${i + 1}`,
          original: orig.replace(/<[^>]+>/g, '').trim().slice(0, 120),
          modified: next.replace(/<[^>]+>/g, '').trim().slice(0, 120),
        })
      }
    }

    return diffs.length > 0 ? diffs : null
  }

  const handleSave = useCallback(async () => {
    const el = editorRef.current
    if (!el) return
    const newHtml = el.innerHTML

    setSaving(true)
    try {
      const diff = computeDiff(template.content_html, newHtml)
      const res = await fetch(`/api/firms/${firmId}/templates/${template.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content_html: newHtml, diff_from_default: diff }),
      })
      if (!res.ok) throw new Error('Save failed')
      onSaved(newHtml)
    } catch {
      toast({ variant: 'error', message: 'Could not save template.' })
    } finally {
      setSaving(false)
    }
  }, [firmId, template, onSaved, toast])

  return (
    <div className={cn(
      'bg-white border-[0.5px] rounded-[16px] shadow-card overflow-hidden transition-colors',
      isEditing ? 'border-ink/20' : 'border-beige-200',
    )}>
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-beige-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-[8px] bg-beige-100 flex items-center justify-center shrink-0">
            <FileText size={14} strokeWidth={1.75} className="text-ink-soft" />
          </div>
          <div className="min-w-0">
            <p className="text-[13.5px] font-[500] text-ink truncate">{typeLabel}</p>
            <p className="text-[11.5px] text-ink-soft font-light mt-0.5">
              {template.service_type} · Updated {updatedLabel}
              {(template.diff_from_default?.length ?? 0) > 0 && (
                <span className="ml-2 text-sage-600">· Customized</span>
              )}
            </p>
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-[450] rounded-[7px] border border-beige-200 bg-white text-ink-mid hover:text-ink transition-colors"
                >
                  <X size={12} strokeWidth={2} /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-[450] rounded-[7px] border border-sage-200 bg-sage-50 text-sage-700 hover:bg-sage-100 transition-colors disabled:opacity-60"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} strokeWidth={2} />}
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1 h-7 px-2.5 text-[11.5px] font-[450] rounded-[7px] border border-beige-200 bg-white text-ink-mid hover:text-ink hover:border-beige-300 transition-colors"
              >
                <Pencil size={11} strokeWidth={1.75} /> Edit
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editor / Preview */}
      {isEditing ? (
        <div className="p-5">
          <p className="text-[11.5px] text-ink-soft font-light mb-3">
            Edit the template content below. Changes apply to future document generation for this firm.
          </p>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: template.content_html }}
            className={cn(
              'min-h-[300px] max-h-[560px] overflow-y-auto',
              'border border-beige-200 rounded-[10px] p-4',
              'text-[13px] text-ink leading-relaxed outline-none',
              'focus:border-ink/30 focus:ring-1 focus:ring-ink/10 transition-colors',
              '[&_p]:mb-3 [&_h1]:font-serif [&_h1]:text-xl [&_h1]:mb-3',
              '[&_h2]:font-semibold [&_h2]:text-base [&_h2]:mb-2',
              '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3',
              '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3',
            )}
          />
          <p className="text-[11px] text-ink-soft font-light mt-2">
            Tip: Use <code className="bg-beige-100 px-1 rounded">{'{{client_name}}'}</code>,{' '}
            <code className="bg-beige-100 px-1 rounded">{'{{firm_name}}'}</code>,{' '}
            <code className="bg-beige-100 px-1 rounded">{'{{fee_amount}}'}</code> as placeholders.
          </p>
        </div>
      ) : (
        <div
          className={cn(
            'px-5 py-4 text-[12.5px] text-ink-mid leading-relaxed line-clamp-3 font-light',
            '[&_p]:inline [&_h1]:inline [&_h2]:inline',
          )}
          dangerouslySetInnerHTML={{
            __html: template.content_html.replace(/<[^>]+>/g, ' ').trim().slice(0, 240) + '…',
          }}
        />
      )}
    </div>
  )
}
