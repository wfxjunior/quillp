/**
 * GET /api/documents — list documents for the firm with optional filters
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
  const clientId         = searchParams.get('client_id')
  const type             = searchParams.get('type')
  const status           = searchParams.get('status')

  let query = supabase
    .from('documents')
    .select('*, clients(name)')
    .eq('firm_id', firmId)
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (type)     query = query.eq('type', type)
  if (status)   query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
