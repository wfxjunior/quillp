/**
 * lib/deadlines/scheduler.ts
 *
 * checkDeadlines() — scans all pending deadlines across all firms,
 * sends alert emails at the 30 / 14 / 7 day thresholds, creates
 * Notification records, and flips the alert_sent_* flags.
 *
 * Called by:  POST /api/deadlines/alerts  (cron job target)
 *
 * Email template follows blueprint-part2.md §12.3:
 *   Subject:  "Reminder: [filing_type] due in [N] days — [client_name]"
 *   Body:     Due date, firm name, client name, link to app
 */

import { createAdminClient } from '@/lib/supabase/server'
import { Resend }            from 'resend'
import type { Deadline }     from '@/types'

interface DeadlineWithContext extends Deadline {
  client_name:  string
  client_email: string
  firm_name:    string
  firm_id:      string
}

type AlertThreshold = 30 | 14 | 7
type AlertFlag      = 'alert_sent_30' | 'alert_sent_14' | 'alert_sent_7'

const THRESHOLDS: { days: AlertThreshold; flag: AlertFlag }[] = [
  { days: 30, flag: 'alert_sent_30' },
  { days: 14, flag: 'alert_sent_14' },
  { days:  7, flag: 'alert_sent_7'  },
]

function daysUntil(dueDateIso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateIso)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
}

function buildAlertEmail(opts: {
  clientName:  string
  filingType:  string
  dueDate:     string
  daysLeft:    number
  firmName:    string
  appUrl:      string
}): { subject: string; html: string } {
  const formattedDue = new Date(opts.dueDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const urgency = opts.daysLeft <= 7
    ? '#dc2626'   // red
    : opts.daysLeft <= 14
    ? '#d97706'   // amber
    : '#2563eb'   // blue

  const subject = `Reminder: ${opts.filingType} due in ${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} — ${opts.clientName}`

  const html = `
    <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:40px 24px;color:#1a1a1a;">

      <!-- Logo / firm name -->
      <p style="font-size:13px;color:#999;margin:0 0 24px;">From <strong style="color:#1a1a1a;">${opts.firmName}</strong></p>

      <!-- Heading -->
      <h2 style="font-size:22px;font-weight:600;letter-spacing:-0.3px;margin:0 0 8px;">
        Filing deadline reminder
      </h2>
      <p style="font-size:14px;color:#555;margin:0 0 28px;line-height:1.6;">
        The following filing deadline is approaching for <strong>${opts.clientName}</strong>.
      </p>

      <!-- Deadline card -->
      <div style="background:#fafaf8;border:0.5px solid #e5e0d8;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:4px;">Filing</td>
            <td style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.07em;padding-bottom:4px;text-align:right;">Due</td>
          </tr>
          <tr>
            <td style="font-size:16px;font-weight:600;color:#1a1a1a;">${opts.filingType}</td>
            <td style="font-size:16px;font-weight:600;color:#1a1a1a;text-align:right;">${formattedDue}</td>
          </tr>
        </table>

        <div style="margin-top:16px;padding-top:16px;border-top:0.5px solid #e5e0d8;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;color:#555;">Client: <strong>${opts.clientName}</strong></span>
          <span style="
            display:inline-block;
            background:${urgency}20;
            color:${urgency};
            border:1px solid ${urgency}40;
            border-radius:100px;
            padding:3px 10px;
            font-size:11px;
            font-weight:600;
            letter-spacing:0.04em;
          ">
            ${opts.daysLeft} day${opts.daysLeft !== 1 ? 's' : ''} left
          </span>
        </div>
      </div>

      <!-- CTA -->
      <a href="${opts.appUrl}/deadlines"
         style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:10px;font-size:13.5px;font-weight:500;margin-bottom:28px;">
        View in Quilp →
      </a>

      <hr style="border:none;border-top:0.5px solid #e5e0d8;margin:0 0 20px;" />

      <p style="font-size:12px;color:#aaa;line-height:1.5;margin:0;">
        You're receiving this because ${opts.firmName} uses Quilp to manage client deadlines.
        Log in to <a href="${opts.appUrl}" style="color:#555;">${opts.appUrl}</a> to manage alerts.
      </p>
    </div>
  `

  return { subject, html }
}

export interface CheckDeadlinesResult {
  processed:    number
  alertsSent:   number
  errors:       string[]
}

export async function checkDeadlines(): Promise<CheckDeadlinesResult> {
  const admin  = createAdminClient()
  const resend = new Resend(process.env.RESEND_API_KEY ?? '')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.quilp.com'
  const from   = process.env.RESEND_FROM_EMAIL   ?? 'alerts@example.com'

  const result: CheckDeadlinesResult = { processed: 0, alertsSent: 0, errors: [] }

  // ── Fetch all pending deadlines with client + firm info ──
  const { data: rows, error: fetchErr } = await admin
    .from('deadlines')
    .select(`
      *,
      clients!inner ( name, email, firm_id ),
      firms!inner   ( name )
    `)
    .eq('status', 'pending')

  if (fetchErr || !rows) {
    result.errors.push(`Fetch failed: ${fetchErr?.message ?? 'unknown'}`)
    return result
  }

  const deadlines: DeadlineWithContext[] = rows.map((r: Record<string, unknown>) => {
    const { clients, firms, ...dl } = r
    const c = clients as { name: string; email: string; firm_id: string }
    const f = firms   as { name: string }
    return {
      ...(dl as unknown as Deadline),
      client_name:  c.name,
      client_email: c.email,
      firm_name:    f.name,
      firm_id:      dl.firm_id as string,
    }
  })

  for (const deadline of deadlines) {
    result.processed++
    const daysLeft = daysUntil(deadline.due_date)

    for (const threshold of THRESHOLDS) {
      // Skip if already sent or not yet in range
      if (deadline[threshold.flag]) continue
      if (daysLeft > threshold.days) continue
      // Only fire at exactly the threshold or below (not negative / overdue)
      if (daysLeft < 0) continue

      try {
        // ── Send email alert ──
        const { subject, html } = buildAlertEmail({
          clientName: deadline.client_name,
          filingType: deadline.filing_type,
          dueDate:    deadline.due_date,
          daysLeft,
          firmName:   deadline.firm_name,
          appUrl,
        })

        await resend.emails.send({ from, to: deadline.client_email, subject, html })

        // ── Create Notification record ──
        await admin
          .from('notifications')
          .insert({
            firm_id:   deadline.firm_id,
            client_id: deadline.client_id,
            type:      'deadline_alert',
            title:     `${deadline.filing_type} due in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
            detail:    `Reminder sent to ${deadline.client_email}`,
            read:      false,
          })

        // ── Flip alert flag ──
        await admin
          .from('deadlines')
          .update({ [threshold.flag]: true })
          .eq('id', deadline.id)

        // ── Timeline event ──
        await admin
          .from('timeline_events')
          .insert({
            client_id:  deadline.client_id,
            type:       'reminder_sent',
            title:      `${threshold.days}-day deadline reminder sent`,
            detail:     `${deadline.filing_type} due ${new Date(deadline.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            created_by: null,
          })

        result.alertsSent++
      } catch (err) {
        const msg = `Deadline ${deadline.id} (${threshold.days}d): ${err instanceof Error ? err.message : 'unknown error'}`
        result.errors.push(msg)
        console.error('[checkDeadlines]', msg)
      }
    }
  }

  return result
}
