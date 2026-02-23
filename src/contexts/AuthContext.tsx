import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Sentry } from '@/lib/sentry';
import { logger } from '@/lib/logger';
import { safeRemoveItem } from '@/lib/storage';

export type AppRole = 'owner' | 'admin' | 'teacher' | 'finance' | 'parent';

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  has_completed_onboarding: boolean;
  current_org_id: string | null;
  created_at: string;
  updated_at: string;
  first_run_completed?: boolean;
  first_run_path?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isInitialised: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>, skipRefresh?: boolean) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isOwnerOrAdmin: boolean;
  isTeacher: boolean;
  isParent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Profile fetch with 5s timeout (increased from 3s for slow connections)
async function fetchProfile(userId: string): Promise<Profile | null> {
  const start = Date.now();
  const timeoutPromise = new Promise<null>((resolve) => 
    setTimeout(() => {
      logger.warn('Profile fetch timeout after 5s');
      resolve(null);
    }, 5000)
  );
  
  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      logger.debug(`Profile fetch took ${Date.now() - start}ms`);
      if (error) {
        logger.warn('Profile fetch failed:', error.message);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      logger.warn(`Profile fetch exception after ${Date.now() - start}ms:`, err);
      return null;
    }
  })();
  
  return Promise.race([fetchPromise, timeoutPromise]);
}

// Roles fetch with 5s timeout (increased from 3s for slow connections)
async function fetchRoles(userId: string): Promise<AppRole[]> {
  const start = Date.now();
  const timeoutPromise = new Promise<AppRole[]>((resolve) => 
    setTimeout(() => {
      logger.warn('Roles fetch timeout after 5s');
      resolve([]);
    }, 5000)
  );
  
  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_roles', { _user_id: userId });
      logger.debug(`Roles fetch took ${Date.now() - start}ms`);
      if (error) {
        logger.warn('Roles fetch failed:', error.message);
        return [];
      }
      return (data as AppRole[]) || [];
    } catch (err) {
      logger.warn(`Roles fetch exception after ${Date.now() - start}ms:`, err);
      return [];
    }
  })();
  
  return Promise.race([fetchPromise, timeoutPromise]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialised, setIsInitialised] = useState(false);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false); // Prevent duplicate fetches
  const initialisedRef = useRef(false); // Track init state for timeout closure
  const profileIdRef = useRef<string | null>(null); // Track profile id for closure access

  const refreshProfile = useCallback(async () => {
    if (user) {
      const [profileData, rolesData] = await Promise.all([
        fetchProfile(user.id),
        fetchRoles(user.id),
      ]);
      if (mountedRef.current) {
        setProfile(profileData);
        setRoles(rolesData);
      }
    }
  }, [user]);

  // Keep profileIdRef in sync with profile state
  useEffect(() => {
    profileIdRef.current = profile?.id ?? null;
  }, [profile]);

  // Self-healing: ensure profile exists via edge function if missing
  const ensureProfileExists = useCallback(async (accessToken: string): Promise<boolean> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/profile-ensure`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        logger.debug('[Auth] Profile ensure result:', data.created ? 'created' : 'exists');
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[Auth] Profile ensure failed:', err);
      return false;
    }
  }, []);

  // Retry profile fetch if missing after init, with self-healing
  useEffect(() => {
    if (isInitialised && user && !profile && session) {
      logger.debug('[Auth] Profile missing after init - attempting recovery');
      
      const recoverProfile = async () => {
        // First try to ensure profile exists
        const success = await ensureProfileExists(session.access_token);
        if (success && mountedRef.current) {
          // Now fetch the profile again
          await refreshProfile();
        }
      };
      
      const retryTimer = setTimeout(recoverProfile, 500);
      return () => clearTimeout(retryTimer);
    }
  }, [isInitialised, user, profile, session, ensureProfileExists, refreshProfile]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Hard timeout - 4 seconds max for initial load
    const hardTimeout = setTimeout(() => {
      if (mountedRef.current && !initialisedRef.current) {
        logger.warn('Auth hard timeout - forcing completion');
        setIsLoading(false);
        setIsInitialised(true);
        initialisedRef.current = true;
      }
    }, 4000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;
      
      logger.debug('Auth state change:', event, 'isInitialised:', isInitialised);
      
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        if (event === 'TOKEN_REFRESHED') {
          logger.debug('Token refreshed - skipping profile refetch');
          if (!initialisedRef.current && mountedRef.current) {
            setIsLoading(false);
            setIsInitialised(true);
            initialisedRef.current = true;
          }
          return;
        }

        if (initialisedRef.current && profileIdRef.current === newSession.user.id) {
          logger.debug('Already initialised with same user - skipping refetch');
          return;
        }
        
        if (fetchingRef.current) {
          return;
        }
        fetchingRef.current = true;
        
        const [profileData, rolesData] = await Promise.all([
          fetchProfile(newSession.user.id),
          fetchRoles(newSession.user.id),
        ]);
        
        if (mountedRef.current) {
          setProfile(profileData);
          setRoles(rolesData);
          setIsLoading(false);
          setIsInitialised(true);
          initialisedRef.current = true;
          Sentry.setUser({ id: newSession.user.id, email: newSession.user.email });
        }
        fetchingRef.current = false;
      } else {
        if (mountedRef.current) {
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
          setIsInitialised(true);
          initialisedRef.current = true;
          Sentry.setUser(null);
        }
      }
    });

    // Then get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          logger.error('getSession error:', error);
        }
        
        if (!mountedRef.current) return;
        
        if (!initialSession) {
          setIsLoading(false);
          setIsInitialised(true);
          initialisedRef.current = true;
        }
      } catch (err) {
        logger.error('Auth init error:', err);
        if (mountedRef.current) {
          setIsLoading(false);
          setIsInitialised(true);
          initialisedRef.current = true;
        }
      }
    };

    initializeAuth();

    return () => {
      mountedRef.current = false;
      clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      // SEC-AUTH-03: Normalise error message to prevent account enumeration.
      // Supabase may return different messages for "user not found" vs "wrong password"
      // — we collapse both into one generic message so attackers learn nothing.
      const msg = (error.message || '').toLowerCase();
      const isCredentialError =
        msg.includes('invalid login') ||
        msg.includes('invalid credentials') ||
        msg.includes('user not found') ||
        msg.includes('no user') ||
        msg.includes('wrong password') ||
        msg.includes('invalid email or password');
      if (isCredentialError) {
        return { error: new Error('Invalid email or password') };
      }
      return { error: error as Error };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);

    // Clear state immediately so UI reflects signed-out status
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    profileIdRef.current = null;
    fetchingRef.current = false;

    // SEC-AUTH-07: Sign out globally to invalidate refresh tokens server-side,
    // preventing reuse of old JWTs after logout.
    // Falls back to local-only signout if global fails (e.g. network error).
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    }

    // Belt-and-suspenders: clear the auth token from storage
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (projectId) {
      safeRemoveItem(`sb-${projectId}-auth-token`);
    }

    Sentry.setUser(null);
    setIsLoading(false);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>, skipRefresh = false) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error && !skipRefresh) {
      await refreshProfile();
    }
    return { error: error as Error | null };
  }, [user, refreshProfile]);

  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);
  const isOwnerOrAdmin = useMemo(() => roles.includes('owner') || roles.includes('admin'), [roles]);
  const isTeacher = useMemo(() => roles.includes('teacher'), [roles]);
  const isParent = useMemo(() => roles.includes('parent'), [roles]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    profile,
    roles,
    isLoading,
    isInitialised,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    refreshProfile,
    hasRole,
    isOwnerOrAdmin,
    isTeacher,
    isParent,
  }), [user, session, profile, roles, isLoading, isInitialised, signUp, signIn, signOut, resetPassword, updateProfile, refreshProfile, hasRole, isOwnerOrAdmin, isTeacher, isParent]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
