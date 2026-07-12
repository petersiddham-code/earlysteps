import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../../theme/index.js';

export interface AppWordmarkProps {
  /** 'stacked' (Splash: large centered mark above the name) or 'inline' (Login/Signup: small mark beside the name). */
  variant?: 'stacked' | 'inline';
}

/**
 * The one place that owns the icon-mark + "EarlySteps" name pairing (issue #112 product
 * identity pass) — previously duplicated inline on SplashScreen and absent entirely from
 * Login/Signup, which gave the app no visual identity at its two most trust-setting screens.
 */
export function AppWordmark({ variant = 'stacked' }: AppWordmarkProps) {
  const stacked = variant === 'stacked';
  return (
    <View style={stacked ? styles.stacked : styles.inline}>
      <View style={[styles.mark, stacked ? styles.markLarge : styles.markSmall]}>
        <Ionicons
          name="footsteps-outline"
          size={stacked ? 34 : 20}
          color={colors.primary}
        />
      </View>
      <Text style={stacked ? styles.titleLarge : styles.titleSmall}>EarlySteps</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stacked: { alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: {
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLarge: { width: 72, height: 72, marginBottom: spacing.lg },
  markSmall: { width: 36, height: 36 },
  titleLarge: { ...type.display, color: colors.ink },
  titleSmall: { ...type.title, color: colors.ink },
});
