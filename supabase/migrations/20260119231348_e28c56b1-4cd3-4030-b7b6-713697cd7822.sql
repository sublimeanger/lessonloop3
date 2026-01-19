-- Create enums for organisation types and membership status
CREATE TYPE public.org_type AS ENUM ('solo_teacher', 'studio', 'academy', 'agency');
CREATE TYPE public.membership_status AS ENUM ('active', 'invited', 'disabled');

-- Create organisations table
CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type org_type NOT NULL DEFAULT 'solo_teacher',
  country_code TEXT NOT NULL DEFAULT 'GB',
  currency_code TEXT NOT NULL DEFAULT 'GBP',
  timezone TEXT NOT NULL DEFAULT 'Europe/London',
  vat_enabled BOOLEAN NOT NULL DEFAULT false,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  vat_registration_number TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create org_memberships table
CREATE TABLE public.org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  status membership_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- Create invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (org_id, email)
);

-- Add current_org_id to profiles for "current org" selection
ALTER TABLE public.profiles 
ADD COLUMN current_org_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

-- Enable RLS on all tables
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECURITY DEFINER FUNCTIONS (to avoid RLS recursion)
-- =====================================================

-- Check if user is an active member of an organisation
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND status = 'active'
  )
$$;

-- Check if user has a specific role in an organisation
CREATE OR REPLACE FUNCTION public.has_org_role(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role = _role
      AND status = 'active'
  )
$$;

-- Check if user is owner or admin in an organisation
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin')
      AND status = 'active'
  )
$$;

-- Get all org IDs where user is an active member
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(org_id)
  FROM public.org_memberships
  WHERE user_id = _user_id
    AND status = 'active'
$$;

-- Get user's role in a specific org
CREATE OR REPLACE FUNCTION public.get_org_role(_user_id UUID, _org_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.org_memberships
  WHERE user_id = _user_id
    AND org_id = _org_id
    AND status = 'active'
  LIMIT 1
$$;

-- =====================================================
-- RLS POLICIES FOR ORGANISATIONS
-- =====================================================

-- Users can view organisations they are members of
CREATE POLICY "Users can view their organisations"
  ON public.organisations
  FOR SELECT
  USING (public.is_org_member(auth.uid(), id));

-- Users can create organisations (they become owner)
CREATE POLICY "Authenticated users can create organisations"
  ON public.organisations
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only owners/admins can update their organisations
CREATE POLICY "Org admins can update organisations"
  ON public.organisations
  FOR UPDATE
  USING (public.is_org_admin(auth.uid(), id));

-- Only owners can delete organisations
CREATE POLICY "Org owners can delete organisations"
  ON public.organisations
  FOR DELETE
  USING (public.has_org_role(auth.uid(), id, 'owner'));

-- =====================================================
-- RLS POLICIES FOR ORG_MEMBERSHIPS
-- =====================================================

-- Users can view memberships for their organisations
CREATE POLICY "Members can view org memberships"
  ON public.org_memberships
  FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

-- Only admins can create memberships
CREATE POLICY "Org admins can create memberships"
  ON public.org_memberships
  FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- Only admins can update memberships (but not demote owners)
CREATE POLICY "Org admins can update memberships"
  ON public.org_memberships
  FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));

-- Only admins can delete memberships (but not remove owners)
CREATE POLICY "Org admins can delete memberships"
  ON public.org_memberships
  FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id) AND role != 'owner');

-- =====================================================
-- RLS POLICIES FOR INVITES
-- =====================================================

-- Admins can view invites for their organisations
CREATE POLICY "Org admins can view invites"
  ON public.invites
  FOR SELECT
  USING (public.is_org_admin(auth.uid(), org_id));

-- Only admins can create invites
CREATE POLICY "Org admins can create invites"
  ON public.invites
  FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- Only admins can update invites
CREATE POLICY "Org admins can update invites"
  ON public.invites
  FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));

-- Only admins can delete invites
CREATE POLICY "Org admins can delete invites"
  ON public.invites
  FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- =====================================================
-- TRIGGER: Auto-create owner membership when org is created
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_organisation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create owner membership for the creator
  INSERT INTO public.org_memberships (org_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'owner', 'active');
  
  -- Set this as the user's current org if they don't have one
  UPDATE public.profiles
  SET current_org_id = NEW.id
  WHERE id = NEW.created_by
    AND current_org_id IS NULL;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organisation_created
  AFTER INSERT ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organisation();

-- Create index for performance
CREATE INDEX idx_org_memberships_user_id ON public.org_memberships(user_id);
CREATE INDEX idx_org_memberships_org_id ON public.org_memberships(org_id);
CREATE INDEX idx_invites_token ON public.invites(token);
CREATE INDEX idx_invites_email ON public.invites(email);