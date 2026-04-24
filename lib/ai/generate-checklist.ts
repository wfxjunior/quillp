import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const CHECKLIST_SYSTEM_PROMPT = `You are a US tax professional. Generate a document checklist for a tax preparation engagement.
Return ONLY valid JSON with this exact shape: { "items": [{ "label": string, "description": string, "required": boolean }] }
Include the standard documents required for the given service type and entity type.
Limit to 10-15 items. Be specific and practical.`

export interface ChecklistItem {
  label:       string
  description: string
  required:    boolean
}

export async function generateChecklist(
  serviceType: string,
  entityType:  string
): Promise<ChecklistItem[]> {
  const completion = await openai.chat.completions.create({
    model:           'gpt-4o-mini',
    temperature:     0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: CHECKLIST_SYSTEM_PROMPT },
      { role: 'user',   content: `Service: ${serviceType}, Entity type: ${entityType}` },
    ],
  })

  const parsed = JSON.parse(completion.choices[0].message.content ?? '{"items":[]}')
  return (parsed.items ?? []) as ChecklistItem[]
}
