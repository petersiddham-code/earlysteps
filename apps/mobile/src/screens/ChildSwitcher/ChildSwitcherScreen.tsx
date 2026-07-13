import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { Child } from '@earlysteps/shared-types';
import { getChildren } from '../../api/index.js';
import { useSession } from '../../session/index.js';
import type { RootStackParamList } from '../../navigation/types.js';
import { PrimaryButton } from '../../components/index.js';
import { cardShadow, colors, radius, spacing, type } from '../../theme/index.js';

type Props = NativeStackScreenProps<RootStackParamList, 'ChildSwitcher'>;

/** Presentation only — the raw AgeBand id, made readable ("young_adult" -> "Young adult"). */
function bandLabel(ageBand: string): string {
  const spaced = ageBand.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Issue #23: lists every child recorded under the logged-in family, lets the caregiver pick
 * which one is active, or add another (reusing ChildProfileSetupScreen unchanged). Reached
 * from Results ("Switch child") and from Splash when a recovered family already has
 * children but no local childId is selected — never shown to a guest session, since nothing
 * is persisted server-side for one to list.
 */
export function ChildSwitcherScreen({ navigation }: Props) {
  const { familyId, childId, setChildId } = useSession();
  const [children, setChildren] = useState<Child[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!familyId) return;
    let cancelled = false;
    getChildren(familyId)
      .then((list) => {
        if (!cancelled) setChildren(list);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn't load your children. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  const handleSelect = async (child: Child) => {
    if (switchingId) return;
    setSwitchingId(child.id);
    try {
      await setChildId(child.id);
      navigation.replace('Results');
    } finally {
      setSwitchingId(null);
    }
  };

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!children) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>YOUR FAMILY</Text>
      <Text style={styles.heading}>Choose a child</Text>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={children}
        keyExtractor={(child) => child.id}
        renderItem={({ item }) => {
          const active = item.id === childId;
          return (
            <Pressable
              onPress={() => handleSelect(item)}
              style={[styles.row, active && styles.rowActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              testID={`child-row-${item.id}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.nickname}</Text>
                <Text style={styles.rowMeta}>{bandLabel(item.age_band)}</Text>
              </View>
              {active && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </Pressable>
          );
        }}
      />
      <View style={styles.addButton}>
        <PrimaryButton
          label="Add another child"
          variant="quiet"
          onPress={() => navigation.navigate('ChildProfileSetup')}
          testID="add-another-child-button"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  eyebrow: {
    ...type.eyebrow,
    color: colors.inkSoft,
    marginTop: spacing.xxxl + spacing.xxl,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  heading: { ...type.title, color: colors.ink, marginHorizontal: spacing.xl },
  errorText: { ...type.body, color: colors.inkSoft, textAlign: 'center' },
  list: { flex: 1, marginTop: spacing.lg },
  listContent: { paddingHorizontal: spacing.xl, gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    ...cardShadow,
  },
  rowActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  rowText: { flex: 1 },
  rowName: { ...type.bodyStrong, color: colors.ink },
  rowMeta: { ...type.caption, color: colors.inkSoft, marginTop: spacing.xs },
  addButton: { padding: spacing.xl },
});
