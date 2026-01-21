import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isOwnerOrAdmin: boolean;
  isTeacher: boolean;
  isParent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initComplete, setInitComplete] = useState(false);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.error('Profile fetch exception:', err);
      return null;
    }
  };

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
        fetchProfile(user.id),
        fetchRoles(user.id),
      ]);
      setProfile(profileData);
      setRoles(rolesData);
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Set a hard timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('Auth loading timeout - forcing completion');
        setIsLoading(false);
        setInitComplete(true);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const [profileData, rolesData] = await Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
        ]);
        if (mounted) {
          setProfile(profileData);
          setRoles(rolesData);
        }
      }
      
      if (mounted) {
        setIsLoading(false);
        setInitComplete(true);
      }
    }).catch((err) => {
      console.error('getSession error:', err);
      if (mounted) {
        setIsLoading(false);
        setInitComplete(true);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state change:', event);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Small delay to let trigger create profile
        if (event === 'SIGNED_IN') {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const [profileData, rolesData] = await Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
        ]);
        if (mounted) {
          setProfile(profileData);
          setRoles(rolesData);
        }
      } else {
        if (mounted) {
          setProfile(null);
          setRoles([]);
        }
      }
      
      if (mounted) {
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No user logged in') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
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
