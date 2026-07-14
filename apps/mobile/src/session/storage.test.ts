import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearChildId,
  clearSession,
  loadSession,
  saveAccessToken,
  saveChildId,
  saveFamilyId,
  saveRole,
  saveTier,
} from './storage';

describe('session storage', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads null for everything when nothing has been saved', async () => {
    expect(await loadSession()).toEqual({
      familyId: null,
      childId: null,
      accessToken: null,
      tier: null,
      role: null,
    });
  });

  it('persists and reloads a familyId', async () => {
    await saveFamilyId('f1');
    expect(await loadSession()).toEqual({
      familyId: 'f1',
      childId: null,
      accessToken: null,
      tier: null,
      role: null,
    });
  });

  it('persists ids, the access token, the tier, and the role independently', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    await saveAccessToken('t1');
    await saveTier('premium');
    await saveRole('admin');
    expect(await loadSession()).toEqual({
      familyId: 'f1',
      childId: 'c1',
      accessToken: 't1',
      tier: 'premium',
      role: 'admin',
    });
  });

  it('clearChildId removes only the child, keeping the family (#20)', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    await clearChildId();
    expect(await loadSession()).toEqual({
      familyId: 'f1',
      childId: null,
      accessToken: null,
      tier: null,
      role: null,
    });
  });

  it('clearSession removes the ids, the access token, the tier, and the role (#97, #99, #125)', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    await saveAccessToken('t1');
    await saveTier('premium');
    await saveRole('admin');
    await clearSession();
    expect(await loadSession()).toEqual({
      familyId: null,
      childId: null,
      accessToken: null,
      tier: null,
      role: null,
    });
  });
});
