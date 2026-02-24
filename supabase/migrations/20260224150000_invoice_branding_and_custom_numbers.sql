-- Invoice branding: add brand colours and custom invoice number pattern support
-- to organisations table

-- Brand colours for invoice PDF theming
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#1a1a2e',
  ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS invoice_number_prefix text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS invoice_number_digits integer DEFAULT 5;

-- Update invoice_number_sequences to support custom prefix
-- (The existing generate_invoice_number function will be replaced)

-- Replace generate_invoice_number to support custom prefixes and digit padding
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _year text;
  _current_number integer;
  _prefix text;
  _digits integer;
BEGIN
  _year := to_char(CURRENT_DATE, 'YYYY');

  -- Fetch org customisation
  SELECT
    COALESCE(invoice_number_prefix, 'LL'),
    COALESCE(invoice_number_digits, 5)
  INTO _prefix, _digits
  FROM organisations
  WHERE id = _org_id;

  -- Clamp digits to sensible range
  IF _digits < 3 THEN _digits := 3; END IF;
  IF _digits > 8 THEN _digits := 8; END IF;

  -- Upsert + atomic increment
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

  RETURN _prefix || '-' || _year || '-' || LPAD(_current_number::text, _digits, '0');
END;
$$;
