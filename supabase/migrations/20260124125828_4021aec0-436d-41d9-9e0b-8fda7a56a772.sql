-- Create resources table for teaching materials
CREATE TABLE public.resources (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes integer NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create resource_shares junction table
CREATE TABLE public.resource_shares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  shared_by uuid NOT NULL,
  shared_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(resource_id, student_id)
);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_shares ENABLE ROW LEVEL SECURITY;

-- RLS policies for resources
CREATE POLICY "Staff can view org resources"
  ON public.resources FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can create resources"
  ON public.resources FOR INSERT
  WITH CHECK (is_org_staff(auth.uid(), org_id) AND uploaded_by = auth.uid());

CREATE POLICY "Staff can update own resources"
  ON public.resources FOR UPDATE
  USING (is_org_staff(auth.uid(), org_id) AND (uploaded_by = auth.uid() OR is_org_admin(auth.uid(), org_id)));

CREATE POLICY "Admin can delete resources"
  ON public.resources FOR DELETE
  USING (is_org_admin(auth.uid(), org_id) OR (is_org_staff(auth.uid(), org_id) AND uploaded_by = auth.uid()));

-- Parent can view shared resources
CREATE POLICY "Parent can view shared resources"
  ON public.resources FOR SELECT
  USING (
    has_org_role(auth.uid(), org_id, 'parent'::app_role) AND
    EXISTS (
      SELECT 1 FROM public.resource_shares rs
      WHERE rs.resource_id = resources.id
      AND is_parent_of_student(auth.uid(), rs.student_id)
    )
  );

-- RLS policies for resource_shares
CREATE POLICY "Staff can view org resource shares"
  ON public.resource_shares FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can create resource shares"
  ON public.resource_shares FOR INSERT
  WITH CHECK (is_org_staff(auth.uid(), org_id) AND shared_by = auth.uid());

CREATE POLICY "Staff can delete resource shares"
  ON public.resource_shares FOR DELETE
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parent can view their children's resource shares"
  ON public.resource_shares FOR SELECT
  USING (
    has_org_role(auth.uid(), org_id, 'parent'::app_role) AND
    is_parent_of_student(auth.uid(), student_id)
  );

-- Indexes for performance
CREATE INDEX idx_resources_org_id ON public.resources(org_id);
CREATE INDEX idx_resources_uploaded_by ON public.resources(uploaded_by);
CREATE INDEX idx_resource_shares_resource_id ON public.resource_shares(resource_id);
CREATE INDEX idx_resource_shares_student_id ON public.resource_shares(student_id);

-- Trigger for updated_at
CREATE TRIGGER update_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for teaching resources
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teaching-resources',
  'teaching-resources',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'video/mp4', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
);

-- Storage RLS policies
CREATE POLICY "Staff can upload resources"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'teaching-resources' AND
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
      AND org_id::text = (storage.foldername(name))[1]
      AND role IN ('owner', 'admin', 'teacher')
      AND status = 'active'
    )
  );

CREATE POLICY "Staff can view org resources"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'teaching-resources' AND
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
      AND org_id::text = (storage.foldername(name))[1]
      AND role IN ('owner', 'admin', 'teacher', 'finance')
      AND status = 'active'
    )
  );

CREATE POLICY "Staff can delete own resources"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'teaching-resources' AND
    EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
      AND org_id::text = (storage.foldername(name))[1]
      AND role IN ('owner', 'admin', 'teacher')
      AND status = 'active'
    )
  );

CREATE POLICY "Parent can download shared resources"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'teaching-resources' AND
    EXISTS (
      SELECT 1 FROM public.resources r
      JOIN public.resource_shares rs ON rs.resource_id = r.id
      WHERE r.file_path = name
      AND is_parent_of_student(auth.uid(), rs.student_id)
    )
  );