
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface ModuleAccess {
  moduleKey: string;
  accessLevel: string;
  enabledActions: string[];
  source: string;
}

interface PermissionsContextType {
  loading: boolean;
  accessList: ModuleAccess[];
  checkPermission: (moduleKey: string, action: string) => boolean;
  hasModuleAccess: (moduleKey: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  loading: true,
  accessList: [],
  checkPermission: () => false,
  hasModuleAccess: () => false,
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [accessList, setAccessList] = useState<ModuleAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccess() {
      if (status === 'authenticated' && session?.user) {
        try {
          const res = await fetch('/api/users/me/access', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setAccessList(data.data || []);
          }
        } catch (error) {
          console.error('Failed to fetch module access:', error);
        } finally {
          setLoading(false);
        }
      } else if (status === 'unauthenticated') {
        setAccessList([]);
        setLoading(false);
      }
    }

    fetchAccess();
  }, [session, status]);

  const checkPermission = (moduleKey: string, action: string) => {
    const access = accessList.find((m) => m.moduleKey === moduleKey);
    if (!access) return false;
    if (access.accessLevel === 'full_control') return true;
    return access.enabledActions.includes(action);
  };

  const hasModuleAccess = (moduleKey: string) => {
    const access = accessList.find((m) => m.moduleKey === moduleKey);
    if (!access) return false;
    return true; // As long as it's in the accessList, they have some access
  };

  return (
    <PermissionsContext.Provider value={{ loading, accessList, checkPermission, hasModuleAccess }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
