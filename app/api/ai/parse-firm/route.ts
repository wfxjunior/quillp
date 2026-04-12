/**
 * POST /api/ai/parse-firm
 * blueprint-part2.md §11.1
 *
 * Accepts a free-text firm description and returns structured JSON
 * extracted by GPT-4o-mini.
 *
 * Rate limit: 10 req/min per IP (configured in vercel.json)
 * Timeout: 15s (configured in vercel.json)
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const SYSTEM_PROMPT = `You are an expert at extracting structured information from accounting firm descriptions.
The user will provide a free-text description of their accounting practice.
Extract the information and return ONLY a valid JSON object with the exact schema specified.
If a field cannot be determined from the text, set its value to null.
Do not add any fields not in the schema. Do not add explanatory text.

Schema:
{
  "firm_name": string | null,
  "primary_state": string | null,
  "fee_model": "flat_fee" | "hourly" | "retainer" | "hybrid" | null,
  "services": string[],
  "entity_types": string[],
  "client_size": "small" | "medium" | "large" | null,
  "approximate_client_count": number | null,
  "team_size": "solo" | "small" | "growing" | null
}

Rules:
- primary_state: two-letter US state code only, e.g. "FL"
- services: only values from ["1040", "1120-S", "1065", "1120", "990", "bookkeeping", "payroll", "tax_planning", "sales_tax", "cfo_advisory", "irs_representation", "audit_support", "business_formation"]
- entity_types: only values from ["individual", "s_corp", "llc", "partnership", "c_corp", "non_profit", "trust", "estate"]
- team_size: solo=1 person, small=2-5 people, growing=6+ people`

export interface ParseFirmResult {
  firm_name: string | null
  primary_state: string | null
  fee_model: 'flat_fee' | 'hourly' | 'retainer' | 'hybrid' | null
  services: string[]
  entity_types: string[]
  client_size: 'small' | 'medium' | 'large' | null
  approximate_client_count: number | null
  team_size: 'solo' | 'small' | 'growing' | null
}

export async function POST(request: NextRequest) {
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
    const completion = await getOpenAI().chat.completions.create(
      {
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extract structured data from this accounting firm description:\n\n"${trimmed}"`,
          },
        ],
      },
      { timeout: 10_000 }
    )

    const raw = completion.choices[0]?.message?.content ?? ''

    // Strip potential markdown code fences
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: ParseFirmResult
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json({ error: 'AI returned malformed JSON' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        return NextResponse.json({ error: 'Rate limit reached. Please try again.' }, { status: 429 })
      }
      return NextResponse.json({ error: 'AI service error' }, { status: 502 })
    }
    console.error('[parse-firm] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
