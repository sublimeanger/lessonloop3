
-- Create sequence table for race-condition-safe invoice numbers
CREATE TABLE IF NOT EXISTS public.invoice_number_sequences (
  org_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  current_year text NOT NULL,
  current_number integer DEFAULT 0 NOT NULL
);

ALTER TABLE public.invoice_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance team can view sequences"
  ON public.invoice_number_sequences FOR SELECT
  USING (public.is_org_finance_team(auth.uid(), org_id));

-- Seed existing orgs with their current max invoice number
INSERT INTO public.invoice_number_sequences (org_id, current_year, current_number)
SELECT
  i.org_id,
  to_char(CURRENT_DATE, 'YYYY'),
  COALESCE(MAX(
    CAST(NULLIF(SPLIT_PART(i.invoice_number, '-', 3), '') AS integer)
  ), 0)
FROM public.invoices i
WHERE i.invoice_number LIKE 'LL-%'
GROUP BY i.org_id
ON CONFLICT (org_id) DO UPDATE SET
  current_number = GREATEST(
    invoice_number_sequences.current_number,
    EXCLUDED.current_number
  );

-- Replace the function with row-lock based version
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year text;
  _current_number integer;
BEGIN
  _year := to_char(CURRENT_DATE, 'YYYY');

  INSERT INTO invoice_number_sequences (org_id, current_year, current_number)
  VALUES (_org_id, _year, 0)
  ON CONFLICT (org_id) DO NOTHING;

  UPDATE invoice_number_sequences
  SET
    current_number = CASE
      WHEN current_year = _year THEN current_number + 1
      ELSE 1
    END,
    current_year = _year
  WHERE org_id = _org_id
  RETURNING current_number INTO _current_number;

  RETURN 'LL-' || _year || '-' || LPAD(_current_number::text, 5, '0');
END;
$$;
