-- Add user_id to guardians table for portal access
ALTER TABLE public.guardians 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_guardians_user_id ON public.guardians(user_id);

-- Create function to get guardian IDs for a user
CREATE OR REPLACE FUNCTION public.get_guardian_ids_for_user(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(id), '{}')
  FROM public.guardians
  WHERE user_id = _user_id
$$;

-- Create function to get student IDs for a parent user
CREATE OR REPLACE FUNCTION public.get_student_ids_for_parent(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT sg.student_id), '{}')
  FROM public.student_guardians sg
  INNER JOIN public.guardians g ON g.id = sg.guardian_id
  WHERE g.user_id = _user_id
$$;

-- Create function to check if user is parent of a student
CREATE OR REPLACE FUNCTION public.is_parent_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_guardians sg
    INNER JOIN public.guardians g ON g.id = sg.guardian_id
    WHERE g.user_id = _user_id
      AND sg.student_id = _student_id
  )
$$;

-- Create function to check if user is payer on invoice
CREATE OR REPLACE FUNCTION public.is_invoice_payer(_user_id uuid, _invoice_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.invoices i
    LEFT JOIN public.guardians g ON i.payer_guardian_id = g.id
    LEFT JOIN public.students s ON i.payer_student_id = s.id
    WHERE i.id = _invoice_id
      AND (
        g.user_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.student_guardians sg
          INNER JOIN public.guardians g2 ON g2.id = sg.guardian_id
          WHERE sg.student_id = s.id AND g2.user_id = _user_id
        )
      )
  )
$$;

-- Add parent-specific RLS policies for students (parents can view their children)
CREATE POLICY "Parents can view their linked students"
ON public.students
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND is_parent_of_student(auth.uid(), id)
);

-- Add parent-specific RLS policies for lessons (parents can view their children's lessons)
CREATE POLICY "Parents can view their children lessons"
ON public.lessons
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.lesson_participants lp
    WHERE lp.lesson_id = id
      AND is_parent_of_student(auth.uid(), lp.student_id)
  )
);

-- Add parent-specific RLS policies for lesson_participants
CREATE POLICY "Parents can view their children lesson participants"
ON public.lesson_participants
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND is_parent_of_student(auth.uid(), student_id)
);

-- Add parent-specific RLS policies for invoices
CREATE POLICY "Parents can view their invoices"
ON public.invoices
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND is_invoice_payer(auth.uid(), id)
);

-- Add parent-specific RLS policies for invoice_items
CREATE POLICY "Parents can view their invoice items"
ON public.invoice_items
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND is_invoice_payer(auth.uid(), invoice_id)
);

-- Add parent-specific RLS policies for payments
CREATE POLICY "Parents can view their payments"
ON public.payments
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND is_invoice_payer(auth.uid(), invoice_id)
);

-- Add parent-specific RLS policies for attendance_records
CREATE POLICY "Parents can view their children attendance"
ON public.attendance_records
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND is_parent_of_student(auth.uid(), student_id)
);

-- Add parent-specific RLS policies for guardians (can view self and co-guardians)
CREATE POLICY "Parents can view their guardian record"
ON public.guardians
FOR SELECT
USING (
  user_id = auth.uid()
);

-- Parents can view their student_guardians links
CREATE POLICY "Parents can view their student guardian links"
ON public.student_guardians
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND is_parent_of_student(auth.uid(), student_id)
);

-- Parents can view locations for their children's lessons
CREATE POLICY "Parents can view lesson locations"
ON public.locations
FOR SELECT
USING (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
);

-- Create message_requests table for parent requests
CREATE TABLE public.message_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  guardian_id uuid NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  request_type text NOT NULL CHECK (request_type IN ('cancellation', 'reschedule', 'general')),
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'resolved')),
  admin_response text,
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on message_requests
ALTER TABLE public.message_requests ENABLE ROW LEVEL SECURITY;

-- Index for message_requests
CREATE INDEX idx_message_requests_org_id ON public.message_requests(org_id);
CREATE INDEX idx_message_requests_guardian_id ON public.message_requests(guardian_id);
CREATE INDEX idx_message_requests_status ON public.message_requests(status);

-- Parents can create message requests
CREATE POLICY "Parents can create message requests"
ON public.message_requests
FOR INSERT
WITH CHECK (
  has_org_role(auth.uid(), org_id, 'parent'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.user_id = auth.uid()
  )
);

-- Parents can view their own message requests
CREATE POLICY "Parents can view their message requests"
ON public.message_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.guardians g
    WHERE g.id = guardian_id AND g.user_id = auth.uid()
  )
);

-- Admins can view all message requests
CREATE POLICY "Admins can view org message requests"
ON public.message_requests
FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- Admins can update message requests
CREATE POLICY "Admins can update message requests"
ON public.message_requests
FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

-- Updated_at trigger for message_requests
CREATE TRIGGER update_message_requests_updated_at
BEFORE UPDATE ON public.message_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();