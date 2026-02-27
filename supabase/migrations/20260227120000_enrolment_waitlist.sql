-- ============================================================
-- Enrolment Waiting List
-- Tracks prospective students awaiting an available slot.
-- Separate from make_up_waitlist (which handles makeup rebooking).
-- ============================================================

-- ── Table: enrolment_waitlist ────────────────────────────────
CREATE TABLE public.enrolment_waitlist (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,

  -- Who is waiting
  lead_id       UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contact_name  TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  guardian_id   UUID REFERENCES public.guardians(id) ON DELETE SET NULL,

  -- What they want (one row per child/instrument combination)
  child_first_name   TEXT NOT NULL,
  child_last_name    TEXT,
  child_age          INTEGER,
  instrument_id      UUID REFERENCES public.instruments(id) ON DELETE SET NULL,
  instrument_name    TEXT NOT NULL,  -- denormalised for display even if instrument deleted

  -- Preferences
  preferred_teacher_id  UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  preferred_location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  preferred_days        TEXT[],            -- e.g. ['monday','wednesday']
  preferred_time_earliest TIME,            -- e.g. 15:00
  preferred_time_latest   TIME,            -- e.g. 18:00
  experience_level  TEXT,                  -- beginner / grade_1 / grade_2 etc
  lesson_duration_mins INTEGER DEFAULT 30,

  -- Queue position & status
  position INTEGER NOT NULL DEFAULT 0,
  status   TEXT    NOT NULL DEFAULT 'waiting'
    CHECK (status IN (
      'waiting',     -- on the list, no slot available
      'offered',     -- slot offered, awaiting response
      'accepted',    -- parent accepted, pending enrolment
      'enrolled',    -- converted to student, done
      'declined',    -- parent declined the offer
      'expired',     -- offer timed out
      'withdrawn',   -- parent withdrew from list
      'lost'         -- admin marked as lost
    )),

  -- Offer tracking
  offered_slot_day    TEXT,                -- e.g. 'tuesday'
  offered_slot_time   TIME,               -- e.g. '16:00'
  offered_teacher_id  UUID REFERENCES public.teachers(id),
  offered_location_id UUID REFERENCES public.locations(id),
  offered_rate_minor  INTEGER,             -- price shown in offer (pence)
  offered_at          TIMESTAMPTZ,
  offer_expires_at    TIMESTAMPTZ,         -- offered_at + expiry hours
  responded_at        TIMESTAMPTZ,
  offer_message_id    UUID,                -- FK to message_log if needed

  -- Conversion tracking
  converted_student_id UUID REFERENCES public.students(id),
  converted_at         TIMESTAMPTZ,

  -- Source tracking
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('manual','lead_pipeline','booking_page','parent_portal','website')),

  -- Admin
  notes    TEXT,
  priority TEXT DEFAULT 'normal'
    CHECK (priority IN ('normal','high','urgent')),

  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_enrolment_waitlist_org_status
  ON public.enrolment_waitlist(org_id, status);

CREATE INDEX idx_enrolment_waitlist_instrument
  ON public.enrolment_waitlist(org_id, instrument_id, status)
  WHERE status = 'waiting';

CREATE INDEX idx_enrolment_waitlist_teacher
  ON public.enrolment_waitlist(org_id, preferred_teacher_id, status)
  WHERE status = 'waiting';

CREATE INDEX idx_enrolment_waitlist_location
  ON public.enrolment_waitlist(org_id, preferred_location_id, status)
  WHERE status = 'waiting';

CREATE INDEX idx_enrolment_waitlist_expires
  ON public.enrolment_waitlist(offer_expires_at)
  WHERE status = 'offered';

CREATE INDEX idx_enrolment_waitlist_lead
  ON public.enrolment_waitlist(lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX idx_enrolment_waitlist_position
  ON public.enrolment_waitlist(org_id, instrument_id, position)
  WHERE status = 'waiting';

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.enrolment_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view enrolment waitlist"
  ON public.enrolment_waitlist FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage enrolment waitlist"
  ON public.enrolment_waitlist FOR ALL
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Parents can view their own waitlist entries"
  ON public.enrolment_waitlist FOR SELECT
  USING (guardian_id IN (
    SELECT id FROM public.guardians WHERE user_id = auth.uid()
  ));

-- ── Updated_at trigger ───────────────────────────────────────
CREATE TRIGGER set_enrolment_waitlist_updated_at
  BEFORE UPDATE ON public.enrolment_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- Enrolment Waitlist Activity (audit trail per entry)
-- ============================================================

CREATE TABLE public.enrolment_waitlist_activity (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  waitlist_id   UUID NOT NULL REFERENCES public.enrolment_waitlist(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
    -- 'created', 'position_changed', 'offered', 'offer_sent', 'offer_expired',
    -- 'accepted', 'declined', 'enrolled', 'withdrawn', 'note_added', 'priority_changed'
  description   TEXT,
  metadata      JSONB,
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ewl_activity_waitlist
  ON public.enrolment_waitlist_activity(waitlist_id);

ALTER TABLE public.enrolment_waitlist_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view waitlist activity"
  ON public.enrolment_waitlist_activity FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Org admins can manage waitlist activity"
  ON public.enrolment_waitlist_activity FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));


-- ============================================================
-- Org settings columns
-- ============================================================

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS enrolment_offer_expiry_hours INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS terms_conditions_url TEXT;
