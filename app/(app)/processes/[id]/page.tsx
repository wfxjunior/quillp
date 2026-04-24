import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProcessDetail } from './_components/ProcessDetail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProcessDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('firm_id')
    .eq('id', authUser.id)
    .single()

  if (!userRow?.firm_id) redirect('/onboarding/step-1')

  const firmId = userRow.firm_id as string

  const { data: process, error } = await supabase
    .from('processes')
    .select('*, services(name, description, price, price_type, estimated_weeks), clients(id, name, email, phone, portal_token)')
    .eq('id', id)
    .eq('firm_id', firmId)
    .single()

  if (error || !process) notFound()

  const [stepsResult, timelineResult, taxDocsResult] = await Promise.all([
    supabase
      .from('process_steps')
      .select('*')
      .eq('process_id', id)
      .order('step_order'),
    supabase
      .from('timeline_events')
      .select('*')
      .eq('client_id', process.client_id)
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('tax_documents')
      .select('id, document_type, required, status, file_name, uploaded_at')
      .eq('process_id', id)
      .order('document_type'),
  ])

  return (
    <ProcessDetail
      process={process}
      steps={stepsResult.data ?? []}
      timeline={timelineResult.data ?? []}
      documents={taxDocsResult.data ?? []}
    />
  )
}
