-- Add invoice branding fields to organisations
ALTER TABLE public.organisations
ADD COLUMN IF NOT EXISTS invoice_from_name TEXT,
ADD COLUMN IF NOT EXISTS invoice_from_address_line1 TEXT,
ADD COLUMN IF NOT EXISTS invoice_from_address_line2 TEXT,
ADD COLUMN IF NOT EXISTS invoice_from_city TEXT,
ADD COLUMN IF NOT EXISTS invoice_from_postcode TEXT,
ADD COLUMN IF NOT EXISTS invoice_from_country TEXT DEFAULT 'United Kingdom',
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS invoice_footer_note TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.organisations.invoice_from_name IS 'Business name to appear on invoices';
COMMENT ON COLUMN public.organisations.invoice_from_address_line1 IS 'First line of business address';
COMMENT ON COLUMN public.organisations.invoice_from_address_line2 IS 'Second line of business address';
COMMENT ON COLUMN public.organisations.invoice_from_city IS 'City for invoice address';
COMMENT ON COLUMN public.organisations.invoice_from_postcode IS 'Postcode for invoice address';
COMMENT ON COLUMN public.organisations.invoice_from_country IS 'Country for invoice address';
COMMENT ON COLUMN public.organisations.logo_url IS 'URL to organisation logo for invoices';
COMMENT ON COLUMN public.organisations.invoice_footer_note IS 'Custom footer text for invoices';