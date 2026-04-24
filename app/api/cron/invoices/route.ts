/**
 * GET /api/cron/invoices — monthly recurring invoice job
 * Runs on the 1st of each month. Creates retainer invoices automatically.
 * Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse }   from 'next/server'
import { createAdminClient }           from '@/lib/supabase/server'
import { generateInvoicePdf }          from '@/lib/pdf/generate'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret     = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin   = createAdminClient()
  const created: string[] = []
  const errors:  string[] = []

  // Find all active retainer clients that have a fee set
  const { data: retainerClients, error: fetchErr } = await admin
    .from('clients')
    .select('id, name, email, firm_id, fee_amount, services')
    .is('archived_at', null)
    .eq('fee_structure', 'retainer')
    .not('fee_amount', 'is', null)

  if (fetchErr || !retainerClients) {
    return NextResponse.json({ error: fetchErr?.message ?? 'Fetch failed' }, { status: 500 })
  }

  const now           = new Date()
  const dueDate       = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const dueDateStr    = dueDate.toISOString().slice(0, 10)

  for (const client of retainerClients) {
    try {
      // Count existing invoices for this firm to generate next number
      const { count } = await admin
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('firm_id', client.firm_id)

      const seq    = (count ?? 0) + 1
      const invNum = `INV-${String(seq).padStart(4, '0')}`

      const { data: invoice, error: insertErr } = await admin
        .from('invoices')
        .insert({
          firm_id:        client.firm_id,
          client_id:      client.id,
          invoice_number: invNum,
          description:    `Monthly retainer — ${now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
          amount:         client.fee_amount,
          status:         'draft',
          due_date:       dueDateStr,
        })
        .select()
        .single()

      if (insertErr || !invoice) {
        errors.push(`Client ${client.id}: ${insertErr?.message ?? 'insert failed'}`)
        continue
      }

      // Generate PDF (best-effort)
      try {
        const { data: firm } = await admin
          .from('firms')
          .select('id, name, address, logo_url')
          .eq('id', client.firm_id)
          .single()

        if (firm) {
          const pdfClient = { ...client, phone: null, entity_type: 'individual' as const }
          const pdfBuffer  = await generateInvoicePdf({ invoice, client: pdfClient, firm })
          const storagePath = `firms/${client.firm_id}/${invNum}.pdf`

          await admin.storage
            .from('invoices')
            .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })

          await admin
            .from('invoices')
            .update({ pdf_url: storagePath })
            .eq('id', invoice.id)
        }
      } catch {
        // PDF is non-fatal
      }

      created.push(invoice.id)
    } catch (err) {
      errors.push(`Client ${client.id}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return NextResponse.json({ ok: true, created: created.length, errors })
}
