import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CalendarConnection {
  id: string;
  user_id: string;
  org_id: string;
  provider: 'google' | 'apple' | 'zoom';
  calendar_id: string | null;
  calendar_name: string | null;
  sync_enabled: boolean;
  last_sync_at: string | null;
  sync_status: 'active' | 'error' | 'disconnected';
  ical_token: string | null;
  ical_token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCalendarConnections() {
  const { currentOrg } = useOrg();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch user's calendar connections
  const { data: connections, isLoading, refetch } = useQuery({
    queryKey: ['calendar-connections', currentOrg?.id, user?.id],
    queryFn: async () => {
      if (!currentOrg || !user) return [];

      const { data, error } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('user_id', user.id);

      if (error) throw error;
      return (data || []) as CalendarConnection[];
    },
    enabled: !!currentOrg && !!user,
  });

  const googleConnection = connections?.find(c => c.provider === 'google');
  const appleConnection = connections?.find(c => c.provider === 'apple');
  const zoomConnection = connections?.find(c => c.provider === 'zoom');

  // Generate iCal URL for Apple Calendar
  const generateICalUrl = useCallback(async () => {
    if (!currentOrg || !user) return null;

    // Check if we already have an Apple connection with a valid (non-expired) token
    const isTokenValid = appleConnection?.ical_token && 
      appleConnection.ical_token_expires_at && 
      new Date(appleConnection.ical_token_expires_at) > new Date();
    if (isTokenValid) {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${baseUrl}/functions/v1/calendar-ical-feed?token=${appleConnection.ical_token}`;
    }

    // Create a new Apple connection with iCal token (90-day expiry)
    const icalToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('calendar_connections')
      .upsert({
        user_id: user.id,
        org_id: currentOrg.id,
        provider: 'apple',
        ical_token: icalToken,
        ical_token_expires_at: expiresAt,
        sync_enabled: true,
        sync_status: 'active',
      }, {
        onConflict: 'user_id,org_id,provider',
      })
      .select('ical_token')
      .single();

    if (error) {
      logger.error('Error creating iCal connection:', error);
      return null;
    }

    await refetch();
    
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/calendar-ical-feed?token=${data.ical_token}`;
  }, [currentOrg, user, appleConnection, refetch]);

  // Get iCal URL (already generated)
  const getICalUrl = useCallback(() => {
    if (!appleConnection?.ical_token || 
        !appleConnection.ical_token_expires_at || 
        new Date(appleConnection.ical_token_expires_at) <= new Date()) return null;
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/calendar-ical-feed?token=${appleConnection.ical_token}`;
  }, [appleConnection]);

  // Regenerate iCal token
  const regenerateICalToken = useMutation({
    mutationFn: async () => {
      if (!currentOrg || !user) throw new Error('Not authenticated');

      const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from('calendar_connections')
        .update({ 
          ical_token: newToken, 
          ical_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('org_id', currentOrg.id)
        .eq('provider', 'apple');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      toast({ title: 'iCal link regenerated', description: 'Your old link will no longer work.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to regenerate link', variant: 'destructive' });
    },
  });

  // Connect Google Calendar
  const connectGoogle = useCallback(async () => {
    if (!currentOrg) return;
    setIsConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('calendar-oauth-start', {
        body: { 
          org_id: currentOrg.id,
          redirect_uri: window.location.origin + '/settings?tab=calendar',
        },
      });

      if (response.error) throw response.error;

      const { auth_url } = response.data;
      if (auth_url) {
        window.location.href = auth_url;
      } else {
        throw new Error('No auth URL returned');
      }
    } catch (error: any) {
      logger.error('Error starting Google OAuth:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Could not connect to Google Calendar',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  }, [currentOrg, toast]);

  // Connect Zoom
  const connectZoom = useCallback(async () => {
    if (!currentOrg) return;
    setIsConnecting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('zoom-oauth-start', {
        body: {
          org_id: currentOrg.id,
          redirect_uri: window.location.origin + '/settings?tab=calendar',
        },
      });

      if (response.error) throw response.error;

      const { auth_url } = response.data;
      if (auth_url) {
        window.location.href = auth_url;
      } else {
        throw new Error('No auth URL returned');
      }
    } catch (error: any) {
      logger.error('Error starting Zoom OAuth:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Could not connect to Zoom',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  }, [currentOrg, toast]);

  // Disconnect calendar
  const disconnectCalendar = useMutation({
    mutationFn: async ({ connectionId, deleteEvents = false }: { connectionId: string; deleteEvents?: boolean }) => {
      const response = await supabase.functions.invoke('calendar-disconnect', {
        body: { connection_id: connectionId, delete_events: deleteEvents },
      });

      if (response.error) throw response.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      toast({ title: 'Calendar disconnected' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to disconnect calendar', variant: 'destructive' });
    },
  });

  // Toggle sync enabled
  const toggleSync = useMutation({
    mutationFn: async ({ connectionId, enabled }: { connectionId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('calendar_connections')
        .update({ sync_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });

  // Trigger manual sync
  const triggerSync = useMutation({
    mutationFn: async (connectionId?: string) => {
      const response = await supabase.functions.invoke('calendar-fetch-busy', {
        body: connectionId ? { connection_id: connectionId } : { user_id: user?.id },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      toast({ title: 'Sync complete', description: `Synced ${data.synced} calendar(s)` });
    },
    onError: () => {
      toast({ title: 'Sync failed', description: 'Could not sync calendar data', variant: 'destructive' });
    },
  });

  // Generate iCal URL for parent portal feed (scoped to guardian's children)
  const generateParentICalUrl = useCallback(async (guardianId: string) => {
    if (!currentOrg || !user) return null;

    // Check for existing parent connection with valid token
    const { data: existing } = await supabase
      .from('calendar_connections')
      .select('ical_token, ical_token_expires_at')
      .eq('user_id', user.id)
      .eq('org_id', currentOrg.id)
      .eq('provider', 'apple')
      .eq('guardian_id', guardianId)
      .maybeSingle();

    if (existing?.ical_token && existing.ical_token_expires_at &&
        new Date(existing.ical_token_expires_at) > new Date()) {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${baseUrl}/functions/v1/calendar-ical-feed?token=${existing.ical_token}`;
    }

    // Create new parent connection (insert, not upsert, since unique index uses COALESCE)
    const icalToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('calendar_connections')
      .insert({
        user_id: user.id,
        org_id: currentOrg.id,
        provider: 'apple',
        guardian_id: guardianId,
        ical_token: icalToken,
        ical_token_expires_at: expiresAt,
        sync_enabled: true,
        sync_status: 'active',
      })
      .select('ical_token')
      .single();

    if (error) {
      // If conflict (already exists but expired), update instead
      if (error.code === '23505') {
        const { data: updated, error: updateError } = await supabase
          .from('calendar_connections')
          .update({
            ical_token: icalToken,
            ical_token_expires_at: expiresAt,
            sync_enabled: true,
            sync_status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('org_id', currentOrg.id)
          .eq('provider', 'apple')
          .eq('guardian_id', guardianId)
          .select('ical_token')
          .single();

        if (updateError) {
          logger.error('Error updating parent iCal connection:', updateError);
          return null;
        }

        const baseUrl = import.meta.env.VITE_SUPABASE_URL;
        return `${baseUrl}/functions/v1/calendar-ical-feed?token=${updated.ical_token}`;
      }

      logger.error('Error creating parent iCal connection:', error);
      return null;
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${baseUrl}/functions/v1/calendar-ical-feed?token=${data.ical_token}`;
  }, [currentOrg, user]);

  // Handle OAuth callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const calendarConnected = params.get('calendar_connected');
    const calendarError = params.get('calendar_error');

    if (calendarConnected) {
      // Slight delay to ensure toast system is ready after redirect
      setTimeout(() => {
        toast({ 
          title: '✓ Google Calendar connected successfully!', 
          description: 'Your lessons will now sync automatically. Manage your connection below.',
          duration: 8000,
        });
      }, 500);
      // Clean up URL but keep on calendar tab
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_connected');
      url.searchParams.set('tab', 'calendar');
      window.history.replaceState({}, '', url.toString());
      refetch();
    }

    if (calendarError) {
      let errorMessage = 'Could not connect to Google Calendar';
      if (calendarError === 'not_configured') {
        errorMessage = 'Google Calendar integration is not configured';
      } else if (calendarError === 'token_exchange_failed') {
        errorMessage = 'Failed to authenticate with Google';
      }
      toast({ title: 'Connection failed', description: errorMessage, variant: 'destructive' });
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('calendar_error');
      window.history.replaceState({}, '', url.toString());
    }

    // Handle Zoom OAuth callback params
    const zoomConnected = params.get('zoom_connected');
    const zoomError = params.get('zoom_error');

    if (zoomConnected) {
      setTimeout(() => {
        toast({
          title: 'Zoom connected successfully!',
          description: 'Online lessons will now automatically get Zoom meeting links.',
          duration: 8000,
        });
      }, 500);
      const url = new URL(window.location.href);
      url.searchParams.delete('zoom_connected');
      url.searchParams.set('tab', 'calendar');
      window.history.replaceState({}, '', url.toString());
      refetch();
    }

    if (zoomError) {
      let errorMessage = 'Could not connect to Zoom';
      if (zoomError === 'not_configured') {
        errorMessage = 'Zoom integration is not configured';
      } else if (zoomError === 'token_exchange_failed') {
        errorMessage = 'Failed to authenticate with Zoom';
      }
      toast({ title: 'Connection failed', description: errorMessage, variant: 'destructive' });
      const url = new URL(window.location.href);
      url.searchParams.delete('zoom_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [toast, refetch]);

  return {
    connections,
    googleConnection,
    appleConnection,
    zoomConnection,
    isLoading,
    isConnecting,
    connectGoogle,
    connectZoom,
    disconnectCalendar,
    toggleSync,
    triggerSync,
    generateICalUrl,
    generateParentICalUrl,
    getICalUrl,
    regenerateICalToken,
    refetch,
  };
}
