DROP POLICY IF EXISTS "Guardians can view own payment prefs"
  ON public.guardian_payment_preferences;

DROP POLICY IF EXISTS "Guardians can manage own payment prefs"
  ON public.guardian_payment_preferences;

DROP POLICY IF EXISTS "Org staff can view guardian payment prefs"
  ON public.guardian_payment_preferences;