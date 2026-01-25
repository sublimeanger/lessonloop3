import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

// Profile fetch with 3s timeout
async function fetchProfile(userId: string): Promise<Profile | null> {
  const start = Date.now();
  const timeoutPromise = new Promise<null>((resolve) => 
    setTimeout(() => {
      console.warn(`Profile fetch timeout after 3s`);
      resolve(null);
    }, 3000)
  );
  
  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log(`Profile fetch took ${Date.now() - start}ms`);
      if (error) {
        console.warn('Profile fetch failed:', error.message);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.warn(`Profile fetch exception after ${Date.now() - start}ms:`, err);
      return null;
    }
  })();
  
  return Promise.race([fetchPromise, timeoutPromise]);
}

// Roles fetch with 3s timeout
async function fetchRoles(userId: string): Promise<AppRole[]> {
  const start = Date.now();
  const timeoutPromise = new Promise<AppRole[]>((resolve) => 
    setTimeout(() => {
      console.warn(`Roles fetch timeout after 3s`);
      resolve([]);
    }, 3000)
  );
  
  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_roles', { _user_id: userId });
      console.log(`Roles fetch took ${Date.now() - start}ms`);
      if (error) {
        console.warn('Roles fetch failed:', error.message);
        return [];
      }
      return (data as AppRole[]) || [];
    } catch (err) {
      console.warn(`Roles fetch exception after ${Date.now() - start}ms:`, err);
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

  const refreshProfile = async () => {
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
  };

  // Retry profile fetch if missing after init
  useEffect(() => {
    if (isInitialised && user && !profile) {
      console.log('Profile missing after init - retrying fetch');
      const retryTimer = setTimeout(() => {
        refreshProfile();
      }, 500);
      return () => clearTimeout(retryTimer);
    }
  }, [isInitialised, user, profile]);

  useEffect(() => {
    mountedRef.current = true;
    
    // Hard timeout - 4 seconds max for initial load
    const hardTimeout = setTimeout(() => {
      if (mountedRef.current && !isInitialised) {
        console.warn('Auth hard timeout - forcing completion');
        setIsLoading(false);
        setIsInitialised(true);
      }
    }, 4000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mountedRef.current) return;
      
      console.log('Auth state change:', event);
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Fetch profile and roles in parallel
        const [profileData, rolesData] = await Promise.all([
          fetchProfile(newSession.user.id),
          fetchRoles(newSession.user.id),
        ]);
        
        if (mountedRef.current) {
          setProfile(profileData);
          setRoles(rolesData);
          setIsLoading(false);
          setIsInitialised(true);
        }
      } else {
        if (mountedRef.current) {
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
          setIsInitialised(true);
        }
      }
    });

    // Then get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('getSession error:', error);
        }
        
        if (!mountedRef.current) return;
        
        // If no session and no auth state change triggered yet, mark as initialised
        if (!initialSession) {
          setIsLoading(false);
          setIsInitialised(true);
        }
        // If there IS a session, the onAuthStateChange will handle it
        
      } catch (err) {
        console.error('Auth init error:', err);
        if (mountedRef.current) {
          setIsLoading(false);
          setIsInitialised(true);
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

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setIsLoading(false);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updateProfile = async (updates: Partial<Profile>, skipRefresh = false) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error && !skipRefresh) {
      await refreshProfile();
    }
    return { error: error as Error | null };
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const isOwnerOrAdmin = hasRole('owner') || hasRole('admin');
  const isTeacher = hasRole('teacher');
  const isParent = hasRole('parent');

  const value: AuthContextType = {
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
