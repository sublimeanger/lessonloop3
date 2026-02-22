
-- Resource categories table
CREATE TABLE public.resource_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view categories in their org"
  ON public.resource_categories FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Staff can create categories"
  ON public.resource_categories FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can update categories"
  ON public.resource_categories FOR UPDATE
  USING (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can delete categories"
  ON public.resource_categories FOR DELETE
  USING (public.is_org_staff(auth.uid(), org_id));

-- Junction table linking resources to categories
CREATE TABLE public.resource_category_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id UUID NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.resource_categories(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  UNIQUE(resource_id, category_id)
);

ALTER TABLE public.resource_category_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view category assignments in their org"
  ON public.resource_category_assignments FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Staff can create category assignments"
  ON public.resource_category_assignments FOR INSERT
  WITH CHECK (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can delete category assignments"
  ON public.resource_category_assignments FOR DELETE
  USING (public.is_org_staff(auth.uid(), org_id));

-- Subscription guard triggers
CREATE TRIGGER check_subscription_resource_categories
  BEFORE INSERT ON public.resource_categories
  FOR EACH ROW EXECUTE FUNCTION public.check_subscription_active();

CREATE TRIGGER check_subscription_resource_category_assignments
  BEFORE INSERT ON public.resource_category_assignments
  FOR EACH ROW EXECUTE FUNCTION public.check_subscription_active();
