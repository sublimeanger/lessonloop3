-- ============================================================
-- Lead Pipeline & Trial Lesson Engine
-- Full CRM funnel: enquiry → contacted → trial_booked → trial_completed → enrolled → lost
-- ============================================================

-- Lead pipeline stages
CREATE TYPE public.lead_stage AS ENUM (
  'enquiry', 'contacted', 'trial_booked', 'trial_completed', 'enrolled', 'lost'
);

CREATE TYPE public.lead_source AS ENUM (
  'manual', 'booking_page', 'widget', 'referral', 'website', 'phone', 'walk_in', 'other'
);

-- Main leads table (one lead = one enquiry, can reference multiple children)
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  -- Contact info
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  -- Pipeline
  stage public.lead_stage NOT NULL DEFAULT 'enquiry',
  source public.lead_source NOT NULL DEFAULT 'manual',
  source_detail text,
  -- Assignment
  assigned_to uuid REFERENCES auth.users(id),
  -- Scheduling
  trial_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  trial_date timestamptz,
  -- Conversion
  converted_at timestamptz,
  lost_reason text,
  -- Preferences
  preferred_instrument text,
  preferred_day text,
  preferred_time text,
  notes text,
  -- Metadata
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lead students (multiple children per enquiry)
CREATE TABLE public.lead_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text,
  age integer,
  instrument text,
  experience_level text CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  notes text,
  converted_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lead activity timeline
CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'created', 'stage_changed', 'note_added', 'email_sent', 'call_logged',
    'trial_booked', 'trial_completed', 'converted', 'lost', 'assigned',
    'follow_up_scheduled', 'follow_up_completed'
  )),
  description text,
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Follow-up reminders
CREATE TABLE public.lead_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  note text,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_leads_org_id ON public.leads(org_id);
CREATE INDEX idx_leads_stage ON public.leads(org_id, stage);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_leads_source ON public.leads(org_id, source);
CREATE INDEX idx_leads_created ON public.leads(org_id, created_at DESC);
CREATE INDEX idx_lead_students_lead ON public.lead_students(lead_id);
CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_created ON public.lead_activities(lead_id, created_at DESC);
CREATE INDEX idx_lead_follow_ups_due ON public.lead_follow_ups(org_id, due_at) WHERE completed_at IS NULL;

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view leads" ON public.leads FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Staff can create leads" ON public.leads FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Staff can update leads" ON public.leads FOR UPDATE
  USING (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Staff can view lead students" ON public.lead_students FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Staff can create lead students" ON public.lead_students FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Staff can update lead students" ON public.lead_students FOR UPDATE
  USING (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Admins can delete lead students" ON public.lead_students FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Staff can view lead activities" ON public.lead_activities FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Staff can create lead activities" ON public.lead_activities FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can view lead follow-ups" ON public.lead_follow_ups FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Staff can create lead follow-ups" ON public.lead_follow_ups FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));
CREATE POLICY "Staff can update lead follow-ups" ON public.lead_follow_ups FOR UPDATE
  USING (public.is_org_staff(auth.uid(), org_id));

-- Triggers
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
