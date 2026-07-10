import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  clearChildId as clearStoredChildId,
  clearSession,
  loadSession,
  saveAccessToken as saveStoredAccessToken,
  saveChildId,
  saveFamilyId,
} from './storage.js';
import { forgetGuestChild, isGuestChildId } from '../guest/guestStore.js';

export interface SessionValue {
  isLoading: boolean;
  familyId: string | null;
  childId: string | null;
  /** Issue #97: presence gates the whole app behind Login/Signup — see SplashScreen. */
  accessToken: string | null;
  setFamilyId: (familyId: string) => Promise<void>;
  setChildId: (childId: string) => Promise<void>;
  setAccessToken: (accessToken: string) => Promise<void>;
  /**
   * Guest/ephemeral child (issue #63): held in state only, never written to on-device
   * storage — an app restart forgets it, matching "we have nowhere to keep your answers."
   */
  setGuestChildId: (childId: string) => void;
  /** Forget the child, keep the family + consent — start a fresh screening (#20). */
  clearChildId: () => Promise<void>;
  reset: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [familyId, setFamilyIdState] = useState<string | null>(null);
  const [childId, setChildIdState] = useState<string | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);

  useEffect(() => {
    loadSession().then((stored) => {
      setFamilyIdState(stored.familyId);
      setChildIdState(stored.childId);
      setAccessTokenState(stored.accessToken);
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

  const setAccessToken = async (token: string) => {
    await saveStoredAccessToken(token);
    setAccessTokenState(token);
  };

  const setGuestChildId = (id: string) => {
    setChildIdState(id);
  };

  const clearChildId = async () => {
    if (childId && isGuestChildId(childId)) forgetGuestChild(childId);
    await clearStoredChildId();
    setChildIdState(null);
  };

  const reset = async () => {
    if (childId && isGuestChildId(childId)) forgetGuestChild(childId);
    await clearSession();
    setFamilyIdState(null);
    setChildIdState(null);
    setAccessTokenState(null);
  };

  return (
    <SessionContext.Provider
      value={{
        isLoading,
        familyId,
        childId,
        accessToken,
        setFamilyId,
        setChildId,
        setAccessToken,
        setGuestChildId,
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
