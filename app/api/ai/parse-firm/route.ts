/**
 * POST /api/ai/parse-firm
 * blueprint-part2.md §11.1
 *
 * Accepts a free-text firm description and returns structured JSON
 * extracted by GPT-4o-mini.
 *
 * Rate limit: 10 req/min per IP
 * Timeout: 15s (configured in vercel.json)
 */

import { NextRequest, NextResponse }  from 'next/server'
import OpenAI                         from 'openai'
import { rateLimit }                  from '@/lib/security/rate-limit'
import { parseFirmDescription }       from '@/lib/ai/parse-firm'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!rateLimit(`parse-firm:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 })
  }

  let description: string

  try {
    const body = await request.json()
    description = body.description
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!description || typeof description !== 'string') {
    return NextResponse.json({ error: 'description is required' }, { status: 400 })
  }

  const trimmed = description.trim()
  if (trimmed.length < 10) {
    return NextResponse.json({ error: 'Description too short' }, { status: 400 })
  }

  try {
    const parsed = await parseFirmDescription(trimmed)
    return NextResponse.json(parsed)
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        return NextResponse.json({ error: 'Rate limit reached. Please try again.' }, { status: 429 })
      }
      return NextResponse.json({ error: 'AI service error' }, { status: 502 })
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI returned malformed JSON' }, { status: 502 })
    }
    console.error('[parse-firm] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
