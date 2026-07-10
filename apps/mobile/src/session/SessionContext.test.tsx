import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionProvider, useSession, canUseAiFeatures } from './SessionContext';
import { createGuestChild, getGuestChild } from '../guest/guestStore';

function Probe() {
  const {
    isLoading,
    familyId,
    childId,
    accessToken,
    tier,
    isGuest,
    setFamilyId,
    setChildId,
    setAccessToken,
    setTier,
    continueAsGuest,
    setGuestChildId,
    clearChildId,
    reset,
  } = useSession();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text>familyId:{familyId ?? 'none'}</Text>
      <Text>childId:{childId ?? 'none'}</Text>
      <Text>accessToken:{accessToken ?? 'none'}</Text>
      <Text>tier:{tier ?? 'none'}</Text>
      <Text>isGuest:{String(isGuest)}</Text>
      <Text testID="child-id">{childId ?? ''}</Text>
      <Pressable onPress={() => setFamilyId('f1')}>
        <Text>set family</Text>
      </Pressable>
      <Pressable onPress={() => setChildId('c1')}>
        <Text>set child</Text>
      </Pressable>
      <Pressable onPress={() => setAccessToken('t1', 'free')}>
        <Text>set token</Text>
      </Pressable>
      <Pressable onPress={() => setTier('premium')}>
        <Text>set premium</Text>
      </Pressable>
      <Pressable onPress={() => continueAsGuest()}>
        <Text>continue as guest</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          const guestChild = createGuestChild({
            family_id: 'f1',
            nickname: 'Alex',
            birth_month: 6,
            birth_year: 2024,
            age_band: 'toddler',
            languages: ['English'],
          });
          setGuestChildId(guestChild.id);
        }}
      >
        <Text>set guest child</Text>
      </Pressable>
      <Pressable onPress={() => clearChildId()}>
        <Text>clear child</Text>
      </Pressable>
      <Pressable onPress={() => reset()}>
        <Text>reset</Text>
      </Pressable>
    </>
  );
}

describe('SessionProvider / useSession', () => {
  afterEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts with nothing set once loading finishes', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    expect(await screen.findByText('familyId:none')).toBeTruthy();
    expect(screen.getByText('childId:none')).toBeTruthy();
  });

  it('setFamilyId updates context state and persists to storage', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('familyId:none');
    fireEvent.press(screen.getByText('set family'));

    await waitFor(() => expect(screen.getByText('familyId:f1')).toBeTruthy());
    expect(await AsyncStorage.getItem('earlysteps.familyId')).toBe('f1');
  });

  it('resumes a previously persisted session on mount', async () => {
    await AsyncStorage.setItem('earlysteps.familyId', 'f1');
    await AsyncStorage.setItem('earlysteps.childId', 'c1');
    await AsyncStorage.setItem('earlysteps.accessToken', 't1');
    await AsyncStorage.setItem('earlysteps.tier', 'premium');

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    expect(await screen.findByText('familyId:f1')).toBeTruthy();
    expect(screen.getByText('childId:c1')).toBeTruthy();
    expect(screen.getByText('accessToken:t1')).toBeTruthy();
    expect(screen.getByText('tier:premium')).toBeTruthy();
  });

  it('setAccessToken updates context state and persists to storage (#97)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('accessToken:none');
    fireEvent.press(screen.getByText('set token'));

    await waitFor(() => expect(screen.getByText('accessToken:t1')).toBeTruthy());
    expect(screen.getByText('tier:free')).toBeTruthy();
    expect(await AsyncStorage.getItem('earlysteps.accessToken')).toBe('t1');
    expect(await AsyncStorage.getItem('earlysteps.tier')).toBe('free');
  });

  it('setTier updates context state and persists to storage without touching the rest (#99)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('accessToken:none');
    fireEvent.press(screen.getByText('set token'));
    await waitFor(() => expect(screen.getByText('tier:free')).toBeTruthy());

    fireEvent.press(screen.getByText('set premium'));

    await waitFor(() => expect(screen.getByText('tier:premium')).toBeTruthy());
    expect(screen.getByText('accessToken:t1')).toBeTruthy();
    expect(await AsyncStorage.getItem('earlysteps.tier')).toBe('premium');
  });

  it('continueAsGuest sets isGuest in state only, never to on-device storage (#99)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('isGuest:false');
    fireEvent.press(screen.getByText('continue as guest'));

    await waitFor(() => expect(screen.getByText('isGuest:true')).toBeTruthy());
    expect(await AsyncStorage.getItem('earlysteps.isGuest')).toBeNull();
  });

  it('reset also forgets isGuest (#99)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('isGuest:false');
    fireEvent.press(screen.getByText('continue as guest'));
    await waitFor(() => expect(screen.getByText('isGuest:true')).toBeTruthy());

    fireEvent.press(screen.getByText('reset'));

    await waitFor(() => expect(screen.getByText('isGuest:false')).toBeTruthy());
  });

  it('clearChildId forgets the child in state and storage but keeps the family (#20)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('familyId:none');
    fireEvent.press(screen.getByText('set family'));
    fireEvent.press(screen.getByText('set child'));
    await waitFor(() => expect(screen.getByText('childId:c1')).toBeTruthy());

    fireEvent.press(screen.getByText('clear child'));

    await waitFor(() => expect(screen.getByText('childId:none')).toBeTruthy());
    expect(screen.getByText('familyId:f1')).toBeTruthy();
    expect(await AsyncStorage.getItem('earlysteps.familyId')).toBe('f1');
    expect(await AsyncStorage.getItem('earlysteps.childId')).toBeNull();
  });

  it('reset clears context state and storage, including the access token (#97)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('familyId:none');
    fireEvent.press(screen.getByText('set family'));
    fireEvent.press(screen.getByText('set child'));
    fireEvent.press(screen.getByText('set token'));
    await waitFor(() => expect(screen.getByText('familyId:f1')).toBeTruthy());

    fireEvent.press(screen.getByText('reset'));

    await waitFor(() => expect(screen.getByText('familyId:none')).toBeTruthy());
    expect(screen.getByText('childId:none')).toBeTruthy();
    expect(screen.getByText('accessToken:none')).toBeTruthy();
    expect(screen.getByText('tier:none')).toBeTruthy();
    expect(await AsyncStorage.getItem('earlysteps.familyId')).toBeNull();
    expect(await AsyncStorage.getItem('earlysteps.accessToken')).toBeNull();
    expect(await AsyncStorage.getItem('earlysteps.tier')).toBeNull();
  });

  it('setGuestChildId updates state but never persists to on-device storage (issue #63)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('familyId:none');
    fireEvent.press(screen.getByText('set guest child'));

    await waitFor(() => expect(screen.getByText(/childId:guest:/)).toBeTruthy());
    expect(await AsyncStorage.getItem('earlysteps.childId')).toBeNull();
  });

  it('clearChildId also forgets a guest child from the in-memory guest store (#63)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('familyId:none');
    fireEvent.press(screen.getByText('set guest child'));
    await waitFor(() => expect(screen.getByText(/childId:guest:/)).toBeTruthy());
    const guestId = screen.getByTestId('child-id').props.children as string;

    fireEvent.press(screen.getByText('clear child'));

    await waitFor(() => expect(screen.getByText('childId:none')).toBeTruthy());
    expect(() => getGuestChild(guestId)).toThrow();
  });

  it('reset also forgets a guest child from the in-memory guest store (#63)', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('familyId:none');
    fireEvent.press(screen.getByText('set family'));
    fireEvent.press(screen.getByText('set guest child'));
    await waitFor(() => expect(screen.getByText(/childId:guest:/)).toBeTruthy());
    const guestId = screen.getByTestId('child-id').props.children as string;

    fireEvent.press(screen.getByText('reset'));

    await waitFor(() => expect(screen.getByText('childId:none')).toBeTruthy());
    expect(() => getGuestChild(guestId)).toThrow();
  });

  it('throws if useSession is called outside a SessionProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useSession();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(
      'useSession must be used within a SessionProvider',
    );
    spy.mockRestore();
  });
});

describe('canUseAiFeatures (#99)', () => {
  it('is false for a guest, regardless of tier', () => {
    expect(canUseAiFeatures({ isGuest: true, tier: 'premium' })).toBe(false);
    expect(canUseAiFeatures({ isGuest: true, tier: null })).toBe(false);
  });

  it('is false for a logged-in free-tier account', () => {
    expect(canUseAiFeatures({ isGuest: false, tier: 'free' })).toBe(false);
  });

  it('is true only for a logged-in premium account', () => {
    expect(canUseAiFeatures({ isGuest: false, tier: 'premium' })).toBe(true);
  });
});
