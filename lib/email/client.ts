/**
 * lib/email/client.ts
 *
 * Resend email client.
 * Requires RESEND_API_KEY and RESEND_FROM_EMAIL env vars.
 *
 * RESEND_FROM_EMAIL must be a verified domain address, e.g.:
 *   invoices@yourdomain.com
 */

import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY is not configured')
    _resend = new Resend(key)
  }
  return _resend
}

export interface SendInvoiceEmailOptions {
  to:            string
  clientName:    string
  firmName:      string
  invoiceNumber: string
  amount:        number
  dueDate:       string    // ISO date string
  pdfBuffer:     Buffer
  notes?:        string | null
}

export async function sendInvoiceEmail(opts: SendInvoiceEmailOptions): Promise<void> {
  const resend = getResend()
  const from   = process.env.RESEND_FROM_EMAIL ?? 'invoices@example.com'

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(opts.amount)

  const formattedDue = new Date(opts.dueDate).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
      <h2 style="font-size:20px;font-weight:600;margin:0 0 8px;">${opts.invoiceNumber} from ${opts.firmName}</h2>
      <p style="color:#555;font-size:14px;margin:0 0 24px;line-height:1.6;">
        Hi ${opts.clientName}, please find your invoice attached.
      </p>

      <div style="background:#fafaf8;border:0.5px solid #e5e0d8;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:4px;">Invoice</td>
            <td style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:4px;text-align:right;">Amount Due</td>
          </tr>
          <tr>
            <td style="font-size:15px;font-weight:600;color:#1a1a1a;">${opts.invoiceNumber}</td>
            <td style="font-size:20px;font-weight:700;color:#1a1a1a;text-align:right;">${formattedAmount}</td>
          </tr>
          <tr>
            <td style="font-size:12.5px;color:#666;padding-top:8px;">Due ${formattedDue}</td>
          </tr>
        </table>
      </div>

      ${opts.notes ? `<p style="font-size:13.5px;color:#555;margin-bottom:24px;line-height:1.6;">${opts.notes}</p>` : ''}

      <p style="font-size:12.5px;color:#999;margin-top:32px;border-top:0.5px solid #e5e0d8;padding-top:16px;">
        Please contact <strong>${opts.firmName}</strong> if you have any questions about this invoice.
      </p>
    </div>
  `

  await resend.emails.send({
    from,
    to:      opts.to,
    subject: `Invoice ${opts.invoiceNumber} from ${opts.firmName} — ${formattedAmount} due ${formattedDue}`,
    html,
    attachments: [
      {
        filename: `${opts.invoiceNumber}.pdf`,
        content:  opts.pdfBuffer,
      },
    ],
  })
}
