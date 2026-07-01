import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CONSENT_SCOPES, type ConsentScope } from '@earlysteps/shared-types';
import {
  ScreeningDisclaimer,
  TrafficLightBar,
  StrengthsFirstList,
  RedFlagBanner,
  ConsentToggle,
} from './src/components';

/**
 * Demo screen composing the five safety-carrying shared components (CLAUDE.md §6) with
 * representative sample data. Not a real app screen/flow — navigation, real intake data, and
 * the results-fetch pipeline are out of scope here. This exists so the components can be
 * visually sanity-checked (`pnpm --filter @earlysteps/mobile start`) beyond their unit tests.
 */
export default function App() {
  const [consent, setConsent] = useState<Record<ConsentScope, boolean>>({
    data_storage: true,
    ai_analysis: false,
    media_capture: false,
    professional_sharing: false,
  });

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StatusBar style="auto" />

      <Text style={styles.heading}>Here's what we noticed</Text>
      <ScreeningDisclaimer />

      <StrengthsFirstList
        strengths={['Loves music and dancing', 'Great memory for routines']}
        needs={['Communication differences', 'Sensory sensitivities to loud sounds']}
      />

      <View style={styles.section}>
        <TrafficLightBar domain="social" level="some" confidence="medium" />
        <TrafficLightBar domain="communication" level="low" confidence="high" />
        <TrafficLightBar domain="sensory" level="many" confidence="low" />
      </View>

      <RedFlagBanner redFlagTypes={['no_name_response']} />

      <Text style={styles.heading}>Consent</Text>
      {CONSENT_SCOPES.map((scope) => (
        <ConsentToggle
          key={scope}
          scope={scope}
          value={consent[scope]}
          onChange={(next) => setConsent((prev) => ({ ...prev, [scope]: next }))}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    color: '#1F2933',
  },
  section: {
    marginVertical: 12,
  },
});
