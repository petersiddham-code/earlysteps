import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserRole, UserTier } from '@earlysteps/shared-types';
import {
  clearChildId as clearStoredChildId,
  clearSession,
  loadSession,
  saveAccessToken as saveStoredAccessToken,
  saveChildId,
  saveFamilyId,
  saveRole as saveStoredRole,
  saveTier as saveStoredTier,
} from './storage.js';
import { forgetGuestChild, isGuestChildId } from '../guest/guestStore.js';
import { setAuthToken } from '../api/client.js';

export interface SessionValue {
  isLoading: boolean;
  familyId: string | null;
  childId: string | null;
  /**
   * Issue #97: presence gates the whole app behind Login/Signup — see SplashScreen.
   * Issue #99: `isGuest` is the other way past that gate.
   */
  accessToken: string | null;
  /** The logged-in account's tier ('free' | 'premium') — null when logged out or guest. */
  tier: UserTier | null;
  /** The logged-in account's role ('parent' | 'admin') — null when logged out or guest. */
  role: UserRole | null;
  /**
   * Issue #99: true once the caregiver chose "Continue as guest" on Login. Held in state
   * only, never persisted — an app restart forgets it, the same ephemerality contract as
   * a guest child (below), so a guest session never silently survives a restart.
   */
  isGuest: boolean;
  setFamilyId: (familyId: string) => Promise<void>;
  setChildId: (childId: string) => Promise<void>;
  setAccessToken: (accessToken: string, tier: UserTier, role: UserRole) => Promise<void>;
  /** Updates the tier after a successful upgrade, without touching anything else. */
  setTier: (tier: UserTier) => Promise<void>;
  /** Issue #99: bypasses Login entirely — see LoginScreen "Continue as guest". */
  continueAsGuest: () => void;
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
  const [tier, setTierState] = useState<UserTier | null>(null);
  const [role, setRoleState] = useState<UserRole | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    loadSession().then((stored) => {
      setFamilyIdState(stored.familyId);
      setChildIdState(stored.childId);
      setAccessTokenState(stored.accessToken);
      setTierState(stored.tier);
      setRoleState(stored.role);
      setAuthToken(stored.accessToken);
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

  const setAccessToken = async (
    token: string,
    nextTier: UserTier,
    nextRole: UserRole,
  ) => {
    await Promise.all([
      saveStoredAccessToken(token),
      saveStoredTier(nextTier),
      saveStoredRole(nextRole),
    ]);
    setAccessTokenState(token);
    setTierState(nextTier);
    setRoleState(nextRole);
    setAuthToken(token);
  };

  const setTier = async (nextTier: UserTier) => {
    await saveStoredTier(nextTier);
    setTierState(nextTier);
  };

  const continueAsGuest = () => {
    setIsGuest(true);
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
    setTierState(null);
    setRoleState(null);
    setIsGuest(false);
    setAuthToken(null);
  };

  return (
    <SessionContext.Provider
      value={{
        isLoading,
        familyId,
        childId,
        accessToken,
        tier,
        role,
        isGuest,
        setFamilyId,
        setChildId,
        setAccessToken,
        setTier,
        continueAsGuest,
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

/**
 * Issue #99: AI-assisted free-text analysis is a premium, logged-in-only feature — a
 * guest session or a free-tier account never reaches the LLM stage, regardless of
 * ai_analysis consent. Frontend-only gate (docs/clinical-review/content-gaps.md §6):
 * without the User<->Family link, the backend can't yet enforce this itself.
 */
export function canUseAiFeatures(
  session: Pick<SessionValue, 'isGuest' | 'tier'>,
): boolean {
  return !session.isGuest && session.tier === 'premium';
}

/**
 * Issue #125: gates the Admin Console entry point. A guest session never has a role at
 * all (never persisted, matching canUseAiFeatures's guest exclusion above).
 */
export function isAdmin(session: Pick<SessionValue, 'isGuest' | 'role'>): boolean {
  return !session.isGuest && session.role === 'admin';
}
