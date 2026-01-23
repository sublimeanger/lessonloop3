-- Finish Phase 1: Closure dates policy only (teacher_availability doesn't exist)
CREATE POLICY "Block anonymous access to closure_dates"
ON public.closure_dates FOR ALL TO anon
USING (false);