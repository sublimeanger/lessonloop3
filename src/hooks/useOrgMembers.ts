import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/contexts/AuthContext';

export interface OrgMember {
  id: string;
  user_id: string;
  role: AppRole;
  status: string;
  profile?: {
    full_name: string | null;
    email: string | null;
  };
}

const ASSIGNABLE_ROLES: AppRole[] = ['admin', 'teacher', 'finance'];

export function useOrgMembers() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['org-members', currentOrg?.id],
    queryFn: async (): Promise<OrgMember[]> => {
      if (!currentOrg) return [];

      const { data: memberData } = await supabase
        .from('org_memberships')
        .select('*')
        .eq('org_id', currentOrg.id)
        .neq('status', 'disabled');

      if (!memberData?.length) return [];

      const userIds = memberData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, { full_name: p.full_name, email: p.email }])
      );

      const members: OrgMember[] = memberData.map(member => ({
        ...member,
        profile: profileMap.get(member.user_id) || undefined,
      }));

      members.sort((a, b) => {
        if (a.role === 'owner') return -1;
        if (b.role === 'owner') return 1;
        return (a.profile?.full_name || '').localeCompare(b.profile?.full_name || '');
      });

      return members;
    },
    enabled: !!currentOrg,
    staleTime: 5 * 60 * 1000,
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: AppRole }) => {
      if (!ASSIGNABLE_ROLES.includes(newRole)) {
        throw new Error('Invalid role');
      }
      const { error } = await supabase
        .from('org_memberships')
        .update({ role: newRole })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Role updated' });
      queryClient.invalidateQueries({ queryKey: ['org-members', currentOrg?.id] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const disableMemberMutation = useMutation({
    mutationFn: async ({ memberId }: { memberId: string; memberName: string }) => {
      const { error } = await supabase
        .from('org_memberships')
        .update({ status: 'disabled' })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      toast({ title: 'Member disabled', description: `${variables.memberName} no longer has access.` });
      queryClient.invalidateQueries({ queryKey: ['org-members', currentOrg?.id] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    members: query.data || [],
    isLoading: query.isLoading,
    changeRole: changeRoleMutation.mutate,
    disableMember: disableMemberMutation.mutate,
    updatingMember: changeRoleMutation.isPending || disableMemberMutation.isPending
      ? (changeRoleMutation.variables?.memberId || disableMemberMutation.variables?.memberId || null)
      : null,
  };
}
