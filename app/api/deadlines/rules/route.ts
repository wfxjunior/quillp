/**
 * GET /api/deadlines/rules — static deadline rules from lib (not DB)
 */
import { NextResponse }      from 'next/server'
import { DEADLINE_RULES }    from '@/lib/deadlines/rules'

export async function GET() {
  return NextResponse.json({ data: DEADLINE_RULES })
}
