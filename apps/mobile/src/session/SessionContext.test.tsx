import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionProvider, useSession } from './SessionContext';
import { createGuestChild, getGuestChild } from '../guest/guestStore';

function Probe() {
  const {
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
  } = useSession();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text>familyId:{familyId ?? 'none'}</Text>
      <Text>childId:{childId ?? 'none'}</Text>
      <Text>accessToken:{accessToken ?? 'none'}</Text>
      <Text testID="child-id">{childId ?? ''}</Text>
      <Pressable onPress={() => setFamilyId('f1')}>
        <Text>set family</Text>
      </Pressable>
      <Pressable onPress={() => setChildId('c1')}>
        <Text>set child</Text>
      </Pressable>
      <Pressable onPress={() => setAccessToken('t1')}>
        <Text>set token</Text>
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

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    expect(await screen.findByText('familyId:f1')).toBeTruthy();
    expect(screen.getByText('childId:c1')).toBeTruthy();
    expect(screen.getByText('accessToken:t1')).toBeTruthy();
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
    expect(await AsyncStorage.getItem('earlysteps.accessToken')).toBe('t1');
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
    expect(await AsyncStorage.getItem('earlysteps.familyId')).toBeNull();
    expect(await AsyncStorage.getItem('earlysteps.accessToken')).toBeNull();
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
