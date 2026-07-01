import { Text, Pressable } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionProvider, useSession } from './SessionContext';

function Probe() {
  const { isLoading, familyId, childId, setFamilyId, setChildId, reset } = useSession();
  if (isLoading) return <Text>loading</Text>;
  return (
    <>
      <Text>familyId:{familyId ?? 'none'}</Text>
      <Text>childId:{childId ?? 'none'}</Text>
      <Pressable onPress={() => setFamilyId('f1')}>
        <Text>set family</Text>
      </Pressable>
      <Pressable onPress={() => setChildId('c1')}>
        <Text>set child</Text>
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

    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );

    expect(await screen.findByText('familyId:f1')).toBeTruthy();
    expect(screen.getByText('childId:c1')).toBeTruthy();
  });

  it('reset clears both context state and storage', async () => {
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await screen.findByText('familyId:none');
    fireEvent.press(screen.getByText('set family'));
    fireEvent.press(screen.getByText('set child'));
    await waitFor(() => expect(screen.getByText('familyId:f1')).toBeTruthy());

    fireEvent.press(screen.getByText('reset'));

    await waitFor(() => expect(screen.getByText('familyId:none')).toBeTruthy());
    expect(screen.getByText('childId:none')).toBeTruthy();
    expect(await AsyncStorage.getItem('earlysteps.familyId')).toBeNull();
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
