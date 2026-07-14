import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { cardShadow, colors, radius, spacing } from '../../theme/index.js';

/**
 * Issue #121: a persistent way to end the session from any authenticated screen, not just
 * Results — rendered once via each screen's header (RootNavigator), rather than duplicated
 * as a content button per screen. Wired with `headerTransparent` in RootNavigator so it
 * floats over each screen's own layout instead of reflowing the manual top padding every
 * screen already carries for the status bar/notch.
 */
export function LogoutButton() {
  const { reset } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleLogout = async () => {
    await reset();
    navigation.reset({ index: 0, routes: [{ name: 'Splash' }] });
  };

  return (
    <Pressable
      onPress={handleLogout}
      accessibilityRole="button"
      accessibilityLabel="Log out"
      hitSlop={8}
      testID="logout-button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="log-out-outline" size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
    ...cardShadow,
  },
  pressed: { backgroundColor: colors.primaryTint },
});
