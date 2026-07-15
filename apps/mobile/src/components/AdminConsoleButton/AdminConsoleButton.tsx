import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { isAdmin, useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { cardShadow, colors, radius, spacing } from '../../theme/index.js';

/**
 * Issue #125: the Admin Console's only entry point — renders nothing for a non-admin
 * session, so a parent account never sees it. Placed in ChildSwitcherScreen's header
 * (the main post-login hub) alongside LogoutButton, rather than in the shared
 * authenticatedScreenOptions every screen uses (RootNavigator) — this button is specific
 * to that one screen.
 */
export function AdminConsoleButton() {
  const session = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (!isAdmin(session)) return null;

  return (
    <Pressable
      onPress={() => navigation.navigate('AdminDashboard')}
      accessibilityRole="button"
      accessibilityLabel="Admin console"
      hitSlop={8}
      testID="admin-console-button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
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
    marginRight: spacing.sm,
    ...cardShadow,
  },
  pressed: { backgroundColor: colors.primaryTint },
});
