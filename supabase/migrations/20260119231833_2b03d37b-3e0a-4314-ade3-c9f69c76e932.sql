-- Create enum for billing approach
CREATE TYPE public.billing_approach AS ENUM ('monthly', 'termly', 'custom');

-- Create enum for day of week
CREATE TYPE public.day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- Add billing settings to organisations
ALTER TABLE public.organisations 
ADD COLUMN billing_approach billing_approach NOT NULL DEFAULT 'monthly',
ADD COLUMN default_lesson_length_mins INTEGER NOT NULL DEFAULT 60;

-- Create teacher_profiles table (extended profile for teachers)
CREATE TABLE public.teacher_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  instruments TEXT[] NOT NULL DEFAULT '{}',
  default_lesson_length_mins INTEGER NOT NULL DEFAULT 60,
  teaching_address TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

-- Create availability_templates table (working hours per day)
CREATE TABLE public.availability_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id, day_of_week)
);

-- Create rate_cards table
CREATE TABLE public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration_mins INTEGER NOT NULL DEFAULT 60,
  rate_amount NUMERIC(10,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'GBP',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create locations table
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  postcode TEXT,
  country_code TEXT NOT NULL DEFAULT 'GB',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for teacher_profiles
CREATE POLICY "Users can view teacher profiles in their org"
  ON public.teacher_profiles FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can manage their own teacher profile"
  ON public.teacher_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can update their own teacher profile"
  ON public.teacher_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own teacher profile"
  ON public.teacher_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for availability_templates
CREATE POLICY "Users can view availability in their org"
  ON public.availability_templates FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can manage their own availability"
  ON public.availability_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Users can update their own availability"
  ON public.availability_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability"
  ON public.availability_templates FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for rate_cards
CREATE POLICY "Members can view org rate cards"
  ON public.rate_cards FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create rate cards"
  ON public.rate_cards FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update rate cards"
  ON public.rate_cards FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete rate cards"
  ON public.rate_cards FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- RLS policies for locations
CREATE POLICY "Members can view org locations"
  ON public.locations FOR SELECT
  USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create locations"
  ON public.locations FOR INSERT
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update locations"
  ON public.locations FOR UPDATE
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete locations"
  ON public.locations FOR DELETE
  USING (public.is_org_admin(auth.uid(), org_id));

-- Trigger for updated_at on teacher_profiles
CREATE TRIGGER update_teacher_profiles_updated_at
  BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on rate_cards
CREATE TRIGGER update_rate_cards_updated_at
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on locations
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes
CREATE INDEX idx_teacher_profiles_org_id ON public.teacher_profiles(org_id);
CREATE INDEX idx_teacher_profiles_user_id ON public.teacher_profiles(user_id);
CREATE INDEX idx_availability_templates_user_org ON public.availability_templates(user_id, org_id);
CREATE INDEX idx_rate_cards_org_id ON public.rate_cards(org_id);
CREATE INDEX idx_locations_org_id ON public.locations(org_id);