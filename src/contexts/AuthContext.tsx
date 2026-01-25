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

// Exponential backoff retry for profile fetch
async function fetchProfileWithRetry(userId: string, maxRetries = 5): Promise<Profile | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      return data as Profile;
    }

    if (error) {
      console.warn(`Profile fetch attempt ${attempt + 1} failed:`, error.message);
    }

    // Exponential backoff: 200ms, 400ms, 800ms, 1600ms, 3200ms
    const delay = Math.min(200 * Math.pow(2, attempt), 3200);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  console.error('Profile fetch failed after all retries');
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialised, setIsInitialised] = useState(false);
  const mountedRef = useRef(true);

  const fetchRoles = async (userId: string): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase.rpc('get_user_roles', { _user_id: userId });
      if (error) {
        console.error('Error fetching roles:', error);
        return [];
      }
      return (data as AppRole[]) || [];
    } catch (err) {
      console.error('Roles fetch exception:', err);
      return [];
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const [profileData, rolesData] = await Promise.all([
        fetchProfileWithRetry(user.id, 3),
        fetchRoles(user.id),
      ]);
      if (mountedRef.current) {
        setProfile(profileData);
        setRoles(rolesData);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Hard timeout to prevent infinite loading - 6 seconds
    const hardTimeout = setTimeout(() => {
      if (mountedRef.current && isLoading) {
        console.warn('Auth hard timeout triggered - forcing completion');
        setIsLoading(false);
        setIsInitialised(true);
      }
    }, 6000);

    // Initial session fetch
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('getSession error:', error);
          if (mountedRef.current) {
            setIsLoading(false);
            setIsInitialised(true);
          }
          return;
        }
        
        if (!mountedRef.current) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const [profileData, rolesData] = await Promise.all([
            fetchProfileWithRetry(session.user.id, 5),
            fetchRoles(session.user.id),
          ]);
          
          if (mountedRef.current) {
            setProfile(profileData);
            setRoles(rolesData);
          }
        }
        
        if (mountedRef.current) {
          setIsLoading(false);
          setIsInitialised(true);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        if (mountedRef.current) {
          setIsLoading(false);
          setIsInitialised(true);
        }
      }
    };

    // Set up auth state listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;
      
      console.log('Auth state change:', event);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // For SIGNED_IN, wait a bit for trigger to create profile
        if (event === 'SIGNED_IN') {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        const [profileData, rolesData] = await Promise.all([
          fetchProfileWithRetry(session.user.id, 5),
          fetchRoles(session.user.id),
        ]);
        
        if (mountedRef.current) {
          setProfile(profileData);
          setRoles(rolesData);
        }
      } else {
        if (mountedRef.current) {
          setProfile(null);
          setRoles([]);
        }
      }
      
      if (mountedRef.current) {
        setIsLoading(false);
        setIsInitialised(true);
      }
    });

    // Then get initial session
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
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
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
