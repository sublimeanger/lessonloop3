-- Closes J6-F4, J6-F5, J8-F9 from docs/audits/2026-04-area-2-parent-portal.md
-- Same PR also folds J8-F8 (edge function validation) into supabase/functions/stripe-update-payment-preferences/index.ts.

DROP POLICY IF EXISTS "Org members can view continuation runs"
  ON public.term_continuation_runs;

DROP POLICY IF EXISTS "Org staff can view continuation runs"
  ON public.term_continuation_runs;

CREATE POLICY "Org staff can view continuation runs"
  ON public.term_continuation_runs FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

DROP POLICY IF EXISTS "Parents can view runs they have responses in"
  ON public.term_continuation_runs;

CREATE POLICY "Parents can view runs they have responses in"
  ON public.term_continuation_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.term_continuation_responses tcr
      JOIN public.guardians g ON g.id = tcr.guardian_id
      WHERE tcr.run_id = term_continuation_runs.id
        AND g.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Org members can view continuation responses"
  ON public.term_continuation_responses;

DROP POLICY IF EXISTS "Org staff can view continuation responses"
  ON public.term_continuation_responses;

CREATE POLICY "Org staff can view continuation responses"
  ON public.term_continuation_responses FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

DROP POLICY IF EXISTS "Parents can update their own continuation response"
  ON public.term_continuation_responses;
DROP POLICY IF EXISTS "Parents can update their own continuation responses"
  ON public.term_continuation_responses;

DROP POLICY IF EXISTS "Parents can update own payment preferences"
  ON public.guardian_payment_preferences;