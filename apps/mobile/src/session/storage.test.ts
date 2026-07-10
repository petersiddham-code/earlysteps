import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearChildId,
  clearSession,
  loadSession,
  saveAccessToken,
  saveChildId,
  saveFamilyId,
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
    });
  });

  it('persists and reloads a familyId', async () => {
    await saveFamilyId('f1');
    expect(await loadSession()).toEqual({
      familyId: 'f1',
      childId: null,
      accessToken: null,
    });
  });

  it('persists ids and the access token independently', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    await saveAccessToken('t1');
    expect(await loadSession()).toEqual({
      familyId: 'f1',
      childId: 'c1',
      accessToken: 't1',
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
    });
  });

  it('clearSession removes the ids and the access token (#97)', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    await saveAccessToken('t1');
    await clearSession();
    expect(await loadSession()).toEqual({
      familyId: null,
      childId: null,
      accessToken: null,
    });
  });
});
