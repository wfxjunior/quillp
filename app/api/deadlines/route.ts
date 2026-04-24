/**
 * GET /api/deadlines — upcoming deadlines for the firm
 * Query params: ?days_ahead=90&client_id=
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', user.id)
    .single()

  if (!userRow?.firm_id) return NextResponse.json({ error: 'Firm not found' }, { status: 404 })

  const firmId           = userRow.firm_id as string
  const { searchParams } = new URL(request.url)
  const daysAhead        = parseInt(searchParams.get('days_ahead') ?? '90', 10)
  const clientId         = searchParams.get('client_id')

  const today   = new Date()
  const cutoff  = new Date(today)
  cutoff.setDate(cutoff.getDate() + daysAhead)

  let query = supabase
    .from('deadlines')
    .select('*, clients(name, email)')
    .eq('firm_id', firmId)
    .eq('status', 'pending')
    .gte('due_date', today.toISOString().slice(0, 10))
    .lte('due_date', cutoff.toISOString().slice(0, 10))
    .order('due_date')

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
