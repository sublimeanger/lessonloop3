import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useToast } from '@/hooks/use-toast';

export interface ResourceCategory {
  id: string;
  org_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export function useResourceCategories() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['resource-categories', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from('resource_categories')
        .select('*')
        .eq('org_id', currentOrg.id)
        .order('name');
      if (error) throw error;
      return data as ResourceCategory[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCreateCategory() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      if (!currentOrg?.id) throw new Error('No organisation');
      const { data, error } = await supabase
        .from('resource_categories')
        .insert({ org_id: currentOrg.id, name, color: color || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-categories'] });
      toast({ title: 'Category created' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create category', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateCategory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name: string; color?: string | null }) => {
      const { error } = await supabase
        .from('resource_categories')
        .update({ name, color: color ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-categories'] });
      toast({ title: 'Category updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update category', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteCategory() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!currentOrg?.id) throw new Error('No organisation selected');
      const { error } = await supabase
        .from('resource_categories')
        .delete()
        .eq('id', id)
        .eq('org_id', currentOrg.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-categories'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({ title: 'Category deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete category', description: error.message, variant: 'destructive' });
    },
  });
}

export function useAssignCategories() {
  const { currentOrg } = useOrg();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ resourceId, categoryIds }: { resourceId: string; categoryIds: string[] }) => {
      if (!currentOrg?.id) throw new Error('No organisation');

      // Delete existing assignments for this resource
      const { error: delError } = await supabase
        .from('resource_category_assignments')
        .delete()
        .eq('resource_id', resourceId)
        .eq('org_id', currentOrg.id);
      if (delError) throw delError;

      // Insert new assignments
      if (categoryIds.length > 0) {
        const { error: insError } = await supabase
          .from('resource_category_assignments')
          .insert(
            categoryIds.map(categoryId => ({
              resource_id: resourceId,
              category_id: categoryId,
              org_id: currentOrg.id,
            }))
          );
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
  });
}
