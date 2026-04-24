/**
 * lib/ai/generate-document.ts
 *
 * System prompts and prompt-builder for AI document generation.
 * Called by POST /api/ai/generate-document (streaming) and
 * POST /api/clients (fire-and-forget engagement letter on client creation).
 */

// ─────────────────────────────────────────
// System prompts
// ─────────────────────────────────────────

export const ENGAGEMENT_SYSTEM_PROMPT = `You are an expert legal and accounting document writer specializing in CPA engagement letters.
Generate professional, complete engagement letters that are:
- Compliant with AICPA professional standards for engagement letters
- Specific to the state and jurisdiction provided
- Properly scoped to limit the CPA's liability
- Formatted as clean HTML with semantic structure

Use these formatting rules:
- Wrap the entire document in a single <div class="document-body">
- Use <p> for paragraphs
- Use <strong> for defined terms on first use
- Use <table> for fee schedules
- Use <div class="signature-block"> for signature areas
- Do not use external CSS classes — this will be rendered in an iframe
- Do not include <html>, <head>, or <body> tags

The letter must include these sections in order:
1. Header (firm name, date, client name and address)
2. Salutation
3. Purpose of letter paragraph
4. Scope of services (specific and limited)
5. Client responsibilities section
6. Firm responsibilities section
7. Fee and payment terms section
8. Limitations and exclusions section
9. Confidentiality statement
10. Governing law (state-specific)
11. Agreement and authorization paragraph
12. Signature blocks for both parties`

export const PROPOSAL_SYSTEM_PROMPT = `You are generating a professional service proposal for an accounting firm.
The proposal should be persuasive, professional, and clearly communicate value.
It should not be a legal document — it is a sales and scope document.
Format as clean HTML wrapped in <div class="document-body">. Use <p>, <ul>, <table>, and <div class="signature-block">. No <html>, <head>, or <body> tags.`

export const CHECKLIST_SYSTEM_PROMPT = `You are generating a structured tax document checklist for a CPA firm.
Format as clean HTML wrapped in <div class="document-body">.
Use a <table> with columns: Document, Description, Required (Yes/No), Notes.
Keep rows concise. Include all common documents for the given service type.
No <html>, <head>, or <body> tags.`

export const FORM_2848_SYSTEM_PROMPT = `You are generating a summary cover letter to accompany IRS Form 2848 (Power of Attorney).
Format as clean HTML wrapped in <div class="document-body">.
The letter explains to the client what they are authorizing, why, and what to sign.
Tone: professional and plain-English. No <html>, <head>, or <body> tags.`

export const INVOICE_SYSTEM_PROMPT = `You are generating a professional invoice for an accounting firm.
Format as clean HTML wrapped in <div class="document-body">.
Include: header with firm name/address, invoice number, date, client name/address, itemized services table with amounts, subtotal, and payment terms.
No <html>, <head>, or <body> tags.`

export const SYSTEM_PROMPTS: Record<string, string> = {
  engagement_letter: ENGAGEMENT_SYSTEM_PROMPT,
  proposal:          PROPOSAL_SYSTEM_PROMPT,
  checklist:         CHECKLIST_SYSTEM_PROMPT,
  form_2848:         FORM_2848_SYSTEM_PROMPT,
  invoice:           INVOICE_SYSTEM_PROMPT,
}

// ─────────────────────────────────────────
// Prompt params
// ─────────────────────────────────────────

export interface PromptParams {
  firmName:     string
  firmAddress:  string
  cpaName:      string
  primaryState: string | null
  clientName:   string
  serviceType:  string
  taxYear:      number | null
  feeAmount:    number | null
  feeStructure: string | null
  jurisdiction: string
  specialTerms: string
  firmPrefs:    string
  today:        string
  documentType: string
}

// ─────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────

export function buildUserPrompt(p: PromptParams): string {
  const feeStr = p.feeAmount
    ? `$${p.feeAmount.toLocaleString()} (${(p.feeStructure ?? 'flat fee').replace(/_/g, ' ')})`
    : 'To be discussed'

  const jurisdiction = `Federal${p.jurisdiction ? ` + ${p.jurisdiction}` : p.primaryState ? ` + ${p.primaryState}` : ''}`

  const scCorpAddition = p.serviceType.toLowerCase().includes('s-corp') || p.serviceType.includes('1120-S')
    ? `\nService type: S-Corporation Tax Return (Form 1120-S)\nFiling deadline: March 15, ${(p.taxYear ?? new Date().getFullYear()) + 1}\nAdditional scope: Corporate tax return preparation and filing for ${p.clientName}\nNote: This engagement covers only the corporate return. Individual returns are separate engagements.`
    : ''

  if (p.documentType === 'engagement_letter') {
    return `Generate a professional engagement letter with the following parameters:

Firm name: ${p.firmName}
CPA name: ${p.cpaName}
Firm address: ${p.firmAddress}
Client name: ${p.clientName}
Service type: ${p.serviceType}${scCorpAddition}
Tax year: ${p.taxYear ?? new Date().getFullYear()}
Filing jurisdiction: ${jurisdiction}
Fee: ${feeStr}
Date: ${p.today}
${p.firmPrefs ? `\n${p.firmPrefs}` : ''}${p.specialTerms ? `\nSpecial terms: ${p.specialTerms}` : ''}

Generate the complete engagement letter now.`
  }

  if (p.documentType === 'proposal') {
    return `Generate a professional accounting services proposal:

Firm: ${p.firmName}
CPA: ${p.cpaName}
Prospect name: ${p.clientName}
Services proposed: ${p.serviceType}
Estimated fees: ${feeStr}
Filing jurisdiction: ${jurisdiction}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}

Include sections: Introduction, Our Approach, Services Included, What's Not Included, Investment, Next Steps.`
  }

  if (p.documentType === 'checklist') {
    return `Generate a tax document checklist for:

Client: ${p.clientName}
Service type: ${p.serviceType}
Tax year: ${p.taxYear ?? new Date().getFullYear()}
Filing jurisdiction: ${jurisdiction}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}`
  }

  if (p.documentType === 'form_2848') {
    return `Generate a Form 2848 cover letter for:

Firm: ${p.firmName}
CPA: ${p.cpaName}
Client: ${p.clientName}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}`
  }

  // invoice
  return `Generate a professional invoice for:

Firm: ${p.firmName}
Firm address: ${p.firmAddress}
CPA: ${p.cpaName}
Client: ${p.clientName}
Services: ${p.serviceType}
Amount: ${feeStr}
Date: ${p.today}
${p.specialTerms ? `\nAdditional notes: ${p.specialTerms}` : ''}`
}

// ─────────────────────────────────────────
// Convenience: resolve system + user prompt
// ─────────────────────────────────────────

export function buildGenerationPrompt(params: PromptParams): {
  systemPrompt: string
  userPrompt:   string
  temperature:  number
} {
  return {
    systemPrompt: SYSTEM_PROMPTS[params.documentType] ?? ENGAGEMENT_SYSTEM_PROMPT,
    userPrompt:   buildUserPrompt(params),
    temperature:  params.documentType === 'proposal' ? 0.4 : 0.2,
  }
}
