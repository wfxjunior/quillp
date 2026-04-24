/**
 * lib/signnow/send-envelope.ts
 *
 * Upload a document to SignNow and send it for signature.
 *
 * Flow:
 *   1. Convert HTML → PDF (via lib/pdf/generate)
 *   2. Upload PDF to SignNow  POST /document  → document_id
 *   3. Send invite            POST /document/{id}/invite  → invite sent
 *   4. Update Document record in Supabase (status, signnow_document_id)
 */

import { getValidToken, API_BASE }  from './client'
import { generatePDF }              from '@/lib/pdf/generate'
import { createAdminClient }        from '@/lib/supabase/server'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface SendEnvelopeParams {
  documentId:    string   // Supabase Document.id
  firmId:        string
  documentHtml:  string
  clientName:    string
  clientEmail:   string
  cpaEmail:      string   // sender email (must match authenticated SignNow user)
  documentTitle: string
  firmName:      string
}

export interface SendEnvelopeResult {
  signnowDocumentId: string
}

// ─────────────────────────────────────────
// Main function
// ─────────────────────────────────────────

export async function sendEnvelope(params: SendEnvelopeParams): Promise<SendEnvelopeResult> {
  const {
    documentId,
    firmId,
    documentHtml,
    clientEmail,
    cpaEmail,
    documentTitle,
    firmName,
  } = params

  // ── Get valid access token ──
  const token = await getValidToken(firmId)

  // ── Generate PDF from HTML ──
  const pdfBuffer = await generatePDF(documentHtml)

  // ── Upload PDF to SignNow ──
  const formData = new FormData()
  formData.append(
    'file',
    new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }),
    `${documentTitle}.pdf`,
  )

  const uploadRes = await fetch(`${API_BASE}/document`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${token.access_token}` },
    body:    formData,
  })

  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    throw new Error(`SignNow document upload failed: ${uploadRes.status} — ${body}`)
  }

  const { id: signnowDocumentId } = await uploadRes.json() as { id: string }

  // ── Send signature invite ──
  const subject = `${firmName} — Please sign: ${documentTitle}`
  const message = `${firmName} has sent you a document to review and sign. Please open the link in your email to complete your signature.`

  const inviteRes = await fetch(`${API_BASE}/document/${signnowDocumentId}/invite`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${token.access_token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    cpaEmail,
      subject,
      message,
      to: [
        {
          email:               clientEmail,
          role:                'Signer 1',
          order:               1,
          authentication_type: 'none',
          reminder:            4,
          expiration_days:     30,
          subject,
          message,
        },
      ],
    }),
  })

  if (!inviteRes.ok) {
    const body = await inviteRes.text()
    throw new Error(`SignNow invite failed: ${inviteRes.status} — ${body}`)
  }

  // ── Update Document record in Supabase ──
  const supabase = createAdminClient()
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      status:              'awaiting_signature',
      signnow_document_id: signnowDocumentId,
    })
    .eq('id', documentId)

  if (updateError) {
    // Non-fatal — invite was sent successfully
    console.error('[send-envelope] Failed to update Document record:', updateError.message)
  }

  return { signnowDocumentId }
}
