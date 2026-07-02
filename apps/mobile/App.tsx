import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SessionProvider } from './src/session/index.js';
import { RootNavigator } from './src/navigation/RootNavigator.js';
import { colors } from './src/theme/index.js';

// Screen transitions show the navigator's background for a frame — keep it the app's
// mist tone so navigation never flashes white between the themed screens.
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    primary: colors.primary,
    text: colors.ink,
    card: colors.card,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationContainer theme={navigationTheme}>
          <StatusBar style="auto" />
          <RootNavigator />
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
