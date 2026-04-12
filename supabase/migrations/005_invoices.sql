-- ══════════════════════════════════════════════════════════════════
--  Migration 005 — invoices
-- ══════════════════════════════════════════════════════════════════

CREATE TYPE invoice_status  AS ENUM ('draft', 'sent', 'paid', 'overdue');
CREATE TYPE payment_method  AS ENUM ('stripe', 'manual');

CREATE TABLE public.invoices (
  id                          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id                     UUID            NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
  client_id                   UUID            NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_number              TEXT            NOT NULL,   -- e.g. "INV-0034", auto-generated per firm
  description                 TEXT            NOT NULL,
  amount                      NUMERIC(10,2)   NOT NULL,
  status                      invoice_status  NOT NULL DEFAULT 'draft',
  due_date                    DATE            NOT NULL,
  paid_at                     TIMESTAMPTZ,
  payment_method              payment_method,
  stripe_payment_intent_id    TEXT,
  stripe_payment_link         TEXT,
  pdf_url                     TEXT,
  created_at                  TIMESTAMPTZ     NOT NULL DEFAULT now(),

  UNIQUE (firm_id, invoice_number)
);

-- ── Auto-increment invoice number per firm ────────────────────────

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_firm_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INT;
BEGIN
  SELECT COALESCE(
    MAX(CAST(regexp_replace(invoice_number, '[^0-9]', '', 'g') AS INT)),
    0
  ) + 1
  INTO v_next
  FROM public.invoices
  WHERE firm_id = p_firm_id;

  RETURN 'INV-' || LPAD(v_next::TEXT, 4, '0');
END;
$$;

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX idx_invoices_firm_status ON public.invoices(firm_id, status);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their firm's invoices"
  ON public.invoices FOR SELECT
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can insert invoices into their firm"
  ON public.invoices FOR INSERT
  WITH CHECK (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can update their firm's invoices"
  ON public.invoices FOR UPDATE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their firm's invoices"
  ON public.invoices FOR DELETE
  USING (firm_id = (SELECT firm_id FROM public.users WHERE id = auth.uid()));
