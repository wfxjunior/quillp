/**
 * sendEnvelope — create and send a DocuSign envelope from an HTML document
 *
 * DocuSign natively accepts HTML documents (fileExtension: 'html') and converts
 * them to PDF server-side. This is the recommended approach for serverless/edge
 * environments where running a headless browser (Puppeteer) is impractical.
 *
 * Signature placement: the function injects a `/sn1/` anchor tag at the bottom
 * of the document if one isn't already present. DocuSign's "anchor tab" feature
 * finds that text string in the rendered document and places the signature widget there.
 */

import { getValidToken, apiBasePath } from './client'
import { createAdminClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface SendEnvelopeParams {
  documentId:    string   // Supabase Document.id — record is updated on success
  firmId:        string
  documentHtml:  string
  clientName:    string
  clientEmail:   string
  documentTitle: string
  firmName:      string
}

export interface SendEnvelopeResult {
  envelopeId: string
}

// ─────────────────────────────────────────
// Signature anchor injection
// ─────────────────────────────────────────

const SIGNATURE_BLOCK_HTML = `
<div class="signature-block" style="margin-top:48px; padding-top:24px; border-top:1px solid #999;">
  <p style="font-family:Georgia,serif; font-size:13px; margin-bottom:8px;">
    By signing below, both parties agree to the terms set forth in this engagement letter.
  </p>
  <p style="font-size:13px; margin-bottom:4px;"><strong>${'{clientName}'}</strong></p>
  <p style="font-size:12px; color:#555; margin-bottom:24px;">Client</p>
  <p style="font-size:12px;">/sn1/</p>
  <p style="font-size:11px; color:#777;">Signature &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; /ds1/ Date</p>
</div>`

function injectSignatureAnchor(html: string, clientName: string): string {
  // If anchor already present (e.g. GPT-4o added it), don't double-inject
  if (html.includes('/sn1/')) return html

  const block = SIGNATURE_BLOCK_HTML.replace('{clientName}', clientName)

  // Prefer injecting before the closing </div> of .document-body
  if (html.includes('</div>')) {
    const lastClose = html.lastIndexOf('</div>')
    return html.slice(0, lastClose) + block + html.slice(lastClose)
  }

  // Fallback: append
  return html + block
}

// ─────────────────────────────────────────
// Main function
// ─────────────────────────────────────────

export async function sendEnvelope(params: SendEnvelopeParams): Promise<SendEnvelopeResult> {
  const {
    documentId,
    firmId,
    documentHtml,
    clientName,
    clientEmail,
    documentTitle,
    firmName,
  } = params

  // ── Get valid access token for this firm ──
  const token   = await getValidToken(firmId)
  const basePath = apiBasePath(token)

  // ── Prepare HTML document ──
  const htmlWithSig = injectSignatureAnchor(documentHtml, clientName)

  // Wrap in a full HTML document for DocuSign rendering
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; font-size: 14px; line-height: 1.7; color: #1a1a1a; margin: 48px 64px; }
  .document-body p { margin-bottom: 1em; }
  .document-body table { width: 100%; border-collapse: collapse; margin: 1em 0; }
  .document-body th, .document-body td { border: 1px solid #d4d0c8; padding: 8px 10px; font-size: 13px; }
  .document-body th { background: #f5f5f2; font-weight: 600; text-align: left; }
  .signature-block { margin-top: 48px; padding-top: 24px; border-top: 1px solid #999; }
</style>
</head>
<body>${htmlWithSig}</body>
</html>`

  const documentBase64 = Buffer.from(fullHtml, 'utf8').toString('base64')

  // ── Build envelope definition ──
  const envelopeDefinition = {
    emailSubject: `${firmName} — Please sign: ${documentTitle}`,
    emailBlurb:   `${firmName} has sent you an engagement letter to review and sign. Please open the link below to complete your signature.`,
    documents: [
      {
        documentBase64,
        name:          documentTitle,
        fileExtension: 'html',
        documentId:    '1',
      },
    ],
    recipients: {
      signers: [
        {
          email:       clientEmail,
          name:        clientName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [
              {
                anchorString:  '/sn1/',
                anchorXOffset: '0',
                anchorYOffset: '0',
                anchorUnits:   'pixels',
                scaleValue:    '1',
              },
            ],
            dateSignedTabs: [
              {
                anchorString:  '/ds1/',
                anchorXOffset: '50',
                anchorYOffset: '0',
                anchorUnits:   'pixels',
              },
            ],
          },
        },
      ],
    },
    status: 'sent',  // 'sent' sends immediately; use 'created' for draft
  }

  // ── POST to DocuSign Envelopes API ──
  const res = await fetch(
    `${basePath}/v2.1/accounts/${token.account_id}/envelopes`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token.access_token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(envelopeDefinition),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DocuSign envelope creation failed: ${res.status} — ${body}`)
  }

  const result = await res.json() as { envelopeId: string }
  const envelopeId = result.envelopeId

  // ── Update Document record in Supabase ──
  const supabase = createAdminClient()
  const { error: updateError } = await supabase
    .from('documents')
    .update({
      status:                'awaiting_signature',
      docusign_envelope_id:  envelopeId,
    })
    .eq('id', documentId)

  if (updateError) {
    // Log but don't throw — envelope was sent successfully
    console.error('[send-envelope] Failed to update Document record:', updateError.message)
  }

  return { envelopeId }
}
