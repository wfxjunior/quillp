/**
 * POST /api/deadlines/alerts
 *
 * Cron job target. Runs checkDeadlines() and returns a summary.
 *
 * Secured by CRON_SECRET header to prevent unauthorized execution.
 * Set CRON_SECRET in env vars and configure your cron provider
 * (Vercel Cron Jobs, GitHub Actions, EasyCron, etc.) to send:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Vercel cron config (vercel.json):
 *   {
 *     "crons": [{ "path": "/api/deadlines/alerts", "schedule": "0 8 * * *" }]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkDeadlines }            from '@/lib/deadlines/scheduler'

export async function POST(request: NextRequest) {
  // ── Verify cron secret ──
  const authHeader = request.headers.get('authorization')
  const secret     = process.env.CRON_SECRET

  if (!secret || !authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkDeadlines()

    console.log('[deadline alerts]', result)

    return NextResponse.json({
      ok:         true,
      processed:  result.processed,
      alertsSent: result.alertsSent,
      errors:     result.errors,
    })
  } catch (err) {
    console.error('[deadline alerts] Fatal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
