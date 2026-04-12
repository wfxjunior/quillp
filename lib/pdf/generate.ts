/**
 * lib/pdf/generate.ts
 *
 * Generates invoice PDFs using Puppeteer.
 *
 * NOTE: For Vercel/serverless deployment, swap puppeteer for
 * @sparticuz/chromium + puppeteer-core. The HTML template and
 * generateInvoicePdf() signature remain identical.
 */

import puppeteer from 'puppeteer'
import type { Invoice, Client, Firm } from '@/types'

interface InvoicePdfData {
  invoice: Invoice
  client:  Pick<Client, 'name' | 'email' | 'phone' | 'entity_type'>
  firm:    Pick<Firm, 'name' | 'address' | 'logo_url'>
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function buildInvoiceHtml({ invoice, client, firm }: InvoicePdfData): string {
  const firmAddr = firm.address
    ? `${firm.address.street}<br>${firm.address.city}, ${firm.address.state} ${firm.address.zip}`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
      padding: 56px 64px;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 48px;
    }
    .firm-name {
      font-size: 22px;
      font-weight: 700;
      color: #111;
      letter-spacing: -0.3px;
    }
    .firm-address {
      margin-top: 6px;
      font-size: 12px;
      color: #666;
      line-height: 1.6;
    }
    .invoice-label {
      text-align: right;
    }
    .invoice-label .word {
      font-size: 28px;
      font-weight: 300;
      color: #999;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .invoice-number {
      font-size: 13px;
      color: #555;
      margin-top: 4px;
    }

    /* Divider */
    .divider {
      border: none;
      border-top: 0.5px solid #e5e0d8;
      margin: 0 0 32px;
    }

    /* Bill to / details grid */
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 24px;
      margin-bottom: 40px;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #999;
      margin-bottom: 6px;
    }
    .meta-value {
      font-size: 13px;
      color: #1a1a1a;
      line-height: 1.5;
    }

    /* Line items table */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 32px;
    }
    thead th {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #999;
      padding: 0 0 10px;
      border-bottom: 0.5px solid #e5e0d8;
      text-align: left;
    }
    thead th:last-child { text-align: right; }

    tbody td {
      padding: 14px 0;
      font-size: 13px;
      color: #1a1a1a;
      border-bottom: 0.5px solid #f0ece5;
      vertical-align: top;
    }
    tbody td:last-child {
      text-align: right;
      font-weight: 600;
      white-space: nowrap;
    }

    /* Totals */
    .totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      margin-bottom: 40px;
    }
    .totals-row {
      display: flex;
      gap: 40px;
      font-size: 13px;
    }
    .totals-row .t-label { color: #666; }
    .totals-row .t-value { font-weight: 600; min-width: 90px; text-align: right; }
    .totals-row.total .t-label { font-weight: 700; font-size: 14px; color: #111; }
    .totals-row.total .t-value { font-size: 18px; font-weight: 700; color: #111; }

    /* Notes */
    .notes-section {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 0.5px solid #e5e0d8;
    }
    .notes-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #999;
      margin-bottom: 8px;
    }
    .notes-body {
      font-size: 12.5px;
      color: #555;
      line-height: 1.6;
    }

    /* Footer */
    .footer {
      margin-top: 60px;
      text-align: center;
      font-size: 11px;
      color: #bbb;
    }

    /* Status badge */
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 100px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .status-paid    { background: #dcf0e4; color: #166534; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .status-sent    { background: #fef3c7; color: #92400e; }
    .status-draft   { background: #f3f4f6; color: #6b7280; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="firm-name">${firm.name}</div>
      ${firmAddr ? `<div class="firm-address">${firmAddr}</div>` : ''}
    </div>
    <div class="invoice-label">
      <div class="word">Invoice</div>
      <div class="invoice-number">${invoice.invoice_number}</div>
      <div style="margin-top:8px;">
        <span class="status-badge status-${invoice.status}">${invoice.status}</span>
      </div>
    </div>
  </div>

  <hr class="divider" />

  <!-- Bill to / dates / amount -->
  <div class="meta-grid">
    <div>
      <div class="meta-label">Bill To</div>
      <div class="meta-value">
        <strong>${client.name}</strong><br>
        ${client.email}<br>
        ${client.phone ?? ''}
      </div>
    </div>
    <div>
      <div class="meta-label">Issue Date</div>
      <div class="meta-value">${formatDate(invoice.created_at)}</div>
      <div class="meta-label" style="margin-top:16px;">Due Date</div>
      <div class="meta-value">${formatDate(invoice.due_date)}</div>
    </div>
    <div style="text-align:right;">
      <div class="meta-label">Amount Due</div>
      <div class="meta-value" style="font-size:22px;font-weight:700;color:#111;letter-spacing:-0.5px;">
        ${formatCurrency(invoice.amount)}
      </div>
    </div>
  </div>

  <!-- Line items -->
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${invoice.description}</td>
        <td>${formatCurrency(invoice.amount)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-row total">
      <span class="t-label">Total Due</span>
      <span class="t-value">${formatCurrency(invoice.amount)}</span>
    </div>
    ${invoice.status === 'paid' && invoice.paid_at ? `
    <div class="totals-row" style="color:#166534;">
      <span class="t-label">Paid ${formatDate(invoice.paid_at)}</span>
      <span class="t-value" style="color:#166534;">${formatCurrency(invoice.amount)}</span>
    </div>` : ''}
  </div>

  ${invoice.status !== 'paid' ? `
  <div style="background:#fafaf8;border:0.5px solid #e5e0d8;border-radius:10px;padding:16px 20px;font-size:12.5px;color:#555;line-height:1.6;">
    <strong style="color:#1a1a1a;">Payment instructions:</strong><br>
    Please remit payment by <strong>${formatDate(invoice.due_date)}</strong>.
    Contact <strong>${firm.name}</strong> for payment options.
  </div>` : ''}

  ${invoice.status !== 'paid' && (invoice as Invoice & { notes?: string | null }).notes ? `
  <div class="notes-section">
    <div class="notes-label">Notes</div>
    <div class="notes-body">${(invoice as Invoice & { notes?: string | null }).notes}</div>
  </div>` : ''}

  <div class="footer">
    Generated by Quilp · ${firm.name}
  </div>

</body>
</html>`
}

/**
 * Render invoice HTML to a PDF Buffer using Puppeteer.
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  })

  try {
    const page = await browser.newPage()
    const html = buildInvoiceHtml(data)

    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdf = await page.pdf({
      format:             'Letter',
      printBackground:    true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

/** Build the invoice HTML string (for email attachment or preview). */
export { buildInvoiceHtml }
