/**
 * lib/ai/parse-firm.ts
 *
 * Extracts structured firm data from a free-text description using GPT-4o-mini.
 * Called by POST /api/ai/parse-firm during the onboarding flow.
 */

import OpenAI from 'openai'

export interface ParseFirmResult {
  firm_name:                string | null
  primary_state:            string | null
  fee_model:                'flat_fee' | 'hourly' | 'retainer' | 'hybrid' | null
  services:                 string[]
  entity_types:             string[]
  client_size:              'small' | 'medium' | 'large' | null
  approximate_client_count: number | null
  team_size:                'solo' | 'small' | 'growing' | null
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

export async function parseFirmDescription(description: string): Promise<ParseFirmResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await openai.chat.completions.create(
    {
      model:       'gpt-4o-mini',
      temperature: 0,
      max_tokens:  400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role:    'user',
          content: `Extract structured data from this accounting firm description:\n\n"${description}"`,
        },
      ],
    },
    { timeout: 10_000 }
  )

  const raw     = completion.choices[0]?.message?.content ?? ''
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  return JSON.parse(jsonStr) as ParseFirmResult
}
