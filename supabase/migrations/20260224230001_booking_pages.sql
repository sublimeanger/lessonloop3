-- ============================================================
-- Public Booking Page & Embeddable Widget
-- Calendly-style public page for orgs with configurable branding
-- ============================================================

-- Booking page configuration per org
CREATE TABLE public.booking_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  -- URL
  slug text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  -- Display
  title text,
  description text,
  logo_url text,
  accent_color text DEFAULT '#0d9488',
  -- Booking config
  lesson_duration_mins integer NOT NULL DEFAULT 30,
  advance_booking_days integer NOT NULL DEFAULT 30,
  min_notice_hours integer NOT NULL DEFAULT 24,
  buffer_minutes integer NOT NULL DEFAULT 0,
  require_phone boolean NOT NULL DEFAULT false,
  -- Content
  welcome_message text,
  confirmation_message text,
  -- Metadata
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slug)
);

-- Which teachers are bookable on this page
CREATE TABLE public.booking_page_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_page_id uuid NOT NULL REFERENCES public.booking_pages(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  UNIQUE(booking_page_id, teacher_id)
);

-- Which instruments/subjects can be booked
CREATE TABLE public.booking_page_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_page_id uuid NOT NULL REFERENCES public.booking_pages(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES public.instruments(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  UNIQUE(booking_page_id, instrument_id)
);

-- Indexes
CREATE INDEX idx_booking_pages_org ON public.booking_pages(org_id);
CREATE INDEX idx_booking_pages_slug ON public.booking_pages(slug) WHERE enabled = true;
CREATE INDEX idx_booking_page_teachers_page ON public.booking_page_teachers(booking_page_id);
CREATE INDEX idx_booking_page_instruments_page ON public.booking_page_instruments(booking_page_id);

-- RLS
ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_page_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_page_instruments ENABLE ROW LEVEL SECURITY;

-- Staff can manage booking pages
CREATE POLICY "Admins can manage booking pages" ON public.booking_pages FOR ALL
  USING (public.is_org_admin(auth.uid(), org_id));

-- Public can read enabled booking pages (for the public booking route)
CREATE POLICY "Public can view enabled booking pages" ON public.booking_pages FOR SELECT
  USING (enabled = true);

CREATE POLICY "Admins can manage booking page teachers" ON public.booking_page_teachers FOR ALL
  USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Public can view booking page teachers" ON public.booking_page_teachers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.booking_pages bp
    WHERE bp.id = booking_page_id AND bp.enabled = true
  ));

CREATE POLICY "Admins can manage booking page instruments" ON public.booking_page_instruments FOR ALL
  USING (public.is_org_admin(auth.uid(), org_id));
CREATE POLICY "Public can view booking page instruments" ON public.booking_page_instruments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.booking_pages bp
    WHERE bp.id = booking_page_id AND bp.enabled = true
  ));

-- Trigger
CREATE TRIGGER update_booking_pages_updated_at
  BEFORE UPDATE ON public.booking_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
