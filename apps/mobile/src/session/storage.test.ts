import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearChildId,
  clearSession,
  loadSession,
  saveChildId,
  saveFamilyId,
} from './storage';

describe('session storage', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('loads null for both ids when nothing has been saved', async () => {
    expect(await loadSession()).toEqual({ familyId: null, childId: null });
  });

  it('persists and reloads a familyId', async () => {
    await saveFamilyId('f1');
    expect(await loadSession()).toEqual({ familyId: 'f1', childId: null });
  });

  it('persists both ids independently', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    expect(await loadSession()).toEqual({ familyId: 'f1', childId: 'c1' });
  });

  it('clearChildId removes only the child, keeping the family (#20)', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    await clearChildId();
    expect(await loadSession()).toEqual({ familyId: 'f1', childId: null });
  });

  it('clearSession removes both ids', async () => {
    await saveFamilyId('f1');
    await saveChildId('c1');
    await clearSession();
    expect(await loadSession()).toEqual({ familyId: null, childId: null });
  });
});
