import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  clearChildId as clearStoredChildId,
  clearSession,
  loadSession,
  saveChildId,
  saveFamilyId,
} from './storage.js';

export interface SessionValue {
  isLoading: boolean;
  familyId: string | null;
  childId: string | null;
  setFamilyId: (familyId: string) => Promise<void>;
  setChildId: (childId: string) => Promise<void>;
  /** Forget the child, keep the family + consent — start a fresh screening (#20). */
  clearChildId: () => Promise<void>;
  reset: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyIdState] = useState<string | null>(null);
  const [childId, setChildIdState] = useState<string | null>(null);

  useEffect(() => {
    loadSession().then((stored) => {
      setFamilyIdState(stored.familyId);
      setChildIdState(stored.childId);
      setIsLoading(false);
    });
  }, []);

  const setFamilyId = async (id: string) => {
    await saveFamilyId(id);
    setFamilyIdState(id);
  };

  const setChildId = async (id: string) => {
    await saveChildId(id);
    setChildIdState(id);
  };

  const clearChildId = async () => {
    await clearStoredChildId();
    setChildIdState(null);
  };

  const reset = async () => {
    await clearSession();
    setFamilyIdState(null);
    setChildIdState(null);
  };

  return (
    <SessionContext.Provider
      value={{
        isLoading,
        familyId,
        childId,
        setFamilyId,
        setChildId,
        clearChildId,
        reset,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used within a SessionProvider');
  return value;
}
