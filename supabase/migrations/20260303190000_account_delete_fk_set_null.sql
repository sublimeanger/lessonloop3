-- 14.2: Fix auth.users FK constraints that block account deletion.
-- These columns reference auth.users(id) with no ON DELETE clause (defaults to
-- NO ACTION/RESTRICT), which causes auth.admin.deleteUser() to fail if rows exist.
-- All are audit/attribution columns — SET NULL preserves the record while allowing
-- the auth user to be deleted.

-- message_log.sender_user_id
ALTER TABLE public.message_log
  DROP CONSTRAINT IF EXISTS message_log_sender_user_id_fkey,
  ADD CONSTRAINT message_log_sender_user_id_fkey
    FOREIGN KEY (sender_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- stripe_checkout_sessions.payer_user_id
ALTER TABLE public.stripe_checkout_sessions
  DROP CONSTRAINT IF EXISTS stripe_checkout_sessions_payer_user_id_fkey,
  ADD CONSTRAINT stripe_checkout_sessions_payer_user_id_fkey
    FOREIGN KEY (payer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- make_up_credits.created_by
ALTER TABLE public.make_up_credits
  DROP CONSTRAINT IF EXISTS make_up_credits_created_by_fkey,
  ADD CONSTRAINT make_up_credits_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- terms.created_by
ALTER TABLE public.terms
  DROP CONSTRAINT IF EXISTS terms_created_by_fkey,
  ADD CONSTRAINT terms_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- resources.uploaded_by
ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_uploaded_by_fkey,
  ADD CONSTRAINT resources_uploaded_by_fkey
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- resource_shares.shared_by
ALTER TABLE public.resource_shares
  DROP CONSTRAINT IF EXISTS resource_shares_shared_by_fkey,
  ADD CONSTRAINT resource_shares_shared_by_fkey
    FOREIGN KEY (shared_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- refunds.refunded_by
ALTER TABLE public.refunds
  DROP CONSTRAINT IF EXISTS refunds_refunded_by_fkey,
  ADD CONSTRAINT refunds_refunded_by_fkey
    FOREIGN KEY (refunded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- recurring_invoice_templates.created_by
ALTER TABLE public.recurring_invoice_templates
  DROP CONSTRAINT IF EXISTS recurring_invoice_templates_created_by_fkey,
  ADD CONSTRAINT recurring_invoice_templates_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- leads.assigned_to
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_assigned_to_fkey,
  ADD CONSTRAINT leads_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

-- leads.created_by
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_created_by_fkey,
  ADD CONSTRAINT leads_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- lead_students.created_by
ALTER TABLE public.lead_students
  DROP CONSTRAINT IF EXISTS lead_students_created_by_fkey,
  ADD CONSTRAINT lead_students_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- lead_activities.created_by
ALTER TABLE public.lead_activities
  DROP CONSTRAINT IF EXISTS lead_activities_created_by_fkey,
  ADD CONSTRAINT lead_activities_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
