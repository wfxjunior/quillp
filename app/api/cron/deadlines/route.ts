/**
 * GET /api/cron/deadlines — daily deadline alert job
 * Protected by CRON_SECRET. Called daily at 06:00 UTC by Vercel Cron.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkDeadlines }            from '@/lib/deadlines/scheduler'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const secret     = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkDeadlines()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/deadlines]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
