import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { rateLimit }                 from '@/lib/security/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`signup:${ip}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many signup attempts' }, { status: 429 })
  }

  let body: { name: string; email: string; password: string; firm_name?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { name, email, password, firm_name } = body
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 422 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, firm_name: firm_name ?? `${name}'s Practice` },
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ user: data.user, session: data.session }, { status: 201 })
}
