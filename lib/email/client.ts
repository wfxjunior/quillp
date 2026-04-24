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
  paymentLink?:  string | null
}

export interface SendPortalConfirmationEmailOptions {
  to:         string
  clientName: string
  firmName:   string
}

export async function sendPortalConfirmationEmail(opts: SendPortalConfirmationEmailOptions): Promise<void> {
  const resend = getResend()
  const from   = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">

      <p style="font-size:13px;color:#999;margin:0 0 24px;">From <strong style="color:#1a1a1a;">${opts.firmName}</strong></p>

      <h2 style="font-size:22px;font-weight:600;letter-spacing:-0.3px;margin:0 0 8px;">
        We received your information
      </h2>
      <p style="font-size:14px;color:#555;margin:0 0 28px;line-height:1.6;">
        Hi ${opts.clientName}, thank you for completing your onboarding. Your tax professional at
        <strong>${opts.firmName}</strong> has been notified and will be in touch soon.
      </p>

      <div style="background:#fafaf8;border:0.5px solid #e5e0d8;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
        <p style="font-size:13px;font-weight:600;color:#1a1a1a;margin:0 0 6px;">What happens next?</p>
        <ul style="font-size:13.5px;color:#555;margin:0;padding-left:18px;line-height:2;">
          <li>Your CPA will review the information you provided</li>
          <li>They may reach out if any additional documents are needed</li>
          <li>You'll receive a final confirmation once your filing is complete</li>
        </ul>
      </div>

      <hr style="border:none;border-top:0.5px solid #e5e0d8;margin:0 0 20px;" />

      <p style="font-size:12px;color:#aaa;line-height:1.5;margin:0;">
        Questions? Reply to this email or contact <strong>${opts.firmName}</strong> directly.
      </p>
    </div>
  `

  await resend.emails.send({
    from,
    to:      opts.to,
    subject: `We received your information — ${opts.firmName}`,
    html,
  })
}

export interface SendPortalInviteEmailOptions {
  to:         string
  clientName: string
  firmName:   string
  portalUrl:  string
}

export async function sendPortalInviteEmail(opts: SendPortalInviteEmailOptions): Promise<void> {
  const resend = getResend()
  const from   = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">

      <p style="font-size:13px;color:#999;margin:0 0 24px;">From <strong style="color:#1a1a1a;">${opts.firmName}</strong></p>

      <h2 style="font-size:22px;font-weight:600;letter-spacing:-0.3px;margin:0 0 8px;">
        You've been invited to complete your onboarding
      </h2>
      <p style="font-size:14px;color:#555;margin:0 0 28px;line-height:1.6;">
        Hi ${opts.clientName}, your tax professional at <strong>${opts.firmName}</strong> has set up a secure client portal for you.
        Please click the button below to complete your onboarding — it only takes a few minutes.
      </p>

      <a href="${opts.portalUrl}"
         style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:500;margin-bottom:28px;">
        Complete My Onboarding →
      </a>

      <div style="background:#fafaf8;border:0.5px solid #e5e0d8;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
        <p style="font-size:12px;color:#999;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.06em;">Your secure portal link</p>
        <p style="font-size:13px;color:#555;margin:0;word-break:break-all;">${opts.portalUrl}</p>
      </div>

      <hr style="border:none;border-top:0.5px solid #e5e0d8;margin:0 0 20px;" />

      <p style="font-size:12px;color:#aaa;line-height:1.5;margin:0;">
        This link is unique to you and should not be shared. If you have any questions, contact <strong>${opts.firmName}</strong> directly.
      </p>
    </div>
  `

  await resend.emails.send({
    from,
    to:      opts.to,
    subject: `Action required: Complete your onboarding with ${opts.firmName}`,
    html,
  })
}

export interface SendFirmAlertEmailOptions {
  to:      string
  subject: string
  title:   string
  body:    string
  ctaLabel?: string
  ctaUrl?:   string
}

export async function sendFirmAlertEmail(opts: SendFirmAlertEmailOptions): Promise<void> {
  const resend = getResend()
  const from   = process.env.RESEND_FROM_EMAIL ?? 'noreply@example.com'

  const cta = opts.ctaLabel && opts.ctaUrl
    ? `<a href="${opts.ctaUrl}"
         style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;
                padding:11px 22px;border-radius:9px;font-size:13.5px;font-weight:500;margin-top:20px;">
         ${opts.ctaLabel}
       </a>`
    : ''

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:540px;margin:0 auto;padding:36px 24px;color:#1a1a1a;">
      <p style="font-size:12px;color:#aaa;margin:0 0 20px;text-transform:uppercase;letter-spacing:0.06em;">Quilp</p>
      <h2 style="font-size:20px;font-weight:600;letter-spacing:-0.3px;margin:0 0 10px;">${opts.title}</h2>
      <p style="font-size:14px;color:#555;line-height:1.65;margin:0 0 4px;">${opts.body}</p>
      ${cta}
      <hr style="border:none;border-top:0.5px solid #e5e0d8;margin:28px 0 16px;" />
      <p style="font-size:11.5px;color:#bbb;margin:0;">You are receiving this because you are the owner of this firm in Quilp.</p>
    </div>
  `

  await resend.emails.send({ from, to: opts.to, subject: opts.subject, html })
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

      ${opts.paymentLink ? `
      <div style="margin-bottom:24px;">
        <a href="${opts.paymentLink}"
           style="display:inline-block;background:#1a1a1a;color:#fff;font-size:13.5px;font-weight:600;
                  padding:12px 28px;border-radius:9px;text-decoration:none;letter-spacing:-0.2px;">
          Pay Online
        </a>
        <p style="font-size:11.5px;color:#aaa;margin:8px 0 0;">
          Secure payment powered by Stripe
        </p>
      </div>` : ''}

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
