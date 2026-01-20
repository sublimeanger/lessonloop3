-- Create audit log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_audit_log_org_id ON public.audit_log(org_id);
CREATE INDEX idx_audit_log_entity_type ON public.audit_log(entity_type);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_user_id);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only org admins can view audit logs
CREATE POLICY "Org admins can view audit logs"
ON public.audit_log
FOR SELECT
USING (is_org_admin(auth.uid(), org_id));

-- System can insert audit logs (via triggers)
CREATE POLICY "System can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (true);

-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
  _action text;
  _before jsonb;
  _after jsonb;
  _entity_id uuid;
  _actor_user_id uuid;
BEGIN
  -- Determine action
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _after := to_jsonb(NEW);
    _before := NULL;
    _entity_id := NEW.id;
    _org_id := NEW.org_id;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _before := to_jsonb(OLD);
    _after := to_jsonb(NEW);
    _entity_id := NEW.id;
    _org_id := NEW.org_id;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _before := to_jsonb(OLD);
    _after := NULL;
    _entity_id := OLD.id;
    _org_id := OLD.org_id;
  END IF;

  -- Get current user
  _actor_user_id := auth.uid();

  -- Insert audit log
  INSERT INTO public.audit_log (org_id, actor_user_id, action, entity_type, entity_id, before, after)
  VALUES (_org_id, _actor_user_id, _action, TG_TABLE_NAME, _entity_id, _before, _after);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers for students
CREATE TRIGGER audit_students
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Create triggers for lessons
CREATE TRIGGER audit_lessons
AFTER INSERT OR UPDATE OR DELETE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Create triggers for invoices
CREATE TRIGGER audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Create triggers for payments
CREATE TRIGGER audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Create triggers for org_memberships (role changes)
CREATE TRIGGER audit_org_memberships
AFTER INSERT OR UPDATE OR DELETE ON public.org_memberships
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();