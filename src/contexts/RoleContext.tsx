import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'owner' | 'admin' | 'teacher' | 'parent';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isOwnerOrAdmin: boolean;
  isTeacher: boolean;
  isParent: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  // Default to owner for demo purposes
  const [role, setRole] = useState<UserRole>('owner');

  const value: RoleContextType = {
    role,
    setRole,
    isOwnerOrAdmin: role === 'owner' || role === 'admin',
    isTeacher: role === 'teacher',
    isParent: role === 'parent',
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
