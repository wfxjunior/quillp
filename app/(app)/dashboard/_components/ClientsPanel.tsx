'use client'

/**
 * ClientsPanel — tabbed client list for the dashboard
 *
 * Client component to handle tab-switching state.
 * Receives all clients from the server and filters client-side.
 */

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ClientRow } from '@/components/ui/ClientRow'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types'

interface DashboardClient {
  id: string
  name: string
  email: string
  services: string[]
  pipeline_stage: PipelineStage
}

type Tab = 'all' | 'onboarding' | 'pending_docs'

const TABS: { key: Tab; label: string }[] = [
  { key: 'all',          label: 'All' },
  { key: 'onboarding',   label: 'Onboarding' },
  { key: 'pending_docs', label: 'Pending docs' },
]

interface ClientsPanelProps {
  clients: DashboardClient[]
}

export function ClientsPanel({ clients }: ClientsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const filtered = clients.filter(c => {
    if (activeTab === 'all')          return true
    if (activeTab === 'onboarding')   return c.pipeline_stage === 'onboarding'
    if (activeTab === 'pending_docs') return c.pipeline_stage === 'docs_received'
    return true
  })

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-0.5 mb-3">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'h-7 px-3 text-[12px] font-[450] rounded-[6px]',
              'transition-colors duration-150 select-none',
              activeTab === tab.key
                ? 'bg-ink text-white'
                : 'text-ink-soft hover:text-ink hover:bg-beige-100',
            )}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span className={cn(
                'ml-1.5 text-[10.5px]',
                activeTab === tab.key ? 'text-white/60' : 'text-ink-soft/60'
              )}>
                {tab.key === 'onboarding'
                  ? clients.filter(c => c.pipeline_stage === 'onboarding').length
                  : clients.filter(c => c.pipeline_stage === 'docs_received').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-[12px] border-[0.5px] border-beige-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center bg-white">
            <p className="text-[13px] text-ink-soft font-light">
              {activeTab === 'all'
                ? 'No clients yet. Add your first client to get started.'
                : 'No clients in this stage.'}
            </p>
          </div>
        ) : (
          filtered.map(client => (
            <ClientRow
              key={client.id}
              id={client.id}
              name={client.name}
              email={client.email}
              services={client.services}
              pipelineStage={client.pipeline_stage}
            />
          ))
        )}
      </div>

      {/* Footer link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 mt-3 text-[12.5px] text-ink-mid hover:text-ink font-[450] transition-colors"
      >
        View all clients
        <ArrowRight size={13} strokeWidth={2} />
      </Link>
    </div>
  )
}
