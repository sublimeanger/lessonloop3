import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Resource {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface ResourceShare {
  id: string;
  resource_id: string;
  student_id: string;
  org_id: string;
  shared_by: string;
  shared_at: string;
}

export interface ResourceWithShares extends Resource {
  resource_shares: ResourceShare[];
}

export function useResources() {
  const { currentOrg } = useOrg();

  return useQuery({
    queryKey: ['resources', currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return [];

      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          resource_shares (*)
        `)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ResourceWithShares[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useUploadResource() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      title,
      description,
    }: {
      file: File;
      title: string;
      description?: string;
    }) => {
      if (!currentOrg?.id || !user?.id) {
        throw new Error('No organisation or user context');
      }

      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${currentOrg.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('teaching-resources')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create resource record
      const { data, error } = await supabase
        .from('resources')
        .insert({
          org_id: currentOrg.id,
          title,
          description: description || null,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          uploaded_by: user.id,
        })
        .select()
        .single();

      if (error) {
        // Clean up uploaded file if record creation fails
        await supabase.storage.from('teaching-resources').remove([filePath]);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({
        title: 'Resource uploaded',
        description: 'Your resource has been uploaded successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteResource() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resource: Resource) => {
      // Delete DB record first (cascade deletes shares)
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', resource.id);
      if (error) throw error;

      // Then clean up storage (best-effort — orphaned files are harmless)
      await supabase.storage
        .from('teaching-resources')
        .remove([resource.file_path]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({
        title: 'Resource deleted',
        description: 'The resource has been removed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useShareResource() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      resourceId,
      studentIds,
    }: {
      resourceId: string;
      studentIds: string[];
    }) => {
      if (!currentOrg?.id || !user?.id) {
        throw new Error('No organisation or user context');
      }

      // Get existing shares
      const { data: existingShares } = await supabase
        .from('resource_shares')
        .select('student_id')
        .eq('resource_id', resourceId);

      const existingStudentIds = new Set(existingShares?.map(s => s.student_id) || []);
      
      // Determine shares to add and remove
      const toAdd = studentIds.filter(id => !existingStudentIds.has(id));
      const toRemove = [...existingStudentIds].filter(id => !studentIds.includes(id));

      // Remove old shares
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('resource_shares')
          .delete()
          .eq('resource_id', resourceId)
          .in('student_id', toRemove);

        if (removeError) throw removeError;
      }

      // Add new shares
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('resource_shares')
          .insert(
            toAdd.map(studentId => ({
              resource_id: resourceId,
              student_id: studentId,
              org_id: currentOrg.id,
              shared_by: user.id,
            }))
          );

        if (addError) throw addError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast({
        title: 'Sharing updated',
        description: 'Resource sharing has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useResourceDownloadUrl(filePath: string) {
  return useQuery({
    queryKey: ['resource-url', filePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('teaching-resources')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!filePath,
    staleTime: 1000 * 60 * 55, // Refresh URL 5 mins before expiry
  });
}

// For parent portal - get resources shared with their children
export function useSharedResources() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();

  return useQuery({
    queryKey: ['shared-resources', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg?.id || !user?.id) return [];

      // 1. Get guardian record for current user
      const { data: guardian } = await supabase
        .from('guardians')
        .select('id')
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .maybeSingle();
      if (!guardian) return [];

      // 2. Get student IDs linked to this guardian
      const { data: studentGuardians } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardian.id);
      const studentIds = (studentGuardians || []).map(sg => sg.student_id);
      if (studentIds.length === 0) return [];

      // 3. Get resource IDs shared with these students only
      const { data: shares } = await supabase
        .from('resource_shares')
        .select('resource_id')
        .in('student_id', studentIds);
      const resourceIds = [...new Set((shares || []).map(s => s.resource_id))];
      if (resourceIds.length === 0) return [];

      // 4. Fetch only those resources
      const { data, error } = await supabase
        .from('resources')
        .select(`
          *,
          resource_shares (
            student_id,
            shared_at,
            students:student_id (
              id,
              first_name,
              last_name
            )
          )
        `)
        .in('id', resourceIds)
        .eq('org_id', currentOrg.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrg?.id && !!user?.id,
  });
}
