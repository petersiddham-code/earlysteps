import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * On-device persistence for the current family/child/login session so the app doesn't force
 * onboarding or a re-login on every restart. Identifiers and the auth token only — no
 * answers, scores, or PII beyond what's needed to resume (CLAUDE.md §3: "avoid storing
 * anything beyond what's needed to authenticate").
 */
const FAMILY_ID_KEY = 'earlysteps.familyId';
const CHILD_ID_KEY = 'earlysteps.childId';
const ACCESS_TOKEN_KEY = 'earlysteps.accessToken';

export interface StoredSession {
  familyId: string | null;
  childId: string | null;
  accessToken: string | null;
}

export async function loadSession(): Promise<StoredSession> {
  const [familyId, childId, accessToken] = await Promise.all([
    AsyncStorage.getItem(FAMILY_ID_KEY),
    AsyncStorage.getItem(CHILD_ID_KEY),
    AsyncStorage.getItem(ACCESS_TOKEN_KEY),
  ]);
  return { familyId, childId, accessToken };
}

export async function saveFamilyId(familyId: string): Promise<void> {
  await AsyncStorage.setItem(FAMILY_ID_KEY, familyId);
}

export async function saveChildId(childId: string): Promise<void> {
  await AsyncStorage.setItem(CHILD_ID_KEY, childId);
}

export async function saveAccessToken(accessToken: string): Promise<void> {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

/** Forget the child but keep the family (and its consent flags) — used to start a fresh
 * screening for another child's details (#20 interim, until multi-child lands, #23). */
export async function clearChildId(): Promise<void> {
  await AsyncStorage.removeItem(CHILD_ID_KEY);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([FAMILY_ID_KEY, CHILD_ID_KEY, ACCESS_TOKEN_KEY]);
}
