-- Fix: is_invoice_payer was over-granting access to co-guardians.
-- When an invoice has a specific payer_guardian_id, only that guardian should
-- be able to pay it. The student-level fallback should only apply when
-- payer_guardian_id IS NULL (student-addressed invoices).

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
        -- Direct guardian payer match
        g.user_id = _user_id
        OR (
          -- Student-addressed invoices (no specific guardian): any linked guardian can pay
          i.payer_guardian_id IS NULL
          AND i.payer_student_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.student_guardians sg
            INNER JOIN public.guardians g2 ON g2.id = sg.guardian_id
            WHERE sg.student_id = s.id AND g2.user_id = _user_id
          )
        )
      )
  )
$$;
