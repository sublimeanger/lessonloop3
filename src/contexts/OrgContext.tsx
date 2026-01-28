import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, AppRole } from './AuthContext';

export type OrgType = 'solo_teacher' | 'studio' | 'academy' | 'agency';
export type MembershipStatus = 'active' | 'invited' | 'disabled';
export type BillingApproach = 'monthly' | 'termly' | 'custom';
export type SubscriptionPlan = 'trial' | 'solo_teacher' | 'academy' | 'agency' | 'custom';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused';

export interface Organisation {
  id: string;
  name: string;
  org_type: OrgType;
  country_code: string;
  currency_code: string;
  timezone: string;
  vat_enabled: boolean;
  vat_rate: number;
  vat_registration_number: string | null;
  billing_approach: BillingApproach;
  default_lesson_length_mins: number;
  block_scheduling_on_closures: boolean;
  created_by: string;
  created_at: string;
  // Hardening fields
  cancellation_notice_hours?: number;
  buffer_minutes_between_locations?: number | null;
  overdue_reminder_days?: number[] | null;
  auto_pause_lessons_after_days?: number | null;
  // Parent portal scheduling policy
  parent_reschedule_policy?: 'self_service' | 'request_only' | 'admin_locked';
  // Subscription fields
  subscription_plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string | null;
  max_students: number;
  max_teachers: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface OrgMembership {
  id: string;
  org_id: string;
  user_id: string;
  role: AppRole;
  status: MembershipStatus;
  created_at: string;
  organisation?: Organisation;
}

interface OrgContextType {
  currentOrg: Organisation | null;
  currentRole: AppRole | null;
  organisations: Organisation[];
  memberships: OrgMembership[];
  isLoading: boolean;
  hasInitialised: boolean;
  hasOrgs: boolean;
  setCurrentOrg: (orgId: string) => Promise<void>;
  createOrganisation: (data: CreateOrgData) => Promise<{ org: Organisation | null; error: Error | null }>;
  refreshOrganisations: () => Promise<void>;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
}

interface CreateOrgData {
  name: string;
  org_type?: OrgType;
  country_code?: string;
  currency_code?: string;
  timezone?: string;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user, profile, isInitialised: authInitialised } = useAuth();
  const [currentOrg, setCurrentOrgState] = useState<Organisation | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitialised, setHasInitialised] = useState(false);
  const mountedRef = useRef(true);

  const fetchOrganisations = async () => {
    if (!user) {
      setOrganisations([]);
      setMemberships([]);
      setCurrentOrgState(null);
      setCurrentRole(null);
      setIsLoading(false);
      setHasInitialised(true);
      return;
    }

    try {
      setIsLoading(true);
      
      // Fetch memberships with organisation details
      const { data: membershipData, error: membershipError } = await supabase
        .from('org_memberships')
        .select(`
          *,
          organisation:organisations(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!mountedRef.current) return;

      if (membershipError) {
        console.error('Error fetching memberships:', membershipError);
        setIsLoading(false);
        setHasInitialised(true);
        return;
      }

      const typedMemberships = (membershipData || []).map((m: any) => ({
        ...m,
        organisation: m.organisation as Organisation,
      })) as OrgMembership[];

      setMemberships(typedMemberships);
      
      const orgs = typedMemberships
        .filter((m) => m.organisation)
        .map((m) => m.organisation as Organisation);
      setOrganisations(orgs);

      // Set current org based on profile.current_org_id or first available
      const currentOrgId = profile?.current_org_id;
      let selectedOrg: Organisation | null = null;
      let selectedRole: AppRole | null = null;

      if (currentOrgId) {
        const membership = typedMemberships.find((m) => m.org_id === currentOrgId);
        if (membership) {
          selectedOrg = membership.organisation || null;
          selectedRole = membership.role;
        }
      }

      // Fallback to first org if current_org_id not set or not found
      if (!selectedOrg && typedMemberships.length > 0) {
        const firstMembership = typedMemberships[0];
        selectedOrg = firstMembership.organisation || null;
        selectedRole = firstMembership.role;
        
        // Update profile with this org (fire and forget)
        if (selectedOrg) {
          supabase
            .from('profiles')
            .update({ current_org_id: selectedOrg.id })
            .eq('id', user.id)
            .then(() => {});
        }
      }

      setCurrentOrgState(selectedOrg);
      setCurrentRole(selectedRole);
    } catch (error) {
      console.error('Error in fetchOrganisations:', error);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setHasInitialised(true);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Only fetch orgs once auth is initialised
    if (authInitialised) {
      fetchOrganisations();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [user?.id, authInitialised, profile?.current_org_id]);

  const setCurrentOrg = async (orgId: string) => {
    const membership = memberships.find((m) => m.org_id === orgId);
    if (!membership) return;

    const org = membership.organisation || null;
    setCurrentOrgState(org);
    setCurrentRole(membership.role);

    // Update profile
    if (user) {
      await supabase
        .from('profiles')
        .update({ current_org_id: orgId })
        .eq('id', user.id);
    }
  };

  const createOrganisation = async (data: CreateOrgData) => {
    if (!user) return { org: null, error: new Error('Not authenticated') };

    const { data: org, error } = await supabase
      .from('organisations')
      .insert({
        name: data.name,
        org_type: data.org_type || 'solo_teacher',
        country_code: data.country_code || 'GB',
        currency_code: data.currency_code || 'GBP',
        timezone: data.timezone || 'Europe/London',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return { org: null, error: error as unknown as Error };
    }

    // Refresh organisations to include the new one
    await fetchOrganisations();
    
    return { org: org as Organisation, error: null };
  };

  const refreshOrganisations = async () => {
    await fetchOrganisations();
  };

  const isOrgAdmin = currentRole === 'owner' || currentRole === 'admin';
  const isOrgOwner = currentRole === 'owner';
  const hasOrgs = organisations.length > 0;

  const value: OrgContextType = {
    currentOrg,
    currentRole,
    organisations,
    memberships,
    isLoading,
    hasInitialised,
    hasOrgs,
    setCurrentOrg,
    createOrganisation,
    refreshOrganisations,
    isOrgAdmin,
    isOrgOwner,
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (context === undefined) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
}
