import { StyleSheet, Switch, Text, View } from 'react-native';
import type { ConsentScope } from '@earlysteps/shared-types';
import { CONSENT_COPY } from '@earlysteps/content';

export interface ConsentToggleProps {
  scope: ConsentScope;
  value: boolean;
  onChange: (next: boolean) => void;
}

/**
 * One layer of consent (CLAUDE.md §6, product plan §4.7). Each scope is toggled
 * independently — the Consent Center renders one `<ConsentToggle scope=... />` per scope,
 * never a single bundled "I agree." Controlled component: the caller (onboarding flow) owns
 * consent state so it can be persisted, revoked, and audited. Label + explanation come from
 * @earlysteps/content, not hardcoded, so a consent-copy change routes through clinical review
 * like any other result/report copy.
 */
export function ConsentToggle({ scope, value, onChange }: ConsentToggleProps) {
  const copy = CONSENT_COPY.scopes[scope];

  return (
    <View style={styles.row}>
      <View style={styles.textColumn}>
        <Text style={styles.label}>{copy.label}</Text>
        <Text style={styles.explanation}>{copy.explanation}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={copy.label}
        accessibilityRole="switch"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  textColumn: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2933',
  },
  explanation: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: '#5A6672',
  },
});
