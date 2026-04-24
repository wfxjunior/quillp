import { createAdminClient } from '@/lib/supabase/server'
import OpenAI               from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function saveFirmPreference(
  firmId:          string,
  documentType:    string,
  originalContent: string,
  editedContent:   string
): Promise<void> {
  const preferences = await summarizeDiff(originalContent, editedContent)

  const admin = createAdminClient()
  await admin.from('firm_templates').upsert(
    {
      firm_id:          firmId,
      document_type:    documentType,
      service_type:     documentType,
      content_html:     editedContent,
      diff_from_default: preferences,
      updated_at:       new Date().toISOString(),
    },
    { onConflict: 'firm_id,document_type' }
  )
}

export async function getFirmPreferences(
  firmId:       string,
  documentType: string
): Promise<string[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('firm_templates')
    .select('diff_from_default')
    .eq('firm_id', firmId)
    .eq('document_type', documentType)
    .single()

  if (!data?.diff_from_default) return []

  const parsed = data.diff_from_default as { preferences?: string[] }
  return parsed.preferences ?? []
}

async function summarizeDiff(
  original: string,
  edited:   string
): Promise<{ preferences: string[] }> {
  if (original === edited) return { preferences: [] }

  try {
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      temperature: 0,
      messages: [{
        role:    'user',
        content: `A CPA edited a legal document. Original length: ${original.length} chars. Edited length: ${edited.length} chars.
        Identify 1-3 firm preferences implied by these edits (e.g. "prefer shorter payment terms", "always include arbitration clause").
        Return ONLY valid JSON: { "preferences": ["preference 1", "preference 2"] }`,
      }],
    })

    return JSON.parse(completion.choices[0].message.content ?? '{"preferences":[]}')
  } catch {
    return { preferences: [] }
  }
}
